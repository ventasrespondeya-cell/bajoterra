import { sound } from './audio';
import {
  BLASTER_TOURNAMENTS,
  HIDDEN_DISCOVERIES,
  MECHA_THEMES,
  MECHA_UPGRADES,
  MERCHANT_EXCHANGE_OFFERS,
  POSTGAME_CHALLENGES,
  RIVAL_DUELS,
  SLUG_RACES,
  TRAINING_CHALLENGES,
  ensureMechaState,
  getMechaSpeedMultiplier,
} from './activities';
import { cinematicEvents } from './cinematicEvents';
import { CombatManager } from './combat';
import {
  BIOME_INFO,
  BOSS_DEFINITIONS,
  CHUNK_SIZE,
  ELEMENT_CHART,
  HOTBAR_SLOTS,
  QUEST_LIST,
  SPAWN_X,
  SPAWN_Y,
  TILE_PX,
  WORLD_H,
  WORLD_W,
  createSlugInstance,
  getElementMultiplier,
  getSpecies,
  pickWeightedSpeciesByBiome,
} from './data';
import {
  findActionForKey,
  isMovementHeld,
  resolveEffectiveBindings,
} from './inputManager';
import { getSlugCombatProfile } from './slugCombatProfiles';
import {
  awardSlugExperience,
  clearSlugNickname as clearSlugNicknameHelper,
  evolveSlugToMegamorph as evolveSlugToMegamorphHelper,
  findSlugByUidAnywhere,
  getSlugDisplayName,
  grantMoveMastery,
  grantSlugBond,
  setSlugNickname as setSlugNicknameHelper,
} from './progression';
import {
  completeDialogue as completeDialogueHelper,
  getDialogueById,
  isPostGameUnlocked,
  recordJournalEntry as recordJournalEntryHelper,
} from './progressionManager';
import { WorldRenderer } from './renderer';
import {
  checkStorageCapabilities,
  createInitialGameState,
  detectV3SaveRaw,
  hasExistingV4Save,
  loadGameV4Detailed,
  parseImportedJsonSaveDetailed,
  requestPersistentStorageIfNeeded,
  saveGameV4,
  type SaveResult,
  type StorageCapabilities,
} from './save';
import {
  assignSlugToHabitat,
  cloneHomeState,
  ensureHomeState,
  feedHomeSlug as feedHomeSlugHelper,
  findNearbyHomeSlug,
  moveHomeSlugToHabitat,
  petHomeSlug as petHomeSlugHelper,
  pickupHomeFurnitureAt,
  pickupHomeFurnitureById,
  placeHomeFurniture,
  playWithHomeSlug as playWithHomeSlugHelper,
  updateHomeResidents,
  validateShelterRooms,
  withdrawSlugFromHome as withdrawSlugFromHomeHelper,
} from './home';
import {
  TileType,
  type BiomeId,
  type ExplorationContextualAction,
  type FurnitureKind,
  type GameOptions,
  type GameState,
  type HabitatId,
  type HotbarSlot,
  type HudSnapshot,
  type InventoryKey,
  type MechaTheme,
  type QuestDef,
  type RoamingEntity,
  type RoomValidationInfo,
  type TrainingRecord,
  type UIScreen,
  type WorldProjectile,
} from './types';
import {
  STORY_CHAPTERS_BY_ID,
  STORY_MISSIONS_BY_LEGACY_ID,
  STORY_ROUTES,
  STORY_SCENARIOS,
} from './storyData';
import {
  activateMission,
  buildStoryHudSummary,
  canAccessRoute,
  claimStoryMission as claimStoryMissionHelper,
  ensureStoryState,
  reconcileStoryProgress,
  travelToScenario,
} from './storyEngine';
import type { StoryProgressState } from './storyTypes';
import {
  ChunkManager,
  type ChunkStructureMeta,
  getBiomeAt,
  getChunkStructureMeta,
  isTileHazard,
  isTileSolid,
} from './world';

export class BajoterraEngine {
  public state: GameState = createInitialGameState();
  public screen: UIScreen = 'TITLE';
  public chunks: ChunkManager;
  public renderer = new WorldRenderer();
  public combat = new CombatManager();
  public entities: RoamingEntity[] = [];
  public worldProjectiles: WorldProjectile[] = [];

  private canvas: HTMLCanvasElement | null = null;
  private minimapCanvas: HTMLCanvasElement | null = null;
  private fullMapCanvas: HTMLCanvasElement | null = null;
  private rafId: number | null = null;
  private lastTs = 0;
  private timeSec = 0;
  private autoSaveTimer = 0;
  private lavaDamageCooldown = 0;
  private pulseCooldown = 0;
  private readonly pulseMaxCooldown = 5;

  private keysHeld = new Set<string>();
  private joyVec = { x: 0, y: 0 };
  private touchSprinting = false;
  private worldAimAngle = Math.PI * 0.5;
  private playerVx = 0;
  private playerVy = 0;
  private playerDodgeTimer = 0;
  private playerDodgeCooldown = 0;
  private playerDodgeVx = 0;
  private playerDodgeVy = 0;
  private playerInvulnTimer = 0;
  private worldFireCooldown = 0;
  private worldAbilityCooldowns: Record<string, number> = {};
  private worldProjSeq = 1;
  private toastText = '';
  private toastTimer = 0;
  private hasV4 = false;
  private hasV3 = false;
  private v3RawCache: string | null = null;
  private listeners = new Set<(snap: HudSnapshot) => void>();
  private lastHudPush = 0;
  private dpr = 1;
  private lastMinimapDraw = 0;
  private autoSaveErrorNotified = false;
  public lastSaveResult: SaveResult | null = null;
  public storageCapabilities: StorageCapabilities | null = null;
  private cachedRooms: RoomValidationInfo[] = [];
  private roomsDirty = true;
  private recentChapterAlert: string | null = null;
  private recentChapterAlertTimer = 0;
  private activeDialogueId: string | null = null;
  private lastGateToastAt = 0;
  private activeTournament: {
    tournamentId: string;
    name: string;
    roundIndex: number;
    totalRounds: number;
  } | null = null;

  constructor() {
    ensureHomeState(this.state);
    this.ensureExplorationFields();
    ensureStoryState(this.state);
    reconcileStoryProgress(this.state, { skipRewards: true });
    this.chunks = new ChunkManager(this.state.worldSeed, this.state.tilesDelta);
    this.chunks.ensureWindowAround(this.state.player.x, this.state.player.y, 2);
    this.seedInitialEntities();
    this.checkSavesAvailability();
  }

  private ensureExplorationFields(): void {
    if (!Array.isArray(this.state.discoveredPOIs)) {
      this.state.discoveredPOIs = [];
    }
    if (!Array.isArray(this.state.clearedChallenges)) {
      this.state.clearedChallenges = [];
    }
    if (typeof this.state.cavernTokens !== 'number' || !Number.isFinite(this.state.cavernTokens)) {
      this.state.cavernTokens = 4;
    }
    ensureMechaState(this.state);
    if (!this.state.trainingRecords || typeof this.state.trainingRecords !== 'object') {
      this.state.trainingRecords = {};
    }
    if (!Array.isArray(this.state.clearedTournaments)) {
      this.state.clearedTournaments = [];
    }
    if (!this.state.raceRecords || typeof this.state.raceRecords !== 'object') {
      this.state.raceRecords = {};
    }
    if (!Array.isArray(this.state.journalEntries)) {
      this.state.journalEntries = ['j_cap1_descenso'];
    }
    if (!Array.isArray(this.state.completedDialogues)) {
      this.state.completedDialogues = [];
    }
    if (!Array.isArray(this.state.discoveredSecrets)) {
      this.state.discoveredSecrets = [];
    }
  }

  private cloneStoryState(): StoryProgressState {
    const s = ensureStoryState(this.state);
    return {
      schemaVersion: 1,
      currentChapterId: s.currentChapterId,
      currentScenarioId: s.currentScenarioId,
      chapterStates: { ...s.chapterStates },
      missionStates: { ...s.missionStates },
      unlockedScenarioIds: [...s.unlockedScenarioIds],
      visitedScenarioIds: [...s.visitedScenarioIds],
      unlockedRouteIds: [...s.unlockedRouteIds],
      completedEvents: [...s.completedEvents],
      storyFlags: { ...s.storyFlags },
      claimedChapterRewards: [...s.claimedChapterRewards],
      claimedMissionRewards: [...s.claimedMissionRewards],
      ...(s.scenarioPositions ? { scenarioPositions: { ...s.scenarioPositions } } : {}),
    };
  }

  private syncStoryProgress(opts?: { skipRewards?: boolean }): void {
    const res = reconcileStoryProgress(this.state, opts);
    if (res.xpGained > 0 && !opts?.skipRewards) {
      this.awardPlayerXp(res.xpGained);
    }
    if (res.newlyActivatedChapterIds.length > 0) {
      const latestId = res.newlyActivatedChapterIds[res.newlyActivatedChapterIds.length - 1];
      const ch = STORY_CHAPTERS_BY_ID[latestId];
      if (ch) {
        this.recentChapterAlert = ch.title;
        this.recentChapterAlertTimer = 5;
        cinematicEvents.emit({
          type: 'chapter_unlocked',
          title: ch.title,
          subtitle: ch.subtitle,
          audioCue: 'discovery_wonder',
          skippable: true,
          priority: 'ambient',
          dedupeKey: `ch_${ch.id}`,
        });
      }
    } else if (res.newlyUnlockedRouteIds.length > 0) {
      const route = STORY_ROUTES[res.newlyUnlockedRouteIds[0]];
      if (route) {
        cinematicEvents.emit({
          type: 'route_unlocked',
          title: `Ruta abierta: ${route.name}`,
          audioCue: 'discovery_wonder',
          skippable: true,
          priority: 'ambient',
          dedupeKey: `route_${route.id}`,
        });
      }
    }
  }

  public getRoomValidations(force = false): RoomValidationInfo[] {
    if (this.roomsDirty || force) {
      this.chunks.ensureWindowAround(SPAWN_X, SPAWN_Y, 2);
      this.cachedRooms = validateShelterRooms(this.chunks, ensureHomeState(this.state));
      this.roomsDirty = false;
    }
    return this.cachedRooms.map((r) => ({ ...r, issues: [...r.issues] }));
  }

  private invalidateRoomCache(): void {
    this.roomsDirty = true;
  }

  public async checkSavesAvailability(): Promise<void> {
    this.hasV4 = await hasExistingV4Save();
    this.v3RawCache = await detectV3SaveRaw();
    this.hasV3 = !!this.v3RawCache;
    this.storageCapabilities = await checkStorageCapabilities();
    this.emitHud(true);
  }

  public subscribe(fn: (snap: HudSnapshot) => void): () => void {
    this.listeners.add(fn);
    fn(this.getSnapshot());
    return () => {
      this.listeners.delete(fn);
    };
  }

  public getSnapshot(): HudSnapshot {
    const px = Math.floor(this.state.player.x + 0.5);
    const py = Math.floor(this.state.player.y + 0.5);
    const nearHome = findNearbyHomeSlug(this.state);
    return {
      screen: this.screen,
      player: { ...this.state.player, perks: [...this.state.player.perks] },
      biome: getBiomeAt(px, py, this.state.worldSeed),
      party: this.state.party.map((s) => ({
        ...s,
        ...(s.moveMastery ? { moveMastery: [...s.moveMastery] as [number, number] } : {}),
      })),
      storage: this.state.storage.map((s) => ({
        ...s,
        ...(s.moveMastery ? { moveMastery: [...s.moveMastery] as [number, number] } : {}),
      })),
      activePartyIndex: this.state.activePartyIndex,
      inventory: { ...this.state.inventory },
      cavernTokens: this.state.cavernTokens ?? 0,
      selectedHotbar: this.state.selectedHotbar,
      contextualAction: this.getContextualExplorationAction(),
      discoveries: [...this.state.discoveries],
      discoveredPOIs: (this.state.discoveredPOIs || []).map((p) => ({ ...p })),
      clearedChallenges: [...(this.state.clearedChallenges || [])],
      seenSpecies: { ...this.state.seenSpecies },
      capturedSpecies: { ...this.state.capturedSpecies },
      eggs: this.state.eggs.map((e) => ({ ...e })),
      shelterTier: this.state.shelterTier,
      home: cloneHomeState(this.state.home),
      mecha: (() => {
        const m = ensureMechaState(this.state);
        return {
          ...m,
          unlockedThemes: [...m.unlockedThemes],
          upgrades: [...m.upgrades],
        };
      })(),
      trainingRecords: Object.fromEntries(
        Object.entries(this.state.trainingRecords || {}).map(([k, v]) => [k, { ...v }])
      ),
      clearedTournaments: [...(this.state.clearedTournaments || [])],
      raceRecords: Object.fromEntries(
        Object.entries(this.state.raceRecords || {}).map(([k, v]) => [k, { ...v }])
      ),
      journalEntries: [...(this.state.journalEntries || [])],
      completedDialogues: [...(this.state.completedDialogues || [])],
      discoveredSecrets: [...(this.state.discoveredSecrets || [])],
      rooms: this.getRoomValidations(false),
      nearbyHomeSlug: nearHome
        ? {
            ...nearHome,
            slug: {
              ...nearHome.slug,
              ...(nearHome.slug.moveMastery
                ? { moveMastery: [...nearHome.slug.moveMastery] as [number, number] }
                : {}),
            },
          }
        : null,
      stats: { ...this.state.stats },
      defeatedBosses: [...this.state.defeatedBosses],
      claimedQuests: [...this.state.claimedQuests],
      story: buildStoryHudSummary(this.state, this.recentChapterAlert),
      storyState: this.cloneStoryState(),
      options: { ...this.state.options },
      battle: this.combat.battle
        ? {
            ...this.combat.battle,
            enemy: { ...this.combat.battle.enemy },
            playerDuelist: { ...this.combat.battle.playerDuelist },
            enemyDuelist: { ...this.combat.battle.enemyDuelist },
            allyStatus: { ...this.combat.battle.allyStatus },
            projectiles: this.combat.battle.projectiles.map((p) => ({ ...p, trail: [...p.trail] })),
            obstacles: this.combat.battle.obstacles.map((o) => ({ ...o })),
            shockwaves: this.combat.battle.shockwaves.map((s) => ({ ...s })),
            log: [...this.combat.battle.log],
            effects: [...this.combat.battle.effects],
          }
        : null,
      activeDialogueId: this.activeDialogueId,
      activeTournament: this.activeTournament ? { ...this.activeTournament } : null,
      toast: this.toastText,
      hasV4Save: this.hasV4,
      hasV3Save: this.hasV3,
      pulseCooldownPct: Math.max(0, Math.min(1, 1 - this.pulseCooldown / this.pulseMaxCooldown)),
      worldCombat: (() => {
        const activeSlug = this.state.party[this.state.activePartyIndex] || this.state.party[0];
        const activeSp = activeSlug ? getSpecies(activeSlug.id) : null;
        return {
          aimAngle: this.worldAimAngle,
          dodgeCooldown: this.playerDodgeCooldown,
          dodgeMaxCooldown: 1.1,
          dodging: this.playerDodgeTimer > 0,
          fireCooldown: this.worldFireCooldown,
          ability1Cooldown: this.getWorldAbilityCooldown(0),
          ability2Cooldown: this.getWorldAbilityCooldown(1),
          ability1Name: activeSp?.specialMoves[0]?.name || 'Habilidad 1',
          ability2Name: activeSp?.specialMoves[1]?.name || 'Habilidad 2',
          ability1Cost: activeSp?.specialMoves[0]?.energyCost || 4,
          ability2Cost: activeSp?.specialMoves[1]?.energyCost || 6,
          projectileCount: this.worldProjectiles.length,
        };
      })(),
    };
  }

  public emitHud(force = false): void {
    const now = performance.now();
    if (!force && now - this.lastHudPush < 90) return;
    this.lastHudPush = now;
    const snap = this.getSnapshot();
    this.listeners.forEach((fn) => fn(snap));
  }

  public notify(msg: string): void {
    this.toastText = msg;
    this.toastTimer = 2.6;
    this.emitHud(true);
  }

  public attachCanvases(
    main: HTMLCanvasElement | null,
    minimap: HTMLCanvasElement | null,
    fullMap: HTMLCanvasElement | null
  ): void {
    this.canvas = main;
    this.minimapCanvas = minimap;
    this.fullMapCanvas = fullMap;
    this.resizeCanvas();
    if (this.fullMapCanvas && this.screen === 'FULL_MAP') {
      this.renderer.renderFullWorldMap(this.fullMapCanvas, this.state);
    }
  }

