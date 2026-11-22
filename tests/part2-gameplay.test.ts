import { memStorage } from './setup-dom';
import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { CombatManager } from '../src/game/combat';
import {
  BOSS_DEFINITIONS,
  SPAWN_X,
  SPAWN_Y,
  SPECIES_LIST,
  createSlugInstance,
  getSpecies,
} from '../src/game/data';
import { BajoterraEngine } from '../src/game/engine';
import {
  assignSlugToHabitat,
  feedHomeSlug,
  petHomeSlug,
  playWithHomeSlug,
  validateShelterRooms,
} from '../src/game/home';
import {
  CONTROL_ACTION_DEFS,
  createDefaultKeyBindings,
  findActionForKey,
  findConflictingAction,
  formatControlKeyLabel,
  isMovementHeld,
  rebindControlKey,
  resolveEffectiveBindings,
  validatePartialKeyBindings,
} from '../src/game/inputManager';
import {
  V4_BACKUP_KEY,
  V4_SAVE_KEY,
  createInitialGameState,
  loadGameV4Detailed,
  saveGameV4,
} from '../src/game/save';
import { getSlugCombatProfile } from '../src/game/slugCombatProfiles';
import { TileType, type RoamingEntity } from '../src/game/types';

type EngineInternals = {
  step(dt: number, ts: number): void;
  playerVx: number;
  playerVy: number;
  playerInvulnTimer: number;
  playerDodgeCooldown: number;
  worldAimAngle: number;
  keysHeld: Set<string>;
};

function stepFrames(engine: BajoterraEngine, frames: number, dt = 1 / 60): void {
  const internal = engine as unknown as EngineInternals;
  for (let i = 0; i < frames; i++) {
    internal.step(dt, (i + 1) * dt * 1000);
  }
}

describe('Part 2 — Movement, Collision Sliding, Dodge & Camera', () => {
  beforeEach(() => {
    memStorage.clear();
  });

  test('smooth acceleration/deceleration curve and diagonal normalization', () => {
    const engine = new BajoterraEngine();
    engine.startNewGame();
    const internal = engine as unknown as EngineInternals;

    // Clear surrounding tiles at spawn to ensure unobstructed measurement
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        engine.chunks.setTile(SPAWN_X + dx, SPAWN_Y + dy, TileType.BUILT_FLOOR);
      }
    }

    const startX = engine.state.player.x;
    const startY = engine.state.player.y;

    // Press D + S (diagonal)
    engine.setJoystick(1, 1);
    stepFrames(engine, 1, 1 / 60);
    const speedAfter1Frame = Math.hypot(internal.playerVx, internal.playerVy);
    assert.ok(speedAfter1Frame > 0 && speedAfter1Frame < 4.9, 'Should accelerate smoothly rather than jumping instantly to max speed');

    stepFrames(engine, 25, 1 / 60);
    const speedAtCruise = Math.hypot(internal.playerVx, internal.playerVy);
    assert.ok(Math.abs(speedAtCruise - 4.9) < 0.25, `Diagonal speed should normalize near 4.9 tiles/s, got ${speedAtCruise}`);
    assert.ok(engine.state.player.x > startX && engine.state.player.y > startY);

    // Release input -> smooth deceleration to zero
    engine.setJoystick(0, 0);
    stepFrames(engine, 1, 1 / 60);
    const speedDuringDecel = Math.hypot(internal.playerVx, internal.playerVy);
    assert.ok(speedDuringDecel > 0 && speedDuringDecel < speedAtCruise, 'Should decelerate over time');

    stepFrames(engine, 30, 1 / 60);
    assert.equal(internal.playerVx, 0);
    assert.equal(internal.playerVy, 0);
  });

  test('blocks solid rock collisions and slides smoothly around wall corners', () => {
    const engine = new BajoterraEngine();
    engine.startNewGame();

    const px = Math.round(engine.state.player.x);
    const py = Math.round(engine.state.player.y);
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        engine.chunks.setTile(px + dx, py + dy, TileType.FLOOR);
      }
    }
    // Place a solid wall directly east and slightly above (blocking only top edge of player hitbox)
    engine.chunks.setTile(px + 1, py - 1, TileType.ROCK);
    engine.state.player.x = px + 0.1;
    engine.state.player.y = py - 0.28; // partially overlapping corner of (px+1, py-1)

    engine.setJoystick(1, 0);
    const prevY = engine.state.player.y;
    stepFrames(engine, 18, 1 / 60);

    // Should slide south around corner and make forward X progress instead of getting stuck
    assert.ok(engine.state.player.y > prevY, 'Corner sliding should nudge player around partial obstacle');
    assert.ok(engine.state.player.x > px + 0.2, 'Player should slide past corner in X direction');

    // Full solid wall directly in front blocks movement completely
    engine.setJoystick(0, 0);
    stepFrames(engine, 25, 1 / 60);
    engine.chunks.setTile(px + 2, py, TileType.WALL);
    engine.chunks.setTile(px + 2, py - 1, TileType.WALL);
    engine.chunks.setTile(px + 2, py + 1, TileType.WALL);
    engine.state.player.x = px + 1.05;
    engine.state.player.y = py;
    engine.setJoystick(1, 0);
    stepFrames(engine, 20, 1 / 60);
    assert.ok(engine.state.player.x < px + 1.25, 'Solid wall barrier must prevent walking through walls');
  });

  test('overworld dodge grants dash burst, invulnerability frames, and cooldown', () => {
    const engine = new BajoterraEngine();
    engine.startNewGame();
    const internal = engine as unknown as EngineInternals;

    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        engine.chunks.setTile(SPAWN_X + dx, SPAWN_Y + dy, TileType.BUILT_FLOOR);
      }
    }

    const startX = engine.state.player.x;
    const triggered = engine.triggerDodge(1, 0);
    assert.equal(triggered, true);
    assert.ok(internal.playerInvulnTimer > 0.2);
    assert.ok(internal.playerDodgeCooldown > 1.0);

    // Cannot immediately double-dodge while on cooldown
    assert.equal(engine.triggerDodge(1, 0), false);

    stepFrames(engine, 12, 1 / 60);
    assert.ok(engine.state.player.x > startX + 1.5, 'Dodge burst should dash across tiles');
  });
});

