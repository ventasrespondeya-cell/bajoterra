import React, { useEffect, useState } from 'react';
import {
  Download,
  FolderOpen,
  HardDriveDownload,
  Keyboard,
  LogOut,
  Maximize2,
  Minimize2,
  Play,
  RotateCcw,
  Save,
  Settings,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { gameEngine } from '../game/engine';
import {
  CONTROL_ACTION_DEFS,
  createDefaultKeyBindings,
  formatControlKeyLabel,
  rebindControlKey,
  resolveEffectiveBindings,
  type ControlActionId,
} from '../game/inputManager';
import type { HudSnapshot } from '../game/types';

interface PauseModalProps {
  snap: HudSnapshot;
  onResume: () => void;
  onTitle: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({ snap, onResume, onTitle }) => {
  const [confirmV3, setConfirmV3] = useState(false);
  const [listeningAction, setListeningAction] = useState<ControlActionId | null>(null);
  const [rebindNotice, setRebindNotice] = useState<string | null>(null);
  const [fullscreenError, setFullscreenError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() =>
    typeof document !== 'undefined' ? Boolean(document.fullscreenElement) : false
  );

  const effectiveBindings = resolveEffectiveBindings(snap.options.keyBindings);
  const musicVol = typeof snap.options.musicVolume === 'number' ? snap.options.musicVolume : 1;
  const sfxVol = typeof snap.options.sfxVolume === 'number' ? snap.options.sfxVolume : 1;
  const ambientVol = typeof snap.options.ambientVolume === 'number' ? snap.options.ambientVolume : 1;
  const screenShakeOn = snap.options.screenShake !== false;
  const uiScale = snap.options.uiScale || 'normal';

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
      gameEngine.resizeCanvas();
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    if (!listeningAction) return;
    const onCaptureKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') {
        setListeningAction(null);
        setRebindNotice(null);
        return;
      }
      const res = rebindControlKey(snap.options.keyBindings, listeningAction, e.key);
      if (!res.ok) {
        setRebindNotice(res.error || 'Tecla no válida.');
        return;
      }
      gameEngine.updateOptions({ keyBindings: res.bindings });
      setListeningAction(null);
      setRebindNotice(null);
    };
    window.addEventListener('keydown', onCaptureKey, true);
    return () => window.removeEventListener('keydown', onCaptureKey, true);
  }, [listeningAction, snap.options.keyBindings]);

  const toggleFullscreen = async () => {
    setFullscreenError(null);
    try {
      if (typeof document === 'undefined') return;
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else {
        setFullscreenError('Tu navegador no admite pantalla completa aquí.');
      }
    } catch {
      setFullscreenError('El contenedor actual restringe pantalla completa.');
    }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(gameEngine.state, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bajoterra-4-0-partida.json`;
    a.click();
    URL.revokeObjectURL(url);
    gameEngine.notify('Respaldo JSON exportado.');
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === 'string') {
        await gameEngine.importJsonText(reader.result);
      } else {
        gameEngine.notify('No se pudo leer el archivo seleccionado.');
      }
    };
    reader.onerror = () => {
      gameEngine.notify('Error al leer el archivo de respaldo.');
    };
    reader.readAsText(f);
    e.target.value = '';
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pausa y opciones"
      className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-5 bg-[#03080e]/88 backdrop-blur-sm"
    >
      <div className="bt-panel bt-animate-modal w-full max-w-xl rounded-2xl p-4 sm:p-5 max-h-[92dvh] overflow-y-auto bt-scroll space-y-4">
        <div className="flex items-center justify-between gap-3 border-b border-cyan-400/20 pb-3">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-white flex items-center gap-2">
              <Settings className="w-5 h-5 text-teal-300" />
              Pausa y Opciones
            </h2>
            <p className="text-xs text-slate-300 tabular-nums mt-0.5">
              Autoguardado activo · Semilla del mundo {gameEngine.state.worldSeed}
            </p>
          </div>
          <button
            type="button"
            onClick={onResume}
            className="bt-btn-primary px-4 py-2 rounded-xl font-extrabold text-xs cursor-pointer min-h-[40px] flex items-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Reanudar
          </button>
        </div>

        {/* Options */}
        <div className="bt-inset rounded-xl p-3.5 space-y-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-100 font-semibold flex items-center gap-1.5">
              {snap.options.soundEnabled ? (
                <Volume2 className="w-3.5 h-3.5 text-teal-300" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 text-slate-400" />
              )}
              Sonido y efectos
            </span>
            <button
              type="button"
              onClick={() => gameEngine.updateOptions({ soundEnabled: !snap.options.soundEnabled })}
              className={`px-3.5 py-1.5 rounded-lg font-bold cursor-pointer min-h-[34px] ${
                snap.options.soundEnabled
                  ? 'bt-btn-primary'
                  : 'bt-btn-secondary text-slate-400'
              }`}
            >
              {snap.options.soundEnabled ? 'Activado' : 'Silenciado'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5 pt-1 border-t border-cyan-400/10">
            <label className="flex items-center justify-between gap-2">
              <span className="text-slate-200 font-semibold">Volumen</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  aria-label="Volumen maestro"
                  min={0}
                  max={1}
                  step={0.05}
                  value={snap.options.volume}
                  onChange={(e) => gameEngine.updateOptions({ volume: Number(e.target.value) })}
                  className="w-28 accent-teal-400 cursor-pointer"
                />
                <span className="w-9 text-right text-[11px] text-cyan-200 tabular-nums font-bold">
                  {Math.round(snap.options.volume * 100)}%
                </span>
              </div>
            </label>

            <label className="flex items-center justify-between gap-2">
              <span className="text-slate-200 font-semibold">Música</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  aria-label="Volumen de música"
                  min={0}
                  max={1}
                  step={0.05}
                  value={musicVol}
                  onChange={(e) => gameEngine.updateOptions({ musicVolume: Number(e.target.value) })}
                  className="w-28 accent-teal-400 cursor-pointer"
                />
                <span className="w-9 text-right text-[11px] text-cyan-200 tabular-nums font-bold">
                  {Math.round(musicVol * 100)}%
                </span>
              </div>
            </label>

            <label className="flex items-center justify-between gap-2">
              <span className="text-slate-200 font-semibold">Efectos (SFX)</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  aria-label="Volumen de efectos"
                  min={0}
                  max={1}
                  step={0.05}
                  value={sfxVol}
                  onChange={(e) => gameEngine.updateOptions({ sfxVolume: Number(e.target.value) })}
                  className="w-28 accent-teal-400 cursor-pointer"
                />
                <span className="w-9 text-right text-[11px] text-cyan-200 tabular-nums font-bold">
                  {Math.round(sfxVol * 100)}%
                </span>
              </div>
            </label>

            <label className="flex items-center justify-between gap-2">
              <span className="text-slate-200 font-semibold">Ambiente</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  aria-label="Volumen ambiental"
                  min={0}
                  max={1}
                  step={0.05}
                  value={ambientVol}
                  onChange={(e) => gameEngine.updateOptions({ ambientVolume: Number(e.target.value) })}
                  className="w-28 accent-teal-400 cursor-pointer"
                />
                <span className="w-9 text-right text-[11px] text-cyan-200 tabular-nums font-bold">
                  {Math.round(ambientVol * 100)}%
                </span>
              </div>
            </label>
          </div>

          <div className="pt-2 border-t border-cyan-400/10 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-100 font-semibold">Escala de interfaz</span>
              <div className="flex gap-1.5">
                {([
                  { id: 'compact', label: 'Compacta' },
                  { id: 'normal', label: 'Normal' },
                  { id: 'large', label: 'Grande' },
                ] as const).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => gameEngine.updateOptions({ uiScale: opt.id })}
                    className={`px-2.5 py-1.5 rounded-lg font-bold cursor-pointer min-h-[34px] whitespace-nowrap ${
                      uiScale === opt.id ? 'bt-btn-primary' : 'bt-btn-secondary'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-100 font-semibold">Iluminación de cavernas</span>
              <div className="flex gap-1.5">
                {(['high', 'eco'] as const).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => gameEngine.updateOptions({ lightingQuality: q })}
                    className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer min-h-[34px] whitespace-nowrap ${
                      snap.options.lightingQuality === q ? 'bt-btn-primary' : 'bt-btn-secondary'
                    }`}
                  >
                    {q === 'high' ? 'Completa' : 'Eco (8GB)'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-100 font-semibold">Controles táctiles</span>
              <div className="flex gap-1.5">
                {(['auto', 'on', 'off'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => gameEngine.updateOptions({ touchControls: mode })}
                    className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer min-h-[34px] ${
                      snap.options.touchControls === mode ? 'bt-btn-primary' : 'bt-btn-secondary'
                    }`}
                  >
                    {mode === 'auto' ? 'Auto' : mode === 'on' ? 'Sí' : 'No'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-100 font-semibold">Minimapa en pantalla</span>
              <button
                type="button"
                onClick={() => gameEngine.updateOptions({ showMinimap: !snap.options.showMinimap })}
                className={`px-3.5 py-1.5 rounded-lg font-bold cursor-pointer min-h-[34px] ${
                  snap.options.showMinimap ? 'bt-btn-primary' : 'bt-btn-secondary text-slate-400'
                }`}
              >
                {snap.options.showMinimap ? 'Visible' : 'Oculto'}
              </button>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-100 font-semibold">Sacudida de cámara</span>
              <button
                type="button"
                onClick={() => gameEngine.updateOptions({ screenShake: !screenShakeOn })}
                className={`px-3.5 py-1.5 rounded-lg font-bold cursor-pointer min-h-[34px] ${
                  screenShakeOn ? 'bt-btn-primary' : 'bt-btn-secondary text-slate-400'
                }`}
              >
                {screenShakeOn ? 'Activa' : 'Desactivada'}
              </button>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-100 font-semibold">Movimiento y destellos</span>
              <button
                type="button"
                onClick={() => gameEngine.updateOptions({ reducedMotion: !snap.options.reducedMotion })}
                className={`px-3.5 py-1.5 rounded-lg font-bold cursor-pointer min-h-[34px] ${
                  snap.options.reducedMotion ? 'bt-btn-amber' : 'bt-btn-secondary'
                }`}
              >
                {snap.options.reducedMotion ? 'Reducido' : 'Completo'}
              </button>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-100 font-semibold">Pantalla completa</span>
              <button
                type="button"
                onClick={() => void toggleFullscreen()}
                className="bt-btn-secondary px-3.5 py-1.5 rounded-lg font-bold cursor-pointer min-h-[34px] flex items-center gap-1.5"
              >
                {isFullscreen ? (
                  <>
                    <Minimize2 className="w-3.5 h-3.5 text-teal-300" />
                    Salir
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3.5 h-3.5 text-teal-300" />
                    Activar
                  </>
                )}
              </button>
            </div>

            {fullscreenError && (
              <p className="text-[11px] text-amber-300">{fullscreenError}</p>
            )}
          </div>
        </div>

        {/* Control Bindings Settings */}
        <div className="bt-inset rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-extrabold text-teal-300 uppercase tracking-wider flex items-center gap-1.5">
              <Keyboard className="w-3.5 h-3.5" />
              Configuración de Controles
            </div>
            <button
              type="button"
              onClick={() => {
                setListeningAction(null);
                setRebindNotice(null);
                gameEngine.updateOptions({ keyBindings: createDefaultKeyBindings() });
              }}
              className="bt-btn-secondary px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer min-h-[32px]"
            >
              <RotateCcw className="w-3 h-3" />
              Restablecer
            </button>
          </div>

          {rebindNotice && (
            <div className="px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-400/50 text-xs text-amber-200 font-semibold">
              {rebindNotice}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs max-h-52 overflow-y-auto bt-scroll pr-1">
            {CONTROL_ACTION_DEFS.map((def) => {
              const isListening = listeningAction === def.id;
              return (
                <div
                  key={def.id}
                  className="bt-card rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-white truncate">{def.label}</div>
                    <div className="text-[10px] text-slate-400 truncate">{def.description}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setRebindNotice(null);
                      setListeningAction(isListening ? null : def.id);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold shrink-0 min-h-[32px] min-w-[72px] cursor-pointer ${
                      isListening ? 'bt-btn-amber' : 'bt-btn-secondary text-cyan-200'
                    }`}
                  >
                    {isListening ? 'Pulsa tecla…' : formatControlKeyLabel(effectiveBindings[def.id])}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-400">
            Clic izquierdo apunta y dispara el bláster · Clic derecho activa acción secundaria o guardia · Esc cancela captura.
          </p>
        </div>

        {/* Save & Migration */}
        <div className="bt-inset rounded-xl p-3.5 space-y-2.5">
          <div className="text-xs font-extrabold text-teal-300 uppercase tracking-wider">
            Guardado y Compatibilidad 3.0
          </div>
          {snap.toast && (
            <div className="px-3 py-2 rounded-lg bt-card border-teal-400/40 text-xs text-teal-100">
              {snap.toast}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              onClick={() => void gameEngine.manualSave()}
              className="bt-btn-primary py-2.5 px-3 rounded-xl font-extrabold text-xs cursor-pointer min-h-[42px] flex items-center justify-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              Guardar Partida Ahora
            </button>
            <button
              onClick={exportJson}
              className="bt-btn-secondary py-2.5 px-3 rounded-xl font-bold text-xs cursor-pointer min-h-[42px] flex items-center justify-center gap-1.5"
            >
              <HardDriveDownload className="w-3.5 h-3.5 text-cyan-300" />
              Exportar Respaldo JSON
            </button>
            <label className="bt-btn-secondary py-2.5 px-3 rounded-xl font-bold text-xs cursor-pointer min-h-[42px] flex items-center justify-center gap-1.5">
              <FolderOpen className="w-3.5 h-3.5 text-amber-300" />
              <span>Importar Partida (3.0 / 4.0)</span>
              <input type="file" accept=".json,application/json" onChange={handleImportFile} hidden />
            </label>
            {snap.hasV3Save && !confirmV3 && (
              <button
                onClick={() => setConfirmV3(true)}
                className="bt-btn-amber py-2.5 px-3 rounded-xl font-extrabold text-xs cursor-pointer min-h-[42px]"
              >
                Importar Partida 3.0 Local
              </button>
            )}
          </div>

          {confirmV3 && (
            <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-400/50 text-xs text-amber-100 flex items-center justify-between gap-2">
              <span>¿Migrar tu partida local de 3.0 a 4.0? Tu partida 3.0 original no será eliminada.</span>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => {
                    setConfirmV3(false);
                    gameEngine.importDetectedV3Save();
                  }}
                  className="bt-btn-amber px-3 py-1.5 rounded-lg font-bold cursor-pointer"
                >
                  Sí
                </button>
                <button
                  onClick={() => setConfirmV3(false)}
                  className="bt-btn-secondary px-3 py-1.5 rounded-lg cursor-pointer"
                >
                  No
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Standalone Downloads */}
        <div className="bt-inset rounded-xl p-3.5 space-y-2">
          <div className="text-xs font-extrabold text-emerald-300 uppercase tracking-wider">
            Archivos Portables (Windows 11 / Offline)
          </div>
          {typeof window !== 'undefined' && window.location.protocol === 'file:' ? (
            <p className="text-xs text-slate-300 leading-relaxed">
              Estás ejecutando la versión autónoma sin conexión (<span className="text-emerald-300 font-semibold">file://</span>). Usa «Exportar Respaldo JSON» arriba para guardar copias de seguridad externas de tu partida.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2 text-xs">
              <a
                href="./Bajoterra_4_0.html"
                download="Bajoterra_4_0.html"
                className="bt-btn-secondary px-3 py-2 rounded-xl font-semibold flex items-center gap-1.5 min-h-[38px]"
              >
                <Download className="w-3.5 h-3.5 text-teal-300" />
                Descargar Bajoterra_4_0.html
              </a>
              <a
                href="./LEEME_Bajoterra_4_0.txt"
                download="LEEME_Bajoterra_4_0.txt"
                className="bt-btn-secondary px-3 py-2 rounded-xl font-semibold flex items-center gap-1.5 min-h-[38px]"
              >
                <Download className="w-3.5 h-3.5 text-cyan-300" />
                Descargar LEEME
              </a>
              <a
                href="./Bajoterra_4_0_Proyecto.zip"
                download="Bajoterra_4_0_Proyecto.zip"
                className="bt-btn-secondary px-3 py-2 rounded-xl font-semibold flex items-center gap-1.5 min-h-[38px]"
              >
                <Download className="w-3.5 h-3.5 text-amber-300" />
                Descargar Proyecto ZIP
              </a>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center pt-1">
          <button
            onClick={onTitle}
            className="bt-btn-secondary px-4 py-2 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 min-h-[40px]"
          >
            <LogOut className="w-3.5 h-3.5 text-slate-300" />
            Volver al Título
          </button>
          <span className="text-[11px] text-slate-400">Esc: Cerrar pausa</span>
        </div>
      </div>
    </div>
  );
};
