import React, { useState } from 'react';
import { Download, FolderOpen, HardDriveDownload, LogOut, Play, Save, Settings } from 'lucide-react';
import { gameEngine } from '../game/engine';
import type { HudSnapshot } from '../game/types';

interface PauseModalProps {
  snap: HudSnapshot;
  onResume: () => void;
  onTitle: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({ snap, onResume, onTitle }) => {
  const [confirmV3, setConfirmV3] = useState(false);

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
    <div className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-5 bg-[#03080e]/88 backdrop-blur-sm">
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
            <span className="text-slate-100 font-semibold">Sonido y efectos</span>
            <button
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

          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-100 font-semibold">Volumen</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={snap.options.volume}
              onChange={(e) => gameEngine.updateOptions({ volume: Number(e.target.value) })}
              className="w-40 accent-teal-400 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-100 font-semibold">Iluminación de cavernas</span>
            <div className="flex gap-1.5">
              {(['high', 'eco'] as const).map((q) => (
                <button
                  key={q}
                  onClick={() => gameEngine.updateOptions({ lightingQuality: q })}
                  className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer min-h-[34px] ${
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
              onClick={() => gameEngine.updateOptions({ showMinimap: !snap.options.showMinimap })}
              className={`px-3.5 py-1.5 rounded-lg font-bold cursor-pointer min-h-[34px] ${
                snap.options.showMinimap ? 'bt-btn-primary' : 'bt-btn-secondary text-slate-400'
              }`}
            >
              {snap.options.showMinimap ? 'Visible' : 'Oculto'}
            </button>
          </div>
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
