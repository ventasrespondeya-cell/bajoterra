import { sound } from './audio';
import {
  ARENA_CEIL_Y,
  ARENA_FLOOR_Y,
  ARENA_WIDTH,
  BASE_GRAVITY,
  DUELIST_MAX_Y,
  DUELIST_MIN_Y,
  ENEMY_LANE_X,
  PLAYER_LANE_X,
  buildArenaForBiome,
} from './combatArenas';
import { createSlugInstance, ELEMENT_CHART, getElementMultiplier, getSpecies } from './data';
import {
  awardSlugExperience,
  ensureSlugProgressionFields,
  getEffectiveMoveEnergyCost,
  getMoveMasteryInfo,
  grantMoveMastery,
} from './progression';
import { getSlugCombatProfile } from './slugCombatProfiles';
import type {
  BattleState,
  BiomeId,
  BlasterShotMode,
  CombatantState,
  CombatEffectEvent,
  DuelArenaObstacle,
  DuelProjectile,
  EnemyStrategy,
  GameState,
  SlugInstance,
} from './types';

let effectSeq = 1;
let projSeq = 1;
let waveSeq = 1;

export class CombatManager {
  public battle: BattleState | null = null;
  public allyCooldowns: Record<string, number> = {}; // `${uid}_${moveId}` -> seconds remaining
  public allyShieldTurns = 0; // kept for HUD summary compatibility (>0 when shield active)
  public allyBurnTurns = 0;
  public allyChillTurns = 0;
  private participatedUids = new Set<string>();
  private boostedPairs = new Set<string>(); // `${projId}_${obsId}`
  private verticalInput: -1 | 0 | 1 = 0;
  private onBattleEndCallback: ((endedBattle: BattleState | null) => void) | null = null;
  private onStateChangeCallback: (() => void) | null = null;
  private pendingTimer: ReturnType<typeof setTimeout> | null = null;

