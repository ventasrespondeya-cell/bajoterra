import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Backpack,
  Compass,
  Crown,
  FastForward,
  Flame,
  Home,
  MapPin,
  ShieldAlert,
  Sparkles,
  Swords,
  Zap,
} from 'lucide-react';
import { BIOME_INFO, ELEMENT_CHART, getSpecies } from '../game/data';
import { sound } from '../game/audio';
import {
  CinematicQueueController,
  getCinematicDurationMs,
  isBattleIntroEvent,
} from '../game/cinematicDirectorState';
import { cinematicEvents, type CinematicEvent } from '../game/cinematicEvents';
import { getSlugDesignSheet } from '../game/slugArtDirection';
import type { HudSnapshot } from '../game/types';
import { SlugPortrait } from './SlugPortrait';

interface CinematicDirectorProps {
  snap: HudSnapshot;
  onBattleIntroActiveChange?: (active: boolean) => void;
}

const SPARK_POSITIONS = [
  { left: '14%', top: '26%', delay: '0ms' },
  { left: '84%', top: '22%', delay: '220ms' },
  { left: '22%', top: '76%', delay: '440ms' },
  { left: '78%', top: '72%', delay: '660ms' },
  { left: '50%', top: '14%', delay: '320ms' },
  { left: '48%', top: '86%', delay: '520ms' },
];

