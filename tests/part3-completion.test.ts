import { memStorage } from './setup-dom';
import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { sound } from '../src/game/audio';
import { cinematicEvents } from '../src/game/cinematicEvents';
import { CombatManager } from '../src/game/combat';
import { createSlugInstance, SPAWN_X, SPAWN_Y } from '../src/game/data';
import { BajoterraEngine } from '../src/game/engine';
import { isPostGameUnlocked } from '../src/game/progressionManager';
import { createInitialGameState, parseImportedJsonSaveDetailed } from '../src/game/save';
import { isTileSolid } from '../src/game/world';

describe('Bajoterra 4.0 — Part 3 Full Integration, Campaign Finale, Settlements & Audio', () => {
  beforeEach(() => {
    memStorage.clear();
    cinematicEvents.clear();
    sound.stopAllMusic();
  });

  test('Full 8-chapter campaign progresses cleanly to Ch8 victory, emits campaign_victory, prevents duplicate rewards, and unlocks Post-Game', () => {
    const engine = new BajoterraEngine();
    engine.startNewGame();
    cinematicEvents.clear();

    // Chapter 1: Descenso + 1 win
    engine.travelToStoryScenario('esc_caverna_descenso');
    engine.state.stats.wins = 1;
    assert.equal(engine.claimStoryMission('m_cap1_primeros_pasos'), true);
    // Double claim rejected
    const tokensAfterCh1 = engine.state.cavernTokens ?? 0;
    assert.equal(engine.claimStoryMission('m_cap1_primeros_pasos'), false);
    assert.equal(engine.state.cavernTokens, tokensAfterCh1);
    assert.equal(engine.state.story?.chapterStates['cap_01_descenso'], 'completed');
    assert.equal(engine.state.story?.chapterStates['cap_02_refugio_banda'], 'active');

    // Chapter 2: Valle Verde + 2 wins -> unlocks Mecha
    assert.equal(engine.travelToStoryScenario('esc_pueblo_valle_verde'), true);
    engine.state.stats.wins = 2;
    assert.equal(engine.claimStoryMission('m_cap2_constructor_refugio'), true);
    assert.equal(engine.state.mecha?.unlocked, true);
    assert.equal(engine.state.story?.chapterStates['cap_02_refugio_banda'], 'completed');
    assert.equal(engine.state.story?.chapterStates['cap_03_sombra_agua_oscura'], 'active');

    // Chapter 3: Rastro Oscuro (3 wins)
    engine.state.stats.wins = 3;
    assert.equal(engine.claimStoryMission('m_cap3_rastro_oscuro'), true);
    assert.equal(engine.state.story?.chapterStates['cap_03_sombra_agua_oscura'], 'completed');
    assert.equal(engine.state.story?.chapterStates['cap_04_secretos_profundidades'], 'active');

    // Chapter 4: Gruta Acuática + Leviatán Abisal
    assert.equal(engine.travelToStoryScenario('esc_gruta_acuatica'), true);
    engine.state.defeatedBosses.push('boss_aquatic');
    assert.equal(engine.claimStoryMission('m_cap4_mareas_profundas'), true);
    assert.equal(engine.state.story?.chapterStates['cap_04_secretos_profundidades'], 'completed');
    assert.equal(engine.state.story?.chapterStates['cap_05_fronteras_elementales'], 'active');

    // Chapter 5: 4 biomes discovered
    engine.state.discoveries = ['Verdes', 'Acuaticas', 'Heladas', 'Magma'];
    assert.equal(engine.claimStoryMission('m_cap5_fronteras_elementales'), true);
    assert.equal(engine.state.story?.chapterStates['cap_05_fronteras_elementales'], 'completed');
    assert.equal(engine.state.story?.chapterStates['cap_06_misterio_cristalino'], 'active');

    // Chapter 6: Templo Cristalino + Oráculo Prisma
    assert.equal(engine.travelToStoryScenario('esc_templo_cristalino'), true);
    engine.state.defeatedBosses.push('boss_crystal');
    assert.equal(engine.claimStoryMission('m_cap6_misterio_cristalino'), true);
    assert.equal(engine.state.story?.chapterStates['cap_06_misterio_cristalino'], 'completed');
    assert.equal(engine.state.story?.chapterStates['cap_07_acelerador_megamorph'], 'active');

    // Chapter 7: 2+ bosses defeated -> Megamorph unlocked
    assert.equal(engine.claimStoryMission('m_cap7_acelerador'), true);
    assert.equal(engine.state.story?.chapterStates['cap_07_acelerador_megamorph'], 'completed');
    assert.equal(engine.state.story?.chapterStates['cap_08_ciudadela_blakk'], 'active');

    // Chapter 8: Bastión Sombrío + 3rd boss (boss_blakk)
    assert.equal(engine.travelToStoryScenario('esc_ciudadela_sombria'), true);
    // Pre-victory Bastion has Comandante Blakk transmission NPC
    const preVictoryNpc = engine.entities.find((e) => e.uid === 'npc_dr_blakk_citadel');
    assert.ok(preVictoryNpc, 'Pre-victory Comandante Blakk NPC should spawn in Bastión Sombrío');

    engine.state.defeatedBosses.push('boss_blakk');
    cinematicEvents.clear();
    assert.equal(engine.claimStoryMission('m_cap8_guardianes_abismo'), true);
    assert.equal(engine.state.story?.chapterStates['cap_08_ciudadela_blakk'], 'completed');
    assert.equal(isPostGameUnlocked(engine.state), true);

    const events = cinematicEvents.getRecentEvents();
    const victoryEvt = events.find((ev) => ev.type === 'campaign_victory');
    assert.ok(victoryEvt, 'Completing Chapter 8 should emit campaign_victory cinematic event');
    assert.equal(victoryEvt?.title, '¡Victoria en las 99 Cavernas!');

    // Epilogue NPC should now replace Comandante Blakk transmission NPC in Bastión Sombrío
    const epilogueNpc = engine.entities.find((e) => e.uid === 'npc_epilogo_trixie');
    assert.ok(epilogueNpc, 'Post-victory epilogue Trixie NPC should spawn in Bastión Sombrío');
    assert.equal(engine.entities.find((e) => e.uid === 'npc_dr_blakk_citadel'), undefined);

    // Double claim rejected & post-game challenge accessible
    const tokensPostVictory = engine.state.cavernTokens ?? 0;
    assert.equal(engine.claimStoryMission('m_cap8_guardianes_abismo'), false);
    assert.equal(engine.state.cavernTokens, tokensPostVictory);
    assert.equal(engine.startPostGameChallenge('pg_eco_pirita'), true);
    assert.ok(engine.combat.battle);
  });

  test('All regional settlements, merchants, and Ch5/Ch8 story NPCs spawn on walkable tiles', () => {
    const engine = new BajoterraEngine();
    engine.startNewGame();

    const expectedUids = [
      'merchant_home',
      'merchant_valle',
      'merchant_marea_azul',
      'merchant_camp_termal',
      'merchant_vigia_prisma',
      'npc_pronto',
      'npc_trixie',
      'npc_kord',
      'npc_trixie_acuatica',
      'npc_pronto_acuatica',
      'npc_red_hook',
      'npc_twist',
      'npc_twist_magma',
      'npc_kord_magma',
      'npc_will_shane',
      'npc_dr_blakk_citadel',
    ];

    for (const uid of expectedUids) {
      const ent = engine.entities.find((e) => e.uid === uid);
      assert.ok(ent, `Expected entity ${uid} to exist`);
      engine.chunks.ensureWindowAround(ent.x, ent.y, 1);
      const tile = engine.chunks.getTile(Math.round(ent.x), Math.round(ent.y));
      assert.equal(isTileSolid(tile), false, `Entity ${uid} at (${ent.x},${ent.y}) must stand on walkable tile`);
    }
  });

  test('Twist in Magma Forge plays Ch5 dialogue before rival duel when Ch5 is active', () => {
    const engine = new BajoterraEngine();
    engine.startNewGame();

    // Advance state quickly to Ch5 active
    engine.state.story!.chapterStates['cap_01_descenso'] = 'completed';
    engine.state.story!.chapterStates['cap_02_refugio_banda'] = 'completed';
    engine.state.story!.chapterStates['cap_03_sombra_agua_oscura'] = 'completed';
    engine.state.story!.chapterStates['cap_04_secretos_profundidades'] = 'completed';
    engine.state.story!.chapterStates['cap_05_fronteras_elementales'] = 'active';

    const twistMagma = engine.entities.find((e) => e.uid === 'npc_twist_magma');
    assert.ok(twistMagma);
    engine.state.player.x = twistMagma!.x;
    engine.state.player.y = twistMagma!.y;
    engine.chunks.ensureWindowAround(twistMagma!.x, twistMagma!.y, 1);

    engine.performPrimaryAction();
    assert.equal(engine.getSnapshot().activeDialogueId, 'dlg_cap5_twist_fronteras');

    assert.equal(engine.submitDialogueChoice('dlg_cap5_twist_fronteras', 'ch_twist_retar'), true);
    engine.closeDialogue();

    // Subsequent primary interaction launches the Twist rival duel
    engine.performPrimaryAction();
    assert.ok(engine.combat.battle, 'Second interaction with Twist should launch rival duel');
    assert.equal(engine.combat.battle?.enemy?.name, 'Twist');
  });

  test('Audio channel volumes and menu/refuge/biome tracks sync from engine state and options', () => {
    const engine = new BajoterraEngine();
    assert.equal(engine.screen, 'TITLE');
    assert.equal(sound.getMusicState().desiredTrack, 'menu_theme');

    engine.updateOptions({
      musicVolume: 0.45,
      sfxVolume: 0.75,
      ambientVolume: 0.3,
    });
    assert.equal(sound.musicVolume, 0.45);
    assert.equal(sound.sfxVolume, 0.75);
    assert.equal(sound.ambientVolume, 0.3);

    engine.startNewGame();
    // Spawn is inside Refugio Shane
    assert.equal(Math.hypot(engine.state.player.x - SPAWN_X, engine.state.player.y - SPAWN_Y) <= 16, true);
    assert.equal(sound.getMusicState().desiredTrack, 'refuge_ambience');

    // Unlock and travel to Gruta Acuática -> switches away from refuge to biome_Acuaticas
    engine.state.story!.chapterStates['cap_01_descenso'] = 'completed';
    engine.state.story!.chapterStates['cap_02_refugio_banda'] = 'completed';
    engine.state.story!.chapterStates['cap_03_sombra_agua_oscura'] = 'completed';
    engine.state.story!.chapterStates['cap_04_secretos_profundidades'] = 'active';
    engine.state.story!.unlockedScenarioIds.push('esc_gruta_acuatica');
    engine.state.story!.visitedScenarioIds.push('esc_gruta_acuatica');
    assert.equal(engine.travelToStoryScenario('esc_gruta_acuatica'), true);
    assert.equal(sound.getMusicState().desiredTrack, 'biome_Acuaticas');

    // Return to Title switches back to menu_theme
    engine.setScreen('TITLE');
    assert.equal(sound.getMusicState().desiredTrack, 'menu_theme');
  });

  test('All audio, accessibility, uiScale, and screenShake options persist and validate cleanly', () => {
    const engine = new BajoterraEngine();
    engine.startNewGame();
    engine.state.party.push(createSlugInstance('frostcrawler', 3));
    engine.updateOptions({
      soundEnabled: false,
      volume: 0.8,
      musicVolume: 0.55,
      sfxVolume: 0.9,
      ambientVolume: 0.4,
      screenShake: false,
      uiScale: 'large',
      reducedMotion: true,
      lightingQuality: 'eco',
      touchControls: 'on',
      showMinimap: false,
    });

    const parsed = parseImportedJsonSaveDetailed(JSON.stringify(engine.state));
    assert.equal(parsed.ok, true);
    assert.ok(parsed.state);
    assert.equal(parsed.state!.options.soundEnabled, false);
    assert.equal(parsed.state!.options.volume, 0.8);
    assert.equal(parsed.state!.options.musicVolume, 0.55);
    assert.equal(parsed.state!.options.sfxVolume, 0.9);
    assert.equal(parsed.state!.options.ambientVolume, 0.4);
    assert.equal(parsed.state!.options.screenShake, false);
    assert.equal(parsed.state!.options.uiScale, 'large');
    assert.equal(parsed.state!.options.reducedMotion, true);
    assert.equal(parsed.state!.options.lightingQuality, 'eco');
    assert.equal(parsed.state!.options.touchControls, 'on');
    assert.equal(parsed.state!.options.showMinimap, false);
  });

  test('CombatManager cycleSlug and swapSlug handle edge cases safely without recursive notifications', () => {
    const combat = new CombatManager();
    const state = createInitialGameState();
    state.party = [state.party[0]];
    state.activePartyIndex = 0;
    let notifications = 0;

    assert.equal(combat.hasStateChangeHandler(), false);
    // No active battle -> returns false without firing callback
    assert.equal(combat.cycleSlug(state, 1), false);
    assert.equal(combat.swapSlug(state, 0), false);
    assert.equal(notifications, 0);

    combat.startBattle(state, {
      kind: 'wild',
      speciesId: 'tazerling',
      level: 3,
      biome: 'Verdes',
      onStateChange: () => {
        notifications++;
      },
    });
    assert.equal(combat.hasStateChangeHandler(), true);

    // Single healthy slug in party cannot cycle
    assert.equal(combat.cycleSlug(state, 1), false);
    assert.equal(notifications, 0);

    // Add second healthy slug and test out-of-bounds activePartyIndex normalization
    state.party.push(createSlugInstance('frostcrawler', 3));
    state.activePartyIndex = 99;
    assert.equal(combat.cycleSlug(state, 1), true);
    assert.equal(state.activePartyIndex, 1);
    assert.equal(notifications, 1);

    // Cycling again returns cleanly to index 0
    assert.equal(combat.cycleSlug(state, 1), true);
    assert.equal(state.activePartyIndex, 0);
    assert.equal(notifications, 2);

    // Swapping to already-active index is a no-op
    assert.equal(combat.swapSlug(state, 0), false);
    assert.equal(notifications, 2);

    // Swapping after duel ended is rejected
    combat.battle!.turn = 'ended';
    assert.equal(combat.cycleSlug(state, 1), false);
    assert.equal(notifications, 2);
  });

  test('BajoterraEngine emitHud coalesces re-entrant notifications and guards setActivePartyIndex', async () => {
    const engine = new BajoterraEngine();
    engine.startNewGame();
    engine.state.party.push(createSlugInstance('tazerling', 3));

    // Selecting the already-active party index is a no-op
    let calls = 0;
    const unsubNoop = engine.subscribe(() => {
      calls++;
    });
    const initialCalls = calls;
    engine.setActivePartyIndex(engine.state.activePartyIndex);
    assert.equal(calls, initialCalls);
    unsubNoop();

    // Re-entrant emitHud(true) inside a subscriber must not recurse synchronously
    let syncDepth = 0;
    let maxSyncDepth = 0;
    let reentrantTriggered = false;
    let observedTotal = 0;
    const unsubReentrant = engine.subscribe(() => {
      syncDepth++;
      maxSyncDepth = Math.max(maxSyncDepth, syncDepth);
      observedTotal++;
      if (observedTotal === 2 && !reentrantTriggered) {
        reentrantTriggered = true;
        engine.emitHud(true);
      }
      syncDepth--;
    });

    engine.emitHud(true);
    assert.equal(maxSyncDepth, 1, 'emitHud must never recurse synchronously into subscribers');
    // Wait for queued microtask follow-up
    await Promise.resolve();
    assert.equal(reentrantTriggered, true);
    assert.equal(observedTotal, 3, 'Queued re-entrant emitHud should flush asynchronously in microtask');
    unsubReentrant();
  });

  test('React combat & HUD components preserve update-loop stability invariants', () => {
    const appSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf8');
    const battleModalSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/BattleModal.tsx'), 'utf8');
    const slugColSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/SlugColumn.tsx'), 'utf8');
    const settingsSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/GameSettingsContent.tsx'), 'utf8');

    assert.match(appSrc, /handleBattleSync\s*=\s*useCallback/, 'App.tsx must memoize onSync callback for BattleModal');
    assert.match(appSrc, /onSync=\{handleBattleSync\}/, 'App.tsx must pass memoized handleBattleSync to BattleModal');

    assert.match(battleModalSrc, /onSyncRef\.current\s*=\s*onSync/, 'BattleModal must keep onSync in a ref');
    assert.match(
      battleModalSrc,
      /boundAction === 'cycleSlug' \|\| key === 'q'[\s\S]*?!e\.repeat/,
      'BattleModal must guard cycleSlug hotkey against key-repeat floods'
    );

    assert.equal(
      /useEffect\s*\(/.test(slugColSrc),
      false,
      'SlugColumn must not trigger setState inside useEffect on activeIndex change'
    );
    assert.match(slugColSrc, /key=\{s\.uid\}/, 'SlugColumn buttons must use stable s.uid keys');

    assert.match(
      settingsSrc,
      /onListeningChangeRef\.current\s*=\s*onListeningChange/,
      'GameSettingsContent must stabilize onListeningChange via ref'
    );
  });
});
