import React, { useState } from 'react';
import type { HudSnapshot } from '../game/types';

interface TitleScreenProps {
  snap: HudSnapshot;
  onNewGame: () => void;
  onContinue: () => void;
  onImportV3Detected: () => void;
  onImportJsonFile: (text: string) => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  snap,
  onNewGame,
  onContinue,
  onImportV3Detected,
  onImportJsonFile,
}) => {
  const [confirmAction, setConfirmAction] = useState<null | 'new' | 'v3'>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onImportJsonFile(reader.result);
      }
    };
    reader.readAsText(f);
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between p-6 md:p-12 bg-gradient-to-b from-[#060d14]/75 via-[#060d14]/45 to-[#060d14]/90">
      <div className="flex items-center justify-between text-xs text-slate-300/80">
        <span>Exploración Subterránea 2D</span>
        <span>320 × 320 Sectores · 4 Biomas · 15 Especies</span>
      </div>

      <div className="max-w-2xl my-auto">
        {/* Bespoke SVG Title Lockup */}
        <svg
          viewBox="0 0 540 124"
          className="w-full max-w-[500px] h-auto mb-5 drop-shadow-[0_8px_24px_rgba(0,0,0,0.85)]"
          role="img"
          aria-label="Bajoterra 4.0 Mundo Vivo"
        >
          <defs>
            <linearGradient id="btTitleGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#67e8f9" />
              <stop offset="50%" stopColor="#e0f2fe" />
              <stop offset="100%" stopColor="#fbbf24" />
            </linearGradient>
          </defs>
          <polygon
            points="24,22 44,12 58,34 40,56 18,46"
            fill="#14b8a6"
            stroke="#99f6e4"
            strokeWidth="2.5"
          />
          <polygon points="32,26 43,19 49,33 38,47 26,40" fill="#5eead4" opacity="0.65" />
          <text
            x="76"
            y="58"
            fill="url(#btTitleGrad)"
            fontSize="48"
            fontWeight="900"
            letterSpacing="3"
            fontFamily="Trebuchet MS, Segoe UI, sans-serif"
          >
            BAJOTERRA 4.0
          </text>
          <text
            x="78"
            y="92"
            fill="#94d2dc"
            fontSize="20"
            fontWeight="700"
            letterSpacing="6"
            fontFamily="Trebuchet MS, Segoe UI, sans-serif"
          >
            MUNDO VIVO
          </text>
          <line x1="78" y1="104" x2="430" y2="104" stroke="#38bdf8" strokeOpacity="0.45" strokeWidth="1.5" />
        </svg>

        <p className="text-sm md:text-base text-slate-200/90 max-w-xl leading-relaxed mb-7">
          Excava cavernas generadas por chunks, ilumina pasadizos ocultos, construye tu refugio, cría y evoluciona babosas hasta Megamorph y domina el combate táctico con Pulso Rápido.
        </p>

        {confirmAction ? (
          <div className="bg-[#0e1a26] border border-amber-400/50 rounded-xl p-4 max-w-md mb-4">
            <p className="text-sm text-amber-100 mb-3">
              {confirmAction === 'new'
                ? 'Ya existe una partida guardada de Bajoterra 4.0. ¿Deseas iniciar una nueva expedición desde cero?'
                : 'Se detectó una partida de Bajoterra 3.0. Se importará a 4.0 sin borrar ni sobrescribir tu partida 3.0 original.'}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const act = confirmAction;
                  setConfirmAction(null);
                  if (act === 'new') onNewGame();
                  else onImportV3Detected();
                }}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-colors cursor-pointer"
              >
                Confirmar
              </button>
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            {snap.hasV4Save ? (
              <>
                <button
                  onClick={onContinue}
                  className="px-6 py-3 rounded-xl bg-cyan-400 text-slate-950 font-extrabold text-sm tracking-wide hover:bg-cyan-300 transition-transform active:scale-[0.98] cursor-pointer min-h-[44px]"
                >
                  Continuar Expedición
                </button>
                <button
                  onClick={() => setConfirmAction('new')}
                  className="px-5 py-3 rounded-xl bg-[#132331] border border-slate-600 text-slate-100 font-bold text-sm hover:border-cyan-400 transition-colors cursor-pointer min-h-[44px]"
                >
                  Nueva Partida
                </button>
              </>
            ) : (
              <button
                onClick={onNewGame}
                className="px-6 py-3 rounded-xl bg-cyan-400 text-slate-950 font-extrabold text-sm tracking-wide hover:bg-cyan-300 transition-transform active:scale-[0.98] cursor-pointer min-h-[44px]"
              >
                Iniciar Expedición
              </button>
            )}

            {snap.hasV3Save && (
              <button
                onClick={() => setConfirmAction('v3')}
                className="px-4 py-3 rounded-xl bg-amber-500/20 border border-amber-400/60 text-amber-200 font-bold text-sm hover:bg-amber-500/30 transition-colors cursor-pointer min-h-[44px]"
              >
                Importar Bajoterra 3.0
              </button>
            )}

            <label className="px-4 py-3 rounded-xl bg-[#132331] border border-slate-600 text-slate-200 font-semibold text-sm hover:border-cyan-400 transition-colors cursor-pointer min-h-[44px] flex items-center">
              Cargar archivo JSON
              <input type="file" accept=".json,application/json" onChange={handleFile} hidden />
            </label>
          </div>
        )}
      </div>

      <div className="text-xs text-slate-300/80 border-t border-white/10 pt-3 flex flex-wrap gap-x-4 gap-y-1">
        <span>WASD / Flechas: Mover</span>
        <span>·</span>
        <span>Shift: Correr</span>
        <span>·</span>
        <span>E / Clic: Minar o Usar</span>
        <span>·</span>
        <span>1–8: Herramientas</span>
        <span>·</span>
        <span>Espacio: Pulso Escáner</span>
        <span>·</span>
        <span>I: Estuche y Taller</span>
        <span>·</span>
        <span>M: Mapa</span>
        <span>·</span>
        <span>Esc: Pausa</span>
      </div>
    </div>
  );
};