export const CinematicDirector: React.FC<CinematicDirectorProps> = ({
  snap,
  onBattleIntroActiveChange,
}) => {
  const controllerRef = useRef<CinematicQueueController>(new CinematicQueueController());
  const [featured, setFeatured] = useState<CinematicEvent | null>(null);
  const [ambient, setAmbient] = useState<CinematicEvent | null>(null);
  const [phaseIndex, setPhaseIndex] = useState<number>(0);

  const featuredTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stageTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const ambientTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedMotionRef = useRef<boolean>(Boolean(snap.options.reducedMotion));

  useEffect(() => {
    reducedMotionRef.current = Boolean(snap.options.reducedMotion);
  }, [snap.options.reducedMotion]);

  const clearFeaturedTimers = useCallback(() => {
    if (featuredTimerRef.current !== null) {
      clearTimeout(featuredTimerRef.current);
      featuredTimerRef.current = null;
    }
    stageTimersRef.current.forEach((t) => clearTimeout(t));
    stageTimersRef.current = [];
  }, []);

  const clearAmbientTimer = useCallback(() => {
    if (ambientTimerRef.current !== null) {
      clearTimeout(ambientTimerRef.current);
      ambientTimerRef.current = null;
    }
  }, []);

  const syncFromController = useCallback(() => {
    const qSnap = controllerRef.current.getSnapshot();
    setFeatured(qSnap.featured);
    setAmbient(qSnap.ambient);
    onBattleIntroActiveChange?.(qSnap.battleIntroLocked);
  }, [onBattleIntroActiveChange]);

  const startFeaturedSequence = useCallback(
    (ev: CinematicEvent | null) => {
      clearFeaturedTimers();
      if (!ev) {
        setPhaseIndex(0);
        syncFromController();
        return;
      }

      setPhaseIndex(0);
      syncFromController();

      // Coordinate audio cue cleanly for battle intro sweeps
      if (ev.type === 'encounter_intro' || ev.type === 'combat_intro') {
        sound.playDuelIntro(ev.enemyKind === 'boss');
      }

      const reduced = reducedMotionRef.current;
      const totalMs = getCinematicDurationMs(ev, reduced);

      // Choreograph internal sequence phases
      if (ev.type === 'slug_captured') {
        const t1 = setTimeout(() => setPhaseIndex(1), Math.round(totalMs * 0.2));
        const t2 = setTimeout(() => setPhaseIndex(2), Math.round(totalMs * 0.4));
        stageTimersRef.current.push(t1, t2);
      } else if (ev.type === 'megamorph_awakened') {
        const t1 = setTimeout(() => setPhaseIndex(1), Math.round(totalMs * 0.34));
        stageTimersRef.current.push(t1);
      } else if (ev.type === 'encounter_intro') {
        const t1 = setTimeout(() => setPhaseIndex(1), Math.round(totalMs * 0.52));
        stageTimersRef.current.push(t1);
      }

      featuredTimerRef.current = setTimeout(() => {
        const next = controllerRef.current.finishFeatured();
        startFeaturedSequence(next);
      }, totalMs);
    },
    [clearFeaturedTimers, syncFromController]
  );

  const handleSkipFeatured = useCallback(() => {
    const current = controllerRef.current.getSnapshot().featured;
    if (!current || !current.skippable) return;
    const next = controllerRef.current.skipFeatured();
    startFeaturedSequence(next);
  }, [startFeaturedSequence]);

  const startAmbientBanner = useCallback(
    (ev: CinematicEvent) => {
      clearAmbientTimer();
      syncFromController();
      const ms = getCinematicDurationMs(ev, reducedMotionRef.current);
      ambientTimerRef.current = setTimeout(() => {
        controllerRef.current.finishAmbient(ev.id);
        syncFromController();
      }, ms);
    },
    [clearAmbientTimer, syncFromController]
  );

  // Subscribe once to global cinematicEvents bus & ensure full cleanup on unmount
  useEffect(() => {
    const unsub = cinematicEvents.subscribe((ev) => {
      const prevFeatured = controllerRef.current.getSnapshot().featured;
      const res = controllerRef.current.enqueue(ev);
      if (!res.accepted) return;

      if (res.startedAmbient) {
        startAmbientBanner(res.startedAmbient);
      }
      if (res.startedFeatured && res.startedFeatured.id !== prevFeatured?.id) {
        startFeaturedSequence(res.startedFeatured);
      } else {
        syncFromController();
      }
    });

    return () => {
      unsub();
      clearFeaturedTimers();
      clearAmbientTimer();
      controllerRef.current.clearAll();
      onBattleIntroActiveChange?.(false);
    };
  }, [
    clearAmbientTimer,
    clearFeaturedTimers,
    onBattleIntroActiveChange,
    startAmbientBanner,
    startFeaturedSequence,
    syncFromController,
  ]);

  // Auto-release any active battle intro lock if player exits battle early
  useEffect(() => {
    if (!snap.battle && isBattleIntroEvent(featured)) {
      const next = controllerRef.current.finishFeatured();
      startFeaturedSequence(next);
    }
  }, [featured, snap.battle, startFeaturedSequence]);

  // Allow instant skip via Escape / Enter / Space on active skippable cinematics
  useEffect(() => {
    if (!featured || !featured.skippable || featured.type === 'biome_discovered') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        handleSkipFeatured();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [featured, handleSkipFeatured]);

  const reducedClass = snap.options.reducedMotion ? 'bt-reduced-motion' : '';

  const sp = featured?.speciesId ? getSpecies(featured.speciesId) : null;
  const elColor =
    (featured?.slugElement && ELEMENT_CHART[featured.slugElement]?.color) ||
    sp?.color ||
    (featured?.biome ? BIOME_INFO[featured.biome].accent : '#2dd4bf');

  return (
    <div className={`pointer-events-none fixed inset-0 z-[60] ${reducedClass}`}>
      {/* 1. DISCREET NON-BLOCKING POI BANNER (ambient) */}
      {ambient && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-14 sm:top-4 left-1/2 -translate-x-1/2 z-[61] max-w-[92vw] px-2"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div className="bt-hud-panel bt-animate-modal rounded-full px-4 py-1.5 border-cyan-300/45 flex items-center gap-2.5 shadow-xl">
            <MapPin className="w-4 h-4 text-amber-300 shrink-0" />
            <div className="flex items-center gap-2 text-xs min-w-0">
              <span className="font-extrabold text-white truncate">{ambient.title}</span>
              {ambient.subtitle && (
                <span className="text-[11px] text-teal-300 font-semibold hidden sm:inline shrink-0">
                  · {ambient.subtitle}
                </span>
              )}
              <span className="text-[10px] font-extrabold text-amber-300 shrink-0">+10 EXP</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. BIOME DISCOVERY BANNER (Highlight, Non-blocking) */}
      {featured && featured.type === 'biome_discovered' && (
        <div
          className="fixed top-14 sm:top-8 left-1/2 -translate-x-1/2 z-[62] w-[min(94vw,540px)] pointer-events-auto"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div
            onClick={handleSkipFeatured}
            className="relative overflow-hidden bt-panel bt-animate-modal rounded-2xl px-5 py-4 text-center cursor-pointer shadow-2xl"
            style={{ borderColor: `${elColor}88` }}
          >
            {!snap.options.reducedMotion && (
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                {SPARK_POSITIONS.slice(0, 4).map((pos, i) => (
                  <span
                    key={i}
                    className="bt-cinematic-spark absolute w-1.5 h-1.5 rounded-full"
                    style={{
                      left: pos.left,
                      top: pos.top,
                      animationDelay: pos.delay,
                      backgroundColor: elColor,
                      boxShadow: `0 0 10px ${elColor}`,
                    }}
                  />
                ))}
              </div>
            )}
            <div className="relative flex flex-col items-center gap-1">
              <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-[0.22em] text-teal-300 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5" style={{ color: elColor }} />
                Nuevo Bioma Descubierto
              </span>
              <h2
                className="text-xl sm:text-3xl font-black tracking-wide text-white"
                style={{ textShadow: `0 0 22px ${elColor}66` }}
              >
                {featured.title}
              </h2>
              {featured.subtitle && (
                <p className="text-xs sm:text-sm text-slate-200/90 max-w-md">{featured.subtitle}</p>
              )}
              <span className="mt-1 text-[10px] text-slate-400">Toca para cerrar</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. CAPTURE REVEAL CINEMATIC */}
      {featured && featured.type === 'slug_captured' && (
        <div
          onClick={handleSkipFeatured}
          className="pointer-events-auto fixed inset-0 z-[65] flex items-center justify-center p-4 bg-[#03080e]/78 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bt-panel bt-animate-modal rounded-2xl p-5 sm:p-6 text-center overflow-hidden"
            style={{ borderColor: `${elColor}90` }}
          >
            {/* Skip button */}
            {featured.skippable && (
              <button
                type="button"
                onClick={handleSkipFeatured}
                aria-label="Saltar cinemática de captura"
                className="absolute top-3 right-3 z-20 bt-btn-secondary px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <FastForward className="w-3.5 h-3.5" />
                Saltar
              </button>
            )}

            {/* Ambient sparks */}
            {!snap.options.reducedMotion && (
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                {SPARK_POSITIONS.map((pos, i) => (
                  <span
                    key={i}
                    className="bt-cinematic-spark absolute w-2 h-2 rounded-full"
                    style={{
                      left: pos.left,
                      top: pos.top,
                      animationDelay: pos.delay,
                      backgroundColor: elColor,
                      boxShadow: `0 0 12px ${elColor}`,
                    }}
                  />
                ))}
              </div>
            )}

            {/* Top badge */}
            <div className="relative z-10 flex justify-center mb-3">
              {featured.isNewSpecies ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-300/75 text-amber-200 text-[11px] font-black tracking-wider uppercase">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  ¡Nueva Especie Registrada!
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-300/55 text-teal-200 text-[11px] font-extrabold tracking-wider uppercase">
                  <Zap className="w-3.5 h-3.5 text-teal-300" />
                  Captura Completada · Ya Registrada
                </span>
              )}
            </div>

            {/* Central Stage: Cylinder -> Silhouette -> Reveal */}
            <div className="relative z-10 h-36 flex items-center justify-center my-2">
              {!snap.options.reducedMotion && phaseIndex >= 1 && (
                <div
                  className="bt-cinematic-shockwave absolute w-28 h-28 rounded-full border-2 pointer-events-none"
                  style={{ borderColor: elColor }}
                />
              )}

              {phaseIndex === 0 ? (
                /* Stage 0: Technological Capture Cylinder Locking */
                <div className="relative flex items-center justify-center">
                  <div
                    className={`${!snap.options.reducedMotion ? 'bt-cinematic-spin' : ''} w-24 h-24 rounded-full border-2 border-dashed flex items-center justify-center`}
                    style={{ borderColor: elColor }}
                  />
                  <div
                    className="absolute w-14 h-20 rounded-2xl border-2 bg-[#0a1b2b] flex flex-col items-center justify-center gap-1.5 shadow-xl"
                    style={{ borderColor: '#99f6e4', boxShadow: `0 0 24px ${elColor}66` }}
                  >
                    <div className="w-9 h-2 rounded-full bg-teal-300/80" />
                    <div
                      className="w-6 h-6 rounded-full border border-white/60"
                      style={{ backgroundColor: elColor }}
                    />
                    <div className="w-9 h-2 rounded-full bg-teal-300/80" />
                  </div>
                </div>
              ) : phaseIndex === 1 && featured.speciesId ? (
                /* Stage 1: Glowing Silhouette */
                <div
                  className="bt-cinematic-pop flex items-center justify-center"
                  style={{
                    filter: `drop-shadow(0 0 18px ${elColor})`,
                  }}
                >
                  <SlugPortrait speciesId={featured.speciesId} mood="happy" size={114} silhouette />
                </div>
              ) : (
                /* Stage 2: Full Revealed Slug */
                <div className="bt-cinematic-pop relative flex items-center justify-center">
                  <div
                    className="absolute w-28 h-28 rounded-full blur-xl opacity-45"
                    style={{ backgroundColor: elColor }}
                  />
                  {featured.speciesId && (
                    <SlugPortrait
                      speciesId={featured.speciesId}
                      mood={featured.isNewSpecies ? 'victory' : 'happy'}
                      size={116}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Text Reveal */}
            <div className="relative z-10 space-y-2 mt-1">
              {phaseIndex < 2 ? (
                <div className="text-sm font-bold text-teal-200 tracking-wide">
                  {phaseIndex === 0 ? 'Sellando cilindro de captura...' : 'Identificando bioforma...'}
                </div>
              ) : (
                <>
                  <div>
                    <h3 className="text-2xl font-black text-white tracking-wide">
                      {featured.slugName || featured.title}
                    </h3>
                    <div className="flex items-center justify-center gap-2 mt-1 text-xs font-bold">
                      <span
                        className="px-2.5 py-0.5 rounded-full border text-white"
                        style={{ backgroundColor: `${elColor}26`, borderColor: `${elColor}80` }}
                      >
                        {featured.slugElement || sp?.type || 'Energía'}
                      </span>
                      {featured.enemyLevel && (
                        <span className="text-slate-300 tabular-nums">Nv.{featured.enemyLevel}</span>
                      )}
                      {featured.slugRarity && (
                        <span className="text-amber-300">· {featured.slugRarity}</span>
                      )}
                    </div>
                  </div>

                  {featured.speciesId && (
                    <p className="text-xs text-teal-200 italic max-w-sm mx-auto">
                      {getSlugDesignSheet(featured.speciesId).personalityQuote}
                    </p>
                  )}

                  {featured.loreLine && (
                    <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
                      {featured.loreLine}
                    </p>
                  )}

                  {/* Destination indicator */}
                  <div className="pt-1 flex justify-center">
                    <div className="bt-inset rounded-xl px-3.5 py-2 text-xs font-extrabold text-teal-100 inline-flex items-center gap-2">
                      {featured.captureDestination === 'storage' ? (
                        <>
                          <Home className="w-4 h-4 text-emerald-300" />
                          <span>Enviada al Refugio (Estuche completo)</span>
                        </>
                      ) : (
                        <>
                          <Backpack className="w-4 h-4 text-amber-300" />
                          <span>Añadida a tu Estuche activo</span>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {phaseIndex === 2 && (
              <button
                type="button"
                onClick={handleSkipFeatured}
                className="relative z-10 mt-4 w-full bt-btn-primary py-2.5 rounded-xl font-extrabold text-xs cursor-pointer min-h-[40px]"
              >
                Continuar
              </button>
            )}
          </div>
        </div>
      )}

      {/* 4. MEGAMORPH EVOLUTION CINEMATIC */}
      {featured && featured.type === 'megamorph_awakened' && (
        <div
          onClick={handleSkipFeatured}
          className="pointer-events-auto fixed inset-0 z-[65] flex items-center justify-center p-4 bg-[#03070d]/84 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bt-panel bt-animate-modal rounded-2xl p-5 sm:p-6 text-center overflow-hidden border-amber-300/75"
          >
            {featured.skippable && (
              <button
                type="button"
                onClick={handleSkipFeatured}
                aria-label="Saltar evolución Megamorph"
                className="absolute top-3 right-3 z-20 bt-btn-secondary px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <FastForward className="w-3.5 h-3.5" />
                Saltar
              </button>
            )}

            {!snap.options.reducedMotion && (
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                {SPARK_POSITIONS.map((pos, i) => (
                  <span
                    key={i}
                    className="bt-cinematic-spark absolute w-2 h-2 rounded-full bg-amber-300"
                    style={{
                      left: pos.left,
                      top: pos.top,
                      animationDelay: pos.delay,
                      boxShadow: `0 0 12px ${elColor}`,
                    }}
                  />
                ))}
              </div>
            )}

            <div className="relative z-10 flex justify-center mb-2">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-400/20 border border-amber-300/80 text-amber-200 text-[11px] font-black uppercase tracking-widest">
                <Flame className="w-3.5 h-3.5 text-amber-300" />
                Evolución Megamorph
              </span>
            </div>

            <div className="relative z-10 h-36 flex items-center justify-center my-2">
              {!snap.options.reducedMotion && phaseIndex === 1 && (
                <div
                  className="bt-cinematic-shockwave absolute w-32 h-32 rounded-full border-4 border-amber-300 pointer-events-none"
                />
              )}
              <div
                className="absolute w-28 h-28 rounded-full blur-xl opacity-55"
                style={{ backgroundColor: phaseIndex === 1 ? '#facc15' : elColor }}
              />
              {featured.speciesId && (
                <div className={phaseIndex === 1 ? 'bt-cinematic-pop' : 'bt-animate-aura'}>
                  <SlugPortrait
                    speciesId={featured.speciesId}
                    mega={phaseIndex === 1}
                    mood={phaseIndex === 1 ? 'transform' : 'charge'}
                    size={122}
                  />
                </div>
              )}
            </div>

            <div className="relative z-10 space-y-1.5">
              {phaseIndex === 0 ? (
                <div className="text-sm font-extrabold text-amber-200 tracking-wide">
                  ¡Superando velocidad 200 MPH!
                </div>
              ) : (
                <>
                  <h3 className="text-2xl font-black text-amber-300 tracking-wide">
                    {featured.subtitle || featured.title}
                  </h3>
                  <div className="text-xs font-bold text-white">
                    {featured.slugName || featured.title} alcanzó su forma Megamorph ·{' '}
                    <span style={{ color: elColor }}>{featured.slugElement || sp?.type}</span>
                  </div>
                  {featured.loreLine && (
                    <p className="text-xs text-slate-300 max-w-sm mx-auto pt-1">{featured.loreLine}</p>
                  )}
                  <button
                    type="button"
                    onClick={handleSkipFeatured}
                    className="mt-3 w-full bt-btn-amber py-2.5 rounded-xl font-extrabold text-xs cursor-pointer min-h-[40px]"
                  >
                    ¡Increíble!
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. ENCOUNTER & COMBAT VS INTRO (Mercenary / Guardian / Boss / Wild) */}
      {featured && (featured.type === 'encounter_intro' || featured.type === 'combat_intro') && (
        <div
          onClick={handleSkipFeatured}
          className="pointer-events-auto fixed inset-0 z-[64] flex items-center justify-center p-3 sm:p-5 bg-[#03070e]/82 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-xl bt-panel bt-animate-modal rounded-2xl p-4 sm:p-6 overflow-hidden"
            style={{
              borderColor:
                featured.enemyKind === 'boss' ? 'rgba(244, 63, 94, 0.85)' : `${elColor}88`,
            }}
          >
            {/* Elemental Slash Backdrop */}
            <div
              className="bt-cinematic-slash pointer-events-none absolute -inset-x-10 top-1/2 -translate-y-1/2 h-24 -rotate-6 opacity-25"
              style={{
                background: `linear-gradient(90deg, transparent 0%, ${
                  featured.enemyKind === 'boss' ? '#f43f5e' : elColor
                } 50%, transparent 100%)`,
              }}
            />

            {featured.skippable && (
              <button
                type="button"
                onClick={handleSkipFeatured}
                aria-label="Saltar presentación de combate"
                className="absolute top-3 right-3 z-20 bt-btn-secondary px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <FastForward className="w-3.5 h-3.5" />
                Saltar
              </button>
            )}

            {featured.type === 'encounter_intro' && phaseIndex === 0 ? (
              /* Rival / Boss Showcase Stage */
              <div className="relative z-10 flex flex-col items-center text-center py-2 gap-2.5">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest border ${
                    featured.enemyKind === 'boss'
                      ? 'bg-rose-500/20 border-rose-400/80 text-rose-200'
                      : 'bg-amber-500/20 border-amber-300/70 text-amber-200'
                  }`}
                >
                  {featured.enemyKind === 'boss' ? (
                    <Crown className="w-3.5 h-3.5 text-rose-300" />
                  ) : (
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-300" />
                  )}
                  {featured.enemyKind === 'boss' ? 'Amenaza Suprema' : 'Desafío de Caverna'}
                </span>

                <div className="bt-cinematic-pop relative my-1">
                  <div
                    className="absolute inset-0 rounded-full blur-xl opacity-45"
                    style={{ backgroundColor: elColor }}
                  />
                  {featured.speciesId && (
                    <SlugPortrait
                      speciesId={featured.speciesId}
                      mega={featured.enemyKind === 'boss'}
                      mood="attack"
                      size={108}
                      flipX
                    />
                  )}
                </div>

                <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide">
                  {featured.title}
                </h2>
                {featured.subtitle && (
                  <div className="text-xs font-bold text-teal-300">{featured.subtitle}</div>
                )}
                {featured.loreLine && (
                  <p className="text-xs sm:text-sm text-slate-200 max-w-md italic">
                    {featured.loreLine}
                  </p>
                )}
              </div>
            ) : (
              /* Crisp VS Blaster Duel Intro Stage */
              <div className="relative z-10 py-1">
                <div className="text-center mb-3">
                  <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-[0.2em] text-teal-300 inline-flex items-center gap-1.5">
                    <Swords className="w-3.5 h-3.5" />
                    {featured.enemyKind === 'boss'
                      ? 'Duelo contra Jefe'
                      : featured.enemyKind === 'mercenary'
                      ? 'Duelo de Blásteres'
                      : '¡Encuentro Subterráneo!'}
                  </span>
                </div>

                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
                  {/* Ally Fighter */}
                  <div className="bt-inset rounded-xl p-2.5 sm:p-3 flex flex-col items-center text-center border-teal-400/40">
                    {featured.allySpeciesId && (
                      <SlugPortrait
                        speciesId={featured.allySpeciesId}
                        mega={featured.allyMega}
                        mood="attack"
                        size={74}
                      />
                    )}
                    <div className="text-xs sm:text-sm font-extrabold text-white truncate max-w-full mt-1">
                      {featured.allyName || 'Tu Babosa'}
                    </div>
                    <div className="text-[10px] text-teal-300 font-bold">Tu Bláster</div>
                  </div>

                  {/* VS Crest */}
                  <div className="bt-cinematic-pop flex flex-col items-center justify-center px-1">
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-amber-300 via-orange-400 to-rose-500 text-[#090d14] font-black text-base sm:text-lg flex items-center justify-center shadow-[0_0_20px_rgba(251,191,36,0.5)]">
                      VS
                    </div>
                  </div>

                  {/* Enemy Fighter */}
                  <div
                    className="bt-inset rounded-xl p-2.5 sm:p-3 flex flex-col items-center text-center"
                    style={{ borderColor: `${elColor}66` }}
                  >
                    {featured.speciesId && (
                      <SlugPortrait
                        speciesId={featured.speciesId}
                        mega={featured.enemyKind === 'boss'}
                        mood="attack"
                        size={74}
                        flipX
                      />
                    )}
                    <div className="text-xs sm:text-sm font-extrabold text-white truncate max-w-full mt-1">
                      {featured.title}
                    </div>
                    <div className="text-[10px] font-bold" style={{ color: elColor }}>
                      {featured.slugElement || 'Rival'}{' '}
                      {featured.enemyLevel ? `· Nv.${featured.enemyLevel}` : ''}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
