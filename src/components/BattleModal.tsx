import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Backpack,
  Crosshair,
  Heart,
  MoreHorizontal,
  Shield,
  Sparkles,
  Swords,
  Target,
  X,
  Zap,
} from 'lucide-react';
import { ARENA_HEIGHT, ARENA_WIDTH } from '../game/combatArenas';
import { CombatManager } from '../game/combat';
import { DuelArenaRenderer } from '../game/combatRenderer';
import { BIOME_INFO, getElementMultiplier, getSpecies } from '../game/data';
import { getEffectiveMoveEnergyCost, getMoveMasteryInfo } from '../game/progression';
import { getSlugCombatProfile } from '../game/slugCombatProfiles';
import type { BattleState, BlasterShotMode, GameState } from '../game/types';
import { SlugColumn } from './SlugColumn';
import { SlugPortrait, type SlugPortraitMood } from './SlugPortrait';

interface BattleModalProps {
  battle: BattleState;
  state: GameState;
  combat: CombatManager;
  introPaused?: boolean;
  reducedMotion?: boolean;
  onSync: () => void;
}

function isEditableEventTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as { tagName?: string; isContentEditable?: boolean };
  const tag = el.tagName?.toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || Boolean(el.isContentEditable);
}

const MOVE_KEYS = new Set([
  'w',
  'a',
  's',
  'd',
  'arrowup',
  'arrowdown',
  'arrowleft',
  'arrowright',
]);

