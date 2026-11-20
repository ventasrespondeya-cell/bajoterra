import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Stub minimal DOM canvas before importing engine.ts
const canvasStub = () => ({
  width: 300,
  height: 200,
  parentElement: { getBoundingClientRect: () => ({ width: 800, height: 600 }) },
  getContext: () => ({
    fillRect: () => {},
    clearRect: () => {},
    drawImage: () => {},
    beginPath: () => {},
    arc: () => {},
    fill: () => {},
    stroke: () => {},
    createRadialGradient: () => ({ addColorStop: () => {} }),
    save: () => {},
    restore: () => {},
    translate: () => {},
    scale: () => {},
    setTransform: () => {},
    fillText: () => {},
    strokeRect: () => {},
    ellipse: () => {},
  }),
});

(globalThis as Record<string, unknown>).document = {
  createElement: canvasStub,
  visibilityState: 'visible',
};
if (typeof (globalThis as Record<string, unknown>).window === 'undefined') {
  (globalThis as Record<string, unknown>).window = {
    location: { protocol: 'http:' },
    devicePixelRatio: 1,
  };
}

class MockLocalStorage {
  private map = new Map<string, string>();
  public failGet = false;
  public failSetError: Error | null = null;

  getItem(key: string): string | null {
    if (this.failGet) throw new Error('SecurityError: localStorage blocked');
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, val: string): void {
    if (this.failSetError) throw this.failSetError;
    this.map.set(key, String(val));
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  clear(): void {
    this.map.clear();
  }
  setRaw(key: string, val: string): void {
    this.map.set(key, val);
  }
  getRaw(key: string): string | null {
    return this.map.get(key) ?? null;
  }
}

class MockIndexedDB {
  public dbs = new Map<string, Map<string, Map<string, string>>>();
  public failOpenError: Error | null = null;
  public failReadError: Error | null = null;
  public failWriteError: Error | null = null;
  public writeDelaysMs: number[] = [];

  private ensureStore(dbName: string, storeName = 'saves'): Map<string, string> {
    if (!this.dbs.has(dbName)) this.dbs.set(dbName, new Map());
    const db = this.dbs.get(dbName)!;
    if (!db.has(storeName)) db.set(storeName, new Map());
    return db.get(storeName)!;
  }

  setRaw(dbName: string, key: string, value: string): void {
    this.ensureStore(dbName).set(key, value);
  }

  getRaw(dbName: string, key: string): string | null {
    return this.ensureStore(dbName).get(key) ?? null;
  }