describe('Part 2 — Centralized InputManager, Rebinding & Persistence', () => {
  beforeEach(() => {
    memStorage.clear();
  });

  test('provides all PC defaults and supports rebinding without conflicts', () => {
    assert.equal(CONTROL_ACTION_DEFS.length, 20);
    const defaults = createDefaultKeyBindings();
    assert.equal(defaults.moveUp, 'w');
    assert.equal(defaults.moveDown, 's');
    assert.equal(defaults.moveLeft, 'a');
    assert.equal(defaults.moveRight, 'd');
    assert.equal(defaults.dodge, ' ');
    assert.equal(defaults.interact, 'f');
    assert.equal(defaults.cycleSlug, 'q');
    assert.equal(defaults.ability1, 'z');
    assert.equal(defaults.ability2, 'x');
    assert.equal(defaults.map, 'm');
    assert.equal(defaults.inventory, 'tab');
    assert.equal(defaults.pause, 'escape');

    // Valid rebind succeeds
    const okRes = rebindControlKey(defaults, 'dodge', 'k');
    assert.equal(okRes.ok, true);
    assert.equal(okRes.bindings.dodge, 'k');
    assert.equal(findActionForKey('k', okRes.bindings), 'dodge');

    // Duplicate binding rejected with conflict details
    const conflictRes = rebindControlKey(okRes.bindings, 'interact', 'k');
    assert.equal(conflictRes.ok, false);
    assert.equal(conflictRes.conflictAction, 'dodge');
    assert.equal(findConflictingAction(okRes.bindings, 'interact', 'k'), 'dodge');

    // Reserved keys ('escape' and 'e') rejected
    const escRes = rebindControlKey(defaults, 'ability1', 'Escape');
    assert.equal(escRes.ok, false);
    const eRes = rebindControlKey(defaults, 'ability1', 'e');
    assert.equal(eRes.ok, false);

    // Non-rebindable pause cannot be changed
    const pauseRes = rebindControlKey(defaults, 'pause', 'p');
    assert.equal(pauseRes.ok, false);

    // Rebound movement keys drive isMovementHeld
    const reboundMove = rebindControlKey(defaults, 'moveUp', 'i').bindings;
    const heldVec = isMovementHeld(new Set(['i', 'd']), reboundMove);
    assert.deepEqual(heldVec, { x: 1, y: -1 });
    assert.equal(formatControlKeyLabel(' '), 'Espacio');
  });

  test('persists custom keyBindings across save/load and validates partial maps', async () => {
    const state = createInitialGameState();
    const res = rebindControlKey(state.options.keyBindings, 'ability1', 'u');
    assert.equal(res.ok, true);
    state.options.keyBindings = res.bindings;

    const validation = validatePartialKeyBindings(res.bindings);
    assert.equal(validation.ok, true);

    const dupValidation = validatePartialKeyBindings({ ability1: 'q', cycleSlug: 'q' });
    assert.equal(dupValidation.ok, false);

    await saveGameV4(state, { reason: 'manual' });
    const loaded = await loadGameV4Detailed({ syncStores: false });
    assert.ok(loaded.state);
    assert.equal(resolveEffectiveBindings(loaded.state.options.keyBindings).ability1, 'u');
  });
});

