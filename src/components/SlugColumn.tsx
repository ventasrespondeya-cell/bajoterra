import React from 'react';
import { Sparkles } from 'lucide-react';
import { ELEMENT_CHART } from '../game/data';
import { getSlugDisplayName } from '../game/progression';
import type { SlugInstance } from '../game/types';
import { SlugPortrait, type SlugPortraitMood } from './SlugPortrait';

interface SlugColumnProps {
  party: SlugInstance[];
  activeIndex: number;
  onSelectSlug: (index: number) => void;
  activeMood?: SlugPortraitMood;
  disabled?: boolean;
  disableKo?: boolean;
  showEnergy?: boolean;
  compact?: boolean;
  className?: string;
}

/**
 * Columna vertical derecha inspirada en estuche tecnológico de Bajoterra.
 * Reutilizada de forma coherente tanto en Exploración como en Combate.
 */
export const SlugColumn: React.FC<SlugColumnProps> = ({
  party,
  activeIndex,
  onSelectSlug,
  activeMood = 'happy',
  disabled = false,
  disableKo = false,
  showEnergy = false,
  compact = false,
  className = '',
}) => {
  if (!party || party.length === 0) return null;

  return (
    <aside
      aria-label="Estuche de babosas"
      className={`pointer-events-auto bt-slug-rack rounded-2xl p-1.5 flex flex-col gap-1.5 shrink-0 ${
        compact ? 'w-[58px] sm:w-[70px]' : 'w-[60px] sm:w-[138px]'
      } ${className}`}
    >
      {/* Top Ancient-Tech Case Indicator */}
      <div className="flex items-center justify-center sm:justify-between px-1 pt-0.5 pb-1 border-b border-cyan-400/15">
        <span className="hidden sm:inline text-[9px] font-extrabold uppercase tracking-widest text-teal-300/90">
          Estuche
        </span>
        <span className="flex items-center gap-1" aria-hidden="true">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-300 shadow-[0_0_6px_#5eead4]" />
          <span className="w-1.5 h-1.5 rounded-full bg-amber-300/80" />
        </span>
      </div>

      {party.map((s, idx) => {
        const isActive = idx === activeIndex;
        const isKo = s.hp <= 0;
        const isDisabled = disabled || (disableKo && isKo);
        const hpPct = Math.max(0, Math.min(100, (s.hp / Math.max(1, s.maxHp)) * 100));
        const enPct = Math.max(0, Math.min(100, (s.energy / Math.max(1, s.maxEnergy)) * 100));
        const elemColor = ELEMENT_CHART[s.type]?.color || '#38bdf8';
        const displayName = getSlugDisplayName(s);

        return (
          <button
            key={s.uid}
            type="button"
            disabled={isDisabled}
            onClick={() => onSelectSlug(idx)}
            title={`${displayName} · Nv.${s.level} (${s.type}) · ${s.hp}/${s.maxHp} PS${s.mega ? ' · Megamorph' : ''}`}
            className={`relative group flex items-center gap-2 rounded-xl px-1.5 py-1.5 text-left cursor-pointer disabled:cursor-default min-h-[48px] ${
              compact ? 'justify-center' : 'justify-center sm:justify-start'
            } ${
              isActive
                ? 'bt-slug-slot-active bt-animate-slug-swap'
                : 'bt-slug-slot'
            } ${isKo ? 'opacity-45 grayscale' : ''}`}
            style={{
              borderColor:
                isActive && s.mega
                  ? 'rgba(251, 191, 36, 0.92)'
                  : isActive
                  ? undefined
                  : s.mega
                  ? 'rgba(251, 191, 36, 0.35)'
                  : undefined,
            }}
          >
            {/* Active Selection Side Rail */}
            {isActive && (
              <span
                className="absolute left-0.5 top-2 bottom-2 w-1 rounded-full"
                style={{
                  backgroundColor: s.mega ? '#fbbf24' : '#5eead4',
                  boxShadow: `0 0 8px ${s.mega ? '#fbbf24' : '#2dd4bf'}`,
                }}
              />
            )}

            {/* Megamorph Crest Indicator */}
            {s.mega && (
              <span
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#1a1305] border border-amber-300 flex items-center justify-center shadow-[0_0_8px_rgba(251,191,36,0.55)] z-10"
                title="Megamorph"
              >
                <Sparkles className="w-2.5 h-2.5 text-amber-300" />
              </span>
            )}

            {/* Portrait + Mobile Mini Bars */}
            <div className="flex flex-col items-center shrink-0">
              <div
                className={`relative flex items-center justify-center transition-transform duration-150 ${
                  isActive ? 'scale-105' : 'group-hover:scale-105'
                }`}
              >
                <SlugPortrait
                  speciesId={s.id}
                  mega={s.mega}
                  mood={isKo ? 'ko' : isActive ? activeMood : 'idle'}
                  size={isActive ? 34 : 30}
                />
                <span
                  className="sm:hidden absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#050b12]"
                  style={{ backgroundColor: elemColor }}
                />
              </div>

              {/* Compact Mobile HP (+ optional EN) */}
              <div className={`${compact ? 'w-10' : 'sm:hidden w-10'} mt-1 space-y-0.5`}>
                <div className="h-1 bg-[#040a10] rounded-full overflow-hidden border border-white/10">
                  <div
                    className={`h-full transition-all duration-150 ${
                      hpPct > 45 ? 'bg-emerald-400' : hpPct > 22 ? 'bg-amber-400' : 'bg-rose-400'
                    }`}
                    style={{ width: `${hpPct}%` }}
                  />
                </div>
                {showEnergy && (
                  <div className="h-0.5 bg-[#040a10] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cyan-300 transition-all duration-150"
                      style={{ width: `${enPct}%` }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Desktop Identification + Vital Gauges */}
            {!compact && (
              <div className="hidden sm:flex flex-col min-w-0 flex-1 pr-0.5">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-extrabold text-white truncate">
                    {displayName}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[9px] text-slate-300 tabular-nums mt-0.5">
                  <span className="font-bold" style={{ color: elemColor }}>
                    {s.type}
                  </span>
                  <span>Nv.{s.level}</span>
                </div>
                <div className="h-1.5 bg-[#040a10] rounded-full overflow-hidden border border-white/10 mt-1">
                  <div
                    className={`h-full transition-all duration-150 ${
                      hpPct > 45 ? 'bg-emerald-400' : hpPct > 22 ? 'bg-amber-400' : 'bg-rose-400'
                    }`}
                    style={{ width: `${hpPct}%` }}
                  />
                </div>
                {showEnergy && (
                  <div className="h-1 bg-[#040a10] rounded-full overflow-hidden mt-0.5">
                    <div
                      className="h-full bg-cyan-300 transition-all duration-150"
                      style={{ width: `${enPct}%` }}
                    />
                  </div>
                )}
              </div>
            )}
          </button>
        );
      })}
    </aside>
  );
};
