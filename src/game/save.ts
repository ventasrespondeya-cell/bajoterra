import {
  BOSS_DEFINITIONS,
  CHUNK_SIZE,
  HABITAT_DEFS,
  HOTBAR_SLOTS,
  MAX_ACTIVE_HOME_SLUGS,
  MAX_HOME_FURNITURE,
  MAX_SLUGS_PER_HABITAT,
  QUEST_LIST,
  SPAWN_X,
  SPAWN_Y,
  SPECIES_LIST,
  WORLD_H,
  WORLD_W,
  createDefaultInventory,
  createSlugInstance,
  getSpecies,
  isSpeciesCompatibleWithHabitat,
} from './data';
import {
  MECHA_THEMES,
  createDefaultMechaState,
} from './activities';
import { createDefaultHomeState, isInShelterZone } from './home';
import {
  MAX_MOVE_MASTERY,
  MAX_SLUG_LEVEL,
  MAX_SLUG_NICKNAME_LENGTH,
  SLUG_PERSONALITIES,
  getDeterministicPersonality,
  getXpForNextLevel,
  normalizeSlugNickname,
} from './progression';
import {
  LEGACY_CHAPTER_ID_MAP,
  LEGACY_MISSION_ID_MAP,
  STORY_CHAPTERS_BY_ID,
  STORY_MISSIONS_BY_ID,
  STORY_ROUTES,
  STORY_SCENARIOS,
} from './storyData';
import {
  createInitialStoryState,
  migrateLegacyProgressToStory,
  normalizeLegacyStorySchema,
  reconcileStoryProgress,
} from './storyEngine';
import type { StoryChapterStatus, StoryMissionLifecycleState, StoryProgressState } from './storyTypes';
import {
  TileType,
  type BiomeId,
  type BreedingEgg,
  type DiscoveredPOI,
  type FurnitureKind,
  type GameState,
  type HabitatId,
  type HomeBehavior,
  type HomeFurniture,
  type HomeMood,
  type HomeSlugEntry,
  type HomeState,
  type InventoryKey,
  type MechaState,
  type MechaTheme,
  type POIKind,
  type RaceRecord,
  type SaveMetadata,
  type SlugInstance,
  type SlugPersonality,
  type TrainingRecord,
} from './types';

export const V4_SAVE_KEY = 'bajoterra-v4-save';
export const V4_DB_NAME = 'Bajoterra4DB';
export const V3_SAVE_KEY = 'bajoterra-v2';
export const V3_DB_NAME = 'BajoterraDB';
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024; // 2 MB limit to prevent browser freeze

const VALID_BIOMES = new Set<BiomeId>(['Verdes', 'Acuaticas', 'Magma', 'Heladas', 'Cristalinas', 'Sombrias']);
const VALID_POI_KINDS = new Set<POIKind>([
  'secret_chamber',
  'outpost',
  'abandoned_mine',
  'ancient_ruins',
  'crystal_chamber',
]);
const VALID_SPECIES_IDS = new Set<string>(SPECIES_LIST.map((s) => s.id));
const VALID_QUEST_IDS = new Set<string>(QUEST_LIST.map((q) => q.id));
const VALID_BOSS_IDS = new Set<string>(BOSS_DEFINITIONS.map((b) => b.id));
const VALID_INVENTORY_KEYS = new Set<string>(Object.keys(createDefaultInventory()));
const VALID_HABITAT_IDS = new Set<HabitatId>(HABITAT_DEFS.map((h) => h.id));
const VALID_FURNITURE_KINDS = new Set<FurnitureKind>(['nest', 'bed', 'feeder', 'decor']);
const VALID_HOME_MOODS = new Set<HomeMood>(['contenta', 'tranquila', 'hambrienta', 'cansada']);
const VALID_HOME_BEHAVIORS = new Set<HomeBehavior>(['pasear', 'descansar', 'acercarse', 'jugar']);
const VALID_CHAPTER_IDS = new Set<string>(Object.keys(STORY_CHAPTERS_BY_ID));
const VALID_SCENARIO_IDS = new Set<string>(Object.keys(STORY_SCENARIOS));
const VALID_ROUTE_IDS = new Set<string>(Object.keys(STORY_ROUTES));
const VALID_STORY_MISSION_IDS = new Set<string>(Object.keys(STORY_MISSIONS_BY_ID));
const VALID_CHAPTER_STATUSES = new Set<StoryChapterStatus>(['locked', 'active', 'completed']);
const VALID_MISSION_STATUSES = new Set<StoryMissionLifecycleState>(['locked', 'available', 'active', 'completed']);
const VALID_PERSONALITIES = new Set<SlugPersonality>(SLUG_PERSONALITIES);
const VALID_MECHA_THEMES = new Set<MechaTheme>(MECHA_THEMES.map((t) => t.id));
const VALID_TRAINING_RANKS = new Set<TrainingRecord['bestRank']>(['B', 'A', 'S']);
const VALID_STAT_KEYS = new Set<string>([
  'oreMined',
  'wins',
  'torchesPlaced',
  'structuresBuilt',
  'chestsOpened',
  'eggsHatched',
  'bossesDefeated',
  'megaUnlocked',
  'steps',
]);
const MAX_TILE_ID = TileType.CRYSTAL_SPIRE;
const MAX_CHUNK_X = Math.ceil(WORLD_W / CHUNK_SIZE);
const MAX_CHUNK_Y = Math.ceil(WORLD_H / CHUNK_SIZE);
const IDB_TIMEOUT_MS = 4500;

export type StorageBackendOutcome = 'both' | 'indexeddb' | 'localstorage' | 'none';
export type SaveReason = 'manual' | 'autosave' | 'battle' | 'import' | 'lifecycle' | 'sync';

export interface BackendWriteStatus {
  ok: boolean;
  error?: string;
}

export interface SaveResult {
  ok: boolean;
  storedIn: StorageBackendOutcome;
  indexedDB: BackendWriteStatus;
  localStorage: BackendWriteStatus;
  revision: number;
  savedAt: number;
  skipped?: boolean;
}

export interface LoadResult {
  state: GameState | null;
  source: StorageBackendOutcome;
  recoveredFromCorruption: boolean;
  syncedStores: boolean;
  warnings: string[];
}

export interface ValidationResult<T> {
  ok: boolean;
  value?: T;
  error?: string;
}

export interface ImportParseResult {
  ok: boolean;
  kind?: 'v4' | 'v3';
  state?: GameState;
  error?: string;
}

export interface StorageCapabilities {
  indexedDBAvailable: boolean;
  localStorageAvailable: boolean;
  storageApiAvailable: boolean;
  estimateSupported: boolean;
  persistedSupported: boolean;
  persistSupported: boolean;
  persisted: boolean | null;
  quotaBytes: number | null;
  usageBytes: number | null;
  isFileProtocol: boolean;
}

export interface PersistRequestResult {
  supported: boolean;
  granted: boolean | null;
  alreadyPersisted: boolean;
}

// Runtime sequential queue & revision tracking
let highestRevision = 0;
let saveChain: Promise<void> = Promise.resolve();
let inFlightCount = 0;
let queuedAutoSave = false;
let persistenceRequestedOnce = false;
let persistencePromise: Promise<PersistRequestResult> | null = null;

export function resetSaveRuntimeForTests(): void {
  highestRevision = 0;
  saveChain = Promise.resolve();
  inFlightCount = 0;
  queuedAutoSave = false;
  persistenceRequestedOnce = false;
  persistencePromise = null;
}

export function isSaveInFlight(): boolean {
  return inFlightCount > 0 || queuedAutoSave;
}

export function createInitialGameState(): GameState {
  const starterParty: SlugInstance[] = [
    createSlugInstance('infurnus', 1),
    createSlugInstance('aquabeak', 1),
    createSlugInstance('tazerling', 1),
  ];
  return {
    version: '4.0',
    worldSeed: 74192,
    worldWidth: WORLD_W,
    worldHeight: WORLD_H,
    player: {
      x: SPAWN_X,
      y: SPAWN_Y + 2,
      facingX: 0,
      facingY: 1,
      hp: 100,
      maxHp: 100,
      stamina: 100,
      maxStamina: 100,
      level: 1,
      xp: 0,
      perks: [],
    },
    party: starterParty,
    storage: [],
    activePartyIndex: 0,
    inventory: createDefaultInventory(),
    selectedHotbar: 0,
    tilesDelta: {},
    exploredChunks: { '10,10': 1 },
    discoveries: ['Verdes'],
    discoveredPOIs: [],
    clearedChallenges: [],
    seenSpecies: { infurnus: true, aquabeak: true, tazerling: true },
    capturedSpecies: { infurnus: 1, aquabeak: 1, tazerling: 1 },
    eggs: [],
    shelterTier: 1,
    home: createDefaultHomeState(),
    stats: {
      oreMined: 0,
      wins: 0,
      torchesPlaced: 0,
      structuresBuilt: 0,
      chestsOpened: 0,
      eggsHatched: 0,
      bossesDefeated: 0,
      megaUnlocked: 0,
      steps: 0,
    },
    defeatedBosses: [],
    claimedQuests: [],
    cavernTokens: 4,
    mecha: createDefaultMechaState(),
    trainingRecords: {},
    clearedTournaments: [],
    raceRecords: {},
    journalEntries: ['j_cap1_descenso'],
    completedDialogues: [],
    discoveredSecrets: [],
    story: createInitialStoryState(),
    playTimeSec: 0,
    options: {
      soundEnabled: true,
      volume: 0.35,
      touchControls: 'auto',
      lightingQuality: 'high',
      showMinimap: true,
    },
  };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function isFiniteNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isNonNegInt(v: unknown): v is number {
  return isFiniteNum(v) && Number.isInteger(v) && v >= 0;
}

function formatError(err: unknown): string {
  if (!err) return 'Error de almacenamiento desconocido';
  if (typeof err === 'string') return err;
  if (typeof err === 'object') {
    const e = err as { name?: string; message?: string };
    if (e.name && e.message) return `${e.name}: ${e.message}`;
    if (e.name) return e.name;
    if (e.message) return e.message;
  }
  return 'Error de almacenamiento';
}

function lsGetSafe(key: string): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function getRevisionFromRawJson(raw: string | null): number {
  if (!raw) return -1;
  try {
    const parsed = JSON.parse(raw);
    if (isPlainObject(parsed) && parsed.version === '4.0' && isPlainObject(parsed.saveMeta)) {
      const rev = parsed.saveMeta.revision;
      if (isFiniteNum(rev) && rev >= 0) return rev;
    }
    if (isPlainObject(parsed) && parsed.version === '4.0') return 0;
  } catch {
    return -1;
  }
  return -1;
}

function lsSetSafe(key: string, payload: string, revision?: number): BackendWriteStatus {
  try {
    if (typeof localStorage === 'undefined') {
      return { ok: false, error: 'localStorage no disponible' };
    }
    if (typeof revision === 'number') {
      const existingRev = getRevisionFromRawJson(lsGetSafe(key));
      if (existingRev > revision) {
        return { ok: true }; // Newer revision already present
      }
    }
    localStorage.setItem(key, payload);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: formatError(err) };
  }
}