export const BattleModal: React.FC<BattleModalProps> = ({
  battle,
  state,
  combat,
  introPaused = false,
  reducedMotion,
  onSync,
}) => {
  const effectiveReduced = Boolean(reducedMotion ?? state.options.reducedMotion);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [joyNub, setJoyNub] = useState({ x: 0, y: 0 });
  const [aimNub, setAimNub] = useState({ x: 0, y: 0, active: false });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<DuelArenaRenderer | null>(null);
  const joyRef = useRef<HTMLDivElement | null>(null);
  const aimPadRef = useRef<HTMLDivElement | null>(null);

  const canvasPointerIdRef = useRef<number | null>(null);
  const joyPointerIdRef = useRef<number | null>(null);
  const aimPointerIdRef = useRef<number | null>(null);
  const aimDraggedRef = useRef(false);

  const heldMoveKeysRef = useRef<Set<string>>(new Set());

  const ally = state.party[state.activePartyIndex] || state.party[0];
  const allySpecies = getSpecies(ally.id);
  const allyProfile = getSlugCombatProfile(allySpecies);
  const enemy = battle.enemy;
  const mult = getElementMultiplier(ally.type, enemy.type);
  const biomeInfo = BIOME_INFO[battle.biome] || BIOME_INFO.Verdes;

  useEffect(() => {
    const check = () => {
      const coarse =
        window.matchMedia('(pointer: coarse)').matches ||
        window.innerWidth < 920 ||
        navigator.maxTouchPoints > 0;
      setIsTouchDevice(coarse);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const showTouch =
    state.options.touchControls === 'on' ||
    (state.options.touchControls === 'auto' && isTouchDevice);

  const updateKeyboardMove = useCallback(() => {
    const held = heldMoveKeysRef.current;
    const up = held.has('w') || held.has('arrowup');
    const down = held.has('s') || held.has('arrowdown');
    const left = held.has('a') || held.has('arrowleft');
    const right = held.has('d') || held.has('arrowright');
    const dx = (right ? 1 : 0) - (left ? 1 : 0);
    const dy = (down ? 1 : 0) - (up ? 1 : 0);
    combat.setMoveInput(dx, dy);
  }, [combat]);

  const clearAllInputs = useCallback(() => {
    heldMoveKeysRef.current.clear();
    joyPointerIdRef.current = null;
    aimPointerIdRef.current = null;
    canvasPointerIdRef.current = null;
    aimDraggedRef.current = false;
    setJoyNub({ x: 0, y: 0 });
    setAimNub({ x: 0, y: 0, active: false });
    if (combat.battle?.playerDuelist.charging) {
      combat.battle.playerDuelist.charging = false;
      combat.battle.playerDuelist.charge = 0;
    }
    combat.setMoveInput(0, 0);
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

      if (combat.battle) {
        if (combat.battle.turn === 'duel') {
          if (!introPaused) {
            combat.step(dt, state);
          }
        } else {
          combat.stepEndedVisuals(dt);
        }
      }

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx && combat.battle && rendererRef.current) {
        rendererRef.current.render(ctx, combat.battle, state, combat, state.options);
      }

      if (now - lastUiSync >= 80) {
        lastUiSync = now;
        onSync();
      }
      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [combat, introPaused, state, onSync]);

  const selectOrFireMode = useCallback(
    (mode: BlasterShotMode) => {
      if (!combat.battle || combat.battle.turn !== 'duel') return;
      if (combat.battle.selectedMode === mode && mode !== 'quick') {
        combat.fireBlasterShot(state, { charge: 0.78, modeOverride: mode });
        setActionsOpen(false);
        onSync();
        return;
      }
      combat.setSelectedMode(state, mode);
      setActionsOpen(false);
      onSync();
    },
    [combat, state, onSync]
  );

  // Full 2D keyboard controls (WASD / Arrows move, 1-4 or Q/E switch, Z/X skills, F/Shift contextual, R pulse, Space charge/fire)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!combat.battle || introPaused || isEditableEventTarget(e.target)) return;
      if (e.key === 'Escape' && actionsOpen) {
        e.preventDefault();
        setActionsOpen(false);
        return;
      }
      if (combat.battle.turn !== 'duel') return;
      const key = e.key.toLowerCase();

      if (MOVE_KEYS.has(key)) {
        e.preventDefault();
        if (!heldMoveKeysRef.current.has(key)) {
          heldMoveKeysRef.current.add(key);
          updateKeyboardMove();
        }
      } else if (key === '1' || key === '2' || key === '3' || key === '4') {
        const idx = Number(key) - 1;
        if (state.party[idx]) {
          combat.swapSlug(state, idx);
          onSync();
        }
      } else if (key === 'q') {
        if (combat.cycleSlug(state, -1)) onSync();
      } else if (key === 'e') {
        if (combat.cycleSlug(state, 1)) onSync();
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
        combat.triggerContextualAction(state);
        onSync();
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) {
          combat.beginCharge(state);
        }
      }
    },
    [actionsOpen, combat, introPaused, state, onSync, selectOrFireMode, updateKeyboardMove]
  );

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (MOVE_KEYS.has(key)) {
        if (heldMoveKeysRef.current.delete(key)) {
          updateKeyboardMove();
        }
        return;
      }
      if (isEditableEventTarget(e.target)) return;
      if (e.key === ' ' || e.code === 'Space') {
        if (combat.battle?.turn === 'duel' && combat.battle.playerDuelist.charging) {
          combat.releaseChargeAndFire(state);
          onSync();
        }
      }
    },
    [combat, state, onSync, updateKeyboardMove]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      combat.setMoveInput(0, 0);
    };
  }, [handleKeyDown, handleKeyUp, combat]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        clearAllInputs();
      }
    };
    window.addEventListener('blur', clearAllInputs);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('blur', clearAllInputs);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearAllInputs();
    };
  }, [clearAllInputs]);

  useEffect(() => {
    if (battle.turn !== 'duel') {
      clearAllInputs();
    }
  }, [battle.turn, clearAllInputs]);

  // Left-side Virtual Joystick handlers
  const updateJoystick = (clientX: number, clientY: number) => {
    const el = joyRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let dx = clientX - (rect.left + rect.width / 2);
    let dy = clientY - (rect.top + rect.height / 2);
    const maxR = Math.max(28, rect.width * 0.34);
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    setJoyNub({ x: dx, y: dy });
    if (dist < 4) {
      combat.setMoveInput(0, 0);
    } else {
      combat.setMoveInput(dx / maxR, dy / maxR);
    }
  };

  const resetJoystick = () => {
    joyPointerIdRef.current = null;
    setJoyNub({ x: 0, y: 0 });
    combat.setMoveInput(0, 0);
  };

  // Right-side Aim & Charge/Fire Pad handlers
  const updateAimPad = (clientX: number, clientY: number, isInitial: boolean) => {
    const el = aimPadRef.current;
    if (!el || !combat.battle) return;
    const rect = el.getBoundingClientRect();
    let dx = clientX - (rect.left + rect.width / 2);
    let dy = clientY - (rect.top + rect.height / 2);
    const maxR = Math.max(28, rect.width * 0.36);
    const dist = Math.hypot(dx, dy);

    if (dist >= 10) {
      aimDraggedRef.current = true;
      combat.setAimAngle(Math.atan2(dy, dx));
    } else if (isInitial && !aimDraggedRef.current) {
      const ed = combat.battle.enemyDuelist;
      combat.aimAtArenaPoint(ed.x, ed.y - 16);
    }

    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    setAimNub({ x: dx, y: dy, active: true });
  };

  const releaseAimPad = (shouldFire: boolean) => {
    aimPointerIdRef.current = null;
    aimDraggedRef.current = false;
    setAimNub({ x: 0, y: 0, active: false });
    if (shouldFire && combat.battle?.turn === 'duel' && combat.battle.playerDuelist.charging) {
      combat.releaseChargeAndFire(state);
      onSync();
    }
  };

  const canAct = battle.turn === 'duel';

  const lastAllyEf = battle.effects.filter((ef) => ef.target === 'ally').slice(-1)[0];
  const wonBattle = battle.turn === 'ended' && (battle.outcome === 'victory' || battle.outcome === 'captured');
  const allyTransforming = battle.projectiles.some(
    (p) =>
      p.owner === 'ally' &&
      p.speciesId === ally.id &&
      p.mode !== 'capsule' &&
      (p.phase === 'transforming' || p.phase === 'transformed')
  );
  const enemyTransforming = battle.projectiles.some(
    (p) =>
      p.owner === 'enemy' &&
      p.speciesId === enemy.id &&
      p.mode !== 'capsule' &&
      (p.phase === 'transforming' || p.phase === 'transformed')
  );

  const allyMood: SlugPortraitMood =
    ally.hp <= 0
      ? 'ko'
      : wonBattle
      ? 'victory'
      : battle.playerDuelist.hitFlash > 0
      ? 'hit'
      : allyTransforming
      ? 'transform'
      : battle.playerDuelist.recoil > 0.04
      ? 'fire'
      : battle.playerDuelist.charging
      ? 'charge'
      : lastAllyEf?.kind === 'heal' || battle.playerDuelist.guardTimer > 0
      ? 'happy'
      : 'idle';

  const enemyMood: SlugPortraitMood =
    enemy.hp <= 0 || wonBattle
      ? 'ko'
      : battle.turn === 'ended' && battle.outcome === 'defeat'
      ? 'victory'
      : battle.enemyDuelist.hitFlash > 0
      ? 'hit'
      : enemyTransforming
      ? 'transform'
      : battle.enemyDuelist.recoil > 0.04
      ? 'attack'
      : enemy.telegraphing === 'heavy'
      ? 'charge'
      : 'idle';

  const allyFlameBurst =
    !effectiveReduced &&
    ally.id === 'infurnus' &&
    (allyMood === 'transform' || allyMood === 'fire');
  const enemyFlameBurst =
    !effectiveReduced &&
    enemy.id === 'infurnus' &&
    enemyMood === 'transform';

  const allyHpPct = Math.max(0, Math.min(100, (ally.hp / Math.max(1, ally.maxHp)) * 100));
  const allyEnPct = Math.max(0, Math.min(100, (ally.energy / Math.max(1, ally.maxEnergy)) * 100));
  const enemyHpPct = Math.max(0, Math.min(100, (enemy.hp / Math.max(1, enemy.maxHp)) * 100));
  const pulsePct = Math.max(0, Math.min(100, battle.pulseCharge));
  const guardCd = battle.playerDuelist.guardCooldown;
  const chargeVal = battle.playerDuelist.charge;
  const chargeTier = combat.getChargeTierInfo(state);
  const contextual = combat.getContextualAction(state);
  const totalBagItems =
    state.inventory.berries +
    state.inventory.core +
    state.inventory.capsules +
    state.inventory.masterCapsules;

  return (
    <div
      className="fixed inset-0 z-30 flex flex-col bg-[#040910] select-none overflow-hidden"
      style={{
        paddingTop: 'max(0.35rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.4rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(0.4rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.4rem, env(safe-area-inset-right))',
      }}
    >
      {/* ZONE 1: TOP STATUS HEADER (Compact, uncluttered, zero arena overlap) */}
      <header className="w-full max-w-5xl mx-auto shrink-0 flex flex-col gap-1 pb-1.5">
        <div className="grid grid-cols-2 gap-1.5 sm:gap-2.5">
          {/* Ally Status */}
          <div className="bt-hud-panel rounded-xl px-2 py-1.5 sm:px-3 sm:py-2 border-teal-400/35 flex items-center gap-2">
            <div className="relative shrink-0 flex items-center justify-center">
              <SlugPortrait
                speciesId={ally.id}
                mega={ally.mega}
                mood={allyMood}
                size={40}
                animated={!effectiveReduced}
              />
              {allyFlameBurst && (
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-visible">
                  <span className="bt-part-flame-burst absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-amber-300 shadow-[0_0_8px_#f97316]" />
                  <span
                    className="bt-part-flame-burst absolute top-1 -left-1 w-1.5 h-1.5 rounded-full bg-orange-400 shadow-[0_0_6px_#ef4444]"
                    style={{ animationDelay: '120ms' }}
                  />
                  <span
                    className="bt-part-flame-burst absolute top-1 -right-1 w-1.5 h-1.5 rounded-full bg-yellow-200 shadow-[0_0_6px_#fb923c]"
                    style={{ animationDelay: '220ms' }}
                  />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs sm:text-sm font-extrabold text-white truncate">
                  {ally.name} {ally.mega ? '★' : ''}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <span
                    className="text-[9px] sm:text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-[#060d14]/80"
                    style={{ color: mult > 1.2 ? '#4ade80' : mult < 0.9 ? '#f87171' : '#94a3b8' }}
                  >
                    {mult > 1.2 ? '×1.75' : mult < 0.9 ? '×0.65' : '×1.0'}
                  </span>
                  <span className="text-[10px] font-bold text-slate-300 tabular-nums">Nv.{ally.level}</span>
                </div>
              </div>

              <div className="h-2 bg-[#050b12] rounded-full overflow-hidden mt-1">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-300 transition-all duration-100"
                  style={{ width: `${allyHpPct}%` }}
                />
              </div>

              <div className="flex items-center justify-between gap-1.5 mt-1">
                <div className="flex-1 h-1.5 bg-[#050b12] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-sky-300 transition-all duration-100"
                    style={{ width: `${allyEnPct}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-200 tabular-nums font-bold shrink-0">
                  {ally.hp}/{ally.maxHp} · <span className="text-cyan-300">{Math.floor(ally.energy)}EN</span>
                </span>
              </div>

              {(battle.allyStatus.shieldTimer > 0 ||
                battle.playerDuelist.guardTimer > 0 ||
                battle.allyStatus.burnTimer > 0 ||
                battle.allyStatus.chillTimer > 0 ||
                battle.allyStatus.stunTimer > 0) && (
                <div className="flex items-center gap-1.5 text-[10px] mt-0.5 font-bold">
                  {(battle.allyStatus.shieldTimer > 0 || battle.playerDuelist.guardTimer > 0) && (
                    <span className="text-sky-300">🛡 Escudo</span>
                  )}
                  {battle.allyStatus.burnTimer > 0 && <span className="text-orange-300">🔥</span>}
                  {battle.allyStatus.chillTimer > 0 && <span className="text-cyan-200">❄️</span>}
                  {battle.allyStatus.stunTimer > 0 && <span className="text-yellow-300">⚡</span>}
                </div>
              )}
            </div>
          </div>

          {/* Enemy Status */}
          <div
            className={`bt-hud-panel rounded-xl px-2 py-1.5 sm:px-3 sm:py-2 flex items-center gap-2 ${
              enemy.telegraphing === 'heavy' ? 'border-amber-400' : 'border-rose-400/40'
            }`}
          >
            <div className="min-w-0 flex-1 text-right">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold text-slate-300 tabular-nums shrink-0">
                  Nv.{enemy.level}
                </span>
                <span className="text-xs sm:text-sm font-extrabold text-white truncate">
                  {enemy.name} {enemy.isBoss ? '· JEFE' : ''}
                </span>
              </div>

              <div className="h-2 bg-[#050b12] rounded-full overflow-hidden mt-1">
                <div
                  className="h-full bg-gradient-to-r from-rose-500 to-orange-400 transition-all duration-100 ml-auto"
                  style={{ width: `${enemyHpPct}%` }}
                />
              </div>

              <div className="flex items-center justify-between gap-1.5 mt-1 text-[10px] tabular-nums">
                <span className="text-amber-200 truncate font-bold">
                  {(enemy.burnTimer || 0) > 0 && '🔥 '}
                  {(enemy.chillTimer || 0) > 0 && '❄️ '}
                  {(enemy.stunTimer || 0) > 0 && '⚡ '}
                  {(enemy.shieldTimer || 0) > 0 && '🛡 '}
                  {enemy.telegraphing === 'heavy' ? '⚠ CARGANDO' : enemy.type}
                </span>
                <span className="text-slate-200 font-bold shrink-0">
                  {enemy.hp}/{enemy.maxHp}
                </span>
              </div>

              {/* Pulse Meter / Ready Trigger */}
              <div className="flex items-center justify-end gap-1.5 mt-0.5">
                {battle.pulseWindowActive && canAct ? (
                  <button
                    onClick={() => {
                      combat.fireBlasterShot(state, { charge: 0.82, modeOverride: 'pulse' });
                      onSync();
                    }}
                    className="bt-btn-primary px-2 py-0.5 rounded text-[10px] font-extrabold flex items-center gap-1 cursor-pointer"
                  >
                    <Zap className="w-3 h-3" />
                    ¡Pulso listo! [R]
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 w-full">
                    <span className="text-[9px] text-teal-300 font-bold shrink-0">
                      Pulso {Math.round(pulsePct)}%
                    </span>
                    <div className="flex-1 h-1 bg-[#050b12] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-teal-500 to-cyan-300 transition-all duration-150"
                        style={{ width: `${pulsePct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="relative shrink-0 flex items-center justify-center">
              <SlugPortrait
                speciesId={enemy.id}
                mega={enemy.mega}
                mood={enemyMood}
                size={40}
                flipX
                animated={!effectiveReduced}
              />
              {enemyFlameBurst && (
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-visible">
                  <span className="bt-part-flame-burst absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-amber-300 shadow-[0_0_8px_#f97316]" />
                  <span
                    className="bt-part-flame-burst absolute top-1 -left-1 w-1.5 h-1.5 rounded-full bg-orange-400 shadow-[0_0_6px_#ef4444]"
                    style={{ animationDelay: '120ms' }}
                  />
                  <span
                    className="bt-part-flame-burst absolute top-1 -right-1 w-1.5 h-1.5 rounded-full bg-yellow-200 shadow-[0_0_6px_#fb923c]"
                    style={{ animationDelay: '220ms' }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Single-line Biome & Live Combat Feed Strip (outside canvas) */}
        <div className="flex items-center justify-between gap-2 px-2.5 py-1 rounded-lg bg-[#08121d]/90 border border-cyan-400/15 text-[11px]">
          <div className="flex items-center gap-1.5 shrink-0 font-bold">
            <Swords className="w-3.5 h-3.5 text-teal-300" />
            <span style={{ color: biomeInfo.accent }}>{biomeInfo.name}</span>
          </div>
          <span className="text-slate-200 font-semibold truncate text-right">
            {battle.playerDuelist.charging
              ? `${chargeTier.label} (${Math.round(chargeVal * 100)}%)`
              : battle.log[0] || `${allySpecies.name} · ${allyProfile.roleLabel}`}
          </span>
        </div>
      </header>

      {/* ZONE 2: CENTER ARENA + RIGHT-SIDE VERTICAL SLUG COLUMN (Protagonist, zero obstruction) */}
      <main className="flex-1 min-h-0 w-full max-w-6xl mx-auto flex items-center justify-center gap-2 py-0.5">
        <div className="flex-1 min-w-0 h-full flex items-center justify-center">
          <canvas
            ref={canvasRef}
            width={ARENA_WIDTH}
            height={ARENA_HEIGHT}
            style={{ aspectRatio: '920 / 480' }}
            className="max-w-full max-h-full w-auto h-auto block rounded-xl border border-cyan-400/35 bg-[#050a12] shadow-[0_0_32px_rgba(6,18,30,0.9)] cursor-crosshair touch-none"
            onContextMenu={(e) => {
              e.preventDefault();
              if (!canAct) return;
              combat.triggerContextualAction(state);
              onSync();
            }}
            onPointerDown={(e) => {
              if (!canAct || e.button === 2) return;
              canvasPointerIdRef.current = e.pointerId;
              e.currentTarget.setPointerCapture?.(e.pointerId);
              const pt = toArenaCoords(e.clientX, e.clientY);
              combat.aimAtArenaPoint(pt.x, pt.y);
              combat.beginCharge(state);
            }}
            onPointerMove={(e) => {
              if (!canAct) return;
              if (e.pointerType !== 'mouse' && canvasPointerIdRef.current !== e.pointerId) return;
              const pt = toArenaCoords(e.clientX, e.clientY);
              combat.aimAtArenaPoint(pt.x, pt.y);
            }}
            onPointerUp={(e) => {
              if (canvasPointerIdRef.current !== e.pointerId) return;
              canvasPointerIdRef.current = null;
              if (canAct && combat.battle?.playerDuelist.charging) {
                const pt = toArenaCoords(e.clientX, e.clientY);
                combat.aimAtArenaPoint(pt.x, pt.y);
                combat.releaseChargeAndFire(state);
                onSync();
              }
            }}
            onPointerCancel={(e) => {
              if (canvasPointerIdRef.current !== e.pointerId) return;
              canvasPointerIdRef.current = null;
              if (combat.battle?.playerDuelist.charging) {
                combat.releaseChargeAndFire(state);
                onSync();
              }
            }}
            onLostPointerCapture={(e) => {
              if (canvasPointerIdRef.current === e.pointerId) {
                canvasPointerIdRef.current = null;
              }
            }}
          />
        </div>

        {/* Shared Right-Side Vertical Slug Case */}
        <SlugColumn
          party={state.party}
          activeIndex={state.activePartyIndex}
          activeMood={allyMood}
          onSelectSlug={(idx) => {
            combat.swapSlug(state, idx);
            onSync();
          }}
          disabled={!canAct}
          disableKo
          showEnergy
          compact={showTouch}
          className="max-h-full overflow-y-auto bt-scroll"
        />
      </main>

      {/* ZONE 3: BOTTOM CONTROLS DOCK */}
      <footer className="relative w-full max-w-5xl mx-auto shrink-0 pt-1.5">
        {/* Compact Expandable Secondary Actions Menu (opens upward above dock, never permanent clutter) */}
        {actionsOpen && canAct && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-[min(94vw,460px)] bt-panel rounded-2xl p-3 z-40 shadow-2xl">
            <div className="flex items-center justify-between border-b border-cyan-400/20 pb-2 mb-2.5">
              <span className="text-xs font-extrabold text-white flex items-center gap-1.5">
                <Backpack className="w-4 h-4 text-amber-300" />
                Menú Táctico · {ally.name}
              </span>
              <button
                onClick={() => setActionsOpen(false)}
                aria-label="Cerrar menú táctico"
                className="w-8 h-8 rounded-lg bt-btn-secondary flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Special Moves + Guard + Pulse */}
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              {allySpecies.specialMoves.map((mv, i) => {
                const idx = i as 0 | 1;
                const cd = combat.getMoveCooldown(ally, mv.id);
                const masteryPts = ally.moveMastery?.[idx] ?? 0;
                const masteryInfo = getMoveMasteryInfo(masteryPts);
                const effectiveCost = getEffectiveMoveEnergyCost(mv.energyCost, masteryPts);
                const selected = battle.selectedMode === idx;
                const locked = cd > 0 || ally.energy < effectiveCost;
                return (
                  <button
                    key={mv.id}
                    disabled={locked}
                    onClick={() => selectOrFireMode(idx)}
                    className={`p-2 rounded-xl border text-left cursor-pointer disabled:opacity-40 min-h-[48px] ${
                      selected
                        ? 'bg-indigo-950/75 border-amber-300'
                        : 'bt-btn-secondary border-indigo-400/35'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 text-xs font-extrabold text-white">
                      <span className="truncate flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-300 shrink-0" />
                        [{idx === 0 ? 'Z' : 'X'}] {mv.name}
                      </span>
                      <span className="text-[10px] text-teal-300 tabular-nums shrink-0">
                        {cd > 0 ? `${cd.toFixed(1)}s` : `${effectiveCost}EN`}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-300 truncate mt-0.5">
                      {mv.description}
                      {masteryInfo.rank > 0 ? ` · ${masteryInfo.label}` : ''}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Bag + Shield + Retreat */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              <button
                disabled={guardCd > 0}
                onClick={() => {
                  combat.activateGuard(state);
                  setActionsOpen(false);
                  onSync();
                }}
                className="bt-btn-secondary p-2 rounded-xl border-sky-400/40 text-center disabled:opacity-40 cursor-pointer min-h-[46px]"
              >
                <div className="text-[11px] font-extrabold text-sky-200">Escudo [F]</div>
                <div className="text-[9px] text-slate-300">{guardCd > 0 ? `${guardCd.toFixed(1)}s` : '+2 EN'}</div>
              </button>

              <button
                disabled={state.inventory.berries <= 0}
                onClick={() => {
                  combat.useItem(state, 'berries');
                  setActionsOpen(false);
                  onSync();
                }}
                className="bt-btn-secondary p-2 rounded-xl border-emerald-500/40 text-center disabled:opacity-40 cursor-pointer min-h-[46px]"
              >
                <div className="text-[11px] font-bold text-white">Baya ({state.inventory.berries})</div>
                <div className="text-[9px] text-emerald-300">+34 PS</div>
              </button>

              <button
                disabled={state.inventory.core <= 0}
                onClick={() => {
                  combat.useItem(state, 'core');
                  setActionsOpen(false);
                  onSync();
                }}
                className="bt-btn-secondary p-2 rounded-xl border-cyan-500/40 text-center disabled:opacity-40 cursor-pointer min-h-[46px]"
              >
                <div className="text-[11px] font-bold text-white">Núcleo ({state.inventory.core})</div>
                <div className="text-[9px] text-cyan-300">+8 EN</div>
              </button>

              <button
                disabled={state.inventory.capsules <= 0 || battle.kind !== 'wild'}
                onClick={() => {
                  combat.useItem(state, 'capsules');
                  setActionsOpen(false);
                  onSync();
                }}
                className="bt-btn-secondary p-2 rounded-xl border-indigo-400/40 text-center disabled:opacity-40 cursor-pointer min-h-[46px]"
              >
                <div className="text-[11px] font-bold text-white">Cilindro ({state.inventory.capsules})</div>
                <div className="text-[9px] text-indigo-300">Capturar</div>
              </button>

              <button
                disabled={state.inventory.masterCapsules <= 0 || battle.kind !== 'wild'}
                onClick={() => {
                  combat.useItem(state, 'masterCapsules');
                  setActionsOpen(false);
                  onSync();
                }}
                className="bt-btn-secondary p-2 rounded-xl border-purple-400/50 text-center disabled:opacity-40 cursor-pointer min-h-[46px]"
              >
                <div className="text-[11px] font-bold text-white">Maestro ({state.inventory.masterCapsules})</div>
                <div className="text-[9px] text-purple-300">Alta tasa</div>
              </button>

              <button
                disabled={battle.kind === 'boss'}
                onClick={() => {
                  combat.attemptRun(state);
                  setActionsOpen(false);
                  onSync();
                }}
                className="p-2 rounded-xl bg-[#261419] border border-rose-500/45 hover:border-rose-400 text-[11px] font-bold text-rose-200 disabled:opacity-40 cursor-pointer min-h-[46px]"
              >
                Retirarse
              </button>
            </div>
          </div>
        )}

        {battle.turn === 'ended' ? (
          <div className="bt-panel rounded-xl px-3.5 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2.5 border-teal-400/50">
            <div className="text-center sm:text-left">
              <div className="text-xs sm:text-sm font-extrabold text-teal-100">{battle.rewardText}</div>
              {battle.log[1] && <div className="text-[11px] text-slate-300 mt-0.5">{battle.log[1]}</div>}
            </div>
            <button
              onClick={() => {
                combat.closeBattle();
                onSync();
              }}
              className="bt-btn-primary px-6 py-2.5 rounded-xl font-extrabold text-sm cursor-pointer min-h-[44px] shrink-0"
            >
              Continuar Exploración
            </button>
          </div>
        ) : showTouch ? (
          /* MOBILE / TOUCH 3-PART DOCK: Left Joystick | Center Slug Strip + Contextual + Menu | Right Aim/Fire Pad */
          <div className="flex items-end justify-between gap-2 px-0.5">
            {/* Left: Free 2D Virtual Joystick */}
            <div
              ref={joyRef}
              onPointerDown={(e) => {
                e.preventDefault();
                joyPointerIdRef.current = e.pointerId;
                e.currentTarget.setPointerCapture?.(e.pointerId);
                updateJoystick(e.clientX, e.clientY);
              }}
              onPointerMove={(e) => {
                if (joyPointerIdRef.current !== e.pointerId) return;
                updateJoystick(e.clientX, e.clientY);
              }}
              onPointerUp={(e) => {
                if (joyPointerIdRef.current === e.pointerId) resetJoystick();
              }}
              onPointerCancel={(e) => {
                if (joyPointerIdRef.current === e.pointerId) resetJoystick();
              }}
              onLostPointerCapture={(e) => {
                if (joyPointerIdRef.current === e.pointerId) resetJoystick();
              }}
              aria-label="Joystick de movimiento"
              className="relative w-[104px] h-[104px] sm:w-[116px] sm:h-[116px] shrink-0 rounded-full border-2 border-teal-300/45 bg-[#08131ee6] touch-none shadow-lg"
            >
              <div className="absolute inset-3 rounded-full border border-white/10 pointer-events-none" />
              <div
                className="absolute w-10 h-10 rounded-full bg-gradient-to-b from-teal-300 to-cyan-500 border-2 border-white/90 left-1/2 top-1/2 -ml-5 -mt-5 shadow-md pointer-events-none"
                style={{ transform: `translate(${joyNub.x}px, ${joyNub.y}px)` }}
              />
              <span className="absolute bottom-1 inset-x-0 text-center text-[9px] font-bold text-teal-200/75 pointer-events-none">
                MOVER
              </span>
            </div>

            {/* Center: Single Contextual Action + Secondary Menu (Slugs are on the right column) */}
            <div className="flex-1 min-w-0 flex items-center justify-center gap-2 pb-1">
              <button
                disabled={!canAct || contextual.disabled}
                onClick={() => {
                  combat.triggerContextualAction(state);
                  onSync();
                }}
                className={`min-h-[48px] px-3.5 rounded-2xl border text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-45 ${
                  contextual.kind === 'capture'
                    ? 'bt-btn-amber'
                    : contextual.kind === 'heal'
                    ? 'bg-emerald-600/85 border-emerald-300 text-white'
                    : 'bt-btn-secondary border-sky-400/50 text-sky-100'
                }`}
              >
                {contextual.kind === 'capture' ? (
                  <Target className="w-4 h-4 shrink-0" />
                ) : contextual.kind === 'heal' ? (
                  <Heart className="w-4 h-4 shrink-0" />
                ) : contextual.kind === 'energy' ? (
                  <Zap className="w-4 h-4 shrink-0" />
                ) : (
                  <Shield className="w-4 h-4 shrink-0" />
                )}
                <span className="truncate">{contextual.shortLabel}</span>
              </button>

              <button
                onClick={() => setActionsOpen((v) => !v)}
                aria-label="Abrir menú de acciones"
                className={`min-h-[48px] px-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                  actionsOpen ? 'bt-btn-primary' : 'bt-btn-secondary border-amber-400/45 text-amber-100'
                }`}
              >
                <MoreHorizontal className="w-4 h-4" />
                <span className="text-[11px] tabular-nums">{totalBagItems}</span>
              </button>
            </div>

            {/* Right: Drag-to-Aim + Hold-to-Charge + Release-to-Fire Pad */}
            <div
              ref={aimPadRef}
              onPointerDown={(e) => {
                if (!canAct) return;
                e.preventDefault();
                aimPointerIdRef.current = e.pointerId;
                aimDraggedRef.current = false;
                e.currentTarget.setPointerCapture?.(e.pointerId);
                updateAimPad(e.clientX, e.clientY, true);
                combat.beginCharge(state);
              }}
              onPointerMove={(e) => {
                if (aimPointerIdRef.current !== e.pointerId || !canAct) return;
                updateAimPad(e.clientX, e.clientY, false);
              }}
              onPointerUp={(e) => {
                if (aimPointerIdRef.current === e.pointerId) releaseAimPad(true);
              }}
              onPointerCancel={(e) => {
                if (aimPointerIdRef.current === e.pointerId) releaseAimPad(true);
              }}
              onLostPointerCapture={(e) => {
                if (aimPointerIdRef.current === e.pointerId) releaseAimPad(false);
              }}
              aria-label="Zona de apuntado y disparo"
              className="relative w-[104px] h-[104px] sm:w-[116px] sm:h-[116px] shrink-0 rounded-full border-2 bg-[#08131ee6] touch-none shadow-lg flex items-center justify-center"
              style={{
                borderColor: battle.playerDuelist.charging ? chargeTier.color : 'rgba(56, 189, 248, 0.5)',
                boxShadow: battle.playerDuelist.charging
                  ? `0 0 18px ${chargeTier.color}55`
                  : undefined,
              }}
            >
              {/* Charge progress ring */}
              {battle.playerDuelist.charging && (
                <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    fill="none"
                    stroke="rgba(255,255,255,0.12)"
                    strokeWidth="5"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    fill="none"
                    stroke={chargeTier.color}
                    strokeWidth="5"
                    strokeDasharray={276.46}
                    strokeDashoffset={276.46 * (1 - chargeVal)}
                    strokeLinecap="round"
                  />
                </svg>
              )}

              <div
                className="w-11 h-11 rounded-full flex items-center justify-center border-2 border-white/85 shadow-md pointer-events-none"
                style={{
                  transform: `translate(${aimNub.x}px, ${aimNub.y}px)`,
                  background: battle.playerDuelist.charging
                    ? chargeTier.color
                    : 'linear-gradient(180deg, #fde047 0%, #f59e0b 100%)',
                }}
              >
                <Crosshair className="w-5 h-5 text-[#06101b]" />
              </div>

              <span className="absolute bottom-1 inset-x-0 text-center text-[9px] font-extrabold text-amber-200/90 pointer-events-none truncate px-2">
                {battle.playerDuelist.charging ? chargeTier.label : 'DISPARAR'}
              </span>
            </div>
          </div>
        ) : (
          /* DESKTOP / PC COMPACT DOCK: Controls Hint | Contextual Action + Menu (Slugs are on the right column) */
          <div className="bt-hud-panel rounded-xl px-3.5 py-2 flex flex-wrap items-center justify-between gap-2">
            <div className="text-[11px] sm:text-xs text-slate-300 font-medium">
              <strong className="text-teal-200">WASD / Flechas</strong> mover ·{' '}
              <strong className="text-teal-200">Ratón</strong> apuntar ·{' '}
              <strong className="text-teal-200">Clic / Espacio</strong> cargar y disparar ·{' '}
              <strong className="text-teal-200">Q / E</strong> cambiar babosa ·{' '}
              <strong className="text-teal-200">F</strong> acción
            </div>

            {/* Contextual Primary Action + Secondary Menu */}
            <div className="flex items-center gap-2 ml-auto">
              <button
                disabled={!canAct || contextual.disabled}
                onClick={() => {
                  combat.triggerContextualAction(state);
                  onSync();
                }}
                className={`min-h-[44px] px-3.5 rounded-xl border text-xs font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-45 ${
                  contextual.kind === 'capture'
                    ? 'bt-btn-amber'
                    : contextual.kind === 'heal'
                    ? 'bg-emerald-600/85 border-emerald-300 text-white'
                    : 'bt-btn-secondary border-sky-400/50 text-sky-100'
                }`}
              >
                {contextual.kind === 'capture' ? (
                  <Target className="w-4 h-4" />
                ) : contextual.kind === 'heal' ? (
                  <Heart className="w-4 h-4" />
                ) : contextual.kind === 'energy' ? (
                  <Zap className="w-4 h-4" />
                ) : (
                  <Shield className="w-4 h-4" />
                )}
                <span>
                  {contextual.label} [{contextual.keyHint}]
                </span>
              </button>

              <button
                onClick={() => setActionsOpen((v) => !v)}
                className={`min-h-[44px] px-3.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                  actionsOpen ? 'bt-btn-primary' : 'bt-btn-secondary border-amber-400/45 text-amber-100'
                }`}
              >
                <Backpack className="w-4 h-4 text-amber-300" />
                <span>Acciones</span>
              </button>
            </div>
          </div>
        )}
      </footer>
    </div>
  );
};
