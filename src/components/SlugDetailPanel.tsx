import React, { useState } from 'react';
import { Heart, Sparkles, Star, X } from 'lucide-react';
import { ELEMENT_CHART, getSpecies } from '../game/data';
import { gameEngine } from '../game/engine';
import {
  MAX_MOVE_MASTERY,
  MAX_SLUG_LEVEL,
  MEGAMORPH_MIN_BOND,
  MEGAMORPH_MIN_LEVEL,
  checkMegamorphEligibility,
  getBondTierInfo,
  getEffectiveMoveEnergyCost,
  getMoveMasteryInfo,
  getTraitInfo,
  getXpForNextLevel,
} from '../game/progression';
import { getSlugDesignSheet } from '../game/slugArtDirection';
import type { GameState, HudSnapshot, SlugInstance } from '../game/types';
import { SlugPortrait, type SlugPortraitMood } from './SlugPortrait';

const DETAIL_MOODS: Array<{ id: SlugPortraitMood; label: string }> = [
  { id: 'happy', label: 'Feliz' },
  { id: 'idle', label: 'Tranquila' },
  { id: 'walk', label: 'Pasear' },
  { id: 'play', label: 'Jugar' },
  { id: 'eat', label: 'Comer' },
  { id: 'react', label: 'Reacción' },
  { id: 'charge', label: 'Cargar' },
  { id: 'attack', label: 'Ataque' },
  { id: 'hit', label: 'Impacto' },
  { id: 'sleep', label: 'Descanso' },
  { id: 'victory', label: 'Victoria' },
];

interface SlugDetailPanelProps {
  slug: SlugInstance;
  snap: HudSnapshot;
  locationLabel: string;
  onClose: () => void;
}

