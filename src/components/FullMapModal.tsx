import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { BIOME_INFO } from '../game/data';
import { gameEngine } from '../game/engine';
import type { HudSnapshot } from '../game/types';

interface FullMapModalProps {
  snap: HudSnapshot;
  fullMapRef: React.RefObject<HTMLCanvasElement | null>;
  onClose: () => void;
}

export const FullMapModal: React.FC<FullMapModalProps> = ({ snap, fullMapRef, onClose }) => {
  useEffect(() => {
    if (fullMapRef.current) {
      gameEngine.renderer.renderFullWorldMap(fullMapRef.current, gameEngine.state);
    }
  }, [fullMapRef, snap]);

  const exploredCount = Object.keys(gameEngine.state.exploredChunks).length;
  const totalChunks = 20 * 20;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-3 md:p-6 bg-[#040a10]/88">
      <div className="w-full max-w-2xl bg-[#0e1b26] border border-slate-700 rounded-2xl p-4 md:p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-extrabold text-white">Mapa del Subsuelo (320 × 320)</h2>
            <p className="text-xs text-slate-300 tabular-nums">
              Sectores explorados: {exploredCount} / {totalChunks} chunks · Posición actual:{' '}
              {Math.round(snap.player.x)}, {Math.round(snap.player.y)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex justify-center bg-[#060c14] border border-cyan-500/30 rounded-xl p-2 mb-3">
          <canvas
            ref={fullMapRef}
            width={440}
            height={440}
            className="w-full max-w-[440px] aspect-square rounded-lg pixelated"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
          <div className="flex flex-wrap items-center gap-3">
            {(['Verdes', 'Magma', 'Heladas', 'Sombrias'] as const).map((b) => (
              <span key={b} className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: BIOME_INFO[b].mapColor }} />
                {BIOME_INFO[b].name}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full inline-block bg-amber-400" />
              Lugar descubierto
            </span>
          </div>
          {snap.shelterTier >= 3 && (
            <button
              onClick={() => gameEngine.warpToShelter()}
              className="px-3.5 py-1.5 rounded-lg bg-cyan-400 text-slate-950 font-extrabold text-xs hover:bg-cyan-300 cursor-pointer"
            >
              Volver al Refugio
            </button>
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="text-xs font-extrabold text-amber-300 uppercase tracking-wider mb-1.5">
            Lugares Descubiertos ({snap.discoveredPOIs.length})
          </div>
          {snap.discoveredPOIs.length === 0 ? (
            <p className="text-[11px] text-slate-400">
              Explora los túneles subterráneos para revelar minas, puestos, cámaras secretas y ruinas.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {snap.discoveredPOIs.map((poi) => (
                <span
                  key={poi.id}
                  className="px-2 py-1 rounded-md bg-[#09131c] border border-slate-700 text-[11px] text-slate-200 tabular-nums"
                >
                  ◆ {poi.name} · {BIOME_INFO[poi.biome].name} ({poi.x}, {poi.y})
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