  open(dbName: string, _version?: number): unknown {
    const req: Record<string, unknown> = {
      result: null,
      error: null,
      onupgradeneeded: null,
      onsuccess: null,
      onerror: null,
      onblocked: null,
    };

    const delay = this.writeDelaysMs.length > 0 ? 0 : 1;
    setTimeout(() => {
      if (this.failOpenError) {
        req.error = this.failOpenError;
        if (typeof req.onerror === 'function') (req.onerror as () => void)();
        return;
      }

      if (!this.dbs.has(dbName)) {
        this.dbs.set(dbName, new Map());
      }
      const dbStores = this.dbs.get(dbName)!;

      const dbObj: Record<string, unknown> = {
        objectStoreNames: {
          contains: (name: string) => dbStores.has(name),
        },
        createObjectStore: (name: string) => {
          if (!dbStores.has(name)) dbStores.set(name, new Map());
        },
        close: () => {},
        onversionchange: null,
        transaction: (storeName: string, _mode: string) => {
          const store = this.ensureStore(dbName, storeName);
          const tx: Record<string, unknown> = {
            error: null,
            oncomplete: null,
            onerror: null,
            onabort: null,
            objectStore: () => ({
              get: (key: string) => {
                const getReq: Record<string, unknown> = {
                  result: undefined,
                  error: null,
                  onsuccess: null,
                  onerror: null,
                };
                setTimeout(() => {
                  if (this.failReadError) {
                    getReq.error = this.failReadError;
                    if (typeof getReq.onerror === 'function') (getReq.onerror as () => void)();
                    return;
                  }
                  getReq.result = store.get(key);
                  if (typeof getReq.onsuccess === 'function') (getReq.onsuccess as () => void)();
                }, 1);
                return getReq;
              },
              put: (val: string, key: string) => {
                const putReq: Record<string, unknown> = {
                  error: null,
                  onerror: null,
                };
                const d = this.writeDelaysMs.length > 0 ? this.writeDelaysMs.shift()! : 2;
                setTimeout(() => {
                  if (this.failWriteError) {
                    putReq.error = this.failWriteError;
                    tx.error = this.failWriteError;
                    if (typeof putReq.onerror === 'function') (putReq.onerror as () => void)();
                    if (typeof tx.onerror === 'function') (tx.onerror as () => void)();
                    return;
                  }
                  store.set(key, String(val));
                  if (typeof tx.oncomplete === 'function') (tx.oncomplete as () => void)();
                }, d);
                return putReq;
              },
            }),
          };
          return tx;
        },
      };

      req.result = dbObj;
      if (!dbStores.has('saves') && typeof req.onupgradeneeded === 'function') {
        (req.onupgradeneeded as () => void)();
      }
      if (typeof req.onsuccess === 'function') {
        (req.onsuccess as () => void)();
      }
    }, delay);

    return req;
  }
}

const mockLs = new MockLocalStorage();
const mockIdb = new MockIndexedDB();
(globalThis as Record<string, unknown>).localStorage = mockLs;
(globalThis as Record<string, unknown>).indexedDB = mockIdb;

const {
  V4_SAVE_KEY,
  V4_DB_NAME,
  V3_SAVE_KEY,
  MAX_IMPORT_BYTES,
  createInitialGameState,
  saveGameV4,
  loadGameV4,
  loadGameV4Detailed,
  parseImportedJsonSave,
  parseImportedJsonSaveDetailed,
  normalizeV4State,
  migrateV3ToV4,
  checkStorageCapabilities,
  requestPersistentStorageIfNeeded,
  resetSaveRuntimeForTests,
} = await import('../src/game/save.ts');
const { CombatManager } = await import('../src/game/combat.ts');
const { QUEST_LIST, SPAWN_X, SPAWN_Y, createSlugInstance, getSpecies } = await import('../src/game/data.ts');
const { gameEngine } = await import('../src/game/engine.ts');
const {
  canHomeSlugWalk,
  tickHomeNeeds,
  updateHomeResidents,
  validateShelterRooms,
} = await import('../src/game/home.ts');
const {
  MAX_SLUG_LEVEL,
  awardSlugExperience,
  checkMegamorphEligibility,
  getBondTierInfo,
  getEffectiveMoveEnergyCost,
  getMoveMasteryInfo,
  grantMoveMastery,
  grantSlugBond,
} = await import('../src/game/progression.ts');
const { TileType } = await import('../src/game/types.ts');

beforeEach(() => {
  mockLs.clear();
  mockLs.failGet = false;
  mockLs.failSetError = null;
  mockIdb.dbs.clear();
  mockIdb.failOpenError = null;
  mockIdb.failReadError = null;
  mockIdb.failWriteError = null;
  mockIdb.writeDelaysMs = [];
  (globalThis as Record<string, unknown>).localStorage = mockLs;
  (globalThis as Record<string, unknown>).indexedDB = mockIdb;
  (globalThis as Record<string, unknown>).window = {
    location: { protocol: 'http:' },
    devicePixelRatio: 1,
  };
  Object.defineProperty(globalThis, 'navigator', {
    value: undefined,
    configurable: true,
    writable: true,
  });
  resetSaveRuntimeForTests();
});

describe('Bajoterra 4.0 — FASE 2: Protección Integral de Partidas', () => {
  test('A. Guardado normal en IndexedDB', async () => {
    const state = createInitialGameState();
    state.inventory.ore = 42;
    const res = await saveGameV4(state, { reason: 'manual' });
    assert.equal(res.ok, true);
    assert.equal(res.indexedDB.ok, true);
    assert.equal(res.storedIn, 'both');
    const rawIdb = mockIdb.getRaw(V4_DB_NAME, V4_SAVE_KEY);
    assert.ok(rawIdb && rawIdb.includes('"ore":42'));
  });

  test('B. Guardado normal en localStorage', async () => {
    const state = createInitialGameState();
    state.inventory.crystal = 19;
    const res = await saveGameV4(state, { reason: 'manual' });
    assert.equal(res.ok, true);
    assert.equal(res.localStorage.ok, true);
    const rawLs = mockLs.getRaw(V4_SAVE_KEY);
    assert.ok(rawLs && rawLs.includes('"crystal":19'));
  });

  test('C. Fallo de IndexedDB con recuperación desde localStorage', async () => {
    const state = createInitialGameState();
    state.inventory.ore = 77;
    mockIdb.failWriteError = Object.assign(new Error('Quota exceeded'), { name: 'QuotaExceededError' });

    const saveRes = await saveGameV4(state, { reason: 'manual' });
    assert.equal(saveRes.ok, true);
    assert.equal(saveRes.storedIn, 'localstorage');
    assert.equal(saveRes.indexedDB.ok, false);
    assert.equal(saveRes.localStorage.ok, true);

    mockIdb.failOpenError = new Error('IDB unavailable');
    const loadRes = await loadGameV4Detailed({ syncStores: false });
    assert.ok(loadRes.state);
    assert.equal(loadRes.source, 'localstorage');
    assert.equal(loadRes.state.inventory.ore, 77);
  });

  test('D. Fallo de localStorage con recuperación desde IndexedDB', async () => {
    const state = createInitialGameState();
    state.inventory.wood = 55;
    mockLs.failSetError = Object.assign(new Error('LS quota'), { name: 'QuotaExceededError' });

    const saveRes = await saveGameV4(state, { reason: 'manual' });
    assert.equal(saveRes.ok, true);
    assert.equal(saveRes.storedIn, 'indexeddb');
    assert.equal(saveRes.localStorage.ok, false);
    assert.equal(saveRes.indexedDB.ok, true);

    mockLs.failGet = true;
    const loadRes = await loadGameV4Detailed({ syncStores: false });
    assert.ok(loadRes.state);
    assert.equal(loadRes.source, 'indexeddb');
    assert.equal(loadRes.state.inventory.wood, 55);
  });

  test('E. Dos copias diferentes: recuperar siempre la más reciente y sincronizar', async () => {
    const older = createInitialGameState();
    older.inventory.ore = 5;
    older.saveMeta = { revision: 2, savedAt: 1000 };

    const newer = createInitialGameState();
    newer.inventory.ore = 88;
    newer.saveMeta = { revision: 5, savedAt: 5000 };

    // Case 1: IndexedDB stale, localStorage newer (fixes old bug rawIdb || rawLs)
    mockIdb.setRaw(V4_DB_NAME, V4_SAVE_KEY, JSON.stringify(older));
    mockLs.setRaw(V4_SAVE_KEY, JSON.stringify(newer));

    const res1 = await loadGameV4Detailed({ syncStores: true });
    assert.ok(res1.state);
    assert.equal(res1.source, 'localstorage');
    assert.equal(res1.state.inventory.ore, 88);
    assert.equal(res1.syncedStores, true);
    const syncedIdb = JSON.parse(mockIdb.getRaw(V4_DB_NAME, V4_SAVE_KEY)!);
    assert.equal(syncedIdb.inventory.ore, 88);

    // Case 2: IndexedDB newer, localStorage stale (without metadata legacy fallback)
    const legacyOlder = createInitialGameState();
    delete legacyOlder.saveMeta;
    legacyOlder.playTimeSec = 10;
    legacyOlder.inventory.ore = 12;

    const legacyNewer = createInitialGameState();
    delete legacyNewer.saveMeta;
    legacyNewer.playTimeSec = 240;
    legacyNewer.inventory.ore = 64;

    mockIdb.setRaw(V4_DB_NAME, V4_SAVE_KEY, JSON.stringify(legacyNewer));
    mockLs.setRaw(V4_SAVE_KEY, JSON.stringify(legacyOlder));
    const res2 = await loadGameV4Detailed({ syncStores: true });
    assert.ok(res2.state);
    assert.equal(res2.source, 'indexeddb');
    assert.equal(res2.state.inventory.ore, 64);
    const syncedLs = JSON.parse(mockLs.getRaw(V4_SAVE_KEY)!);
    assert.equal(syncedLs.inventory.ore, 64);
  });

  test('F. Dos guardados consecutivos: escritura antigua no reemplaza una nueva y autoguardado no se acumula', async () => {
    const state = createInitialGameState();
    state.inventory.ore = 10;
    mockIdb.writeDelaysMs = [45, 5]; // First IDB write is much slower than second

    const p1 = saveGameV4(state, { reason: 'manual' });
    state.inventory.ore = 99;
    const p2 = saveGameV4(state, { reason: 'manual' });

    // Coalesced autosave while queue is busy must be skipped without queuing
    const pAuto = saveGameV4(state, { reason: 'autosave' });

    const [r1, r2, rAuto] = await Promise.all([p1, p2, pAuto]);
    assert.equal(r1.ok, true);
    assert.equal(r2.ok, true);
    assert.ok(r2.revision > r1.revision);
    assert.equal(rAuto.skipped, true);

    const idbFinal = JSON.parse(mockIdb.getRaw(V4_DB_NAME, V4_SAVE_KEY)!);
    const lsFinal = JSON.parse(mockLs.getRaw(V4_SAVE_KEY)!);
    assert.equal(idbFinal.inventory.ore, 99);
    assert.equal(lsFinal.inventory.ore, 99);
    assert.equal(idbFinal.saveMeta.revision, r2.revision);
    assert.equal(lsFinal.saveMeta.revision, r2.revision);
  });

  test('G. Ambas ubicaciones fallan: reportar error y no anunciar éxito', async () => {
    const state = createInitialGameState();
    mockIdb.failWriteError = new Error('IDB disk full');
    mockLs.failSetError = new Error('LS disk full');

    const res = await saveGameV4(state, { reason: 'manual' });
    assert.equal(res.ok, false);
    assert.equal(res.storedIn, 'none');

    gameEngine.startNewGame();
    const engRes = await gameEngine.manualSave();
    assert.equal(engRes.ok, false);
    assert.equal(engRes.storedIn, 'none');
    const toast = gameEngine.getSnapshot().toast;
    assert.ok(toast.includes('Error al guardar'), `Unexpected toast: ${toast}`);
  });

  test('H. Importación de una partida válida 4.0 (incluyendo 4.0 sin metadatos)', async () => {
    const v4 = createInitialGameState();
    delete v4.saveMeta;
    v4.player.x = 182.5;
    v4.player.y = 144.25;
    v4.inventory.relics = 7;

    const parsed = parseImportedJsonSaveDetailed(JSON.stringify(v4));
    assert.equal(parsed.ok, true);
    assert.equal(parsed.kind, 'v4');
    assert.equal(parsed.state?.inventory.relics, 7);

    const legacyImport = parseImportedJsonSave(JSON.stringify(v4));
    assert.ok(legacyImport);
    assert.equal(legacyImport.kind, 'v4');
  });

  test('I. Importación de una partida válida 3.0 sin destruir el guardado 3.0 original', async () => {
    const v3Save = {
      player: { x: 64, y: 72, hp: 90, maxHp: 110, level: 4, xp: 20 },
      party: [
        { id: 'infurnus', name: 'Infurnus', level: 3, xp: 10, hp: 50, maxHp: 63, atk: 18, spd: 12, friend: 45, mega: false },
        { id: 'flaringo', name: 'Flaringo', level: 2, xp: 0, hp: 40, maxHp: 63, atk: 18, spd: 13, friend: 30, mega: true },
      ],
      pets: [{ id: 'enigmo', level: 2, hp: 58, maxHp: 58, atk: 20, spd: 14, friend: 60 }],
      active: 1,
      inventory: { ore: 14, berries: 5, capsules: 6, wood: 9, stone: 12 },
      tiles: { '70,70': 10, '71,70': 12 },
      worldSeed: 91234,
      won: 11,
      discoveries: ['Pradera', 'Magma'],
      quest: { ore: 18, wins: 11, biomes: 2 },
    };

    const rawV3 = JSON.stringify(v3Save);
    mockLs.setRaw(V3_SAVE_KEY, rawV3);
    const parsed = parseImportedJsonSaveDetailed(rawV3);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.kind, 'v3');
    assert.ok(parsed.state);
    assert.equal(parsed.state.worldSeed, 91234);
    assert.equal(parsed.state.party.length, 2);
    assert.equal(parsed.state.storage.length, 1);
    assert.equal(parsed.state.activePartyIndex, 1);
    assert.equal(parsed.state.party[1].mega, true);
    assert.ok(parsed.state.discoveries.includes('Magma'));
    assert.equal(parsed.state.stats.wins, 11);
    // V3 storage key remains untouched
    assert.equal(mockLs.getRaw(V3_SAVE_KEY), rawV3);

    // Also test direct migrateV3ToV4 compatibility
    const direct = migrateV3ToV4(v3Save);
    assert.equal(direct.version, '4.0');
  });

  test('J. Rechazo de JSON corrupto, vacío, versión errónea y tamaño excesivo', () => {
    assert.equal(parseImportedJsonSaveDetailed('').ok, false);
    assert.equal(parseImportedJsonSaveDetailed('{corrupt json').ok, false);
    assert.equal(parseImportedJsonSaveDetailed('[]').ok, false);
    assert.equal(parseImportedJsonSaveDetailed(JSON.stringify({ version: '99.0' })).ok, false);

    const oversized = ' '.repeat(MAX_IMPORT_BYTES + 10);
    const bigRes = parseImportedJsonSaveDetailed(oversized);
    assert.equal(bigRes.ok, false);
    assert.ok(bigRes.error?.includes('límite'));
  });

  test('K. Rechazo de inventarios, estadísticas, coordenadas, huevos y opciones inválidas', () => {
    const makeBase = () => createInitialGameState();

    // Negative inventory
    const badInv = makeBase();
    badInv.inventory.ore = -5;
    assert.equal(parseImportedJsonSaveDetailed(JSON.stringify(badInv)).ok, false);

    // Float / NaN / unknown key in inventory
    const floatInv = makeBase() as unknown as Record<string, unknown>;
    (floatInv.inventory as Record<string, unknown>).ore = 2.5;
    assert.equal(parseImportedJsonSaveDetailed(JSON.stringify(floatInv)).ok, false);

    const nanInv = makeBase() as unknown as Record<string, unknown>;
    (nanInv.inventory as Record<string, unknown>).ore = 'NaN';
    assert.equal(parseImportedJsonSaveDetailed(JSON.stringify(nanInv)).ok, false);

    // Negative stats
    const badStats = makeBase();
    badStats.stats.wins = -1;
    assert.equal(parseImportedJsonSaveDetailed(JSON.stringify(badStats)).ok, false);

    // Impossible player HP & out-of-bounds coords
    const badHp = makeBase();
    badHp.player.hp = 9999;
    assert.equal(parseImportedJsonSaveDetailed(JSON.stringify(badHp)).ok, false);

    const badPos = makeBase();
    badPos.player.x = 999;
    assert.equal(parseImportedJsonSaveDetailed(JSON.stringify(badPos)).ok, false);

    // Out-of-bounds activePartyIndex
    const badIdx = makeBase();
    badIdx.activePartyIndex = 3; // party has 3 items -> max valid 2
    assert.equal(parseImportedJsonSaveDetailed(JSON.stringify(badIdx)).ok, false);

    // Invalid egg steps
    const badEgg = makeBase();
    badEgg.eggs = [
      {
        id: 'egg_1',
        parentAName: 'A',
        parentBName: 'B',
        speciesId: 'infurnus',
        stepsRemaining: 100,
        totalSteps: 40,
        bonusTrait: 'Vitalidad +',
      },
    ];
    assert.equal(parseImportedJsonSaveDetailed(JSON.stringify(badEgg)).ok, false);

    // Invalid tile delta coordinate & type
    const badTile = makeBase();
    badTile.tilesDelta = { '999,10': 5 };
    assert.equal(parseImportedJsonSaveDetailed(JSON.stringify(badTile)).ok, false);

    // Invalid option
    const badOpt = makeBase();
    badOpt.options.volume = 2.5;
    assert.equal(parseImportedJsonSaveDetailed(JSON.stringify(badOpt)).ok, false);

    // normalizeV4State also rejects corrupted inputs
    assert.throws(() => normalizeV4State({ version: '4.0', player: { x: -10, y: 10 } as never }));
  });

  test('L. Rechazo de identificadores únicos duplicados', () => {
    const dupSlug = createInitialGameState();
    dupSlug.storage = [{ ...dupSlug.party[0] }]; // duplicate uid across party and storage
    const rSlug = parseImportedJsonSaveDetailed(JSON.stringify(dupSlug));
    assert.equal(rSlug.ok, false);
    assert.ok(rSlug.error?.toLowerCase().includes('duplicado'));

    const dupEgg = createInitialGameState();
    dupEgg.eggs = [
      {
        id: 'egg_dup',
        parentAName: 'A',
        parentBName: 'B',
        speciesId: 'infurnus',
        stepsRemaining: 10,
        totalSteps: 40,
        bonusTrait: 'Vitalidad +',
      },
      {
        id: 'egg_dup',
        parentAName: 'A',
        parentBName: 'B',
        speciesId: 'aquabeak',
        stepsRemaining: 20,
        totalSteps: 40,
        bonusTrait: 'Potencia +',
      },
    ];
    const rEgg = parseImportedJsonSaveDetailed(JSON.stringify(dupEgg));
    assert.equal(rEgg.ok, false);
    assert.ok(rEgg.error?.toLowerCase().includes('duplicado'));

    const dupQuest = createInitialGameState();
    dupQuest.claimedQuests = ['q_main_1', 'q_main_1'];
    assert.equal(parseImportedJsonSaveDetailed(JSON.stringify(dupQuest)).ok, false);
  });

  test('M. Fallo de importación nunca sobrescribe la partida actual ni la guardada', async () => {
    gameEngine.startNewGame();
    gameEngine.state.inventory.ore = 123;
    gameEngine.state.player.x = 175;
    await gameEngine.manualSave();

    const failed = await gameEngine.importJsonText('{invalid_json');
    assert.equal(failed, null);
    assert.equal(gameEngine.state.inventory.ore, 123);
    assert.equal(gameEngine.state.player.x, 175);

    const invalidSave = createInitialGameState();
    invalidSave.inventory.ore = -50;
    const failedValidation = await gameEngine.importJsonText(JSON.stringify(invalidSave));
    assert.equal(failedValidation, null);
    assert.equal(gameEngine.state.inventory.ore, 123);

    // Also test storage failure during import does not replace current state
    mockIdb.failWriteError = new Error('IDB fail');
    mockLs.failSetError = new Error('LS fail');
    const validImport = createInitialGameState();
    validImport.inventory.ore = 555;
    const failedSave = await gameEngine.importJsonText(JSON.stringify(validImport));
    assert.equal(failedSave, null);
    assert.equal(gameEngine.state.inventory.ore, 123);
  });

  test('N. Recuperación de copia válida cuando la otra está corrupta y reparación automática', async () => {
    const valid = createInitialGameState();
    valid.inventory.shadowShard = 33;
    valid.saveMeta = { revision: 9, savedAt: 9000 };

    // 1) IndexedDB corrupt, localStorage valid
    mockIdb.setRaw(V4_DB_NAME, V4_SAVE_KEY, '{"version":"4.0","player":null');
    mockLs.setRaw(V4_SAVE_KEY, JSON.stringify(valid));
    const res1 = await loadGameV4Detailed({ syncStores: true });
    assert.ok(res1.state);
    assert.equal(res1.recoveredFromCorruption, true);
    assert.equal(res1.source, 'localstorage');
    assert.equal(res1.syncedStores, true);
    assert.equal(res1.state.inventory.shadowShard, 33);
    assert.equal(JSON.parse(mockIdb.getRaw(V4_DB_NAME, V4_SAVE_KEY)!).inventory.shadowShard, 33);

    // 2) localStorage corrupt, IndexedDB valid
    mockLs.setRaw(V4_SAVE_KEY, 'corrupt_text');
    const res2 = await loadGameV4();
    assert.ok(res2);
    assert.equal(res2.inventory.shadowShard, 33);
    assert.equal(JSON.parse(mockLs.getRaw(V4_SAVE_KEY)!).inventory.shadowShard, 33);
  });

  test('O. Conservación completa de bloques, recursos, babosas, huevos, misiones, stats y ubicación', async () => {
    const rich = createInitialGameState();
    rich.worldSeed = 555111;
    rich.player.x = 212.75;
    rich.player.y = 98.25;
    rich.player.level = 6;
    rich.player.xp = 34;
    rich.player.perks = ['Resistencia Térmica'];
    rich.tilesDelta = { '161,160': TileType.WALL, '162,160': TileType.TORCH, '163,160': TileType.DOOR_OPEN };
    rich.exploredChunks = { '10,10': 1, '13,6': 1 };
    rich.inventory.ore = 44;
    rich.inventory.masterCapsules = 3;
    rich.inventory.relics = 5;
    const bredSlug = createSlugInstance('aetherion', 5, { isBred: true, bonusTrait: 'Potencia +' });
    bredSlug.mega = true;
    rich.party.push(bredSlug);
    rich.activePartyIndex = 3;
    rich.storage.push(createSlugInstance('voltrix', 3));
    rich.eggs.push({
      id: 'egg_persist_1',
      parentAName: 'Infurnus',
      parentBName: 'Aquabeak',
      speciesId: 'infurnus',
      stepsRemaining: 17.5,
      totalSteps: 40,
      bonusTrait: 'Velocidad +',
    });
    rich.discoveries = ['Verdes', 'Magma', 'Heladas'];
    rich.defeatedBosses = ['boss_magma'];
    rich.claimedQuests = ['q_main_1', 'q_main_2'];
    rich.shelterTier = 3;
    rich.stats = {
      oreMined: 52,
      wins: 14,
      torchesPlaced: 9,
      structuresBuilt: 12,
      chestsOpened: 4,
      eggsHatched: 2,
      bossesDefeated: 1,
      megaUnlocked: 1,
      steps: 420.5,
    };
    rich.options = {
      soundEnabled: false,
      volume: 0.75,
      touchControls: 'on',
      lightingQuality: 'eco',
      showMinimap: false,
    };

    const saveRes = await saveGameV4(rich, { reason: 'manual' });
    assert.equal(saveRes.ok, true);

    const loaded = await loadGameV4();
    assert.ok(loaded);
    assert.equal(loaded.worldSeed, 555111);
    assert.equal(loaded.player.x, 212.75);
    assert.equal(loaded.player.y, 98.25);
    assert.deepEqual(loaded.player.perks, ['Resistencia Térmica']);
    assert.deepEqual(loaded.tilesDelta, rich.tilesDelta);
    assert.deepEqual(loaded.exploredChunks, rich.exploredChunks);
    assert.equal(loaded.inventory.ore, 44);
    assert.equal(loaded.inventory.masterCapsules, 3);
    assert.equal(loaded.inventory.relics, 5);
    assert.equal(loaded.party.length, 4);
    assert.equal(loaded.party[3].id, 'aetherion');
    assert.equal(loaded.party[3].mega, true);
    assert.equal(loaded.party[3].bonusTrait, 'Potencia +');
    assert.equal(loaded.storage.length, 1);
    assert.equal(loaded.activePartyIndex, 3);
    assert.equal(loaded.eggs.length, 1);
    assert.equal(loaded.eggs[0].stepsRemaining, 17.5);
    assert.deepEqual(loaded.discoveries, ['Verdes', 'Magma', 'Heladas']);
    assert.deepEqual(loaded.defeatedBosses, ['boss_magma']);
    assert.deepEqual(loaded.claimedQuests, ['q_main_1', 'q_main_2']);
    assert.equal(loaded.shelterTier, 3);
    assert.deepEqual(loaded.stats, rich.stats);
    assert.deepEqual(loaded.options, rich.options);
  });

  test('Capacidades de almacenamiento (navigator.storage) y compatibilidad bajo file://', async () => {
    // 1) Browser without navigator.storage & under file://
    (globalThis as Record<string, unknown>).window = { location: { protocol: 'file:' } };
    const capFile = await checkStorageCapabilities();
    assert.equal(capFile.isFileProtocol, true);
    assert.equal(capFile.storageApiAvailable, false);
    const persistFile = await requestPersistentStorageIfNeeded();
    assert.equal(persistFile.supported, false);
    assert.equal(persistFile.granted, null);

    // 2) Browser rejecting persistence
    resetSaveRuntimeForTests();
    (globalThis as Record<string, unknown>).window = { location: { protocol: 'https:' } };
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        storage: {
          estimate: async () => ({ quota: 50_000_000, usage: 120_000 }),
          persisted: async () => false,
          persist: async () => false,
        },
      },
      configurable: true,
    });
    const capHttps = await checkStorageCapabilities();
    assert.equal(capHttps.estimateSupported, true);
    assert.equal(capHttps.quotaBytes, 50_000_000);
    assert.equal(capHttps.persisted, false);
    const persistRejected = await requestPersistentStorageIfNeeded();
    assert.equal(persistRejected.supported, true);
    assert.equal(persistRejected.granted, false);
  });

  test('Ciclo de vida: guardado síncrono en pagehide y recuperación al volver a la pestaña', async () => {
    gameEngine.startNewGame();
    gameEngine.state.inventory.ore = 31;
    gameEngine.handleLifecycleSave('pagehide');
    // Immediately check localStorage synchronously
    const rawLs = mockLs.getRaw(V4_SAVE_KEY);
    assert.ok(rawLs);
    assert.equal(JSON.parse(rawLs).inventory.ore, 31);

    await gameEngine.handleTabReturn();
    const rawIdb = mockIdb.getRaw(V4_DB_NAME, V4_SAVE_KEY);
    assert.ok(rawIdb);
    assert.equal(JSON.parse(rawIdb).inventory.ore, 31);
  });
});

