import { sound } from './audio';
import { createSlugInstance, getElementMultiplier, getSpecies } from './data';
import {
  awardSlugExperience,
  ensureSlugProgressionFields,
  getEffectiveMoveEnergyCost,
  getMoveMasteryInfo,
  grantMoveMastery,
} from './progression';
import type {
  BattleState,
  CombatEffectEvent,
  CombatantState,
  EnemyStrategy,
  GameState,
  SlugInstance,
} from './types';

let effectSeq = 1;

export class CombatManager {
  public battle: BattleState | null = null;
  public allyCooldowns: Record<string, number> = {};
  public allyShieldTurns = 0;
  public allyBurnTurns = 0;
  public allyChillTurns = 0;
  private participatedUids = new Set<string>();
  private onBattleEndCallback: ((endedBattle: BattleState | null) => void) | null = null;
  private onStateChangeCallback: (() => void) | null = null;
  private enemyTurnTimer: ReturnType<typeof setTimeout> | null = null;

  private clearPendingTimers(): void {
    if (this.enemyTurnTimer !== null) {
      clearTimeout(this.enemyTurnTimer);
      this.enemyTurnTimer = null;
    }
  }

  public startBattle(
    state: GameState,
    opts: {
      kind: 'wild' | 'mercenary' | 'boss';
      speciesId: string;
      level: number;
      nameOverride?: string;
      bossId?: string;
      iconOverride?: string;
      onEnd?: (endedBattle?: BattleState | null) => void;
      onStateChange?: () => void;
    }
  ): BattleState {
    this.clearPendingTimers();
    const aliveIdx = state.party.findIndex((s) => s.hp > 0);
    if (aliveIdx >= 0 && state.party[state.activePartyIndex]?.hp <= 0) {
      state.activePartyIndex = aliveIdx;
    }

    this.participatedUids.clear();
    const starter = state.party[state.activePartyIndex];
    if (starter) {
      ensureSlugProgressionFields(starter);
      this.participatedUids.add(starter.uid);
    }

    const sp = getSpecies(opts.speciesId);
    const mult = opts.kind === 'boss' ? 2.15 : opts.kind === 'mercenary' ? 1.3 : 1;
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
      atk: Math.round(base.atk * (opts.kind === 'boss' ? 1.35 : opts.kind === 'mercenary' ? 1.15 : 0.92)),
      def: base.def,
      spd: base.spd,
      mega: opts.kind === 'boss',
      shieldTurns: 0,
      burnTurns: 0,
      stunTurns: 0,
      chillTurns: 0,
      telegraphing: null,
      strategy,
      isBoss: opts.kind === 'boss',
      bossId: opts.bossId,
      isMercenary: opts.kind === 'mercenary',
      cooldowns: {},
    };

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
      subtitle:
        opts.kind === 'boss'
          ? 'Jefe de Bioma · Encuentro Crítico'
          : opts.kind === 'mercenary'
          ? 'Duelista rival · Mercenario de Blakk'
          : `Babosa salvaje · Nv.${opts.level} (${strategy})`,
      enemy,
      turn: 'player',
      pulseCharge: 35,
      pulseWindowActive: false,
      pulseReason: '',
      log: [
        opts.kind === 'boss'
          ? `¡${enemy.name} emerge de las profundidades!`
          : opts.kind === 'mercenary'
          ? `¡El mercenario lanza a ${enemy.name}!`
          : `¡Aparece ${enemy.name}!`,
      ],
      effects: [],
    };
    return this.battle;
  }

  private pushEffect(ev: Omit<CombatEffectEvent, 'id'>): void {
    if (!this.battle) return;
    this.battle.effects = [...this.battle.effects.slice(-5), { ...ev, id: effectSeq++ }];
  }

  private pushLog(msg: string): void {
    if (!this.battle) return;
    this.battle.log = [msg, ...this.battle.log].slice(0, 6);
  }

  private tickAllyCooldowns(): void {
    for (const k of Object.keys(this.allyCooldowns)) {
      if (this.allyCooldowns[k] > 0) this.allyCooldowns[k]--;
    }
    if (this.allyShieldTurns > 0) this.allyShieldTurns--;
    if (this.allyChillTurns > 0) this.allyChillTurns--;
  }

  private checkPulseUnlock(reason?: string): void {
    if (!this.battle) return;
    if (this.battle.pulseCharge >= 100 || this.battle.enemy.telegraphing === 'heavy') {
      this.battle.pulseWindowActive = true;
      this.battle.pulseReason =
        reason ||
        (this.battle.enemy.telegraphing === 'heavy'
          ? '¡Rival cargando ataque pesado! Pulso Rápido listo para interrumpir.'
          : '¡Pulso al 100%! Ejecuta una acción inmediata.');
    }
  }

  public executeNormalAttack(state: GameState): void {
    if (!this.battle || this.battle.turn !== 'player') return;
    const ally = state.party[state.activePartyIndex];
    const enemy = this.battle.enemy;
    if (!ally) return;
    this.participatedUids.add(ally.uid);

    this.tickAllyCooldowns();
    const mult = getElementMultiplier(ally.type, enemy.type);
    const raw = ally.atk * (0.95 + Math.random() * 0.2) * (this.allyChillTurns > 0 ? 0.78 : 1);
    const dmg = this.calcDamage(raw, enemy.def, mult, enemy.shieldTurns > 0, false);

    enemy.hp = Math.max(0, enemy.hp - dmg);
    ally.energy = Math.min(ally.maxEnergy, ally.energy + 2);
    this.battle.pulseCharge = Math.min(100, this.battle.pulseCharge + 24);

    sound.playHit(mult > 1.2);
    this.pushEffect({
      target: 'enemy',
      kind: mult > 1.2 ? 'crit' : 'hit',
      text: `-${dmg}${mult > 1.2 ? ' ¡Eficaz!' : mult < 0.9 ? ' Resistido' : ''}`,
      color: mult > 1.2 ? '#facc15' : '#f87171',
    });
    this.pushLog(`${ally.name} ataca e inflige ${dmg} de daño.`);
    this.checkPulseUnlock();

    if (enemy.hp <= 0) {
      this.handleVictory(state);
      return;
    }
    this.advanceToEnemyTurn(state);
  }

  public executeSpecialMove(state: GameState, moveIndex: 0 | 1): void {
    if (!this.battle || this.battle.turn !== 'player') return;
    const ally = state.party[state.activePartyIndex];
    const enemy = this.battle.enemy;
    if (!ally) return;
    ensureSlugProgressionFields(ally);
    this.participatedUids.add(ally.uid);

    const sp = getSpecies(ally.id);
    const move = sp.specialMoves[moveIndex];
    if (!move) return;

    const masteryPts = ally.moveMastery?.[moveIndex] ?? 0;
    const masteryInfo = getMoveMasteryInfo(masteryPts);
    const effectiveCost = getEffectiveMoveEnergyCost(move.energyCost, masteryPts);

    const cd = this.allyCooldowns[move.id] || 0;
    if (cd > 0) {
      this.pushLog(`${move.name} está en enfriamiento (${cd}t).`);
      return;
    }
    if (ally.energy < effectiveCost) {
      this.pushLog(`Energía insuficiente para ${move.name}.`);
      return;
    }

    this.tickAllyCooldowns();
    ally.energy -= effectiveCost;
    this.allyCooldowns[move.id] = move.cooldown + 1;
    this.battle.pulseCharge = Math.min(100, this.battle.pulseCharge + 18);

    if (move.effect === 'heal') {
      const healMult = 1 + masteryInfo.rank * 0.05;
      const healAmt = Math.max(12, Math.round(ally.maxHp * 0.38 * healMult));
      ally.hp = Math.min(ally.maxHp, ally.hp + healAmt);
      this.allyBurnTurns = 0;
      if (move.id === 'resonance') this.allyShieldTurns = 2;
      sound.playHeal();
      this.pushEffect({ target: 'ally', kind: 'heal', text: `+${healAmt} PS`, color: '#4ade80' });
      this.pushLog(`${ally.name} usa ${move.name} y recupera ${healAmt} PS.`);
    } else {
      const mult = getElementMultiplier(ally.type, enemy.type);
      const pierce = move.effect === 'pierce';
      const raw =
        ally.atk *
        move.power *
        masteryInfo.powerMultiplier *
        (this.allyChillTurns > 0 ? 0.8 : 1);
      const dmg = this.calcDamage(raw, enemy.def, mult, enemy.shieldTurns > 0, pierce);
      enemy.hp = Math.max(0, enemy.hp - dmg);

      sound.playHit(mult > 1.2 || move.power >= 1.6);
      this.pushEffect({
        target: 'enemy',
        kind: mult > 1.2 ? 'crit' : 'hit',
        text: `-${dmg}${pierce ? ' Perforante' : ''}`,
        color: mult > 1.2 ? '#fde047' : '#38bdf8',
      });
      this.pushLog(`${ally.name} lanza ${move.name} (${dmg} daño).`);

      if (move.effect === 'burn') {
        enemy.burnTurns = 2;
        this.pushEffect({ target: 'enemy', kind: 'status', text: '🔥 Quemado', color: '#fb923c' });
      } else if (move.effect === 'chill') {
        enemy.chillTurns = 2;
        this.pushEffect({ target: 'enemy', kind: 'status', text: '❄️ Enfriado', color: '#67e8f9' });
      } else if (move.effect === 'stun' && Math.random() < 0.65) {
        enemy.stunTurns = 1;
        enemy.telegraphing = null;
        this.pushEffect({ target: 'enemy', kind: 'status', text: '⚡ Aturdido', color: '#facc15' });
      } else if (move.effect === 'shield') {
        this.allyShieldTurns = 2;
        this.pushEffect({ target: 'ally', kind: 'shield', text: '🛡 Escudo', color: '#38bdf8' });
      } else if (move.effect === 'drain') {
        const drain = Math.max(5, Math.round(dmg * 0.42));
        ally.hp = Math.min(ally.maxHp, ally.hp + drain);
        this.pushEffect({ target: 'ally', kind: 'heal', text: `+${drain} PS`, color: '#4ade80' });
      }
    }

    // Advance move mastery gradually (+10 per combat use)
    const masteryStep = grantMoveMastery(ally, moveIndex, 10);
    if (masteryStep.newRank > masteryStep.previousRank) {
      this.pushLog(`✦ ¡${move.name} alcanza ${masteryStep.newLabel}!`);
    }

    this.checkPulseUnlock();
    if (enemy.hp <= 0) {
      this.handleVictory(state);
      return;
    }
    this.advanceToEnemyTurn(state);
  }

  public executeDefense(state: GameState): void {
    if (!this.battle || this.battle.turn !== 'player') return;
    const ally = state.party[state.activePartyIndex];
    if (!ally) return;
    this.participatedUids.add(ally.uid);
    this.tickAllyCooldowns();
    this.allyShieldTurns = 2;
    ally.energy = Math.min(ally.maxEnergy, ally.energy + 4);
    this.battle.pulseCharge = Math.min(100, this.battle.pulseCharge + 30);
    sound.playHeal();
    this.pushEffect({ target: 'ally', kind: 'shield', text: '🛡 Defensa +4 EN', color: '#38bdf8' });
    this.pushLog(`${ally.name} adopta guardia elemental (+4 Energía, escudo activo).`);
    this.checkPulseUnlock();
    this.advanceToEnemyTurn(state);
  }

  public triggerPulsoRapido(state: GameState, precisionScore: number): void {
    if (!this.battle || !this.battle.pulseWindowActive || this.battle.turn !== 'player') return;
    const ally = state.party[state.activePartyIndex];
    const enemy = this.battle.enemy;
    if (!ally) return;
    this.participatedUids.add(ally.uid);

    this.battle.pulseCharge = Math.max(0, this.battle.pulseCharge - 100);
    this.battle.pulseWindowActive = false;
    this.battle.pulseReason = '';

    const wasTelegraph = enemy.telegraphing === 'heavy';
    const qualityMult = precisionScore >= 0.72 ? 1.85 : precisionScore >= 0.4 ? 1.35 : 0.95;
    const mult = getElementMultiplier(ally.type, enemy.type);
    const dmg = Math.max(8, Math.round(ally.atk * qualityMult * mult));

    enemy.hp = Math.max(0, enemy.hp - dmg);
    if (wasTelegraph && precisionScore >= 0.4) {
      enemy.telegraphing = null;
      enemy.stunTurns = 1;
    }
    ally.energy = Math.min(ally.maxEnergy, ally.energy + 3);

    sound.playPulse();
    this.pushEffect({
      target: 'enemy',
      kind: 'pulse',
      text: `⚡ PULSO -${dmg}${wasTelegraph && precisionScore >= 0.4 ? ' ¡INTERRUMPIDO!' : ''}`,
      color: '#2dd4bf',
    });
    this.pushLog(
      precisionScore >= 0.72
        ? `¡PULSO RÁPIDO PERFECTO! ${ally.name} ejecuta un contraataque instantáneo de ${dmg} daño.`
        : `¡PULSO RÁPIDO! ${ally.name} golpea al instante por ${dmg} de daño (conservas tu turno).`
    );

    if (enemy.hp <= 0) {
      this.handleVictory(state);
    }
  }

  public useItem(state: GameState, itemKey: 'berries' | 'core' | 'capsules' | 'masterCapsules'): void {
    if (!this.battle || this.battle.turn !== 'player') return;
    const ally = state.party[state.activePartyIndex];
    const enemy = this.battle.enemy;
    if (!ally) return;
    this.participatedUids.add(ally.uid);

    if (state.inventory[itemKey] <= 0) {
      this.pushLog('No te quedan unidades de ese objeto.');
      return;
    }

    if (itemKey === 'berries') {
      state.inventory.berries--;
      const heal = 32;
      ally.hp = Math.min(ally.maxHp, ally.hp + heal);
      sound.playHeal();
      this.pushEffect({ target: 'ally', kind: 'heal', text: `+${heal} PS`, color: '#4ade80' });
      this.pushLog(`${ally.name} consume una baya y recupera ${heal} PS.`);
      this.advanceToEnemyTurn(state);
      return;
    }

    if (itemKey === 'core') {
      state.inventory.core--;
      ally.energy = Math.min(ally.maxEnergy, ally.energy + 8);
      sound.playPulse();
      this.pushEffect({ target: 'ally', kind: 'heal', text: '+8 Energía', color: '#38bdf8' });
      this.pushLog(`Núcleo de energía aplicado (+8 EN a ${ally.name}).`);
      this.advanceToEnemyTurn(state);
      return;
    }

    if (enemy.isBoss || enemy.isMercenary) {
      this.pushLog('No puedes capturar babosas de jefes o mercenarios.');
      return;
    }

    state.inventory[itemKey]--;
    const perkBonus = state.player.perks.includes('Vínculo Maestro') ? 0.14 : 0;
    const hpRatio = 1 - enemy.hp / enemy.maxHp;
    const stunBonus = enemy.stunTurns > 0 ? 0.15 : 0;
    const baseChance = itemKey === 'masterCapsules' ? 0.58 : 0.24;
    const chance = Math.min(0.97, baseChance + hpRatio * 0.65 + stunBonus + perkBonus);

    if (Math.random() < chance) {
      sound.playCapture();
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
      this.battle.turn = 'ended';
      this.battle.outcome = 'captured';
      this.battle.rewardText = addedToParty
        ? `¡Capturaste a ${caught.name} (Nv.${caught.level})! Añadida al estuche.`
        : `¡Capturaste a ${caught.name} (Nv.${caught.level})! Enviada al Refugio.`;
      this.pushEffect({ target: 'enemy', kind: 'capture', text: '¡CAPTURADA!', color: '#4ade80' });
      this.pushLog(this.battle.rewardText);
    } else {
      sound.playHit(false);
      this.pushEffect({ target: 'enemy', kind: 'status', text: '¡Escapó!', color: '#f59e0b' });
      this.pushLog('El cilindro se abrió en el último segundo. ¡Intenta debilitarla más!');
      this.advanceToEnemyTurn(state);
    }
  }

  public swapSlug(state: GameState, partyIdx: number): void {
    if (!this.battle || this.battle.turn !== 'player') return;
    const target = state.party[partyIdx];
    if (!target || target.hp <= 0 || partyIdx === state.activePartyIndex) return;
    state.activePartyIndex = partyIdx;
    ensureSlugProgressionFields(target);
    this.participatedUids.add(target.uid);
    this.allyShieldTurns = 0;
    this.allyBurnTurns = 0;
    this.allyChillTurns = 0;
    this.allyCooldowns = {};
    sound.playUi();
    this.pushLog(`¡Adelante, ${target.name} (${target.type})!`);
    this.advanceToEnemyTurn(state);
  }

  public attemptRun(state: GameState): void {
    if (!this.battle || this.battle.turn !== 'player') return;
    if (this.battle.kind === 'boss') {
      this.pushLog('¡No puedes huir de un Jefe de Bioma!');
      return;
    }
    const ally = state.party[state.activePartyIndex];
    const chance = this.battle.kind === 'mercenary' ? 0.35 : 0.65 + ally.spd * 0.015;
    if (Math.random() < chance) {
      this.battle.turn = 'ended';
      this.battle.outcome = 'escaped';
      this.battle.rewardText = 'Lograste retirarte con seguridad.';
      this.pushLog(this.battle.rewardText);
    } else {
      this.pushLog('¡El enemigo bloqueó la ruta de escape!');
      this.advanceToEnemyTurn(state);
    }
  }

  private advanceToEnemyTurn(state: GameState): void {
    if (!this.battle) return;
    this.clearPendingTimers();
    this.battle.turn = 'enemy';
    this.enemyTurnTimer = setTimeout(() => {
      this.enemyTurnTimer = null;
      this.resolveEnemyTurn(state);
    }, 520);
  }

  public resolveEnemyTurn(state: GameState): void {
    if (!this.battle || this.battle.turn !== 'enemy') return;
    const enemy = this.battle.enemy;
    let ally = state.party[state.activePartyIndex];

    if (enemy.burnTurns > 0) {
      const burnDmg = Math.max(3, Math.round(enemy.maxHp * 0.08));
      enemy.hp = Math.max(0, enemy.hp - burnDmg);
      enemy.burnTurns--;
      this.pushEffect({ target: 'enemy', kind: 'hit', text: `🔥 -${burnDmg}`, color: '#fb923c' });
      if (enemy.hp <= 0) {
        this.handleVictory(state);
        this.onStateChangeCallback?.();
        return;
      }
    }

    if (enemy.shieldTurns > 0) enemy.shieldTurns--;
    if (enemy.chillTurns > 0) enemy.chillTurns--;

    if (enemy.stunTurns > 0) {
      enemy.stunTurns--;
      this.pushLog(`${enemy.name} está aturdido y pierde su turno.`);
      this.battle.turn = 'player';
      this.onStateChangeCallback?.();
      return;
    }

    const hpPct = enemy.hp / enemy.maxHp;
    if (enemy.telegraphing === 'heavy') {
      enemy.telegraphing = null;
      const mult = getElementMultiplier(enemy.type, ally.type);
      const dmg = this.calcDamage(enemy.atk * 1.55, ally.def, mult, this.allyShieldTurns > 0, false);
      ally.hp = Math.max(0, ally.hp - dmg);
      sound.playHit(true);
      this.pushEffect({ target: 'ally', kind: 'crit', text: `-${dmg} ¡Golpe Cargado!`, color: '#ef4444' });
      this.pushLog(`${enemy.name} descarga su ataque pesado e inflige ${dmg} de daño.`);
    } else if ((enemy.strategy === 'defensivo' || enemy.strategy === 'jefe') && hpPct < 0.45 && Math.random() < 0.45) {
      const heal = Math.round(enemy.maxHp * 0.14);
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + heal);
      enemy.shieldTurns = 2;
      sound.playHeal();
      this.pushEffect({ target: 'enemy', kind: 'shield', text: `+${heal} PS · 🛡`, color: '#38bdf8' });
      this.pushLog(`${enemy.name} levanta un escudo y regenera ${heal} PS.`);
    } else if ((enemy.strategy === 'agresivo' || enemy.strategy === 'jefe') && Math.random() < 0.36) {
      enemy.telegraphing = 'heavy';
      this.battle.pulseWindowActive = true;
      this.battle.pulseReason = '¡El enemigo está cargando un golpe devastador! Activa PULSO RÁPIDO o Defiéndete.';
      this.pushEffect({ target: 'enemy', kind: 'status', text: '⚠ Cargando ataque', color: '#facc15' });
      this.pushLog(`${enemy.name} concentra energía para un ataque pesado en el próximo turno.`);
    } else {
      const mult = getElementMultiplier(enemy.type, ally.type);
      const chillFactor = enemy.chillTurns > 0 ? 0.72 : 1;
      const dmg = this.calcDamage(enemy.atk * 0.92 * chillFactor, ally.def, mult, this.allyShieldTurns > 0, false);
      ally.hp = Math.max(0, ally.hp - dmg);
      if (enemy.strategy === 'tactico' && Math.random() < 0.35) {
        ally.energy = Math.max(0, ally.energy - 2);
      }
      sound.playHit(mult > 1.2);
      this.pushEffect({ target: 'ally', kind: 'hit', text: `-${dmg}`, color: '#f87171' });
      this.pushLog(`${enemy.name} ataca por ${dmg} de daño.`);
    }

    this.battle.pulseCharge = Math.min(100, this.battle.pulseCharge + 18);
    this.checkPulseUnlock();

    if (ally.hp <= 0) {
      const nextIdx = state.party.findIndex((s) => s.hp > 0);
      if (nextIdx >= 0) {
        state.activePartyIndex = nextIdx;
        ally = state.party[nextIdx];
        ensureSlugProgressionFields(ally);
        this.participatedUids.add(ally.uid);
        this.allyShieldTurns = 0;
        this.pushLog(`¡${ally.name} entra al combate para reemplazar a tu compañera debilitada!`);
      } else {
        state.player.hp = Math.max(20, Math.round(state.player.maxHp * 0.5));
        state.party.forEach((s) => {
          s.hp = Math.max(5, Math.round(s.maxHp * 0.35));
          s.energy = s.maxEnergy;
        });
        this.battle.turn = 'ended';
        this.battle.outcome = 'defeat';
        this.battle.rewardText = 'Tu equipo se retiró al refugio para recuperarse.';
        this.pushLog(this.battle.rewardText);
        this.onStateChangeCallback?.();
        return;
      }
    }

    this.battle.turn = 'player';
    this.onStateChangeCallback?.();
  }

  private calcDamage(
    rawAttack: number,
    def: number,
    typeMult: number,
    hasShield: boolean,
    pierce: boolean
  ): number {
    const mitigation = pierce ? 1 : 100 / (100 + def * 2.2);
    const shieldMult = hasShield && !pierce ? 0.42 : 1;
    return Math.max(2, Math.round(rawAttack * mitigation * typeMult * shieldMult));
  }

  private handleVictory(state: GameState): void {
    if (!this.battle) return;
    const enemy = this.battle.enemy;
    const ally = state.party[state.activePartyIndex];
    sound.playVictory();

    state.stats.wins++;
    const xpGain = (enemy.isBoss ? 85 : enemy.isMercenary ? 45 : 26) + enemy.level * 6;
    const levelMsgs = this.awardExperience(state, ally, xpGain, 6);

    // Award partial XP/bond ONLY to other party slugs that actively entered this battle
    const partnerXp = Math.max(8, Math.round(xpGain * 0.65));
    for (const member of state.party) {
      if (member.uid !== ally.uid && this.participatedUids.has(member.uid)) {
        const subMsgs = awardSlugExperience(state, member, partnerXp, { bondDelta: 4 });
        levelMsgs.push(...subMsgs);
      }
    }

    state.player.xp += Math.round(xpGain * 0.5);

    let rewardText = `+${xpGain} EXP para ${ally.name}.`;
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
    this.participatedUids.clear();
    const endedBattle = this.battle;
    const cb = this.onBattleEndCallback;
    this.battle = null;
    this.onBattleEndCallback = null;
    this.onStateChangeCallback = null;
    if (cb) cb(endedBattle);
  }
}
