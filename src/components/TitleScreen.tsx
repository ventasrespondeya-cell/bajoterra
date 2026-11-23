import React, { useEffect, useState } from 'react';
import {
  Compass,
  FolderOpen,
  HardDriveDownload,
  Info,
  Map,
  Play,
  RotateCcw,
  Save,
  Settings,
  Sparkles,
  X,
} from 'lucide-react';
import { sound } from '../game/audio';
import {
  checkStorageCapabilities,
  loadGameV4Detailed,
  type StorageCapabilities,
} from '../game/save';
import { STORY_CHAPTERS_BY_ID } from '../game/storyData';
import type { GameState, HudSnapshot } from '../game/types';
import { GameSettingsContent } from './GameSettingsContent';
import { SlugPortrait } from './SlugPortrait';

interface TitleScreenProps {
  snap: HudSnapshot;
  onNewGame: () => void;
  onContinue: () => void;
  onContinueToMap?: () => void;
  onContinueToCampaign?: () => void;
  onImportV3Detected: () => void;
  onImportJsonFile: (text: string) => void;
}

type TitleModalKind = null | 'settings' | 'saves' | 'credits';

export const TitleScreen: React.FC<TitleScreenProps> = ({
  snap,
  onNewGame,
  onContinue,
  onContinueToMap,
  onContinueToCampaign,
  onImportV3Detected,
  onImportJsonFile,
}) => {
  const [confirmAction, setConfirmAction] = useState<null | 'new' | 'v3'>(null);
  const [activeModal, setActiveModal] = useState<TitleModalKind>(null);
  const [listeningBind, setListeningBind] = useState(false);
  const [savePreview, setSavePreview] = useState<GameState | null>(null);
  const [savePreviewLoading, setSavePreviewLoading] = useState(false);
  const [storageCaps, setStorageCaps] = useState<StorageCapabilities | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!activeModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !listeningBind) {
        e.preventDefault();
        setActiveModal(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeModal, listeningBind]);

  useEffect(() => {
    if (activeModal !== 'saves') return;
    let alive = true;
    setSavePreviewLoading(true);
    setSaveNotice(null);
    void Promise.all([
      snap.hasV4Save ? loadGameV4Detailed({ syncStores: false }) : Promise.resolve(null),
      checkStorageCapabilities(),
    ]).then(([loadRes, caps]) => {
      if (!alive) return;
      setSavePreview(loadRes?.state ?? null);
      setStorageCaps(caps);
      setSavePreviewLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [activeModal, snap.hasV4Save]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onImportJsonFile(reader.result);
        setActiveModal(null);
      }
    };
    reader.onerror = () => {
      onImportJsonFile('');
    };
    reader.readAsText(f);
    e.target.value = '';
  };

  const exportSavedJson = () => {
    if (!savePreview) return;
    const blob = new Blob([JSON.stringify(savePreview, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bajoterra-4-0-respaldo.json`;
    a.click();
    URL.revokeObjectURL(url);
    setSaveNotice('Respaldo JSON exportado correctamente.');
  };

  const savedChapterTitle = savePreview?.story?.currentChapterId
    ? STORY_CHAPTERS_BY_ID[savePreview.story.currentChapterId]?.title || 'Campaña Bajoterra'
    : 'Campaña Bajoterra';

  return (
    <div
      onPointerDown={() => sound.unlockAudio()}
      className="fixed inset-0 z-20 flex flex-col justify-between p-4 sm:p-8 md:p-12 overflow-y-auto bt-scroll"
      style={{
        background:
          'radial-gradient(circle at 22% 38%, rgba(20, 184, 166, 0.16) 0%, rgba(6, 13, 20, 0.62) 48%, rgba(4, 9, 14, 0.94) 100%)',
      }}
    >
      {/* Top Expedition Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] sm:text-xs text-slate-300/90 tracking-wide border-b border-cyan-400/15 pb-3">
        <div className="flex items-center gap-2 font-bold text-teal-300 uppercase tracking-widest">
          <Compass className="w-3.5 h-3.5 text-amber-300" />
          <span>Expedición Subterránea 2D</span>
        </div>
        <div className="text-slate-300/80 tabular-nums">
          8 Capítulos · 6 Biomas · 20 Especies · Mecas y Torneos · Hogar Viviente
        </div>
      </div>

      {/* Main Hero Lockup */}
      <div className="max-w-3xl my-auto py-4">
        <div className="bt-panel rounded-2xl p-5 sm:p-7 md:p-8 relative overflow-hidden">
          <div className="pointer-events-none absolute top-0 right-0 w-44 h-44 bg-gradient-to-bl from-teal-400/10 to-transparent" />
          <div className="pointer-events-none absolute bottom-0 left-0 w-44 h-44 bg-gradient-to-tr from-amber-400/10 to-transparent" />

          {/* Bespoke SVG Title Lockup with Ancient-Tech Crystal Prism */}
          <svg
            viewBox="0 0 580 128"
            className="w-full max-w-[520px] h-auto mb-4 drop-shadow-[0_10px_24px_rgba(0,0,0,0.85)]"
            role="img"
            aria-label="Bajoterra 4.0 Mundo Vivo"
          >
            <defs>
              <linearGradient id="btTitleGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#99f6e4" />
                <stop offset="48%" stopColor="#e0f2fe" />
                <stop offset="100%" stopColor="#fbbf24" />
              </linearGradient>
              <linearGradient id="btCrystal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5eead4" />
                <stop offset="55%" stopColor="#0d9488" />
                <stop offset="100%" stopColor="#134e4a" />
              </linearGradient>
            </defs>
            <polygon
              points="32,12 52,24 58,52 38,84 18,68 14,32"
              fill="url(#btCrystal)"
              stroke="#99f6e4"
              strokeWidth="2.2"
            />
            <polygon points="33,19 46,28 49,50 37,74 25,60 22,34" fill="#ccfbf1" opacity="0.32" />
            <polygon points="34,26 42,35 37,62 29,46" fill="#ffffff" opacity="0.45" />
            <circle cx="36" cy="46" r="4.5" fill="#fde047" opacity="0.9" />

            <text
              x="76"
              y="60"
              fill="url(#btTitleGrad)"
              fontSize="48"
              fontWeight="900"
              letterSpacing="3"
              fontFamily="Bahnschrift, Trebuchet MS, Segoe UI, sans-serif"
            >
              BAJOTERRA 4.0
            </text>
            <text
              x="79"
              y="93"
              fill="#5eead4"
              fontSize="19"
              fontWeight="700"
              letterSpacing="7"
              fontFamily="Bahnschrift, Trebuchet MS, Segoe UI, sans-serif"
            >
              MUNDO VIVO
            </text>
            <line x1="78" y1="106" x2="480" y2="106" stroke="#2dd4bf" strokeOpacity="0.45" strokeWidth="1.5" />
            <circle cx="484" cy="106" r="2.5" fill="#fbbf24" />
          </svg>

          <p className="text-sm sm:text-base text-slate-200/95 max-w-xl leading-relaxed mb-5">
            Vive la campaña lineal por las 99 Cavernas junto a la Banda de Shane: pilota tu Meca, entrena y bautiza a tus 20 especies de babosas, vence en Torneos de Blásteres y despierta la evolución{' '}
            <span className="text-amber-300 font-semibold">Megamorph</span>.
          </p>

          {/* Expressive Companion Preview Strip */}
          <div className="bt-inset rounded-xl px-3.5 py-2.5 mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center -space-x-1">
                <SlugPortrait speciesId="infurnus" size={38} mood="happy" className="bt-animate-slug" />
                <SlugPortrait speciesId="aquabeak" size={38} mood="idle" />
                <SlugPortrait speciesId="tazerling" size={38} mood="attack" />
                <SlugPortrait speciesId="aetherion" size={38} mega mood="idle" />
              </div>
              <div className="text-xs leading-tight ml-1">
                <div className="font-bold text-white">20 Especies · Crianza · Personalidad y Maestría</div>
                <div className="text-[11px] text-slate-400">
                  Ponles nombre único, críalas en tu Refugio Viviente y supera desafíos con Pulso Rápido.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300">
              <Sparkles className="w-3.5 h-3.5" />
              <span>RPG de Aventura</span>
            </div>
          </div>

          {snap.toast && (
            <div className="bg-[#081622] border border-cyan-400/50 rounded-xl px-4 py-2.5 text-xs text-cyan-100 max-w-lg mb-4">
              {snap.toast}
            </div>
          )}

          {confirmAction ? (
            <div className="bg-[#121922] border border-amber-400/60 rounded-xl p-4 max-w-lg mb-2">
              <p className="text-sm text-amber-100 mb-3 leading-relaxed">
                {confirmAction === 'new'
                  ? 'Ya existe una partida guardada de Bajoterra 4.0. ¿Deseas iniciar una nueva expedición desde cero?'
                  : 'Se detectó una partida de Bajoterra 3.0. Se importará a 4.0 sin borrar ni sobrescribir tu partida 3.0 original.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const act = confirmAction;
                    setConfirmAction(null);
                    if (act === 'new') onNewGame();
                    else onImportV3Detected();
                  }}
                  className="bt-btn-primary px-4 py-2.5 text-xs font-extrabold rounded-xl cursor-pointer min-h-[44px]"
                >
                  Confirmar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmAction(null)}
                  className="bt-btn-secondary px-4 py-2.5 text-xs font-bold rounded-xl cursor-pointer min-h-[44px]"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Primary Action Row */}
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                {snap.hasV4Save ? (
                  <>
                    <button
                      type="button"
                      onClick={onContinue}
                      className="bt-btn-primary px-6 py-3 rounded-xl font-extrabold text-sm tracking-wide cursor-pointer min-h-[48px] flex items-center gap-2 whitespace-nowrap"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      Continuar Expedición
                    </button>
                    {onContinueToCampaign && (
                      <button
                        type="button"
                        onClick={onContinueToCampaign}
                        className="bt-btn-secondary px-4 py-3 rounded-xl font-bold text-sm cursor-pointer min-h-[48px] flex items-center gap-2 whitespace-nowrap"
                      >
                        <Compass className="w-4 h-4 text-teal-300" />
                        Campaña
                      </button>
                    )}
                    {onContinueToMap && (
                      <button
                        type="button"
                        onClick={onContinueToMap}
                        className="bt-btn-secondary px-4 py-3 rounded-xl font-bold text-sm cursor-pointer min-h-[48px] flex items-center gap-2 whitespace-nowrap"
                      >
                        <Map className="w-4 h-4 text-cyan-300" />
                        Mapa del Mundo
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setConfirmAction('new')}
                      className="bt-btn-secondary px-5 py-3 rounded-xl font-bold text-sm cursor-pointer min-h-[48px] flex items-center gap-2 whitespace-nowrap"
                    >
                      <RotateCcw className="w-4 h-4 text-cyan-300" />
                      Nueva Partida
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={onNewGame}
                    className="bt-btn-primary px-6 py-3 rounded-xl font-extrabold text-sm tracking-wide cursor-pointer min-h-[48px] flex items-center gap-2 whitespace-nowrap"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Iniciar Expedición
                  </button>
                )}

                {snap.hasV3Save && (
                  <button
                    type="button"
                    onClick={() => setConfirmAction('v3')}
                    className="bt-btn-amber px-4 py-3 rounded-xl font-extrabold text-sm cursor-pointer min-h-[48px] whitespace-nowrap"
                  >
                    Importar Bajoterra 3.0
                  </button>
                )}
              </div>

              {/* Secondary Menu Row (Settings, Save Management, Credits) */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setActiveModal('settings')}
                  className="bt-btn-secondary px-3.5 py-2 rounded-xl font-bold text-xs cursor-pointer min-h-[42px] flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Settings className="w-3.5 h-3.5 text-teal-300" />
                  Configuración
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModal('saves')}
                  className="bt-btn-secondary px-3.5 py-2 rounded-xl font-bold text-xs cursor-pointer min-h-[42px] flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Save className="w-3.5 h-3.5 text-cyan-300" />
                  Gestión de Guardado
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModal('credits')}
                  className="bt-btn-secondary px-3.5 py-2 rounded-xl font-bold text-xs cursor-pointer min-h-[42px] flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Info className="w-3.5 h-3.5 text-amber-300" />
                  Créditos
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Control Legend */}
      <div className="text-[11px] sm:text-xs text-slate-300/85 border-t border-cyan-400/15 pt-3 flex flex-wrap gap-x-4 gap-y-1">
        <span><strong className="text-cyan-200">WASD / Flechas</strong> Mover</span>
        <span><strong className="text-cyan-200">Ratón + Clic</strong> Apuntar y Disparar</span>
        <span><strong className="text-cyan-200">F / Clic</strong> Interactuar</span>
        <span><strong className="text-cyan-200">Espacio</strong> Esquivar</span>
        <span><strong className="text-cyan-200">Z / X</strong> Habilidades</span>
        <span><strong className="text-cyan-200">Q / 1-4</strong> Cambiar babosa</span>
        <span><strong className="text-cyan-200">R</strong> Pulso</span>
        <span><strong className="text-cyan-200">V</strong> Meca</span>
        <span><strong className="text-cyan-200">Tab / I</strong> Campaña</span>
        <span><strong className="text-cyan-200">M</strong> Mapa</span>
        <span><strong className="text-cyan-200">Esc</strong> Pausa</span>
      </div>

      {/* Title Modal Overlays */}
      {activeModal === 'settings' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Configuración del juego"
          onClick={() => {
            if (!listeningBind) setActiveModal(null);
          }}
          className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-5 bg-[#03080e]/88 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bt-panel bt-animate-modal w-full max-w-xl rounded-2xl p-4 sm:p-5 max-h-[90dvh] overflow-y-auto bt-scroll space-y-4"
          >
            <div className="flex items-center justify-between gap-3 border-b border-cyan-400/20 pb-3">
              <div>
                <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                  <Settings className="w-5 h-5 text-teal-300" />
                  Configuración
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  Audio por canales, accesibilidad, pantalla y controles de teclado.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                aria-label="Cerrar configuración"
                className="bt-btn-secondary p-2 rounded-xl cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <GameSettingsContent snap={snap} onListeningChange={setListeningBind} />
          </div>
        </div>
      )}

      {activeModal === 'saves' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Gestión de guardado"
          onClick={() => setActiveModal(null)}
          className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-5 bg-[#03080e]/88 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bt-panel bt-animate-modal w-full max-w-lg rounded-2xl p-4 sm:p-5 max-h-[90dvh] overflow-y-auto bt-scroll space-y-4"
          >
            <div className="flex items-center justify-between gap-3 border-b border-cyan-400/20 pb-3">
              <div>
                <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                  <Save className="w-5 h-5 text-cyan-300" />
                  Gestión de Guardado
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  Inspección local, respaldo JSON y migración desde Bajoterra 3.0.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                aria-label="Cerrar gestión de guardado"
                className="bt-btn-secondary p-2 rounded-xl cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {saveNotice && (
              <div className="px-3 py-2 rounded-xl bg-teal-500/15 border border-teal-400/50 text-xs text-teal-100">
                {saveNotice}
              </div>
            )}

            <div className="bt-inset rounded-xl p-3.5 space-y-2 text-xs">
              <div className="font-extrabold text-teal-300 uppercase tracking-wider">
                Estado del almacenamiento
              </div>
              {savePreviewLoading ? (
                <p className="text-slate-300">Verificando partida guardada…</p>
              ) : savePreview ? (
                <div className="space-y-1.5 text-slate-200 tabular-nums">
                  <div className="font-bold text-white">{savedChapterTitle}</div>
                  <div>
                    Explorador Nv.{savePreview.player.level} · Refugio Tier {savePreview.shelterTier} · {Object.keys(savePreview.capturedSpecies).length}/20 especies · {savePreview.cavernTokens ?? 0} Fichas
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Biomas descubiertos: {savePreview.discoveries.length}/6 · Jefes derrotados: {savePreview.defeatedBosses.length}/6
                  </div>
                </div>
              ) : (
                <p className="text-slate-300">
                  No se detectó ninguna partida 4.0 guardada aún en este navegador.
                </p>
              )}
              {storageCaps && (
                <div className="text-[11px] text-slate-400 pt-1 border-t border-cyan-400/10">
                  Motores disponibles: {storageCaps.indexedDBAvailable ? 'IndexedDB activo' : 'IndexedDB no disponible'} · {storageCaps.localStorageAvailable ? 'localStorage activo' : 'localStorage restringido'}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <label className="bt-btn-secondary py-2.5 px-3 rounded-xl font-bold cursor-pointer min-h-[44px] flex items-center justify-center gap-1.5">
                <FolderOpen className="w-4 h-4 text-teal-300" />
                <span>Cargar respaldo JSON</span>
                <input type="file" accept=".json,application/json" onChange={handleFile} hidden />
              </label>

              <button
                type="button"
                disabled={!savePreview}
                onClick={exportSavedJson}
                className="bt-btn-secondary py-2.5 px-3 rounded-xl font-bold cursor-pointer disabled:opacity-45 min-h-[44px] flex items-center justify-center gap-1.5"
              >
                <HardDriveDownload className="w-4 h-4 text-cyan-300" />
                Exportar respaldo JSON
              </button>

              {snap.hasV3Save && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveModal(null);
                    setConfirmAction('v3');
                  }}
                  className="bt-btn-amber py-2.5 px-3 rounded-xl font-extrabold cursor-pointer min-h-[44px] sm:col-span-2"
                >
                  Migrar Partida Local Bajoterra 3.0
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {activeModal === 'credits' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Créditos del juego"
          onClick={() => setActiveModal(null)}
          className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-5 bg-[#03080e]/88 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bt-panel bt-animate-modal w-full max-w-lg rounded-2xl p-4 sm:p-5 max-h-[90dvh] overflow-y-auto bt-scroll space-y-4 text-xs"
          >
            <div className="flex items-center justify-between gap-3 border-b border-cyan-400/20 pb-3">
              <div>
                <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                  <Info className="w-5 h-5 text-amber-300" />
                  Bajoterra 4.0 — Mundo Vivo
                </h2>
                <p className="text-slate-300 mt-0.5">
                  Edición completa de campaña, exploración abierta y crianza de babosas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                aria-label="Cerrar créditos"
                className="bt-btn-secondary p-2 rounded-xl cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bt-inset rounded-xl p-3.5 space-y-2.5 leading-relaxed text-slate-200">
              <div>
                <div className="font-bold text-teal-300">Mundo y Diseño Interactivo</div>
                <p className="text-slate-300">
                  6 biomas subterráneos interconectados, Refugio Viviente personalizable con hábitats elementales, 20 especies de babosas con estados animados, evolución Megamorph y campaña lineal de 8 capítulos.
                </p>
              </div>
              <div>
                <div className="font-bold text-cyan-300">Arte Procedural y Síntesis Sonora</div>
                <p className="text-slate-300">
                  Renderizado 2D en Canvas con tilesets y retratos procedurales originales y banda sonora dinámica generada en tiempo real mediante WebAudio API.
                </p>
              </div>
              <div>
                <div className="font-bold text-amber-300">Tecnología Base</div>
                <p className="text-slate-300">
                  React 19 · TypeScript · Vite · Tailwind CSS · Lucide Icons · Persistencia híbrida IndexedDB + LocalStorage.
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="bt-btn-primary px-4 py-2 rounded-xl font-extrabold cursor-pointer min-h-[40px]"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