export const SlugDetailPanel: React.FC<SlugDetailPanelProps> = ({
  slug,
  snap,
  locationLabel,
  onClose,
}) => {
  const [previewMood, setPreviewMood] = useState<SlugPortraitMood>(slug.hp <= 0 ? 'ko' : 'happy');
  const [showSilhouette, setShowSilhouette] = useState(false);
  const sp = getSpecies(slug.id);
  const sheet = getSlugDesignSheet(slug.id);
  const bondTier = getBondTierInfo(slug.bond);
  const traitInfo = getTraitInfo(slug.bonusTrait);
  const nextXp = getXpForNextLevel(slug.level);
  const xpPct = slug.level >= MAX_SLUG_LEVEL ? 100 : Math.min(100, Math.round((slug.xp / nextXp) * 100));
  const megaCheck = checkMegamorphEligibility(
    { inventory: snap.inventory, story: snap.storyState } as unknown as GameState,
    slug
  );
  const effectiveMood: SlugPortraitMood = slug.hp <= 0 && previewMood === 'happy' ? 'ko' : previewMood;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-5 bg-[#03080e]/85 backdrop-blur-sm">
      <div className="bt-panel bt-animate-modal w-full max-w-2xl rounded-2xl p-4 sm:p-5 max-h-[92dvh] overflow-y-auto bt-scroll space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-cyan-400/20 pb-3.5">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-24 h-24 rounded-2xl bt-inset border-teal-400/35 flex items-center justify-center shrink-0">
              <SlugPortrait
                speciesId={slug.id}
                mega={slug.mega}
                mood={effectiveMood}
                size={82}
                silhouette={showSilhouette}
              />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg sm:text-xl font-extrabold text-white truncate">{slug.name}</h3>
                {slug.mega && (
                  <span className="text-xs font-extrabold text-amber-300 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    Megamorph
                  </span>
                )}
                {slug.isBred && (
                  <span className="text-xs font-bold text-emerald-300">
                    · Cría del Refugio
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-300 mt-1">
                Especie: <span className="text-white font-semibold">{sp.name}</span> ·{' '}
                <span className="font-bold" style={{ color: ELEMENT_CHART[slug.type]?.color }}>
                  {slug.type}
                </span>{' '}
                · {slug.rarity} · <span className="text-teal-300 font-semibold">{locationLabel}</span>
              </div>
              <div className="text-[11px] text-slate-300/90 italic mt-1">{sheet.personalityQuote}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar ficha"
            className="bt-btn-secondary w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Expression Selector & Anatomy Profile */}
        <div className="bt-inset rounded-xl p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-extrabold text-cyan-300 uppercase tracking-wider">
              Expresión y Personalidad · {sheet.storyChapter}
            </span>
            <button
              type="button"
              onClick={() => setShowSilhouette((v) => !v)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold cursor-pointer whitespace-nowrap ${
                showSilhouette ? 'bt-btn-amber' : 'bt-btn-secondary'
              }`}
            >
              {showSilhouette ? 'Vista Color' : 'Silueta'}
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {DETAIL_MOODS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setPreviewMood(m.id)}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer whitespace-nowrap transition-colors ${
                  effectiveMood === m.id ? 'bt-btn-primary' : 'bt-btn-secondary'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="text-[11px] text-slate-300 leading-relaxed">
            <span className="text-slate-100 font-semibold">{sheet.temperament}</span> · Rasgos:{' '}
            {sheet.silhouetteHooks.join(' · ')} · Velocimorph:{' '}
            <span className="text-amber-200 font-semibold">{sheet.vfxSignature.transformLabel}</span>
          </div>
        </div>

        {/* Level, XP & Stats + Bond */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bt-inset rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-teal-300">Nivel {slug.level}/{MAX_SLUG_LEVEL}</span>
              <span className="text-slate-300 tabular-nums">
                {slug.level >= MAX_SLUG_LEVEL ? 'Nivel máximo' : `EXP ${slug.xp}/${nextXp}`}
              </span>
            </div>
            <div className="h-2 bg-[#050b12] border border-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-teal-300 transition-all"
                style={{ width: `${xpPct}%` }}
              />
            </div>
            <div className="grid grid-cols-5 gap-1.5 pt-1 text-center text-[11px] tabular-nums">
              <div className="bt-card rounded-lg py-1.5">
                <div className="text-slate-400 text-[10px]">PS</div>
                <div className="font-extrabold text-emerald-300">{slug.hp}/{slug.maxHp}</div>
              </div>
              <div className="bt-card rounded-lg py-1.5">
                <div className="text-slate-400 text-[10px]">EN</div>
                <div className="font-extrabold text-cyan-300">{slug.energy}/{slug.maxEnergy}</div>
              </div>
              <div className="bt-card rounded-lg py-1.5">
                <div className="text-slate-400 text-[10px]">ATQ</div>
                <div className="font-extrabold text-rose-300">{slug.atk}</div>
              </div>
              <div className="bt-card rounded-lg py-1.5">
                <div className="text-slate-400 text-[10px]">DEF</div>
                <div className="font-extrabold text-sky-300">{slug.def}</div>
              </div>
              <div className="bt-card rounded-lg py-1.5">
                <div className="text-slate-400 text-[10px]">VEL</div>
                <div className="font-extrabold text-amber-300">{slug.spd}</div>
              </div>
            </div>
          </div>

          <div className="bt-inset rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="flex items-center gap-1.5" style={{ color: bondTier.color }}>
                <Heart className="w-3.5 h-3.5 fill-current" />
                Vínculo · {bondTier.label}
              </span>
              <span className="text-amber-300 tabular-nums">{slug.bond}/100</span>
            </div>
            <div className="h-2 bg-[#050b12] border border-white/10 rounded-full overflow-hidden">
              <div
                className="h-full transition-all"
                style={{ width: `${bondTier.progressPct}%`, backgroundColor: bondTier.color }}
              />
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">{bondTier.summary}</p>
            {bondTier.nextMin !== null && (
              <div className="text-[10px] text-slate-400">
                Siguiente nivel de vínculo a los {bondTier.nextMin} puntos.
              </div>
            )}
          </div>
        </div>

        {/* Trait */}
        <div className="bt-inset rounded-xl p-3.5">
          <div className="text-xs font-extrabold text-emerald-300 uppercase tracking-wider mb-1">
            Rasgo Individual
          </div>
          {traitInfo ? (
            <div className="text-xs text-slate-200">
              <span className="font-bold text-white">{traitInfo.label}:</span> {traitInfo.description}
            </div>
          ) : (
            <div className="text-xs text-slate-400">
              Sin rasgo desarrollado todavía. Alcanza Nivel 4 o 50 de Amistad para despertar un rasgo único.
            </div>
          )}
        </div>

        {/* Special Moves & Mastery */}
        <div className="bt-inset rounded-xl p-3.5 space-y-2.5">
          <div className="text-xs font-extrabold text-sky-300 uppercase tracking-wider">
            Técnicas Especiales y Maestría
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {sp.specialMoves.map((mv, idx) => {
              const pts = slug.moveMastery?.[idx as 0 | 1] ?? 0;
              const mInfo = getMoveMasteryInfo(pts);
              const cost = getEffectiveMoveEnergyCost(mv.energyCost, pts);
              return (
                <div key={mv.id} className="bt-card rounded-xl p-3 text-xs space-y-1.5">
                  <div className="flex items-center justify-between font-bold text-white">
                    <span>✦ {mv.name}</span>
                    <span className="text-teal-300 tabular-nums">{cost} EN</span>
                  </div>
                  <div className="text-[11px] text-slate-300">{mv.description}</div>
                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <span className="font-bold text-amber-300">{mInfo.label}</span>
                    <span className="text-slate-400 tabular-nums">{pts}/{MAX_MOVE_MASTERY}</span>
                  </div>
                  <div className="h-1.5 bg-[#050b12] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-sky-400 to-teal-300 transition-all"
                      style={{ width: `${Math.round((pts / MAX_MOVE_MASTERY) * 100)}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-sky-200">{mInfo.bonusText}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Megamorph Evolution */}
        <div className="bt-inset border-amber-400/40 rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="text-xs font-extrabold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              Evolución Megamorph ({sp.evoName})
            </div>
            {slug.mega && (
              <span className="text-xs font-bold text-emerald-300 flex items-center gap-1">
                <Star className="w-3.5 h-3.5 fill-current" /> Completada
              </span>
            )}
          </div>

          {slug.mega ? (
            <p className="text-xs text-slate-300">
              {slug.name} ya alcanzó su transformación Megamorph manteniendo toda su experiencia, vínculo y maestría.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div
                  className={`px-3 py-2 rounded-lg border ${
                    megaCheck.hasNarrativeUnlock
                      ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-200'
                      : 'bt-card text-slate-300'
                  }`}
                >
                  {megaCheck.hasNarrativeUnlock ? '✓' : '○'}{' '}
                  {megaCheck.hasNarrativeUnlock
                    ? 'Historia: Acelerador 200 MPH listo'
                    : megaCheck.narrativeReason}
                </div>
                <div
                  className={`px-3 py-2 rounded-lg border ${
                    megaCheck.hasLevel
                      ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-200'
                      : 'bt-card text-slate-300'
                  }`}
                >
                  {megaCheck.hasLevel ? '✓' : '○'} Nivel {MEGAMORPH_MIN_LEVEL}+ (Nv.{slug.level})
                </div>
                <div
                  className={`px-3 py-2 rounded-lg border ${
                    megaCheck.hasBond
                      ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-200'
                      : 'bt-card text-slate-300'
                  }`}
                >
                  {megaCheck.hasBond ? '✓' : '○'} Amistad {MEGAMORPH_MIN_BOND}+ ({slug.bond})
                </div>
                <div
                  className={`px-3 py-2 rounded-lg border ${
                    megaCheck.hasResource
                      ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-200'
                      : 'bt-card text-slate-300'
                  }`}
                >
                  {megaCheck.hasResource ? '✓' : '○'} 1 Elixir ({snap.inventory.elixirs}), Reliquia ({snap.inventory.relics}) o Piedra Evo. ({snap.inventory.evoStone})
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {snap.inventory.elixirs > 0 && (
                  <button
                    onClick={() => gameEngine.useElixirOnSlug(slug.uid)}
                    className="bt-btn-secondary border-purple-400/60 px-3.5 py-2 rounded-xl text-purple-100 font-bold text-xs cursor-pointer min-h-[40px]"
                  >
                    Aplicar Elixir (+25 Amistad, +35 EXP) · {snap.inventory.elixirs}
                  </button>
                )}
                <button
                  disabled={!megaCheck.eligible}
                  onClick={() => gameEngine.evolveSlugToMegamorph(slug.uid)}
                  className="bt-btn-amber px-4 py-2 rounded-xl font-extrabold text-xs disabled:opacity-40 cursor-pointer min-h-[40px]"
                >
                  Evolucionar a Megamorph
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
