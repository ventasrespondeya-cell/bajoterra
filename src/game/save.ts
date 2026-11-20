import {
  SPAWN_X,
  SPAWN_Y,
  WORLD_H,
  WORLD_W,
  createDefaultInventory,
  createSlugInstance,
  getSpecies,
} from './data';
import type { BiomeId, GameState, SlugInstance } from './types';

const V4_SAVE_KEY = 'bajoterra-v4-save';
const V4_DB_NAME = 'Bajoterra4DB';
const V3_SAVE_KEY = 'bajoterra-v2';
const V3_DB_NAME = 'BajoterraDB';

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
    seenSpecies: { infurnus: true, aquabeak: true, tazerling: true },
    capturedSpecies: { infurnus: 1, aquabeak: 1, tazerling: 1 },
    eggs: [],
    shelterTier: 1,
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

function idbGet(dbName: string, key: string): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    try {
      const req = indexedDB.open(dbName, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains('saves')) {
          req.result.createObjectStore('saves');
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        try {
          const tx = db.transaction('saves', 'readonly');
          const getReq = tx.objectStore('saves').get(key);
          getReq.onsuccess = () => {
            db.close();
            resolve(typeof getReq.result === 'string' ? getReq.result : null);
          };
          getReq.onerror = () => {
            db.close();
            resolve(null);
          };
        } catch {
          db.close();
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function idbSet(dbName: string, key: string, value: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(false);
      return;
    }
    try {
      const req = indexedDB.open(dbName, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains('saves')) {
          req.result.createObjectStore('saves');
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        try {
          const tx = db.transaction('saves', 'readwrite');
          tx.objectStore('saves').put(value, key);
          tx.oncomplete = () => {
            db.close();
            resolve(true);
          };
          tx.onerror = () => {
            db.close();
            resolve(false);
          };
        } catch {
          db.close();
          resolve(false);
        }
      };
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function saveGameV4(state: GameState): Promise<void> {
  const payload = JSON.stringify(state);
  try {
    localStorage.setItem(V4_SAVE_KEY, payload);
  } catch {
    // ignore storage quota
  }
  await idbSet(V4_DB_NAME, V4_SAVE_KEY, payload);
}

export async function loadGameV4(): Promise<GameState | null> {
  const rawIdb = await idbGet(V4_DB_NAME, V4_SAVE_KEY);
  const rawLs = (() => {
    try {
      return localStorage.getItem(V4_SAVE_KEY);
    } catch {
      return null;
    }
  })();
  const raw = rawIdb || rawLs;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.version === '4.0' && parsed.player && Array.isArray(parsed.party)) {
      return normalizeV4State(parsed);
    }
  } catch {
    // ignore corrupted
  }
  return null;
}

export async function hasExistingV4Save(): Promise<boolean> {
  const s = await loadGameV4();
  return s !== null;
}

export async function detectV3SaveRaw(): Promise<string | null> {
  const rawIdb = await idbGet(V3_DB_NAME, V3_SAVE_KEY);
  if (rawIdb) return rawIdb;
  try {
    return localStorage.getItem(V3_SAVE_KEY);
  } catch {
    return null;
  }
}

export function normalizeV4State(raw: Partial<GameState>): GameState {
  const base = createInitialGameState();
  return {
    ...base,
    ...raw,
    version: '4.0',
    player: { ...base.player, ...(raw.player || {}) },
    inventory: { ...base.inventory, ...(raw.inventory || {}) },
    stats: { ...base.stats, ...(raw.stats || {}) },
    options: { ...base.options, ...(raw.options || {}) },
    party: Array.isArray(raw.party) && raw.party.length > 0 ? raw.party : base.party,
    storage: Array.isArray(raw.storage) ? raw.storage : [],
    tilesDelta: raw.tilesDelta || {},
    exploredChunks: raw.exploredChunks || { '10,10': 1 },
    discoveries: Array.isArray(raw.discoveries) && raw.discoveries.length > 0 ? raw.discoveries : ['Verdes'],
    seenSpecies: raw.seenSpecies || base.seenSpecies,
    capturedSpecies: raw.capturedSpecies || base.capturedSpecies,
    eggs: Array.isArray(raw.eggs) ? raw.eggs : [],
    defeatedBosses: Array.isArray(raw.defeatedBosses) ? raw.defeatedBosses : [],
    claimedQuests: Array.isArray(raw.claimedQuests) ? raw.claimedQuests : [],
  };
}

interface LegacyV3Slug {
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

interface LegacyV3State {
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

export function migrateV3ToV4(v3: LegacyV3State): GameState {
  const next = createInitialGameState();
  const offsetX = SPAWN_X - 56;
  const offsetY = SPAWN_Y - 56;

  if (v3.worldSeed) next.worldSeed = v3.worldSeed;

  if (v3.player) {
    next.player.x = Math.max(4, Math.min(WORLD_W - 5, (v3.player.x ?? 56) + offsetX));
    next.player.y = Math.max(4, Math.min(WORLD_H - 5, (v3.player.y ?? 56) + offsetY));
    next.player.hp = v3.player.hp ?? 100;
    next.player.maxHp = v3.player.maxHp ?? 100;
    next.player.level = v3.player.level ?? 1;
    next.player.xp = v3.player.xp ?? 0;
  }

  const convertSlug = (s: LegacyV3Slug): SlugInstance => {
    const inst = createSlugInstance(s.id || 'infurnus', s.level || 1);
    const sp = getSpecies(inst.id);
    inst.xp = s.xp ?? 0;
    inst.maxHp = Math.max(inst.maxHp, s.maxHp ?? inst.maxHp);
    inst.hp = Math.min(inst.maxHp, s.hp ?? inst.maxHp);
    inst.atk = Math.max(inst.atk, s.atk ?? inst.atk);
    inst.spd = Math.max(inst.spd, s.spd ?? inst.spd);
    inst.bond = s.friend ?? 25;
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

  return next;
}

export function parseImportedJsonSave(jsonText: string): { kind: 'v4' | 'v3'; state: GameState } | null {
  try {
    const parsed = JSON.parse(jsonText);
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.version === '4.0' && parsed.player && parsed.party) {
      return { kind: 'v4', state: normalizeV4State(parsed) };
    }
    if (parsed.player && parsed.party && parsed.tiles) {
      return { kind: 'v3', state: migrateV3ToV4(parsed as LegacyV3State) };
    }
  } catch {
    return null;
  }
  return null;
}