  public resizeCanvas(): void {
    if (!this.canvas) return;
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.max(300, Math.floor(rect.width * this.dpr));
    const h = Math.max(200, Math.floor(rect.height * this.dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  public startLoop(): void {
    if (this.rafId !== null) return;
    this.lastTs = performance.now();
    const tick = (ts: number) => {
      const rawDt = (ts - this.lastTs) / 1000;
      this.lastTs = ts;
      const dt = Math.min(Math.max(rawDt, 0), 0.05);
      this.step(dt, ts);
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  public stopLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  public startNewGame(): void {
    this.state = createInitialGameState();
    this.activeDialogueId = null;
    this.activeTournament = null;
    ensureHomeState(this.state);
    this.ensureExplorationFields();
    ensureStoryState(this.state);
    this.recentChapterAlert = null;
    this.recentChapterAlertTimer = 0;
    this.invalidateRoomCache();
    this.autoSaveErrorNotified = false;
    this.applyOptionsToAudio();
    this.worldProjectiles = [];
    this.playerVx = 0;
    this.playerVy = 0;
    this.playerDodgeTimer = 0;
    this.playerDodgeCooldown = 0;
    this.playerInvulnTimer = 0;
    this.worldFireCooldown = 0;
    this.worldAbilityCooldowns = {};
    this.chunks.reset(this.state.worldSeed, this.state.tilesDelta);
    this.chunks.ensureWindowAround(this.state.player.x, this.state.player.y, 2);
    this.renderer.resetCamera(this.state.player.x, this.state.player.y);
    this.seedInitialEntities();
    this.screen = 'PLAYING';
    this.syncAmbientMusic();
    void requestPersistentStorageIfNeeded();
    this.notify('¡Nueva expedición iniciada en las Cuevas Verdes!');
    this.emitHud(true);
  }

  public async continueSavedGame(): Promise<void> {
    const loadRes = await loadGameV4Detailed({ syncStores: true });
    if (!loadRes.state) {
      this.startNewGame();
      return;
    }
    this.state = loadRes.state;
    ensureHomeState(this.state);
    this.ensureExplorationFields();
    ensureStoryState(this.state);
    this.syncStoryProgress({ skipRewards: true });
    this.recentChapterAlert = null;
    this.recentChapterAlertTimer = 0;
    this.invalidateRoomCache();
    this.autoSaveErrorNotified = false;
    this.applyOptionsToAudio();
    this.chunks.reset(this.state.worldSeed, this.state.tilesDelta);
    this.chunks.ensureWindowAround(this.state.player.x, this.state.player.y, 2);
    this.renderer.resetCamera(this.state.player.x, this.state.player.y);
    this.seedInitialEntities();
    this.screen = 'PLAYING';
    this.syncAmbientMusic();
    void requestPersistentStorageIfNeeded();
    this.notify(
      loadRes.recoveredFromCorruption
        ? 'Partida 4.0 recuperada desde copia de respaldo válida.'
        : 'Partida 4.0 cargada.'
    );
    this.emitHud(true);
  }

  public async importDetectedV3Save(): Promise<boolean> {
    if (!this.v3RawCache) return false;
    const parsed = parseImportedJsonSaveDetailed(this.v3RawCache);
    if (!parsed.ok || parsed.kind !== 'v3' || !parsed.state) {
      this.notify(parsed.error || 'No se pudo validar la partida 3.0 local.');
      return false;
    }
    const saveRes = await saveGameV4(parsed.state, { reason: 'import' });
    this.lastSaveResult = saveRes;
    if (!saveRes.ok) {
      this.notify('No se pudo guardar la migración 3.0 en el navegador. Verifica el almacenamiento.');
      return false;
    }
    this.state = parsed.state;
    ensureHomeState(this.state);
    this.ensureExplorationFields();
    ensureStoryState(this.state);
    this.syncStoryProgress({ skipRewards: true });
    this.recentChapterAlert = null;
    this.recentChapterAlertTimer = 0;
    this.invalidateRoomCache();
    this.autoSaveErrorNotified = false;
    this.applyOptionsToAudio();
    this.chunks.reset(this.state.worldSeed, this.state.tilesDelta);
    this.chunks.ensureWindowAround(this.state.player.x, this.state.player.y, 2);
    this.renderer.resetCamera(this.state.player.x, this.state.player.y);
    this.seedInitialEntities();
    this.hasV4 = true;
    this.screen = 'PLAYING';
    this.syncAmbientMusic();
    void requestPersistentStorageIfNeeded();
    this.notify('¡Partida de Bajoterra 3.0 importada sin sobrescribir la original!');
    this.emitHud(true);
    return true;
  }

  public async importJsonText(jsonText: string): Promise<'v4' | 'v3' | null> {
    const res = parseImportedJsonSaveDetailed(jsonText);
    if (!res.ok || !res.kind || !res.state) {
      this.notify(res.error || 'Archivo de partida no válido.');
      return null;
    }
    const saveRes = await saveGameV4(res.state, { reason: 'import' });
    this.lastSaveResult = saveRes;
    if (!saveRes.ok) {
      this.notify('Importación validada pero falló el guardado en el navegador. Exporta un respaldo JSON.');
      return null;
    }
    this.state = res.state;
    ensureHomeState(this.state);
    this.ensureExplorationFields();
    ensureStoryState(this.state);
    this.syncStoryProgress({ skipRewards: true });
    this.recentChapterAlert = null;
    this.recentChapterAlertTimer = 0;
    this.invalidateRoomCache();
    this.autoSaveErrorNotified = false;
    this.applyOptionsToAudio();
    this.chunks.reset(this.state.worldSeed, this.state.tilesDelta);
    this.chunks.ensureWindowAround(this.state.player.x, this.state.player.y, 2);
    this.renderer.resetCamera(this.state.player.x, this.state.player.y);
    this.seedInitialEntities();
    this.hasV4 = true;
    this.screen = 'PLAYING';
    this.syncAmbientMusic();
    void requestPersistentStorageIfNeeded();
    this.notify(
      res.kind === 'v3'
        ? 'Respaldo 3.0 migrado a Bajoterra 4.0.'
        : 'Partida 4.0 restaurada.'
    );
    this.emitHud(true);
    return res.kind;
  }

  public async manualSave(): Promise<SaveResult> {
    const res = await saveGameV4(this.state, { reason: 'manual' });
    this.lastSaveResult = res;
    if (!res.ok) {
      this.notify('Error al guardar: almacenamiento lleno o bloqueado. Exporta respaldo JSON.');
      return res;
    }
    this.hasV4 = true;
    this.autoSaveErrorNotified = false;
    sound.playUi();
    if (res.storedIn === 'both') {
      this.notify('Partida guardada (IndexedDB y navegador).');
    } else if (res.storedIn === 'indexeddb') {
      this.notify('Partida guardada en IndexedDB (almacenamiento local no disponible).');
    } else {
      this.notify('Partida guardada en almacenamiento local (IndexedDB no disponible).');
    }
    return res;
  }

  private async runBackgroundSave(reason: 'autosave' | 'battle' | 'sync'): Promise<void> {
    const res = await saveGameV4(this.state, { reason });
    if (res.skipped) return;
    this.lastSaveResult = res;
    if (res.ok) {
      this.hasV4 = true;
      this.autoSaveErrorNotified = false;
    } else if (!this.autoSaveErrorNotified) {
      this.autoSaveErrorNotified = true;
      this.notify('Aviso: no se pudo autoguardar. Usa Exportar Respaldo JSON.');
    }
  }

  public handleLifecycleSave(_source: 'pagehide' | 'visibility-hidden'): void {
    if (this.screen === 'TITLE') return;
    // Synchronous localStorage best-effort + async IDB attempt; close events cannot guarantee async completion
    void saveGameV4(this.state, { reason: 'lifecycle', syncLocalStorageFirst: true }).then((res) => {
      if (!res.skipped) {
        this.lastSaveResult = res;
        if (res.ok) this.hasV4 = true;
      }
    });
  }

  public async handleTabReturn(): Promise<void> {
    this.clearInputs();
    this.lastTs = performance.now();
    this.resizeCanvas();
    if (this.screen === 'TITLE') {
      await this.checkSavesAvailability();
      return;
    }
    this.storageCapabilities = await checkStorageCapabilities();
    await this.runBackgroundSave('sync');
    this.emitHud(true);
  }

  public setScreen(screen: UIScreen): void {
    this.screen = screen;
    this.keysHeld.clear();
    sound.playUi();
    this.syncAmbientMusic();
    this.emitHud(true);
    if (screen === 'FULL_MAP' && this.fullMapCanvas) {
      requestAnimationFrame(() => {
        if (this.fullMapCanvas) {
          this.renderer.renderFullWorldMap(this.fullMapCanvas, this.state);
        }
      });
    }
  }

  private syncAmbientMusic(): void {
    if (this.screen === 'TITLE') {
      sound.stopAllMusic();
      return;
    }
    const biome = getBiomeAt(
      Math.floor(this.state.player.x + 0.5),
      Math.floor(this.state.player.y + 0.5),
      this.state.worldSeed
    );
    sound.setAmbientBiome(biome, true);
  }

  public setHotbar(index: number): void {
    if (index < 0 || index >= HOTBAR_SLOTS.length) return;
    this.state.selectedHotbar = index;
    sound.playUi();
    this.emitHud(true);
  }

  public setActivePartyIndex(index: number): void {
    if (index < 0 || index >= this.state.party.length) return;
    this.state.activePartyIndex = index;
    sound.playUi();
    this.notify(`Babosa activa: ${getSlugDisplayName(this.state.party[index])}`);
  }

  public updateOptions(patch: Partial<GameOptions>): void {
    this.state.options = { ...this.state.options, ...patch };
    this.applyOptionsToAudio();
    this.emitHud(true);
  }

  private applyOptionsToAudio(): void {
    sound.enabled = this.state.options.soundEnabled;
    sound.volume = this.state.options.volume;
  }

  public handleKeyDown(e: KeyboardEvent): void {
    const target = e.target as { tagName?: string; isContentEditable?: boolean } | null;
    const tag = target?.tagName?.toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
      return;
    }
    const key = e.key.toLowerCase();
    const bindings = resolveEffectiveBindings(this.state.options.keyBindings);
    const boundAction = findActionForKey(key, bindings);
    if (
      ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'tab'].includes(key) ||
      (boundAction !== null &&
        ['inventory', 'dodge', 'moveUp', 'moveDown', 'moveLeft', 'moveRight'].includes(boundAction))
    ) {
      e.preventDefault();
    }

    if (this.screen === 'TITLE') {
      if (key === 'enter' || key === ' ') {
        if (this.hasV4) this.continueSavedGame();
        else this.startNewGame();
      }
      return;
    }

    if (this.combat.battle) {
      if (key === 'escape') return;
      return;
    }

    if (key === 'escape' || boundAction === 'pause') {
      if (this.screen === 'PLAYING') this.setScreen('PAUSED');
      else this.setScreen('PLAYING');
      return;
    }

    if (this.screen !== 'PLAYING') {
      if (key === 'i' || key === 'tab' || boundAction === 'inventory') this.setScreen('PLAYING');
      if ((key === 'm' || boundAction === 'map') && this.screen === 'FULL_MAP') this.setScreen('PLAYING');
      return;
    }

    // Edge-triggered actions
    if (!e.repeat) {
      const action = boundAction;
      if (action === 'slug1' || key === '1') {
        if (this.state.party.length > 0) this.setActivePartyIndex(0);
      } else if (action === 'slug2' || key === '2') {
        if (this.state.party.length > 1) this.setActivePartyIndex(1);
      } else if (action === 'slug3' || key === '3') {
        if (this.state.party.length > 2) this.setActivePartyIndex(2);
      } else if (action === 'slug4' || key === '4') {
        if (this.state.party.length > 3) this.setActivePartyIndex(3);
      } else if (key === 'f' || action === 'interact') {
        this.performPrimaryAction();
      } else if (action === 'dodge' || key === ' ') {
        this.triggerDodge();
      } else if (action === 'ability1') {
        this.triggerWorldAbility(0);
      } else if (action === 'ability2') {
        this.triggerWorldAbility(1);
      } else if (action === 'pulse') {
        this.triggerExplorationPulse();
      } else if (action === 'fire') {
        this.fireWorldBlaster('quick');
      } else if (action === 'secondary') {
        this.performSecondaryOverworldAction();
      } else if (key === 'i' || key === 'tab' || action === 'inventory') {
        this.setScreen('EXPEDITION');
      } else if (action === 'map' || key === 'm') {
        this.setScreen('FULL_MAP');
      } else if (action === 'cycleSlug' || key === 'q') {
        const nextIdx = (this.state.activePartyIndex + 1) % this.state.party.length;
        this.setActivePartyIndex(nextIdx);
      } else if ((key === 'v' || action === 'mecha') && this.state.mecha?.unlocked) {
        this.toggleMecha();
      }
    }

    this.keysHeld.add(key);
  }

  public handleKeyUp(e: KeyboardEvent): void {
    this.keysHeld.delete(e.key.toLowerCase());
  }

  public clearInputs(): void {
    this.keysHeld.clear();
    this.joyVec = { x: 0, y: 0 };
    this.touchSprinting = false;
    this.playerVx = 0;
    this.playerVy = 0;
  }

  public setJoystick(x: number, y: number): void {
    this.joyVec = { x, y };
  }

  public setTouchSprint(active: boolean): void {
    this.touchSprinting = active;
  }

  public handleCanvasPointerMove(clientX: number, clientY: number): void {
    if (this.screen !== 'PLAYING' || this.combat.battle || !this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const dxPx = clientX - rect.left - rect.width / 2;
    const dyPx = clientY - rect.top - rect.height / 2;
    if (Math.hypot(dxPx, dyPx) > 6) {
      this.worldAimAngle = Math.atan2(dyPx, dxPx);
    }
  }

  public handleCanvasClick(clientX: number, clientY: number): void {
    if (this.screen !== 'PLAYING' || this.combat.battle || !this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const cx = clientX - rect.left;
    const cy = clientY - rect.top;
    const dxPx = cx - rect.width / 2;
    const dyPx = cy - rect.height / 2;
    if (Math.hypot(dxPx, dyPx) > 10) {
      const ang = Math.atan2(dyPx, dxPx);
      this.worldAimAngle = ang;
      this.state.player.facingX = Math.round(Math.cos(ang));
      this.state.player.facingY = Math.round(Math.sin(ang));
      if (this.state.player.facingX === 0 && this.state.player.facingY === 0) {
        this.state.player.facingY = 1;
      }
    }
    const resolved = this.resolvePrimaryInteraction();
    const worldInteractKinds = [
      'talk',
      'combat',
      'discover_secret',
      'inspect_gate',
      'open_door',
      'close_door',
      'open_chest',
      'break_secret',
      'recharge',
      'altar',
      'pickup_furniture',
      'interact_slug',
    ];
    if (worldInteractKinds.includes(resolved.contextual.kind)) {
      resolved.execute();
    } else {
      this.fireWorldBlaster('quick');
    }
  }

  public handleCanvasSecondary(clientX: number, clientY: number): void {
    if (this.screen !== 'PLAYING' || this.combat.battle) return;
    this.handleCanvasPointerMove(clientX, clientY);
    this.performSecondaryOverworldAction();
  }

  public performSecondaryOverworldAction(): void {
    const resolved = this.resolvePrimaryInteraction();
    if (resolved.contextual.kind === 'pulse' || resolved.contextual.kind === 'berry' || resolved.contextual.kind === 'place_station') {
      resolved.execute();
      return;
    }
    if (this.state.inventory.berries > 0 && this.state.player.hp < this.state.player.maxHp * 0.7) {
      this.useQuickBerry();
      return;
    }
    this.triggerExplorationPulse();
  }

  private getTargetTile(): { x: number; y: number } {
    const px = Math.floor(this.state.player.x + 0.5);
    const py = Math.floor(this.state.player.y + 0.5);
    const fx = this.state.player.facingX;
    const fy = this.state.player.facingY;
    const tx = Math.max(0, Math.min(WORLD_W - 1, px + (fx || 0)));
    const ty = Math.max(0, Math.min(WORLD_H - 1, py + (fy || (fx === 0 ? 1 : 0))));
    return { x: tx, y: ty };
  }

  private step(dt: number, ts: number): void {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) {
        this.toastText = '';
        this.emitHud(true);
      }
    }
    if (this.recentChapterAlertTimer > 0) {
      this.recentChapterAlertTimer -= dt;
      if (this.recentChapterAlertTimer <= 0) {
        this.recentChapterAlert = null;
        this.emitHud(true);
      }
    }

    if (this.lavaDamageCooldown > 0) this.lavaDamageCooldown -= dt;
    if (this.pulseCooldown > 0) {
      this.pulseCooldown = Math.max(0, this.pulseCooldown - dt);
    }
    if (this.playerDodgeTimer > 0) this.playerDodgeTimer = Math.max(0, this.playerDodgeTimer - dt);
    if (this.playerDodgeCooldown > 0) this.playerDodgeCooldown = Math.max(0, this.playerDodgeCooldown - dt);
    if (this.playerInvulnTimer > 0) this.playerInvulnTimer = Math.max(0, this.playerInvulnTimer - dt);
    if (this.worldFireCooldown > 0) this.worldFireCooldown = Math.max(0, this.worldFireCooldown - dt);
    for (const k of Object.keys(this.worldAbilityCooldowns)) {
      if (this.worldAbilityCooldowns[k] > 0) {
        this.worldAbilityCooldowns[k] = Math.max(0, this.worldAbilityCooldowns[k] - dt);
      }
    }

    if (this.screen === 'TITLE') {
      this.timeSec += dt;
      // Gentle atmospheric drift on Title Screen
      const px = SPAWN_X + Math.sin(this.timeSec * 0.25) * 6;
      const py = SPAWN_Y + Math.cos(this.timeSec * 0.2) * 5;
      this.renderer.updateEffects(dt, { ...this.state, player: { ...this.state.player, x: px, y: py } }, 'Verdes');
      this.renderFrame();
      return;
    }

    if (this.screen === 'PLAYING' && !this.combat.battle) {
      this.timeSec += dt;
      this.state.playTimeSec += dt;
      this.autoSaveTimer += dt;
      if (this.autoSaveTimer >= 25) {
        this.autoSaveTimer = 0;
        void this.runBackgroundSave('autosave');
      }

      const activeSlug = this.state.party[this.state.activePartyIndex];
      if (activeSlug && activeSlug.energy < activeSlug.maxEnergy) {
        activeSlug.energy = Math.min(activeSlug.maxEnergy, activeSlug.energy + dt * 1.15);
      }

      this.updatePlayerMovement(dt);
      this.updateWorldProjectiles(dt);
      this.updateEntities(dt);
      const playerNearShelter = Math.hypot(this.state.player.x - SPAWN_X, this.state.player.y - SPAWN_Y) <= 22;
      updateHomeResidents(dt, this.state, this.chunks, this.getRoomValidations(false), playerNearShelter);
      this.updateShelterAura(dt);

      const biome = getBiomeAt(
        Math.floor(this.state.player.x + 0.5),
        Math.floor(this.state.player.y + 0.5),
        this.state.worldSeed
      );
      this.renderer.updateEffects(dt, this.state, biome);

      if (this.minimapCanvas && this.state.options.showMinimap && ts - this.lastMinimapDraw > 180) {
        this.lastMinimapDraw = ts;
        this.renderer.renderMinimap(this.minimapCanvas, this.state);
      }

      this.emitHud(false);
    }

    this.renderFrame();
  }

  private renderFrame(): void {
    if (!this.canvas) return;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    const vw = this.canvas.width / this.dpr;
    const vh = this.canvas.height / this.dpr;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const target = this.screen === 'PLAYING' && !this.combat.battle ? this.getTargetTile() : null;
    this.renderer.renderWorld(
      ctx,
      vw,
      vh,
      this.timeSec,
      this.state,
      this.chunks,
      this.entities,
      target,
      this.worldProjectiles,
      this.screen === 'PLAYING' && !this.combat.battle
        ? {
            aimAngle: this.worldAimAngle,
            dodging: this.playerDodgeTimer > 0,
            invuln: this.playerInvulnTimer > 0,
          }
        : undefined
    );
  }

  public triggerDodge(dirX?: number, dirY?: number): boolean {
    if (this.screen !== 'PLAYING' || this.combat.battle) return false;
    if (this.playerDodgeCooldown > 0) return false;

    let dx = dirX ?? 0;
    let dy = dirY ?? 0;
    if (Math.hypot(dx, dy) < 0.1) {
      const held = isMovementHeld(this.keysHeld, this.state.options.keyBindings);
      dx = held.x + this.joyVec.x;
      dy = held.y + this.joyVec.y;
    }
    const mag = Math.hypot(dx, dy);
    if (mag < 0.1) {
      dx = Math.cos(this.worldAimAngle);
      dy = Math.sin(this.worldAimAngle);
    } else {
      dx /= mag;
      dy /= mag;
    }

    const dashSpd = 12.4 * getMechaSpeedMultiplier(this.state);
    this.playerDodgeVx = dx * dashSpd;
    this.playerDodgeVy = dy * dashSpd;
    this.playerDodgeTimer = 0.18;
    this.playerDodgeCooldown = 1.1;
    this.playerInvulnTimer = 0.26;
    sound.playBlasterSelect();
    this.renderer.spawnBurst(Math.round(this.state.player.x), Math.round(this.state.player.y), '#5eead4', 8);
    this.emitHud(true);
    return true;
  }

  public getWorldAbilityCooldown(slotIdx: 0 | 1): number {
    const active = this.state.party[this.state.activePartyIndex];
    if (!active) return 0;
    const sp = getSpecies(active.id);
    const mv = sp.specialMoves[slotIdx];
    return mv ? Math.max(0, this.worldAbilityCooldowns[`${active.uid}_${mv.id}`] || 0) : 0;
  }

  public triggerWorldAbility(slotIdx: 0 | 1): boolean {
    if (this.screen !== 'PLAYING' || this.combat.battle) return false;
    return Boolean(this.fireWorldBlaster(slotIdx === 0 ? 'ability1' : 'ability2'));
  }

  public fireWorldBlaster(mode: 'quick' | 'ability1' | 'ability2' = 'quick'): WorldProjectile | null {
    if (this.screen !== 'PLAYING' || this.combat.battle) return null;
    const ally = this.state.party[this.state.activePartyIndex] || this.state.party[0];
    if (!ally) return null;
    const sp = getSpecies(ally.id);
    const profile = getSlugCombatProfile(sp);

    if (mode === 'quick' && this.worldFireCooldown > 0) return null;

    let moveId: string | undefined;
    let moveEffect: WorldProjectile['moveEffect'];
    let powerMult = 1.0;

    if (mode === 'ability1' || mode === 'ability2') {
      const idx = mode === 'ability1' ? 0 : 1;
      const mv = sp.specialMoves[idx];
      const cdKey = `${ally.uid}_${mv.id}`;
      const cd = this.worldAbilityCooldowns[cdKey] || 0;
      if (cd > 0) {
        this.notify(`${mv.name} recargándose (${cd.toFixed(1)}s).`);
        return null;
      }
      if (ally.energy < mv.energyCost) {
        this.notify(`Energía insuficiente para ${mv.name} (${mv.energyCost} EN).`);
        return null;
      }
      ally.energy -= mv.energyCost;
      this.worldAbilityCooldowns[cdKey] = Math.max(2.2, mv.cooldown * 1.4);
      moveId = mv.id;
      moveEffect = mv.effect;
      powerMult = mv.power > 0 ? mv.power : 0.85;

      if (mv.effect === 'heal') {
        const healAmt = Math.max(14, Math.round(this.state.player.maxHp * 0.25));
        this.state.player.hp = Math.min(this.state.player.maxHp, this.state.player.hp + healAmt);
        ally.hp = Math.min(ally.maxHp, ally.hp + healAmt);
        sound.playHeal();
        this.renderer.spawnBurst(Math.round(this.state.player.x), Math.round(this.state.player.y), '#4ade80', 14);
        this.renderer.addFloatingText(Math.round(this.state.player.x), Math.round(this.state.player.y), `+${healAmt} PS`, '#4ade80');
        this.emitHud(true);
        return null;
      }
      if (mv.effect === 'shield') {
        this.playerInvulnTimer = Math.max(this.playerInvulnTimer, 2.2);
        sound.playShieldBlock(true);
        this.renderer.spawnBurst(Math.round(this.state.player.x), Math.round(this.state.player.y), '#38bdf8', 12);
        this.renderer.addFloatingText(Math.round(this.state.player.x), Math.round(this.state.player.y), 'Escudo activo', '#38bdf8');
        this.emitHud(true);
        return null;
      }
    }

    const angle = this.worldAimAngle;
    const speedTiles = Math.max(9.5, (profile.baseLaunchSpeed / 36) * (mode === 'quick' ? 1 : 1.18));
    const spawnX = this.state.player.x + Math.cos(angle) * 0.65;
    const spawnY = this.state.player.y + Math.sin(angle) * 0.65;
    const baseDmg = Math.max(
      12,
      Math.round(ally.atk * powerMult * (ally.mega ? 1.2 : 1) * (mode === 'quick' ? 0.9 : 1.35))
    );

    const wp: WorldProjectile = {
      id: this.worldProjSeq++,
      owner: 'ally',
      speciesId: sp.id,
      element: sp.type,
      mode,
      moveId,
      moveEffect,
      x: spawnX,
      y: spawnY,
      vx: Math.cos(angle) * speedTiles,
      vy: Math.sin(angle) * speedTiles,
      radiusTiles: Math.max(0.28, (profile.hitboxRadius / TILE_PX) * (mode === 'quick' ? 1 : 1.2)),
      damage: baseDmg,
      rangeTilesLeft: mode === 'quick' ? 11.5 : 15,
      traveledTiles: 0,
      transformDistTiles: Math.max(1.6, profile.transformDist / 48),
      phase: 'protoform',
      bouncesLeft: profile.bounces,
      homing: profile.homing,
      pierceLeft: moveEffect === 'pierce' ? 2 : 0,
      trail: [{ x: spawnX, y: spawnY }],
      alive: true,
    };

    this.worldProjectiles.push(wp);
    this.worldFireCooldown = Math.max(0.24, profile.reloadSec);
    sound.playBlasterFire(mode !== 'quick', false);
    this.emitHud(true);
    return wp;
  }

  private updatePlayerMovement(dt: number): void {
    const held = isMovementHeld(this.keysHeld, this.state.options.keyBindings);
    const dx = held.x + this.joyVec.x;
    const dy = held.y + this.joyVec.y;

    const mag = Math.hypot(dx, dy);
    const wantSprint = this.keysHeld.has('shift') || this.touchSprinting;
    const isSprinting = wantSprint && this.state.player.stamina > 2 && mag > 0.1;
    const mechaMounted = Boolean(this.state.mecha?.unlocked && this.state.mecha?.active);
    const mechaTier = this.state.mecha?.tier ?? 1;

    if (isSprinting) {
      const sprintDrain = mechaMounted ? (mechaTier >= 3 ? 7.5 : 13) : 22;
      this.state.player.stamina = Math.max(0, this.state.player.stamina - sprintDrain * dt);
    } else {
      this.state.player.stamina = Math.min(this.state.player.maxStamina, this.state.player.stamina + 16 * dt);
    }

    const tileStanding = this.chunks.getTile(
      Math.floor(this.state.player.x + 0.5),
      Math.floor(this.state.player.y + 0.5)
    );
    const iceBoost = tileStanding === TileType.ICE_FLOOR ? (mechaMounted && mechaTier >= 2 ? 1.32 : 1.24) : 1;
    const mechaMult = getMechaSpeedMultiplier(this.state);
    const speedTilesPerSec = (isSprinting ? 7.6 : 4.9) * iceBoost * mechaMult;

    let targetVx = 0;
    let targetVy = 0;
    if (this.playerDodgeTimer > 0) {
      this.playerVx = this.playerDodgeVx;
      this.playerVy = this.playerDodgeVy;
    } else if (mag >= 0.12) {
      const nxDir = dx / mag;
      const nyDir = dy / mag;
      if (Math.abs(nxDir) > Math.abs(nyDir)) {
        this.state.player.facingX = nxDir >= 0 ? 1 : -1;
        this.state.player.facingY = 0;
      } else {
        this.state.player.facingX = 0;
        this.state.player.facingY = nyDir >= 0 ? 1 : -1;
      }
      if (Math.abs(this.joyVec.x) > 0.1 || Math.abs(this.joyVec.y) > 0.1) {
        this.worldAimAngle = Math.atan2(nyDir, nxDir);
      }
      targetVx = nxDir * speedTilesPerSec;
      targetVy = nyDir * speedTilesPerSec;
      const accelLerp = 1 - Math.exp(-42 * dt);
      this.playerVx += (targetVx - this.playerVx) * accelLerp;
      this.playerVy += (targetVy - this.playerVy) * accelLerp;
    } else {
      const decelLerp = 1 - Math.exp(-22 * dt);
      this.playerVx += (0 - this.playerVx) * decelLerp;
      this.playerVy += (0 - this.playerVy) * decelLerp;
      if (Math.hypot(this.playerVx, this.playerVy) < 0.08) {
        this.playerVx = 0;
        this.playerVy = 0;
      }
    }

    if (Math.hypot(this.playerVx, this.playerVy) < 0.01) return;

    const stepX = this.playerVx * dt;
    const stepY = this.playerVy * dt;
    const currentlyGated = this.getWalkingGateLockReason(this.state.player.x, this.state.player.y) !== null;

    const canWalk = (x: number, y: number): boolean => {
      if (x < 2 || y < 2 || x >= WORLD_W - 2 || y >= WORLD_H - 2) return false;
      const cxCenter = x + 0.5;
      const cyCenter = y + 0.5;
      const r = 0.34;
      const pts = [
        [cxCenter - r, cyCenter - r],
        [cxCenter + r, cyCenter - r],
        [cxCenter - r, cyCenter + r],
        [cxCenter + r, cyCenter + r],
      ];
      for (const [cx, cy] of pts) {
        const t = this.chunks.getTile(Math.floor(cx), Math.floor(cy));
        if (isTileSolid(t)) return false;
      }
      if (!currentlyGated) {
        const gateReason = this.getWalkingGateLockReason(x, y);
        if (gateReason) {
          const now = Date.now();
          if (now - this.lastGateToastAt > 2200) {
            this.lastGateToastAt = now;
            sound.playUi();
            this.renderer.addFloatingText(Math.round(x), Math.round(y), 'Ruta sellada', '#fbbf24');
            this.notify(`Ruta sellada: ${gateReason}`);
          }
          return false;
        }
      }
      return true;
    };

    const prevX = this.state.player.x;
    const prevY = this.state.player.y;

    if (Math.abs(stepX) > 0) {
      if (canWalk(this.state.player.x + stepX, this.state.player.y)) {
        this.state.player.x += stepX;
      } else if (Math.abs(stepY) < 0.01) {
        for (const nudge of [0.16, -0.16, 0.32, -0.32]) {
          if (canWalk(this.state.player.x + stepX, this.state.player.y + nudge)) {
            this.state.player.y += Math.sign(nudge) * Math.min(Math.abs(nudge), Math.abs(stepX) * 0.9);
            this.state.player.x += stepX * 0.5;
            break;
          }
        }
      }
    }
    if (Math.abs(stepY) > 0) {
      if (canWalk(this.state.player.x, this.state.player.y + stepY)) {
        this.state.player.y += stepY;
      } else if (Math.abs(stepX) < 0.01) {
        for (const nudge of [0.16, -0.16, 0.32, -0.32]) {
          if (canWalk(this.state.player.x + nudge, this.state.player.y + stepY)) {
            this.state.player.x += Math.sign(nudge) * Math.min(Math.abs(nudge), Math.abs(stepY) * 0.9);
            this.state.player.y += stepY * 0.5;
            break;
          }
        }
      }
    }

    const moved = Math.hypot(this.state.player.x - prevX, this.state.player.y - prevY);
    if (moved > 0) {
      const prevSteps = this.state.stats.steps;
      this.state.stats.steps += moved;
      if (Math.floor(prevSteps / 60) < Math.floor(this.state.stats.steps / 60)) {
        const active = this.state.party[this.state.activePartyIndex];
        if (active) {
          const msgs = awardSlugExperience(this.state, active, 4, { bondDelta: 1, allowTraitBonus: false });
          if (msgs.length > 0) {
            this.notify(msgs[0]);
          }
        }
      }
      this.onPlayerMoved(moved);
    }
  }

  public getWalkingGateLockReason(x: number, y: number): string | null {
    const tx = Math.floor(x + 0.5);
    const ty = Math.floor(y + 0.5);
    const story = ensureStoryState(this.state);

    // Chapter 2 settlement: Puesto del Valle Verde (east corridor)
    if (tx >= 176 && tx <= 200 && ty >= 149 && ty <= 171) {
      const access = canAccessRoute(this.state, 'ruta_valle_verde');
      if (!story.unlockedScenarioIds.includes('esc_pueblo_valle_verde') && !access.allowed) {
        return access.reason;
      }
    }

    // Chapter 3 outpost: Puesto de Contrabando Oscuro
    if (tx >= 186 && tx <= 208 && ty >= 125 && ty <= 148) {
      const access = canAccessRoute(this.state, 'ruta_frontera_oscura');
      if (!story.unlockedScenarioIds.includes('esc_puesto_agua_oscura') && !access.allowed) {
        return access.reason;
      }
    }

    // Chapter 7 vault: Cámara del Acelerador 200 MPH
    if (tx >= 185 && tx <= 208 && ty >= 236 && ty <= 260) {
      const access = canAccessRoute(this.state, 'ruta_taller_acelerador');
      if (!story.unlockedScenarioIds.includes('esc_taller_acelerador') && !access.allowed) {
        return access.reason;
      }
    }

    const biome = getBiomeAt(tx, ty, this.state.worldSeed);
    if (biome === 'Acuaticas') {
      const access = canAccessRoute(this.state, 'ruta_gruta_acuatica');
      if (
        !story.unlockedScenarioIds.includes('esc_gruta_acuatica') &&
        !access.allowed &&
        !this.state.discoveries.includes('Acuaticas')
      ) {
        return access.reason;
      }
    } else if (biome === 'Heladas') {
      const access = canAccessRoute(this.state, 'ruta_cumbre_helada');
      if (
        !story.unlockedScenarioIds.includes('esc_caverna_helada') &&
        !access.allowed &&
        !this.state.discoveries.includes('Heladas')
      ) {
        return access.reason;
      }
    } else if (biome === 'Magma') {
      const access = canAccessRoute(this.state, 'ruta_grieta_magma');
      if (
        !story.unlockedScenarioIds.includes('esc_caverna_magma') &&
        !access.allowed &&
        !this.state.discoveries.includes('Magma')
      ) {
        return access.reason;
      }
    } else if (biome === 'Cristalinas') {
      const access = canAccessRoute(this.state, 'ruta_senda_cristalina');
      if (
        !story.unlockedScenarioIds.includes('esc_templo_cristalino') &&
        !access.allowed &&
        !this.state.discoveries.includes('Cristalinas')
      ) {
        return access.reason;
      }
    } else if (biome === 'Sombrias') {
      const access = canAccessRoute(this.state, 'ruta_abismo_sombrio');
      if (
        !story.unlockedScenarioIds.includes('esc_ciudadela_sombria') &&
        !access.allowed &&
        !this.state.discoveries.includes('Sombrias')
      ) {
        return access.reason;
      }
    }

    return null;
  }

  private onPlayerMoved(dist: number): void {
    const px = Math.floor(this.state.player.x + 0.5);
    const py = Math.floor(this.state.player.y + 0.5);

    // Stream chunks & mark explored
    const loaded = this.chunks.ensureWindowAround(px, py, 2);
    for (const ck of loaded) {
      this.state.exploredChunks[ck] = 1;
    }

    // Biome tracking & first discovery
    const b = getBiomeAt(px, py, this.state.worldSeed);
    sound.setAmbientBiome(b, this.screen !== 'TITLE');
    if (!this.state.discoveries.includes(b)) {
      this.state.discoveries.push(b);
      sound.playDiscovery(true);
      cinematicEvents.emit({
        type: 'biome_discovered',
        title: BIOME_INFO[b].name,
        subtitle: BIOME_INFO[b].subtitle,
        loreLine: BIOME_INFO[b].subtitle,
        biome: b,
        audioCue: 'discovery_wonder',
        skippable: true,
        priority: 'highlight',
        dedupeKey: `biome_${b}`,
      });
      this.notify(`¡Nuevo bioma descubierto: ${BIOME_INFO[b].name}!`);
      this.emitHud(true);
    }

    // Sync active story scenario when walking onto an unlocked scenario landmark
    const story = ensureStoryState(this.state);
    let closestSc: { id: string; name: string; d: number } | null = null;
    for (const sc of Object.values(STORY_SCENARIOS)) {
      if (!story.unlockedScenarioIds.includes(sc.id)) continue;
      const d = Math.hypot(px - sc.worldAnchor.x, py - sc.worldAnchor.y);
      if (d <= 11 && (!closestSc || d < closestSc.d)) {
        closestSc = { id: sc.id, name: sc.name, d };
      }
    }
    if (closestSc) {
      if (!story.scenarioPositions) story.scenarioPositions = {};
      story.scenarioPositions[closestSc.id] = {
        x: Math.round(this.state.player.x * 100) / 100,
        y: Math.round(this.state.player.y * 100) / 100,
      };
      if (story.currentScenarioId !== closestSc.id) {
        story.currentScenarioId = closestSc.id;
        if (!story.visitedScenarioIds.includes(closestSc.id)) {
          story.visitedScenarioIds.push(closestSc.id);
        }
        this.notify(`Zona: ${closestSc.name}`);
        this.emitHud(true);
      }
    }

    // Lava hazard (Resistencia Térmica gives full immunity; mounted Mecha M2/M3 shields partial heat damage)
    const under = this.chunks.getTile(px, py);
    if (isTileHazard(under) && this.lavaDamageCooldown <= 0) {
      this.lavaDamageCooldown = 0.8;
      if (!this.state.player.perks.includes('Resistencia Térmica')) {
        const mechaMounted = Boolean(this.state.mecha?.unlocked && this.state.mecha?.active);
        const mechaTier = this.state.mecha?.tier ?? 1;
        const hazardDmg = mechaMounted ? (mechaTier >= 3 ? 2 : mechaTier >= 2 ? 4 : 8) : 8;
        this.state.player.hp = Math.max(1, this.state.player.hp - hazardDmg);
        this.renderer.triggerShake(hazardDmg >= 8 ? 4 : 2.2, 0.18);
        const tag =
          mechaMounted && mechaTier >= 3
            ? `-${hazardDmg} ¡Escudo Meca M3!`
            : mechaMounted && mechaTier >= 2
            ? `-${hazardDmg} ¡Lava (Meca M2)!`
            : `-${hazardDmg} ¡Lava!`;
        this.renderer.addFloatingText(px, py, tag, '#fb923c');
        sound.playHit(false);
        this.emitHud(true);
      }
    }

    // POI discovery & guardian challenges in surrounding chunks
    this.checkSurroundingPOIs(px, py);

    // Incubator egg hatching progress
    if (this.state.eggs.length > 0) {
      const mult = this.state.shelterTier >= 2 ? 1.5 : 1;
      for (let i = this.state.eggs.length - 1; i >= 0; i--) {
        const egg = this.state.eggs[i];
        egg.stepsRemaining -= dist * mult;
        if (egg.stepsRemaining <= 0) {
          this.hatchEgg(i);
        }
      }
    }
  }

  private checkSurroundingPOIs(px: number, py: number): void {
    this.ensureExplorationFields();
    const cx = Math.floor(px / CHUNK_SIZE);
    const cy = Math.floor(py / CHUNK_SIZE);
    const maxChunkX = Math.floor(WORLD_W / CHUNK_SIZE);
    const maxChunkY = Math.floor(WORLD_H / CHUNK_SIZE);

    for (let scy = cy - 1; scy <= cy + 1; scy++) {
      for (let scx = cx - 1; scx <= cx + 1; scx++) {
        if (scx < 0 || scy < 0 || scx >= maxChunkX || scy >= maxChunkY) continue;
        const meta = getChunkStructureMeta(scx, scy, this.state.worldSeed);
        if (!meta) continue;

        const dist = Math.hypot(px - meta.centerX, py - meta.centerY);
        if (dist <= 10 && !this.state.discoveredPOIs!.some((p) => p.id === meta.id)) {
          this.state.discoveredPOIs!.push({
            id: meta.id,
            name: meta.name,
            kind: meta.kind,
            biome: meta.biome,
            x: meta.centerX,
            y: meta.centerY,
          });
          sound.playDiscovery(false);
          const poiSubtitleMap: Record<NonNullable<ChunkStructureMeta['kind']>, string> = {
            secret_chamber: 'Cámara Secreta',
            outpost: 'Puesto Subterráneo',
            abandoned_mine: 'Mina Antigua',
            ancient_ruins: 'Ruinas Antiguas',
            crystal_chamber: 'Cámara Cristalina',
          };
          cinematicEvents.emit({
            type: 'poi_discovered',
            title: meta.name,
            subtitle: poiSubtitleMap[meta.kind] || 'Punto de Interés',
            biome: meta.biome,
            poiKind: meta.kind,
            audioCue: 'discovery_wonder',
            skippable: true,
            priority: 'ambient',
            dedupeKey: `poi_${meta.id}`,
          });
          this.awardPlayerXp(10);
          this.notify(`¡Lugar descubierto: ${meta.name}!`);
          this.emitHud(true);
        }

        if (
          meta.hasGuardian &&
          !this.state.clearedChallenges!.includes(meta.id) &&
          dist <= 18 &&
          !this.entities.some((e) => e.challengeId === meta.id)
        ) {
          this.spawnStructureGuardian(meta);
        }
      }
    }
  }

  private spawnStructureGuardian(meta: ChunkStructureMeta): void {
    this.chunks.ensureWindowAround(meta.centerX, meta.centerY, 1);
    const candidateOffsets: Array<[number, number]> = [
      [0, 2],
      [0, 3],
      [-1, 2],
      [1, 2],
      [0, 6],
    ];
    let gx = meta.centerX;
    let gy = meta.centerY + 6;
    for (const [ox, oy] of candidateOffsets) {
      const tx = meta.centerX + ox;
      const ty = meta.centerY + oy;
      const t = this.chunks.getTile(tx, ty);
      if (!isTileSolid(t) && !isTileHazard(t) && t !== TileType.WATER) {
        gx = tx;
        gy = ty;
        break;
      }
    }

    const guardianSpeciesMap: Record<BiomeId, string> = {
      Acuaticas: 'aquabeak',
      Cristalinas: 'enigmo',
      Magma: 'piroclasto',
      Heladas: 'glaciomita',
      Sombrias: 'umbrospect',
      Verdes: 'musgacorn',
    };
    const levelMap: Record<BiomeId, number> = {
      Verdes: 5,
      Acuaticas: 5,
      Magma: 6,
      Heladas: 6,
      Cristalinas: 7,
      Sombrias: 8,
    };

    this.entities.push({
      uid: `guardian_${meta.id}`,
      kind: 'mercenary',
      challengeId: meta.id,
      speciesId: guardianSpeciesMap[meta.biome],
      name: meta.kind === 'crystal_chamber' ? 'Guardián Cristalino' : 'Guardián de Ruinas',
      icon: meta.kind === 'crystal_chamber' ? '💠' : '🛡️',
      x: gx,
      y: gy,
      homeX: gx,
      homeY: gy,
      biome: meta.biome,
      level: levelMap[meta.biome],
      hp: 80,
      dir: 0,
      cooldown: 1.0,
    });
  }

  private updateShelterAura(dt: number): void {
    if (this.state.shelterTier >= 2) {
      const distHome = Math.hypot(this.state.player.x - SPAWN_X, this.state.player.y - SPAWN_Y);
      if (distHome < 6) {
        this.state.player.hp = Math.min(this.state.player.maxHp, this.state.player.hp + 2.5 * dt);
      }
    }
  }

  private hatchEgg(index: number): void {
    const egg = this.state.eggs[index];
    this.state.eggs.splice(index, 1);
    const baby = createSlugInstance(egg.speciesId, 1, {
      isBred: true,
      bonusTrait: egg.bonusTrait,
    });
    this.state.seenSpecies[baby.id] = true;
    this.state.capturedSpecies[baby.id] = (this.state.capturedSpecies[baby.id] || 0) + 1;
    this.state.stats.eggsHatched++;
    if (this.state.party.length < 4) {
      this.state.party.push(baby);
    } else {
      this.state.storage.push(baby);
    }
    sound.playCapture();
    this.notify(`¡Huevo eclosionado! Nació ${getSlugDisplayName(baby)} (${baby.bonusTrait}).`);
    this.emitHud(true);
  }

  private resolvePrimaryInteraction(): {
    slot: HotbarSlot;
    target: { x: number; y: number };
    tile: TileType;
    contextual: ExplorationContextualAction;
    execute: () => void;
  } {
    const slot = HOTBAR_SLOTS[this.state.selectedHotbar] || HOTBAR_SLOTS[0];
    const target = this.getTargetTile();
    const tile = this.chunks.getTile(target.x, target.y);
    const px = Math.floor(this.state.player.x + 0.5);
    const py = Math.floor(this.state.player.y + 0.5);

    // 1. Check nearby NPC / Story Character / Boss / Merchant
    const nearbyEntity = this.entities.find(
      (e) => Math.hypot(e.x - this.state.player.x, e.y - this.state.player.y) < 2.0
    );
    if (nearbyEntity) {
      if (nearbyEntity.kind === 'merchant') {
        return {
          slot,
          target,
          tile,
          contextual: {
            kind: 'talk',
            label: 'Hablar',
            detail: nearbyEntity.name,
            canAct: true,
          },
          execute: () => this.tradeWithMerchant(),
        };
      }
      if (nearbyEntity.kind === 'story_npc') {
        return {
          slot,
          target,
          tile,
          contextual: {
            kind: 'talk',
            label: 'Hablar',
            detail: nearbyEntity.name,
            canAct: true,
          },
          execute: () => this.interactWithStoryNpc(nearbyEntity),
        };
      }
      return {
        slot,
        target,
        tile,
        contextual: {
          kind: 'combat',
          label: 'Enfrentar',
          detail: nearbyEntity.name,
          canAct: true,
        },
        execute: () => this.engageEntity(nearbyEntity),
      };
    }

    // 2. Hidden discovery shrine inspection in-world
    const nearbySecret = HIDDEN_DISCOVERIES.find(
      (sec) =>
        sec.worldCoords &&
        !this.state.discoveredSecrets?.includes(sec.id) &&
        (Math.hypot(target.x - sec.worldCoords.x, target.y - sec.worldCoords.y) <= 1.2 ||
          Math.hypot(px - sec.worldCoords.x, py - sec.worldCoords.y) <= 1.5)
    );
    if (nearbySecret) {
      return {
        slot,
        target,
        tile,
        contextual: {
          kind: 'discover_secret',
          label: 'Investigar',
          detail: nearbySecret.title,
          canAct: true,
        },
        execute: () => {
          this.discoverSecret(nearbySecret.id);
        },
      };
    }

    // 3. Sealed chapter gate inspection ahead
    const targetGateReason = this.getWalkingGateLockReason(target.x, target.y);
    if (targetGateReason) {
      return {
        slot,
        target,
        tile,
        contextual: {
          kind: 'inspect_gate',
          label: 'Sello',
          detail: 'Ruta sellada',
          canAct: true,
        },
        execute: () => {
          sound.playUi();
          this.notify(`Ruta sellada: ${targetGateReason}`);
        },
      };
    }

    // 4. Interactive world objects (doors, chests, secret passages, stations, altars)
    if (tile === TileType.DOOR_CLOSED) {
      return {
        slot,
        target,
        tile,
        contextual: { kind: 'open_door', label: 'Abrir', detail: 'Puerta', canAct: true },
        execute: () => {
          this.chunks.setTile(target.x, target.y, TileType.DOOR_OPEN);
          this.invalidateRoomCache();
          sound.playPlace();
          this.renderer.addFloatingText(target.x, target.y, 'Puerta abierta', '#fde047');
          this.emitHud(true);
        },
      };
    }
    if (tile === TileType.DOOR_OPEN) {
      return {
        slot,
        target,
        tile,
        contextual: { kind: 'close_door', label: 'Cerrar', detail: 'Puerta', canAct: true },
        execute: () => {
          this.chunks.setTile(target.x, target.y, TileType.DOOR_CLOSED);
          this.invalidateRoomCache();
          sound.playPlace();
          this.renderer.addFloatingText(target.x, target.y, 'Puerta cerrada', '#cbd5e1');
          this.emitHud(true);
        },
      };
    }
    if (tile === TileType.CHEST_CLOSED) {
      return {
        slot,
        target,
        tile,
        contextual: { kind: 'open_chest', label: 'Abrir', detail: 'Cofre', canAct: true },
        execute: () => this.openChest(target.x, target.y),
      };
    }
    if (tile === TileType.CRACKED_WALL) {
      return {
        slot,
        target,
        tile,
        contextual: { kind: 'break_secret', label: 'Abrir', detail: 'Pasaje Secreto', canAct: true },
        execute: () => this.openSecretPassage(target.x, target.y),
      };
    }
    if (tile === TileType.RECHARGE_STATION) {
      return {
        slot,
        target,
        tile,
        contextual: { kind: 'recharge', label: 'Recargar', detail: 'Estación', canAct: true },
        execute: () => this.rechargeTeam(),
      };
    }
    if (tile === TileType.ALTAR) {
      return {
        slot,
        target,
        tile,
        contextual: {
          kind: 'altar',
          label: 'Vincular',
          detail: 'Altar Antiguo',
          canAct: true,
        },
        execute: () => this.interactWithAltar(target.x, target.y),
      };
    }

    // 5. Home furniture & living home slug companions
    if (this.state.home?.furniture.some((f) => f.x === target.x && f.y === target.y)) {
      return {
        slot,
        target,
        tile,
        contextual: { kind: 'pickup_furniture', label: 'Recoger', detail: 'Mueble', canAct: true },
        execute: () => {
          this.pickupFurnitureAt(target.x, target.y);
        },
      };
    }

    const nearHome = findNearbyHomeSlug(this.state, 2.1);
    if (nearHome) {
      return {
        slot,
        target,
        tile,
        contextual: {
          kind: 'interact_slug',
          label: 'Acariciar',
          detail: getSlugDisplayName(nearHome.slug),
          canAct: true,
        },
        execute: () => {
          this.petHomeSlug(nearHome.slug.uid);
        },
      };
    }

    // 6. Selected field utility action
    if (slot.id === 'berry') {
      return {
        slot,
        target,
        tile,
        contextual: {
          kind: 'berry',
          label: 'Curar',
          detail: `Baya (${this.state.inventory.berries})`,
          canAct: this.state.inventory.berries > 0,
        },
        execute: () => this.useQuickBerry(),
      };
    }

    if (slot.id === 'station') {
      const qty = this.state.inventory.stations;
      const validSurface = !isTileSolid(tile) && tile !== TileType.TORCH && tile !== TileType.LAVA;
      return {
        slot,
        target,
        tile,
        contextual: {
          kind: 'place_station',
          label: 'Instalar',
          detail: `Estación (${qty})`,
          canAct: qty > 0 && validSurface,
        },
        execute: () => this.deployFieldStation(target.x, target.y, tile),
      };
    }

    return {
      slot,
      target,
      tile,
      contextual: {
        kind: 'pulse',
        label: 'Pulso',
        detail: this.pulseCooldown > 0 ? `${Math.ceil(this.pulseCooldown)}s` : 'Escáner',
        canAct: this.pulseCooldown <= 0,
      },
      execute: () => this.triggerExplorationPulse(),
    };
  }

  public getContextualExplorationAction(): ExplorationContextualAction {
    return this.resolvePrimaryInteraction().contextual;
  }

  public performPrimaryAction(): void {
    this.resolvePrimaryInteraction().execute();
  }

  private openSecretPassage(tx: number, ty: number): void {
    const active = this.state.party[this.state.activePartyIndex] || this.state.party[0];
    const burstCol = active ? ELEMENT_CHART[active.type]?.color || '#67e8f9' : '#67e8f9';
    const slugLabel = active ? getSlugDisplayName(active) : 'Bláster';
    this.chunks.setTile(tx, ty, TileType.FLOOR);
    this.invalidateRoomCache();
    sound.playPickup();
    this.renderer.triggerShake(2.2, 0.12);
    this.renderer.spawnBurst(tx, ty, burstCol, 18);
    this.renderer.addFloatingText(tx, ty, '¡Pasaje secreto abierto!', burstCol);
    this.awardPlayerXp(8);
    this.notify(`¡Disparo de ${slugLabel} abrió el pasaje secreto!`);
    this.emitHud(true);
  }

  private deployFieldStation(tx: number, ty: number, currentTile: TileType): void {
    if (this.state.inventory.stations <= 0) {
      this.notify('No tienes Estaciones de Campo. Canjea una en el Mercado de Fichas.');
      return;
    }
    if (isTileSolid(currentTile) || currentTile === TileType.TORCH || currentTile === TileType.LAVA) {
      this.notify('Busca suelo despejado para desplegar la estación de recarga.');
      return;
    }
    this.state.inventory.stations--;
    this.chunks.setTile(tx, ty, TileType.RECHARGE_STATION);
    this.state.stats.structuresBuilt++;
    this.invalidateRoomCache();
    sound.playPulse();
    this.renderer.spawnBurst(tx, ty, '#38bdf8', 14);
    this.renderer.addFloatingText(tx, ty, 'Estación desplegada', '#67e8f9');
    this.notify('Estación de recarga portátil desplegada.');
    this.emitHud(true);
  }

  private interactWithStoryNpc(ent: RoamingEntity): void {
    const story = ensureStoryState(this.state);
    const charId = ent.characterId;
    if (charId === 'pronto') {
      if (!this.openDialogue('dlg_cap1_pronto_bienvenida')) {
        this.notify('Pronto: "Explora las Cuevas Verdes y habla conmigo en Campaña."');
      }
      return;
    }
    if (charId === 'trixie') {
      const targetDlg = ent.dialogueId || (ent.scenarioId === 'esc_gruta_acuatica' ? 'dlg_gruta_acuatica' : 'dlg_cap2_banda_meca');
      if (!this.openDialogue(targetDlg)) {
        this.notify('Trixie: "Mantén actualizada tu Babosapedia al capturar especies nuevas."');
      }
      return;
    }
    if (charId === 'will_shane') {
      if (!this.openDialogue('dlg_eco_will_shane')) {
        this.notify('Eco de Will Shane: "Cuando alcancen 200 MPH juntos, el poder Megamorph responderá."');
      }
      return;
    }
    if (charId === 'kord') {
      const cap7Ready =
        story.chapterStates['cap_07_acelerador_megamorph'] === 'active' ||
        story.chapterStates['cap_07_acelerador_megamorph'] === 'completed';
      const dlgId = cap7Ready ? 'dlg_cap7_acelerador_200mph' : 'dlg_cap2_banda_meca';
      if (!this.openDialogue(dlgId)) {
        this.notify('Kord: "Cuando tu Meca esté listo, calibraremos nuevos circuitos."');
      }
      return;
    }
    if (charId === 'red_hook') {
      if (!this.state.completedDialogues?.includes('dlg_cap3_rastro_blakk') && this.openDialogue('dlg_cap3_rastro_blakk')) {
        return;
      }
      if (!this.startRivalDuel('rival_red_hook')) {
        this.notify('Garfio Rojo: "Vuelve cuando el Capítulo 3 esté activo para un duelo de verdad."');
      }
      return;
    }
    if (charId === 'twist') {
      if (!this.startRivalDuel('rival_twist')) {
        this.notify('Twist: "Aún es pronto para medir velocidades en estas cavernas."');
      }
      return;
    }
    this.notify(`${ent.name}: "¡Nos vemos en las cavernas!"`);
  }

  private openChest(tx: number, ty: number): void {
    this.chunks.setTile(tx, ty, TileType.CHEST_OPEN);
    this.state.stats.chestsOpened++;
    const b = getBiomeAt(tx, ty, this.state.worldSeed);
    const tokens =
      b === 'Sombrias' || b === 'Cristalinas'
        ? 4
        : b === 'Magma' || b === 'Heladas' || b === 'Acuaticas'
        ? 3
        : 2;
    const berries = 1 + Math.floor(Math.random() * 2);
    const cap = Math.random() < 0.75 ? 1 : 0;
    this.state.cavernTokens = (this.state.cavernTokens ?? 0) + tokens;
    this.state.inventory.berries += berries;
    this.state.inventory.capsules += cap;
    if (Math.random() < 0.35) this.state.inventory.relics += 1;

    let biomeNote = '';
    if (b === 'Verdes') {
      this.state.inventory.berries += 1;
      biomeNote = ' · +1 Baya silvestre';
    } else if (b === 'Acuaticas') {
      this.state.inventory.frostNectar += 1;
      biomeNote = ' · +1 Néctar Glacial';
    } else if (b === 'Magma') {
      this.state.inventory.emberSnack += 1;
      biomeNote = ' · +1 Bocado Ígneo';
    } else if (b === 'Heladas') {
      this.state.inventory.frostNectar += 1;
      biomeNote = ' · +1 Néctar Glacial';
    } else if (b === 'Cristalinas') {
      this.state.inventory.crystal += 2;
      biomeNote = ' · +2 Cristales resonantes';
    } else if (b === 'Sombrias') {
      this.state.inventory.elixirs += 1;
      this.state.inventory.evoStone += 1;
      biomeNote = ' · +1 Elixir · +1 Piedra Evolutiva';
    }
    if (b !== 'Sombrias' && Math.random() < 0.25) {
      this.state.inventory.evoStone += 1;
      biomeNote += ' · +1 Piedra Evolutiva';
    }

    sound.playPickup();
    this.renderer.spawnBurst(tx, ty, '#facc15', 18);
    this.renderer.addFloatingText(tx, ty, `+${tokens} Fichas`, '#fde047');
    this.awardPlayerXp(14);
    this.notify(`¡Cofre abierto! +${tokens} Fichas, +${berries} bayas${cap > 0 ? ', +1 Cilindro' : ''}${biomeNote}.`);
    this.emitHud(true);
  }

  private rechargeTeam(): void {
    this.state.player.hp = this.state.player.maxHp;
    this.state.player.stamina = this.state.player.maxStamina;
    this.state.party.forEach((s) => {
      s.hp = s.maxHp;
      s.energy = s.maxEnergy;
    });
    sound.playHeal();
    this.renderer.spawnBurst(
      Math.floor(this.state.player.x + 0.5),
      Math.floor(this.state.player.y + 0.5),
      '#38bdf8',
      18
    );
    this.notify('¡Estación de recarga! Equipo y explorador al 100%.');
    this.emitHud(true);
  }

  private interactWithAltar(tx: number, ty: number): void {
    const active = this.state.party[this.state.activePartyIndex];
    if (!active) return;
    const story = ensureStoryState(this.state);
    const altarFlag = `altar_${tx}_${ty}`;
    if (story.storyFlags[altarFlag]) {
      sound.playUi();
      this.notify('El altar antiguo ya resonó con tu equipo.');
      return;
    }
    story.storyFlags[altarFlag] = true;
    const msgs = awardSlugExperience(this.state, active, 25, { bondDelta: 10 });
    const burstCol = ELEMENT_CHART[active.type]?.color || '#2dd4bf';
    sound.playPulse();
    this.renderer.spawnBurst(tx, ty, burstCol, 16);
    this.notify(msgs[0] || `${getSlugDisplayName(active)} sintoniza con el altar antiguo (+25 EXP, +10 Amistad).`);
    this.emitHud(true);
  }

  private useQuickBerry(): void {
    if (this.state.inventory.berries <= 0) {
      this.notify('No tienes bayas disponibles.');
      return;
    }
    this.state.inventory.berries--;
    this.state.player.hp = Math.min(this.state.player.maxHp, this.state.player.hp + 25);
    const active = this.state.party[this.state.activePartyIndex];
    let extra = '';
    if (active) {
      active.hp = Math.min(active.maxHp, active.hp + 25);
      const bondRes = grantSlugBond(active, 4);
      if (bondRes.tieredUp) {
        extra = ` ¡${getSlugDisplayName(active)} alcanza ${bondRes.newTier.label}!`;
      }
    }
    sound.playHeal();
    this.notify(`Baya consumida (+25 PS explorador y babosa activa).${extra}`);
    this.emitHud(true);
  }

  public triggerExplorationPulse(): void {
    if (this.pulseCooldown > 0) {
      this.notify(`Pulso recargándose (${Math.ceil(this.pulseCooldown)}s).`);
      return;
    }
    this.pulseCooldown = this.pulseMaxCooldown;
    const px = Math.floor(this.state.player.x + 0.5);
    const py = Math.floor(this.state.player.y + 0.5);
    sound.playPulse();
    this.renderer.triggerPulseRing(px, py);
    this.awardPlayerXp(4);

    // Scan radius 9 for chests, secret walls, or hidden discovery shrines
    let foundMsg = '';
    for (let dy = -9; dy <= 9; dy++) {
      for (let dx = -9; dx <= 9; dx++) {
        const t = this.chunks.getTile(px + dx, py + dy);
        if (t === TileType.CHEST_CLOSED) {
          this.renderer.addFloatingText(px + dx, py + dy, '◆ Cofre', '#fde047');
          foundMsg = '¡Escáner detectó un cofre cercano!';
        } else if (t === TileType.CRACKED_WALL) {
          this.renderer.addFloatingText(px + dx, py + dy, '✦ Pasaje Secreto', '#67e8f9');
          foundMsg = '¡Pasaje agrietado secreto detectado!';
        }
      }
    }

    for (const sec of HIDDEN_DISCOVERIES) {
      if (!sec.worldCoords || this.state.discoveredSecrets?.includes(sec.id)) continue;
      if (Math.hypot(sec.worldCoords.x - px, sec.worldCoords.y - py) <= 10) {
        this.renderer.addFloatingText(sec.worldCoords.x, sec.worldCoords.y, '✦ Vestigio', '#a5f3fc');
        this.renderer.spawnBurst(sec.worldCoords.x, sec.worldCoords.y, '#5eead4', 10);
        foundMsg = '¡Escáner detectó un vestigio oculto cercano!';
      }
    }

    this.notify(foundMsg || 'Pulso de exploración emitido (+4 EXP).');
    this.emitHud(true);
  }

  private awardPlayerXp(amount: number): void {
    this.state.player.xp += amount;
    while (this.state.player.xp >= this.state.player.level * 45) {
      this.state.player.xp -= this.state.player.level * 45;
      this.state.player.level++;
      this.state.player.maxHp += 10;
      this.state.player.hp = this.state.player.maxHp;
      this.state.player.maxStamina += 10;
      this.state.player.stamina = this.state.player.maxStamina;
      sound.playVictory();
      this.notify(`¡Explorador sube al Nivel ${this.state.player.level}!`);
    }
  }

  private tradeWithMerchant(): void {
    const tokens = this.state.cavernTokens ?? 0;
    this.notify(
      `Mercader Subterráneo: "Tienes ${tokens} Fichas de Caverna. Abre el Mercado de Fichas en Campaña (I) para canjear suministros y mejoras."`
    );
    sound.playUi();
    this.emitHud(true);
  }

  public buyMerchantOffer(offerId: string): boolean {
    this.ensureExplorationFields();
    const offer = MERCHANT_EXCHANGE_OFFERS.find((o) => o.id === offerId);
    if (!offer) return false;
    if (offer.requiredChapterOrder) {
      const story = ensureStoryState(this.state);
      const curCh = STORY_CHAPTERS_BY_ID[story.currentChapterId];
      const maxUnlockedOrder = Object.entries(story.chapterStates).reduce((maxO, [cid, st]) => {
        if (st === 'active' || st === 'completed') {
          const ch = STORY_CHAPTERS_BY_ID[cid];
          return ch ? Math.max(maxO, ch.order) : maxO;
        }
        return maxO;
      }, curCh?.order || 1);
      if (maxUnlockedOrder < offer.requiredChapterOrder) {
        this.notify(`Disponible a partir del Capítulo ${offer.requiredChapterOrder}.`);
        return false;
      }
    }
    const tokens = this.state.cavernTokens ?? 0;
    if (tokens < offer.costTokens) {
      this.notify(`Necesitas ${offer.costTokens} Fichas de Caverna.`);
      return false;
    }
    if (offer.costRelics && this.state.inventory.relics < offer.costRelics) {
      this.notify(`Necesitas ${offer.costRelics} Reliquia(s) Antigua(s).`);
      return false;
    }
    this.state.cavernTokens = tokens - offer.costTokens;
    if (offer.costRelics) {
      this.state.inventory.relics -= offer.costRelics;
    }
    this.state.inventory[offer.outputKey] =
      (this.state.inventory[offer.outputKey] || 0) + offer.outputQty;
    sound.playPickup();
    this.notify(`Canjeado: ${offer.name}`);
    this.emitHud(true);
    return true;
  }

  private seedInitialEntities(): void {
    this.entities = [];
    this.worldProjectiles = [];
    // Friendly subterranean merchants
    this.entities.push({
      uid: 'merchant_home',
      kind: 'merchant',
      name: 'Mercader',
      icon: '🧳',
      x: SPAWN_X + 7,
      y: SPAWN_Y - 3,
      homeX: SPAWN_X + 7,
      homeY: SPAWN_Y - 3,
      biome: 'Verdes',
      level: 1,
      hp: 99,
      dir: 0,
      cooldown: 0,
    });
    this.entities.push({
      uid: 'merchant_valle',
      kind: 'merchant',
      name: 'Mercader del Valle',
      icon: '🧳',
      x: 185,
      y: 163,
      homeX: 185,
      homeY: 163,
      biome: 'Verdes',
      level: 1,
      hp: 99,
      dir: 0,
      cooldown: 0,
    });

    // Story NPCs positioned at handcrafted scenarios
    const story = ensureStoryState(this.state);
    this.entities.push(
      {
        uid: 'npc_pronto',
        kind: 'story_npc',
        characterId: 'pronto',
        scenarioId: 'esc_caverna_descenso',
        dialogueId: 'dlg_cap1_pronto_bienvenida',
        name: 'Pronto',
        icon: '🧭',
        x: 158,
        y: 138,
        homeX: 158,
        homeY: 138,
        biome: 'Verdes',
        level: 3,
        hp: 100,
        dir: 0,
        cooldown: 0,
      },
      {
        uid: 'npc_trixie',
        kind: 'story_npc',
        characterId: 'trixie',
        scenarioId: 'esc_pueblo_valle_verde',
        dialogueId: 'dlg_cap2_banda_meca',
        name: 'Trixie Sting',
        icon: '📷',
        x: 182,
        y: 158,
        homeX: 182,
        homeY: 158,
        biome: 'Verdes',
        level: 4,
        hp: 100,
        dir: 0,
        cooldown: 0,
      },
      {
        uid: 'npc_kord',
        kind: 'story_npc',
        characterId: 'kord',
        scenarioId:
          story.currentScenarioId === 'esc_taller_acelerador'
            ? 'esc_taller_acelerador'
            : 'esc_pueblo_valle_verde',
        dialogueId:
          story.chapterStates['cap_07_acelerador_megamorph'] === 'active' ||
          story.chapterStates['cap_07_acelerador_megamorph'] === 'completed'
            ? 'dlg_cap7_acelerador_200mph'
            : 'dlg_cap2_banda_meca',
        name: 'Kord Zane',
        icon: '🔧',
        x: story.currentScenarioId === 'esc_taller_acelerador' ? 196 : 188,
        y: story.currentScenarioId === 'esc_taller_acelerador' ? 246 : 158,
        homeX: story.currentScenarioId === 'esc_taller_acelerador' ? 196 : 188,
        homeY: story.currentScenarioId === 'esc_taller_acelerador' ? 246 : 158,
        biome: story.currentScenarioId === 'esc_taller_acelerador' ? 'Magma' : 'Verdes',
        level: 5,
        hp: 120,
        dir: 0,
        cooldown: 0,
      },
      {
        uid: 'npc_trixie_acuatica',
        kind: 'story_npc',
        characterId: 'trixie',
        scenarioId: 'esc_gruta_acuatica',
        dialogueId: 'dlg_gruta_acuatica',
        name: 'Trixie Sting',
        icon: '📷',
        x: 249,
        y: 230,
        homeX: 249,
        homeY: 230,
        biome: 'Acuaticas',
        level: 4,
        hp: 100,
        dir: 0,
        cooldown: 0,
      },
      {
        uid: 'npc_red_hook',
        kind: 'story_npc',
        characterId: 'red_hook',
        scenarioId: 'esc_puesto_agua_oscura',
        dialogueId: 'dlg_cap3_rastro_blakk',
        name: 'Garfio Rojo',
        icon: '🪝',
        x: 196,
        y: 134,
        homeX: 196,
        homeY: 134,
        biome: 'Verdes',
        level: 6,
        hp: 120,
        dir: 0,
        cooldown: 0,
      },
      {
        uid: 'npc_twist',
        kind: 'story_npc',
        characterId: 'twist',
        scenarioId: 'esc_caverna_helada',
        name: 'Twist',
        icon: '⚡',
        x: 46,
        y: 160,
        homeX: 46,
        homeY: 160,
        biome: 'Heladas',
        level: 7,
        hp: 120,
        dir: 0,
        cooldown: 0,
      },
      {
        uid: 'npc_will_shane',
        kind: 'story_npc',
        characterId: 'will_shane',
        scenarioId: 'esc_templo_cristalino',
        dialogueId: 'dlg_eco_will_shane',
        name: 'Eco de Will Shane',
        icon: '💎',
        x: 78,
        y: 63,
        homeX: 78,
        homeY: 63,
        biome: 'Cristalinas',
        level: 8,
        hp: 120,
        dir: 0,
        cooldown: 0,
      }
    );

    // Bosses at fixed biome shrines
    for (const b of BOSS_DEFINITIONS) {
      if (this.state.defeatedBosses.includes(b.id)) continue;
      this.entities.push({
        uid: b.id,
        kind: 'boss',
        bossId: b.id,
        speciesId: b.speciesId,
        name: b.name,
        icon: b.icon,
        x: b.x,
        y: b.y,
        homeX: b.x,
        homeY: b.y,
        biome: b.biome,
        level: b.level,
        hp: 100,
        dir: 0,
        cooldown: 0,
      });
    }

    this.replenishWildEntities();
    this.checkSurroundingPOIs(
      Math.floor(this.state.player.x + 0.5),
      Math.floor(this.state.player.y + 0.5)
    );
  }

  private replenishWildEntities(): void {
    const px = Math.floor(this.state.player.x + 0.5);
    const py = Math.floor(this.state.player.y + 0.5);
    let wildCount = this.entities.filter((e) => e.kind === 'wild' || e.kind === 'mercenary').length;
    if (wildCount >= 14) return;

    for (let tries = 0; tries < 20 && wildCount < 14 && this.entities.length < 28; tries++) {
      const ang = Math.random() * Math.PI * 2;
      const rad = 11 + Math.random() * 20;
      const wx = Math.floor(px + Math.cos(ang) * rad);
      const wy = Math.floor(py + Math.sin(ang) * rad);
      if (wx < 5 || wy < 5 || wx >= WORLD_W - 5 || wy >= WORLD_H - 5) continue;
      if (Math.hypot(wx - SPAWN_X, wy - SPAWN_Y) < 9) continue;
      if (Math.hypot(wx - 185, wy - 160) < 9) continue;
      const t = this.chunks.getTile(wx, wy);
      if (isTileSolid(t) || isTileHazard(t) || t === TileType.WATER) continue;

      const b = getBiomeAt(wx, wy, this.state.worldSeed);
      const sp = pickWeightedSpeciesByBiome(b);
      const isMerc = Math.random() < 0.16;
      const baseLvl =
        b === 'Verdes'
          ? 1
          : b === 'Acuaticas'
          ? 2
          : b === 'Magma' || b === 'Heladas'
          ? 3
          : b === 'Cristalinas'
          ? 4
          : 5;
      const lvl = Math.max(1, baseLvl + Math.floor(Math.random() * 3));

      this.entities.push({
        uid: `mob_${Math.random().toString(36).slice(2, 8)}`,
        kind: isMerc ? 'mercenary' : 'wild',
        speciesId: sp.id,
        name: isMerc ? 'Mercenario' : sp.name,
        icon: isMerc ? '🦹' : sp.icon,
        x: wx,
        y: wy,
        homeX: wx,
        homeY: wy,
        biome: b,
        level: lvl,
        hp: 50,
        dir: Math.random() * Math.PI * 2,
        cooldown: 1.5,
      });
      wildCount++;
    }
  }

  private updateWorldProjectiles(dt: number): void {
    const px = this.state.player.x;
    const py = this.state.player.y;

    for (const wp of this.worldProjectiles) {
      if (!wp.alive) continue;

      if (wp.phase === 'transformed' && wp.homing > 0 && wp.owner === 'ally') {
        let bestTarget: RoamingEntity | null = null;
        let bestD = 7;
        for (const ent of this.entities) {
          if (ent.kind !== 'wild' && ent.kind !== 'mercenary' && ent.kind !== 'boss') continue;
          const d = Math.hypot(ent.x - wp.x, ent.y - wp.y);
          if (d < bestD) {
            bestD = d;
            bestTarget = ent;
          }
        }
        if (bestTarget) {
          const curA = Math.atan2(wp.vy, wp.vx);
          const desA = Math.atan2(bestTarget.y - wp.y, bestTarget.x - wp.x);
          let diff = desA - curA;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const maxTurn = wp.homing * dt;
          const nextA = curA + Math.max(-maxTurn, Math.min(maxTurn, diff));
          const spd = Math.hypot(wp.vx, wp.vy);
          wp.vx = Math.cos(nextA) * spd;
          wp.vy = Math.sin(nextA) * spd;
        }
      }

      const nx = wp.x + wp.vx * dt;
      const ny = wp.y + wp.vy * dt;
      const stepDist = Math.hypot(nx - wp.x, ny - wp.y);
      wp.traveledTiles += stepDist;
      wp.rangeTilesLeft -= stepDist;

      if (wp.phase === 'protoform' && wp.traveledTiles >= wp.transformDistTiles) {
        wp.phase = 'transformed';
        sound.playSlugTransform(wp.element);
      }

      const tx = Math.floor(nx + 0.5);
      const ty = Math.floor(ny + 0.5);
      const tile = this.chunks.getTile(tx, ty);
      if (wp.owner === 'ally' && tile === TileType.CRACKED_WALL) {
        this.openSecretPassage(tx, ty);
        wp.alive = false;
        continue;
      }
      if (isTileSolid(tile)) {
        if (wp.bouncesLeft > 0) {
          wp.bouncesLeft--;
          const hitX = isTileSolid(this.chunks.getTile(Math.floor(nx + 0.5), Math.floor(wp.y + 0.5)));
          const hitY = isTileSolid(this.chunks.getTile(Math.floor(wp.x + 0.5), Math.floor(ny + 0.5)));
          if (hitX) wp.vx = -wp.vx;
          if (hitY || (!hitX && !hitY)) wp.vy = -wp.vy;
        } else {
          wp.alive = false;
          this.renderer.spawnBurst(tx, ty, ELEMENT_CHART[wp.element]?.color || '#38bdf8', 6);
          continue;
        }
      } else {
        wp.x = nx;
        wp.y = ny;
      }

      wp.trail.push({ x: wp.x, y: wp.y });
      if (wp.trail.length > 7) wp.trail.shift();

      if (wp.rangeTilesLeft <= 0) {
        wp.alive = false;
        continue;
      }

      if (wp.owner === 'ally') {
        for (let i = this.entities.length - 1; i >= 0; i--) {
          const ent = this.entities[i];
          if (ent.kind !== 'wild' && ent.kind !== 'mercenary' && ent.kind !== 'boss') continue;
          const dist = Math.hypot(ent.x - wp.x, ent.y - wp.y);
          if (dist <= wp.radiusTiles + (ent.kind === 'boss' ? 0.85 : 0.6)) {
            const targetSp = ent.speciesId ? getSpecies(ent.speciesId) : null;
            const elMult = targetSp ? getElementMultiplier(wp.element, targetSp.type) : 1;
            const dmg = Math.max(4, Math.round(wp.damage * elMult * (wp.phase === 'transformed' ? 1.2 : 0.88)));
            if (typeof ent.maxHp !== 'number') ent.maxHp = ent.hp;
            ent.hp = Math.max(0, ent.hp - dmg);
            ent.hitFlash = 0.18;
            ent.behaviorState = 'alert';

            const col = elMult > 1.2 ? '#fde047' : ELEMENT_CHART[wp.element]?.color || '#38bdf8';
            sound.playHit(elMult > 1.2 || wp.mode !== 'quick');
            this.renderer.spawnBurst(Math.round(ent.x), Math.round(ent.y), col, 10);
            this.renderer.addFloatingText(Math.round(ent.x), Math.round(ent.y), `-${dmg}`, col);

            if (wp.moveEffect === 'drain') {
              const healAmt = Math.max(4, Math.round(dmg * 0.35));
              this.state.player.hp = Math.min(this.state.player.maxHp, this.state.player.hp + healAmt);
            }

            if (ent.kind === 'boss' && ent.hp <= ent.maxHp * 0.72) {
              wp.alive = false;
              this.engageEntity(ent);
              break;
            }

            if (ent.hp <= 0) {
              this.handleWorldEntityDefeated(ent);
            }

            if (wp.pierceLeft > 0) {
              wp.pierceLeft--;
            } else {
              wp.alive = false;
              break;
            }
          }
        }
      } else {
        const distPlayer = Math.hypot(px - wp.x, py - wp.y);
        if (distPlayer <= wp.radiusTiles + 0.45) {
          wp.alive = false;
          if (this.playerInvulnTimer > 0) {
            this.renderer.addFloatingText(Math.round(px), Math.round(py), 'Esquivado', '#5eead4');
          } else {
            this.state.player.hp = Math.max(1, this.state.player.hp - wp.damage);
            this.renderer.triggerShake(3.2, 0.14);
            this.renderer.addFloatingText(Math.round(px), Math.round(py), `-${wp.damage}`, '#f87171');
            sound.playHit(false);
            this.emitHud(true);
          }
        }
      }
    }

    this.worldProjectiles = this.worldProjectiles.filter((p) => p.alive);
  }

  private handleWorldEntityDefeated(ent: RoamingEntity): void {
    this.entities = this.entities.filter((x) => x.uid !== ent.uid);
    this.state.stats.wins++;
    const tokens = ent.kind === 'mercenary' ? 2 : 1;
    this.state.cavernTokens = (this.state.cavernTokens ?? 0) + tokens;
    const ally = this.state.party[this.state.activePartyIndex];
    if (ally) {
      awardSlugExperience(this.state, ally, ent.kind === 'mercenary' ? 24 : 14, { bondDelta: 3 });
    }
    this.awardPlayerXp(12);
    if (ent.challengeId) {
      this.ensureExplorationFields();
      if (!this.state.clearedChallenges!.includes(ent.challengeId)) {
        this.state.clearedChallenges!.push(ent.challengeId);
        this.state.inventory.capsules += 1;
      }
    }
    sound.playVictory();
    this.renderer.spawnBurst(Math.round(ent.x), Math.round(ent.y), '#fde047', 16);
    this.notify(`¡${ent.name} derrotado en caverna! +${tokens} Ficha(s)`);
    this.syncStoryProgress();
    this.emitHud(true);
  }

  private updateEntities(dt: number): void {
    const px = this.state.player.x;
    const py = this.state.player.y;

    for (let i = this.entities.length - 1; i >= 0; i--) {
      const ent = this.entities[i];
      if (ent.cooldown > 0) ent.cooldown -= dt;
      if ((ent.hitFlash ?? 0) > 0) ent.hitFlash = Math.max(0, (ent.hitFlash ?? 0) - dt);
      if ((ent.attackCooldown ?? 0) > 0) ent.attackCooldown = Math.max(0, (ent.attackCooldown ?? 0) - dt);
      if (typeof ent.maxHp !== 'number') ent.maxHp = ent.hp;

      const dist = Math.hypot(px - ent.x, py - ent.y);

      // Despawn distant wild/merc mobs to keep simulation lightweight
      if ((ent.kind === 'wild' || ent.kind === 'mercenary') && dist > 42) {
        this.entities.splice(i, 1);
        continue;
      }

      if (ent.kind === 'merchant' || ent.kind === 'story_npc') continue;

      const detectR = ent.detectRadius ?? (ent.kind === 'boss' ? 11 : ent.kind === 'mercenary' ? 9.5 : 6.5);

      if (ent.behaviorState === 'windup') {
        ent.telegraphTimer = Math.max(0, (ent.telegraphTimer ?? 0) - dt);
        if ((ent.telegraphTimer ?? 0) <= 0) {
          ent.behaviorState = 'recover';
          ent.attackCooldown = ent.kind === 'boss' ? 1.8 : 2.35;
          const ang = Math.atan2(py - ent.y, px - ent.x);
          const sp = ent.speciesId ? getSpecies(ent.speciesId) : null;
          this.worldProjectiles.push({
            id: this.worldProjSeq++,
            owner: 'enemy',
            speciesId: ent.speciesId || 'infurnus',
            element: sp?.type || 'Sombra',
            mode: 'quick',
            x: ent.x + Math.cos(ang) * 0.6,
            y: ent.y + Math.sin(ang) * 0.6,
            vx: Math.cos(ang) * (ent.kind === 'boss' ? 9.2 : 7.6),
            vy: Math.sin(ang) * (ent.kind === 'boss' ? 9.2 : 7.6),
            radiusTiles: 0.3,
            damage: ent.kind === 'boss' ? 11 : ent.kind === 'mercenary' ? 8 : 5,
            rangeTilesLeft: 10,
            traveledTiles: 0,
            transformDistTiles: 2.2,
            phase: 'protoform',
            bouncesLeft: 0,
            homing: 0,
            pierceLeft: 0,
            trail: [],
            alive: true,
          });
          sound.playBlasterFire(ent.kind === 'boss', false);
        }
      } else if (dist < detectR && ent.cooldown <= 0) {
        if ((ent.attackCooldown ?? 0) <= 0 && dist > 2.2 && dist < 8.8 && (ent.kind === 'mercenary' || ent.kind === 'boss')) {
          ent.behaviorState = 'windup';
          ent.telegraphTimer = 0.65;
        } else if (ent.kind === 'mercenary' && dist > 1.0) {
          ent.behaviorState = 'chase';
          const ang = Math.atan2(py - ent.y, px - ent.x);
          const nx = ent.x + Math.cos(ang) * 2.2 * dt;
          const ny = ent.y + Math.sin(ang) * 2.2 * dt;
          if (!isTileSolid(this.chunks.getTile(Math.floor(nx + 0.5), Math.floor(ny + 0.5)))) {
            ent.x = nx;
            ent.y = ny;
          }
        } else if (ent.kind === 'wild') {
          ent.behaviorState = 'patrol';
          ent.dir += (Math.random() - 0.5) * 2.2 * dt;
          const nx = ent.x + Math.cos(ent.dir) * 1.1 * dt;
          const ny = ent.y + Math.sin(ent.dir) * 1.1 * dt;
          if (!isTileSolid(this.chunks.getTile(Math.floor(nx + 0.5), Math.floor(ny + 0.5))) && Math.hypot(nx - ent.homeX, ny - ent.homeY) < 6) {
            ent.x = nx;
            ent.y = ny;
          } else {
            ent.dir += Math.PI * 0.7;
          }
        }
      } else if (ent.kind === 'wild') {
        ent.behaviorState = 'patrol';
        ent.dir += (Math.random() - 0.5) * 2.2 * dt;
        const nx = ent.x + Math.cos(ent.dir) * 1.1 * dt;
        const ny = ent.y + Math.sin(ent.dir) * 1.1 * dt;
        if (!isTileSolid(this.chunks.getTile(Math.floor(nx + 0.5), Math.floor(ny + 0.5))) && Math.hypot(nx - ent.homeX, ny - ent.homeY) < 6) {
          ent.x = nx;
          ent.y = ny;
        } else {
          ent.dir += Math.PI * 0.7;
        }
      }

      // Trigger full slug duel encounter on close contact (unless mid-dodge invuln)
      if (dist < 0.92 && ent.cooldown <= 0 && this.playerInvulnTimer <= 0) {
        this.engageEntity(ent);
        return;
      }
    }

    if (Math.random() < 0.04) {
      this.replenishWildEntities();
    }
  }

  public engageEntity(ent: RoamingEntity): void {
    if (this.combat.battle) return;
    this.keysHeld.clear();
    ent.cooldown = 6;
    const spId = ent.speciesId || 'infurnus';
    const enemySpecies = getSpecies(spId);
    const ally = this.state.party[this.state.activePartyIndex] || this.state.party[0];

    const currentBiome = getBiomeAt(
      Math.round(this.state.player.x),
      Math.round(this.state.player.y),
      this.state.worldSeed
    );

    const rivalLore =
      ent.kind === 'boss'
        ? `¡El guardián supremo de ${BIOME_INFO[currentBiome].name} desata su poder ${enemySpecies.type}!`
        : ent.kind === 'mercenary'
        ? ent.challengeId
          ? '¡Protege el santuario antiguo con su bláster cargado!'
          : '«Mis babosas sombrías no dejan paso a ningún explorador.»'
        : enemySpecies.lore;

    cinematicEvents.emit({
      type: ent.kind === 'boss' || ent.kind === 'mercenary' ? 'encounter_intro' : 'combat_intro',
      title: ent.name,
      subtitle:
        ent.kind === 'boss'
          ? `Jefe de Bioma · Nv.${ent.level}`
          : ent.kind === 'mercenary'
          ? `Duelo Especial · Nv.${ent.level}`
          : `${enemySpecies.name} Salvaje · Nv.${ent.level}`,
      biome: currentBiome,
      speciesId: spId,
      slugName: enemySpecies.name,
      slugElement: enemySpecies.type,
      slugRarity: enemySpecies.rarity,
      enemyKind: ent.kind === 'boss' ? 'boss' : ent.kind === 'mercenary' ? 'mercenary' : 'wild',
      enemyLevel: ent.level,
      allySpeciesId: ally?.id,
      allyName: ally ? getSlugDisplayName(ally) : undefined,
      allyMega: ally?.mega,
      loreLine: rivalLore,
      audioCue: ent.kind === 'boss' ? 'boss_ominous' : 'duel_tension',
      skippable: true,
      priority: ent.kind === 'boss' ? 'dramatic' : 'highlight',
      dedupeKey: `battle_${ent.uid}`,
    });

    let captureCinematicEmitted = false;
    this.combat.startBattle(this.state, {
      kind: ent.kind === 'boss' ? 'boss' : ent.kind === 'mercenary' ? 'mercenary' : 'wild',
      speciesId: spId,
      level: ent.level,
      biome: currentBiome,
      nameOverride: ent.kind === 'boss' ? ent.name : undefined,
      bossId: ent.bossId,
      iconOverride: ent.kind === 'boss' ? ent.icon : undefined,
      onCapture: (cap) => {
        if (captureCinematicEmitted) return;
        captureCinematicEmitted = true;
        const capSpecies = getSpecies(cap.speciesId);
        cinematicEvents.emit({
          type: 'slug_captured',
          title: cap.slugName,
          subtitle: capSpecies.name,
          biome: currentBiome,
          speciesId: cap.speciesId,
          slugName: cap.slugName,
          slugElement: cap.element,
          slugRarity: cap.rarity,
          enemyLevel: cap.level,
          isNewSpecies: cap.isNewSpecies,
          captureDestination: cap.destination,
          loreLine: capSpecies.lore,
          audioCue: 'capture_chime',
          skippable: true,
          priority: 'dramatic',
          dedupeKey: `capture_${cap.slugUid}`,
        });
      },
      onStateChange: () => {
        this.emitHud(true);
      },
      onEnd: (endedBattle) => {
        const outcome = endedBattle?.outcome;
        if (outcome === 'victory' || outcome === 'captured') {
          this.entities = this.entities.filter((x) => x.uid !== ent.uid);
          if (ent.challengeId) {
            this.ensureExplorationFields();
            if (!this.state.clearedChallenges!.includes(ent.challengeId)) {
              this.state.clearedChallenges!.push(ent.challengeId);
              if (ent.name.includes('Cristalino')) {
                this.state.inventory.evoStone += 1;
                this.state.inventory.capsules += 1;
                this.notify('¡Desafío cristalino superado! +1 Piedra Evolutiva y +1 Cilindro.');
              } else {
                this.state.inventory.relics += 1;
                this.state.inventory.capsules += 1;
                this.notify('¡Ruinas aseguradas! +1 Reliquia Antigua y +1 Cilindro.');
              }
            }
          }
        }
        this.syncStoryProgress();
        this.syncAmbientMusic();
        void this.runBackgroundSave('battle');
        this.emitHud(true);
      },
    });
    this.emitHud(true);
  }

  // Nicknames, Retired Crafting, Breeding, Shelter Upgrades, RPG Activities & Quests
  public setSlugNickname(slugUid: string, rawNickname: string): boolean {
    const res = setSlugNicknameHelper(this.state, slugUid, rawNickname);
    sound.playUi();
    this.notify(res.message);
    this.emitHud(true);
    return res.ok;
  }

  public clearSlugNickname(slugUid: string): boolean {
    const res = clearSlugNicknameHelper(this.state, slugUid);
    sound.playUi();
    this.notify(res.message);
    this.emitHud(true);
    return res.ok;
  }

  public craftItem(_recipeId: string): boolean {
    this.notify('La fabricación por minería fue sustituida por Fichas de Caverna y recompensas de Campaña.');
    sound.playUi();
    return false;
  }

  public useElixirOnSlug(slugUid: string): boolean {
    if (this.state.inventory.elixirs <= 0) {
      this.notify('No tienes Elixires Megamorph.');
      return false;
    }
    const slug = findSlugByUidAnywhere(this.state, slugUid);
    if (!slug) return false;
    this.state.inventory.elixirs--;
    const msgs = awardSlugExperience(this.state, slug, 35, { bondDelta: 25, allowTraitBonus: false });
    sound.playCapture();
    this.notify(msgs[0] || `${getSlugDisplayName(slug)} recibió Elixir (+25 Amistad, +35 EXP).`);
    this.emitHud(true);
    return true;
  }

  public evolveSlugToMegamorph(slugUid: string): boolean {
    const res = evolveSlugToMegamorphHelper(this.state, slugUid);
    if (res.ok) {
      sound.playMegamorphFanfare();
      const evolved = findSlugByUidAnywhere(this.state, slugUid);
      const sp = evolved ? getSpecies(evolved.id) : null;
      const displayTitle = evolved ? getSlugDisplayName(evolved) : 'Megamorph';
      cinematicEvents.emit({
        type: 'megamorph_awakened',
        title: displayTitle,
        subtitle: sp?.evoName || 'Forma Megamorph',
        speciesId: evolved?.id,
        slugName: displayTitle,
        slugElement: evolved?.type,
        slugRarity: evolved?.rarity,
        loreLine: sp?.lore,
        audioCue: 'megamorph_fanfare',
        skippable: true,
        priority: 'dramatic',
        dedupeKey: `mega_${slugUid}`,
      });
      this.renderer.spawnBurst(
        Math.floor(this.state.player.x + 0.5),
        Math.floor(this.state.player.y + 0.5),
        '#facc15',
        20
      );
    } else {
      sound.playUi();
    }
    this.notify(res.message);
    this.emitHud(true);
    return res.ok;
  }

  public swapPartyAndStorage(partyIndex: number, storageUid: string): void {
    const sIdx = this.state.storage.findIndex((s) => s.uid === storageUid);
    if (sIdx < 0) return;
    if (this.state.party.length < 4 && partyIndex < 0) {
      const [moved] = this.state.storage.splice(sIdx, 1);
      this.state.party.push(moved);
    } else if (partyIndex >= 0 && partyIndex < this.state.party.length) {
      const tmp = this.state.party[partyIndex];
      this.state.party[partyIndex] = this.state.storage[sIdx];
      this.state.storage[sIdx] = tmp;
    }
    sound.playUi();
    this.emitHud(true);
  }

  public startBreeding(uidA: string, uidB: string): boolean {
    if (this.state.eggs.length >= 3) {
      this.notify('La incubadora tiene el máximo de 3 huevos.');
      return false;
    }
    const all = [...this.state.party, ...this.state.storage];
    const a = all.find((s) => s.uid === uidA);
    const b = all.find((s) => s.uid === uidB);
    if (!a || !b || a.uid === b.uid) return false;
    if (a.bond < 25 || b.bond < 25) {
      this.notify('Ambas babosas necesitan al menos 25 de amistad para crianza.');
      return false;
    }

    const traits = ['Vitalidad +', 'Potencia +', 'Velocidad +'];
    const bonusTrait = traits[Math.floor(Math.random() * traits.length)];
    const speciesId = Math.random() < 0.5 ? a.id : b.id;
    const steps = this.state.shelterTier >= 2 ? 40 : 60;

    this.state.eggs.push({
      id: `egg_${Date.now()}`,
      parentAName: getSlugDisplayName(a),
      parentBName: getSlugDisplayName(b),
      speciesId,
      stepsRemaining: steps,
      totalSteps: steps,
      bonusTrait,
    });
    sound.playPickup();
    this.notify(`Huevo en incubación (${getSpecies(speciesId).name} · ${bonusTrait}). Camina ${steps} pasos.`);
    this.emitHud(true);
    return true;
  }

  public upgradeShelter(): boolean {
    this.ensureExplorationFields();
    if (this.state.shelterTier >= 3) {
      this.notify('Tu refugio ya está al nivel máximo (Nivel 3).');
      return false;
    }
    const needTokens = this.state.shelterTier === 1 ? 6 : 10;
    const tokens = this.state.cavernTokens ?? 0;
    if (tokens < needTokens) {
      this.notify(`Necesitas ${needTokens} Fichas de Caverna para mejorar el Refugio.`);
      return false;
    }
    this.state.cavernTokens = tokens - needTokens;
    this.state.shelterTier++;
    this.syncStoryProgress();
    sound.playVictory();
    this.notify(
      this.state.shelterTier === 2
        ? '¡Refugio Nivel 2! Aura de curación pasiva e incubación +50% más rápida.'
        : '¡Refugio Nivel 3! Baliza de retorno rápido al refugio desbloqueada.'
    );
    this.emitHud(true);
    return true;
  }

  public warpToShelter(): void {
    if (this.state.shelterTier < 3) {
      this.notify('Mejora tu Refugio al Nivel 3 para usar el retorno rápido.');
      return;
    }
    this.keysHeld.clear();
    const res = travelToScenario(this.state, 'esc_refugio_shane');
    if (!res.ok) {
      this.state.player.x = SPAWN_X;
      this.state.player.y = SPAWN_Y + 2;
    }
    const loaded = this.chunks.ensureWindowAround(this.state.player.x, this.state.player.y, 2);
    for (const ck of loaded) {
      this.state.exploredChunks[ck] = 1;
    }
    this.renderer.resetCamera(this.state.player.x, this.state.player.y);
    this.seedInitialEntities();
    sound.playPulse();
    this.setScreen('PLAYING');
    this.notify('Teletransportado al Refugio Shane.');
  }

  // Mecha System
  public toggleMecha(): boolean {
    this.ensureExplorationFields();
    const mecha = ensureMechaState(this.state);
    if (!mecha.unlocked) {
      this.notify('Desbloquea tu Meca Shane completando la misión inicial de Exploración (Cap. 2).');
      sound.playUi();
      return false;
    }
    mecha.active = !mecha.active;
    sound.playPulse();
    this.notify(
      mecha.active
        ? `${mecha.name} (Nv.${mecha.tier}) activado · +${Math.round((getMechaSpeedMultiplier(this.state) - 1) * 100)}% velocidad.`
        : `${mecha.name} guardado en el hangar.`
    );
    this.emitHud(true);
    return true;
  }

  public selectMechaTheme(themeId: MechaTheme): boolean {
    this.ensureExplorationFields();
    const mecha = ensureMechaState(this.state);
    const theme = MECHA_THEMES.find((t) => t.id === themeId);
    if (!theme) return false;
    if (mecha.unlockedThemes.includes(themeId)) {
      mecha.theme = themeId;
      sound.playUi();
      this.notify(`Pintura equipada: ${theme.name}.`);
      this.emitHud(true);
      return true;
    }
    const tokens = this.state.cavernTokens ?? 0;
    if (tokens < theme.costTokens) {
      this.notify(`Necesitas ${theme.costTokens} Fichas para desbloquear ${theme.name}.`);
      sound.playUi();
      return false;
    }
    this.state.cavernTokens = tokens - theme.costTokens;
    mecha.unlockedThemes.push(themeId);
    mecha.theme = themeId;
    sound.playPickup();
    this.notify(`Tema ${theme.name} desbloqueado y equipado.`);
    this.emitHud(true);
    return true;
  }

  public upgradeMecha(upgradeId?: string): boolean {
    this.ensureExplorationFields();
    const mecha = ensureMechaState(this.state);
    if (!mecha.unlocked) {
      this.notify('Desbloquea tu Meca primero en la historia.');
      return false;
    }
    const nextUpgrade = upgradeId
      ? MECHA_UPGRADES.find((u) => u.id === upgradeId)
      : MECHA_UPGRADES.find((u) => u.tier === mecha.tier + 1);
    if (!nextUpgrade) {
      this.notify('Tu Meca ya cuenta con todas las mejoras disponibles.');
      return false;
    }
    if (mecha.tier >= nextUpgrade.tier) {
      this.notify(`Tu Meca ya tiene nivel ${mecha.tier}.`);
      return false;
    }
    const story = ensureStoryState(this.state);
    const maxChOrder = Object.entries(story.chapterStates).reduce((m, [cid, st]) => {
      if (st === 'active' || st === 'completed') {
        const ch = STORY_CHAPTERS_BY_ID[cid];
        return ch ? Math.max(m, ch.order) : m;
      }
      return m;
    }, 1);
    if (maxChOrder < nextUpgrade.requiredChapterOrder) {
      this.notify(`Requiere alcanzar el Capítulo ${nextUpgrade.requiredChapterOrder}.`);
      return false;
    }
    const tokens = this.state.cavernTokens ?? 0;
    if (tokens < nextUpgrade.costTokens) {
      this.notify(`Necesitas ${nextUpgrade.costTokens} Fichas de Caverna.`);
      return false;
    }
    this.state.cavernTokens = tokens - nextUpgrade.costTokens;
    mecha.tier = nextUpgrade.tier;
    mecha.name = nextUpgrade.tier === 2 ? 'Meca Shane M2' : 'Meca Shane M3';
    if (!mecha.upgrades.includes(nextUpgrade.id)) {
      mecha.upgrades.push(nextUpgrade.id);
    }
    sound.playVictory();
    this.notify(`¡Meca mejorado a ${nextUpgrade.name}!`);
    this.emitHud(true);
    return true;
  }

  // Dialogues & Journal
  public openDialogue(dialogueId: string): boolean {
    const dlg = getDialogueById(dialogueId);
    if (!dlg) return false;
    const story = ensureStoryState(this.state);
    const st = story.chapterStates[dlg.chapterId];
    if (st !== 'active' && st !== 'completed') {
      this.notify('Este diálogo pertenece a un capítulo aún bloqueado.');
      return false;
    }
    this.activeDialogueId = dialogueId;
    sound.playUi();
    this.emitHud(true);
    return true;
  }

  public closeDialogue(): void {
    this.activeDialogueId = null;
    this.emitHud(true);
  }

  public submitDialogueChoice(dialogueId: string, choiceId?: string): boolean {
    this.ensureExplorationFields();
    const res = completeDialogueHelper(this.state, dialogueId, choiceId);
    if (!res.ok) {
      this.notify(res.message);
      return false;
    }
    this.syncStoryProgress();
    sound.playPickup();
    this.notify(res.replyText ? `${res.message} — ${res.replyText}` : res.message);
    this.emitHud(true);
    return true;
  }

  public recordJournalEntry(entryId: string): boolean {
    this.ensureExplorationFields();
    const added = recordJournalEntryHelper(this.state, entryId);
    if (added) this.emitHud(true);
    return added;
  }

  // Rivals, Tournaments & Post-Game Battles
  public startRivalDuel(rivalId: string): boolean {
    if (this.combat.battle) return false;
    const rival = RIVAL_DUELS.find((r) => r.id === rivalId);
    if (!rival) return false;
    const story = ensureStoryState(this.state);
    const st = story.chapterStates[rival.chapterId];
    if (st !== 'active' && st !== 'completed') {
      this.notify(`Este duelo rival se desbloquea en ${STORY_CHAPTERS_BY_ID[rival.chapterId]?.title || rival.chapterId}.`);
      return false;
    }
    const ally = this.state.party[this.state.activePartyIndex] || this.state.party[0];
    const sp = getSpecies(rival.speciesId);
    cinematicEvents.emit({
      type: 'encounter_intro',
      title: rival.name,
      subtitle: `${rival.title} · Nv.${rival.level}`,
      biome: rival.biome,
      speciesId: rival.speciesId,
      slugName: sp.name,
      slugElement: sp.type,
      slugRarity: sp.rarity,
      enemyKind: 'mercenary',
      enemyLevel: rival.level,
      allySpeciesId: ally?.id,
      allyName: ally ? getSlugDisplayName(ally) : undefined,
      allyMega: ally?.mega,
      loreLine: rival.introQuote,
      audioCue: 'duel_tension',
      skippable: true,
      priority: 'highlight',
      dedupeKey: `rival_${rival.id}_${Date.now()}`,
    });
    this.screen = 'PLAYING';
    this.combat.startBattle(this.state, {
      kind: 'mercenary',
      speciesId: rival.speciesId,
      level: rival.level,
      biome: rival.biome,
      nameOverride: rival.name,
      onStateChange: () => this.emitHud(true),
      onEnd: (ended) => {
        if (ended?.outcome === 'victory' || ended?.outcome === 'captured') {
          this.ensureExplorationFields();
          this.state.cavernTokens = (this.state.cavernTokens ?? 0) + rival.rewardTokens;
          if (rival.rewardItems) {
            for (const [k, rawAmt] of Object.entries(rival.rewardItems)) {
              const amt = typeof rawAmt === 'number' ? rawAmt : 0;
              if (amt > 0 && k in this.state.inventory) {
                this.state.inventory[k as InventoryKey] =
                  (this.state.inventory[k as InventoryKey] || 0) + amt;
              }
            }
          }
          if (!this.state.clearedChallenges!.includes(rival.id)) {
            this.state.clearedChallenges!.push(rival.id);
          }
          this.notify(`¡Victoria ante ${rival.name}! +${rival.rewardTokens} Fichas. "${rival.victoryQuote}"`);
        }
        this.syncStoryProgress();
        void this.runBackgroundSave('battle');
        this.emitHud(true);
      },
    });
    this.emitHud(true);
    return true;
  }

  public startTournament(tournamentId: string): boolean {
    if (this.combat.battle) return false;
    const tour = BLASTER_TOURNAMENTS.find((t) => t.id === tournamentId);
    if (!tour) return false;
    const story = ensureStoryState(this.state);
    const reqState = story.chapterStates[tour.requiredChapterId];
    const reqOk =
      tour.requiredChapterId === 'cap_08_ciudadela_blakk'
        ? isPostGameUnlocked(this.state)
        : reqState === 'active' || reqState === 'completed';
    if (!reqOk) {
      this.notify(`Este torneo requiere avanzar en ${STORY_CHAPTERS_BY_ID[tour.requiredChapterId]?.title || tour.requiredChapterId}.`);
      return false;
    }
    this.screen = 'PLAYING';
    this.launchTournamentRound(tour.id, 0);
    return true;
  }

  private launchTournamentRound(tournamentId: string, roundIndex: number): void {
    const tour = BLASTER_TOURNAMENTS.find((t) => t.id === tournamentId);
    if (!tour) {
      this.activeTournament = null;
      return;
    }
    const round = tour.rounds[roundIndex];
    if (!round) {
      this.activeTournament = null;
      return;
    }
    this.activeTournament = {
      tournamentId: tour.id,
      name: tour.name,
      roundIndex,
      totalRounds: tour.rounds.length,
    };
    const isFinal = roundIndex === tour.rounds.length - 1;
    this.combat.startBattle(this.state, {
      kind: isFinal ? 'boss' : 'mercenary',
      speciesId: round.speciesId,
      level: round.level,
      biome: tour.biome,
      nameOverride: `${round.roundName}: ${round.opponentName}`,
      onStateChange: () => this.emitHud(true),
      onEnd: (ended) => {
        const won = ended?.outcome === 'victory' || ended?.outcome === 'captured';
        if (!won) {
          this.activeTournament = null;
          this.notify(`Eliminado en ${round.roundName} de ${tour.name}.`);
          this.emitHud(true);
          return;
        }
        if (roundIndex + 1 < tour.rounds.length) {
          this.notify(`¡Superaste ${round.roundName}! Preparando siguiente combate...`);
          this.launchTournamentRound(tour.id, roundIndex + 1);
          return;
        }
        this.activeTournament = null;
        this.ensureExplorationFields();
        if (!this.state.clearedTournaments!.includes(tour.id)) {
          this.state.clearedTournaments!.push(tour.id);
        }
        this.state.cavernTokens = (this.state.cavernTokens ?? 0) + tour.rewardTokens;
        if (tour.rewardItems) {
          for (const [k, rawAmt] of Object.entries(tour.rewardItems)) {
            const amt = typeof rawAmt === 'number' ? rawAmt : 0;
            if (amt > 0 && k in this.state.inventory) {
              this.state.inventory[k as InventoryKey] =
                (this.state.inventory[k as InventoryKey] || 0) + amt;
            }
          }
        }
        this.awardPlayerXp(45);
        sound.playVictory();
        this.notify(`¡Campeón de ${tour.name}! ${tour.rewardSummary}`);
        this.syncStoryProgress();
        void this.runBackgroundSave('battle');
        this.emitHud(true);
      },
    });
    this.emitHud(true);
  }

  public startPostGameChallenge(challengeId: string): boolean {
    if (this.combat.battle) return false;
    if (!isPostGameUnlocked(this.state)) {
      this.notify('Completa el Capítulo 6 (Ciudadela del Comandante Blakk) para desbloquear el Post-Game.');
      return false;
    }
    const chal = POSTGAME_CHALLENGES.find((c) => c.id === challengeId);
    if (!chal) return false;
    this.screen = 'PLAYING';
    this.combat.startBattle(this.state, {
      kind: 'boss',
      speciesId: chal.speciesId,
      level: chal.level,
      biome: chal.biome,
      nameOverride: chal.bossName,
      onStateChange: () => this.emitHud(true),
      onEnd: (ended) => {
        if (ended?.outcome === 'victory' || ended?.outcome === 'captured') {
          this.ensureExplorationFields();
          this.state.cavernTokens = (this.state.cavernTokens ?? 0) + chal.rewardTokens;
          if (chal.rewardItems) {
            for (const [k, rawAmt] of Object.entries(chal.rewardItems)) {
              const amt = typeof rawAmt === 'number' ? rawAmt : 0;
              if (amt > 0 && k in this.state.inventory) {
                this.state.inventory[k as InventoryKey] =
                  (this.state.inventory[k as InventoryKey] || 0) + amt;
              }
            }
          }
          if (!this.state.clearedChallenges!.includes(chal.id)) {
            this.state.clearedChallenges!.push(chal.id);
          }
          sound.playVictory();
          this.notify(`¡Desafío Post-Game superado: ${chal.title}! ${chal.rewardSummary}`);
        }
        this.syncStoryProgress();
        void this.runBackgroundSave('battle');
        this.emitHud(true);
      },
    });
    this.emitHud(true);
    return true;
  }

  // Training Drills, Races & Hidden Discoveries
  public completeTrainingChallenge(
    challengeId: string,
    score: number
  ): { ok: boolean; rank: TrainingRecord['bestRank']; message: string; tokensGained: number } {
    this.ensureExplorationFields();
    const def = TRAINING_CHALLENGES.find((c) => c.id === challengeId);
    if (!def) {
      return { ok: false, rank: 'B', message: 'Desafío no encontrado.', tokensGained: 0 };
    }
    const cleanScore = Math.max(0, Math.round(score));
    const rank: TrainingRecord['bestRank'] =
      cleanScore >= def.targetScoreS ? 'S' : cleanScore >= def.targetScoreA ? 'A' : 'B';

    const prev = this.state.trainingRecords![challengeId];
    const rankOrder: Record<TrainingRecord['bestRank'], number> = { B: 1, A: 2, S: 3 };
    const firstClear = !prev;
    const firstRankS = rank === 'S' && prev?.bestRank !== 'S';

    this.state.trainingRecords![challengeId] = {
      bestScore: Math.max(prev?.bestScore || 0, cleanScore),
      bestRank: prev && rankOrder[prev.bestRank] > rankOrder[rank] ? prev.bestRank : rank,
      completions: (prev?.completions || 0) + 1,
    };
    if (!this.state.clearedChallenges!.includes(challengeId) && (rank === 'A' || rank === 'S')) {
      this.state.clearedChallenges!.push(challengeId);
    }

    let tokensGained = 0;
    if (firstClear) tokensGained += def.rewardTokens;
    else if (firstRankS) tokensGained += Math.ceil(def.rewardTokens / 2);
    else if (rank === 'A' || rank === 'S') tokensGained += 1;

    this.state.cavernTokens = (this.state.cavernTokens ?? 0) + tokensGained;
    const active = this.state.party[this.state.activePartyIndex] || this.state.party[0];
    if (active) {
      grantMoveMastery(active, 0, Math.round(def.rewardMastery * 0.6));
      grantMoveMastery(active, 1, Math.round(def.rewardMastery * 0.4));
      awardSlugExperience(this.state, active, def.rewardXp, { bondDelta: def.rewardBond });
    }
    this.syncStoryProgress();
    sound.playVictory();
    const msg = `Entrenamiento "${def.title}" · Rango ${rank} (${cleanScore} pts)${
      tokensGained > 0 ? ` · +${tokensGained} Fichas` : ''
    }`;
    this.notify(msg);
    this.emitHud(true);
    return { ok: true, rank, message: msg, tokensGained };
  }

  public completeSlugRace(
    raceId: string,
    timeSec: number,
    won: boolean
  ): { ok: boolean; message: string; tokensGained: number } {
    this.ensureExplorationFields();
    const race = SLUG_RACES.find((r) => r.id === raceId);
    if (!race) {
      return { ok: false, message: 'Circuito no encontrado.', tokensGained: 0 };
    }
    const mecha = ensureMechaState(this.state);
    if (race.requiredMecha && !mecha.unlocked) {
      this.notify('Necesitas desbloquear tu Meca Shane antes de competir en carreras.');
      return { ok: false, message: 'Meca bloqueado.', tokensGained: 0 };
    }
    const cleanTime = Math.max(1, Math.round(timeSec * 10) / 10);
    const prev = this.state.raceRecords![raceId];
    const firstWin = won && !prev?.cleared;
    this.state.raceRecords![raceId] = {
      bestTimeSec: prev && prev.bestTimeSec > 0 ? Math.min(prev.bestTimeSec, cleanTime) : cleanTime,
      cleared: Boolean(prev?.cleared || won),
      wins: (prev?.wins || 0) + (won ? 1 : 0),
    };
    const tokensGained = won ? (firstWin ? race.rewardTokens : 2) : 1;
    this.state.cavernTokens = (this.state.cavernTokens ?? 0) + tokensGained;
    if (won) {
      this.awardPlayerXp(25);
      sound.playVictory();
    } else {
      sound.playUi();
    }
    this.syncStoryProgress();
    const msg = won
      ? `¡Victoria en ${race.name}! Tiempo ${cleanTime}s · +${tokensGained} Fichas.`
      : `Carrera completada en ${cleanTime}s (Meta: ${race.parTimeSec}s) · +1 Ficha de práctica.`;
    this.notify(msg);
    this.emitHud(true);
    return { ok: true, message: msg, tokensGained };
  }

  public discoverSecret(secretId: string): boolean {
    this.ensureExplorationFields();
    const sec = HIDDEN_DISCOVERIES.find((s) => s.id === secretId);
    if (!sec) return false;
    if (this.state.discoveredSecrets!.includes(secretId)) {
      this.notify(`Ya registraste "${sec.title}".`);
      return false;
    }
    this.state.discoveredSecrets!.push(secretId);
    this.state.cavernTokens = (this.state.cavernTokens ?? 0) + sec.rewardTokens;
    if (sec.rewardItems) {
      for (const [k, rawAmt] of Object.entries(sec.rewardItems)) {
        const amt = typeof rawAmt === 'number' ? rawAmt : 0;
        if (amt > 0 && k in this.state.inventory) {
          this.state.inventory[k as InventoryKey] =
            (this.state.inventory[k as InventoryKey] || 0) + amt;
        }
      }
    }
    this.awardPlayerXp(20);
    sound.playDiscovery(true);
    this.notify(`¡Secreto descubierto: ${sec.title}! +${sec.rewardTokens} Fichas.`);
    this.emitHud(true);
    return true;
  }

  public getQuestMetricValue(metric: QuestDef['metric']): number {
    switch (metric) {
      case 'oreMined':
        return this.state.stats.oreMined;
      case 'wins':
        return this.state.stats.wins;
      case 'biomesFound':
        return this.state.discoveries.length;
      case 'torchesPlaced':
        return this.state.stats.torchesPlaced;
      case 'structuresBuilt':
        return this.state.stats.structuresBuilt;
      case 'chestsOpened':
        return this.state.stats.chestsOpened;
      case 'speciesCaptured':
        return Object.keys(this.state.capturedSpecies).length;
      case 'eggsHatched':
        return this.state.stats.eggsHatched;
      case 'shelterTier':
        return this.state.shelterTier;
      case 'bossesDefeated':
        return this.state.defeatedBosses.length;
      case 'megaUnlocked':
        return this.state.stats.megaUnlocked;
      case 'challengesCleared':
        return (this.state.clearedChallenges || []).length + Object.keys(this.state.trainingRecords || {}).length;
      case 'dialoguesDone':
        return (this.state.completedDialogues || []).length;
      case 'tournamentsWon':
        return (this.state.clearedTournaments || []).length;
      case 'racesWon':
        return Object.values(this.state.raceRecords || {}).filter((r) => r.cleared || r.wins > 0).length;
      default:
        return 0;
    }
  }

  public getQuestProgress(q: QuestDef): number {
    return this.getQuestMetricValue(q.metric);
  }

  public isQuestComplete(q: QuestDef): boolean {
    if (this.getQuestMetricValue(q.metric) < q.goal) return false;
    if (q.extraConditions) {
      for (const cond of q.extraConditions) {
        if (this.getQuestMetricValue(cond.metric) < cond.goal) return false;
      }
    }
    return true;
  }

  public claimStoryMission(missionId: string): boolean {
    const res = claimStoryMissionHelper(this.state, missionId);
    if (!res.ok) {
      sound.playUi();
      this.notify(res.message);
      return false;
    }
    if (res.xpGained > 0) {
      this.awardPlayerXp(res.xpGained);
    }
    if (res.unlockedChapterId) {
      const ch = STORY_CHAPTERS_BY_ID[res.unlockedChapterId];
      if (ch) {
        this.recentChapterAlert = ch.title;
        this.recentChapterAlertTimer = 5;
        cinematicEvents.emit({
          type: 'chapter_unlocked',
          title: ch.title,
          subtitle: ch.subtitle,
          audioCue: 'discovery_wonder',
          skippable: true,
          priority: 'ambient',
          dedupeKey: `ch_${ch.id}`,
        });
      }
    } else if (res.unlockedRoutes.length > 0) {
      const route = STORY_ROUTES[res.unlockedRoutes[0]];
      if (route) {
        cinematicEvents.emit({
          type: 'route_unlocked',
          title: `Ruta abierta: ${route.name}`,
          audioCue: 'discovery_wonder',
          skippable: true,
          priority: 'ambient',
          dedupeKey: `route_${route.id}`,
        });
      }
    }
    sound.playVictory();
    this.notify(
      res.unlockedChapterId && STORY_CHAPTERS_BY_ID[res.unlockedChapterId]
        ? `${res.message} · ¡${STORY_CHAPTERS_BY_ID[res.unlockedChapterId].title} activo!`
        : res.message
    );
    this.emitHud(true);
    return true;
  }

  public activateStoryMission(missionId: string): boolean {
    const ok = activateMission(this.state, missionId);
    if (ok) {
      sound.playUi();
      this.emitHud(true);
    }
    return ok;
  }

  public travelToStoryScenario(scenarioId: string): boolean {
    const res = travelToScenario(this.state, scenarioId);
    if (res.ok) {
      this.keysHeld.clear();
      const loaded = this.chunks.ensureWindowAround(this.state.player.x, this.state.player.y, 2);
      for (const ck of loaded) {
        this.state.exploredChunks[ck] = 1;
      }
      this.renderer.resetCamera(this.state.player.x, this.state.player.y);
      this.seedInitialEntities();
      this.checkSurroundingPOIs(
        Math.floor(this.state.player.x + 0.5),
        Math.floor(this.state.player.y + 0.5)
      );
      this.syncAmbientMusic();
      sound.playPulse();
    } else {
      sound.playUi();
    }
    this.notify(res.message);
    this.emitHud(true);
    if (this.screen === 'FULL_MAP' && this.fullMapCanvas) {
      this.renderer.renderFullWorldMap(this.fullMapCanvas, this.state);
    }
    return res.ok;
  }

  public claimQuest(questId: string): boolean {
    const storyCounterpart = STORY_MISSIONS_BY_LEGACY_ID[questId];
    if (storyCounterpart) {
      return this.claimStoryMission(storyCounterpart.id);
    }
    if (this.state.claimedQuests.includes(questId)) return false;
    const q = QUEST_LIST.find((x) => x.id === questId);
    if (!q) return false;
    if (!this.isQuestComplete(q)) return false;

    this.state.claimedQuests.push(questId);
    const r = q.rewards;
    for (const [k, v] of Object.entries(r)) {
      if (k === 'xp') {
        this.awardPlayerXp(v as number);
      } else if (k === 'perk') {
        if (!this.state.player.perks.includes(v as string)) {
          this.state.player.perks.push(v as string);
        }
      } else {
        this.state.inventory[k as InventoryKey] = (this.state.inventory[k as InventoryKey] || 0) + (v as number);
      }
    }
    this.syncStoryProgress();
    sound.playVictory();
    this.notify(`Misión completada: ${q.title}`);
    this.emitHud(true);
    return true;
  }

  // Living Home & Habitats Management (FASE 3)
  public assignSlugToHome(slugUid: string, habitatId: HabitatId): boolean {
    this.chunks.ensureWindowAround(SPAWN_X, SPAWN_Y, 2);
    const res = assignSlugToHabitat(this.state, slugUid, habitatId, this.chunks);
    if (res.ok) sound.playCapture();
    else sound.playUi();
    this.notify(res.message);
    this.emitHud(true);
    return res.ok;
  }

  public withdrawSlugFromHome(slugUid: string): boolean {
    const res = withdrawSlugFromHomeHelper(this.state, slugUid);
    if (res.ok) sound.playUi();
    this.notify(res.message);
    this.emitHud(true);
    return res.ok;
  }

  public moveHomeSlugHabitat(slugUid: string, habitatId: HabitatId): boolean {
    this.chunks.ensureWindowAround(SPAWN_X, SPAWN_Y, 2);
    const res = moveHomeSlugToHabitat(this.state, slugUid, habitatId, this.chunks);
    sound.playUi();
    this.notify(res.message);
    this.emitHud(true);
    return res.ok;
  }

  public petHomeSlug(slugUid: string): boolean {
    const res = petHomeSlugHelper(this.state, slugUid);
    const resident = this.state.home?.residents.find((r) => r.slug.uid === slugUid);
    if (resident) {
      this.renderer.addFloatingText(Math.round(resident.x), Math.round(resident.y), '♥', '#f472b6');
      this.renderer.spawnBurst(Math.round(resident.x), Math.round(resident.y), '#f472b6', 8);
    }
    if (res.ok) sound.playHeal();
    this.notify(res.message);
    this.emitHud(true);
    return res.ok;
  }

  public playWithHomeSlug(slugUid: string): boolean {
    const res = playWithHomeSlugHelper(this.state, slugUid);
    const resident = this.state.home?.residents.find((r) => r.slug.uid === slugUid);
    if (resident && res.ok) {
      this.renderer.addFloatingText(Math.round(resident.x), Math.round(resident.y), '★', '#fde047');
      this.renderer.spawnBurst(Math.round(resident.x), Math.round(resident.y), '#fde047', 10);
      sound.playPickup();
    } else {
      sound.playUi();
    }
    this.notify(res.message);
    this.emitHud(true);
    return res.ok;
  }

  public feedHomeSlug(slugUid: string, foodKey: InventoryKey): boolean {
    const res = feedHomeSlugHelper(this.state, slugUid, foodKey);
    const resident = this.state.home?.residents.find((r) => r.slug.uid === slugUid);
    if (resident && res.ok) {
      this.renderer.addFloatingText(Math.round(resident.x), Math.round(resident.y), '🍖', '#4ade80');
      this.renderer.spawnBurst(Math.round(resident.x), Math.round(resident.y), '#4ade80', 10);
      sound.playHeal();
    } else {
      sound.playUi();
    }
    this.notify(res.message);
    this.emitHud(true);
    return res.ok;
  }

  public placeFurnitureAt(kind: FurnitureKind, tx: number, ty: number): boolean {
    this.chunks.ensureWindowAround(tx, ty, 1);
    const res = placeHomeFurniture(this.state, this.chunks, kind, tx, ty);
    if (res.ok) {
      this.invalidateRoomCache();
      sound.playPlace();
      this.renderer.addFloatingText(tx, ty, 'Mobiliario', '#67e8f9');
    } else {
      sound.playUi();
    }
    this.notify(res.message);
    this.emitHud(true);
    return res.ok;
  }

  public placeFurnitureInFront(kind: FurnitureKind): boolean {
    const target = this.getTargetTile();
    return this.placeFurnitureAt(kind, target.x, target.y);
  }

  public pickupFurnitureAt(tx: number, ty: number): boolean {
    const res = pickupHomeFurnitureAt(this.state, tx, ty, this.chunks);
    if (res.ok) {
      this.invalidateRoomCache();
      sound.playPickup();
    }
    this.notify(res.message);
    this.emitHud(true);
    return res.ok;
  }

  public pickupFurnitureById(furnitureId: string): boolean {
    const res = pickupHomeFurnitureById(this.state, furnitureId, this.chunks);
    if (res.ok) {
      this.invalidateRoomCache();
      sound.playPickup();
    }
    this.notify(res.message);
    this.emitHud(true);
    return res.ok;
  }
}

export const gameEngine = new BajoterraEngine();