describe('Bajoterra 4.0 — Regresión permanente de FASE 1 (7 comprobaciones)', () => {
  test('FASE 1.1 y 1.2: Sincronización post-turno enemigo y cancelación de temporizadores al cerrar combate', async () => {
    const s1 = createInitialGameState();
    const cm1 = new CombatManager();
    let syncs = 0;
    cm1.startBattle(s1, {
      kind: 'wild',
      speciesId: 'burpy',
      level: 1,
      onStateChange: () => {
        syncs++;
      },
    });
    cm1.executeNormalAttack(s1);
    if (cm1.battle && cm1.battle.turn === 'enemy') {
      await new Promise((r) => setTimeout(r, 600));
      assert.ok(syncs >= 1);
    }
    cm1.closeBattle();

    const s2 = createInitialGameState();
    const cm2 = new CombatManager();
    let ghostSync = 0;
    cm2.startBattle(s2, {
      kind: 'wild',
      speciesId: 'burpy',
      level: 2,
      onStateChange: () => {
        ghostSync++;
      },
    });
    cm2.executeDefense(s2);
    const hpBeforeClose = s2.party[0].hp;
    cm2.closeBattle();
    await new Promise((r) => setTimeout(r, 600));
    assert.equal(ghostSync, 0);
    assert.equal(s2.party[0].hp, hpBeforeClose);
  });

  test('FASE 1.3: Alineación Math.floor en interacción y colisión de tiles', () => {
    gameEngine.startNewGame();
    gameEngine.state.player.x = 158.9;
    gameEngine.state.player.y = 158.1;
    gameEngine.state.player.facingX = 1;
    gameEngine.state.player.facingY = 0;
    const target = (gameEngine as unknown as { getTargetTile: () => { x: number; y: number } }).getTargetTile();
    assert.deepEqual(target, { x: 160, y: 158 });

    const wallX = 162;
    const wallY = 158;
    gameEngine.chunks.setTile(wallX, wallY, TileType.ROCK);
    gameEngine.chunks.setTile(wallX - 1, wallY, TileType.FLOOR);
    gameEngine.chunks.setTile(wallX - 1, wallY - 1, TileType.FLOOR);
    gameEngine.chunks.setTile(wallX - 1, wallY + 1, TileType.FLOOR);
    gameEngine.state.player.x = wallX - 0.95;
    gameEngine.state.player.y = wallY;
    const engInternal = gameEngine as unknown as {
      keysHeld: Set<string>;
      updatePlayerMovement: (dt: number) => void;
    };
    engInternal.keysHeld.clear();
    engInternal.keysHeld.add('d');
    engInternal.updatePlayerMovement(0.05);
    assert.ok(gameEngine.state.player.x + 0.5 < wallX);
    engInternal.keysHeld.clear();
  });

  test('FASE 1.4: Listener de teclado en BattleModal sin needlePos en dependencias', () => {
    const bmSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/BattleModal.tsx'), 'utf8');
    assert.ok(bmSrc.includes('useCallback'));
    assert.ok(bmSrc.includes('[pulseMinigame, confirmPulseHit]'));
  });

  test('FASE 1.5: Misiones multicondición q_main_1 y q_main_2', () => {
    gameEngine.startNewGame();
    const q1 = QUEST_LIST.find((q) => q.id === 'q_main_1')!;
    const q2 = QUEST_LIST.find((q) => q.id === 'q_main_2')!;

    gameEngine.state.stats.oreMined = 10;
    gameEngine.state.stats.torchesPlaced = 1;
    assert.equal(gameEngine.isQuestComplete(q1), false);
    assert.equal(gameEngine.claimQuest('q_main_1'), false);

    gameEngine.state.stats.torchesPlaced = 2;
    assert.equal(gameEngine.isQuestComplete(q1), true);
    assert.equal(gameEngine.claimQuest('q_main_1'), true);

    gameEngine.state.stats.structuresBuilt = 4;
    gameEngine.state.shelterTier = 1;
    assert.equal(gameEngine.isQuestComplete(q2), false);
    assert.equal(gameEngine.claimQuest('q_main_2'), false);

    gameEngine.state.shelterTier = 2;
    assert.equal(gameEngine.isQuestComplete(q2), true);
    assert.equal(gameEngine.claimQuest('q_main_2'), true);
  });

  test('FASE 1.6 y 1.7: Errata Cañón Estático corregida y soporte file:// en PauseModal', () => {
    const voltrix = getSpecies('voltrix');
    assert.ok(voltrix.specialMoves.some((m) => m.name === 'Cañón Estático'));
    const dataSrc = fs.readFileSync(path.join(process.cwd(), 'src/game/data.ts'), 'utf8');
    assert.equal(dataSrc.includes('Caón Estático'), false);

    const pauseSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/PauseModal.tsx'), 'utf8');
    assert.ok(pauseSrc.includes("window.location.protocol === 'file:'"));
    assert.ok(pauseSrc.includes('href="./Bajoterra_4_0.html"'));
  });
});

