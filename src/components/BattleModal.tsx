import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Backpack,
  Crosshair,
  Shield,
  Sparkles,
  Swords,
  Zap,
} from 'lucide-react';
import { ARENA_HEIGHT, ARENA_WIDTH } from '../game/combatArenas';
import { CombatManager } from '../game/combat';
import { DuelArenaRenderer } from '../game/combatRenderer';
import { BIOME_INFO, ELEMENT_CHART, getElementMultiplier, getSpecies } from '../game/data';
import { getEffectiveMoveEnergyCost, getMoveMasteryInfo } from '../game/progression';
import { getSlugCombatProfile } from '../game/slugCombatProfiles';
import type { BattleState, BlasterShotMode, GameState } from '../game/types';
import { SlugPortrait, type SlugPortraitMood } from './SlugPortrait';

interface BattleModalProps {
  battle: BattleState;
  state: GameState;
  combat: CombatManager;
  onSync: () => void;
}

export const BattleModal: React.FC<BattleModalProps> = ({ battle, state, combat, onSync }) => {
  const [bagOpen, setBagOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<DuelArenaRenderer | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const upHeldRef = useRef(false);
  const downHeldRef = useRef(false);

  const ally = state.party[state.activePartyIndex] || state.party[0];
  const allySpecies = getSpecies(ally.id);
  const allyProfile = getSlugCombatProfile(allySpecies);
  const enemy = battle.enemy;
  const mult = getElementMultiplier(ally.type, enemy.type);
  const biomeInfo = BIOME_INFO[battle.biome] || BIOME_INFO.Verdes;

  const updateVerticalHold = useCallback(() => {
    const dir = upHeldRef.current && !downHeldRef.current ? -1 : downHeldRef.current && !upHeldRef.current ? 1 : 0;
    combat.setVerticalInput(dir);
  }, [combat]);

  const toArenaCoords = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: ARENA_WIDTH * 0.6, y: ARENA_HEIGHT * 0.5 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = ARENA_WIDTH / Math.max(1, rect.width);
    const scaleY = ARENA_HEIGHT / Math.max(1, rect.height);
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }, []);

  // 60fps Canvas Duel Loop + throttled React HUD sync
  useEffect(() => {
    if (!rendererRef.current) {
      rendererRef.current = new DuelArenaRenderer();
    }
    let rafId = 0;
    let lastTime = performance.now();
    let lastUiSync = lastTime;

    const frame = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      if (combat.battle && combat.battle.turn === 'duel') {
        combat.step(dt, state);
      }

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx && combat.battle && rendererRef.current) {
        rendererRef.current.render(ctx, combat.battle, state, combat, state.options);
      }

      if (now - lastUiSync >= 85) {
        lastUiSync = now;
        onSync();
      }
      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [combat, state, onSync]);

  const selectOrFireMode = useCallback(
    (mode: BlasterShotMode) => {
      if (!combat.battle || combat.battle.turn !== 'duel') return;
      if (combat.battle.selectedMode === mode && mode !== 'quick') {
        combat.fireBlasterShot(state, { charge: 0.78, modeOverride: mode });
        onSync();
        return;
      }
      combat.setSelectedMode(state, mode);
      onSync();
    },
    [combat, state, onSync]
  );

  // Stable keyboard controls (WASD/Arrows dodge, 1-4 switch slug, Z/X skills, Shift/F shield, R pulse, Space charge/fire)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!combat.battle || combat.battle.turn !== 'duel') return;
      const key = e.key.toLowerCase();

      if (key === 'w' || e.key === 'ArrowUp') {
        e.preventDefault();
        upHeldRef.current = true;
        updateVerticalHold();
      } else if (key === 's' || e.key === 'ArrowDown') {
        e.preventDefault();
        downHeldRef.current = true;
        updateVerticalHold();
      } else if (key === '1' || key === '2' || key === '3' || key === '4') {
        const idx = Number(key) - 1;
        if (state.party[idx]) {
          combat.swapSlug(state, idx);
          onSync();
        }
      } else if (key === 'q') {
        const len = state.party.length;
        if (len > 1) {
          for (let offset = 1; offset <= len; offset++) {
            const idx = (state.activePartyIndex - offset + len) % len;
            if (state.party[idx].hp > 0) {
              combat.swapSlug(state, idx);
              onSync();
              break;
            }
          }
        }
      } else if (key === 'e') {
        const len = state.party.length;
        if (len > 1) {
          for (let offset = 1; offset <= len; offset++) {
            const idx = (state.activePartyIndex + offset) % len;
            if (state.party[idx].hp > 0) {
              combat.swapSlug(state, idx);
              onSync();
              break;
            }
          }
        }
      } else if (key === 'z') {
        selectOrFireMode(0);
      } else if (key === 'x') {
        selectOrFireMode(1);
      } else if (key === 'r') {
        if (combat.battle.pulseWindowActive) {
          combat.fireBlasterShot(state, { charge: 0.8, modeOverride: 'pulse' });
          onSync();
        }
      } else if (key === 'f' || e.key === 'Shift') {
        e.preventDefault();
        combat.activateGuard(state);
        onSync();
      } else if (e.key === ' ') {
        e.preventDefault();
        if (!e.repeat) {
          combat.beginCharge(state);
        }
      }
    },
    [combat, state, onSync, selectOrFireMode, updateVerticalHold]
  );

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'w' || e.key === 'ArrowUp') {
        upHeldRef.current = false;
        updateVerticalHold();
      } else if (key === 's' || e.key === 'ArrowDown') {
        downHeldRef.current = false;
        updateVerticalHold();
      } else if (e.key === ' ') {
        if (combat.battle?.turn === 'duel' && combat.battle.playerDuelist.charging) {
          combat.releaseChargeAndFire(state);
          onSync();
        }
      }
    },
    [combat, state, onSync, updateVerticalHold]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      combat.setVerticalInput(0);
    };
  }, [handleKeyDown, handleKeyUp, combat]);

  const canAct = battle.turn === 'duel';

  const lastAllyEf = battle.effects.filter((ef) => ef.target === 'ally').slice(-1)[0];
  const lastEnemyEf = battle.effects.filter((ef) => ef.target === 'enemy').slice(-1)[0];

  const allyMood: SlugPortraitMood =
    ally.hp <= 0
      ? 'ko'
      : battle.playerDuelist.hitFlash > 0
      ? 'hit'
      : lastAllyEf?.kind === 'heal' || battle.playerDuelist.guardTimer > 0
      ? 'happy'
      : battle.playerDuelist.charging
      ? 'attack'
      : 'idle';

  const enemyMood: SlugPortraitMood =
    enemy.hp <= 0
      ? 'ko'
      : battle.enemyDuelist.hitFlash > 0
      ? 'hit'
      : enemy.telegraphing === 'heavy'
      ? 'attack'
      : 'idle';

  const allyHpPct = Math.max(0, Math.min(100, (ally.hp / Math.max(1, ally.maxHp)) * 100));
  const allyEnPct = Math.max(0, Math.min(100, (ally.energy / Math.max(1, ally.maxEnergy)) * 100));
  const enemyHpPct = Math.max(0, Math.min(100, (enemy.hp / Math.max(1, enemy.maxHp)) * 100));
  const guardCd = battle.playerDuelist.guardCooldown;
  const chargePct = Math.round(battle.playerDuelist.charge * 100);
  const inSweetSpot = battle.playerDuelist.charge >= 0.62 && battle.playerDuelist.charge <= 0.88;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-1.5 sm:p-4 bg-[#03080e]/90 backdrop-blur-sm">
      <div className="bt-panel bt-animate-modal w-full max-w-4xl rounded-2xl p-2.5 sm:p-4 max-h-[97dvh] overflow-y-auto bt-scroll">
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-400/20 pb-2 mb-2.5">
          <div>
            <h2 className="text-sm sm:text-lg font-extrabold text-white flex items-center gap-2 tracking-tight">
              <Swords className="w-4 h-4 sm:w-5 sm:h-5 text-teal-300" />
              Duelo de Blásteres · Bajoterra
            </h2>
            <p className="text-[11px] text-slate-300">
              {battle.subtitle} · <span style={{ color: biomeInfo.accent }}>{biomeInfo.name}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-[11px] font-extrabold px-2.5 py-1 rounded-lg bt-inset">
              <span style={{ color: mult > 1.2 ? '#4ade80' : mult < 0.9 ? '#f87171' : '#cbd5e1' }}>
                {mult > 1.2 ? 'Ventaja ×1.75' : mult < 0.9 ? 'Desventaja ×0.65' : 'Afinidad ×1.0'}
              </span>
            </div>
            {battle.pulseWindowActive && canAct && (
              <button
                onClick={() => {
                  combat.fireBlasterShot(state, { charge: 0.8, modeOverride: 'pulse' });
                  onSync();
                }}
                className="bt-btn-primary px-3 py-1.5 rounded-lg font-extrabold text-xs cursor-pointer flex items-center gap-1"
              >
                <Zap className="w-3.5 h-3.5" />
                Pulso [R]
              </button>
            )}
          </div>
        </div>

        {/* Dualist Status Strip */}
        <div className="grid grid-cols-2 gap-2 mb-2.5">
          {/* Player Slug Status */}
          <div className="bt-card rounded-xl p-2 sm:p-2.5 border-teal-400/35 flex items-center gap-2.5">
            <SlugPortrait speciesId={ally.id} mega={ally.mega} mood={allyMood} size={46} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs sm:text-sm font-extrabold text-white truncate">
                  {ally.name} {ally.mega ? '★' : ''}
                </span>
                <span className="text-[10px] font-bold text-slate-300 shrink-0">Nv.{ally.level}</span>
              </div>
              <div className="h-2 bg-[#060d14] rounded-full overflow-hidden mt-1 mb-1">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-300 transition-all duration-100"
                  style={{ width: `${allyHpPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-300 tabular-nums">
                <span>PS {ally.hp}/{ally.maxHp}</span>
                <span className="text-cyan-300 font-bold">
                  EN {Math.floor(ally.energy)}/{ally.maxEnergy}
                </span>
              </div>
              <div className="h-1.5 bg-[#060d14] rounded-full overflow-hidden mt-0.5">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-sky-300 transition-all duration-100"
                  style={{ width: `${allyEnPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Enemy Status */}
          <div
            className={`bt-card rounded-xl p-2 sm:p-2.5 flex items-center gap-2.5 ${
              enemy.telegraphing === 'heavy' ? 'border-amber-400' : 'border-rose-400/40'
            }`}
          >
            <div className="min-w-0 flex-1 text-right">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold text-slate-300 shrink-0">Nv.{enemy.level}</span>
                <span className="text-xs sm:text-sm font-extrabold text-white truncate">
                  {enemy.name} {enemy.isBoss ? '· JEFE' : ''}
                </span>
              </div>
              <div className="h-2 bg-[#060d14] rounded-full overflow-hidden mt-1 mb-1">
                <div
                  className="h-full bg-gradient-to-r from-rose-500 to-orange-400 transition-all duration-100 ml-auto"
                  style={{ width: `${enemyHpPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-300 tabular-nums">
                <span className="text-amber-200 truncate">
                  {(enemy.burnTimer || 0) > 0 && '🔥 '}
                  {(enemy.chillTimer || 0) > 0 && '❄️ '}
                  {(enemy.stunTimer || 0) > 0 && '⚡ '}
                  {(enemy.shieldTimer || 0) > 0 && '🛡 '}
                  {enemy.telegraphing === 'heavy' ? '⚠ CARGANDO' : enemy.type}
                </span>
                <span>PS {enemy.hp}/{enemy.maxHp}</span>
              </div>
              <div className="text-[10px] text-teal-300 font-bold mt-0.5">
                Pulso: {Math.round(battle.pulseCharge)}%
              </div>
            </div>
            <SlugPortrait speciesId={enemy.id} mega={enemy.mega} mood={enemyMood} size={46} flipX />
          </div>
        </div>

        {/* Interactive 2D Blaster Duel Arena Canvas */}
        <div className="relative rounded-xl border border-cyan-400/35 overflow-hidden bg-[#050a12] mb-2.5 select-none">
          <canvas
            ref={canvasRef}
            width={ARENA_WIDTH}
            height={ARENA_HEIGHT}
            className="w-full h-auto block cursor-crosshair touch-none"
            onContextMenu={(e) => {
              e.preventDefault();
              combat.activateGuard(state);
              onSync();
            }}
            onPointerDown={(e) => {
              if (!canAct || e.button === 2) return;
              activePointerIdRef.current = e.pointerId;
              e.currentTarget.setPointerCapture?.(e.pointerId);
              const pt = toArenaCoords(e.clientX, e.clientY);
              combat.aimAtArenaPoint(pt.x, pt.y);
              combat.beginCharge(state);
            }}
            onPointerMove={(e) => {
              if (!canAct) return;
              const pt = toArenaCoords(e.clientX, e.clientY);
              combat.aimAtArenaPoint(pt.x, pt.y);
            }}
            onPointerUp={(e) => {
              if (activePointerIdRef.current === e.pointerId) {
                activePointerIdRef.current = null;
              }
              if (canAct && combat.battle?.playerDuelist.charging) {
                const pt = toArenaCoords(e.clientX, e.clientY);
                combat.aimAtArenaPoint(pt.x, pt.y);
                combat.releaseChargeAndFire(state);
                onSync();
              }
            }}
            onPointerCancel={() => {
              activePointerIdRef.current = null;
              if (combat.battle?.playerDuelist.charging) {
                combat.releaseChargeAndFire(state);
                onSync();
              }
            }}
          />

          {/* Bottom-left live charge gauge overlay (minimal, never obstructs lanes) */}
          {canAct && (
            <div className="pointer-events-none absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between gap-2 text-[11px]">
              <div className="bg-[#06101b]/85 border border-cyan-400/30 rounded-lg px-2.5 py-1 flex items-center gap-2">
                <Crosshair className="w-3.5 h-3.5 text-teal-300" />
                <span className="text-slate-200 font-bold">
                  {allySpecies.name} · {allyProfile.roleLabel}
                </span>
                {battle.playerDuelist.charging && (
                  <span className={`font-extrabold ${inSweetSpot ? 'text-amber-300' : 'text-teal-300'}`}>
                    Carga {chargePct}% {inSweetSpot ? '★ Zona Maestra' : ''}
                  </span>
                )}
              </div>
              <div className="hidden sm:block bg-[#06101b]/85 border border-white/10 rounded-lg px-2.5 py-1 text-slate-300">
                Apunta y mantén clic / Espacio para lanzar · W/S esquivar · Clic derecho Escudo
              </div>
            </div>
          )}
        </div>

        {/* Ended Outcome Banner OR Live Blaster Controls */}
        {battle.turn === 'ended' ? (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bt-card border-teal-400/50 rounded-xl p-3.5">
            <div>
              <div className="text-sm font-extrabold text-teal-100">{battle.rewardText}</div>
              {battle.log[1] && <div className="text-xs text-slate-300 mt-0.5">{battle.log[1]}</div>}
            </div>
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
        ) : (
          <div className="space-y-2">
            {/* Bandolier Chambers (1-4) + Mobile Dodge Pad */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 flex-1">
                {state.party.map((s, idx) => {
                  const isActive = idx === state.activePartyIndex;
                  const sHpPct = Math.max(0, Math.min(100, (s.hp / Math.max(1, s.maxHp)) * 100));
                  return (
                    <button
                      key={s.uid}
                      disabled={!canAct || s.hp <= 0}
                      onClick={() => {
                        combat.swapSlug(state, idx);
                        onSync();
                      }}
                      className={`p-1.5 rounded-xl border text-left transition-all flex items-center gap-2 min-h-[48px] cursor-pointer disabled:opacity-40 ${
                        isActive
                          ? 'bg-teal-950/60 border-teal-300 shadow-[0_0_12px_rgba(45,212,191,0.25)]'
                          : 'bt-btn-secondary border-slate-700/80'
                      }`}
                    >
                      <SlugPortrait speciesId={s.id} mega={s.mega} mood={s.hp <= 0 ? 'ko' : 'idle'} size={30} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-extrabold text-white truncate">
                          [{idx + 1}] {s.name}
                        </div>
                        <div className="h-1.5 bg-[#050b12] rounded-full overflow-hidden mt-0.5">
                          <div className="h-full bg-emerald-400" style={{ width: `${sHpPct}%` }} />
                        </div>
                        <div className="text-[9px] text-cyan-300 tabular-nums mt-0.5">
                          EN {Math.floor(s.energy)}/{s.maxEnergy}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Touch-friendly vertical dodge controls */}
              <div className="flex sm:flex-col gap-1">
                <button
                  onPointerDown={() => combat.setVerticalInput(-1)}
                  onPointerUp={() => combat.setVerticalInput(0)}
                  onPointerLeave={() => combat.setVerticalInput(0)}
                  onClick={() => combat.moveDuelistStep(-30)}
                  className="bt-btn-secondary px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 min-h-[34px] cursor-pointer"
                  aria-label="Mover bláster arriba"
                >
                  <ArrowUp className="w-3.5 h-3.5 text-cyan-300" />
                  Subir
                </button>
                <button
                  onPointerDown={() => combat.setVerticalInput(1)}
                  onPointerUp={() => combat.setVerticalInput(0)}
                  onPointerLeave={() => combat.setVerticalInput(0)}
                  onClick={() => combat.moveDuelistStep(30)}
                  className="bt-btn-secondary px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 min-h-[34px] cursor-pointer"
                  aria-label="Mover bláster abajo"
                >
                  <ArrowDown className="w-3.5 h-3.5 text-cyan-300" />
                  Bajar
                </button>
              </div>
            </div>

            {/* Shot Mode & Tactical Actions */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
              <button
                disabled={!canAct}
                onPointerDown={() => {
                  combat.setSelectedMode(state, 'quick');
                  combat.beginCharge(state);
                }}
                onPointerUp={() => {
                  if (combat.battle?.playerDuelist.charging) {
                    combat.releaseChargeAndFire(state);
                    onSync();
                  }
                }}
                className={`p-2.5 rounded-xl border text-left cursor-pointer min-h-[54px] ${
                  battle.selectedMode === 'quick'
                    ? 'bg-cyan-950/60 border-cyan-300'
                    : 'bt-btn-secondary border-cyan-400/35'
                }`}
              >
                <div className="text-xs font-extrabold text-white flex items-center gap-1">
                  <Crosshair className="w-3.5 h-3.5 text-cyan-300" />
                  Disparo Rápido
                </div>
                <div className="text-[10px] text-slate-300 mt-0.5">0 EN · +2 EN al golpear</div>
              </button>

              {allySpecies.specialMoves.map((mv, i) => {
                const idx = i as 0 | 1;
                const cd = combat.getMoveCooldown(ally, mv.id);
                const masteryPts = ally.moveMastery?.[idx] ?? 0;
                const masteryInfo = getMoveMasteryInfo(masteryPts);
                const effectiveCost = getEffectiveMoveEnergyCost(mv.energyCost, masteryPts);
                const selected = battle.selectedMode === idx;
                const locked = !canAct || cd > 0 || ally.energy < effectiveCost;
                return (
                  <button
                    key={mv.id}
                    disabled={locked}
                    onClick={() => selectOrFireMode(idx)}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer disabled:opacity-40 min-h-[54px] ${
                      selected
                        ? 'bg-indigo-950/70 border-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.25)]'
                        : 'bt-btn-secondary border-indigo-400/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 text-xs font-extrabold text-white">
                      <span className="truncate flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-300 shrink-0" />
                        [{idx === 0 ? 'Z' : 'X'}] {mv.name}
                      </span>
                      <span className="text-[10px] text-teal-300 shrink-0 tabular-nums">
                        {cd > 0 ? `${cd.toFixed(1)}s` : `${effectiveCost}EN`}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-300 mt-0.5 truncate">
                      {selected ? 'Cargado: dispara en arena o clic aquí' : mv.description}
                      {masteryInfo.rank > 0 ? ` · ${masteryInfo.label}` : ''}
                    </div>
                  </button>
                );
              })}

              <button
                disabled={!canAct || guardCd > 0}
                onClick={() => {
                  combat.activateGuard(state);
                  onSync();
                }}
                className="bt-btn-secondary p-2.5 rounded-xl border-sky-400/40 text-left cursor-pointer disabled:opacity-40 min-h-[54px]"
              >
                <div className="flex items-center justify-between text-xs font-extrabold text-white">
                  <span className="flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5 text-sky-300" />
                    Escudo [F]
                  </span>
                  {guardCd > 0 && <span className="text-[10px] text-sky-300">{guardCd.toFixed(1)}s</span>}
                </div>
                <div className="text-[10px] text-slate-300 mt-0.5">Bloquea impacto · +2 EN</div>
              </button>

              <button
                disabled={!canAct}
                onClick={() => setBagOpen((v) => !v)}
                className="bt-btn-secondary p-2.5 rounded-xl border-amber-400/40 text-left cursor-pointer min-h-[54px]"
              >
                <div className="text-xs font-extrabold text-amber-200 flex items-center gap-1">
                  <Backpack className="w-3.5 h-3.5 text-amber-300" />
                  Mochila y Captura
                </div>
                <div className="text-[10px] text-slate-300 mt-0.5">
                  Cilindros {state.inventory.capsules + state.inventory.masterCapsules} · Bayas {state.inventory.berries}
                </div>
              </button>

              <button
                disabled={!canAct || battle.kind === 'boss'}
                onClick={() => {
                  combat.attemptRun(state);
                  onSync();
                }}
                className="p-2.5 rounded-xl bg-[#261419] border border-rose-500/45 hover:border-rose-400 text-xs font-bold text-rose-200 disabled:opacity-40 cursor-pointer min-h-[54px]"
              >
                Retirarse
              </button>
            </div>

            {/* Expandable Bag / Capture Drawer */}
            {bagOpen && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <button
                  disabled={!canAct || state.inventory.berries <= 0}
                  onClick={() => {
                    combat.useItem(state, 'berries');
                    setBagOpen(false);
                    onSync();
                  }}
                  className="bt-btn-secondary p-2.5 rounded-xl border-emerald-500/40 text-left disabled:opacity-40 cursor-pointer"
                >
                  <div className="text-xs font-bold text-white">Baya ({state.inventory.berries})</div>
                  <div className="text-[10px] text-slate-300">+34 PS al aliado</div>
                </button>
                <button
                  disabled={!canAct || state.inventory.core <= 0}
                  onClick={() => {
                    combat.useItem(state, 'core');
                    setBagOpen(false);
                    onSync();
                  }}
                  className="bt-btn-secondary p-2.5 rounded-xl border-cyan-500/40 text-left disabled:opacity-40 cursor-pointer"
                >
                  <div className="text-xs font-bold text-white">Núcleo ({state.inventory.core})</div>
                  <div className="text-[10px] text-slate-300">+8 Energía al instante</div>
                </button>
                <button
                  disabled={!canAct || state.inventory.capsules <= 0 || battle.kind !== 'wild'}
                  onClick={() => {
                    combat.useItem(state, 'capsules');
                    setBagOpen(false);
                    onSync();
                  }}
                  className="bt-btn-secondary p-2.5 rounded-xl border-indigo-400/40 text-left disabled:opacity-40 cursor-pointer"
                >
                  <div className="text-xs font-bold text-white">Cilindro ({state.inventory.capsules})</div>
                  <div className="text-[10px] text-slate-300">Lanza cápsula física</div>
                </button>
                <button
                  disabled={!canAct || state.inventory.masterCapsules <= 0 || battle.kind !== 'wild'}
                  onClick={() => {
                    combat.useItem(state, 'masterCapsules');
                    setBagOpen(false);
                    onSync();
                  }}
                  className="bt-btn-secondary p-2.5 rounded-xl border-purple-400/50 text-left disabled:opacity-40 cursor-pointer"
                >
                  <div className="text-xs font-bold text-white">Maestro ({state.inventory.masterCapsules})</div>
                  <div className="text-[10px] text-slate-300">Alta tasa de captura</div>
                </button>
              </div>
            )}

            {/* Concise Live Duel Feed */}
            <div className="bt-inset rounded-xl px-3 py-2 text-xs text-slate-200 flex items-center justify-between gap-2">
              <span className="truncate font-semibold">{battle.log[0]}</span>
              {battle.log[1] && <span className="text-[11px] text-slate-400 hidden md:inline truncate">{battle.log[1]}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
