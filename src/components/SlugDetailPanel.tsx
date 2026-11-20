import React from 'react';
import { Sparkles, Star, X } from 'lucide-react';
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
import type { GameState, HudSnapshot, SlugInstance } from '../game/types';

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
  const sp = getSpecies(slug.id);
  const bondTier = getBondTierInfo(slug.bond);
  const traitInfo = getTraitInfo(slug.bonusTrait);
  const nextXp = getXpForNextLevel(slug.level);
  const xpPct = slug.level >= MAX_SLUG_LEVEL ? 100 : Math.min(100, Math.round((slug.xp / nextXp) * 100));
  const megaCheck = checkMegamorphEligibility(
    { inventory: snap.inventory } as unknown as GameState,
    slug
  );

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 md:p-6 bg-[#03080e]/85">
      <div className="w-full max-w-2xl bg-[#0e1b26] border border-cyan-500/40 rounded-2xl p-4 md:p-5 shadow-2xl max-h-[90dvh] overflow-y-auto space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#09131c] border border-slate-700 flex items-center justify-center text-3xl">
              {slug.icon}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-extrabold text-white">{slug.name}</h3>
                {slug.mega && (
                  <span className="px-2 py-0.5 rounded bg-amber-400/20 border border-amber-300/60 text-amber-200 text-[11px] font-bold">
                    ★ Megamorph
                  </span>
                )}
                {slug.isBred && (
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 text-[11px] font-bold">
                    Cría del Refugio
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-300 mt-0.5">
                Especie: <span className="text-white font-semibold">{sp.name}</span> ·{' '}
                <span style={{ color: ELEMENT_CHART[slug.type]?.color }}>{slug.type}</span> · {slug.rarity} ·{' '}
                <span className="text-cyan-300">{locationLabel}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar ficha"
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Level, XP and Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-[#09131c] border border-slate-700/80 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-cyan-300">Nivel {slug.level}/{MAX_SLUG_LEVEL}</span>
              <span className="text-slate-300 tabular-nums">
                {slug.level >= MAX_SLUG_LEVEL ? 'Nivel máximo' : `EXP ${slug.xp}/${nextXp}`}
              </span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-cyan-400 transition-all" style={{ width: `${xpPct}%` }} />
            </div>
            <div className="grid grid-cols-5 gap-1.5 pt-1 text-center text-[11px] tabular-nums">
              <div className="bg-[#0f1f2d] rounded-lg py-1.5">
                <div className="text-slate-400 text-[10px]">PS</div>
                <div className="font-bold text-emerald-300">{slug.hp}/{slug.maxHp}</div>
              </div>
              <div className="bg-[#0f1f2d] rounded-lg py-1.5">
                <div className="text-slate-400 text-[10px]">EN</div>
                <div className="font-bold text-cyan-300">{slug.energy}/{slug.maxEnergy}</div>
              </div>
              <div className="bg-[#0f1f2d] rounded-lg py-1.5">
                <div className="text-slate-400 text-[10px]">ATQ</div>
                <div className="font-bold text-rose-300">{slug.atk}</div>
              </div>
              <div className="bg-[#0f1f2d] rounded-lg py-1.5">
                <div className="text-slate-400 text-[10px]">DEF</div>
                <div className="font-bold text-sky-300">{slug.def}</div>
              </div>
              <div className="bg-[#0f1f2d] rounded-lg py-1.5">
                <div className="text-slate-400 text-[10px]">VEL</div>
                <div className="font-bold text-amber-300">{slug.spd}</div>
              </div>
            </div>
          </div>

          {/* Bond & Tier */}
          <div className="bg-[#09131c] border border-slate-700/80 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span style={{ color: bondTier.color }}>
                ♥ Vínculo · {bondTier.label}
              </span>
              <span className="text-amber-300 tabular-nums">{slug.bond}/100</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
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
        <div className="bg-[#09131c] border border-slate-700/80 rounded-xl p-3">
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
        <div className="bg-[#09131c] border border-slate-700/80 rounded-xl p-3 space-y-2.5">
          <div className="text-xs font-extrabold text-indigo-300 uppercase tracking-wider">
            Técnicas Especiales y Maestría
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {sp.specialMoves.map((mv, idx) => {
              const pts = slug.moveMastery?.[idx as 0 | 1] ?? 0;
              const mInfo = getMoveMasteryInfo(pts);
              const cost = getEffectiveMoveEnergyCost(mv.energyCost, pts);
              return (
                <div key={mv.id} className="bg-[#0f1f2d] border border-slate-700/80 rounded-lg p-2.5 text-xs space-y-1.5">
                  <div className="flex items-center justify-between font-bold text-white">
                    <span>✦ {mv.name}</span>
                    <span className="text-cyan-300 tabular-nums">{cost} EN</span>
                  </div>
                  <div className="text-[11px] text-slate-300">{mv.description}</div>
                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <span className="font-bold text-amber-300">{mInfo.label}</span>
                    <span className="text-slate-400 tabular-nums">{pts}/{MAX_MOVE_MASTERY}</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-400 transition-all"
                      style={{ width: `${Math.round((pts / MAX_MOVE_MASTERY) * 100)}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-indigo-200">{mInfo.bonusText}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Megamorph Evolution */}
        <div className="bg-[#09131c] border border-amber-400/35 rounded-xl p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="text-xs font-extrabold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              Evolución Megamorph ({sp.evoName})
            </div>
            {slug.mega && (
              <span className="text-xs font-bold text-emerald-300 flex items-center gap-1">
                <Star className="w-3.5 h-3.5" /> Completada
              </span>
            )}
          </div>

          {slug.mega ? (
            <p className="text-xs text-slate-300">
              {slug.name} ya alcanzó su transformación Megamorph manteniendo toda su experiencia, vínculo y maestría.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div
                  className={`px-2.5 py-2 rounded-lg border ${
                    megaCheck.hasLevel
                      ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-200'
                      : 'bg-[#0f1f2d] border-slate-700 text-slate-300'
                  }`}
                >
                  {megaCheck.hasLevel ? '✓' : '○'} Nivel {MEGAMORPH_MIN_LEVEL}+ (Nv.{slug.level})
                </div>
                <div
                  className={`px-2.5 py-2 rounded-lg border ${
                    megaCheck.hasBond
                      ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-200'
                      : 'bg-[#0f1f2d] border-slate-700 text-slate-300'
                  }`}
                >
                  {megaCheck.hasBond ? '✓' : '○'} Amistad {MEGAMORPH_MIN_BOND}+ ({slug.bond})
                </div>
                <div
                  className={`px-2.5 py-2 rounded-lg border ${
                    megaCheck.hasResource
                      ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-200'
                      : 'bg-[#0f1f2d] border-slate-700 text-slate-300'
                  }`}
                >
                  {megaCheck.hasResource ? '✓' : '○'} 1 Elixir ({snap.inventory.elixirs}), Reliquia ({snap.inventory.relics}) o Piedra Evo. ({snap.inventory.evoStone})
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {snap.inventory.elixirs > 0 && (
                  <button
                    onClick={() => gameEngine.useElixirOnSlug(slug.uid)}
                    className="px-3.5 py-2 rounded-lg bg-purple-500 hover:bg-purple-400 text-white font-bold text-xs cursor-pointer"
                  >
                    Aplicar Elixir (+25 Amistad, +35 EXP) · {snap.inventory.elixirs}
                  </button>
                )}
                <button
                  disabled={!megaCheck.eligible}
                  onClick={() => gameEngine.evolveSlugToMegamorph(slug.uid)}
                  className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs disabled:opacity-40 cursor-pointer"
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