describe('Bajoterra 4.0 — FASE 3: Hogar Viviente y Babosas Compañeras', () => {
  test('F3.1 Asignar babosa desde reserva al hogar sin duplicación y respetar límites por hábitat y total', () => {
    gameEngine.startNewGame();
    const fire1 = createSlugInstance('flaringo', 2);
    const fire2 = createSlugInstance('piroclasto', 2);
    const fire3 = createSlugInstance('infurnus', 2);
    const water1 = createSlugInstance('aquabeak', 2);
    const ice1 = createSlugInstance('frostcrawler', 2);
    const elec1 = createSlugInstance('voltrix', 2);
    const shadow1 = createSlugInstance('umbrospect', 2);
    const grass1 = createSlugInstance('musgacorn', 2);
    gameEngine.state.storage.push(fire1, fire2, fire3, water1, ice1, elec1, shadow1, grass1);

    assert.equal(gameEngine.assignSlugToHome(fire1.uid, 'habitat_thermal'), true);
    assert.equal(gameEngine.state.storage.some((s) => s.uid === fire1.uid), false);
    assert.equal(gameEngine.state.home?.residents.length, 1);

    assert.equal(gameEngine.assignSlugToHome(fire2.uid, 'habitat_thermal'), true);
    // 3rd slug in same habitat (>2) rejected
    assert.equal(gameEngine.assignSlugToHome(fire3.uid, 'habitat_thermal'), false);
    assert.equal(gameEngine.state.storage.some((s) => s.uid === fire3.uid), true);

    // Fill up to global max of 6
    assert.equal(gameEngine.assignSlugToHome(water1.uid, 'habitat_aquatic'), true);
    assert.equal(gameEngine.assignSlugToHome(ice1.uid, 'habitat_aquatic'), true);
    assert.equal(gameEngine.assignSlugToHome(elec1.uid, 'habitat_crystal'), true);
    assert.equal(gameEngine.assignSlugToHome(shadow1.uid, 'habitat_shadow'), true);
    assert.equal(gameEngine.state.home?.residents.length, 6);

    // 7th active home slug rejected cleanly
    assert.equal(gameEngine.assignSlugToHome(grass1.uid, 'habitat_garden'), false);
    assert.equal(gameEngine.state.home?.residents.length, 6);
  });

  test('F3.2 Retirar babosa del hogar a la reserva conservando UID y atributos intactos', () => {
    gameEngine.startNewGame();
    const slug = createSlugInstance('aquabeak', 3, { bonusTrait: 'Vitalidad +' });
    slug.bond = 44;
    const origAtk = slug.atk;
    const origHp = slug.maxHp;
    gameEngine.state.storage.push(slug);

    assert.equal(gameEngine.assignSlugToHome(slug.uid, 'habitat_aquatic'), true);
    assert.equal(gameEngine.withdrawSlugFromHome(slug.uid), true);
    assert.equal(gameEngine.state.home?.residents.length, 0);
    const back = gameEngine.state.storage.find((s) => s.uid === slug.uid);
    assert.ok(back);
    assert.equal(back.atk, origAtk);
    assert.equal(back.maxHp, origHp);
    assert.equal(back.bond, 44);
  });

  test('F3.3 y F3.4 Persistencia de hogar, mobiliario, necesidades, limpieza transitoria y rechazo de duplicados en save/load', async () => {
    gameEngine.startNewGame();
    const slug = createSlugInstance('musgacorn', 2);
    gameEngine.state.storage.push(slug);
    gameEngine.state.inventory.bed = 1;
    assert.equal(gameEngine.assignSlugToHome(slug.uid, 'habitat_garden'), true);
    assert.equal(gameEngine.placeFurnitureAt('bed', SPAWN_X + 1, SPAWN_Y + 1), true);

    const resRef = gameEngine.state.home!.residents[0];
    resRef.hunger = 61;
    resRef.energy = 73;
    resRef.happiness = 88;
    resRef.reactionText = 'Temporal';
    resRef.reactionTimer = 1.5;

    const saveRes = await saveGameV4(gameEngine.state, { reason: 'manual' });
    assert.equal(saveRes.ok, true);

    const loaded = await loadGameV4();
    assert.ok(loaded);
    assert.equal(loaded.home?.residents.length, 1);
    assert.equal(loaded.home?.residents[0].slug.uid, slug.uid);
    assert.equal(loaded.home?.residents[0].hunger, 61);
    assert.equal(loaded.home?.residents[0].reactionText, undefined);
    assert.equal(loaded.home?.furniture.length, 1);
    assert.equal(loaded.home?.furniture[0].kind, 'bed');
    assert.equal(loaded.storage.some((s) => s.uid === slug.uid), false);

    // Reject duplicate UID across party and home.residents
    const corruptedDup = JSON.parse(JSON.stringify(loaded));
    corruptedDup.storage.push({ ...corruptedDup.home.residents[0].slug });
    const parsedDup = parseImportedJsonSaveDetailed(JSON.stringify(corruptedDup));
    assert.equal(parsedDup.ok, false);
    assert.ok(parsedDup.error?.toLowerCase().includes('duplicado'));
  });

  test('F3.5 Colisiones del hogar: paredes, puertas cerradas, agua/lava según especie y permanencia al salir', () => {
    gameEngine.startNewGame();
    const fire = createSlugInstance('infurnus', 1);
    const water = createSlugInstance('aquabeak', 1);
    gameEngine.state.storage.push(fire, water);
    gameEngine.assignSlugToHome(fire.uid, 'habitat_thermal');
    gameEngine.assignSlugToHome(water.uid, 'habitat_aquatic');

    // Starter shelter perimeter wall at (SPAWN_X + 5, SPAWN_Y + 1) is solid
    assert.equal(canHomeSlugWalk(gameEngine.chunks, 'infurnus', SPAWN_X + 5, SPAWN_Y + 1), false);

    // Door closed blocks movement; door open allows movement
    gameEngine.chunks.setTile(SPAWN_X + 5, SPAWN_Y, TileType.DOOR_CLOSED);
    assert.equal(canHomeSlugWalk(gameEngine.chunks, 'infurnus', SPAWN_X + 5, SPAWN_Y), false);
    gameEngine.chunks.setTile(SPAWN_X + 5, SPAWN_Y, TileType.DOOR_OPEN);
    assert.equal(canHomeSlugWalk(gameEngine.chunks, 'infurnus', SPAWN_X + 5, SPAWN_Y), true);

    // Water only walkable by Agua species
    gameEngine.chunks.setTile(SPAWN_X + 1, SPAWN_Y + 1, TileType.WATER);
    assert.equal(canHomeSlugWalk(gameEngine.chunks, 'aquabeak', SPAWN_X + 1, SPAWN_Y + 1), true);
    assert.equal(canHomeSlugWalk(gameEngine.chunks, 'infurnus', SPAWN_X + 1, SPAWN_Y + 1), false);

    // Lava only walkable by Fuego species
    gameEngine.chunks.setTile(SPAWN_X + 2, SPAWN_Y + 1, TileType.LAVA);
    assert.equal(canHomeSlugWalk(gameEngine.chunks, 'infurnus', SPAWN_X + 2, SPAWN_Y + 1), true);
    assert.equal(canHomeSlugWalk(gameEngine.chunks, 'aquabeak', SPAWN_X + 2, SPAWN_Y + 1), false);

    // When player leaves shelter far away, resident outside shelter snaps back safely into home
    const res = gameEngine.state.home!.residents[0];
    res.x = SPAWN_X + 60;
    res.y = SPAWN_Y + 60;
    updateHomeResidents(0.1, gameEngine.state, gameEngine.chunks, gameEngine.getRoomValidations(true), false);
    assert.ok(Math.abs(res.x - SPAWN_X) <= 16);
    assert.ok(Math.abs(res.y - SPAWN_Y) <= 16);
  });

  test('F3.6 Rechazo de hábitat incompatible según elemento', () => {
    gameEngine.startNewGame();
    const water = createSlugInstance('aquabeak', 1);
    const shadow = createSlugInstance('darkfurnus', 1);
    gameEngine.state.storage.push(water, shadow);

    assert.equal(gameEngine.assignSlugToHome(water.uid, 'habitat_thermal'), false);
    assert.equal(gameEngine.assignSlugToHome(shadow.uid, 'habitat_garden'), false);
    assert.equal(gameEngine.state.home?.residents.length, 0);
  });

  test('F3.7 Alimentación en hogar actualiza saciedad, ánimo y amistad con bono de alimento favorito', () => {
    gameEngine.startNewGame();
    const fire = createSlugInstance('flaringo', 1);
    fire.bond = 20;
    gameEngine.state.storage.push(fire);
    gameEngine.state.inventory.berries = 2;
    gameEngine.state.inventory.emberSnack = 1;
    assert.equal(gameEngine.assignSlugToHome(fire.uid, 'habitat_thermal'), true);

    const res = gameEngine.state.home!.residents[0];
    res.hunger = 20;
    res.happiness = 40;
    res.energy = 80;
    gameEngine.state.playTimeSec = 100;

    // Favorite food gives bigger boost (+55 hunger, +5 bond)
    assert.equal(gameEngine.feedHomeSlug(fire.uid, 'emberSnack'), true);
    assert.equal(gameEngine.state.inventory.emberSnack, 0);
    assert.equal(res.hunger, 75);
    assert.equal(res.slug.bond, 25);
    assert.equal(res.mood, 'tranquila');

    // Non-favorite berries also feed
    res.hunger = 50;
    gameEngine.state.playTimeSec = 130;
    assert.equal(gameEngine.feedHomeSlug(fire.uid, 'berries'), true);
    assert.equal(res.hunger, 88);
    assert.equal(res.mood, 'contenta');

    // Out of stock food fails cleanly
    assert.equal(gameEngine.feedHomeSlug(fire.uid, 'emberSnack'), false);
  });

  test('F3.8 Acariciar y jugar respetan enfriamientos sin alterar equipo activo ni estadísticas de combate', () => {
    gameEngine.startNewGame();
    const slug = createSlugInstance('tazerling', 2);
    slug.bond = 30;
    const origAtk = slug.atk;
    const origDef = slug.def;
    const origSpd = slug.spd;
    const origHp = slug.maxHp;
    const origParty = gameEngine.state.party.map((s) => s.uid);
    const origActiveIdx = gameEngine.state.activePartyIndex;

    gameEngine.state.storage.push(slug);
    assert.equal(gameEngine.assignSlugToHome(slug.uid, 'habitat_crystal'), true);
    const res = gameEngine.state.home!.residents[0];

    gameEngine.state.playTimeSec = 50;
    assert.equal(gameEngine.petHomeSlug(slug.uid), true);
    assert.equal(res.slug.bond, 33);
    // Repeated pet within 25s cooldown does not spam bond
    gameEngine.state.playTimeSec = 60;
    assert.equal(gameEngine.petHomeSlug(slug.uid), true);
    assert.equal(res.slug.bond, 33);

    // Playing works when energy >= 18
    gameEngine.state.playTimeSec = 70;
    assert.equal(gameEngine.playWithHomeSlug(slug.uid), true);
    assert.equal(res.slug.bond, 37);

    // Exhausted slug refuses play gently
    res.energy = 10;
    gameEngine.state.playTimeSec = 120;
    assert.equal(gameEngine.playWithHomeSlug(slug.uid), false);

    // Combat stats and active party untouched
    assert.equal(res.slug.atk, origAtk);
    assert.equal(res.slug.def, origDef);
    assert.equal(res.slug.spd, origSpd);
    assert.equal(res.slug.maxHp, origHp);
    assert.deepEqual(gameEngine.state.party.map((s) => s.uid), origParty);
    assert.equal(gameEngine.state.activePartyIndex, origActiveIdx);
  });

  test('F3.9 Mobiliario y validación de habitaciones (cerrada, abierta, sin puerta/luz y bloqueada)', () => {
    gameEngine.startNewGame();
    gameEngine.state.inventory.nest = 1;
    gameEngine.state.inventory.decor = 1;

    // 1) Intact starter shelter is closed, lit, has doors
    const intact = gameEngine.getRoomValidations(true);
    const main = intact.find((r) => r.id === 'room_main');
    assert.ok(main);
    assert.equal(main.closed, true);
    assert.equal(main.hasDoor, true);
    assert.equal(main.hasLight, true);
    assert.equal(main.issues.length, 0);

    // Placing furniture boosts comfort & pickup refunds inventory
    assert.equal(gameEngine.placeFurnitureAt('nest', SPAWN_X + 1, SPAWN_Y + 1), true);
    const withFurn = gameEngine.getRoomValidations(true).find((r) => r.id === 'room_main')!;
    assert.ok(withFurn.comfortScore > main.comfortScore);
    assert.equal(gameEngine.pickupFurnitureAt(SPAWN_X + 1, SPAWN_Y + 1), true);
    assert.equal(gameEngine.state.inventory.nest, 1);

    // 2) Breaching a shelter wall makes main shelter open (closed: false)
    gameEngine.chunks.setTile(SPAWN_X - 2, SPAWN_Y - 5, TileType.FLOOR);
    const breached = gameEngine.getRoomValidations(true);
    assert.ok(breached.some((r) => r.closed === false));

    // Repair wall, then build a separate sealed 3x3 interior room without door or light
    gameEngine.chunks.setTile(SPAWN_X - 2, SPAWN_Y - 5, TileType.WALL);
    for (let ry = SPAWN_Y + 8; ry <= SPAWN_Y + 12; ry++) {
      for (let rx = SPAWN_X + 8; rx <= SPAWN_X + 12; rx++) {
        const border = rx === SPAWN_X + 8 || rx === SPAWN_X + 12 || ry === SPAWN_Y + 8 || ry === SPAWN_Y + 12;
        gameEngine.chunks.setTile(rx, ry, border ? TileType.WALL : TileType.BUILT_FLOOR);
      }
    }
    const extraRoom = validateShelterRooms(gameEngine.chunks, gameEngine.state.home!).find(
      (r) => r.id !== 'room_main'
    );
    assert.ok(extraRoom);
    assert.equal(extraRoom.closed, true);
    assert.equal(extraRoom.hasDoor, false);
    assert.equal(extraRoom.hasLight, false);

    // Tiny 1-tile enclosed cell reports insufficient walkable space
    for (let ry = SPAWN_Y - 12; ry <= SPAWN_Y - 10; ry++) {
      for (let rx = SPAWN_X - 12; rx <= SPAWN_X - 10; rx++) {
        const border = rx === SPAWN_X - 12 || rx === SPAWN_X - 10 || ry === SPAWN_Y - 12 || ry === SPAWN_Y - 10;
        gameEngine.chunks.setTile(rx, ry, border ? TileType.WALL : TileType.BUILT_FLOOR);
      }
    }
    const allRooms = validateShelterRooms(gameEngine.chunks, gameEngine.state.home!);
    assert.ok(allRooms.some((r) => r.walkableCount < 2 && r.issues.some((i) => i.includes('Espacio insuficiente'))));
  });

  test('F3.10 Compatibilidad con partidas V4 anteriores a FASE 3 (sin home ni nuevos ítems)', () => {
    const legacyV4 = createInitialGameState() as unknown as Record<string, unknown>;
    delete legacyV4.home;
    const inv = legacyV4.inventory as Record<string, unknown>;
    delete inv.emberSnack;
    delete inv.frostNectar;
    delete inv.nest;
    delete inv.bed;
    delete inv.feeder;
    delete inv.decor;

    const res = parseImportedJsonSaveDetailed(JSON.stringify(legacyV4));
    assert.equal(res.ok, true);
    assert.equal(res.kind, 'v4');
    assert.ok(res.state?.home);
    assert.equal(res.state?.home.residents.length, 0);
    assert.equal(res.state?.inventory.emberSnack, 0);
    assert.equal(res.state?.inventory.bed, 0);
  });

  test('F3.11 Migración Bajoterra 3.0 intacta con hogar inicializado y desgaste basado en tiempo de juego', () => {
    const v3 = {
      player: { x: 56, y: 56, hp: 100, maxHp: 100, level: 2, xp: 10 },
      party: [{ id: 'infurnus', level: 2, hp: 60, maxHp: 60, atk: 16, spd: 12, friend: 30 }],
      pets: [{ id: 'aquabeak', level: 1, hp: 50, maxHp: 50, atk: 12, spd: 10, friend: 20 }],
      tiles: { '56,56': 11 },
      worldSeed: 74192,
    };
    const migrated = migrateV3ToV4(v3);
    assert.ok(migrated.home);
    assert.equal(migrated.home.residents.length, 0);
    assert.equal(migrated.storage.length, 1);

    // Needs tick only uses playTimeSec, not offline Date.now
    gameEngine.startNewGame();
    const s = createSlugInstance('aquabeak', 1);
    gameEngine.state.storage.push(s);
    gameEngine.assignSlugToHome(s.uid, 'habitat_aquatic');
    const hBefore = gameEngine.state.home!.residents[0].hunger;
    gameEngine.state.playTimeSec += 10;
    tickHomeNeeds(gameEngine.state, 70);
    assert.ok(gameEngine.state.home!.residents[0].hunger < hBefore);
    assert.ok(gameEngine.state.home!.residents[0].hunger > 0);
  });

  test('F3.12 Combate, crianza y movimiento del jugador siguen funcionando sin interferencias', () => {
    gameEngine.startNewGame();
    const homeSlug = createSlugInstance('doc', 2);
    gameEngine.state.storage.push(homeSlug);
    gameEngine.assignSlugToHome(homeSlug.uid, 'habitat_crystal');

    // Breeding works normally
    gameEngine.state.party[0].bond = 30;
    gameEngine.state.party[1].bond = 30;
    assert.equal(gameEngine.startBreeding(gameEngine.state.party[0].uid, gameEngine.state.party[1].uid), true);

    // Player movement advances steps & hatches egg cleanly
    const engInternal = gameEngine as unknown as {
      keysHeld: Set<string>;
      updatePlayerMovement: (dt: number) => void;
    };
    const startY = gameEngine.state.player.y;
    engInternal.keysHeld.clear();
    engInternal.keysHeld.add('s');
    engInternal.updatePlayerMovement(0.05);
    assert.ok(gameEngine.state.player.y > startY);
    engInternal.keysHeld.clear();

    // Combat starts & resolves cleanly while home residents exist
    const cm = new CombatManager();
    cm.startBattle(gameEngine.state, { kind: 'wild', speciesId: 'infurnus', level: 1 });
    assert.ok(cm.battle?.active);
    cm.executeNormalAttack(gameEngine.state);
    cm.closeBattle();
  });
});