  private clearPendingTimers(): void {
    if (this.pendingTimer !== null) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }
  }

  public startBattle(
    state: GameState,
    opts: {
      kind: 'wild' | 'mercenary' | 'boss';
      speciesId: string;
      level: number;
      biome?: BiomeId;
      nameOverride?: string;
      bossId?: string;
      iconOverride?: string;
      onEnd?: (endedBattle?: BattleState | null) => void;
      onStateChange?: () => void;
    }
  ): BattleState {
    this.clearPendingTimers();
    sound.stopDuelMusic();

    const aliveIdx = state.party.findIndex((s) => s.hp > 0);
    if (aliveIdx >= 0 && state.party[state.activePartyIndex]?.hp <= 0) {
      state.activePartyIndex = aliveIdx;
    }

    this.participatedUids.clear();
    this.boostedPairs.clear();
    this.verticalInput = 0;
    const starter = state.party[state.activePartyIndex];
    if (starter) {
      ensureSlugProgressionFields(starter);
      this.participatedUids.add(starter.uid);
    }

    const sp = getSpecies(opts.speciesId);
    const mult = opts.kind === 'boss' ? 2.2 : opts.kind === 'mercenary' ? 1.35 : 1.05;
    const base = createSlugInstance(sp.id, opts.level);
    const maxHp = Math.round(base.maxHp * mult);
    const strategies: EnemyStrategy[] = ['agresivo', 'defensivo', 'tactico'];
    const strategy: EnemyStrategy =
      opts.kind === 'boss' ? 'jefe' : strategies[Math.floor(Math.random() * strategies.length)];

    const enemy: CombatantState = {
      uid: `enemy_${Date.now()}`,
      id: sp.id,
      name:
        opts.nameOverride ||
        (opts.kind === 'mercenary'
          ? `Blakk · ${sp.name}`
          : opts.kind === 'boss'
          ? opts.nameOverride || sp.evoName
          : `${sp.name} salvaje`),
      type: sp.type,
      icon: opts.iconOverride || sp.icon,
      level: opts.level,
      hp: maxHp,
      maxHp,
      energy: 18,
      maxEnergy: 18,
      atk: Math.round(base.atk * (opts.kind === 'boss' ? 1.32 : opts.kind === 'mercenary' ? 1.12 : 0.92)),
      def: base.def,
      spd: base.spd,
      mega: opts.kind === 'boss',
      shieldTurns: 0,
      burnTurns: 0,
      stunTurns: 0,
      chillTurns: 0,
      burnTimer: 0,
      burnTickAccum: 0,
      stunTimer: 0,
      chillTimer: 0,
      shieldTimer: 0,
      telegraphing: null,
      strategy,
      isBoss: opts.kind === 'boss',
      bossId: opts.bossId,
      isMercenary: opts.kind === 'mercenary',
      cooldowns: {},
    };

    const biome: BiomeId = opts.biome || sp.habitat || 'Verdes';
    const arena = buildArenaForBiome(biome);

    state.seenSpecies[sp.id] = true;
    this.allyCooldowns = {};
    this.allyShieldTurns = 0;
    this.allyBurnTurns = 0;
    this.allyChillTurns = 0;
    this.onBattleEndCallback = opts.onEnd || null;
    this.onStateChangeCallback = opts.onStateChange || null;

    this.battle = {
      active: true,
      kind: opts.kind,
      biome,
      subtitle:
        opts.kind === 'boss'
          ? `Jefe de Bioma · ${arena.title}`
          : opts.kind === 'mercenary'
          ? `Duelo Blakk · ${arena.title}`
          : `Babosa salvaje · Nv.${opts.level} (${strategy})`,
      enemy,
      turn: 'duel',
      selectedMode: 'quick',
      pulseCharge: 35,
      pulseWindowActive: false,
      pulseReason: '',
      elapsedSec: 0,
      hitstopTimer: 0,
      cameraShake: 0,
      playerDuelist: {
        x: PLAYER_LANE_X,
        y: 268,
        vy: 0,
        aimAngle: -0.14,
        charge: 0,
        charging: false,
        recoil: 0,
        guardTimer: 0,
        guardCooldown: 0,
        reloadTimer: 0,
        hitFlash: 0,
        perfectFlash: 0,
        telegraphProgress: 0,
        aiCooldown: 0,
        aiTargetY: 268,
      },
      enemyDuelist: {
        x: ENEMY_LANE_X,
        y: 262,
        vy: 0,
        aimAngle: Math.PI + 0.12,
        charge: 0,
        charging: false,
        recoil: 0,
        guardTimer: 0,
        guardCooldown: 0,
        reloadTimer: 0,
        hitFlash: 0,
        perfectFlash: 0,
        telegraphProgress: 0,
        aiCooldown: 1.05,
        aiTargetY: 250,
      },
      projectiles: [],
      obstacles: arena.obstacles.map((o) => ({ ...o })),
      shockwaves: [],
      allyStatus: {
        shieldTimer: 0,
        burnTimer: 0,
        burnTickAccum: 0,
        chillTimer: 0,
        stunTimer: 0,
      },
      log: [
        opts.kind === 'boss'
          ? `¡${enemy.name} emerge en ${arena.title}! Carga tu bláster y dispara.`
          : opts.kind === 'mercenary'
          ? `¡Duelo de lanzadores en ${arena.title}! Apunta y suelta en la zona dorada.`
          : `¡${enemy.name} aparece! Selecciona babosa, carga y lanza.`,
      ],
      effects: [],
    };

    sound.startDuelMusic();
    return this.battle;
  }

  private pushEffect(ev: Omit<CombatEffectEvent, 'id'>): void {
    if (!this.battle) return;
    this.battle.effects = [
      ...this.battle.effects.slice(-7),
      { ...ev, id: effectSeq++, age: 0 },
    ];
  }

  private pushShockwave(
    x: number,
    y: number,
    maxRadius: number,
    color: string,
    kind: 'impact' | 'transform' | 'clash' | 'shield' | 'heal' | 'capture',
    label?: string
  ): void {
    if (!this.battle) return;
    this.battle.shockwaves.push({
      id: waveSeq++,
      x,
      y,
      radius: 8,
      maxRadius,
      alpha: 0.95,
      color,
      label,
      kind,
    });
  }

  private pushLog(msg: string): void {
    if (!this.battle) return;
    this.battle.log = [msg, ...this.battle.log].slice(0, 6);
  }

  public getMoveCooldown(slug: SlugInstance, moveId: string): number {
    return Math.max(0, this.allyCooldowns[`${slug.uid}_${moveId}`] || 0);
  }

  public setVerticalInput(dir: -1 | 0 | 1): void {
    this.verticalInput = dir;
  }

  public moveDuelistStep(deltaY: number): void {
    if (!this.battle || this.battle.turn !== 'duel') return;
    const nextY = this.battle.playerDuelist.y + deltaY;
    this.battle.playerDuelist.y = Math.max(DUELIST_MIN_Y, Math.min(DUELIST_MAX_Y, nextY));
  }

  public setAimAngle(angleRad: number): void {
    if (!this.battle || this.battle.turn !== 'duel') return;
    this.battle.playerDuelist.aimAngle = Math.max(-0.98, Math.min(0.92, angleRad));
  }

  public aimAtArenaPoint(arenaX: number, arenaY: number): void {
    if (!this.battle || this.battle.turn !== 'duel') return;
    const p = this.battle.playerDuelist;
    const dx = Math.max(36, arenaX - p.x);
    const dy = arenaY - p.y;
    this.setAimAngle(Math.atan2(dy, dx));
  }

  public setSelectedMode(state: GameState, mode: BlasterShotMode): boolean {
    if (!this.battle || this.battle.turn !== 'duel') return false;
    const ally = state.party[state.activePartyIndex];
    if (!ally) return false;
    if (mode === 'pulse' && !this.battle.pulseWindowActive) {
      this.pushLog('El Pulso Maestro aún no está listo (carga el medidor o interrumpe al rival).');
      return false;
    }
    if (mode === 0 || mode === 1) {
      const sp = getSpecies(ally.id);
      const mv = sp.specialMoves[mode];
      const cost = getEffectiveMoveEnergyCost(mv.energyCost, ally.moveMastery?.[mode] ?? 0);
      const cd = this.getMoveCooldown(ally, mv.id);
      if (cd > 0) {
        this.pushLog(`${mv.name} recargándose (${cd.toFixed(1)}s).`);
        return false;
      }
      if (ally.energy < cost) {
        this.pushLog(`Energía insuficiente para ${mv.name} (${cost} EN).`);
        return false;
      }
    }
    this.battle.selectedMode = mode;
    sound.playBlasterSelect();
    this.onStateChangeCallback?.();
    return true;
  }

  public beginCharge(state: GameState): void {
    if (!this.battle || this.battle.turn !== 'duel') return;
    const ally = state.party[state.activePartyIndex];
    if (!ally || ally.hp <= 0) return;
    if (this.battle.allyStatus.stunTimer > 0) {
      this.pushLog(`${ally.name} está brevemente aturdida.`);
      return;
    }
    this.battle.playerDuelist.charging = true;
    this.battle.playerDuelist.charge = Math.max(0.18, this.battle.playerDuelist.charge);
  }

  public releaseChargeAndFire(state: GameState): DuelProjectile | null {
    if (!this.battle || this.battle.turn !== 'duel') return null;
    const pd = this.battle.playerDuelist;
    const charge = pd.charging ? Math.max(0.28, pd.charge) : 0.72;
    pd.charging = false;
    pd.charge = 0;
    return this.fireBlasterShot(state, { charge });
  }

  public fireBlasterShot(
    state: GameState,
    opts?: {
      charge?: number;
      angle?: number;
      modeOverride?: BlasterShotMode;
    }
  ): DuelProjectile | null {
    if (!this.battle || this.battle.turn !== 'duel') return null;
    const ally = state.party[state.activePartyIndex];
    if (!ally || ally.hp <= 0) return null;
    ensureSlugProgressionFields(ally);
    this.participatedUids.add(ally.uid);

    const pd = this.battle.playerDuelist;
    if (this.battle.allyStatus.stunTimer > 0) {
      this.pushLog('¡Bláster aturdido brevemente!');
      return null;
    }
    if (pd.reloadTimer > 0) {
      return null;
    }

    const sp = getSpecies(ally.id);
    const profile = getSlugCombatProfile(sp);
    const requestedMode = opts?.modeOverride ?? this.battle.selectedMode;
    const charge = Math.max(0.15, Math.min(1, opts?.charge ?? 0.75));
    const perfectRelease = charge >= 0.62 && charge <= 0.88;
    const angle = opts?.angle !== undefined ? Math.max(-0.98, Math.min(0.92, opts.angle)) : pd.aimAngle;
    pd.aimAngle = angle;

    let actualMode: DuelProjectile['mode'] = 'quick';
    let moveIndex: 0 | 1 | undefined;
    let moveId: string | undefined;
    let moveEffect: DuelProjectile['moveEffect'];
    let movePowerMult = 1.0;

    if (requestedMode === 'pulse' && this.battle.pulseWindowActive) {
      actualMode = 'pulse';
      this.battle.pulseCharge = Math.max(0, this.battle.pulseCharge - 100);
      this.battle.pulseWindowActive = false;
      this.battle.pulseReason = '';
      movePowerMult = 1.78;
      this.battle.selectedMode = 'quick';
    } else if (requestedMode === 0 || requestedMode === 1) {
      const mv = sp.specialMoves[requestedMode];
      const masteryPts = ally.moveMastery?.[requestedMode] ?? 0;
      const masteryInfo = getMoveMasteryInfo(masteryPts);
      const effectiveCost = getEffectiveMoveEnergyCost(mv.energyCost, masteryPts);
      const cd = this.getMoveCooldown(ally, mv.id);
      if (cd > 0) {
        this.pushLog(`${mv.name} está en enfriamiento (${cd.toFixed(1)}s).`);
        return null;
      }
      if (ally.energy < effectiveCost) {
        this.pushLog(`Energía insuficiente para ${mv.name} (${effectiveCost} EN).`);
        return null;
      }

      ally.energy -= effectiveCost;
      this.allyCooldowns[`${ally.uid}_${mv.id}`] = mv.cooldown * 2.2 + 1.4;
      actualMode = requestedMode === 0 ? 'move0' : 'move1';
      moveIndex = requestedMode;
      moveId = mv.id;
      moveEffect = mv.effect;
      movePowerMult = (mv.power > 0 ? mv.power : 0.7) * masteryInfo.powerMultiplier;

      // Support effects trigger visibly at blaster chamber + energy wave forward
      if (mv.effect === 'heal') {
        const healMult = 1 + masteryInfo.rank * 0.05;
        const healAmt = Math.max(12, Math.round(ally.maxHp * 0.38 * healMult));
        ally.hp = Math.min(ally.maxHp, ally.hp + healAmt);
        this.battle.allyStatus.burnTimer = 0;
        this.allyBurnTurns = 0;
        if (mv.id === 'resonance') {
          this.battle.allyStatus.shieldTimer = 3.8;
          this.allyShieldTurns = 2;
        }
        sound.playHeal();
        this.pushEffect({
          target: 'ally',
          kind: 'heal',
          text: `+${healAmt} PS`,
          color: '#4ade80',
          x: pd.x,
          y: pd.y - 38,
        });
        this.pushShockwave(pd.x, pd.y, 82, '#4ade80', 'heal', mv.name);
        this.pushLog(`${ally.name} activa ${mv.name} (+${healAmt} PS) y dispara onda luminosa.`);
      } else if (mv.effect === 'shield') {
        this.battle.allyStatus.shieldTimer = 4.2;
        this.allyShieldTurns = 2;
        sound.playShieldBlock(true);
        this.pushEffect({
          target: 'ally',
          kind: 'shield',
          text: '🛡 Escudo elemental',
          color: '#38bdf8',
          x: pd.x,
          y: pd.y - 36,
        });
        this.pushShockwave(pd.x, pd.y, 76, '#38bdf8', 'shield');
      }

      const masteryStep = grantMoveMastery(ally, requestedMode, 10);
      if (masteryStep.newRank > masteryStep.previousRank) {
        this.pushLog(`✦ ¡${mv.name} alcanza ${masteryStep.newLabel}!`);
      }
      this.battle.selectedMode = 'quick';
    }

    const speedRatio = 0.55 + charge * 0.45;
    const megaSpeedMult = ally.mega ? 1.12 : 1;
    const perfSpeedMult = perfectRelease ? 1.08 : 1;
    const speed =
      (profile.baseLaunchSpeed +
        (profile.maxLaunchSpeed - profile.baseLaunchSpeed) * charge) *
      megaSpeedMult *
      perfSpeedMult *
      (actualMode === 'pulse' ? 1.16 : 1);

    const muzzleX = pd.x + Math.cos(angle) * 34;
    const muzzleY = pd.y + Math.sin(angle) * 34;

    const powerScore =
      ally.atk *
      movePowerMult *
      (0.68 + speedRatio * 0.48) *
      (perfectRelease ? 1.24 : 1) *
      (ally.mega ? 1.14 : 1) *
      (this.battle.allyStatus.chillTimer > 0 ? 0.78 : 1);

    const proj: DuelProjectile = {
      id: projSeq++,
      owner: 'ally',
      speciesId: sp.id,
      slugName: ally.name,
      element: ally.type,
      mega: ally.mega,
      mode: actualMode,
      moveIndex,
      moveId,
      moveEffect,
      x: muzzleX,
      y: muzzleY,
      prevX: muzzleX,
      prevY: muzzleY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: profile.hitboxRadius + (actualMode === 'pulse' ? 4 : 0),
      distanceTraveled: 0,
      transformDist:
        actualMode === 'pulse'
          ? 52
          : Math.max(68, profile.transformDist * (1.12 - charge * 0.3)),
      phase: 'protoform',
      transformTimer: 0,
      chargeScore: charge,
      perfectRelease,
      powerScore,
      gravityScale: actualMode === 'pulse' ? 0.08 : profile.gravityScale,
      homing: profile.homing + (actualMode === 'pulse' ? 0.65 : 0),
      bouncesLeft: profile.bounces,
      phaseObstacles: profile.phaseObstacles || moveEffect === 'pierce' || actualMode === 'pulse',
      pierceLeft: moveEffect === 'pierce' || actualMode === 'pulse' ? 1 : 0,
      aoeRadius: profile.aoeRadius + (actualMode !== 'quick' ? 12 : 0),
      trail: [{ x: muzzleX, y: muzzleY, r: profile.hitboxRadius * 0.55 }],
      alive: true,
    };

    this.battle.projectiles.push(proj);
    pd.reloadTimer = actualMode === 'quick' ? profile.reloadSec : profile.reloadSec * 1.25;
    pd.recoil = 0.16;
    if (perfectRelease) pd.perfectFlash = 0.35;

    if (actualMode === 'pulse') {
      sound.playPulse();
    } else {
      sound.playBlasterFire(profile.weightClass === 'pesada' || actualMode !== 'quick', perfectRelease);
    }

    if (perfectRelease && actualMode === 'quick') {
      this.pushEffect({
        target: 'ally',
        kind: 'pulse',
        text: '★ Tiro Maestro',
        color: '#fde047',
        x: muzzleX,
        y: muzzleY - 22,
      });
    }

    this.onStateChangeCallback?.();
    return proj;
  }

  public activateGuard(state: GameState): boolean {
    if (!this.battle || this.battle.turn !== 'duel') return false;
    const ally = state.party[state.activePartyIndex];
    if (!ally) return false;
    const pd = this.battle.playerDuelist;
    if (pd.guardCooldown > 0) {
      this.pushLog(`Escudo recargándose (${pd.guardCooldown.toFixed(1)}s).`);
      return false;
    }
    this.participatedUids.add(ally.uid);
    pd.guardTimer = 0.9;
    pd.guardCooldown = 2.0;
    this.battle.allyStatus.shieldTimer = Math.max(this.battle.allyStatus.shieldTimer, 0.9);
    this.allyShieldTurns = 1;
    ally.energy = Math.min(ally.maxEnergy, ally.energy + 2);
    this.battle.pulseCharge = Math.min(100, this.battle.pulseCharge + 10);
    this.checkPulseUnlock();
    sound.playShieldBlock(false);
    this.pushShockwave(pd.x, pd.y, 64, '#38bdf8', 'shield', 'Escudo');
    this.pushEffect({
      target: 'ally',
      kind: 'shield',
      text: '🛡 Guardia +2 EN',
      color: '#38bdf8',
      x: pd.x,
      y: pd.y - 34,
    });
    this.onStateChangeCallback?.();
    return true;
  }

  public swapSlug(state: GameState, partyIdx: number): boolean {
    if (!this.battle || this.battle.turn !== 'duel') return false;
    const target = state.party[partyIdx];
    if (!target || target.hp <= 0 || partyIdx === state.activePartyIndex) return false;
    state.activePartyIndex = partyIdx;
    ensureSlugProgressionFields(target);
    this.participatedUids.add(target.uid);
    this.battle.selectedMode = 'quick';
    this.battle.playerDuelist.reloadTimer = 0.22;
    this.battle.playerDuelist.charging = false;
    this.battle.playerDuelist.charge = 0;
    this.battle.allyStatus.burnTimer = 0;
    this.battle.allyStatus.chillTimer = 0;
    this.allyBurnTurns = 0;
    this.allyChillTurns = 0;
    sound.playBlasterSelect();
    this.pushShockwave(this.battle.playerDuelist.x, this.battle.playerDuelist.y, 52, '#2dd4bf', 'transform');
    this.pushLog(`¡Cámara cargada con ${target.name} (${target.type})!`);
    this.onStateChangeCallback?.();
    return true;
  }

  public useItem(
    state: GameState,
    itemKey: 'berries' | 'core' | 'capsules' | 'masterCapsules'
  ): boolean {
    if (!this.battle || this.battle.turn !== 'duel') return false;
    const ally = state.party[state.activePartyIndex];
    const enemy = this.battle.enemy;
    if (!ally) return false;
    this.participatedUids.add(ally.uid);

    if (state.inventory[itemKey] <= 0) {
      this.pushLog('No te quedan unidades de ese objeto.');
      return false;
    }

    if (itemKey === 'berries') {
      state.inventory.berries--;
      const heal = 34;
      ally.hp = Math.min(ally.maxHp, ally.hp + heal);
      sound.playHeal();
      this.pushShockwave(this.battle.playerDuelist.x, this.battle.playerDuelist.y, 70, '#4ade80', 'heal');
      this.pushEffect({
        target: 'ally',
        kind: 'heal',
        text: `+${heal} PS`,
        color: '#4ade80',
        x: this.battle.playerDuelist.x,
        y: this.battle.playerDuelist.y - 36,
      });
      this.pushLog(`${ally.name} consume una baya y recupera ${heal} PS.`);
      this.onStateChangeCallback?.();
      return true;
    }

    if (itemKey === 'core') {
      state.inventory.core--;
      ally.energy = Math.min(ally.maxEnergy, ally.energy + 8);
      sound.playPulse();
      this.pushShockwave(this.battle.playerDuelist.x, this.battle.playerDuelist.y, 70, '#38bdf8', 'heal');
      this.pushEffect({
        target: 'ally',
        kind: 'heal',
        text: '+8 Energía',
        color: '#38bdf8',
        x: this.battle.playerDuelist.x,
        y: this.battle.playerDuelist.y - 36,
      });
      this.pushLog(`Núcleo de energía aplicado (+8 EN a ${ally.name}).`);
      this.onStateChangeCallback?.();
      return true;
    }

    if (enemy.isBoss || enemy.isMercenary) {
      this.pushLog('No puedes capturar babosas de jefes o mercenarios.');
      return false;
    }

    state.inventory[itemKey]--;
    const pd = this.battle.playerDuelist;
    const ed = this.battle.enemyDuelist;
    const dx = ed.x - (pd.x + 32);
    const dy = ed.y - pd.y;
    const speed = 780;
    const flightT = Math.max(0.25, dx / speed);
    const g = BASE_GRAVITY * 0.45;
    const vy = dy / flightT - 0.5 * g * flightT;
    const vx = speed;

    const capProj: DuelProjectile = {
      id: projSeq++,
      owner: 'ally',
      speciesId: enemy.id,
      slugName: itemKey === 'masterCapsules' ? 'Cilindro Maestro' : 'Cilindro de Captura',
      element: 'Energia',
      mega: itemKey === 'masterCapsules',
      mode: 'capsule',
      capsuleKey: itemKey,
      x: pd.x + 32,
      y: pd.y,
      prevX: pd.x + 32,
      prevY: pd.y,
      vx,
      vy,
      radius: 14,
      distanceTraveled: 0,
      transformDist: 9999,
      phase: 'protoform',
      transformTimer: 0,
      chargeScore: 1,
      perfectRelease: true,
      powerScore: 0,
      gravityScale: 0.45,
      homing: 1.8,
      bouncesLeft: 1,
      phaseObstacles: true,
      pierceLeft: 0,
      aoeRadius: 48,
      trail: [],
      alive: true,
    };

    this.battle.projectiles.push(capProj);
    pd.recoil = 0.14;
    sound.playBlasterFire(false, true);
    this.pushLog(`¡Lanzas ${capProj.slugName} hacia ${enemy.name}!`);
    this.onStateChangeCallback?.();
    return true;
  }

  public attemptRun(state: GameState): boolean {
    if (!this.battle || this.battle.turn !== 'duel') return false;
    if (this.battle.kind === 'boss') {
      this.pushLog('¡No puedes huir de un Jefe de Bioma!');
      return false;
    }
    const ally = state.party[state.activePartyIndex];
    const chance = this.battle.kind === 'mercenary' ? 0.52 : 0.78 + (ally?.spd || 10) * 0.012;
    if (Math.random() < chance) {
      sound.stopDuelMusic();
      this.battle.turn = 'ended';
      this.battle.outcome = 'escaped';
      this.battle.rewardText = 'Lograste retirarte del duelo con seguridad.';
      this.pushLog(this.battle.rewardText);
      this.onStateChangeCallback?.();
      return true;
    }
    this.pushLog('¡El rival interceptó la salida! Esquiva o usa escudo.');
    this.onStateChangeCallback?.();
    return false;
  }

  public computeTrajectoryPreview(state: GameState, steps = 22, stepDt = 0.036): {
    points: Array<{ x: number; y: number }>;
    transformPoint: { x: number; y: number } | null;
  } {
    const empty = { points: [], transformPoint: null };
    if (!this.battle) return empty;
    const ally = state.party[state.activePartyIndex];
    if (!ally) return empty;
    const sp = getSpecies(ally.id);
    const profile = getSlugCombatProfile(sp);
    const pd = this.battle.playerDuelist;
    const charge = pd.charging ? Math.max(0.18, pd.charge) : 0.72;
    const angle = pd.aimAngle;

    const speed =
      (profile.baseLaunchSpeed + (profile.maxLaunchSpeed - profile.baseLaunchSpeed) * charge) *
      (ally.mega ? 1.12 : 1) *
      (this.battle.selectedMode === 'pulse' ? 1.16 : 1);

    let x = pd.x + Math.cos(angle) * 34;
    let y = pd.y + Math.sin(angle) * 34;
    let vx = Math.cos(angle) * speed;
    let vy = Math.sin(angle) * speed;
    const gScale = this.battle.selectedMode === 'pulse' ? 0.08 : profile.gravityScale;
    const tDist =
      this.battle.selectedMode === 'pulse'
        ? 52
        : Math.max(68, profile.transformDist * (1.12 - charge * 0.3));

    const points: Array<{ x: number; y: number }> = [{ x, y }];
    let transformPoint: { x: number; y: number } | null = null;
    let dist = 0;

    for (let i = 0; i < steps; i++) {
      const prevX = x;
      const prevY = y;
      vy += BASE_GRAVITY * gScale * stepDt;
      x += vx * stepDt;
      y += vy * stepDt;
      dist += Math.hypot(x - prevX, y - prevY);
      if (!transformPoint && dist >= tDist) {
        transformPoint = { x, y };
      }
      if (x > ARENA_WIDTH - 24 || y > ARENA_FLOOR_Y || y < ARENA_CEIL_Y) {
        points.push({ x: Math.min(ARENA_WIDTH - 24, x), y: Math.max(ARENA_CEIL_Y, Math.min(ARENA_FLOOR_Y, y)) });
        break;
      }
      points.push({ x, y });
    }
    return { points, transformPoint };
  }

  public step(dtRaw: number, state: GameState): void {
    if (!this.battle || this.battle.turn !== 'duel') return;
    const dt = Math.min(0.05, Math.max(0.001, dtRaw));
    const b = this.battle;
    const ally = state.party[state.activePartyIndex];
    if (!ally) return;

    b.elapsedSec += dt;
    if (b.cameraShake > 0) b.cameraShake = Math.max(0, b.cameraShake - dt * 28);

    // Hitstop pauses projectile physics briefly on heavy impact while still decaying shockwaves
    for (let i = b.shockwaves.length - 1; i >= 0; i--) {
      const sw = b.shockwaves[i];
      sw.radius += (sw.maxRadius - sw.radius) * Math.min(1, dt * 11) + 45 * dt;
      sw.alpha -= dt * 2.25;
      if (sw.alpha <= 0.02) b.shockwaves.splice(i, 1);
    }

    if (b.hitstopTimer > 0) {
      b.hitstopTimer = Math.max(0, b.hitstopTimer - dt);
      return;
    }

    // Cooldowns & duelist timers
    for (const key of Object.keys(this.allyCooldowns)) {
      if (this.allyCooldowns[key] > 0) {
        this.allyCooldowns[key] = Math.max(0, this.allyCooldowns[key] - dt);
      }
    }

    const pd = b.playerDuelist;
    const ed = b.enemyDuelist;
    pd.recoil = Math.max(0, pd.recoil - dt);
    pd.guardTimer = Math.max(0, pd.guardTimer - dt);
    pd.guardCooldown = Math.max(0, pd.guardCooldown - dt);
    pd.reloadTimer = Math.max(0, pd.reloadTimer - dt);
    pd.hitFlash = Math.max(0, pd.hitFlash - dt);
    pd.perfectFlash = Math.max(0, pd.perfectFlash - dt);

    ed.recoil = Math.max(0, ed.recoil - dt);
    ed.guardTimer = Math.max(0, ed.guardTimer - dt);
    ed.guardCooldown = Math.max(0, ed.guardCooldown - dt);
    ed.reloadTimer = Math.max(0, ed.reloadTimer - dt);
    ed.hitFlash = Math.max(0, ed.hitFlash - dt);

    // Passive energy flow so blaster duel stays fluid
    if (ally.energy < ally.maxEnergy) {
      ally.energy = Math.min(ally.maxEnergy, ally.energy + dt * 0.55);
    }

    // Ally status decay
    b.allyStatus.shieldTimer = Math.max(0, b.allyStatus.shieldTimer - dt);
    b.allyStatus.chillTimer = Math.max(0, b.allyStatus.chillTimer - dt);
    b.allyStatus.stunTimer = Math.max(0, b.allyStatus.stunTimer - dt);
    this.allyShieldTurns = b.allyStatus.shieldTimer > 0 || pd.guardTimer > 0 ? 1 : 0;
    this.allyChillTurns = b.allyStatus.chillTimer > 0 ? 1 : 0;
    if (b.allyStatus.burnTimer > 0) {
      b.allyStatus.burnTimer = Math.max(0, b.allyStatus.burnTimer - dt);
      b.allyStatus.burnTickAccum += dt;
      if (b.allyStatus.burnTickAccum >= 1.3) {
        b.allyStatus.burnTickAccum = 0;
        const burnDmg = Math.max(2, Math.round(ally.maxHp * 0.05));
        ally.hp = Math.max(1, ally.hp - burnDmg);
        this.pushEffect({ target: 'ally', kind: 'status', text: `🔥 -${burnDmg}`, color: '#fb923c', x: pd.x, y: pd.y - 34 });
      }
      this.allyBurnTurns = b.allyStatus.burnTimer > 0 ? 1 : 0;
    } else {
      this.allyBurnTurns = 0;
    }

    // Enemy status decay & burn
    const enemy = b.enemy;
    enemy.shieldTimer = Math.max(0, (enemy.shieldTimer || 0) - dt);
    enemy.chillTimer = Math.max(0, (enemy.chillTimer || 0) - dt);
    enemy.stunTimer = Math.max(0, (enemy.stunTimer || 0) - dt);
    enemy.shieldTurns = enemy.shieldTimer > 0 || ed.guardTimer > 0 ? 1 : 0;
    enemy.chillTurns = enemy.chillTimer > 0 ? 1 : 0;
    enemy.stunTurns = enemy.stunTimer > 0 ? 1 : 0;

    if ((enemy.burnTimer || 0) > 0) {
      enemy.burnTimer = Math.max(0, (enemy.burnTimer || 0) - dt);
      enemy.burnTickAccum = (enemy.burnTickAccum || 0) + dt;
      if (enemy.burnTickAccum >= 1.25) {
        enemy.burnTickAccum = 0;
        const burnDmg = Math.max(3, Math.round(enemy.maxHp * 0.06));
        enemy.hp = Math.max(0, enemy.hp - burnDmg);
        this.pushEffect({
          target: 'enemy',
          kind: 'hit',
          text: `🔥 -${burnDmg}`,
          color: '#fb923c',
          x: ed.x,
          y: ed.y - 36,
        });
        if (enemy.hp <= 0) {
          this.handleVictory(state);
          return;
        }
      }
      enemy.burnTurns = enemy.burnTimer > 0 ? 1 : 0;
    } else {
      enemy.burnTurns = 0;
    }

    // Player movement & charge progression
    if (this.verticalInput !== 0 && b.allyStatus.stunTimer <= 0) {
      const moveSpd = b.allyStatus.chillTimer > 0 ? 165 : 235;
      pd.y = Math.max(DUELIST_MIN_Y, Math.min(DUELIST_MAX_Y, pd.y + this.verticalInput * moveSpd * dt));
    }
    if (pd.charging) {
      pd.charge = Math.min(1, pd.charge + dt * 0.98);
    }

    // Rival AI movement & shooting
    this.updateEnemyAI(dt, state);
    if (b.turn !== 'duel') return;

    // Update projectiles
    this.updateProjectiles(dt, state);
    if (b.turn !== 'duel') return;

    // Check mid-air slug clashes
    this.resolveProjectileClashes();

    // Check duelist & capture impacts
    this.resolveDuelistCollisions(state);
  }

  private updateEnemyAI(dt: number, state: GameState): void {
    const b = this.battle;
    if (!b || b.turn !== 'duel') return;
    const enemy = b.enemy;
    const ed = b.enemyDuelist;
    const pd = b.playerDuelist;

    if ((enemy.stunTimer || 0) > 0) {
      enemy.telegraphing = null;
      ed.telegraphProgress = 0;
      return;
    }

    // Smart vertical positioning
    const incomingAllyShot = b.projectiles.find(
      (p) => p.owner === 'ally' && p.alive && p.x > 420 && p.x < ed.x
    );
    if (incomingAllyShot && (enemy.strategy === 'tactico' || enemy.strategy === 'jefe')) {
      ed.aiTargetY = incomingAllyShot.y < ed.y ? Math.min(DUELIST_MAX_Y, ed.y + 68) : Math.max(DUELIST_MIN_Y, ed.y - 68);
    } else if (Math.abs(ed.y - ed.aiTargetY) < 8) {
      ed.aiTargetY = DUELIST_MIN_Y + 28 + Math.random() * (DUELIST_MAX_Y - DUELIST_MIN_Y - 56);
    }

    const aiMoveSpeed = ((enemy.chillTimer || 0) > 0 ? 105 : 168) * (enemy.isBoss ? 1.15 : 1);
    const dy = ed.aiTargetY - ed.y;
    if (Math.abs(dy) > 3) {
      ed.y += Math.sign(dy) * Math.min(Math.abs(dy), aiMoveSpeed * dt);
    }

    // Aim smoothly toward player
    const targetDx = pd.x - ed.x;
    const targetDy = pd.y - ed.y - 42; // slight upward arc compensation
    ed.aimAngle = Math.atan2(targetDy, targetDx);

    // Handle telegraphed heavy shot charging
    if (enemy.telegraphing === 'heavy') {
      const chargeSpeed = (enemy.chillTimer || 0) > 0 ? 0.52 : 0.78;
      ed.telegraphProgress += dt * chargeSpeed;
      ed.charge = Math.min(1, ed.telegraphProgress);
      if (ed.telegraphProgress >= 1) {
        enemy.telegraphing = null;
        ed.telegraphProgress = 0;
        ed.charge = 0;
        this.spawnEnemyProjectile(state, true);
        ed.aiCooldown = enemy.isBoss ? 1.75 : 2.15;
      }
      return;
    }

    ed.aiCooldown -= dt;
    if (ed.aiCooldown > 0) return;

    const hpPct = enemy.hp / Math.max(1, enemy.maxHp);
    if ((enemy.strategy === 'defensivo' || enemy.strategy === 'jefe') && hpPct < 0.55 && ed.guardCooldown <= 0 && Math.random() < 0.38) {
      ed.guardTimer = 1.6;
      ed.guardCooldown = 4.6;
      enemy.shieldTimer = 2.4;
      const heal = Math.round(enemy.maxHp * 0.08);
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + heal);
      sound.playShieldBlock(false);
      this.pushShockwave(ed.x, ed.y, 70, '#38bdf8', 'shield');
      this.pushEffect({ target: 'enemy', kind: 'shield', text: `+${heal} PS · 🛡`, color: '#38bdf8', x: ed.x, y: ed.y - 38 });
      ed.aiCooldown = 1.65;
      return;
    }

    if ((enemy.strategy === 'agresivo' || enemy.strategy === 'jefe') && Math.random() < 0.34) {
      enemy.telegraphing = 'heavy';
      ed.telegraphProgress = 0.05;
      this.battle!.pulseWindowActive = true;
      this.battle!.pulseReason = '¡Rival cargando disparo pesado! Interrúmpelo con Pulso o usa Escudo.';
      this.pushEffect({ target: 'enemy', kind: 'status', text: '⚠ ¡Cargando!', color: '#facc15', x: ed.x, y: ed.y - 44 });
      return;
    }

    this.spawnEnemyProjectile(state, false);
    const chillDelay = (enemy.chillTimer || 0) > 0 ? 0.55 : 0;
    ed.aiCooldown = (enemy.isBoss ? 1.45 : enemy.isMercenary ? 1.65 : 1.95) + chillDelay;
  }

  private spawnEnemyProjectile(_state: GameState, heavy: boolean): void {
    const b = this.battle;
    if (!b) return;
    const enemy = b.enemy;
    const ed = b.enemyDuelist;
    const pd = b.playerDuelist;
    const sp = getSpecies(enemy.id);
    const profile = getSlugCombatProfile(sp);

    // Boss & mercenary can fire varied species helpers occasionally
    const fireSpecies =
      enemy.isBoss && Math.random() < 0.35
        ? getSpecies(['infurnus', 'tazerling', 'frostcrawler', 'darkfurnus', 'enigmo'][Math.floor(Math.random() * 5)])
        : sp;
    const fireProfile = getSlugCombatProfile(fireSpecies);

    const dx = pd.x - (ed.x - 32);
    const dy = pd.y - ed.y;
    const speed = (heavy ? fireProfile.maxLaunchSpeed * 0.96 : fireProfile.baseLaunchSpeed * 1.12) * (enemy.isBoss ? 1.06 : 0.94);
    const flightT = Math.max(0.45, Math.abs(dx) / speed);
    const g = BASE_GRAVITY * fireProfile.gravityScale;
    const aimVy = dy / flightT - 0.5 * g * flightT;
    const aimVx = -Math.abs(dx / flightT);
    const mag = Math.hypot(aimVx, aimVy) || 1;
    const vx = (aimVx / mag) * speed;
    const vy = (aimVy / mag) * speed;

    const powerScore =
      enemy.atk *
      (heavy ? 1.45 : 0.88) *
      ((enemy.chillTimer || 0) > 0 ? 0.75 : 1);

    const move = fireSpecies.specialMoves[heavy ? 1 : 0];
    const proj: DuelProjectile = {
      id: projSeq++,
      owner: 'enemy',
      speciesId: fireSpecies.id,
      slugName: fireSpecies.name,
      element: fireSpecies.type,
      mega: enemy.mega && heavy,
      mode: heavy ? 'move1' : 'quick',
      moveEffect: heavy ? move.effect : undefined,
      x: ed.x - 34,
      y: ed.y,
      prevX: ed.x - 34,
      prevY: ed.y,
      vx,
      vy,
      radius: fireProfile.hitboxRadius + (heavy ? 3 : 0),
      distanceTraveled: 0,
      transformDist: heavy ? 110 : profile.transformDist,
      phase: 'protoform',
      transformTimer: 0,
      chargeScore: heavy ? 0.92 : 0.62,
      perfectRelease: heavy,
      powerScore,
      gravityScale: fireProfile.gravityScale,
      homing: heavy ? fireProfile.homing * 0.55 : fireProfile.homing * 0.3,
      bouncesLeft: fireProfile.bounces,
      phaseObstacles: fireProfile.phaseObstacles || heavy,
      pierceLeft: 0,
      aoeRadius: fireProfile.aoeRadius,
      trail: [],
      alive: true,
    };

    b.projectiles.push(proj);
    ed.recoil = 0.16;
    sound.playBlasterFire(heavy, false);
  }

  private updateProjectiles(dt: number, state: GameState): void {
    const b = this.battle;
    if (!b) return;
    const pd = b.playerDuelist;
    const ed = b.enemyDuelist;

    for (const p of b.projectiles) {
      if (!p.alive) continue;
      p.prevX = p.x;
      p.prevY = p.y;

      // Subtle homing after transformation
      if (p.phase === 'transformed' && p.homing > 0) {
        const target = p.owner === 'ally' ? ed : pd;
        const desiredAngle = Math.atan2(target.y - p.y, target.x - p.x);
        const curAngle = Math.atan2(p.vy, p.vx);
        let diff = desiredAngle - curAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const maxTurn = p.homing * dt;
        const nextAngle = curAngle + Math.max(-maxTurn, Math.min(maxTurn, diff));
        const spd = Math.hypot(p.vx, p.vy);
        p.vx = Math.cos(nextAngle) * spd;
        p.vy = Math.sin(nextAngle) * spd;
      }

      // Gravity
      p.vy += BASE_GRAVITY * p.gravityScale * dt;

      // Updraft & boost ring checks
      for (const obs of b.obstacles) {
        if (obs.kind === 'updraft' && this.circleRectOverlap(p.x, p.y, p.radius, obs)) {
          p.vy -= 520 * dt;
        } else if (obs.kind === 'boost_ring' && this.circleRectOverlap(p.x, p.y, p.radius, obs)) {
          const boostKey = `${p.id}_${obs.id}`;
          if (!this.boostedPairs.has(boostKey)) {
            this.boostedPairs.add(boostKey);
            p.vx *= 1.16;
            p.vy *= 1.08;
            p.powerScore *= 1.18;
            this.pushShockwave(obs.x + obs.w / 2, obs.y + obs.h / 2, 46, '#2dd4bf', 'transform');
            if (p.owner === 'ally') {
              const ally = state.party[state.activePartyIndex];
              if (ally) ally.energy = Math.min(ally.maxEnergy, ally.energy + 1);
            }
          }
        }
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.distanceTraveled += Math.hypot(p.x - p.prevX, p.y - p.prevY);

      p.trail.push({ x: p.x, y: p.y, r: p.phase === 'transformed' ? p.radius * 0.72 : p.radius * 0.48 });
      if (p.trail.length > 10) p.trail.shift();

      // Speed-triggered Velocimorph Transformation
      if (p.phase === 'protoform' && p.mode !== 'capsule' && p.distanceTraveled >= p.transformDist) {
        p.phase = 'transforming';
        p.transformTimer = 0.12;
        const elColor = ELEMENT_CHART[p.element]?.color || '#38bdf8';
        const profile = getSlugCombatProfile(p.speciesId);
        sound.playSlugTransform(p.element);
        this.pushShockwave(
          p.x,
          p.y,
          p.mega ? 62 : 48,
          p.mega ? '#fde047' : elColor,
          'transform',
          p.mode !== 'quick' ? profile.transformCallout : undefined
        );
      } else if (p.phase === 'transforming') {
        p.transformTimer -= dt;
        if (p.transformTimer <= 0) {
          p.phase = 'transformed';
        }
      }

      // Floor & Ceiling collision
      if (p.y + p.radius >= ARENA_FLOOR_Y) {
        if (p.bouncesLeft > 0) {
          p.bouncesLeft--;
          p.y = ARENA_FLOOR_Y - p.radius - 1;
          p.vy = -Math.abs(p.vy) * 0.78;
          this.pushShockwave(p.x, ARENA_FLOOR_Y, 32, ELEMENT_CHART[p.element]?.color || '#38bdf8', 'impact');
        } else {
          p.alive = false;
          this.pushShockwave(p.x, ARENA_FLOOR_Y, 36, ELEMENT_CHART[p.element]?.color || '#94a3b8', 'impact');
        }
      } else if (p.y - p.radius <= ARENA_CEIL_Y) {
        if (p.bouncesLeft > 0) {
          p.bouncesLeft--;
          p.y = ARENA_CEIL_Y + p.radius + 1;
          p.vy = Math.abs(p.vy) * 0.8;
        } else {
          p.vy = Math.abs(p.vy) * 0.4;
          p.y = ARENA_CEIL_Y + p.radius + 1;
        }
      }

      // Obstacle collisions (cover & reflectors)
      if (p.alive) {
        this.handleObstacleCollisions(p);
      }

      // Out of bounds horizontally
      if (p.x < -30 || p.x > ARENA_WIDTH + 30) {
        p.alive = false;
      }
    }

    // Remove dead obstacles & projectiles cleanly
    b.obstacles = b.obstacles.filter((o) => o.kind !== 'cover' || (o.hp ?? 1) > 0);
    b.projectiles = b.projectiles.filter((p) => p.alive);
  }

  private handleObstacleCollisions(p: DuelProjectile): void {
    const b = this.battle;
    if (!b) return;
    for (const obs of b.obstacles) {
      if (obs.kind !== 'cover' && obs.kind !== 'reflector') continue;
      if (!this.circleRectOverlap(p.x, p.y, p.radius, obs)) continue;

      if (obs.kind === 'reflector') {
        // Reflector bounces vertically/cleanly without destroying the projectile
        if (p.prevY <= obs.y || p.prevY >= obs.y + obs.h) {
          p.vy = -p.vy * 0.92;
          p.y = p.prevY <= obs.y ? obs.y - p.radius - 1 : obs.y + obs.h + p.radius + 1;
        } else {
          p.vx = -p.vx * 0.9;
        }
        p.powerScore *= 1.1;
        this.pushShockwave(p.x, p.y, 34, '#67e8f9', 'clash');
        return;
      }

      // Cover obstacle
      if (p.phaseObstacles) {
        continue;
      }
      const coverDmg = Math.max(12, Math.round(p.powerScore * 1.1));
      if (typeof obs.hp === 'number') {
        obs.hp = Math.max(0, obs.hp - coverDmg);
      }
      if (p.bouncesLeft > 0) {
        p.bouncesLeft--;
        if (Math.abs(p.prevY - (obs.y + obs.h / 2)) > obs.h * 0.42) {
          p.vy = -p.vy * 0.85;
          p.y = p.prevY < obs.y ? obs.y - p.radius - 1 : obs.y + obs.h + p.radius + 1;
        } else {
          p.vx = -p.vx * 0.82;
          p.x = p.prevX < obs.x ? obs.x - p.radius - 1 : obs.x + obs.w + p.radius + 1;
        }
      } else {
        p.alive = false;
      }
      this.pushShockwave(p.x, p.y, 40, ELEMENT_CHART[p.element]?.color || '#cbd5e1', 'impact');
      return;
    }
  }

  private resolveProjectileClashes(): void {
    const b = this.battle;
    if (!b) return;
    const allies = b.projectiles.filter((p) => p.alive && p.owner === 'ally' && p.mode !== 'capsule');
    const enemies = b.projectiles.filter((p) => p.alive && p.owner === 'enemy');

    for (const ap of allies) {
      if (!ap.alive) continue;
      for (const ep of enemies) {
        if (!ep.alive) continue;
        const dist = Math.hypot(ap.x - ep.x, ap.y - ep.y);
        if (dist > ap.radius + ep.radius + 4) continue;

        const elMult = getElementMultiplier(ap.element, ep.element);
        const allyClash = ap.powerScore * (ap.phase === 'transformed' ? 1.35 : 0.88) * elMult;
        const enemyClash = ep.powerScore * (ep.phase === 'transformed' ? 1.35 : 0.88);

        const cx = (ap.x + ep.x) / 2;
        const cy = (ap.y + ep.y) / 2;
        sound.playClash();
        b.hitstopTimer = 0.045;
        b.cameraShake = 5.5;
        b.pulseCharge = Math.min(100, b.pulseCharge + 14);
        this.checkPulseUnlock();

        if (allyClash > enemyClash * 1.25) {
          ep.alive = false;
          ap.powerScore *= 0.72;
          this.pushShockwave(cx, cy, 58, '#fde047', 'clash', '¡Dominio!');
          this.pushEffect({ target: 'enemy', kind: 'clash', text: '⚡ Choque ganado', color: '#fde047', x: cx, y: cy });
        } else if (enemyClash > allyClash * 1.25) {
          ap.alive = false;
          ep.powerScore *= 0.72;
          this.pushShockwave(cx, cy, 58, '#f87171', 'clash', '¡Interceptado!');
        } else {
          ap.alive = false;
          ep.alive = false;
          this.pushShockwave(cx, cy, 66, '#5eead4', 'clash', '¡CHOQUE!');
          this.pushEffect({ target: 'enemy', kind: 'clash', text: '💥 ¡CHOQUE!', color: '#5eead4', x: cx, y: cy });
          this.pushLog(`¡${ap.slugName} y ${ep.slugName} chocaron en el aire!`);
        }
        this.onStateChangeCallback?.();
        break;
      }
    }
  }

  private resolveDuelistCollisions(state: GameState): void {
    const b = this.battle;
    if (!b || b.turn !== 'duel') return;
    const pd = b.playerDuelist;
    const ed = b.enemyDuelist;
    const ally = state.party[state.activePartyIndex];
    const enemy = b.enemy;
    if (!ally) return;

    const enemyHitRadius = enemy.isBoss ? 38 : 30;
    const allyHitRadius = 29;

    for (const p of b.projectiles) {
      if (!p.alive) continue;

      if (p.owner === 'ally') {
        const dist = Math.hypot(p.x - ed.x, p.y - ed.y);
        if (dist <= p.radius + enemyHitRadius) {
          p.alive = false;
          if (p.mode === 'capsule') {
            this.resolveCaptureImpact(state, p);
          } else {
            this.applyAllyProjectileHit(state, p);
          }
          if (b.turn !== 'duel') return;
        }
      } else {
        const dist = Math.hypot(p.x - pd.x, p.y - pd.y);
        if (dist <= p.radius + allyHitRadius) {
          p.alive = false;
          this.applyEnemyProjectileHit(state, p);
          if (b.turn !== 'duel') return;
        }
      }
    }
  }

  private resolveCaptureImpact(state: GameState, p: DuelProjectile): void {
    const b = this.battle;
    if (!b) return;
    const ally = state.party[state.activePartyIndex];
    const enemy = b.enemy;
    const ed = b.enemyDuelist;
    if (!ally) return;

    const perkBonus = state.player.perks.includes('Vínculo Maestro') ? 0.14 : 0;
    const hpRatio = 1 - enemy.hp / enemy.maxHp;
    const stunBonus = (enemy.stunTimer || 0) > 0 ? 0.16 : 0;
    const baseChance = p.capsuleKey === 'masterCapsules' ? 0.6 : 0.28;
    const chance = Math.min(0.97, baseChance + hpRatio * 0.64 + stunBonus + perkBonus);

    if (Math.random() < chance) {
      sound.playCapture();
      sound.stopDuelMusic();
      const caught = createSlugInstance(enemy.id, enemy.level);
      state.seenSpecies[caught.id] = true;
      state.capturedSpecies[caught.id] = (state.capturedSpecies[caught.id] || 0) + 1;
      const addedToParty = state.party.length < 4;
      if (addedToParty) {
        state.party.push(caught);
      } else {
        state.storage.push(caught);
      }
      this.awardExperience(state, ally, 18 + enemy.level * 4, 5);
      this.pushShockwave(ed.x, ed.y, 92, '#4ade80', 'capture', '¡CAPTURADA!');
      b.turn = 'ended';
      b.outcome = 'captured';
      b.rewardText = addedToParty
        ? `¡Capturaste a ${caught.name} (Nv.${caught.level})! Añadida al estuche.`
        : `¡Capturaste a ${caught.name} (Nv.${caught.level})! Enviada al Refugio.`;
      this.pushEffect({ target: 'enemy', kind: 'capture', text: '¡CAPTURADA!', color: '#4ade80', x: ed.x, y: ed.y - 40 });
      this.pushLog(b.rewardText);
    } else {
      sound.playHit(false);
      this.pushShockwave(ed.x, ed.y, 62, '#f59e0b', 'impact', '¡Escapó!');
      this.pushEffect({ target: 'enemy', kind: 'status', text: '¡Cilindro abierto!', color: '#f59e0b', x: ed.x, y: ed.y - 38 });
      this.pushLog('El cilindro se abrió en el último segundo. ¡Debilítala un poco más!');
    }
    this.onStateChangeCallback?.();
  }

  private applyAllyProjectileHit(state: GameState, p: DuelProjectile): void {
    const b = this.battle;
    if (!b) return;
    const ally = state.party[state.activePartyIndex];
    const enemy = b.enemy;
    const ed = b.enemyDuelist;
    if (!ally) return;

    const mult = getElementMultiplier(p.element, enemy.type);
    const transformedMult = p.phase === 'transformed' || p.phase === 'transforming' ? 1.25 : 0.78;
    const pierce = p.moveEffect === 'pierce' || p.mode === 'pulse';
    const hasShield = (enemy.shieldTimer || 0) > 0 || ed.guardTimer > 0;
    const dmg = this.calcDamage(p.powerScore * transformedMult, enemy.def, mult, hasShield, pierce);

    enemy.hp = Math.max(0, enemy.hp - dmg);
    ed.hitFlash = 0.2;
    b.hitstopTimer = p.mode !== 'quick' || p.perfectRelease ? 0.045 : 0.022;
    b.cameraShake = p.mode !== 'quick' ? 6 : 3;

    if (p.mode === 'quick') {
      ally.energy = Math.min(ally.maxEnergy, ally.energy + (p.perfectRelease ? 3 : 2));
      b.pulseCharge = Math.min(100, b.pulseCharge + (p.perfectRelease ? 22 : 16));
    } else {
      b.pulseCharge = Math.min(100, b.pulseCharge + 14);
    }

    if ((p.mode === 'pulse' || p.phase === 'transformed') && enemy.telegraphing === 'heavy') {
      enemy.telegraphing = null;
      ed.telegraphProgress = 0;
      ed.charge = 0;
      enemy.stunTimer = Math.max(enemy.stunTimer || 0, 1.35);
      this.pushLog(`⚡ ¡Disparo interceptado! ${enemy.name} pierde su carga.`);
    }

    const elColor = ELEMENT_CHART[p.element]?.color || '#38bdf8';
    sound.playHit(mult > 1.2 || p.mode !== 'quick');
    this.pushShockwave(ed.x, ed.y, Math.max(46, p.aoeRadius + 16), elColor, 'impact');

    this.pushEffect({
      target: 'enemy',
      kind: mult > 1.2 ? 'crit' : 'hit',
      text: `-${dmg}${mult > 1.2 ? ' ¡Eficaz!' : pierce ? ' Perf.' : ''}`,
      color: mult > 1.2 ? '#fde047' : '#f87171',
      x: ed.x,
      y: ed.y - 36,
    });

    if (p.moveEffect === 'burn') {
      enemy.burnTimer = 4.2;
      enemy.burnTurns = 2;
      this.pushEffect({ target: 'enemy', kind: 'status', text: '🔥 Quemada', color: '#fb923c', x: ed.x, y: ed.y - 54 });
    } else if (p.moveEffect === 'chill') {
      enemy.chillTimer = 4.5;
      enemy.chillTurns = 2;
      this.pushEffect({ target: 'enemy', kind: 'status', text: '❄️ Ralentizada', color: '#67e8f9', x: ed.x, y: ed.y - 54 });
    } else if (p.moveEffect === 'stun' && Math.random() < 0.72) {
      enemy.stunTimer = 1.65;
      enemy.stunTurns = 1;
      enemy.telegraphing = null;
      ed.telegraphProgress = 0;
      this.pushEffect({ target: 'enemy', kind: 'status', text: '⚡ Aturdida', color: '#facc15', x: ed.x, y: ed.y - 54 });
    } else if (p.moveEffect === 'drain') {
      const drain = Math.max(5, Math.round(dmg * 0.42));
      ally.hp = Math.min(ally.maxHp, ally.hp + drain);
      this.pushEffect({
        target: 'ally',
        kind: 'heal',
        text: `+${drain} PS`,
        color: '#4ade80',
        x: b.playerDuelist.x,
        y: b.playerDuelist.y - 34,
      });
    }

    this.checkPulseUnlock();

    if (enemy.hp <= 0) {
      this.handleVictory(state);
    }
    this.onStateChangeCallback?.();
  }

  private applyEnemyProjectileHit(state: GameState, p: DuelProjectile): void {
    const b = this.battle;
    if (!b) return;
    let ally = state.party[state.activePartyIndex];
    const pd = b.playerDuelist;
    if (!ally) return;

    const guardActive = pd.guardTimer > 0 || b.allyStatus.shieldTimer > 0;
    const perfectGuard = pd.guardTimer > 0.55;
    const mult = getElementMultiplier(p.element, ally.type);
    const transformedMult = p.phase === 'transformed' ? 1.18 : 0.85;
    const pierce = p.moveEffect === 'pierce';

    let dmg = this.calcDamage(p.powerScore * transformedMult, ally.def, mult, guardActive, pierce);
    if (perfectGuard && !pierce) {
      dmg = Math.max(1, Math.round(dmg * 0.45));
      ally.energy = Math.min(ally.maxEnergy, ally.energy + 3);
      b.pulseCharge = Math.min(100, b.pulseCharge + 18);
      sound.playShieldBlock(true);
      this.pushShockwave(pd.x, pd.y, 70, '#5eead4', 'shield', '¡Bloqueo!');
      this.pushEffect({
        target: 'ally',
        kind: 'shield',
        text: `🛡 -${dmg} (+3 EN)`,
        color: '#5eead4',
        x: pd.x,
        y: pd.y - 38,
      });
    } else {
      sound.playHit(p.mode !== 'quick');
      pd.hitFlash = 0.22;
      b.cameraShake = Math.max(b.cameraShake, 4);
      this.pushShockwave(pd.x, pd.y, 50, '#ef4444', 'impact');
      this.pushEffect({
        target: 'ally',
        kind: 'hit',
        text: `-${dmg}`,
        color: '#f87171',
        x: pd.x,
        y: pd.y - 36,
      });
    }

    ally.hp = Math.max(0, ally.hp - dmg);
    if (!guardActive && p.moveEffect === 'burn') {
      b.allyStatus.burnTimer = 3.2;
      this.allyBurnTurns = 1;
    } else if (!guardActive && p.moveEffect === 'chill') {
      b.allyStatus.chillTimer = 3.4;
      this.allyChillTurns = 1;
    } else if (!guardActive && p.moveEffect === 'stun' && Math.random() < 0.45) {
      b.allyStatus.stunTimer = 0.85;
    }

    b.pulseCharge = Math.min(100, b.pulseCharge + 12);
    this.checkPulseUnlock();

    if (ally.hp <= 0) {
      const nextIdx = state.party.findIndex((s) => s.hp > 0);
      if (nextIdx >= 0) {
        state.activePartyIndex = nextIdx;
        ally = state.party[nextIdx];
        ensureSlugProgressionFields(ally);
        this.participatedUids.add(ally.uid);
        b.selectedMode = 'quick';
        b.allyStatus.burnTimer = 0;
        b.allyStatus.chillTimer = 0;
        b.allyStatus.stunTimer = 0;
        this.pushLog(`¡${ally.name} entra al bláster para relevar a tu compañera!`);
      } else {
        sound.stopDuelMusic();
        state.player.hp = Math.max(20, Math.round(state.player.maxHp * 0.5));
        state.party.forEach((s) => {
          s.hp = Math.max(5, Math.round(s.maxHp * 0.35));
          s.energy = s.maxEnergy;
        });
        b.turn = 'ended';
        b.outcome = 'defeat';
        b.rewardText = 'Tu equipo se retiró al refugio para recuperarse.';
        this.pushLog(b.rewardText);
      }
    }
    this.onStateChangeCallback?.();
  }

  private checkPulseUnlock(reason?: string): void {
    if (!this.battle) return;
    if (this.battle.pulseCharge >= 100 || this.battle.enemy.telegraphing === 'heavy') {
      this.battle.pulseWindowActive = true;
      this.battle.pulseReason =
        reason ||
        (this.battle.enemy.telegraphing === 'heavy'
          ? '¡Rival cargando disparo pesado! Pulso Maestro listo.'
          : '¡Pulso al 100%! Disparo Maestro sin coste de energía.');
    }
  }

  private circleRectOverlap(cx: number, cy: number, r: number, rect: DuelArenaObstacle): boolean {
    const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
    const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
    const dx = cx - closestX;
    const dy = cy - closestY;
    return dx * dx + dy * dy <= r * r;
  }

  private calcDamage(
    rawAttack: number,
    def: number,
    typeMult: number,
    hasShield: boolean,
    pierce: boolean
  ): number {
    const mitigation = pierce ? 1 : 100 / (100 + def * 2.15);
    const shieldMult = hasShield && !pierce ? 0.38 : 1;
    return Math.max(2, Math.round(rawAttack * mitigation * typeMult * shieldMult));
  }

  private handleVictory(state: GameState): void {
    if (!this.battle) return;
    sound.stopDuelMusic();
    const enemy = this.battle.enemy;
    const ally = state.party[state.activePartyIndex];
    sound.playVictory();

    state.stats.wins++;
    const xpGain = (enemy.isBoss ? 85 : enemy.isMercenary ? 45 : 26) + enemy.level * 6;
    const levelMsgs = ally ? this.awardExperience(state, ally, xpGain, 6) : [];

    // Award partial XP/bond ONLY to other party slugs that actively entered this battle
    const partnerXp = Math.max(8, Math.round(xpGain * 0.65));
    for (const member of state.party) {
      if (ally && member.uid !== ally.uid && this.participatedUids.has(member.uid)) {
        const subMsgs = awardSlugExperience(state, member, partnerXp, { bondDelta: 4 });
        levelMsgs.push(...subMsgs);
      }
    }

    state.player.xp += Math.round(xpGain * 0.5);

    let rewardText = ally ? `+${xpGain} EXP para ${ally.name}.` : `+${xpGain} EXP.`;
    if (enemy.isBoss && enemy.bossId) {
      if (!state.defeatedBosses.includes(enemy.bossId)) {
        state.defeatedBosses.push(enemy.bossId);
        state.stats.bossesDefeated = state.defeatedBosses.length;
      }
      state.inventory.relics += 2;
      state.inventory.masterCapsules += 1;
      state.inventory.crystal += 3;
      rewardText = `¡Jefe derrotado! +2 Reliquias, +1 Cilindro Maestro, +3 Cristales.`;
    } else if (enemy.isMercenary) {
      state.inventory.ore += 5;
      state.inventory.capsules += 1;
      rewardText = `¡Mercenario derrotado! +5 Minerales, +1 Cilindro.`;
    } else {
      state.inventory.ore += 2;
      rewardText = `¡Victoria! +2 Minerales y ${xpGain} EXP.`;
    }

    if (levelMsgs.length > 0) {
      rewardText += ` ${levelMsgs.join(' ')}`;
    }

    this.battle.turn = 'ended';
    this.battle.outcome = 'victory';
    this.battle.rewardText = rewardText;
    this.pushLog(rewardText);
    this.onStateChangeCallback?.();
  }

  public awardExperience(
    state: GameState,
    slug: SlugInstance,
    amount: number,
    bondDelta = 6
  ): string[] {
    return awardSlugExperience(state, slug, amount, { bondDelta });
  }

  public getParticipatedUids(): string[] {
    return Array.from(this.participatedUids);
  }

  public closeBattle(): void {
    this.clearPendingTimers();
    sound.stopDuelMusic();
    this.participatedUids.clear();
    this.boostedPairs.clear();
    this.verticalInput = 0;
    const endedBattle = this.battle;
    const cb = this.onBattleEndCallback;
    this.battle = null;
    this.onBattleEndCallback = null;
    this.onStateChangeCallback = null;
    if (cb) cb(endedBattle);
  }
}