function idbGetDetailed(dbName: string, key: string): Promise<{ value: string | null; ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve({ value: null, ok: false, error: 'IndexedDB no disponible' });
      return;
    }
    let settled = false;
    let dbRef: IDBDatabase | null = null;
    const finish = (res: { value: string | null; ok: boolean; error?: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        dbRef?.close();
      } catch {
        // ignore close errors
      }
      resolve(res);
    };
    const timer = setTimeout(() => {
      finish({ value: null, ok: false, error: 'IndexedDB tiempo de espera agotado' });
    }, IDB_TIMEOUT_MS);

    try {
      const req = indexedDB.open(dbName, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains('saves')) {
          req.result.createObjectStore('saves');
        }
      };
      req.onblocked = () => {
        finish({ value: null, ok: false, error: 'IndexedDB bloqueada por otra conexión' });
      };
      req.onsuccess = () => {
        const db = req.result;
        dbRef = db;
        db.onversionchange = () => {
          try {
            db.close();
          } catch {
            // ignore
          }
        };
        if (!db.objectStoreNames.contains('saves')) {
          finish({ value: null, ok: true });
          return;
        }
        try {
          const tx = db.transaction('saves', 'readonly');
          const getReq = tx.objectStore('saves').get(key);
          getReq.onsuccess = () => {
            finish({
              value: typeof getReq.result === 'string' ? getReq.result : null,
              ok: true,
            });
          };
          getReq.onerror = () => {
            finish({ value: null, ok: false, error: formatError(getReq.error) });
          };
          tx.onabort = () => {
            finish({ value: null, ok: false, error: formatError(tx.error || 'Transacción abortada') });
          };
          tx.onerror = () => {
            finish({ value: null, ok: false, error: formatError(tx.error) });
          };
        } catch (err) {
          finish({ value: null, ok: false, error: formatError(err) });
        }
      };
      req.onerror = () => finish({ value: null, ok: false, error: formatError(req.error) });
    } catch (err) {
      finish({ value: null, ok: false, error: formatError(err) });
    }
  });
}

function idbSetDetailed(dbName: string, key: string, value: string): Promise<BackendWriteStatus> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve({ ok: false, error: 'IndexedDB no disponible' });
      return;
    }
    let settled = false;
    let dbRef: IDBDatabase | null = null;
    const finish = (res: BackendWriteStatus) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        dbRef?.close();
      } catch {
        // ignore
      }
      resolve(res);
    };
    const timer = setTimeout(() => {
      finish({ ok: false, error: 'IndexedDB tiempo de espera agotado' });
    }, IDB_TIMEOUT_MS);

    try {
      const req = indexedDB.open(dbName, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains('saves')) {
          req.result.createObjectStore('saves');
        }
      };
      req.onblocked = () => {
        finish({ ok: false, error: 'IndexedDB bloqueada por otra conexión' });
      };
      req.onsuccess = () => {
        const db = req.result;
        dbRef = db;
        db.onversionchange = () => {
          try {
            db.close();
          } catch {
            // ignore
          }
        };
        try {
          const tx = db.transaction('saves', 'readwrite');
          const putReq = tx.objectStore('saves').put(value, key);
          putReq.onerror = () => {
            finish({ ok: false, error: formatError(putReq.error) });
          };
          tx.oncomplete = () => {
            finish({ ok: true });
          };
          tx.onabort = () => {
            finish({ ok: false, error: formatError(tx.error || 'Transacción abortada') });
          };
          tx.onerror = () => {
            finish({ ok: false, error: formatError(tx.error) });
          };
        } catch (err) {
          finish({ ok: false, error: formatError(err) });
        }
      };
      req.onerror = () => finish({ ok: false, error: formatError(req.error) });
    } catch (err) {
      finish({ ok: false, error: formatError(err) });
    }
  });
}

function enqueueSaveTask<T>(task: () => Promise<T>): Promise<T> {
  inFlightCount++;
  const next = saveChain.then(task, task);
  saveChain = next.then(
    () => {
      inFlightCount = Math.max(0, inFlightCount - 1);
    },
    () => {
      inFlightCount = Math.max(0, inFlightCount - 1);
    }
  );
  return next;
}

function getSaveRank(state: GameState): {
  revision: number;
  savedAt: number;
  playTimeSec: number;
  steps: number;
} {
  return {
    revision: state.saveMeta?.revision ?? 0,
    savedAt: state.saveMeta?.savedAt ?? 0,
    playTimeSec: state.playTimeSec ?? 0,
    steps: state.stats?.steps ?? 0,
  };
}

/**
 * Returns > 0 if a is newer than b, < 0 if b is newer than a, 0 if equal.
 */
export function compareSaveRecency(a: GameState, b: GameState): number {
  const ra = getSaveRank(a);
  const rb = getSaveRank(b);
  if (ra.revision !== rb.revision) return ra.revision - rb.revision;
  if (ra.savedAt !== rb.savedAt) return ra.savedAt - rb.savedAt;
  if (ra.playTimeSec !== rb.playTimeSec) return ra.playTimeSec - rb.playTimeSec;
  return ra.steps - rb.steps;
}

export interface SaveOptions {
  reason?: SaveReason;
  syncLocalStorageFirst?: boolean;
}

export async function saveGameV4(state: GameState, opts?: SaveOptions): Promise<SaveResult> {
  const reason = opts?.reason ?? 'manual';

  // Avoid piling up redundant periodic autosaves while another write is already in flight
  if (reason === 'autosave' && (inFlightCount > 0 || queuedAutoSave)) {
    return {
      ok: true,
      storedIn: 'none',
      indexedDB: { ok: false, error: 'Autoguardado omitido: escritura previa en curso' },
      localStorage: { ok: false, error: 'Autoguardado omitido: escritura previa en curso' },
      revision: highestRevision,
      savedAt: Date.now(),
      skipped: true,
    };
  }

  // Determine strictly monotonic revision synchronously at call time
  const existingLsRev = getRevisionFromRawJson(lsGetSafe(V4_SAVE_KEY));
  const stateRev = state.saveMeta?.revision ?? 0;
  const revision = Math.max(highestRevision, existingLsRev, stateRev) + 1;
  const savedAt = Date.now();
  highestRevision = revision;

  const meta: SaveMetadata = { revision, savedAt };
  state.saveMeta = meta;

  let payload: string;
  try {
    payload = JSON.stringify(state, (key, value) =>
      key === 'reactionText' ||
      key === 'reactionTimer' ||
      key === 'lastGreetAt' ||
      key === 'lastSocialAt' ||
      key === 'visualActivity' ||
      key === 'facingX'
        ? undefined
        : value
    );
  } catch (err) {
    const errMsg = formatError(err);
    return {
      ok: false,
      storedIn: 'none',
      indexedDB: { ok: false, error: errMsg },
      localStorage: { ok: false, error: errMsg },
      revision,
      savedAt,
    };
  }

  // Best-effort synchronous localStorage write for pagehide / visibilitychange
  let syncLsStatus: BackendWriteStatus | null = null;
  if (opts?.syncLocalStorageFirst) {
    syncLsStatus = lsSetSafe(V4_SAVE_KEY, payload, revision);
  }

  if (reason === 'autosave') queuedAutoSave = true;

  return enqueueSaveTask(async (): Promise<SaveResult> => {
    if (reason === 'autosave') queuedAutoSave = false;

    const lsRes = syncLsStatus ?? lsSetSafe(V4_SAVE_KEY, payload, revision);
    const idbRes = await idbSetDetailed(V4_DB_NAME, V4_SAVE_KEY, payload);

    const storedIn: StorageBackendOutcome =
      idbRes.ok && lsRes.ok
        ? 'both'
        : idbRes.ok
        ? 'indexeddb'
        : lsRes.ok
        ? 'localstorage'
        : 'none';

    return {
      ok: storedIn !== 'none',
      storedIn,
      indexedDB: idbRes,
      localStorage: lsRes,
      revision,
      savedAt,
    };
  });
}

async function syncStoresWithWinner(
  winner: GameState,
  needSyncIdb: boolean,
  needSyncLs: boolean
): Promise<boolean> {
  if (!needSyncIdb && !needSyncLs) return true;
  let payload: string;
  try {
    payload = JSON.stringify(winner);
  } catch {
    return false;
  }
  const rev = winner.saveMeta?.revision ?? 0;

  return enqueueSaveTask(async () => {
    let ok = true;
    if (needSyncLs) {
      const lsRes = lsSetSafe(V4_SAVE_KEY, payload, rev);
      if (!lsRes.ok) ok = false;
    }
    if (needSyncIdb) {
      const idbRes = await idbSetDetailed(V4_DB_NAME, V4_SAVE_KEY, payload);
      if (!idbRes.ok) ok = false;
    }
    return ok;
  });
}

function tryParseAndValidateV4Raw(raw: string | null): {
  present: boolean;
  valid: boolean;
  state?: GameState;
  error?: string;
} {
  if (!raw) return { present: false, valid: false };
  if (raw.length > MAX_IMPORT_BYTES * 2) {
    return { present: true, valid: false, error: 'Guardado excede el tamaño máximo permitido' };
  }
  try {
    const parsed = JSON.parse(raw);
    const res = validateV4State(parsed);
    if (!res.ok || !res.value) {
      return { present: true, valid: false, error: res.error || 'Estructura de guardado inválida' };
    }
    return { present: true, valid: true, state: res.value };
  } catch (err) {
    return { present: true, valid: false, error: formatError(err) };
  }
}

export async function loadGameV4Detailed(opts?: { syncStores?: boolean }): Promise<LoadResult> {
  const shouldSync = opts?.syncStores !== false;
  const warnings: string[] = [];

  const [idbRes, rawLs] = await Promise.all([
    idbGetDetailed(V4_DB_NAME, V4_SAVE_KEY),
    Promise.resolve(lsGetSafe(V4_SAVE_KEY)),
  ]);

  if (!idbRes.ok && idbRes.error) {
    warnings.push(`IndexedDB: ${idbRes.error}`);
  }

  const idbParsed = tryParseAndValidateV4Raw(idbRes.value);
  const lsParsed = tryParseAndValidateV4Raw(rawLs);

  const idbCorrupt = idbParsed.present && !idbParsed.valid;
  const lsCorrupt = lsParsed.present && !lsParsed.valid;
  if (idbCorrupt && idbParsed.error) warnings.push(`Copia en IndexedDB dañada: ${idbParsed.error}`);
  if (lsCorrupt && lsParsed.error) warnings.push(`Copia en localStorage dañada: ${lsParsed.error}`);

  if (!idbParsed.valid && !lsParsed.valid) {
    return {
      state: null,
      source: 'none',
      recoveredFromCorruption: idbCorrupt || lsCorrupt,
      syncedStores: false,
      warnings,
    };
  }

  let winner: GameState;
  let source: StorageBackendOutcome;
  let needSyncIdb = false;
  let needSyncLs = false;

  if (idbParsed.valid && idbParsed.state && lsParsed.valid && lsParsed.state) {
    const cmp = compareSaveRecency(idbParsed.state, lsParsed.state);
    if (cmp > 0) {
      winner = idbParsed.state;
      source = 'indexeddb';
      needSyncLs = true;
    } else if (cmp < 0) {
      winner = lsParsed.state;
      source = 'localstorage';
      needSyncIdb = true;
    } else {
      winner = idbParsed.state;
      source = 'both';
    }
  } else if (idbParsed.valid && idbParsed.state) {
    winner = idbParsed.state;
    source = 'indexeddb';
    needSyncLs = true;
  } else {
    winner = lsParsed.state!;
    source = 'localstorage';
    needSyncIdb = true;
  }

  const winRev = winner.saveMeta?.revision ?? 0;
  if (winRev > highestRevision) {
    highestRevision = winRev;
  }

  let syncedStores = false;
  if (shouldSync && (needSyncIdb || needSyncLs)) {
    syncedStores = await syncStoresWithWinner(winner, needSyncIdb, needSyncLs);
  }

  return {
    state: winner,
    source,
    recoveredFromCorruption: idbCorrupt || lsCorrupt,
    syncedStores,
    warnings,
  };
}

export async function loadGameV4(): Promise<GameState | null> {
  const res = await loadGameV4Detailed({ syncStores: true });
  return res.state;
}

export async function hasExistingV4Save(): Promise<boolean> {
  const res = await loadGameV4Detailed({ syncStores: false });
  return res.state !== null;
}

export async function detectV3SaveRaw(): Promise<string | null> {
  const idbRes = await idbGetDetailed(V3_DB_NAME, V3_SAVE_KEY);
  const rawLs = lsGetSafe(V3_SAVE_KEY);
  if (idbRes.value) {
    const parsed = parseImportedJsonSaveDetailed(idbRes.value);
    if (parsed.ok && parsed.kind === 'v3') return idbRes.value;
  }
  if (rawLs) {
    const parsed = parseImportedJsonSaveDetailed(rawLs);
    if (parsed.ok && parsed.kind === 'v3') return rawLs;
  }
  return idbRes.value || rawLs;
}