describe('Bajoterra 4.0 — PARTE A3: Correcciones Obligatorias de FASE 3', () => {
  test('A3.1 Colisiones reales con los 4 tipos de mobiliario, descanso adyacente y reapertura de ruta al recoger', () => {
    gameEngine.startNewGame();
    const slug = createSlugInstance('musgacorn', 2);
    gameEngine.state.storage.push(slug);
    assert.equal(gameEngine.assignSlugToHome(slug.uid, 'habitat_garden'), true);

    gameEngine.state.inventory.bed = 1;
    gameEngine.state.inventory.feeder = 1;
    gameEngine.state.inventory.nest = 1;
    gameEngine.state.inventory.decor = 1;

    const tiles: Array<{ kind: 'bed' | 'feeder' | 'nest' | 'decor'; x: number; y: number }> = [
      { kind: 'bed', x: SPAWN_X + 1, y: SPAWN_Y },
      { kind: 'feeder', x: SPAWN_X + 2, y: SPAWN_Y },
      { kind: 'nest', x: SPAWN_X - 1, y: SPAWN_Y },
      { kind: 'decor', x: SPAWN_X, y: SPAWN_Y - 1 },
    ];

    for (const item of tiles) {
      gameEngine.chunks.setTile(item.x, item.y, TileType.BUILT_FLOOR);
      assert.equal(gameEngine.placeFurnitureAt(item.kind, item.x, item.y), true);
      assert.equal(
        canHomeSlugWalk(gameEngine.chunks, 'musgacorn', item.x, item.y, gameEngine.state.home!.furniture),
        false,
        `La babosa no debe atravesar ${item.kind}`
      );
    }

    // Tired resident targeting restSpot picks an adjacent walkable tile, never the bed tile itself
    const res = gameEngine.state.home!.residents[0];
    res.x = SPAWN_X;
    res.y = SPAWN_Y + 1;
    res.energy = 15;
    res.behaviorTimer = 0;
    updateHomeResidents(0.05, gameEngine.state, gameEngine.chunks, gameEngine.getRoomValidations(true), true);
    assert.equal(
      canHomeSlugWalk(gameEngine.chunks, res.slug.id, res.targetX, res.targetY, gameEngine.state.home!.furniture),
      true
    );
    assert.equal(
      gameEngine.state.home!.furniture.some(
        (f) => f.x === Math.round(res.targetX) && f.y === Math.round(res.targetY)
      ),
      false
    );

    // Picking up furniture immediately reopens the tile for walking
    assert.equal(gameEngine.pickupFurnitureAt(SPAWN_X + 1, SPAWN_Y), true);
    assert.equal(
      canHomeSlugWalk(gameEngine.chunks, 'musgacorn', SPAWN_X + 1, SPAWN_Y, gameEngine.state.home!.furniture),
      true
    );
  });

  test('A3.2 Validación estricta de home en validateV4State (hábitats, límites, refugio y compatibilidad)', () => {
    const buildResident = (slug: ReturnType<typeof createSlugInstance>, habitatId: string, x = SPAWN_X, y = SPAWN_Y) => ({
      slug,
      habitatId,
      x,
      y,
      targetX: x,
      targetY: y,
      behavior: 'pasear' as const,
      behaviorTimer: 2,
      mood: 'tranquila' as const,
      hunger: 80,
      energy: 80,
      happiness: 80,
      lastPetAt: -100,
      lastPlayAt: -100,
      lastFeedAt: -100,
    });

    // 1) Incompatible species/habitat rejected
    const badHab = createInitialGameState();
    badHab.home = {
      residents: [buildResident(createSlugInstance('aquabeak', 1), 'habitat_thermal') as never],
      furniture: [],
      lastNeedsTickSec: 0,
    };
    assert.equal(parseImportedJsonSaveDetailed(JSON.stringify(badHab)).ok, false);

    // 2) More than 2 residents in same habitat rejected
    const tooManyHab = createInitialGameState();
    tooManyHab.home = {
      residents: [
        buildResident(createSlugInstance('infurnus', 1), 'habitat_thermal'),
        buildResident(createSlugInstance('flaringo', 1), 'habitat_thermal'),
        buildResident(createSlugInstance('piroclasto', 1), 'habitat_thermal'),
      ] as never,
      furniture: [],
      lastNeedsTickSec: 0,
    };
    assert.equal(parseImportedJsonSaveDetailed(JSON.stringify(tooManyHab)).ok, false);

    // 3) Resident outside shelter radius rejected
    const outRes = createInitialGameState();
    outRes.home = {
      residents: [buildResident(createSlugInstance('infurnus', 1), 'habitat_thermal', SPAWN_X + 40, SPAWN_Y) as never],
      furniture: [],
      lastNeedsTickSec: 0,
    };
    assert.equal(parseImportedJsonSaveDetailed(JSON.stringify(outRes)).ok, false);

    // 4) Furniture outside shelter radius rejected
    const outFurn = createInitialGameState();
    outFurn.home = {
      residents: [],
      furniture: [{ id: 'f_out', kind: 'bed', x: SPAWN_X - 30, y: SPAWN_Y }],
      lastNeedsTickSec: 0,
    };
    assert.equal(parseImportedJsonSaveDetailed(JSON.stringify(outFurn)).ok, false);

    // 5) More than 32 furniture items rejected
    const tooManyFurn = createInitialGameState();
    tooManyFurn.home = {
      residents: [],
      furniture: Array.from({ length: 33 }, (_, i) => ({
        id: `f_${i}`,
        kind: 'decor',
        x: SPAWN_X - 10 + (i % 11),
        y: SPAWN_Y - 10 + Math.floor(i / 11),
      })),
      lastNeedsTickSec: 0,
    };
    assert.equal(parseImportedJsonSaveDetailed(JSON.stringify(tooManyFurn)).ok, false);
  });
});

