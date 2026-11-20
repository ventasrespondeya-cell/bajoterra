import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Shield, Swords, Zap } from 'lucide-react';
import { ELEMENT_CHART, getElementMultiplier, getSpecies } from '../game/data';
import { getEffectiveMoveEnergyCost, getMoveMasteryInfo } from '../game/progression';
import type { BattleState, GameState } from '../game/types';
import { CombatManager } from '../game/combat';

interface BattleModalProps {
  battle: BattleState;
  state: GameState;
  combat: CombatManager;
  onSync: () => void;
}

export const BattleModal: React.FC<BattleModalProps> = ({ battle, state, combat, onSync }) => {
  const [subMenu, setSubMenu] = useState<'main' | 'bag' | 'swap'>('main');
  const [pulseMinigame, setPulseMinigame] = useState(false);
  const [needlePos, setNeedlePos] = useState(0); // 0..100
  const rafRef = useRef<number | null>(null);
  const needleRef = useRef(0);

  const ally = state.party[state.activePartyIndex] || state.party[0];
  const allySpecies = getSpecies(ally.id);
  const enemy = battle.enemy;
  const mult = getElementMultiplier(ally.type, enemy.type);

  useEffect(() => {
    if (!pulseMinigame) return;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = (now - start) / 1000;
      // Oscillate fast 0..100
      const p = (Math.sin(elapsed * 5.2 - Math.PI / 2) * 0.5 + 0.5) * 100;
      needleRef.current = p;
      setNeedlePos(p);
      if (elapsed > 2.2) {
        // Auto-resolve with low score if timed out
        setPulseMinigame(false);
        combat.triggerPulsoRapido(state, 0.35);
        onSync();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [pulseMinigame, combat, state, onSync]);

  const confirmPulseHit = useCallback(() => {
    if (!pulseMinigame) return;
    setPulseMinigame(false);
    const distFromCenter = Math.abs(needleRef.current - 50) / 50; // 0 = perfect, 1 = edge
    const score = Math.max(0, 1 - distFromCenter);
    combat.triggerPulsoRapido(state, score);
    onSync();
  }, [pulseMinigame, combat, state, onSync]);

  useEffect(() => {
    if (!pulseMinigame) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault();
        confirmPulseHit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pulseMinigame, confirmPulseHit]);

  const canAct = battle.turn === 'player' && !pulseMinigame;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-3 md:p-6 bg-[#040910]/88">
      <div className="w-full max-w-3xl bg-[#0e1b26] border border-cyan-500/40 rounded-2xl p-4 md:p-6 shadow-2xl max-h-[96dvh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <h2 className="text-lg md:text-xl font-extrabold text-white flex items-center gap-2">
              <Swords className="w-5 h-5 text-cyan-300" />
              Combate Táctico Híbrido
            </h2>
            <p className="text-xs text-slate-300">{battle.subtitle}</p>
          </div>
          <div className="text-right text-xs">
            <span
              className="font-bold"
              style={{ color: mult > 1.2 ? '#4ade80' : mult < 0.9 ? '#f87171' : '#cbd5e1' }}
            >
              {mult > 1.2 ? 'Ventaja elemental ×1.75' : mult < 0.9 ? 'Desventaja ×0.65' : 'Afinidad neutra ×1.0'}
            </span>
          </div>
        </div>

        {/* Arena */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          {/* Ally */}
          <div className="bg-[#09131c] border border-cyan-400/35 rounded-xl p-3.5 relative">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-sm font-extrabold text-white">
                  {ally.name} {ally.mega ? '★' : ''}
                </div>
                <div className="text-[11px] text-slate-300">
                  Nv.{ally.level} ·{' '}
                  <span style={{ color: ELEMENT_CHART[ally.type]?.color }}>{ally.type}</span>
                  {ally.bonusTrait ? ` · ${ally.bonusTrait}` : ''}
                  {combat.allyShieldTurns > 0 ? ' · 🛡 Escudo' : ''}
                </div>
              </div>
              <div className="text-4xl leading-none">{ally.icon}</div>
            </div>

            <div className="flex justify-between text-xs text-slate-300 tabular-nums mb-1">
              <span>Salud</span>
              <span>
                {ally.hp} / {ally.maxHp}
              </span>
            </div>
            <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-emerald-400 transition-all duration-200"
                style={{ width: `${(ally.hp / ally.maxHp) * 100}%` }}
              />
            </div>

            <div className="flex justify-between text-xs text-slate-300 tabular-nums mb-1">
              <span>Energía</span>
              <span>
                {ally.energy} / {ally.maxEnergy}
              </span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-400 transition-all duration-200"
                style={{ width: `${(ally.energy / ally.maxEnergy) * 100}%` }}
              />
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              {battle.effects
                .filter((ef) => ef.target === 'ally')
                .slice(-2)
                .map((ef) => (
                  <span key={ef.id} className="text-xs font-extrabold" style={{ color: ef.color }}>
                    {ef.text}
                  </span>
                ))}
            </div>
          </div>

          {/* Enemy */}
          <div
            className={`bg-[#09131c] border rounded-xl p-3.5 relative ${
              enemy.telegraphing === 'heavy' ? 'border-amber-400' : 'border-rose-400/35'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-sm font-extrabold text-white">{enemy.name}</div>
                <div className="text-[11px] text-slate-300">
                  Nv.{enemy.level} ·{' '}
                  <span style={{ color: ELEMENT_CHART[enemy.type]?.color }}>{enemy.type}</span>
                  {enemy.burnTurns > 0 ? ' · 🔥 Quemado' : ''}
                  {enemy.chillTurns > 0 ? ' · ❄️ Frío' : ''}
                  {enemy.stunTurns > 0 ? ' · ⚡ Aturdido' : ''}
                  {enemy.shieldTurns > 0 ? ' · 🛡 Escudo' : ''}
                </div>
              </div>
              <div className="text-4xl leading-none">{enemy.icon}</div>
            </div>

            <div className="flex justify-between text-xs text-slate-300 tabular-nums mb-1">
              <span>Salud Rival</span>
              <span>
                {enemy.hp} / {enemy.maxHp}
              </span>
            </div>
            <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-rose-400 transition-all duration-200"
                style={{ width: `${(enemy.hp / enemy.maxHp) * 100}%` }}
              />
            </div>

            {enemy.telegraphing === 'heavy' && (
              <div className="text-xs font-bold text-amber-300 mb-1">
                ⚠ ¡Preparando golpe pesado! Usa Pulso Rápido o Defensa.
              </div>
            )}

            <div className="mt-2 flex flex-wrap gap-2">
              {battle.effects
                .filter((ef) => ef.target === 'enemy')
                .slice(-2)
                .map((ef) => (
                  <span key={ef.id} className="text-xs font-extrabold" style={{ color: ef.color }}>
                    {ef.text}
                  </span>
                ))}
            </div>
          </div>
        </div>

        {/* PULSO RÁPIDO Gauge & Timing Bar */}
        <div className="bg-[#091520] border border-teal-400/40 rounded-xl p-3 mb-3">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2">
              <Zap className={`w-4 h-4 ${battle.pulseWindowActive ? 'text-teal-300' : 'text-slate-400'}`} />
              <span className="text-xs font-extrabold tracking-wide text-teal-200">
                PULSO RÁPIDO ({battle.pulseCharge}%)
              </span>
              {battle.pulseReason && (
                <span className="text-xs text-amber-200 hidden sm:inline">· {battle.pulseReason}</span>
              )}
            </div>
            {battle.pulseWindowActive && canAct && (
              <button
                onClick={() => setPulseMinigame(true)}
                className="px-3.5 py-1.5 rounded-lg bg-teal-400 text-slate-950 font-extrabold text-xs hover:bg-teal-300 transition-colors cursor-pointer"
              >
                ⚡ Activar Pulso Rápido
              </button>
            )}
          </div>

          {!pulseMinigame ? (
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 to-teal-300 transition-all duration-200"
                style={{ width: `${battle.pulseCharge}%` }}
              />
            </div>
          ) : (
            <div className="mt-2">
              <div className="relative h-7 bg-slate-900 border border-teal-400 rounded-lg overflow-hidden mb-2">
                {/* Sweet spot center */}
                <div className="absolute inset-y-0 left-[38%] right-[38%] bg-teal-400/35 border-x border-teal-300" />
                <div
                  className="absolute inset-y-0 w-2 bg-white shadow-[0_0_10px_#fff]"
                  style={{ left: `calc(${needlePos}% - 4px)` }}
                />
              </div>
              <button
                onClick={confirmPulseHit}
                className="w-full py-2.5 rounded-lg bg-teal-400 text-slate-950 font-extrabold text-sm cursor-pointer"
              >
                ¡DISPARAR AHORA! (Espacio o Clic)
              </button>
            </div>
          )}
        </div>

        {/* Battle Log */}
        <div className="bg-[#071018] border border-slate-800 rounded-xl p-2.5 mb-3 text-xs text-slate-200 min-h-[46px]">
          {battle.log[0]}
          {battle.log[1] && <div className="text-slate-400 mt-0.5">{battle.log[1]}</div>}
        </div>

        {/* Ended State or Action Buttons */}
        {battle.turn === 'ended' ? (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#102230] border border-cyan-400/40 rounded-xl p-3.5">
            <div className="text-sm font-bold text-cyan-100">{battle.rewardText}</div>
            <button
              onClick={() => {
                combat.closeBattle();
                onSync();
              }}
              className="px-6 py-2.5 rounded-xl bg-cyan-400 text-slate-950 font-extrabold text-sm hover:bg-cyan-300 cursor-pointer min-h-[44px]"
            >
              Continuar Exploración
            </button>
          </div>
        ) : subMenu === 'main' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              disabled={!canAct}
              onClick={() => {
                combat.executeNormalAttack(state);
                onSync();
              }}
              className="p-3 rounded-xl bg-[#162b3b] border border-cyan-400/40 hover:border-cyan-300 text-left disabled:opacity-45 cursor-pointer"
            >
              <div className="text-sm font-extrabold text-white">Ataque Elemental</div>
              <div className="text-[11px] text-slate-300">
                Potencia base {ally.atk} · +2 Energía · +24% Pulso
              </div>
            </button>

            <button
              disabled={!canAct}
              onClick={() => {
                combat.executeDefense(state);
                onSync();
              }}
              className="p-3 rounded-xl bg-[#162b3b] border border-slate-600 hover:border-cyan-300 text-left disabled:opacity-45 cursor-pointer"
            >
              <div className="text-sm font-extrabold text-white flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-sky-300" />
                Escudo y Recarga
              </div>
              <div className="text-[11px] text-slate-300">
                Reduce daño 58% · +4 Energía · +30% Pulso
              </div>
            </button>

            {allySpecies.specialMoves.map((mv, i) => {
              const cd = combat.allyCooldowns[mv.id] || 0;
              const masteryPts = ally.moveMastery?.[i as 0 | 1] ?? 0;
              const masteryInfo = getMoveMasteryInfo(masteryPts);
              const effectiveCost = getEffectiveMoveEnergyCost(mv.energyCost, masteryPts);
              const disabled = !canAct || cd > 0 || ally.energy < effectiveCost;
              return (
                <button
                  key={mv.id}
                  disabled={disabled}
                  onClick={() => {
                    combat.executeSpecialMove(state, i as 0 | 1);
                    onSync();
                  }}
                  className="p-3 rounded-xl bg-[#19283a] border border-indigo-400/40 hover:border-indigo-300 text-left disabled:opacity-40 cursor-pointer"
                >
                  <div className="flex justify-between text-sm font-extrabold text-white">
                    <span>
                      ✦ {mv.name}
                      {masteryInfo.rank > 0 ? (
                        <span className="ml-1.5 text-[10px] font-bold text-amber-300">
                          {masteryInfo.label}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs text-cyan-300 tabular-nums">
                      {cd > 0 ? `Espera ${cd}t` : `${effectiveCost} EN`}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300">{mv.description}</div>
                </button>
              );
            })}

            <button
              disabled={!canAct}
              onClick={() => setSubMenu('bag')}
              className="p-2.5 rounded-xl bg-[#13222e] border border-slate-600 hover:border-amber-300 text-sm font-bold text-amber-200 disabled:opacity-45 cursor-pointer"
            >
              Mochila y Captura
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                disabled={!canAct}
                onClick={() => setSubMenu('swap')}
                className="p-2.5 rounded-xl bg-[#13222e] border border-slate-600 hover:border-cyan-300 text-sm font-bold text-slate-100 disabled:opacity-45 cursor-pointer"
              >
                Babosas
              </button>
              <button
                disabled={!canAct || battle.kind === 'boss'}
                onClick={() => {
                  combat.attemptRun(state);
                  onSync();
                }}
                className="p-2.5 rounded-xl bg-[#271b1c] border border-rose-500/40 hover:border-rose-400 text-sm font-bold text-rose-200 disabled:opacity-40 cursor-pointer"
              >
                Huir
              </button>
            </div>
          </div>
        ) : subMenu === 'bag' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              disabled={!canAct || state.inventory.berries <= 0}
              onClick={() => {
                combat.useItem(state, 'berries');
                setSubMenu('main');
                onSync();
              }}
              className="p-3 rounded-xl bg-[#132620] border border-emerald-500/40 text-left disabled:opacity-40 cursor-pointer"
            >
              <div className="text-sm font-bold text-white">🍓 Baya Subterránea ({state.inventory.berries})</div>
              <div className="text-xs text-slate-300">Restaura 32 PS al aliado activo</div>
            </button>

            <button
              disabled={!canAct || state.inventory.core <= 0}
              onClick={() => {
                combat.useItem(state, 'core');
                setSubMenu('main');
                onSync();
              }}
              className="p-3 rounded-xl bg-[#122536] border border-cyan-500/40 text-left disabled:opacity-40 cursor-pointer"
            >
              <div className="text-sm font-bold text-white">🔷 Núcleo de Energía ({state.inventory.core})</div>
              <div className="text-xs text-slate-300">Recarga +8 Energía</div>
            </button>

            <button
              disabled={!canAct || state.inventory.capsules <= 0 || battle.kind !== 'wild'}
              onClick={() => {
                combat.useItem(state, 'capsules');
                setSubMenu('main');
                onSync();
              }}
              className="p-3 rounded-xl bg-[#1e2138] border border-indigo-400/40 text-left disabled:opacity-40 cursor-pointer"
            >
              <div className="text-sm font-bold text-white">🧪 Cilindro de Captura ({state.inventory.capsules})</div>
              <div className="text-xs text-slate-300">Captura babosas salvajes</div>
            </button>

            <button
              disabled={!canAct || state.inventory.masterCapsules <= 0 || battle.kind !== 'wild'}
              onClick={() => {
                combat.useItem(state, 'masterCapsules');
                setSubMenu('main');
                onSync();
              }}
              className="p-3 rounded-xl bg-[#2a1f3d] border border-purple-400/50 text-left disabled:opacity-40 cursor-pointer"
            >
              <div className="text-sm font-bold text-white">🟣 Cilindro Maestro ({state.inventory.masterCapsules})</div>
              <div className="text-xs text-slate-300">Probabilidad muy alta de captura</div>
            </button>

            <button
              onClick={() => setSubMenu('main')}
              className="sm:col-span-2 p-2.5 rounded-xl bg-slate-800 text-slate-200 font-bold text-xs cursor-pointer"
            >
              Volver
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {state.party.map((s, idx) => (
              <button
                key={s.uid}
                disabled={!canAct || s.hp <= 0 || idx === state.activePartyIndex}
                onClick={() => {
                  combat.swapSlug(state, idx);
                  setSubMenu('main');
                  onSync();
                }}
                className="p-3 rounded-xl bg-[#122230] border border-slate-600 text-left disabled:opacity-40 cursor-pointer"
              >
                <div className="text-sm font-bold text-white">
                  {s.icon} {s.name} (Nv.{s.level})
                </div>
                <div className="text-xs text-slate-300">
                  {s.type} · PS {s.hp}/{s.maxHp} · EN {s.energy}/{s.maxEnergy}
                </div>
              </button>
            ))}
            <button
              onClick={() => setSubMenu('main')}
              className="sm:col-span-2 p-2.5 rounded-xl bg-slate-800 text-slate-200 font-bold text-xs cursor-pointer"
            >
              Volver
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