function validateSlug(
  rawSlug: unknown,
  seenUids: Set<string>,
  idxLabel: string
): ValidationResult<SlugInstance> {
  if (!isPlainObject(rawSlug)) {
    return { ok: false, error: `Babosa inválida en ${idxLabel}.` };
  }
  if (typeof rawSlug.uid !== 'string' || rawSlug.uid.trim().length === 0) {
    return { ok: false, error: `Identificador único de babosa ausente en ${idxLabel}.` };
  }
  if (seenUids.has(rawSlug.uid)) {
    return { ok: false, error: `Identificador de babosa duplicado: ${rawSlug.uid}.` };
  }
  seenUids.add(rawSlug.uid);

  if (typeof rawSlug.id !== 'string' || !VALID_SPECIES_IDS.has(rawSlug.id)) {
    return { ok: false, error: `Especie de babosa desconocida en ${idxLabel}.` };
  }
  if (typeof rawSlug.name !== 'string' || rawSlug.name.trim().length === 0) {
    return { ok: false, error: `Nombre de babosa inválido en ${idxLabel}.` };
  }
  if (
    !isFiniteNum(rawSlug.level) ||
    !Number.isInteger(rawSlug.level) ||
    rawSlug.level < 1 ||
    rawSlug.level > MAX_SLUG_LEVEL
  ) {
    return {
      ok: false,
      error: `Nivel de babosa inválido en ${idxLabel} (rango permitido 1..${MAX_SLUG_LEVEL}).`,
    };
  }
  if (!isFiniteNum(rawSlug.xp) || rawSlug.xp < 0) {
    return { ok: false, error: `Experiencia de babosa inválida en ${idxLabel}.` };
  }
  if (rawSlug.level >= MAX_SLUG_LEVEL && rawSlug.xp > 0) {
    return { ok: false, error: `Una babosa de nivel máximo (${MAX_SLUG_LEVEL}) no puede acumular EXP en ${idxLabel}.` };
  }
  if (rawSlug.level < MAX_SLUG_LEVEL && rawSlug.xp >= getXpForNextLevel(rawSlug.level)) {
    return { ok: false, error: `Experiencia de babosa incoherente con su nivel en ${idxLabel}.` };
  }
  if (!isFiniteNum(rawSlug.maxHp) || rawSlug.maxHp <= 0) {
    return { ok: false, error: `Salud máxima de babosa inválida en ${idxLabel}.` };
  }
  if (!isFiniteNum(rawSlug.hp) || rawSlug.hp < 0 || rawSlug.hp > rawSlug.maxHp) {
    return { ok: false, error: `Salud de babosa fuera de rango en ${idxLabel}.` };
  }
  if (!isFiniteNum(rawSlug.maxEnergy) || rawSlug.maxEnergy <= 0) {
    return { ok: false, error: `Energía máxima de babosa inválida en ${idxLabel}.` };
  }
  if (!isFiniteNum(rawSlug.energy) || rawSlug.energy < 0 || rawSlug.energy > rawSlug.maxEnergy) {
    return { ok: false, error: `Energía de babosa fuera de rango en ${idxLabel}.` };
  }
  if (!isFiniteNum(rawSlug.atk) || rawSlug.atk <= 0) {
    return { ok: false, error: `Ataque de babosa inválido en ${idxLabel}.` };
  }
  if (!isFiniteNum(rawSlug.def) || rawSlug.def < 0) {
    return { ok: false, error: `Defensa de babosa inválida en ${idxLabel}.` };
  }
  if (!isFiniteNum(rawSlug.spd) || rawSlug.spd <= 0) {
    return { ok: false, error: `Velocidad de babosa inválida en ${idxLabel}.` };
  }
  if (!isFiniteNum(rawSlug.bond) || rawSlug.bond < 0 || rawSlug.bond > 100) {
    return { ok: false, error: `Amistad de babosa inválida en ${idxLabel}.` };
  }
  if (rawSlug.mega !== undefined && typeof rawSlug.mega !== 'boolean') {
    return { ok: false, error: `Estado Megamorph inválido en ${idxLabel}.` };
  }
  if (rawSlug.isBred !== undefined && typeof rawSlug.isBred !== 'boolean') {
    return { ok: false, error: `Marca de crianza inválida en ${idxLabel}.` };
  }
  if (rawSlug.bonusTrait !== undefined && (typeof rawSlug.bonusTrait !== 'string' || rawSlug.bonusTrait.trim().length === 0)) {
    return { ok: false, error: `Rasgo de babosa inválido en ${idxLabel}.` };
  }

  let validNickname: string | undefined;
  if (rawSlug.nickname !== undefined) {
    if (typeof rawSlug.nickname !== 'string') {
      return { ok: false, error: `Apodo inválido en ${idxLabel}.` };
    }
    const cleanRaw = rawSlug.nickname.replace(/\s+/g, ' ').trim();
    if (cleanRaw.length > MAX_SLUG_NICKNAME_LENGTH) {
      return {
        ok: false,
        error: `El apodo de babosa en ${idxLabel} supera ${MAX_SLUG_NICKNAME_LENGTH} caracteres.`,
      };
    }
    validNickname = normalizeSlugNickname(cleanRaw);
  }

  let validPersonality: SlugPersonality = getDeterministicPersonality(rawSlug.uid);
  if (rawSlug.personality !== undefined) {
    if (typeof rawSlug.personality !== 'string' || !VALID_PERSONALITIES.has(rawSlug.personality as SlugPersonality)) {
      return { ok: false, error: `Personalidad de babosa inválida en ${idxLabel}.` };
    }
    validPersonality = rawSlug.personality as SlugPersonality;
  }

  let validMoveMastery: [number, number] = [0, 0];
  if (rawSlug.moveMastery !== undefined) {
    if (
      !Array.isArray(rawSlug.moveMastery) ||
      rawSlug.moveMastery.length !== 2 ||
      !isFiniteNum(rawSlug.moveMastery[0]) ||
      !isFiniteNum(rawSlug.moveMastery[1]) ||
      rawSlug.moveMastery[0] < 0 ||
      rawSlug.moveMastery[0] > MAX_MOVE_MASTERY ||
      rawSlug.moveMastery[1] < 0 ||
      rawSlug.moveMastery[1] > MAX_MOVE_MASTERY
    ) {
      return { ok: false, error: `Maestría de técnicas inválida en ${idxLabel}.` };
    }
    validMoveMastery = [Math.round(rawSlug.moveMastery[0]), Math.round(rawSlug.moveMastery[1])];
  }

  const sp = getSpecies(rawSlug.id);
  return {
    ok: true,
    value: {
      uid: rawSlug.uid,
      id: sp.id,
      name: rawSlug.name,
      ...(validNickname ? { nickname: validNickname } : {}),
      personality: validPersonality,
      type: sp.type,
      rarity: sp.rarity,
      icon: typeof rawSlug.icon === 'string' && rawSlug.icon.length > 0 ? rawSlug.icon : sp.icon,
      level: Math.floor(rawSlug.level),
      xp: rawSlug.xp,
      hp: rawSlug.hp,
      maxHp: rawSlug.maxHp,
      energy: rawSlug.energy,
      maxEnergy: rawSlug.maxEnergy,
      atk: rawSlug.atk,
      def: rawSlug.def,
      spd: rawSlug.spd,
      bond: rawSlug.bond,
      mega: Boolean(rawSlug.mega),
      isBred: rawSlug.isBred,
      bonusTrait: typeof rawSlug.bonusTrait === 'string' ? rawSlug.bonusTrait : undefined,
      moveMastery: validMoveMastery,
    },
  };
}