describe('Bajoterra 4.0 — FASE 4: Vínculos, Maestría y Evolución de Babosas', () => {
  test('F4.1 Niveles, EXP unificada, tope de nivel y estadísticas controladas', () => {
    const state = createInitialGameState();
    const slug = state.party[0];
    const baseAtk = slug.atk;
    const baseHp = slug.maxHp;

    const msgs = awardSlugExperience(state, slug, 40, { bondDelta: 0 });
    assert.equal(slug.level, 2);
    assert.equal(slug.atk, baseAtk + 3);
    assert.equal(slug.maxHp, baseHp + 8);
    assert.ok(msgs.some((m) => m.includes('nivel 2')));

    // Level cap is respected cleanly
    awardSlugExperience(state, slug, 999999, { bondDelta: 0 });
    assert.equal(slug.level, MAX_SLUG_LEVEL);
    assert.equal(slug.xp, 0);
  });

  test('F4.2 Solo las babosas participantes en el combate ganan EXP y vínculo de batalla', () => {
    const state = createInitialGameState();
    const slug0XpBefore = state.party[0].xp;
    const slug1XpBefore = state.party[1].xp;
    const slug2XpBefore = state.party[2].xp;
    const slug2BondBefore = state.party[2].bond;

    const cm = new CombatManager();
    cm.startBattle(state, { kind: 'wild', speciesId: 'musgacorn', level: 1 });
    // Swap from party[0] to party[1]; party[2] never participates
    cm.swapSlug(state, 1);
    cm.resolveEnemyTurn(state);
    cm.battle!.enemy.hp = 1;
    cm.executeNormalAttack(state); // finishes battle with party[1]

    assert.equal(cm.battle?.outcome, 'victory');
    assert.ok(state.party[1].xp > slug1XpBefore || state.party[1].level > 1);
    assert.ok(state.party[0].xp > slug0XpBefore || state.party[0].level > 1);
    assert.equal(state.party[2].xp, slug2XpBefore);
    assert.equal(state.party[2].bond, slug2BondBefore);
    cm.closeBattle();
  });

  test('F4.3 Niveles de vínculo, conservación entre estuche/reserva/hogar e hito de pasos', () => {
    assert.equal(getBondTierInfo(10).label, 'Conocidos');
    assert.equal(getBondTierInfo(30).label, 'Confianza');
    assert.equal(getBondTierInfo(55).label, 'Amistad');
    assert.equal(getBondTierInfo(80).label, 'Gran amistad');
    assert.equal(getBondTierInfo(100).label, 'Vínculo excepcional');

    gameEngine.startNewGame();
    const s = createSlugInstance('aquabeak', 2);
    s.bond = 48;
    gameEngine.state.storage.push(s);
    assert.equal(gameEngine.assignSlugToHome(s.uid, 'habitat_aquatic'), true);
    gameEngine.state.playTimeSec = 100;
    assert.equal(gameEngine.petHomeSlug(s.uid), true);
    const residentBond = gameEngine.state.home!.residents[0].slug.bond;
    assert.ok(residentBond >= 51);
    assert.equal(gameEngine.withdrawSlugFromHome(s.uid), true);
    const back = gameEngine.state.storage.find((x) => x.uid === s.uid)!;
    assert.equal(back.bond, residentBond);

    // Exploration step milestone awards +1 bond & +4 XP every 60 steps
    const active = gameEngine.state.party[gameEngine.state.activePartyIndex];
    const b0 = active.bond;
    const x0 = active.xp;
    gameEngine.state.stats.steps = 59.8;
    const engInternal = gameEngine as unknown as {
      keysHeld: Set<string>;
      updatePlayerMovement: (dt: number) => void;
    };
    engInternal.keysHeld.clear();
    engInternal.keysHeld.add('s');
    engInternal.updatePlayerMovement(0.05);
    engInternal.keysHeld.clear();
    assert.ok(gameEngine.state.stats.steps >= 60);
    assert.equal(active.bond, b0 + 1);
    assert.equal(active.xp, x0 + 4);
  });

  test('F4.4 Maestría de técnicas progresa, mejora potencia/coste y no rompe el equilibrio', () => {
    const state = createInitialGameState();
    const ally = state.party[0]; // Infurnus: move 1 Fulgor Solar base cost 7
    const move0InfoBefore = getMoveMasteryInfo(ally.moveMastery?.[0] ?? 0);
    assert.equal(move0InfoBefore.rank, 0);

    grantMoveMastery(ally, 1, 100);
    assert.equal(getMoveMasteryInfo(ally.moveMastery?.[1] ?? 0).rank, 3);
    assert.equal(getEffectiveMoveEnergyCost(7, ally.moveMastery?.[1] ?? 0), 6);

    const cm = new CombatManager();
    cm.startBattle(state, { kind: 'wild', speciesId: 'frostcrawler', level: 1 });
    const startMastery0 = ally.moveMastery?.[0] ?? 0;
    cm.executeSpecialMove(state, 0);
    assert.equal(ally.moveMastery?.[0], startMastery0 + 10);
    cm.closeBattle();
  });

  test('F4.5 Evolución Megamorph intencional: requisitos claros, sin disparo automático y conservando UID/especie/atributos', () => {
    gameEngine.startNewGame();
    const slug = gameEngine.state.party[0];
    const origUid = slug.uid;
    const origSpecies = slug.id;

    // Reaching level 5 and bond 60 via XP does NOT silently auto-evolve anymore
    awardSlugExperience(gameEngine.state, slug, 500, { bondDelta: 45 });
    assert.ok(slug.level >= 5);
    assert.ok(slug.bond >= 60);
    assert.equal(slug.mega, false);

    // Without elixir or relic, evolution cannot trigger
    gameEngine.state.inventory.elixirs = 0;
    gameEngine.state.inventory.relics = 0;
    assert.equal(checkMegamorphEligibility(gameEngine.state, slug).eligible, false);
    assert.equal(gameEngine.evolveSlugToMegamorph(slug.uid), false);
    assert.equal(slug.mega, false);

    // Granting 1 Elixir allows intentional Megamorph evolution
    gameEngine.state.inventory.elixirs = 1;
    grantMoveMastery(slug, 0, 35);
    const atkBefore = slug.atk;
    assert.equal(checkMegamorphEligibility(gameEngine.state, slug).eligible, true);
    assert.equal(gameEngine.evolveSlugToMegamorph(slug.uid), true);

    assert.equal(slug.mega, true);
    assert.equal(slug.uid, origUid);
    assert.equal(slug.id, origSpecies);
    assert.equal(slug.name, getSpecies(origSpecies).evoName);
    assert.equal(slug.atk, atkBefore + 6);
    assert.equal(slug.moveMastery?.[0], 35);
    assert.equal(gameEngine.state.inventory.elixirs, 0);
    assert.equal(gameEngine.state.stats.megaUnlocked, 1);

    // Cannot evolve twice
    gameEngine.state.inventory.relics = 2;
    assert.equal(gameEngine.evolveSlugToMegamorph(slug.uid), false);
  });

  test('F4.6 Rasgos individuales equilibrados y compatibilidad sin apilamiento en crías', () => {
    const state = createInitialGameState();
    const wild = createSlugInstance('lariat', 1);
    assert.equal(wild.bonusTrait, undefined);
    awardSlugExperience(state, wild, 400, { bondDelta: 0 }); // reaches Lv >= 4
    assert.ok(wild.bonusTrait);
    const earnedTrait = wild.bonusTrait;
    grantSlugBond(wild, 60); // raising bond later does not overwrite or stack a second trait
    assert.equal(wild.bonusTrait, earnedTrait);

    // Bred slug keeps its breeding trait intact
    const bred = createSlugInstance('infurnus', 1, { isBred: true, bonusTrait: 'Potencia +' });
    awardSlugExperience(state, bred, 500, { bondDelta: 40 });
    assert.equal(bred.isBred, true);
    assert.equal(bred.bonusTrait, 'Potencia +');
  });

  test('F4.7 Guardado/carga completo de progresión FASE 4 y compatibilidad con partidas previas', async () => {
    const rich = createInitialGameState();
    const s = rich.party[0];
    awardSlugExperience(rich, s, 500, { bondDelta: 50 });
    grantMoveMastery(s, 0, 55);
    grantMoveMastery(s, 1, 25);
    rich.inventory.relics = 1;
    assert.equal(gameEngine.state.version, '4.0');
    const savedBefore = await saveGameV4(rich, { reason: 'manual' });
    assert.equal(savedBefore.ok, true);

    const loaded = await loadGameV4();
    assert.ok(loaded);
    assert.deepEqual(loaded.party[0].moveMastery, [55, 25]);
    assert.equal(loaded.party[0].bonusTrait, s.bonusTrait);
    assert.equal(loaded.party[0].bond, s.bond);

    // Pre-FASE-4 V4 save without moveMastery normalizes safely to [0, 0]
    const preF4 = JSON.parse(JSON.stringify(rich));
    delete preF4.party[0].moveMastery;
    const parsedPre = parseImportedJsonSaveDetailed(JSON.stringify(preF4));
    assert.equal(parsedPre.ok, true);
    assert.deepEqual(parsedPre.state?.party[0].moveMastery, [0, 0]);

    // Invalid moveMastery (> 100) is rejected cleanly
    const corruptMastery = JSON.parse(JSON.stringify(rich));
    corruptMastery.party[0].moveMastery = [150, 0];
    assert.equal(parseImportedJsonSaveDetailed(JSON.stringify(corruptMastery)).ok, false);
  });
});