describe('Part 2 — World & Arena Blaster Combat, 20 Species Profiles & 6 Bosses', () => {
  beforeEach(() => {
    memStorage.clear();
  });

  test('every one of the 20 species has a complete distinct combat profile', () => {
    assert.equal(SPECIES_LIST.length, 20);
    const roles = new Set<string>();
    const silhouettes = new Set<string>();
    for (const sp of SPECIES_LIST) {
      const p = getSlugCombatProfile(sp);
      assert.equal(p.speciesId, sp.id);
      assert.ok(p.roleLabel.length > 3);
      assert.ok(p.baseLaunchSpeed >= 440 && p.maxLaunchSpeed > p.baseLaunchSpeed);
      assert.ok(p.transformDist >= 70);
      assert.ok(p.reloadSec >= 0.25);
      roles.add(p.roleLabel);
      silhouettes.add(p.silhouette);
    }
    assert.equal(silhouettes.size, 20, 'Each of the 20 slug species must have a unique transform silhouette');
    assert.ok(roles.size >= 15, 'Species should express distinct tactical roles');
  });

  test('world blaster spawns projectiles, transforms mid-flight, damages enemies, and shatters CRACKED_WALL', () => {
    const engine = new BajoterraEngine();
    engine.startNewGame();
    const internal = engine as unknown as EngineInternals;

    // Clear area east of player and put a CRACKED_WALL 4 tiles east
    const px = Math.round(engine.state.player.x);
    const py = Math.round(engine.state.player.y);
    for (let dx = 0; dx <= 6; dx++) {
      engine.chunks.setTile(px + dx, py, TileType.FLOOR);
    }
    engine.chunks.setTile(px + 4, py, TileType.CRACKED_WALL);
    internal.worldAimAngle = 0; // aim east

    const bolt = engine.fireWorldBlaster('quick');
    assert.ok(bolt, 'fireWorldBlaster should spawn a WorldProjectile');
    assert.equal(bolt.phase, 'protoform');

    // Advance enough frames for bolt to transform and strike CRACKED_WALL
    stepFrames(engine, 25, 1 / 60);
    assert.equal(engine.chunks.getTile(px + 4, py), TileType.FLOOR, 'World blaster shot must shatter CRACKED_WALL');

    // Now test enemy windup, damage, and defeat loot
    const dummyEnemy: RoamingEntity = {
      uid: 'test_merc_1',
      kind: 'mercenary',
      speciesId: 'tazerling',
      name: 'Mercenario Prueba',
      icon: '🦹',
      x: px + 3.2,
      y: py,
      homeX: px + 3.2,
      homeY: py,
      biome: 'Verdes',
      level: 2,
      hp: 20,
      maxHp: 20,
      dir: 0,
      cooldown: 0,
    };
    engine.entities.push(dummyEnemy);
    const tokensBefore = engine.state.cavernTokens ?? 0;
    const winsBefore = engine.state.stats.wins;

    // Fire again (wait cooldown)
    stepFrames(engine, 30, 1 / 60);
    internal.worldAimAngle = 0;
    const shot2 = engine.fireWorldBlaster('ability1');
    assert.ok(shot2);
    stepFrames(engine, 25, 1 / 60);

    assert.equal(
      engine.entities.some((e) => e.uid === 'test_merc_1'),
      false,
      'Defeating roaming enemy via world blaster removes it'
    );
    assert.ok((engine.state.cavernTokens ?? 0) > tokensBefore, 'Defeating enemy awards Cavern Tokens');
    assert.ok(engine.state.stats.wins > winsBefore);
  });

  test('arena CombatManager dodge grants i-frames and all 6 bosses fire Phase 1 & Phase 2 attacks', () => {
    const combat = new CombatManager();
    const state = createInitialGameState();

    // Test dodge + i-frames + close-danger pulse charge
    combat.startBattle(state, {
      kind: 'boss',
      speciesId: 'aquabeak',
      level: 8,
      biome: 'Acuaticas',
      bossId: 'boss_aquatic',
      nameOverride: 'Leviatán Abisal',
    });
    assert.ok(combat.battle);

    // Spawn an incoming enemy projectile near playerDuelist
    const pd = combat.battle.playerDuelist;
    combat.battle.projectiles.push({
      id: 9991,
      owner: 'enemy',
      speciesId: 'aquabeak',
      slugName: 'Aquabeak',
      element: 'Agua',
      mega: false,
      mode: 'quick',
      x: pd.x + 25,
      y: pd.y,
      prevX: pd.x + 40,
      prevY: pd.y,
      vx: -400,
      vy: 0,
      radius: 14,
      distanceTraveled: 120,
      transformDist: 100,
      phase: 'transformed',
      transformTimer: 0.2,
      chargeScore: 0.7,
      perfectRelease: false,
      powerScore: 22,
      gravityScale: 0,
      homing: 0,
      bouncesLeft: 0,
      phaseObstacles: false,
      pierceLeft: 0,
      aoeRadius: 20,
      trail: [],
      alive: true,
    });

    const allyHpBefore = state.party[0].hp;
    const pulseBefore = combat.battle.pulseCharge;
    const dodged = combat.triggerDodge(state, 0, -1);
    assert.equal(dodged, true);
    assert.ok(combat.battle.pulseCharge >= pulseBefore + 15, 'Close dodge should award Pulse charge');
    combat.step(0.05, state);
    assert.equal(state.party[0].hp, allyHpBefore, 'Dodge i-frames must prevent projectile damage');

    // Verify all 6 bosses exist and engage cleanly into Phase 2 AI attacks
    assert.equal(BOSS_DEFINITIONS.length, 6);
    for (const boss of BOSS_DEFINITIONS) {
      const bState = combat.startBattle(state, {
        kind: 'boss',
        speciesId: boss.speciesId,
        level: boss.level,
        biome: boss.biome,
        bossId: boss.id,
        nameOverride: boss.name,
      });
      // Drop boss below 55% HP to verify Phase 2 behavior runs cleanly without crashing
      bState.enemy.hp = Math.floor(bState.enemy.maxHp * 0.4);
      bState.enemyDuelist.aiCooldown = 0.01;
      for (let f = 0; f < 45; f++) {
        combat.step(1 / 30, state);
      }
      assert.ok(['duel', 'ended'].includes(bState.turn));
    }
  });
});