export function validateV4State(raw: unknown): ValidationResult<GameState> {
  if (!isPlainObject(raw)) {
    return { ok: false, error: 'La partida no es un objeto JSON válido.' };
  }
  if (raw.version !== '4.0') {
    return { ok: false, error: 'Versión de partida incompatible.' };
  }

  const base = createInitialGameState();

  if (raw.worldSeed !== undefined && !isFiniteNum(raw.worldSeed)) {
    return { ok: false, error: 'Semilla del mundo inválida.' };
  }
  if (raw.worldWidth !== undefined && (!isFiniteNum(raw.worldWidth) || raw.worldWidth !== WORLD_W)) {
    return { ok: false, error: 'Ancho del mundo incompatible.' };
  }
  if (raw.worldHeight !== undefined && (!isFiniteNum(raw.worldHeight) || raw.worldHeight !== WORLD_H)) {
    return { ok: false, error: 'Alto del mundo incompatible.' };
  }

  // Player validation
  if (!isPlainObject(raw.player)) {
    return { ok: false, error: 'Datos del jugador ausentes o inválidos.' };
  }
  const p = raw.player;
  if (!isFiniteNum(p.x) || p.x < 0 || p.x >= WORLD_W) {
    return { ok: false, error: 'Coordenada X del jugador fuera de los límites del mundo.' };
  }
  if (!isFiniteNum(p.y) || p.y < 0 || p.y >= WORLD_H) {
    return { ok: false, error: 'Coordenada Y del jugador fuera de los límites del mundo.' };
  }
  if (p.facingX !== undefined && (!isFiniteNum(p.facingX) || p.facingX < -1 || p.facingX > 1)) {
    return { ok: false, error: 'Dirección X del jugador inválida.' };
  }
  if (p.facingY !== undefined && (!isFiniteNum(p.facingY) || p.facingY < -1 || p.facingY > 1)) {
    return { ok: false, error: 'Dirección Y del jugador inválida.' };
  }
  if (!isFiniteNum(p.maxHp) || p.maxHp <= 0 || p.maxHp > 1_000_000) {
    return { ok: false, error: 'Salud máxima del jugador inválida.' };
  }
  if (!isFiniteNum(p.hp) || p.hp < 0 || p.hp > p.maxHp) {
    return { ok: false, error: 'Salud del jugador inválida o fuera de rango.' };
  }
  const maxStamina = p.maxStamina !== undefined ? p.maxStamina : base.player.maxStamina;
  if (!isFiniteNum(maxStamina) || maxStamina <= 0 || maxStamina > 1_000_000) {
    return { ok: false, error: 'Energía máxima del jugador inválida.' };
  }
  const stamina = p.stamina !== undefined ? p.stamina : maxStamina;
  if (!isFiniteNum(stamina) || stamina < 0 || stamina > maxStamina) {
    return { ok: false, error: 'Energía del jugador fuera de rango.' };
  }
  if (p.level !== undefined && (!isFiniteNum(p.level) || p.level < 1 || p.level > 10000)) {
    return { ok: false, error: 'Nivel del jugador inválido.' };
  }
  if (p.xp !== undefined && (!isFiniteNum(p.xp) || p.xp < 0)) {
    return { ok: false, error: 'Experiencia del jugador inválida.' };
  }
  if (p.perks !== undefined) {
    if (!Array.isArray(p.perks) || !p.perks.every((pk) => typeof pk === 'string' && pk.length > 0)) {
      return { ok: false, error: 'Lista de habilidades del jugador inválida.' };
    }
  }

  // Party & storage validation
  if (!Array.isArray(raw.party) || raw.party.length === 0 || raw.party.length > 4) {
    return { ok: false, error: 'El equipo activo de babosas debe tener entre 1 y 4 integrantes.' };
  }
  if (raw.storage !== undefined && (!Array.isArray(raw.storage) || raw.storage.length > 500)) {
    return { ok: false, error: 'El almacén de babosas tiene un formato inválido.' };
  }

  const seenSlugUids = new Set<string>();
  const validParty: SlugInstance[] = [];
  for (let i = 0; i < raw.party.length; i++) {
    const res = validateSlug(raw.party[i], seenSlugUids, `equipo[${i}]`);
    if (!res.ok || !res.value) return { ok: false, error: res.error };
    validParty.push(res.value);
  }

  const validStorage: SlugInstance[] = [];
  if (Array.isArray(raw.storage)) {
    for (let i = 0; i < raw.storage.length; i++) {
      const res = validateSlug(raw.storage[i], seenSlugUids, `refugio[${i}]`);
      if (!res.ok || !res.value) return { ok: false, error: res.error };
      validStorage.push(res.value);
    }
  }

  const activePartyIndex = raw.activePartyIndex !== undefined ? raw.activePartyIndex : 0;
  if (!isNonNegInt(activePartyIndex) || activePartyIndex >= validParty.length) {
    return { ok: false, error: 'Índice de babosa activa fuera de rango.' };
  }

  // Inventory validation
  const mergedInv = { ...base.inventory };
  if (raw.inventory !== undefined) {
    if (!isPlainObject(raw.inventory)) {
      return { ok: false, error: 'Inventario inválido.' };
    }
    for (const [k, val] of Object.entries(raw.inventory)) {
      if (!VALID_INVENTORY_KEYS.has(k)) {
        return { ok: false, error: `Clave de inventario desconocida: ${k}.` };
      }
      if (!isNonNegInt(val) || val > 1_000_000) {
        return { ok: false, error: `Cantidad inválida en inventario (${k}).` };
      }
      mergedInv[k as InventoryKey] = val;
    }
  }

  // Stats validation
  const mergedStats = { ...base.stats };
  if (raw.stats !== undefined) {
    if (!isPlainObject(raw.stats)) {
      return { ok: false, error: 'Estadísticas inválidas.' };
    }
    for (const [k, val] of Object.entries(raw.stats)) {
      if (!VALID_STAT_KEYS.has(k)) {
        return { ok: false, error: `Estadística desconocida: ${k}.` };
      }
      if (!isFiniteNum(val) || val < 0) {
        return { ok: false, error: `Valor negativo o no finito en estadística (${k}).` };
      }
      mergedStats[k as keyof GameState['stats']] = val;
    }
  }

  // Selected hotbar (migrate legacy 8-slot V4 saves to 3-slot RPG utility bar) & shelterTier & playTimeSec
  const rawHotbar = raw.selectedHotbar !== undefined ? raw.selectedHotbar : 0;
  if (!isNonNegInt(rawHotbar) || rawHotbar > 12) {
    return { ok: false, error: 'Ranura de barra rápida inválida.' };
  }
  const selectedHotbar =
    rawHotbar < HOTBAR_SLOTS.length
      ? rawHotbar
      : rawHotbar === 6
      ? Math.min(1, HOTBAR_SLOTS.length - 1)
      : rawHotbar === 5
      ? Math.min(2, HOTBAR_SLOTS.length - 1)
      : 0;

  const shelterTier = raw.shelterTier !== undefined ? raw.shelterTier : 1;
  if (!isNonNegInt(shelterTier) || shelterTier < 1 || shelterTier > 3) {
    return { ok: false, error: 'Nivel de refugio inválido.' };
  }

  const playTimeSec = raw.playTimeSec !== undefined ? raw.playTimeSec : 0;
  if (!isFiniteNum(playTimeSec) || playTimeSec < 0) {
    return { ok: false, error: 'Tiempo de juego inválido.' };
  }

  // Eggs validation
  const validEggs: BreedingEgg[] = [];
  const seenEggIds = new Set<string>();
  if (raw.eggs !== undefined) {
    if (!Array.isArray(raw.eggs) || raw.eggs.length > 20) {
      return { ok: false, error: 'Estructura de huevos inválida.' };
    }
    for (let i = 0; i < raw.eggs.length; i++) {
      const eg = raw.eggs[i];
      if (!isPlainObject(eg)) {
        return { ok: false, error: `Huevo inválido en índice ${i}.` };
      }
      if (typeof eg.id !== 'string' || eg.id.trim().length === 0) {
        return { ok: false, error: `ID de huevo inválido en índice ${i}.` };
      }
      if (seenEggIds.has(eg.id)) {
        return { ok: false, error: `ID de huevo duplicado: ${eg.id}.` };
      }
      seenEggIds.add(eg.id);
      if (typeof eg.speciesId !== 'string' || !VALID_SPECIES_IDS.has(eg.speciesId)) {
        return { ok: false, error: `Especie de huevo inválida en índice ${i}.` };
      }
      if (
        typeof eg.parentAName !== 'string' ||
        typeof eg.parentBName !== 'string' ||
        typeof eg.bonusTrait !== 'string'
      ) {
        return { ok: false, error: `Metadatos de huevo inválidos en índice ${i}.` };
      }
      if (!isFiniteNum(eg.totalSteps) || eg.totalSteps <= 0) {
        return { ok: false, error: `Pasos totales de huevo inválidos en índice ${i}.` };
      }
      if (!isFiniteNum(eg.stepsRemaining) || eg.stepsRemaining < 0 || eg.stepsRemaining > eg.totalSteps) {
        return { ok: false, error: `Pasos restantes de huevo fuera de rango en índice ${i}.` };
      }
      validEggs.push({
        id: eg.id,
        parentAName: eg.parentAName,
        parentBName: eg.parentBName,
        speciesId: eg.speciesId,
        stepsRemaining: eg.stepsRemaining,
        totalSteps: eg.totalSteps,
        bonusTrait: eg.bonusTrait,
      });
    }
  }

  // tilesDelta validation
  const validTilesDelta: Record<string, number> = {};
  if (raw.tilesDelta !== undefined) {
    if (!isPlainObject(raw.tilesDelta)) {
      return { ok: false, error: 'Modificaciones de bloques (tilesDelta) inválidas.' };
    }
    const entries = Object.entries(raw.tilesDelta);
    if (entries.length > 105_000) {
      return { ok: false, error: 'Demasiadas modificaciones de bloques en la partida.' };
    }
    for (const [k, val] of entries) {
      if (!/^\d+,\d+$/.test(k)) {
        return { ok: false, error: `Coordenada de bloque inválida: ${k}.` };
      }
      const [sx, sy] = k.split(',');
      const tx = Number(sx);
      const ty = Number(sy);
      if (tx < 0 || tx >= WORLD_W || ty < 0 || ty >= WORLD_H) {
        return { ok: false, error: `Bloque modificado fuera del mundo: ${k}.` };
      }
      if (!isNonNegInt(val) || val > MAX_TILE_ID) {
        return { ok: false, error: `Tipo de bloque inválido en ${k}.` };
      }
      validTilesDelta[k] = val;
    }
  }

  // exploredChunks validation
  const validExplored: Record<string, number> = {};
  if (raw.exploredChunks !== undefined) {
    if (!isPlainObject(raw.exploredChunks)) {
      return { ok: false, error: 'Registro de sectores explorados inválido.' };
    }
    for (const [k, val] of Object.entries(raw.exploredChunks)) {
      if (!/^\d+,\d+$/.test(k)) {
        return { ok: false, error: `Clave de sector explorado inválida: ${k}.` };
      }
      const [scx, scy] = k.split(',');
      const cx = Number(scx);
      const cy = Number(scy);
      if (cx < 0 || cx >= MAX_CHUNK_X || cy < 0 || cy >= MAX_CHUNK_Y) {
        return { ok: false, error: `Sector explorado fuera de rango: ${k}.` };
      }
      if (!isFiniteNum(val) || val < 0) {
        return { ok: false, error: `Valor de sector explorado inválido en ${k}.` };
      }
      validExplored[k] = val;
    }
  } else {
    validExplored['10,10'] = 1;
  }

  // discoveries validation
  let validDiscoveries: BiomeId[] = ['Verdes'];
  if (raw.discoveries !== undefined) {
    if (!Array.isArray(raw.discoveries)) {
      return { ok: false, error: 'Lista de biomas descubiertos inválida.' };
    }
    const seenDisc = new Set<BiomeId>();
    for (const d of raw.discoveries) {
      if (typeof d !== 'string' || !VALID_BIOMES.has(d as BiomeId)) {
        return { ok: false, error: `Bioma desconocido en descubrimientos: ${String(d)}.` };
      }
      if (seenDisc.has(d as BiomeId)) {
        return { ok: false, error: `Bioma duplicado en descubrimientos: ${d}.` };
      }
      seenDisc.add(d as BiomeId);
    }
    validDiscoveries = raw.discoveries.length > 0 ? (raw.discoveries as BiomeId[]) : ['Verdes'];
  }

  // claimedQuests validation
  const validClaimedQuests: string[] = [];
  if (raw.claimedQuests !== undefined) {
    if (!Array.isArray(raw.claimedQuests)) {
      return { ok: false, error: 'Lista de misiones reclamadas inválida.' };
    }
    const seenQuests = new Set<string>();
    for (const qId of raw.claimedQuests) {
      if (typeof qId !== 'string' || !VALID_QUEST_IDS.has(qId)) {
        return { ok: false, error: `ID de misión inválido: ${String(qId)}.` };
      }
      if (seenQuests.has(qId)) {
        return { ok: false, error: `ID de misión duplicado: ${qId}.` };
      }
      seenQuests.add(qId);
      validClaimedQuests.push(qId);
    }
  }

  // defeatedBosses validation
  const validDefeatedBosses: string[] = [];
  if (raw.defeatedBosses !== undefined) {
    if (!Array.isArray(raw.defeatedBosses)) {
      return { ok: false, error: 'Lista de jefes derrotados inválida.' };
    }
    const seenBosses = new Set<string>();
    for (const bId of raw.defeatedBosses) {
      if (typeof bId !== 'string' || !VALID_BOSS_IDS.has(bId)) {
        return { ok: false, error: `ID de jefe inválido: ${String(bId)}.` };
      }
      if (seenBosses.has(bId)) {
        return { ok: false, error: `ID de jefe duplicado: ${bId}.` };
      }
      seenBosses.add(bId);
      validDefeatedBosses.push(bId);
    }
  }

  // seenSpecies & capturedSpecies
  const validSeen: Record<string, boolean> = { ...base.seenSpecies };
  if (raw.seenSpecies !== undefined) {
    if (!isPlainObject(raw.seenSpecies)) {
      return { ok: false, error: 'Registro de especies vistas inválido.' };
    }
    for (const [k, val] of Object.entries(raw.seenSpecies)) {
      if (!VALID_SPECIES_IDS.has(k) || typeof val !== 'boolean') {
        return { ok: false, error: `Entrada inválida en especies vistas (${k}).` };
      }
      validSeen[k] = val;
    }
  }

  const validCaptured: Record<string, number> = { ...base.capturedSpecies };
  if (raw.capturedSpecies !== undefined) {
    if (!isPlainObject(raw.capturedSpecies)) {
      return { ok: false, error: 'Registro de especies capturadas inválido.' };
    }
    for (const [k, val] of Object.entries(raw.capturedSpecies)) {
      if (!VALID_SPECIES_IDS.has(k) || !isNonNegInt(val)) {
        return { ok: false, error: `Entrada inválida en especies capturadas (${k}).` };
      }
      validCaptured[k] = val;
    }
  }

  // Options validation
  const validOptions = { ...base.options };
  if (raw.options !== undefined) {
    if (!isPlainObject(raw.options)) {
      return { ok: false, error: 'Opciones de configuración inválidas.' };
    }
    const o = raw.options;
    if (o.soundEnabled !== undefined) {
      if (typeof o.soundEnabled !== 'boolean') return { ok: false, error: 'Opción de sonido inválida.' };
      validOptions.soundEnabled = o.soundEnabled;
    }
    if (o.volume !== undefined) {
      if (!isFiniteNum(o.volume) || o.volume < 0 || o.volume > 1) {
        return { ok: false, error: 'Volumen fuera de rango (0..1).' };
      }
      validOptions.volume = o.volume;
    }
    if (o.touchControls !== undefined) {
      if (o.touchControls !== 'auto' && o.touchControls !== 'on' && o.touchControls !== 'off') {
        return { ok: false, error: 'Modo de controles táctiles inválido.' };
      }
      validOptions.touchControls = o.touchControls;
    }
    if (o.lightingQuality !== undefined) {
      if (o.lightingQuality !== 'high' && o.lightingQuality !== 'eco') {
        return { ok: false, error: 'Calidad de iluminación inválida.' };
      }
      validOptions.lightingQuality = o.lightingQuality;
    }
    if (o.showMinimap !== undefined) {
      if (typeof o.showMinimap !== 'boolean') return { ok: false, error: 'Opción de minimapa inválida.' };
      validOptions.showMinimap = o.showMinimap;
    }
    if (o.reducedMotion !== undefined) {
      if (typeof o.reducedMotion !== 'boolean') {
        return { ok: false, error: 'Opción de movimiento reducido inválida.' };
      }
      validOptions.reducedMotion = o.reducedMotion;
    }
  }

  // saveMeta validation
  let validSaveMeta: SaveMetadata | undefined;
  if (raw.saveMeta !== undefined) {
    if (!isPlainObject(raw.saveMeta)) {
      return { ok: false, error: 'Metadatos de guardado inválidos.' };
    }
    if (!isFiniteNum(raw.saveMeta.revision) || raw.saveMeta.revision < 0) {
      return { ok: false, error: 'Revisión de guardado inválida.' };
    }
    if (!isFiniteNum(raw.saveMeta.savedAt) || raw.saveMeta.savedAt < 0) {
      return { ok: false, error: 'Fecha de guardado inválida.' };
    }
    validSaveMeta = {
      revision: Math.floor(raw.saveMeta.revision),
      savedAt: raw.saveMeta.savedAt,
    };
  }

  // home validation (backward compatible if raw.home is undefined in pre-FASE-3 V4 saves)
  let validHome: HomeState = createDefaultHomeState();
  if (raw.home !== undefined) {
    if (!isPlainObject(raw.home)) {
      return { ok: false, error: 'Datos del hogar inválidos.' };
    }
    const rawLastTick = raw.home.lastNeedsTickSec !== undefined ? raw.home.lastNeedsTickSec : 0;
    if (!isFiniteNum(rawLastTick) || rawLastTick < 0) {
      return { ok: false, error: 'Temporizador de necesidades del hogar inválido.' };
    }

    const validResidents: HomeSlugEntry[] = [];
    const habitatCounts = new Map<HabitatId, number>();
    if (raw.home.residents !== undefined) {
      if (!Array.isArray(raw.home.residents) || raw.home.residents.length > MAX_ACTIVE_HOME_SLUGS) {
        return { ok: false, error: 'Lista de residentes del hogar inválida o excede el límite.' };
      }
      for (let i = 0; i < raw.home.residents.length; i++) {
        const resRaw = raw.home.residents[i];
        if (!isPlainObject(resRaw)) {
          return { ok: false, error: `Residente del hogar inválido en índice ${i}.` };
        }
        const slugRes = validateSlug(resRaw.slug, seenSlugUids, `hogar[${i}]`);
        if (!slugRes.ok || !slugRes.value) {
          return { ok: false, error: slugRes.error };
        }
        if (typeof resRaw.habitatId !== 'string' || !VALID_HABITAT_IDS.has(resRaw.habitatId as HabitatId)) {
          return { ok: false, error: `Hábitat inválido en hogar[${i}].` };
        }
        const habitatId = resRaw.habitatId as HabitatId;
        if (!isSpeciesCompatibleWithHabitat(slugRes.value.id, habitatId)) {
          return { ok: false, error: `Especie incompatible con el hábitat en hogar[${i}].` };
        }
        const curHabCount = habitatCounts.get(habitatId) || 0;
        if (curHabCount >= MAX_SLUGS_PER_HABITAT) {
          return { ok: false, error: `El hábitat ${habitatId} excede el límite de ${MAX_SLUGS_PER_HABITAT} babosas.` };
        }
        habitatCounts.set(habitatId, curHabCount + 1);

        if (!isFiniteNum(resRaw.x) || resRaw.x < 0 || resRaw.x >= WORLD_W || !isFiniteNum(resRaw.y) || resRaw.y < 0 || resRaw.y >= WORLD_H) {
          return { ok: false, error: `Posición de residente fuera de rango en hogar[${i}].` };
        }
        if (!isInShelterZone(resRaw.x, resRaw.y)) {
          return { ok: false, error: `Residente fuera de la zona del refugio en hogar[${i}].` };
        }
        const targetX = resRaw.targetX !== undefined ? resRaw.targetX : resRaw.x;
        const targetY = resRaw.targetY !== undefined ? resRaw.targetY : resRaw.y;
        if (!isFiniteNum(targetX) || targetX < 0 || targetX >= WORLD_W || !isFiniteNum(targetY) || targetY < 0 || targetY >= WORLD_H) {
          return { ok: false, error: `Destino de residente inválido en hogar[${i}].` };
        }
        if (!isInShelterZone(targetX, targetY)) {
          return { ok: false, error: `Destino de residente fuera de la zona del refugio en hogar[${i}].` };
        }
        const behavior = resRaw.behavior !== undefined ? resRaw.behavior : 'pasear';
        if (typeof behavior !== 'string' || !VALID_HOME_BEHAVIORS.has(behavior as HomeBehavior)) {
          return { ok: false, error: `Comportamiento inválido en hogar[${i}].` };
        }
        const behaviorTimer = resRaw.behaviorTimer !== undefined ? resRaw.behaviorTimer : 2;
        if (!isFiniteNum(behaviorTimer) || behaviorTimer < 0) {
          return { ok: false, error: `Temporizador de comportamiento inválido en hogar[${i}].` };
        }
        const mood = resRaw.mood !== undefined ? resRaw.mood : 'tranquila';
        if (typeof mood !== 'string' || !VALID_HOME_MOODS.has(mood as HomeMood)) {
          return { ok: false, error: `Estado de ánimo inválido en hogar[${i}].` };
        }
        for (const [nKey, nVal] of [
          ['hunger', resRaw.hunger],
          ['energy', resRaw.energy],
          ['happiness', resRaw.happiness],
        ] as const) {
          if (!isFiniteNum(nVal) || nVal < 0 || nVal > 100) {
            return { ok: false, error: `Valor ${nKey} inválido en hogar[${i}].` };
          }
        }
        const lastPetAt = resRaw.lastPetAt !== undefined ? resRaw.lastPetAt : -100;
        const lastPlayAt = resRaw.lastPlayAt !== undefined ? resRaw.lastPlayAt : -100;
        const lastFeedAt = resRaw.lastFeedAt !== undefined ? resRaw.lastFeedAt : -100;
        if (!isFiniteNum(lastPetAt) || !isFiniteNum(lastPlayAt) || !isFiniteNum(lastFeedAt)) {
          return { ok: false, error: `Marcas de interacción inválidas en hogar[${i}].` };
        }

        validResidents.push({
          slug: slugRes.value,
          habitatId,
          x: resRaw.x,
          y: resRaw.y,
          targetX,
          targetY,
          behavior: behavior as HomeBehavior,
          behaviorTimer,
          mood: mood as HomeMood,
          hunger: resRaw.hunger as number,
          energy: resRaw.energy as number,
          happiness: resRaw.happiness as number,
          lastPetAt,
          lastPlayAt,
          lastFeedAt,
        });
      }
    }

    const validFurniture: HomeFurniture[] = [];
    const seenFurnIds = new Set<string>();
    const seenFurnCoords = new Set<string>();
    if (raw.home.furniture !== undefined) {
      if (!Array.isArray(raw.home.furniture) || raw.home.furniture.length > MAX_HOME_FURNITURE) {
        return { ok: false, error: 'Lista de mobiliario del hogar inválida o excede el límite.' };
      }
      for (let i = 0; i < raw.home.furniture.length; i++) {
        const fRaw = raw.home.furniture[i];
        if (!isPlainObject(fRaw)) {
          return { ok: false, error: `Mueble inválido en índice ${i}.` };
        }
        if (typeof fRaw.id !== 'string' || fRaw.id.trim().length === 0) {
          return { ok: false, error: `ID de mueble inválido en índice ${i}.` };
        }
        if (seenFurnIds.has(fRaw.id)) {
          return { ok: false, error: `ID de mueble duplicado: ${fRaw.id}.` };
        }
        seenFurnIds.add(fRaw.id);
        if (typeof fRaw.kind !== 'string' || !VALID_FURNITURE_KINDS.has(fRaw.kind as FurnitureKind)) {
          return { ok: false, error: `Tipo de mueble desconocido en índice ${i}.` };
        }
        if (!isNonNegInt(fRaw.x) || fRaw.x >= WORLD_W || !isNonNegInt(fRaw.y) || fRaw.y >= WORLD_H) {
          return { ok: false, error: `Coordenadas de mueble inválidas en índice ${i}.` };
        }
        if (!isInShelterZone(fRaw.x, fRaw.y)) {
          return { ok: false, error: `Mobiliario fuera de la zona del refugio en índice ${i}.` };
        }
        const coordKey = `${fRaw.x},${fRaw.y}`;
        if (seenFurnCoords.has(coordKey)) {
          return { ok: false, error: `Posición de mobiliario duplicada en ${coordKey}.` };
        }
        seenFurnCoords.add(coordKey);
        validFurniture.push({
          id: fRaw.id,
          kind: fRaw.kind as FurnitureKind,
          x: fRaw.x,
          y: fRaw.y,
        });
      }
    }

    validHome = {
      residents: validResidents,
      furniture: validFurniture,
      lastNeedsTickSec: rawLastTick,
    };
  }

  // discoveredPOIs validation (backward-compatible default [])
  const validDiscoveredPOIs: DiscoveredPOI[] = [];
  if (raw.discoveredPOIs !== undefined) {
    if (!Array.isArray(raw.discoveredPOIs) || raw.discoveredPOIs.length > 400) {
      return { ok: false, error: 'Lista de lugares descubiertos inválida.' };
    }
    const seenPoiIds = new Set<string>();
    for (let i = 0; i < raw.discoveredPOIs.length; i++) {
      const poiRaw = raw.discoveredPOIs[i];
      if (!isPlainObject(poiRaw)) {
        return { ok: false, error: `Lugar descubierto inválido en índice ${i}.` };
      }
      if (typeof poiRaw.id !== 'string' || poiRaw.id.trim().length === 0) {
        return { ok: false, error: `ID de lugar descubierto inválido en índice ${i}.` };
      }
      if (seenPoiIds.has(poiRaw.id)) {
        return { ok: false, error: `ID de lugar descubierto duplicado: ${poiRaw.id}.` };
      }
      seenPoiIds.add(poiRaw.id);
      if (typeof poiRaw.name !== 'string' || poiRaw.name.trim().length === 0) {
        return { ok: false, error: `Nombre de lugar descubierto inválido en índice ${i}.` };
      }
      if (typeof poiRaw.kind !== 'string' || !VALID_POI_KINDS.has(poiRaw.kind as POIKind)) {
        return { ok: false, error: `Tipo de lugar descubierto desconocido en índice ${i}.` };
      }
      if (typeof poiRaw.biome !== 'string' || !VALID_BIOMES.has(poiRaw.biome as BiomeId)) {
        return { ok: false, error: `Bioma de lugar descubierto inválido en índice ${i}.` };
      }
      if (!isFiniteNum(poiRaw.x) || poiRaw.x < 0 || poiRaw.x >= WORLD_W || !isFiniteNum(poiRaw.y) || poiRaw.y < 0 || poiRaw.y >= WORLD_H) {
        return { ok: false, error: `Coordenadas de lugar descubierto fuera de rango en índice ${i}.` };
      }
      validDiscoveredPOIs.push({
        id: poiRaw.id,
        name: poiRaw.name,
        kind: poiRaw.kind as POIKind,
        biome: poiRaw.biome as BiomeId,
        x: poiRaw.x,
        y: poiRaw.y,
      });
    }
  }

  // clearedChallenges validation (backward-compatible default [])
  const validClearedChallenges: string[] = [];
  if (raw.clearedChallenges !== undefined) {
    if (!Array.isArray(raw.clearedChallenges) || raw.clearedChallenges.length > 400) {
      return { ok: false, error: 'Lista de desafíos completados inválida.' };
    }
    const seenChal = new Set<string>();
    for (const cId of raw.clearedChallenges) {
      if (typeof cId !== 'string' || cId.trim().length === 0) {
        return { ok: false, error: `ID de desafío inválido: ${String(cId)}.` };
      }
      if (seenChal.has(cId)) {
        return { ok: false, error: `ID de desafío duplicado: ${cId}.` };
      }
      seenChal.add(cId);
      validClearedChallenges.push(cId);
    }
  }

  // RPG extensions validation (backward compatible with older V4 saves)
  let validCavernTokens = base.cavernTokens ?? 4;
  if (raw.cavernTokens !== undefined) {
    if (!isNonNegInt(raw.cavernTokens) || raw.cavernTokens > 1_000_000) {
      return { ok: false, error: 'Cantidad de Fichas de Caverna inválida.' };
    }
    validCavernTokens = raw.cavernTokens;
  }

  let validMecha: MechaState = createDefaultMechaState();
  if (raw.mecha !== undefined) {
    if (!isPlainObject(raw.mecha)) {
      return { ok: false, error: 'Estado del Meca inválido.' };
    }
    const rm = raw.mecha;
    if (rm.unlocked !== undefined && typeof rm.unlocked !== 'boolean') {
      return { ok: false, error: 'Propiedad mecha.unlocked inválida.' };
    }
    if (rm.active !== undefined && typeof rm.active !== 'boolean') {
      return { ok: false, error: 'Propiedad mecha.active inválida.' };
    }
    const tier = rm.tier !== undefined ? rm.tier : 1;
    if (!isNonNegInt(tier) || tier < 1 || tier > 3) {
      return { ok: false, error: 'Nivel de Meca inválido (1..3).' };
    }
    const theme = rm.theme !== undefined ? rm.theme : 'shane_blue';
    if (typeof theme !== 'string' || !VALID_MECHA_THEMES.has(theme as MechaTheme)) {
      return { ok: false, error: 'Tema visual de Meca inválido.' };
    }
    const unlockedThemes: MechaTheme[] = [];
    if (rm.unlockedThemes !== undefined) {
      if (!Array.isArray(rm.unlockedThemes) || rm.unlockedThemes.length > 20) {
        return { ok: false, error: 'Lista de temas de Meca inválida.' };
      }
      const seenT = new Set<MechaTheme>();
      for (const th of rm.unlockedThemes) {
        if (typeof th !== 'string' || !VALID_MECHA_THEMES.has(th as MechaTheme)) {
          return { ok: false, error: `Tema de Meca desconocido: ${String(th)}.` };
        }
        if (!seenT.has(th as MechaTheme)) {
          seenT.add(th as MechaTheme);
          unlockedThemes.push(th as MechaTheme);
        }
      }
    } else {
      unlockedThemes.push('shane_blue');
    }
    if (!unlockedThemes.includes(theme as MechaTheme)) {
      unlockedThemes.push(theme as MechaTheme);
    }
    const upgrades: string[] = [];
    if (rm.upgrades !== undefined) {
      if (!Array.isArray(rm.upgrades) || !rm.upgrades.every((u) => typeof u === 'string' && u.trim().length > 0)) {
        return { ok: false, error: 'Mejoras de Meca inválidas.' };
      }
      upgrades.push(...Array.from(new Set(rm.upgrades as string[])));
    }
    const mechaName =
      typeof rm.name === 'string' && rm.name.trim().length > 0 ? rm.name.trim() : 'Meca Shane M1';
    validMecha = {
      unlocked: Boolean(rm.unlocked),
      active: Boolean(rm.unlocked && rm.active),
      name: mechaName,
      tier: tier as 1 | 2 | 3,
      theme: theme as MechaTheme,
      unlockedThemes,
      upgrades,
    };
  }

  const validTrainingRecords: Record<string, TrainingRecord> = {};
  if (raw.trainingRecords !== undefined) {
    if (!isPlainObject(raw.trainingRecords)) {
      return { ok: false, error: 'Registros de entrenamiento inválidos.' };
    }
    for (const [k, rec] of Object.entries(raw.trainingRecords)) {
      if (!isPlainObject(rec)) {
        return { ok: false, error: `Registro de entrenamiento inválido (${k}).` };
      }
      if (!isFiniteNum(rec.bestScore) || rec.bestScore < 0) {
        return { ok: false, error: `Puntuación de entrenamiento inválida (${k}).` };
      }
      if (typeof rec.bestRank !== 'string' || !VALID_TRAINING_RANKS.has(rec.bestRank as TrainingRecord['bestRank'])) {
        return { ok: false, error: `Rango de entrenamiento inválido (${k}).` };
      }
      if (!isNonNegInt(rec.completions)) {
        return { ok: false, error: `Contador de entrenamiento inválido (${k}).` };
      }
      validTrainingRecords[k] = {
        bestScore: rec.bestScore,
        bestRank: rec.bestRank as TrainingRecord['bestRank'],
        completions: rec.completions,
      };
    }
  }

  const validRaceRecords: Record<string, RaceRecord> = {};
  if (raw.raceRecords !== undefined) {
    if (!isPlainObject(raw.raceRecords)) {
      return { ok: false, error: 'Registros de carreras inválidos.' };
    }
    for (const [k, rec] of Object.entries(raw.raceRecords)) {
      if (!isPlainObject(rec)) {
        return { ok: false, error: `Registro de carrera inválido (${k}).` };
      }
      if (!isFiniteNum(rec.bestTimeSec) || rec.bestTimeSec < 0 || !isNonNegInt(rec.wins)) {
        return { ok: false, error: `Datos de carrera inválidos (${k}).` };
      }
      if (rec.cleared !== undefined && typeof rec.cleared !== 'boolean') {
        return { ok: false, error: `Estado cleared de carrera inválido (${k}).` };
      }
      validRaceRecords[k] = {
        bestTimeSec: rec.bestTimeSec,
        cleared: rec.cleared !== undefined ? rec.cleared : rec.wins > 0,
        wins: rec.wins,
      };
    }
  }

  const validateOptionalIdArray = (val: unknown, label: string, fallback: string[] = []): ValidationResult<string[]> => {
    if (val === undefined) return { ok: true, value: [...fallback] };
    if (!Array.isArray(val) || val.length > 500) {
      return { ok: false, error: `Lista inválida en ${label}.` };
    }
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of val) {
      if (typeof item !== 'string' || item.trim().length === 0) {
        return { ok: false, error: `Entrada inválida en ${label}.` };
      }
      if (!seen.has(item)) {
        seen.add(item);
        out.push(item);
      }
    }
    return { ok: true, value: out };
  };

  const tournRes = validateOptionalIdArray(raw.clearedTournaments, 'clearedTournaments');
  if (!tournRes.ok || !tournRes.value) return { ok: false, error: tournRes.error };
  const journalRes = validateOptionalIdArray(raw.journalEntries, 'journalEntries', ['j_cap1_descenso']);
  if (!journalRes.ok || !journalRes.value) return { ok: false, error: journalRes.error };
  const dlgRes = validateOptionalIdArray(raw.completedDialogues, 'completedDialogues');
  if (!dlgRes.ok || !dlgRes.value) return { ok: false, error: dlgRes.error };
  const secRes = validateOptionalIdArray(raw.discoveredSecrets, 'discoveredSecrets');
  if (!secRes.ok || !secRes.value) return { ok: false, error: secRes.error };

  const assembledBaseState: GameState = {
    version: '4.0',
    ...(validSaveMeta ? { saveMeta: validSaveMeta } : {}),
    worldSeed: raw.worldSeed !== undefined ? (raw.worldSeed as number) : base.worldSeed,
    worldWidth: WORLD_W,
    worldHeight: WORLD_H,
    player: {
      x: p.x,
      y: p.y,
      facingX: p.facingX !== undefined ? (p.facingX as number) : 0,
      facingY: p.facingY !== undefined ? (p.facingY as number) : 1,
      hp: p.hp,
      maxHp: p.maxHp,
      stamina,
      maxStamina,
      level: p.level !== undefined ? Math.floor(p.level as number) : base.player.level,
      xp: p.xp !== undefined ? (p.xp as number) : base.player.xp,
      perks: Array.isArray(p.perks) ? [...(p.perks as string[])] : [],
    },
    party: validParty,
    storage: validStorage,
    activePartyIndex,
    inventory: mergedInv,
    selectedHotbar,
    tilesDelta: validTilesDelta,
    exploredChunks: validExplored,
    discoveries: validDiscoveries,
    discoveredPOIs: validDiscoveredPOIs,
    clearedChallenges: validClearedChallenges,
    seenSpecies: validSeen,
    capturedSpecies: validCaptured,
    eggs: validEggs,
    shelterTier,
    home: validHome,
    stats: mergedStats,
    defeatedBosses: validDefeatedBosses,
    claimedQuests: validClaimedQuests,
    cavernTokens: validCavernTokens,
    mecha: validMecha,
    trainingRecords: validTrainingRecords,
    clearedTournaments: tournRes.value,
    raceRecords: validRaceRecords,
    journalEntries: journalRes.value,
    completedDialogues: dlgRes.value,
    discoveredSecrets: secRes.value,
    playTimeSec,
    options: validOptions,
  };

  let validStory: StoryProgressState;
  if (raw.story === undefined) {
    // Pre-Phase-12 V4 save: reconstruct deterministic narrative state without breaking legacy progress
    validStory = migrateLegacyProgressToStory(assembledBaseState);
  } else {
    if (!isPlainObject(raw.story)) {
      return { ok: false, error: 'Datos de progreso narrativo (story) inválidos.' };
    }
    const rs = raw.story;
    if (rs.schemaVersion !== undefined && rs.schemaVersion !== 1) {
      return { ok: false, error: 'Versión de esquema narrativo incompatible.' };
    }
    const rawCurrentChapterId =
      typeof rs.currentChapterId === 'string'
        ? LEGACY_CHAPTER_ID_MAP[rs.currentChapterId] || rs.currentChapterId
        : rs.currentChapterId;
    if (typeof rawCurrentChapterId !== 'string' || !VALID_CHAPTER_IDS.has(rawCurrentChapterId)) {
      return { ok: false, error: 'Capítulo actual inválido en progreso narrativo.' };
    }
    if (typeof rs.currentScenarioId !== 'string' || !VALID_SCENARIO_IDS.has(rs.currentScenarioId)) {
      return { ok: false, error: 'Escenario actual inválido en progreso narrativo.' };
    }
    if (!isPlainObject(rs.chapterStates)) {
      return { ok: false, error: 'Estados de capítulos inválidos.' };
    }
    const validChapterStates: Record<string, StoryChapterStatus> = {};
    for (const [cId, cStat] of Object.entries(rs.chapterStates)) {
      const mappedChId = LEGACY_CHAPTER_ID_MAP[cId] || cId;
      if (!VALID_CHAPTER_IDS.has(mappedChId)) {
        return { ok: false, error: `Capítulo desconocido en guardado: ${cId}.` };
      }
      if (typeof cStat !== 'string' || !VALID_CHAPTER_STATUSES.has(cStat as StoryChapterStatus)) {
        return { ok: false, error: `Estado inválido para capítulo ${cId}.` };
      }
      validChapterStates[mappedChId] = cStat as StoryChapterStatus;
    }

    if (!isPlainObject(rs.missionStates)) {
      return { ok: false, error: 'Estados de misiones narrativas inválidos.' };
    }
    const validMissionStates: Record<string, StoryMissionLifecycleState> = {};
    for (const [mId, mStat] of Object.entries(rs.missionStates)) {
      const mappedMissionId = LEGACY_MISSION_ID_MAP[mId] || mId;
      if (!VALID_STORY_MISSION_IDS.has(mappedMissionId)) {
        return { ok: false, error: `Misión narrativa desconocida en guardado: ${mId}.` };
      }
      if (typeof mStat !== 'string' || !VALID_MISSION_STATUSES.has(mStat as StoryMissionLifecycleState)) {
        return { ok: false, error: `Estado inválido para misión narrativa ${mId}.` };
      }
      validMissionStates[mappedMissionId] = mStat as StoryMissionLifecycleState;
    }

    const validateStringIdList = (
      val: unknown,
      label: string,
      allowedSet: Set<string> | null,
      legacyMap?: Record<string, string>
    ): ValidationResult<string[]> => {
      if (val === undefined) return { ok: true, value: [] };
      if (!Array.isArray(val) || val.length > 500) {
        return { ok: false, error: `Lista inválida en story.${label}.` };
      }
      const seen = new Set<string>();
      const out: string[] = [];
      for (const item of val) {
        if (typeof item !== 'string' || item.trim().length === 0) {
          return { ok: false, error: `Entrada inválida en story.${label}.` };
        }
        const mapped = legacyMap?.[item] || item;
        if (allowedSet && !allowedSet.has(mapped)) {
          return { ok: false, error: `ID desconocido en story.${label}: ${item}.` };
        }
        if (seen.has(mapped)) {
          return { ok: false, error: `ID duplicado en story.${label}: ${item}.` };
        }
        seen.add(mapped);
        out.push(mapped);
      }
      return { ok: true, value: out };
    };

    const uScenRes = validateStringIdList(rs.unlockedScenarioIds, 'unlockedScenarioIds', VALID_SCENARIO_IDS);
    if (!uScenRes.ok || !uScenRes.value) return { ok: false, error: uScenRes.error };
    const vScenRes = validateStringIdList(rs.visitedScenarioIds, 'visitedScenarioIds', VALID_SCENARIO_IDS);
    if (!vScenRes.ok || !vScenRes.value) return { ok: false, error: vScenRes.error };
    const uRouteRes = validateStringIdList(rs.unlockedRouteIds, 'unlockedRouteIds', VALID_ROUTE_IDS);
    if (!uRouteRes.ok || !uRouteRes.value) return { ok: false, error: uRouteRes.error };
    const evRes = validateStringIdList(rs.completedEvents, 'completedEvents', null);
    if (!evRes.ok || !evRes.value) return { ok: false, error: evRes.error };
    const cChRes = validateStringIdList(
      rs.claimedChapterRewards,
      'claimedChapterRewards',
      VALID_CHAPTER_IDS,
      LEGACY_CHAPTER_ID_MAP
    );
    if (!cChRes.ok || !cChRes.value) return { ok: false, error: cChRes.error };
    const cMisRes = validateStringIdList(
      rs.claimedMissionRewards,
      'claimedMissionRewards',
      VALID_STORY_MISSION_IDS,
      LEGACY_MISSION_ID_MAP
    );
    if (!cMisRes.ok || !cMisRes.value) return { ok: false, error: cMisRes.error };

    const validFlags: Record<string, boolean> = {};
    if (rs.storyFlags !== undefined) {
      if (!isPlainObject(rs.storyFlags)) {
        return { ok: false, error: 'Banderas narrativas (storyFlags) inválidas.' };
      }
      for (const [fk, fv] of Object.entries(rs.storyFlags)) {
        if (fk.trim().length === 0 || typeof fv !== 'boolean') {
          return { ok: false, error: `Bandera narrativa inválida (${fk}).` };
        }
        validFlags[fk] = fv;
      }
    }

    const validScenarioPositions: Record<string, { x: number; y: number }> = {};
    if (rs.scenarioPositions !== undefined) {
      if (!isPlainObject(rs.scenarioPositions)) {
        return { ok: false, error: 'Posiciones de escenarios (scenarioPositions) inválidas.' };
      }
      for (const [scId, pos] of Object.entries(rs.scenarioPositions)) {
        if (!VALID_SCENARIO_IDS.has(scId) || !isPlainObject(pos)) {
          return { ok: false, error: `Posición de escenario inválida (${scId}).` };
        }
        if (
          !isFiniteNum(pos.x) ||
          !isFiniteNum(pos.y) ||
          pos.x < 0 ||
          pos.x >= WORLD_W ||
          pos.y < 0 ||
          pos.y >= WORLD_H
        ) {
          return { ok: false, error: `Coordenadas de escenario fuera de rango (${scId}).` };
        }
        validScenarioPositions[scId] = { x: pos.x, y: pos.y };
      }
    }

    validStory = normalizeLegacyStorySchema({
      schemaVersion: 1,
      currentChapterId: rawCurrentChapterId,
      currentScenarioId: rs.currentScenarioId,
      chapterStates: validChapterStates,
      missionStates: validMissionStates,
      unlockedScenarioIds: uScenRes.value,
      visitedScenarioIds: vScenRes.value,
      unlockedRouteIds: uRouteRes.value,
      completedEvents: evRes.value,
      storyFlags: validFlags,
      claimedChapterRewards: cChRes.value,
      claimedMissionRewards: cMisRes.value,
      scenarioPositions: validScenarioPositions,
    });
  }

  assembledBaseState.story = validStory;

  return {
    ok: true,
    value: assembledBaseState,
  };
}

