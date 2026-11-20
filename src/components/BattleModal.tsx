import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Backpack, RefreshCw, Shield, Sparkles, Swords, Zap } from 'lucide-react';
import { BIOME_INFO, ELEMENT_CHART, getElementMultiplier, getSpecies } from '../game/data';
import { getEffectiveMoveEnergyCost, getMoveMasteryInfo } from '../game/progression';
import { getBiomeAt } from '../game/world';
import type { BattleState, GameState } from '../game/types';
import { CombatManager } from '../game/combat';
import { SlugPortrait, type SlugPortraitMood } from './SlugPortrait';

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

  const currentBiome = getBiomeAt(
    Math.round(state.player.x),
    Math.round(state.player.y),
    state.worldSeed
  );
  const biomeInfo = BIOME_INFO[currentBiome];

  useEffect(() => {
    if (!pulseMinigame) return;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = (now - start) / 1000;
      const p = (Math.sin(elapsed * 5.2 - Math.PI / 2) * 0.5 + 0.5) * 100;
      needleRef.current = p;
      setNeedlePos(p);
      if (elapsed > 2.2) {
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
    const distFromCenter = Math.abs(needleRef.current - 50) / 50;
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

  const lastAllyEf = battle.effects.filter((ef) => ef.target === 'ally').slice(-1)[0];
  const lastEnemyEf = battle.effects.filter((ef) => ef.target === 'enemy').slice(-1)[0];

  const allyMood: SlugPortraitMood =
    ally.hp <= 0
      ? 'ko'
      : lastAllyEf?.kind === 'hit'
      ? 'hit'
      : lastAllyEf?.kind === 'heal' || lastAllyEf?.kind === 'shield'
      ? 'happy'
      : battle.pulseWindowActive
      ? 'attack'
      : 'idle';

  const enemyMood: SlugPortraitMood =
    enemy.hp <= 0
      ? 'ko'
      : lastEnemyEf?.kind === 'hit' || lastEnemyEf?.kind === 'crit' || lastEnemyEf?.kind === 'pulse'
      ? 'hit'
      : enemy.telegraphing === 'heavy'
      ? 'attack'
      : 'idle';

  const allyHpPct = Math.max(0, Math.min(100, (ally.hp / Math.max(1, ally.maxHp)) * 100));
  const allyEnPct = Math.max(0, Math.min(100, (ally.energy / Math.max(1, ally.maxEnergy)) * 100));
  const enemyHpPct = Math.max(0, Math.min(100, (enemy.hp / Math.max(1, enemy.maxHp)) * 100));

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-2.5 sm:p-5 bg-[#03080e]/88 backdrop-blur-sm">
      <div className="bt-panel bt-animate-modal w-full max-w-3xl rounded-2xl p-3.5 sm:p-5 max-h-[96dvh] overflow-y-auto bt-scroll">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-400/20 pb-2.5 mb-3">
          <div>
            <h2 className="text-base sm:text-xl font-extrabold text-white flex items-center gap-2 tracking-tight">
              <Swords className="w-5 h-5 text-teal-300" />
              Combate Táctico Híbrido
            </h2>
            <p className="text-xs text-slate-300">
              {battle.subtitle} · <span style={{ color: biomeInfo.accent }}>{biomeInfo.name}</span>
            </p>
          </div>
          <div className="text-right text-xs font-extrabold px-2.5 py-1 rounded-lg bt-inset">
            <span
              style={{ color: mult > 1.2 ? '#4ade80' : mult < 0.9 ? '#f87171' : '#cbd5e1' }}
            >
              {mult > 1.2
                ? 'Ventaja elemental ×1.75'
                : mult < 0.9
                ? 'Desventaja ×0.65'
                : 'Afinidad neutra ×1.0'}
            </span>
          </div>
        </div>

        {/* Dynamic Biome Battle Arena Stage */}
        <div
          className="rounded-xl border border-cyan-400/25 p-3 sm:p-4 mb-3 relative overflow-hidden"
          style={{
            background: `radial-gradient(circle at 25% 55%, ${biomeInfo.accent}22 0%, rgba(8,18,28,0.92) 55%), radial-gradient(circle at 80% 35%, ${ELEMENT_CHART[enemy.type]?.color || '#f43f5e'}20 0%, #071019 100%)`,
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 relative z-10">
            {/* Ally Combatant */}
            <div className="bt-card rounded-xl p-3.5 border-teal-400/35 relative">
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-white flex items-center gap-1.5 truncate">
                    <span className="truncate">{ally.name}</span>
                    {ally.mega && <span className="text-amber-300 text-xs">★ Megamorph</span>}
                  </div>
                  <div className="text-[11px] text-slate-300 mt-0.5">
                    Nv.{ally.level} ·{' '}
                    <span className="font-bold" style={{ color: ELEMENT_CHART[ally.type]?.color }}>
                      {ally.type}
                    </span>
                    {ally.bonusTrait ? ` · ${ally.bonusTrait}` : ''}
                  </div>
                  {combat.allyShieldTurns > 0 && (
                    <div className="text-[11px] font-bold text-sky-300 mt-0.5">🛡 Escudo activo</div>
                  )}
                </div>
                <div
                  key={`ally_${lastAllyEf?.id || 0}`}
                  className={lastAllyEf?.kind === 'hit' ? 'bt-animate-hit' : 'bt-animate-slug'}
                >
                  <SlugPortrait speciesId={ally.id} mega={ally.mega} mood={allyMood} size={68} />
                </div>
              </div>

              <div className="flex justify-between text-xs text-slate-200 tabular-nums mb-1 font-semibold">
                <span>Salud</span>
                <span>
                  {ally.hp} / {ally.maxHp}
                </span>
              </div>
              <div className="h-2.5 bg-[#060d14] border border-white/10 rounded-full overflow-hidden mb-2">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-300 transition-all duration-200"
                  style={{ width: `${allyHpPct}%` }}
                />
              </div>

              <div className="flex justify-between text-xs text-slate-300 tabular-nums mb-1">
                <span>Energía</span>
                <span>
                  {ally.energy} / {ally.maxEnergy}
                </span>
              </div>
              <div className="h-2 bg-[#060d14] border border-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-sky-300 transition-all duration-200"
                  style={{ width: `${allyEnPct}%` }}
                />
              </div>

              <div className="mt-2 min-h-[18px] flex flex-wrap gap-2">
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

            {/* Enemy Combatant */}
            <div
              className={`bt-card rounded-xl p-3.5 relative ${
                enemy.telegraphing === 'heavy'
                  ? 'border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.2)]'
                  : 'border-rose-400/40'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-white truncate">
                    {enemy.name}
                    {enemy.isBoss && <span className="ml-1.5 text-[11px] text-rose-300 font-bold">· JEFE</span>}
                  </div>
                  <div className="text-[11px] text-slate-300 mt-0.5">
                    Nv.{enemy.level} ·{' '}
                    <span className="font-bold" style={{ color: ELEMENT_CHART[enemy.type]?.color }}>
                      {enemy.type}
                    </span>
                  </div>
                  <div className="text-[11px] text-amber-200 mt-0.5 flex flex-wrap gap-x-2">
                    {enemy.burnTurns > 0 && <span>🔥 Quemado</span>}
                    {enemy.chillTurns > 0 && <span>❄️ Enfriado</span>}
                    {enemy.stunTurns > 0 && <span>⚡ Aturdido</span>}
                    {enemy.shieldTurns > 0 && <span>🛡 Escudo</span>}
                  </div>
                </div>
                <div
                  key={`enemy_${lastEnemyEf?.id || 0}`}
                  className={
                    lastEnemyEf?.kind === 'hit' ||
                    lastEnemyEf?.kind === 'crit' ||
                    lastEnemyEf?.kind === 'pulse'
                      ? 'bt-animate-hit'
                      : 'bt-animate-slug'
                  }
                >
                  <SlugPortrait speciesId={enemy.id} mega={enemy.mega} mood={enemyMood} size={68} flipX />
                </div>
              </div>

              <div className="flex justify-between text-xs text-slate-200 tabular-nums mb-1 font-semibold">
                <span>Salud Rival</span>
                <span>
                  {enemy.hp} / {enemy.maxHp}
                </span>
              </div>
              <div className="h-2.5 bg-[#060d14] border border-white/10 rounded-full overflow-hidden mb-2">
                <div
                  className="h-full bg-gradient-to-r from-rose-500 to-orange-400 transition-all duration-200"
                  style={{ width: `${enemyHpPct}%` }}
                />
              </div>

              {enemy.telegraphing === 'heavy' ? (
                <div className="text-xs font-extrabold text-amber-200 bg-amber-500/15 border border-amber-400/50 rounded-lg px-2.5 py-1.5 mb-1">
                  ⚠ ¡Preparando golpe pesado! Usa Pulso Rápido o Defensa.
                </div>
              ) : (
                <div className="text-[11px] text-slate-400 mb-1">
                  Observa los turnos del rival para sincronizar tu Pulso Rápido.
                </div>
              )}

              <div className="mt-1.5 min-h-[18px] flex flex-wrap gap-2">
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
        </div>

        {/* PULSO RÁPIDO Energy Conduit & Timing Bar */}
        <div className="bt-inset border-teal-400/40 rounded-xl p-3 mb-3">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <Zap
                className={`w-4 h-4 ${
                  battle.pulseWindowActive ? 'text-teal-300 bt-animate-aura' : 'text-slate-400'
                }`}
              />
              <span className="text-xs font-extrabold tracking-wider text-teal-200 uppercase">
                Pulso Rápido ({battle.pulseCharge}%)
              </span>
              {battle.pulseReason && (
                <span className="text-xs text-amber-200 hidden sm:inline">· {battle.pulseReason}</span>
              )}
            </div>
            {battle.pulseWindowActive && canAct && (
              <button
                onClick={() => setPulseMinigame(true)}
                className="bt-btn-primary px-3.5 py-1.5 rounded-lg font-extrabold text-xs cursor-pointer min-h-[36px]"
              >
                ⚡ Activar Pulso Rápido
              </button>
            )}
          </div>

          {!pulseMinigame ? (
            <div className="h-2.5 bg-[#050b12] border border-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-sky-500 via-cyan-400 to-teal-300 transition-all duration-200"
                style={{ width: `${battle.pulseCharge}%` }}
              />
            </div>
          ) : (
            <div className="mt-2">
              <div className="relative h-8 bg-[#050b12] border border-teal-400 rounded-xl overflow-hidden mb-2">
                {/* Sweet spot center */}
                <div className="absolute inset-y-0 left-[38%] right-[38%] bg-teal-400/35 border-x-2 border-teal-300" />
                <div
                  className="absolute inset-y-0 w-2.5 bg-white shadow-[0_0_12px_#5eead4]"
                  style={{ left: `calc(${needlePos}% - 5px)` }}
                />
              </div>
              <button
                onClick={confirmPulseHit}
                className="bt-btn-primary w-full py-2.5 rounded-xl font-extrabold text-sm cursor-pointer min-h-[44px]"
              >
                ¡DISPARAR AHORA! (Espacio o Clic)
              </button>
            </div>
          )}
        </div>

        {/* Battle Log */}
        <div className="bt-inset rounded-xl p-3 mb-3 text-xs text-slate-100 min-h-[48px]">
          <div className="font-semibold">{battle.log[0]}</div>
          {battle.log[1] && <div className="text-slate-400 mt-0.5">{battle.log[1]}</div>}
        </div>

        {/* Ended State or Command Deck */}
        {battle.turn === 'ended' ? (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bt-card border-teal-400/50 rounded-xl p-4">
            <div className="text-sm font-bold text-teal-100">{battle.rewardText}</div>
            <button
              onClick={() => {
                combat.closeBattle();
                onSync();
              }}
              className="bt-btn-primary px-6 py-2.5 rounded-xl font-extrabold text-sm cursor-pointer min-h-[44px]"
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
              className="bt-btn-secondary p-3 rounded-xl border-cyan-400/40 text-left disabled:opacity-45 cursor-pointer min-h-[54px]"
            >
              <div className="text-sm font-extrabold text-white flex items-center gap-1.5">
                <Swords className="w-4 h-4 text-cyan-300" />
                Ataque Elemental
              </div>
              <div className="text-[11px] text-slate-300 mt-0.5 tabular-nums">
                Potencia base {ally.atk} · +2 Energía · +24% Pulso
              </div>
            </button>

            <button
              disabled={!canAct}
              onClick={() => {
                combat.executeDefense(state);
                onSync();
              }}
              className="bt-btn-secondary p-3 rounded-xl text-left disabled:opacity-45 cursor-pointer min-h-[54px]"
            >
              <div className="text-sm font-extrabold text-white flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-sky-300" />
                Escudo y Recarga
              </div>
              <div className="text-[11px] text-slate-300 mt-0.5">
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
                  className="bt-btn-secondary p-3 rounded-xl border-indigo-400/45 text-left disabled:opacity-40 cursor-pointer min-h-[54px]"
                >
                  <div className="flex justify-between text-sm font-extrabold text-white gap-2">
                    <span className="flex items-center gap-1.5 truncate">
                      <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                      <span className="truncate">{mv.name}</span>
                      {masteryInfo.rank > 0 ? (
                        <span className="text-[10px] font-bold text-amber-300 shrink-0">
                          {masteryInfo.label}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs text-teal-300 tabular-nums shrink-0">
                      {cd > 0 ? `Espera ${cd}t` : `${effectiveCost} EN`}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300 mt-0.5">{mv.description}</div>
                </button>
              );
            })}

            <button
              disabled={!canAct}
              onClick={() => setSubMenu('bag')}
              className="bt-btn-secondary p-2.5 rounded-xl border-amber-400/35 text-sm font-bold text-amber-200 disabled:opacity-45 cursor-pointer min-h-[44px] flex items-center justify-center gap-2"
            >
              <Backpack className="w-4 h-4 text-amber-300" />
              Mochila y Captura
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                disabled={!canAct}
                onClick={() => setSubMenu('swap')}
                className="bt-btn-secondary p-2.5 rounded-xl text-sm font-bold text-slate-100 disabled:opacity-45 cursor-pointer min-h-[44px] flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5 text-cyan-300" />
                Babosas
              </button>
              <button
                disabled={!canAct || battle.kind === 'boss'}
                onClick={() => {
                  combat.attemptRun(state);
                  onSync();
                }}
                className="p-2.5 rounded-xl bg-[#261419] border border-rose-500/45 hover:border-rose-400 text-sm font-bold text-rose-200 disabled:opacity-40 cursor-pointer min-h-[44px]"
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
              className="bt-btn-secondary p-3 rounded-xl border-emerald-500/45 text-left disabled:opacity-40 cursor-pointer min-h-[52px]"
            >
              <div className="text-sm font-bold text-white">Baya Subterránea ({state.inventory.berries})</div>
              <div className="text-xs text-slate-300">Restaura 32 PS al aliado activo</div>
            </button>

            <button
              disabled={!canAct || state.inventory.core <= 0}
              onClick={() => {
                combat.useItem(state, 'core');
                setSubMenu('main');
                onSync();
              }}
              className="bt-btn-secondary p-3 rounded-xl border-cyan-500/45 text-left disabled:opacity-40 cursor-pointer min-h-[52px]"
            >
              <div className="text-sm font-bold text-white">Núcleo de Energía ({state.inventory.core})</div>
              <div className="text-xs text-slate-300">Recarga +8 Energía</div>
            </button>

            <button
              disabled={!canAct || state.inventory.capsules <= 0 || battle.kind !== 'wild'}
              onClick={() => {
                combat.useItem(state, 'capsules');
                setSubMenu('main');
                onSync();
              }}
              className="bt-btn-secondary p-3 rounded-xl border-indigo-400/45 text-left disabled:opacity-40 cursor-pointer min-h-[52px]"
            >
              <div className="text-sm font-bold text-white">Cilindro de Captura ({state.inventory.capsules})</div>
              <div className="text-xs text-slate-300">Captura babosas salvajes</div>
            </button>

            <button
              disabled={!canAct || state.inventory.masterCapsules <= 0 || battle.kind !== 'wild'}
              onClick={() => {
                combat.useItem(state, 'masterCapsules');
                setSubMenu('main');
                onSync();
              }}
              className="bt-btn-secondary p-3 rounded-xl border-purple-400/50 text-left disabled:opacity-40 cursor-pointer min-h-[52px]"
            >
              <div className="text-sm font-bold text-white">Cilindro Maestro ({state.inventory.masterCapsules})</div>
              <div className="text-xs text-slate-300">Probabilidad muy alta de captura</div>
            </button>

            <button
              onClick={() => setSubMenu('main')}
              className="bt-btn-secondary sm:col-span-2 p-2.5 rounded-xl font-bold text-xs cursor-pointer min-h-[44px]"
            >
              Volver al menú principal
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
                className="bt-btn-secondary p-2.5 rounded-xl text-left disabled:opacity-40 cursor-pointer flex items-center gap-2.5 min-h-[56px]"
              >
                <SlugPortrait speciesId={s.id} mega={s.mega} mood={s.hp <= 0 ? 'ko' : 'idle'} size={40} />
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white truncate">
                    {s.name} {s.mega ? '★' : ''} (Nv.{s.level})
                  </div>
                  <div className="text-xs text-slate-300 tabular-nums">
                    {s.type} · PS {s.hp}/{s.maxHp} · EN {s.energy}/{s.maxEnergy}
                  </div>
                </div>
              </button>
            ))}
            <button
              onClick={() => setSubMenu('main')}
              className="bt-btn-secondary sm:col-span-2 p-2.5 rounded-xl font-bold text-xs cursor-pointer min-h-[44px]"
            >
              Volver al menú principal
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