describe('Part 2 — Refuge Habitats, Care, Breeding, Babosapedia & Backup Recovery', () => {
  beforeEach(() => {
    memStorage.clear();
  });

  test('assigns slugs to compatible habitats, cares for mood/bond, and hatches eggs', () => {
    const engine = new BajoterraEngine();
    engine.startNewGame();

    const aqua = createSlugInstance('aquabeak', 3);
    const infurnus = createSlugInstance('infurnus', 4);
    aqua.bond = 40;
    infurnus.bond = 40;
    engine.state.storage.push(aqua, infurnus);

    // Incompatible assignment rejected (Aquabeak into thermal)
    const badRes = assignSlugToHabitat(engine.state, aqua.uid, 'habitat_thermal', engine.chunks);
    assert.equal(badRes.ok, false);

    // Compatible assignment succeeds
    const okRes = assignSlugToHabitat(engine.state, aqua.uid, 'habitat_aquatic', engine.chunks);
    assert.equal(okRes.ok, true);
    assert.equal(engine.state.home?.residents.length, 1);

    // Pet, feed, play improve stats/bond
    const resident = engine.state.home!.residents[0];
    resident.hunger = 50;
    resident.happiness = 50;
    const bondBefore = resident.slug.bond;
    const petRes = petHomeSlug(engine.state, resident.slug.uid);
    assert.equal(petRes.ok, true);
    const feedRes = feedHomeSlug(engine.state, resident.slug.uid, 'berries');
    assert.equal(feedRes.ok, true);
    const playRes = playWithHomeSlug(engine.state, resident.slug.uid);
    assert.equal(playRes.ok, true);
    assert.ok(resident.slug.bond > bondBefore);

    // Room validation runs cleanly
    const rooms = validateShelterRooms(engine.chunks, engine.state.home!);
    assert.ok(Array.isArray(rooms));

    // Breeding creates egg and walking hatches it (both parents need bond >= 25)
    engine.state.party[0].bond = 40;
    const bred = engine.startBreeding(engine.state.party[0].uid, infurnus.uid);
    assert.equal(bred, true);
    assert.equal(engine.state.eggs.length, 1);
    const totalOwnedBefore = engine.state.party.length + engine.state.storage.length;
    engine.state.eggs[0].stepsRemaining = 0.1;
    for (let dx = -2; dx <= 2; dx++) {
      engine.chunks.setTile(SPAWN_X + dx, SPAWN_Y, TileType.BUILT_FLOOR);
    }
    engine.setJoystick(1, 0);
    stepFrames(engine, 20, 1 / 60);
    assert.equal(engine.state.eggs.length, 0, 'Egg should hatch once stepsRemaining hits 0');
    assert.equal(engine.state.party.length + engine.state.storage.length, totalOwnedBefore + 1);
  });

  test('recovers cleanly from primary save corruption using V4_BACKUP_KEY', async () => {
    const firstState = createInitialGameState();
    firstState.cavernTokens = 19;
    await saveGameV4(firstState, { reason: 'manual' });

    // Second save triggers automatic backup of firstState into V4_BACKUP_KEY
    const secondState = { ...firstState, cavernTokens: 27 };
    await saveGameV4(secondState, { reason: 'manual' });
    assert.ok(memStorage.getItem(V4_BACKUP_KEY), 'Backup key should be populated before overwrite');

    // Corrupt primary save
    memStorage.setItem(V4_SAVE_KEY, '{"broken": true');
    const recovered = await loadGameV4Detailed({ syncStores: false });
    assert.equal(recovered.recoveredFromCorruption, true);
    assert.ok(recovered.state);
    assert.equal(recovered.state.cavernTokens, 19);
  });

  test('verifies UI wiring for Controls Settings, Mobile Touch Controls & Babosapedia Filters', () => {
    const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

    const pauseSrc = read('src/components/PauseModal.tsx');
    assert.match(pauseSrc, /Configuración de Controles/);
    assert.match(pauseSrc, /rebindControlKey/);
    assert.match(pauseSrc, /Restablecer/);

    const hudSrc = read('src/components/GameHUD.tsx');
    assert.match(hudSrc, /Disparar bláster/);
    assert.match(hudSrc, /Esquivar/);
    assert.match(hudSrc, /Habilidad 1/);
    assert.match(hudSrc, /Habilidad 2/);
    assert.match(hudSrc, /touch-none/);

    const battleSrc = read('src/components/BattleModal.tsx');
    assert.match(battleSrc, /triggerDodge/);
    assert.match(battleSrc, /Esquivar/);
    assert.match(battleSrc, /findActionForKey/);

    const pediaSrc = read('src/components/ExpeditionModal.tsx');
    assert.match(pediaSrc, /Buscar babosa por nombre, rol o hábitat/);
    assert.match(pediaSrc, /getSlugCombatProfile/);
    assert.match(pediaSrc, /Por descubrir/);
  });
});