export function normalizeV4State(raw: Partial<GameState>): GameState {
  const res = validateV4State(raw);
  if (!res.ok || !res.value) {
    throw new Error(res.error || 'Partida 4.0 inválida.');
  }
  return res.value;
}

interface LegacyV3Slug {
  uid?: string;
  id: string;
  name?: string;
  level?: number;
  xp?: number;
  hp?: number;
  maxHp?: number;
  atk?: number;
  spd?: number;
  friend?: number;
  pp?: number;
  maxPp?: number;
  mega?: boolean;
}

export interface LegacyV3State {
  player?: { x?: number; y?: number; hp?: number; maxHp?: number; level?: number; xp?: number };
  party?: LegacyV3Slug[];
  pets?: LegacyV3Slug[];
  active?: number;
  inventory?: { ore?: number; berries?: number; capsules?: number; wood?: number; stone?: number; core?: number };
  tiles?: Record<string, number>;
  worldSeed?: number;
  won?: number;
  discoveries?: string[];
  quest?: { ore?: number; wins?: number; biomes?: number };
}

export function validateAndMigrateV3(raw: unknown): ValidationResult<GameState> {
  if (!isPlainObject(raw)) {
    return { ok: false, error: 'La partida 3.0 no es un objeto válido.' };
  }
  if (!isPlainObject(raw.player)) {
    return { ok: false, error: 'Datos del jugador 3.0 ausentes o inválidos.' };
  }
  if (!Array.isArray(raw.party) || raw.party.length === 0 || raw.party.length > 50) {
    return { ok: false, error: 'El equipo 3.0 de babosas debe tener al menos 1 integrante.' };
  }
  if (!isPlainObject(raw.tiles)) {
    return { ok: false, error: 'Mapa de tiles 3.0 inválido.' };
  }

  const v3 = raw as LegacyV3State;
  const p = raw.player;

  if (p.x !== undefined && (!isFiniteNum(p.x) || p.x < 0 || p.x > WORLD_W)) {
    return { ok: false, error: 'Coordenada X 3.0 fuera de rango.' };
  }
  if (p.y !== undefined && (!isFiniteNum(p.y) || p.y < 0 || p.y > WORLD_H)) {
    return { ok: false, error: 'Coordenada Y 3.0 fuera de rango.' };
  }
  if (p.maxHp !== undefined && (!isFiniteNum(p.maxHp) || p.maxHp <= 0 || p.maxHp > 1_000_000)) {
    return { ok: false, error: 'Salud máxima del jugador 3.0 inválida.' };
  }
  if (p.hp !== undefined) {
    const maxHpRef = p.maxHp !== undefined ? (p.maxHp as number) : 100;
    if (!isFiniteNum(p.hp) || p.hp < 0 || p.hp > maxHpRef) {
      return { ok: false, error: 'Salud del jugador 3.0 inválida.' };
    }
  }
  if (p.level !== undefined && (!isFiniteNum(p.level) || p.level < 1 || p.level > 10000)) {
    return { ok: false, error: 'Nivel del jugador 3.0 inválido.' };
  }
  if (p.xp !== undefined && (!isFiniteNum(p.xp) || p.xp < 0)) {
    return { ok: false, error: 'EXP del jugador 3.0 inválida.' };
  }

  if (raw.worldSeed !== undefined && !isFiniteNum(raw.worldSeed)) {
    return { ok: false, error: 'Semilla 3.0 inválida.' };
  }
  if (raw.won !== undefined && (!isFiniteNum(raw.won) || raw.won < 0)) {
    return { ok: false, error: 'Contador de victorias 3.0 inválido.' };
  }
  if (raw.active !== undefined && (!isNonNegInt(raw.active) || raw.active >= raw.party.length)) {
    return { ok: false, error: 'Índice activo 3.0 fuera de rango.' };
  }
  if (raw.pets !== undefined && (!Array.isArray(raw.pets) || raw.pets.length > 200)) {
    return { ok: false, error: 'Lista de mascotas 3.0 inválida.' };
  }

  // Validate V3 slugs & check optional uid duplicates
  const seenV3Uids = new Set<string>();
  const validateV3Slug = (s: unknown, label: string): ValidationResult<LegacyV3Slug> => {
    if (!isPlainObject(s)) return { ok: false, error: `Babosa 3.0 inválida en ${label}.` };
    if (s.uid !== undefined) {
      if (typeof s.uid !== 'string' || s.uid.trim().length === 0) {
        return { ok: false, error: `UID inválido en ${label}.` };
      }
      if (seenV3Uids.has(s.uid)) {
        return { ok: false, error: `UID duplicado en partida 3.0: ${s.uid}.` };
      }
      seenV3Uids.add(s.uid);
    }
    if (typeof s.id !== 'string' || !VALID_SPECIES_IDS.has(s.id)) {
      return { ok: false, error: `Especie 3.0 desconocida en ${label}.` };
    }
    if (s.level !== undefined && (!isFiniteNum(s.level) || s.level < 1)) {
      return { ok: false, error: `Nivel 3.0 inválido en ${label}.` };
    }
    if (s.xp !== undefined && (!isFiniteNum(s.xp) || s.xp < 0)) {
      return { ok: false, error: `EXP 3.0 inválida en ${label}.` };
    }
    if (s.maxHp !== undefined && (!isFiniteNum(s.maxHp) || s.maxHp <= 0)) {
      return { ok: false, error: `Salud máxima 3.0 inválida en ${label}.` };
    }
    if (s.hp !== undefined) {
      const m = s.maxHp !== undefined ? (s.maxHp as number) : Infinity;
      if (!isFiniteNum(s.hp) || s.hp < 0 || s.hp > m) {
        return { ok: false, error: `Salud 3.0 inválida en ${label}.` };
      }
    }
    if (s.atk !== undefined && (!isFiniteNum(s.atk) || s.atk <= 0)) {
      return { ok: false, error: `Ataque 3.0 inválido en ${label}.` };
    }
    if (s.spd !== undefined && (!isFiniteNum(s.spd) || s.spd <= 0)) {
      return { ok: false, error: `Velocidad 3.0 inválida en ${label}.` };
    }
    if (s.friend !== undefined && (!isFiniteNum(s.friend) || s.friend < 0 || s.friend > 100)) {
      return { ok: false, error: `Amistad 3.0 inválida en ${label}.` };
    }
    return { ok: true, value: s as unknown as LegacyV3Slug };
  };

  for (let i = 0; i < raw.party.length; i++) {
    const r = validateV3Slug(raw.party[i], `party[${i}]`);
    if (!r.ok) return { ok: false, error: r.error };
  }
  if (Array.isArray(raw.pets)) {
    for (let i = 0; i < raw.pets.length; i++) {
      const r = validateV3Slug(raw.pets[i], `pets[${i}]`);
      if (!r.ok) return { ok: false, error: r.error };
    }
  }

  if (raw.inventory !== undefined) {
    if (!isPlainObject(raw.inventory)) {
      return { ok: false, error: 'Inventario 3.0 inválido.' };
    }
    for (const [k, val] of Object.entries(raw.inventory)) {
      if (!isNonNegInt(val) || val > 1_000_000) {
        return { ok: false, error: `Cantidad 3.0 inválida en inventario (${k}).` };
      }
    }
  }

  if (raw.quest !== undefined) {
    if (!isPlainObject(raw.quest)) {
      return { ok: false, error: 'Misiones 3.0 inválidas.' };
    }
    for (const key of ['ore', 'wins', 'biomes'] as const) {
      const qv = raw.quest[key];
      if (qv !== undefined && (!isFiniteNum(qv) || qv < 0)) {
        return { ok: false, error: `Progreso de misión 3.0 inválido (${key}).` };
      }
    }
  }

  if (raw.discoveries !== undefined) {
    if (!Array.isArray(raw.discoveries) || !raw.discoveries.every((d) => typeof d === 'string')) {
      return { ok: false, error: 'Descubrimientos 3.0 inválidos.' };
    }
  }

  const tileEntries = Object.entries(raw.tiles);
  if (tileEntries.length > 60_000) {
    return { ok: false, error: 'Demasiados tiles modificados en partida 3.0.' };
  }
  for (const [k, val] of tileEntries) {
    if (!/^-?\d+,-?\d+$/.test(k)) {
      return { ok: false, error: `Coordenada de tile 3.0 inválida: ${k}.` };
    }
    if (!isNonNegInt(val) || val > MAX_TILE_ID) {
      return { ok: false, error: `Valor de tile 3.0 inválido en ${k}.` };
    }
  }

  // Perform migration cleanly
  const next = createInitialGameState();
  const offsetX = SPAWN_X - 56;
  const offsetY = SPAWN_Y - 56;

  if (v3.worldSeed !== undefined) next.worldSeed = v3.worldSeed;

  if (v3.player) {
    next.player.x = Math.max(4, Math.min(WORLD_W - 5, (v3.player.x ?? 56) + offsetX));
    next.player.y = Math.max(4, Math.min(WORLD_H - 5, (v3.player.y ?? 56) + offsetY));
    next.player.maxHp = v3.player.maxHp ?? 100;
    next.player.hp = Math.min(next.player.maxHp, v3.player.hp ?? next.player.maxHp);
    next.player.level = Math.floor(v3.player.level ?? 1);
    next.player.xp = v3.player.xp ?? 0;
  }

  const assignedUids = new Set<string>();
  const convertSlug = (s: LegacyV3Slug): SlugInstance => {
    const rawLevel = Number.isFinite(s.level) ? Math.floor(s.level as number) : 1;
    const clampedLevel = Math.max(1, Math.min(MAX_SLUG_LEVEL, rawLevel));
    const inst = createSlugInstance(s.id || 'infurnus', clampedLevel);
    while (assignedUids.has(inst.uid)) {
      inst.uid = `${inst.id}_${Math.random().toString(36).slice(2, 9)}`;
    }
    assignedUids.add(inst.uid);
    inst.personality = getDeterministicPersonality(inst.uid);
    const sp = getSpecies(inst.id);
    const rawXp = Number.isFinite(s.xp) ? Math.max(0, Math.round(s.xp as number)) : 0;
    inst.xp =
      clampedLevel >= MAX_SLUG_LEVEL
        ? 0
        : Math.min(rawXp, Math.max(0, getXpForNextLevel(clampedLevel) - 1));
    inst.maxHp = Math.max(inst.maxHp, s.maxHp ?? inst.maxHp);
    inst.hp = Math.min(inst.maxHp, s.hp ?? inst.maxHp);
    inst.atk = Math.max(inst.atk, s.atk ?? inst.atk);
    inst.spd = Math.max(inst.spd, s.spd ?? inst.spd);
    inst.bond = Math.min(100, Math.max(0, s.friend ?? 25));
    inst.mega = !!s.mega;
    if (inst.mega) {
      inst.name = sp.evoName;
    }
    return inst;
  };

  if (Array.isArray(v3.party) && v3.party.length > 0) {
    next.party = v3.party.slice(0, 4).map(convertSlug);
    if (v3.party.length > 4) {
      next.storage.push(...v3.party.slice(4).map(convertSlug));
    }
  }
  if (Array.isArray(v3.pets)) {
    next.storage.push(...v3.pets.map(convertSlug));
  }
  next.activePartyIndex = Math.min(next.party.length - 1, Math.max(0, v3.active ?? 0));

  next.seenSpecies = {};
  next.capturedSpecies = {};
  for (const s of [...next.party, ...next.storage]) {
    next.seenSpecies[s.id] = true;
    next.capturedSpecies[s.id] = (next.capturedSpecies[s.id] || 0) + 1;
    if (s.mega) next.stats.megaUnlocked++;
  }

  if (v3.inventory) {
    next.inventory.ore = v3.inventory.ore ?? next.inventory.ore;
    next.inventory.berries = v3.inventory.berries ?? next.inventory.berries;
    next.inventory.capsules = v3.inventory.capsules ?? next.inventory.capsules;
    next.inventory.wood = v3.inventory.wood ?? next.inventory.wood;
    next.inventory.stone = v3.inventory.stone ?? next.inventory.stone;
    next.inventory.core = v3.inventory.core ?? next.inventory.core;
  }

  const biomeMap: Record<string, BiomeId> = {
    Pradera: 'Verdes',
    Magma: 'Magma',
    Hielo: 'Heladas',
    Sombra: 'Sombrias',
  };
  const disc = new Set<BiomeId>(['Verdes']);
  for (const d of v3.discoveries || []) {
    if (biomeMap[d]) disc.add(biomeMap[d]);
  }
  next.discoveries = Array.from(disc);

  next.stats.oreMined = v3.quest?.ore ?? 0;
  next.stats.wins = v3.won ?? v3.quest?.wins ?? 0;

  if (v3.tiles) {
    for (const [k, val] of Object.entries(v3.tiles)) {
      const [oxStr, oyStr] = k.split(',');
      const ox = Number(oxStr);
      const oy = Number(oyStr);
      if (Number.isNaN(ox) || Number.isNaN(oy)) continue;
      if (ox >= 51 && ox <= 61 && oy >= 51 && oy <= 61) continue;
      const nx = ox + offsetX;
      const ny = oy + offsetY;
      if (nx >= 3 && ny >= 3 && nx < WORLD_W - 3 && ny < WORLD_H - 3) {
        next.tilesDelta[`${nx},${ny}`] = val;
      }
    }
  }

  next.story = migrateLegacyProgressToStory(next);
  reconcileStoryProgress(next, { skipRewards: true });

  return { ok: true, value: next };
}

