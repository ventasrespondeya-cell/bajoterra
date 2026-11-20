import React, { useEffect } from 'react';
import { Compass, MapPin, Navigation, X } from 'lucide-react';
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
    <div className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-5 bg-[#03080e]/88 backdrop-blur-sm">
      <div className="bt-panel bt-animate-modal w-full max-w-2xl rounded-2xl p-4 sm:p-5 max-h-[94dvh] overflow-y-auto bt-scroll">
        <div className="flex items-center justify-between gap-2 border-b border-cyan-400/20 pb-3 mb-3">
          <div>
            <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
              <Compass className="w-5 h-5 text-teal-300" />
              Mapa del Subsuelo (320 × 320)
            </h2>
            <p className="text-xs text-slate-300 tabular-nums mt-0.5">
              Sectores explorados: {exploredCount} / {totalChunks} chunks · Posición actual:{' '}
              {Math.round(snap.player.x)}, {Math.round(snap.player.y)}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar mapa"
            className="bt-btn-secondary w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex justify-center bt-inset border-teal-400/30 rounded-xl p-2 mb-3">
          <canvas
            ref={fullMapRef}
            width={440}
            height={440}
            className="w-full max-w-[440px] aspect-square rounded-lg pixelated"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs text-slate-200">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {(['Verdes', 'Magma', 'Heladas', 'Sombrias'] as const).map((b) => (
              <span key={b} className="flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded-sm inline-block border border-white/20"
                  style={{ backgroundColor: BIOME_INFO[b].mapColor }}
                />
                {BIOME_INFO[b].name}
              </span>
            ))}
            <span className="flex items-center gap-1.5 text-amber-200">
              <span className="w-2.5 h-2.5 rounded-full inline-block bg-amber-400" />
              Refugio / Hito
            </span>
          </div>
          {snap.shelterTier >= 3 && (
            <button
              onClick={() => gameEngine.warpToShelter()}
              className="bt-btn-primary px-3.5 py-2 rounded-xl font-extrabold text-xs cursor-pointer flex items-center gap-1.5 min-h-[38px]"
            >
              <Navigation className="w-3.5 h-3.5" />
              Volver al Refugio
            </button>
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-cyan-400/15">
          <div className="text-xs font-extrabold text-amber-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            Lugares Descubiertos ({snap.discoveredPOIs.length})
          </div>
          {snap.discoveredPOIs.length === 0 ? (
            <p className="text-xs text-slate-400">
              Explora los túneles subterráneos para revelar minas abandonadas, puestos avanzados, cámaras de cristal y ruinas antiguas.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-28 overflow-y-auto bt-scroll pr-1">
              {snap.discoveredPOIs.map((poi) => (
                <div
                  key={poi.id}
                  className="bt-inset px-2.5 py-1.5 rounded-lg text-[11px] text-slate-200 tabular-nums flex items-center justify-between gap-2"
                >
                  <span className="truncate font-semibold text-white">◆ {poi.name}</span>
                  <span className="text-teal-300 shrink-0">
                    {BIOME_INFO[poi.biome].name} ({poi.x}, {poi.y})
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
