import React, { useState } from 'react';
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
        const res = await gameEngine.importJsonText(reader.result);
        if (!res) gameEngine.notify('Archivo de partida no válido.');
      }
    };
    reader.readAsText(f);
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-3 md:p-6 bg-[#040a10]/88">
      <div className="w-full max-w-xl bg-[#0e1b26] border border-slate-700 rounded-2xl p-5 shadow-2xl max-h-[92dvh] overflow-y-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-white">Pausa y Opciones</h2>
            <p className="text-xs text-slate-400">
              Autoguardado activo · Semilla {gameEngine.state.worldSeed}
            </p>
          </div>
          <button
            onClick={onResume}
            className="px-4 py-2 rounded-xl bg-cyan-400 text-slate-950 font-extrabold text-xs hover:bg-cyan-300 cursor-pointer"
          >
            Reanudar
          </button>
        </div>

        {/* Options */}
        <div className="bg-[#09131c] border border-slate-700/80 rounded-xl p-3.5 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-200 font-semibold">Sonido y efectos</span>
            <button
              onClick={() => gameEngine.updateOptions({ soundEnabled: !snap.options.soundEnabled })}
              className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${
                snap.options.soundEnabled ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/50' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {snap.options.soundEnabled ? 'Activado' : 'Silenciado'}
            </button>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-200 font-semibold">Volumen</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={snap.options.volume}
              onChange={(e) => gameEngine.updateOptions({ volume: Number(e.target.value) })}
              className="w-40 accent-cyan-400"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-200 font-semibold">Iluminación de cavernas</span>
            <div className="flex gap-1">
              {(['high', 'eco'] as const).map((q) => (
                <button
                  key={q}
                  onClick={() => gameEngine.updateOptions({ lightingQuality: q })}
                  className={`px-3 py-1 rounded-lg font-bold cursor-pointer ${
                    snap.options.lightingQuality === q
                      ? 'bg-cyan-400 text-slate-950'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {q === 'high' ? 'Completa' : 'Eco (8GB)'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-200 font-semibold">Controles táctiles</span>
            <div className="flex gap-1">
              {(['auto', 'on', 'off'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => gameEngine.updateOptions({ touchControls: mode })}
                  className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${
                    snap.options.touchControls === mode
                      ? 'bg-cyan-400 text-slate-950'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {mode === 'auto' ? 'Auto' : mode === 'on' ? 'Sí' : 'No'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-200 font-semibold">Minimapa en pantalla</span>
            <button
              onClick={() => gameEngine.updateOptions({ showMinimap: !snap.options.showMinimap })}
              className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${
                snap.options.showMinimap ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/50' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {snap.options.showMinimap ? 'Visible' : 'Oculto'}
            </button>
          </div>
        </div>

        {/* Save & Migration */}
        <div className="bg-[#09131c] border border-slate-700/80 rounded-xl p-3.5 space-y-2.5">
          <div className="text-xs font-extrabold text-cyan-300 uppercase tracking-wider">
            Guardado y Compatibilidad 3.0
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              onClick={() => gameEngine.manualSave()}
              className="py-2.5 px-3 rounded-xl bg-cyan-500/20 border border-cyan-400/50 text-cyan-100 font-bold text-xs hover:bg-cyan-500/30 cursor-pointer"
            >
              Guardar Partida Ahora
            </button>
            <button
              onClick={exportJson}
              className="py-2.5 px-3 rounded-xl bg-[#132331] border border-slate-600 text-slate-100 font-bold text-xs hover:border-cyan-400 cursor-pointer"
            >
              Exportar Respaldo JSON
            </button>
            <label className="py-2.5 px-3 rounded-xl bg-[#132331] border border-slate-600 text-slate-100 font-bold text-xs hover:border-cyan-400 cursor-pointer text-center">
              Importar Partida (3.0 / 4.0)
              <input type="file" accept=".json,application/json" onChange={handleImportFile} hidden />
            </label>
            {snap.hasV3Save && !confirmV3 && (
              <button
                onClick={() => setConfirmV3(true)}
                className="py-2.5 px-3 rounded-xl bg-amber-500/20 border border-amber-400/50 text-amber-200 font-bold text-xs cursor-pointer"
              >
                Importar Partida 3.0 Local
              </button>
            )}
          </div>

          {confirmV3 && (
            <div className="p-2.5 rounded-lg bg-amber-500/15 border border-amber-400/50 text-xs text-amber-100 flex items-center justify-between gap-2">
              <span>¿Migrar tu partida local de 3.0 a 4.0? Tu partida 3.0 original no será eliminada.</span>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => {
                    setConfirmV3(false);
                    gameEngine.importDetectedV3Save();
                  }}
                  className="px-3 py-1 rounded bg-amber-400 text-slate-950 font-bold cursor-pointer"
                >
                  Sí
                </button>
                <button
                  onClick={() => setConfirmV3(false)}
                  className="px-3 py-1 rounded bg-slate-800 text-slate-200 cursor-pointer"
                >
                  No
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Standalone Downloads */}
        <div className="bg-[#09131c] border border-slate-700/80 rounded-xl p-3.5 space-y-2">
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
                className="px-3 py-2 rounded-lg bg-[#132534] border border-slate-600 text-slate-100 font-semibold hover:border-cyan-400"
              >
                Descargar Bajoterra_4_0.html
              </a>
              <a
                href="./LEEME_Bajoterra_4_0.txt"
                download="LEEME_Bajoterra_4_0.txt"
                className="px-3 py-2 rounded-lg bg-[#132534] border border-slate-600 text-slate-100 font-semibold hover:border-cyan-400"
              >
                Descargar LEEME
              </a>
              <a
                href="./Bajoterra_4_0_Proyecto.zip"
                download="Bajoterra_4_0_Proyecto.zip"
                className="px-3 py-2 rounded-lg bg-[#132534] border border-slate-600 text-slate-100 font-semibold hover:border-cyan-400"
              >
                Descargar Proyecto ZIP
              </a>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center pt-1">
          <button
            onClick={onTitle}
            className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold cursor-pointer"
          >
            Volver al Título
          </button>
          <span className="text-[11px] text-slate-400">Esc: Cerrar pausa</span>
        </div>
      </div>
    </div>
  );
};