export function migrateV3ToV4(v3: LegacyV3State): GameState {
  const res = validateAndMigrateV3(v3);
  if (!res.ok || !res.value) {
    throw new Error(res.error || 'Partida 3.0 inválida.');
  }
  return res.value;
}

export function parseImportedJsonSaveDetailed(jsonText: string): ImportParseResult {
  if (typeof jsonText !== 'string') {
    return { ok: false, error: 'El archivo está vacío.' };
  }
  if (jsonText.length > MAX_IMPORT_BYTES) {
    return {
      ok: false,
      error: `El archivo supera el límite permitido (${Math.round(MAX_IMPORT_BYTES / (1024 * 1024))} MB).`,
    };
  }
  if (jsonText.trim().length === 0) {
    return { ok: false, error: 'El archivo está vacío.' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { ok: false, error: 'El archivo JSON está dañado o malformado.' };
  }
  if (!isPlainObject(parsed)) {
    return { ok: false, error: 'Formato de partida no reconocido.' };
  }

  if (parsed.version === '4.0') {
    const res = validateV4State(parsed);
    if (!res.ok || !res.value) {
      return { ok: false, error: res.error || 'Partida 4.0 inválida.' };
    }
    return { ok: true, kind: 'v4', state: res.value };
  }

  if (parsed.version !== undefined) {
    return { ok: false, error: `Versión de partida no soportada: ${String(parsed.version)}.` };
  }

  if (parsed.player && parsed.party && parsed.tiles) {
    const res = validateAndMigrateV3(parsed);
    if (!res.ok || !res.value) {
      return { ok: false, error: res.error || 'Partida 3.0 inválida.' };
    }
    return { ok: true, kind: 'v3', state: res.value };
  }

  return { ok: false, error: 'El archivo no contiene una partida válida de Bajoterra 3.0 o 4.0.' };
}

export function parseImportedJsonSave(jsonText: string): { kind: 'v4' | 'v3'; state: GameState } | null {
  const res = parseImportedJsonSaveDetailed(jsonText);
  if (!res.ok || !res.kind || !res.state) return null;
  return { kind: res.kind, state: res.state };
}

export async function checkStorageCapabilities(): Promise<StorageCapabilities> {
  const isFileProtocol = typeof window !== 'undefined' && window.location?.protocol === 'file:';
  const indexedDBAvailable = typeof indexedDB !== 'undefined';
  const localStorageAvailable = (() => {
    try {
      if (typeof localStorage === 'undefined') return false;
      const testKey = '__bt4_ls_probe__';
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  })();

  const storageObj = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  const storageApiAvailable = Boolean(storageObj);
  const estimateSupported = Boolean(storageObj && typeof storageObj.estimate === 'function');
  const persistedSupported = Boolean(storageObj && typeof storageObj.persisted === 'function');
  const persistSupported = Boolean(storageObj && typeof storageObj.persist === 'function');

  let persisted: boolean | null = null;
  let quotaBytes: number | null = null;
  let usageBytes: number | null = null;

  if (persistedSupported && storageObj) {
    try {
      persisted = await storageObj.persisted();
    } catch {
      persisted = null;
    }
  }

  if (estimateSupported && storageObj) {
    try {
      const est = await storageObj.estimate();
      quotaBytes = typeof est.quota === 'number' && Number.isFinite(est.quota) ? est.quota : null;
      usageBytes = typeof est.usage === 'number' && Number.isFinite(est.usage) ? est.usage : null;
    } catch {
      quotaBytes = null;
      usageBytes = null;
    }
  }

  return {
    indexedDBAvailable,
    localStorageAvailable,
    storageApiAvailable,
    estimateSupported,
    persistedSupported,
    persistSupported,
    persisted,
    quotaBytes,
    usageBytes,
    isFileProtocol,
  };
}

export async function requestPersistentStorageIfNeeded(): Promise<PersistRequestResult> {
  if (persistenceRequestedOnce && persistencePromise) {
    return persistencePromise;
  }
  persistenceRequestedOnce = true;

  persistencePromise = (async (): Promise<PersistRequestResult> => {
    const isFileProtocol = typeof window !== 'undefined' && window.location?.protocol === 'file:';
    const storageObj = typeof navigator !== 'undefined' ? navigator.storage : undefined;
    if (isFileProtocol || !storageObj) {
      return { supported: false, granted: null, alreadyPersisted: false };
    }

    let alreadyPersisted = false;
    if (typeof storageObj.persisted === 'function') {
      try {
        alreadyPersisted = await storageObj.persisted();
      } catch {
        alreadyPersisted = false;
      }
    }
    if (alreadyPersisted) {
      return { supported: true, granted: true, alreadyPersisted: true };
    }

    if (typeof storageObj.persist !== 'function') {
      return { supported: false, granted: null, alreadyPersisted: false };
    }

    try {
      const granted = await storageObj.persist();
      return { supported: true, granted: Boolean(granted), alreadyPersisted: false };
    } catch {
      return { supported: true, granted: false, alreadyPersisted: false };
    }
  })();

  return persistencePromise;
}
