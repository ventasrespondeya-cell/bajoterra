import { sound } from './audio';
import { CombatManager } from './combat';
import {
  BIOME_INFO,
  BOSS_DEFINITIONS,
  CHUNK_SIZE,
  CRAFT_RECIPES,
  HOTBAR_SLOTS,
  QUEST_LIST,
  SPAWN_X,
  SPAWN_Y,
  SPECIES_LIST,
  TILE_PX,
  WORLD_H,
  WORLD_W,
  createSlugInstance,
  getSpecies,
  pickWeightedSpeciesByBiome,
} from './data';
import {
  awardSlugExperience,
  evolveSlugToMegamorph as evolveSlugToMegamorphHelper,
  findSlugByUidAnywhere,
  grantSlugBond,
} from './progression';
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
  type FurnitureKind,
  type GameOptions,
  type GameState,
  type HabitatId,
  type HudSnapshot,
  type InventoryKey,
  type QuestDef,
  type RoamingEntity,
  type RoomValidationInfo,
  type UIScreen,
} from './types';
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

  constructor() {
    ensureHomeState(this.state);
    this.ensureExplorationFields();
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
      selectedHotbar: this.state.selectedHotbar,
      discoveries: [...this.state.discoveries],
      discoveredPOIs: (this.state.discoveredPOIs || []).map((p) => ({ ...p })),
      clearedChallenges: [...(this.state.clearedChallenges || [])],
      seenSpecies: { ...this.state.seenSpecies },
      capturedSpecies: { ...this.state.capturedSpecies },
      eggs: this.state.eggs.map((e) => ({ ...e })),
      shelterTier: this.state.shelterTier,
      home: cloneHomeState(this.state.home),
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
      options: { ...this.state.options },
      battle: this.combat.battle
        ? {
            ...this.combat.battle,
            enemy: { ...this.combat.battle.enemy },
            log: [...this.combat.battle.log],
            effects: [...this.combat.battle.effects],
          }
        : null,
      toast: this.toastText,
      hasV4Save: this.hasV4,
      hasV3Save: this.hasV3,
      pulseCooldownPct: Math.max(0, Math.min(1, 1 - this.pulseCooldown / this.pulseMaxCooldown)),
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
    ensureHomeState(this.state);
    this.ensureExplorationFields();
    this.invalidateRoomCache();
    this.autoSaveErrorNotified = false;
    this.applyOptionsToAudio();
    this.chunks.reset(this.state.worldSeed, this.state.tilesDelta);
    this.chunks.ensureWindowAround(this.state.player.x, this.state.player.y, 2);
    this.renderer.resetCamera(this.state.player.x, this.state.player.y);
    this.seedInitialEntities();
    this.screen = 'PLAYING';
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
    this.invalidateRoomCache();
    this.autoSaveErrorNotified = false;
    this.applyOptionsToAudio();
    this.chunks.reset(this.state.worldSeed, this.state.tilesDelta);
    this.chunks.ensureWindowAround(this.state.player.x, this.state.player.y, 2);
    this.renderer.resetCamera(this.state.player.x, this.state.player.y);
    this.seedInitialEntities();
    this.screen = 'PLAYING';
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
    this.invalidateRoomCache();
    this.autoSaveErrorNotified = false;
    this.applyOptionsToAudio();
    this.chunks.reset(this.state.worldSeed, this.state.tilesDelta);
    this.chunks.ensureWindowAround(this.state.player.x, this.state.player.y, 2);
    this.renderer.resetCamera(this.state.player.x, this.state.player.y);
    this.seedInitialEntities();
    this.hasV4 = true;
    this.screen = 'PLAYING';
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
    this.invalidateRoomCache();
    this.autoSaveErrorNotified = false;
    this.applyOptionsToAudio();
    this.chunks.reset(this.state.worldSeed, this.state.tilesDelta);
    this.chunks.ensureWindowAround(this.state.player.x, this.state.player.y, 2);
    this.renderer.resetCamera(this.state.player.x, this.state.player.y);
    this.seedInitialEntities();
    this.hasV4 = true;
    this.screen = 'PLAYING';
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
    this.emitHud(true);
    if (screen === 'FULL_MAP' && this.fullMapCanvas) {
      requestAnimationFrame(() => {
        if (this.fullMapCanvas) {
          this.renderer.renderFullWorldMap(this.fullMapCanvas, this.state);
        }
      });
    }
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
    this.notify(`Babosa activa: ${this.state.party[index].name}`);
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
    const key = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
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

    if (key === 'escape') {
      if (this.screen === 'PLAYING') this.setScreen('PAUSED');
      else this.setScreen('PLAYING');
      return;
    }

    if (this.screen !== 'PLAYING') {
      if (key === 'i' || key === 'tab') this.setScreen('PLAYING');
      if (key === 'm' && this.screen === 'FULL_MAP') this.setScreen('PLAYING');
      return;
    }

    // Edge-triggered actions
    if (!e.repeat) {
      if (key >= '1' && key <= '8') {
        const idx = Number(key) - 1;
        this.setHotbar(idx);
        if (idx === 7) this.triggerExplorationPulse();
      } else if (key === 'e') {
        this.performPrimaryAction();
      } else if (key === ' ') {
        this.triggerExplorationPulse();
      } else if (key === 'i' || key === 'tab') {
        this.setScreen('EXPEDITION');
      } else if (key === 'm') {
        this.setScreen('FULL_MAP');
      } else if (key === 'q') {
        const nextIdx = (this.state.activePartyIndex + 1) % this.state.party.length;
        this.setActivePartyIndex(nextIdx);
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
  }

  public setJoystick(x: number, y: number): void {
    this.joyVec = { x, y };
  }

  public setTouchSprint(active: boolean): void {
    this.touchSprinting = active;
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
      this.state.player.facingX = Math.round(Math.cos(ang));
      this.state.player.facingY = Math.round(Math.sin(ang));
      if (this.state.player.facingX === 0 && this.state.player.facingY === 0) {
        this.state.player.facingY = 1;
      }
    }
    this.performPrimaryAction();
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

    if (this.lavaDamageCooldown > 0) this.lavaDamageCooldown -= dt;
    if (this.pulseCooldown > 0) {
      this.pulseCooldown = Math.max(0, this.pulseCooldown - dt);
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

      this.updatePlayerMovement(dt);
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
    this.renderer.renderWorld(ctx, vw, vh, this.timeSec, this.state, this.chunks, this.entities, target);
  }

  private updatePlayerMovement(dt: number): void {
    let dx = 0;
    let dy = 0;
    if (this.keysHeld.has('w') || this.keysHeld.has('arrowup')) dy -= 1;
    if (this.keysHeld.has('s') || this.keysHeld.has('arrowdown')) dy += 1;
    if (this.keysHeld.has('a') || this.keysHeld.has('arrowleft')) dx -= 1;
    if (this.keysHeld.has('d') || this.keysHeld.has('arrowright')) dx += 1;
    dx += this.joyVec.x;
    dy += this.joyVec.y;

    const mag = Math.hypot(dx, dy);
    const wantSprint = this.keysHeld.has('shift') || this.touchSprinting;
    const isSprinting = wantSprint && this.state.player.stamina > 2 && mag > 0.1;

    if (isSprinting) {
      this.state.player.stamina = Math.max(0, this.state.player.stamina - 22 * dt);
    } else {
      this.state.player.stamina = Math.min(this.state.player.maxStamina, this.state.player.stamina + 16 * dt);
    }

    if (mag < 0.12) return;

    const nxDir = dx / mag;
    const nyDir = dy / mag;
    if (Math.abs(nxDir) > Math.abs(nyDir)) {
      this.state.player.facingX = nxDir >= 0 ? 1 : -1;
      this.state.player.facingY = 0;
    } else {
      this.state.player.facingX = 0;
      this.state.player.facingY = nyDir >= 0 ? 1 : -1;
    }

    const tileStanding = this.chunks.getTile(
      Math.floor(this.state.player.x + 0.5),
      Math.floor(this.state.player.y + 0.5)
    );
    const iceBoost = tileStanding === TileType.ICE_FLOOR ? 1.24 : 1;
    const speedTilesPerSec = (isSprinting ? 7.6 : 4.9) * iceBoost;

    const stepX = nxDir * speedTilesPerSec * dt;
    const stepY = nyDir * speedTilesPerSec * dt;

    const canWalk = (x: number, y: number): boolean => {
      if (x < 2 || y < 2 || x >= WORLD_W - 2 || y >= WORLD_H - 2) return false;
      // Check bounding box around sprite center (x + 0.5, y + 0.5) aligned to [tx, tx + 1) tiles
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
      return true;
    };

    const prevX = this.state.player.x;
    const prevY = this.state.player.y;

    if (canWalk(this.state.player.x + stepX, this.state.player.y)) {
      this.state.player.x += stepX;
    }
    if (canWalk(this.state.player.x, this.state.player.y + stepY)) {
      this.state.player.y += stepY;
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

  private onPlayerMoved(dist: number): void {
    const px = Math.floor(this.state.player.x + 0.5);
    const py = Math.floor(this.state.player.y + 0.5);

    // Stream chunks & mark explored
    const loaded = this.chunks.ensureWindowAround(px, py, 2);
    for (const ck of loaded) {
      this.state.exploredChunks[ck] = 1;
    }

    // Biome discovery
    const b = getBiomeAt(px, py, this.state.worldSeed);
    if (!this.state.discoveries.includes(b)) {
      this.state.discoveries.push(b);
      sound.playVictory();
      this.notify(`¡Nuevo bioma descubierto: ${BIOME_INFO[b].name}!`);
      this.emitHud(true);
    }

    // Lava hazard
    const under = this.chunks.getTile(px, py);
    if (isTileHazard(under) && this.lavaDamageCooldown <= 0) {
      this.lavaDamageCooldown = 0.8;
      if (!this.state.player.perks.includes('Resistencia Térmica')) {
        this.state.player.hp = Math.max(1, this.state.player.hp - 8);
        this.renderer.triggerShake(4, 0.2);
        this.renderer.addFloatingText(px, py, '-8 ¡Lava!', '#fb923c');
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
          sound.playPickup();
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
      Magma: 'piroclasto',
      Heladas: 'glaciomita',
      Sombrias: 'umbrospect',
      Verdes: 'thorny',
    };
    const levelMap: Record<BiomeId, number> = {
      Verdes: 5,
      Magma: 6,
      Heladas: 6,
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
    this.notify(`¡Huevo eclosionado! Nació ${baby.name} (${baby.bonusTrait}).`);
    this.emitHud(true);
  }

  public performPrimaryAction(): void {
    const slot = HOTBAR_SLOTS[this.state.selectedHotbar] || HOTBAR_SLOTS[0];
    const target = this.getTargetTile();
    const tile = this.chunks.getTile(target.x, target.y);

    // Check nearby NPC / Boss / Merchant first
    const nearbyEntity = this.entities.find(
      (e) => Math.hypot(e.x - this.state.player.x, e.y - this.state.player.y) < 1.9
    );
    if (nearbyEntity) {
      if (nearbyEntity.kind === 'merchant') {
        this.tradeWithMerchant();
        return;
      }
      this.engageEntity(nearbyEntity);
      return;
    }

    // Interactive world objects regardless of tool
    if (tile === TileType.DOOR_CLOSED) {
      this.chunks.setTile(target.x, target.y, TileType.DOOR_OPEN);
      this.invalidateRoomCache();
      sound.playPlace();
      this.renderer.addFloatingText(target.x, target.y, 'Puerta abierta', '#fde047');
      return;
    }
    if (tile === TileType.DOOR_OPEN && slot.id === 'mine') {
      this.chunks.setTile(target.x, target.y, TileType.DOOR_CLOSED);
      this.invalidateRoomCache();
      sound.playPlace();
      this.renderer.addFloatingText(target.x, target.y, 'Puerta cerrada', '#cbd5e1');
      return;
    }
    if (tile === TileType.CHEST_CLOSED) {
      this.openChest(target.x, target.y);
      return;
    }
    if (tile === TileType.RECHARGE_STATION) {
      this.rechargeTeam();
      return;
    }
    if (tile === TileType.ALTAR) {
      this.interactWithAltar(target.x, target.y);
      return;
    }

    if (slot.id === 'pulse') {
      this.triggerExplorationPulse();
      return;
    }

    if (slot.id === 'berry') {
      this.useQuickBerry();
      return;
    }

    // Building tools
    if (slot.id === 'torch' || slot.id === 'wall' || slot.id === 'floor' || slot.id === 'door' || slot.id === 'station') {
      this.placeStructure(slot.id, target.x, target.y, tile);
      return;
    }

    // Pick up home furniture or interact with nearby home slug if target tile isn't mineable
    if (this.state.home?.furniture.some((f) => f.x === target.x && f.y === target.y)) {
      this.pickupFurnitureAt(target.x, target.y);
      return;
    }

    if (!this.isMineableTile(tile)) {
      const nearHome = findNearbyHomeSlug(this.state, 2.1);
      if (nearHome) {
        this.petHomeSlug(nearHome.slug.uid);
        return;
      }
    }

    // Mining & Harvesting (Pico)
    this.mineTile(target.x, target.y, tile);
  }

  private isMineableTile(tile: TileType): boolean {
    return (
      tile === TileType.ORE ||
      tile === TileType.ROCK ||
      tile === TileType.CRACKED_WALL ||
      tile === TileType.WOOD_PILLAR ||
      tile === TileType.MUSHROOM ||
      tile === TileType.ICE ||
      tile === TileType.SHADOW_CRYSTAL ||
      tile === TileType.ENERGY_CRYSTAL ||
      tile === TileType.WALL ||
      tile === TileType.TORCH ||
      tile === TileType.MAGMA_COAL ||
      tile === TileType.THERMAL_COPPER ||
      tile === TileType.ICE_CRYSTAL ||
      tile === TileType.BLUE_QUARTZ ||
      tile === TileType.DARK_IRON ||
      tile === TileType.NEON_MUSHROOM ||
      tile === TileType.KELP ||
      tile === TileType.VOLCANIC_ROCK ||
      tile === TileType.EVO_STONE_VEIN
    );
  }

  private mineTile(tx: number, ty: number, tile: TileType): void {
    const b = getBiomeAt(tx, ty, this.state.worldSeed);
    if (this.isMineableTile(tile)) {
      sound.playMine();
      this.renderer.triggerShake(2.5, 0.1);

      if (tile === TileType.ORE) {
        const gain = b === 'Sombrias' || b === 'Magma' ? 3 : 2;
        this.state.inventory.ore += gain;
        this.state.inventory.stone += 1;
        this.state.stats.oreMined += gain;
        this.renderer.spawnBurst(tx, ty, '#facc15', 14);
        this.renderer.addFloatingText(tx, ty, `+${gain} Mineral`, '#fde047');
        this.awardPlayerXp(4);
      } else if (tile === TileType.WOOD_PILLAR) {
        const rootGain = b === 'Verdes' ? 2 : 1;
        this.state.inventory.wood += 2;
        this.state.inventory.rootWood += rootGain;
        this.renderer.spawnBurst(tx, ty, '#a16207', 10);
        this.renderer.addFloatingText(tx, ty, `+2 Madera · +${rootGain} Raíz`, '#fbbf24');
      } else if (tile === TileType.MUSHROOM) {
        this.state.inventory.berries += 1;
        this.renderer.spawnBurst(tx, ty, '#34d399', 10);
        this.renderer.addFloatingText(tx, ty, '+1 Baya', '#6ee7b7');
      } else if (tile === TileType.ENERGY_CRYSTAL) {
        this.state.inventory.crystal += 2;
        this.state.stats.oreMined += 1;
        this.renderer.spawnBurst(tx, ty, '#2dd4bf', 16);
        this.renderer.addFloatingText(tx, ty, '+2 Cristal', '#5eead4');
        this.awardPlayerXp(7);
      } else if (tile === TileType.SHADOW_CRYSTAL) {
        this.state.inventory.shadowShard += 2;
        this.renderer.spawnBurst(tx, ty, '#c084fc', 16);
        this.renderer.addFloatingText(tx, ty, '+2 Frag. Sombrío', '#d8b4fe');
        this.awardPlayerXp(8);
      } else if (tile === TileType.MAGMA_COAL) {
        this.state.inventory.magmaCoal += 2;
        this.state.stats.oreMined += 1;
        this.renderer.spawnBurst(tx, ty, '#fb923c', 14);
        this.renderer.addFloatingText(tx, ty, '+2 Carbón Magma', '#fdba74');
        this.awardPlayerXp(5);
      } else if (tile === TileType.THERMAL_COPPER) {
        this.state.inventory.thermalCopper += 2;
        this.state.inventory.ore += 1;
        this.state.stats.oreMined += 1;
        this.renderer.spawnBurst(tx, ty, '#ea580c', 14);
        this.renderer.addFloatingText(tx, ty, '+2 Cobre Térmico', '#fed7aa');
        this.awardPlayerXp(6);
      } else if (tile === TileType.ICE_CRYSTAL) {
        this.state.inventory.iceCrystal += 2;
        this.state.stats.oreMined += 1;
        this.renderer.spawnBurst(tx, ty, '#67e8f9', 14);
        this.renderer.addFloatingText(tx, ty, '+2 Cristal Hielo', '#a5f3fc');
        this.awardPlayerXp(5);
      } else if (tile === TileType.BLUE_QUARTZ) {
        this.state.inventory.blueQuartz += 2;
        this.state.stats.oreMined += 1;
        this.renderer.spawnBurst(tx, ty, '#38bdf8', 15);
        this.renderer.addFloatingText(tx, ty, '+2 Cuarzo Azul', '#7dd3fc');
        this.awardPlayerXp(6);
      } else if (tile === TileType.DARK_IRON) {
        this.state.inventory.darkIron += 2;
        this.state.inventory.ore += 1;
        this.state.stats.oreMined += 1;
        this.renderer.spawnBurst(tx, ty, '#a855f7', 14);
        this.renderer.addFloatingText(tx, ty, '+2 Hierro Oscuro', '#e9d5ff');
        this.awardPlayerXp(7);
      } else if (tile === TileType.NEON_MUSHROOM) {
        this.state.inventory.neonMushroom += 2;
        this.renderer.spawnBurst(tx, ty, '#c084fc', 12);
        this.renderer.addFloatingText(tx, ty, '+2 Hongo Neón', '#d8b4fe');
        this.awardPlayerXp(4);
      } else if (tile === TileType.KELP) {
        this.state.inventory.berries += 1;
        this.state.inventory.rootWood += 1;
        this.renderer.spawnBurst(tx, ty, '#22c55e', 10);
        this.renderer.addFloatingText(tx, ty, '+1 Baya · +1 Raíz', '#86efac');
      } else if (tile === TileType.VOLCANIC_ROCK) {
        this.state.inventory.stone += 1;
        if ((tx + ty) % 3 === 0) {
          this.state.inventory.magmaCoal += 1;
          this.renderer.addFloatingText(tx, ty, '+1 Piedra · +1 Carbón', '#fdba74');
        } else {
          this.renderer.addFloatingText(tx, ty, '+1 Roca Volcánica', '#fca5a5');
        }
        this.renderer.spawnBurst(tx, ty, '#b91c1c', 10);
      } else if (tile === TileType.EVO_STONE_VEIN) {
        this.state.inventory.evoStone += 1;
        this.state.inventory.crystal += 1;
        this.state.stats.oreMined += 1;
        sound.playPickup();
        this.renderer.spawnBurst(tx, ty, '#f472b6', 20);
        this.renderer.addFloatingText(tx, ty, '+1 Piedra Evolutiva', '#f9a8d4');
        this.awardPlayerXp(12);
      } else if (tile === TileType.CRACKED_WALL) {
        this.state.inventory.stone += 2;
        this.renderer.spawnBurst(tx, ty, '#94a3b8', 18);
        this.renderer.addFloatingText(tx, ty, '¡Cámara secreta abierta!', '#67e8f9');
        sound.playPickup();
      } else if (tile === TileType.TORCH) {
        this.state.inventory.torches += 1;
        this.renderer.addFloatingText(tx, ty, '+1 Antorcha', '#fed7aa');
      } else if (tile === TileType.WALL) {
        this.state.inventory.walls += 1;
        this.renderer.addFloatingText(tx, ty, '+1 Pared', '#cbd5e1');
      } else {
        this.state.inventory.stone += 1;
        this.renderer.spawnBurst(tx, ty, '#94a3b8', 8);
        this.renderer.addFloatingText(tx, ty, '+1 Piedra', '#cbd5e1');
      }

      this.chunks.setTile(tx, ty, TileType.FLOOR);
      this.invalidateRoomCache();
      this.emitHud(true);
      return;
    }

    this.notify('No hay un bloque minable frente a ti.');
  }

  private placeStructure(
    kind: 'torch' | 'wall' | 'floor' | 'door' | 'station',
    tx: number,
    ty: number,
    currentTile: TileType
  ): void {
    const keyMap: Record<typeof kind, InventoryKey> = {
      torch: 'torches',
      wall: 'walls',
      floor: 'floors',
      door: 'doors',
      station: 'stations',
    };
    const invKey = keyMap[kind];
    if (this.state.inventory[invKey] <= 0) {
      this.notify('Sin existencias. Fabrica más en el Taller (I).');
      return;
    }

    if (kind === 'floor') {
      if (currentTile !== TileType.FLOOR && currentTile !== TileType.WATER && currentTile !== TileType.ICE_FLOOR) {
        this.notify('Solo puedes colocar suelo sobre terreno libre o agua.');
        return;
      }
      this.state.inventory[invKey]--;
      this.chunks.setTile(tx, ty, TileType.BUILT_FLOOR);
      this.invalidateRoomCache();
      this.state.stats.structuresBuilt++;
      sound.playPlace();
      this.renderer.addFloatingText(tx, ty, 'Suelo colocado', '#fde68a');
      this.emitHud(true);
      return;
    }

    if (isTileSolid(currentTile) || currentTile === TileType.TORCH || currentTile === TileType.LAVA) {
      this.notify('Ese bloque está ocupado.');
      return;
    }

    this.state.inventory[invKey]--;
    if (kind === 'torch') {
      this.chunks.setTile(tx, ty, TileType.TORCH);
      this.state.stats.torchesPlaced++;
      sound.playTorch();
      this.renderer.spawnBurst(tx, ty, '#fb923c', 12);
      this.renderer.addFloatingText(tx, ty, 'Antorcha colocada', '#fdba74');
    } else if (kind === 'wall') {
      this.chunks.setTile(tx, ty, TileType.WALL);
      this.state.stats.structuresBuilt++;
      sound.playPlace();
      this.renderer.addFloatingText(tx, ty, 'Pared construida', '#cbd5e1');
    } else if (kind === 'door') {
      this.chunks.setTile(tx, ty, TileType.DOOR_CLOSED);
      this.state.stats.structuresBuilt++;
      sound.playPlace();
      this.renderer.addFloatingText(tx, ty, 'Puerta instalada', '#fcd34d');
    } else if (kind === 'station') {
      this.chunks.setTile(tx, ty, TileType.RECHARGE_STATION);
      this.state.stats.structuresBuilt++;
      sound.playPulse();
      this.renderer.addFloatingText(tx, ty, 'Estación instalada', '#67e8f9');
    }
    this.invalidateRoomCache();
    this.emitHud(true);
  }

  private openChest(tx: number, ty: number): void {
    this.chunks.setTile(tx, ty, TileType.CHEST_OPEN);
    this.state.stats.chestsOpened++;
    const b = getBiomeAt(tx, ty, this.state.worldSeed);
    const ore = 3 + Math.floor(Math.random() * 4);
    const berries = 1 + Math.floor(Math.random() * 2);
    const crystal = Math.random() < 0.65 ? 2 : 1;
    const cap = Math.random() < 0.7 ? 1 : 0;
    this.state.inventory.ore += ore;
    this.state.inventory.berries += berries;
    this.state.inventory.crystal += crystal;
    this.state.inventory.capsules += cap;
    if (Math.random() < 0.35) this.state.inventory.relics += 1;

    let biomeNote = '';
    if (b === 'Verdes') {
      this.state.inventory.rootWood += 2;
      biomeNote = ' · +2 Madera Raíz';
    } else if (b === 'Magma') {
      this.state.inventory.magmaCoal += 2;
      this.state.inventory.thermalCopper += 1;
      biomeNote = ' · +2 Carbón Magma, +1 Cobre Térmico';
    } else if (b === 'Heladas') {
      this.state.inventory.iceCrystal += 2;
      this.state.inventory.blueQuartz += 1;
      biomeNote = ' · +2 Cristal Hielo, +1 Cuarzo Azul';
    } else if (b === 'Sombrias') {
      this.state.inventory.darkIron += 2;
      this.state.inventory.neonMushroom += 2;
      this.state.inventory.evoStone += 1;
      biomeNote = ' · +2 Hierro Oscuro, +2 Hongo Neón, +1 Piedra Evolutiva';
    }
    if (b !== 'Sombrias' && Math.random() < 0.25) {
      this.state.inventory.evoStone += 1;
      biomeNote += ' · +1 Piedra Evolutiva';
    }

    sound.playPickup();
    this.renderer.spawnBurst(tx, ty, '#facc15', 18);
    this.renderer.addFloatingText(tx, ty, `+${ore} Min · +${crystal} Cris`, '#fde047');
    this.awardPlayerXp(14);
    this.notify(`¡Cofre abierto! +${ore} mineral, +${crystal} cristal, +${berries} bayas${biomeNote}.`);
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
    if (this.state.inventory.crystal >= 1) {
      this.state.inventory.crystal--;
      const msgs = awardSlugExperience(this.state, active, 25, { bondDelta: 10 });
      sound.playPulse();
      this.renderer.spawnBurst(tx, ty, '#2dd4bf', 16);
      this.notify(msgs[0] || `${active.name} absorbe energía del altar (+25 EXP, +10 Amistad).`);
      this.emitHud(true);
    } else {
      this.notify('Altar Antiguo: ofrece 1 Cristal de Energía para fortalecer a tu babosa activa.');
    }
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
        extra = ` ¡${active.name} alcanza ${bondRes.newTier.label}!`;
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

    // Scan radius 9 for chests, secret walls, or bosses
    let foundMsg = '';
    for (let dy = -9; dy <= 9; dy++) {
      for (let dx = -9; dx <= 9; dx++) {
        const t = this.chunks.getTile(px + dx, py + dy);
        if (t === TileType.CHEST_CLOSED) {
          this.renderer.addFloatingText(px + dx, py + dy, '◆ Cofre', '#fde047');
          foundMsg = '¡Escáner detectó un cofre cercano!';
        } else if (t === TileType.CRACKED_WALL) {
          this.renderer.addFloatingText(px + dx, py + dy, '✦ Muro Secreto', '#67e8f9');
          foundMsg = '¡Muro agrietado secreto detectado!';
        } else if (t === TileType.EVO_STONE_VEIN) {
          this.renderer.addFloatingText(px + dx, py + dy, '✦ Piedra Evolutiva', '#f472b6');
          foundMsg = '¡Veta de Piedra Evolutiva detectada!';
        } else if (
          t === TileType.ENERGY_CRYSTAL ||
          t === TileType.SHADOW_CRYSTAL ||
          t === TileType.BLUE_QUARTZ ||
          t === TileType.ICE_CRYSTAL ||
          t === TileType.THERMAL_COPPER ||
          t === TileType.DARK_IRON
        ) {
          this.renderer.spawnBurst(px + dx, py + dy, '#5eead4', 6);
        }
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
    if (this.state.inventory.ore >= 4) {
      this.state.inventory.ore -= 4;
      this.state.inventory.capsules += 2;
      this.state.inventory.berries += 1;
      sound.playPickup();
      this.notify('Mercader: Intercambiaste 4 minerales por 2 Cilindros y 1 Baya.');
      this.emitHud(true);
    } else {
      this.notify('Mercader Subterráneo: "Tráeme 4 minerales y te daré 2 Cilindros y 1 Baya."');
    }
  }

  private seedInitialEntities(): void {
    this.entities = [];
    // Friendly underground merchant near starter shelter
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

    for (let tries = 0; tries < 20 && wildCount < 14 && this.entities.length < 22; tries++) {
      const ang = Math.random() * Math.PI * 2;
      const rad = 11 + Math.random() * 20;
      const wx = Math.floor(px + Math.cos(ang) * rad);
      const wy = Math.floor(py + Math.sin(ang) * rad);
      if (wx < 5 || wy < 5 || wx >= WORLD_W - 5 || wy >= WORLD_H - 5) continue;
      if (Math.hypot(wx - SPAWN_X, wy - SPAWN_Y) < 9) continue;
      const t = this.chunks.getTile(wx, wy);
      if (isTileSolid(t) || isTileHazard(t) || t === TileType.WATER) continue;

      const b = getBiomeAt(wx, wy, this.state.worldSeed);
      const sp = pickWeightedSpeciesByBiome(b);
      const isMerc = Math.random() < 0.16;
      const baseLvl = b === 'Verdes' ? 1 : b === 'Magma' || b === 'Heladas' ? 3 : 5;
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

  private updateEntities(dt: number): void {
    const px = this.state.player.x;
    const py = this.state.player.y;

    for (let i = this.entities.length - 1; i >= 0; i--) {
      const ent = this.entities[i];
      if (ent.cooldown > 0) ent.cooldown -= dt;
      const dist = Math.hypot(px - ent.x, py - ent.y);

      // Despawn distant wild/merc mobs to keep simulation lightweight
      if ((ent.kind === 'wild' || ent.kind === 'mercenary') && dist > 42) {
        this.entities.splice(i, 1);
        continue;
      }

      if (ent.kind === 'merchant') continue;

      if (ent.kind === 'mercenary' && dist < 8 && dist > 1.0 && ent.cooldown <= 0) {
        // Chase player unless near torches
        const ang = Math.atan2(py - ent.y, px - ent.x);
        const nx = ent.x + Math.cos(ang) * 2.2 * dt;
        const ny = ent.y + Math.sin(ang) * 2.2 * dt;
        if (!isTileSolid(this.chunks.getTile(Math.floor(nx + 0.5), Math.floor(ny + 0.5)))) {
          ent.x = nx;
          ent.y = ny;
        }
      } else if (ent.kind === 'wild') {
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

      // Trigger encounter on collision
      if (dist < 0.92 && ent.cooldown <= 0) {
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

    this.combat.startBattle(this.state, {
      kind: ent.kind === 'boss' ? 'boss' : ent.kind === 'mercenary' ? 'mercenary' : 'wild',
      speciesId: spId,
      level: ent.level,
      nameOverride: ent.kind === 'boss' ? ent.name : undefined,
      bossId: ent.bossId,
      iconOverride: ent.kind === 'boss' ? ent.icon : undefined,
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
        void this.runBackgroundSave('battle');
        this.emitHud(true);
      },
    });
    this.emitHud(true);
  }

  // Crafting, Breeding, Shelter Upgrades, Quests
  public craftItem(recipeId: string): boolean {
    const rec = CRAFT_RECIPES.find((r) => r.id === recipeId);
    if (!rec) return false;
    for (const [k, amt] of Object.entries(rec.cost)) {
      if ((this.state.inventory[k as InventoryKey] || 0) < (amt || 0)) {
        this.notify('Materiales insuficientes para fabricar.');
        return false;
      }
    }
    for (const [k, amt] of Object.entries(rec.cost)) {
      this.state.inventory[k as InventoryKey] -= amt || 0;
    }
    this.state.inventory[rec.outputKey] += rec.outputQty;
    sound.playPickup();
    this.notify(`Fabricado: ${rec.name}`);
    this.emitHud(true);
    return true;
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
    this.notify(msgs[0] || `${slug.name} recibió Elixir (+25 Amistad, +35 EXP).`);
    this.emitHud(true);
    return true;
  }

  public evolveSlugToMegamorph(slugUid: string): boolean {
    const res = evolveSlugToMegamorphHelper(this.state, slugUid);
    if (res.ok) {
      sound.playVictory();
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
      parentAName: a.name,
      parentBName: b.name,
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
    if (this.state.shelterTier >= 3) {
      this.notify('Tu refugio ya está al nivel máximo (Nivel 3).');
      return false;
    }
    const needOre = this.state.shelterTier === 1 ? 10 : 18;
    const needWood = this.state.shelterTier === 1 ? 8 : 14;
    const needCrystal = this.state.shelterTier === 1 ? 2 : 5;
    if (
      this.state.inventory.ore < needOre ||
      this.state.inventory.wood < needWood ||
      this.state.inventory.crystal < needCrystal
    ) {
      this.notify(`Necesitas ${needOre} mineral, ${needWood} madera y ${needCrystal} cristal.`);
      return false;
    }
    this.state.inventory.ore -= needOre;
    this.state.inventory.wood -= needWood;
    this.state.inventory.crystal -= needCrystal;
    this.state.shelterTier++;
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
    this.state.player.x = SPAWN_X;
    this.state.player.y = SPAWN_Y + 2;
    this.chunks.ensureWindowAround(this.state.player.x, this.state.player.y, 2);
    this.renderer.resetCamera(this.state.player.x, this.state.player.y);
    sound.playPulse();
    this.setScreen('PLAYING');
    this.notify('Teletransportado al Refugio Central.');
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

  public claimQuest(questId: string): boolean {
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
