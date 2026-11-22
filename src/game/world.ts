import { BOSS_DEFINITIONS, CHUNK_SIZE, SPAWN_X, SPAWN_Y, WORLD_H, WORLD_W } from './data';
import { TileType, type BiomeId, type Chunk, type POIKind } from './types';

function hash2D(x: number, y: number, seed: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

function smoothNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2D(xi, yi, seed);
  const b = hash2D(xi + 1, yi, seed);
  const c = hash2D(xi, yi + 1, seed);
  const d = hash2D(xi + 1, yi + 1, seed);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

function fbm(x: number, y: number, seed: number): number {
  return (
    smoothNoise(x * 0.08, y * 0.08, seed) * 0.6 +
    smoothNoise(x * 0.18, y * 0.18, seed + 77) * 0.28 +
    smoothNoise(x * 0.36, y * 0.36, seed + 193) * 0.12
  );
}

export function getBiomeAt(x: number, y: number, seed = 74192): BiomeId {
  const dx = x - SPAWN_X;
  const dy = y - SPAWN_Y;
  const dist = Math.hypot(dx, dy);
  if (dist < 42) return 'Verdes';
  const warp = (smoothNoise(x * 0.035, y * 0.035, seed + 511) - 0.5) * 26;
  // NW = Cristalinas, SE = Acuaticas, South = Magma, West = Heladas, East / Far North = Sombrias, Center/Mid = Verdes
  if (dx + warp < -42 && dy + warp < -42) return 'Cristalinas';
  if (dx + warp > 54 && dy + warp > 38) return 'Acuaticas';
  if (dy + warp > 54 && Math.abs(dx) < 105) return 'Magma';
  if (dx + warp < -58 && Math.abs(dy) < 105) return 'Heladas';
  if (dx + warp > 58 || dy - warp < -64 || dist > 118) return 'Sombrias';
  return 'Verdes';
}

export interface ChunkStructureMeta {
  id: string;
  name: string;
  kind: POIKind;
  biome: BiomeId;
  cx: number;
  cy: number;
  centerX: number;
  centerY: number;
  hasGuardian: boolean;
}

const BOSS_CHUNK_KEYS = new Set<string>(
  BOSS_DEFINITIONS.map((b) => `${Math.floor(b.x / CHUNK_SIZE)},${Math.floor(b.y / CHUNK_SIZE)}`)
);

export function getChunkStructureMeta(cx: number, cy: number, seed = 74192): ChunkStructureMeta | null {
  if (cx <= 0 || cy <= 0 || cx >= WORLD_W / CHUNK_SIZE - 1 || cy >= WORLD_H / CHUNK_SIZE - 1) {
    return null;
  }
  // Never carve over starter zone or main cardinal corridor chunks
  if (cx === 9 || cx === 10 || cy === 9 || cy === 10) return null;
  if (BOSS_CHUNK_KEYS.has(`${cx},${cy}`)) return null;

  const roll = hash2D(cx, cy, seed + 909);
  if (roll <= 0.87) return null;

  const centerX = cx * CHUNK_SIZE + 7;
  const centerY = cy * CHUNK_SIZE + 7;
  const biome = getBiomeAt(centerX, centerY, seed);
  const id = `poi_${cx}_${cy}`;

  if (roll <= 0.915) {
    return { id, name: 'Cámara Secreta', kind: 'secret_chamber', biome, cx, cy, centerX, centerY, hasGuardian: false };
  }
  if (roll <= 0.955) {
    return { id, name: 'Puesto Subterráneo', kind: 'outpost', biome, cx, cy, centerX, centerY, hasGuardian: false };
  }
  if (roll <= 0.98) {
    return { id, name: 'Ruinas Antiguas', kind: 'ancient_ruins', biome, cx, cy, centerX, centerY, hasGuardian: true };
  }
  return { id, name: 'Cámara de Cristales', kind: 'crystal_chamber', biome, cx, cy, centerX, centerY, hasGuardian: true };
}

export function isTileSolid(tile: TileType): boolean {
  return (
    tile === TileType.ROCK ||
    tile === TileType.WOOD_PILLAR ||
    tile === TileType.ORE ||
    tile === TileType.CRACKED_WALL ||
    tile === TileType.ICE ||
    tile === TileType.SHADOW_CRYSTAL ||
    tile === TileType.WALL ||
    tile === TileType.RECHARGE_STATION ||
    tile === TileType.ENERGY_CRYSTAL ||
    tile === TileType.DOOR_CLOSED ||
    tile === TileType.CHEST_CLOSED ||
    tile === TileType.CHEST_OPEN ||
    tile === TileType.ALTAR ||
    tile === TileType.ANCIENT_BRICK ||
    tile === TileType.MAGMA_COAL ||
    tile === TileType.THERMAL_COPPER ||
    tile === TileType.ICE_CRYSTAL ||
    tile === TileType.BLUE_QUARTZ ||
    tile === TileType.DARK_IRON ||
    tile === TileType.VOLCANIC_ROCK ||
    tile === TileType.EVO_STONE_VEIN ||
    tile === TileType.WATERFALL ||
    tile === TileType.CRYSTAL_SPIRE
  );
}

export function isTileHazard(tile: TileType): boolean {
  return tile === TileType.LAVA;
}

export function getTileLabel(tile: TileType): string {
  switch (tile) {
    case TileType.FLOOR:
      return 'Suelo de caverna';
    case TileType.WATER:
      return 'Lago subterráneo';
    case TileType.ROCK:
      return 'Roca sólida';
    case TileType.WOOD_PILLAR:
      return 'Pilar de raíces';
    case TileType.MUSHROOM:
      return 'Hongo luminoso';
    case TileType.ORE:
      return 'Veta de mineral';
    case TileType.CRACKED_WALL:
      return 'Muro agrietado';
    case TileType.LAVA:
      return 'Río de lava';
    case TileType.ICE:
      return 'Bloque de hielo';
    case TileType.SHADOW_CRYSTAL:
      return 'Cristal sombrío';
    case TileType.WALL:
      return 'Pared de refugio';
    case TileType.BUILT_FLOOR:
      return 'Suelo de refugio';
    case TileType.RECHARGE_STATION:
      return 'Estación de recarga';
    case TileType.ENERGY_CRYSTAL:
      return 'Cristal de energía';
    case TileType.TORCH:
      return 'Antorcha';
    case TileType.DOOR_CLOSED:
      return 'Puerta cerrada';
    case TileType.DOOR_OPEN:
      return 'Puerta abierta';
    case TileType.CHEST_CLOSED:
      return 'Cofre del subsuelo';
    case TileType.CHEST_OPEN:
      return 'Cofre abierto';
    case TileType.ALTAR:
      return 'Altar antiguo';
    case TileType.ICE_FLOOR:
      return 'Suelo helado';
    case TileType.ANCIENT_BRICK:
      return 'Ruina antigua';
    case TileType.MAGMA_COAL:
      return 'Carbón de magma';
    case TileType.THERMAL_COPPER:
      return 'Cobre térmico';
    case TileType.ICE_CRYSTAL:
      return 'Cristal de hielo';
    case TileType.BLUE_QUARTZ:
      return 'Cuarzo azul';
    case TileType.DARK_IRON:
      return 'Hierro oscuro';
    case TileType.NEON_MUSHROOM:
      return 'Hongo de neón';
    case TileType.KELP:
      return 'Algas subterráneas';
    case TileType.VOLCANIC_ROCK:
      return 'Roca volcánica';
    case TileType.EVO_STONE_VEIN:
      return 'Veta de Piedra Evolutiva';
    case TileType.WATERFALL:
      return 'Cascada subterránea';
    case TileType.CRYSTAL_SPIRE:
      return 'Aguja cristalina';
    default:
      return 'Terreno';
  }
}

export class ChunkManager {
  private chunks = new Map<string, Chunk>();
  private maxCachedChunks = 64;
  private tickCounter = 0;

  constructor(
    private worldSeed: number,
    private tilesDelta: Record<string, number>
  ) {}

  public reset(seed: number, tilesDelta: Record<string, number>): void {
    this.worldSeed = seed;
    this.tilesDelta = tilesDelta;
    this.chunks.clear();
  }

  private chunkKey(cx: number, cy: number): string {
    return `${cx},${cy}`;
  }

  public getChunk(cx: number, cy: number): Chunk | null {
    if (cx < 0 || cy < 0 || cx >= WORLD_W / CHUNK_SIZE || cy >= WORLD_H / CHUNK_SIZE) {
      return null;
    }
    const key = this.chunkKey(cx, cy);
    let chunk = this.chunks.get(key);
    this.tickCounter++;
    if (!chunk) {
      chunk = this.generateChunk(cx, cy);
      this.chunks.set(key, chunk);
      this.evictOldChunks();
    } else {
      chunk.lastUsed = this.tickCounter;
    }
    return chunk;
  }

  public ensureWindowAround(tx: number, ty: number, radiusChunks = 2): string[] {
    const centerCx = Math.floor(tx / CHUNK_SIZE);
    const centerCy = Math.floor(ty / CHUNK_SIZE);
    const loadedKeys: string[] = [];
    for (let cy = centerCy - radiusChunks; cy <= centerCy + radiusChunks; cy++) {
      for (let cx = centerCx - radiusChunks; cx <= centerCx + radiusChunks; cx++) {
        if (cx < 0 || cy < 0 || cx >= WORLD_W / CHUNK_SIZE || cy >= WORLD_H / CHUNK_SIZE) continue;
        this.getChunk(cx, cy);
        loadedKeys.push(this.chunkKey(cx, cy));
      }
    }
    return loadedKeys;
  }

  private evictOldChunks(): void {
    if (this.chunks.size <= this.maxCachedChunks) return;
    let oldestKey: string | null = null;
    let oldestTick = Infinity;
    for (const [k, c] of this.chunks.entries()) {
      if (c.lastUsed < oldestTick) {
        oldestTick = c.lastUsed;
        oldestKey = k;
      }
    }
    if (oldestKey) {
      this.chunks.delete(oldestKey);
    }
  }

  public getLoadedCount(): number {
    return this.chunks.size;
  }

  public getTile(x: number, y: number): TileType {
    if (x < 0 || y < 0 || x >= WORLD_W || y >= WORLD_H) return TileType.ROCK;
    const deltaKey = `${x},${y}`;
    if (this.tilesDelta[deltaKey] !== undefined) {
      return this.tilesDelta[deltaKey] as TileType;
    }
    const cx = Math.floor(x / CHUNK_SIZE);
    const cy = Math.floor(y / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cy);
    if (!chunk) return TileType.ROCK;
    const lx = x - cx * CHUNK_SIZE;
    const ly = y - cy * CHUNK_SIZE;
    return chunk.tiles[ly * CHUNK_SIZE + lx] as TileType;
  }

  public setTile(x: number, y: number, tile: TileType): void {
    if (x < 0 || y < 0 || x >= WORLD_W || y >= WORLD_H) return;
    const key = `${x},${y}`;
    this.tilesDelta[key] = tile;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cy = Math.floor(y / CHUNK_SIZE);
    const chunk = this.chunks.get(this.chunkKey(cx, cy));
    if (chunk) {
      const lx = x - cx * CHUNK_SIZE;
      const ly = y - cy * CHUNK_SIZE;
      chunk.tiles[ly * CHUNK_SIZE + lx] = tile;
    }
  }

  private generateChunk(cx: number, cy: number): Chunk {
    const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
    const x0 = cx * CHUNK_SIZE;
    const y0 = cy * CHUNK_SIZE;

    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      const y = y0 + ly;
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const x = x0 + lx;
        tiles[ly * CHUNK_SIZE + lx] = this.computeBaseTile(x, y);
      }
    }

    const structMeta = getChunkStructureMeta(cx, cy, this.worldSeed);
    if (structMeta) {
      this.carveStructure(tiles, structMeta);
    }

    // Apply handcrafted story scenario landmarks, secret shrines, starter shelter, and player deltas
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      const y = y0 + ly;
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const x = x0 + lx;
        const scenarioTile = this.getHandcraftedScenarioTile(x, y);
        if (scenarioTile !== null) {
          tiles[ly * CHUNK_SIZE + lx] = scenarioTile;
        }
        const starterTile = this.getStarterTile(x, y);
        if (starterTile !== null) {
          tiles[ly * CHUNK_SIZE + lx] = starterTile;
        }
        const dk = `${x},${y}`;
        if (this.tilesDelta[dk] !== undefined) {
          tiles[ly * CHUNK_SIZE + lx] = this.tilesDelta[dk];
        }
      }
    }

    return {
      cx,
      cy,
      tiles,
      lastUsed: this.tickCounter,
    };
  }

  private computeBaseTile(x: number, y: number): TileType {
    if (x < 3 || y < 3 || x >= WORLD_W - 3 || y >= WORLD_H - 3) {
      return TileType.ROCK;
    }

    // Main cardinal arteries + two ring tunnels so all 4 biomes & outer routes stay reliably connected
    const dx = x - SPAWN_X;
    const dy = y - SPAWN_Y;
    const dist = Math.hypot(dx, dy);
    const onHorizontalRoad = Math.abs(dy) <= 1;
    const onVerticalRoad = Math.abs(dx) <= 1;
    const onInnerRing = Math.abs(dist - 72) <= 1.2;
    const onOuterRing = Math.abs(dist - 118) <= 1.2;
    if (onHorizontalRoad || onVerticalRoad || onInnerRing || onOuterRing) {
      if (hash2D(x, y, this.worldSeed + 41) < 0.03) return TileType.MUSHROOM;
      return TileType.FLOOR;
    }

    const b = getBiomeAt(x, y, this.worldSeed);
    const caveNoise = fbm(x, y, this.worldSeed);
    const lakeNoise = fbm(x + 400, y + 400, this.worldSeed + 313);
    const r = hash2D(x, y, this.worldSeed + 17);

    // Cave walls vs open passages
    if (caveNoise > 0.67) {
      if (b === 'Magma') {
        if (r < 0.14) return TileType.MAGMA_COAL;
        if (r < 0.22) return TileType.THERMAL_COPPER;
        return TileType.VOLCANIC_ROCK;
      }
      if (b === 'Heladas') {
        if (r < 0.16) return TileType.ICE_CRYSTAL;
        if (r < 0.24) return TileType.BLUE_QUARTZ;
        if (r < 0.42) return TileType.ICE;
        return TileType.ROCK;
      }
      if (b === 'Acuaticas') {
        if (r < 0.14) return TileType.WATERFALL;
        if (r < 0.26) return TileType.BLUE_QUARTZ;
        if (r < 0.34) return TileType.ORE;
        return TileType.ROCK;
      }
      if (b === 'Cristalinas') {
        if (r < 0.22) return TileType.CRYSTAL_SPIRE;
        if (r < 0.34) return TileType.BLUE_QUARTZ;
        if (r < 0.44) return TileType.ENERGY_CRYSTAL;
        if (r < 0.465) return TileType.EVO_STONE_VEIN;
        return TileType.ROCK;
      }
      if (b === 'Sombrias') {
        if (r < 0.14) return TileType.DARK_IRON;
        if (r < 0.24) return TileType.SHADOW_CRYSTAL;
        if (r < 0.252) return TileType.EVO_STONE_VEIN;
        return TileType.ROCK;
      }
      if (r < 0.16) return TileType.ORE;
      return TileType.ROCK;
    }

    // Underground lakes & lava pools (with navigable shoreline)
    if (lakeNoise < 0.25) {
      if (b === 'Magma') return TileType.LAVA;
      if (b === 'Heladas') {
        return lakeNoise < 0.15 ? TileType.WATER : TileType.ICE_FLOOR;
      }
      if (b === 'Acuaticas') {
        if (lakeNoise > 0.222 && r < 0.22) return TileType.WATERFALL;
        return TileType.WATER;
      }
      if (b === 'Verdes' && lakeNoise > 0.225 && r < 0.08) return TileType.WATERFALL;
      return TileType.WATER;
    }
    if (lakeNoise < 0.29 && (b === 'Verdes' || b === 'Heladas' || b === 'Acuaticas') && r < 0.28) {
      return TileType.KELP;
    }

    // Biome flora, ores & crystals
    if (b === 'Verdes') {
      if (r < 0.036) return TileType.WOOD_PILLAR;
      if (r < 0.078) return TileType.ORE;
      if (r < 0.135) return TileType.MUSHROOM;
      if (r < 0.148) return TileType.ENERGY_CRYSTAL;
      return TileType.FLOOR;
    }

    if (b === 'Acuaticas') {
      if (r < 0.045) return TileType.WATER;
      if (r < 0.068) return TileType.WATERFALL;
      if (r < 0.135) return TileType.KELP;
      if (r < 0.175) return TileType.BLUE_QUARTZ;
      if (r < 0.205) return TileType.ENERGY_CRYSTAL;
      if (r < 0.23) return TileType.ORE;
      return TileType.FLOOR;
    }

    if (b === 'Magma') {
      if (r < 0.045) return TileType.LAVA;
      if (r < 0.088) return TileType.MAGMA_COAL;
      if (r < 0.12) return TileType.THERMAL_COPPER;
      if (r < 0.155) return TileType.VOLCANIC_ROCK;
      if (r < 0.175) return TileType.ORE;
      if (r < 0.188) return TileType.ENERGY_CRYSTAL;
      return TileType.FLOOR;
    }

    if (b === 'Heladas') {
      if (r < 0.05) return TileType.ICE;
      if (r < 0.09) return TileType.ICE_CRYSTAL;
      if (r < 0.122) return TileType.BLUE_QUARTZ;
      if (r < 0.155) return TileType.ORE;
      if (r < 0.28) return TileType.ICE_FLOOR;
      if (r < 0.295) return TileType.ENERGY_CRYSTAL;
      return TileType.FLOOR;
    }

    if (b === 'Cristalinas') {
      if (r < 0.046) return TileType.CRYSTAL_SPIRE;
      if (r < 0.092) return TileType.ENERGY_CRYSTAL;
      if (r < 0.132) return TileType.BLUE_QUARTZ;
      if (r < 0.165) return TileType.NEON_MUSHROOM;
      if (r < 0.195) return TileType.ORE;
      return TileType.FLOOR;
    }

    // Sombrias
    if (r < 0.042) return TileType.SHADOW_CRYSTAL;
    if (r < 0.08) return TileType.DARK_IRON;
    if (r < 0.115) return TileType.NEON_MUSHROOM;
    if (r < 0.14) return TileType.ENERGY_CRYSTAL;
    if (r < 0.17) return TileType.ORE;
    if (r < 0.185) return TileType.ANCIENT_BRICK;
    return TileType.FLOOR;
  }

  private clearEntranceApproach(tiles: Uint8Array): void {
    // Guarantee unobstructed walkable courtyard south of the structure entrance (lx 5..9, ly 12..14)
    for (let ly = 12; ly <= 14; ly++) {
      for (let lx = 5; lx <= 9; lx++) {
        tiles[ly * CHUNK_SIZE + lx] = TileType.FLOOR;
      }
    }
  }

  private getBiomeVeinTile(biome: BiomeId): TileType {
    switch (biome) {
      case 'Magma':
        return TileType.THERMAL_COPPER;
      case 'Heladas':
      case 'Acuaticas':
      case 'Cristalinas':
        return TileType.BLUE_QUARTZ;
      case 'Sombrias':
        return TileType.DARK_IRON;
      default:
        return TileType.ORE;
    }
  }

  private carveStructure(tiles: Uint8Array, meta: ChunkStructureMeta): void {
    if (meta.kind === 'secret_chamber') {
      this.carveSecretRoom(tiles);
      this.clearEntranceApproach(tiles);
      return;
    }
    if (meta.kind === 'outpost') {
      this.carveOutpost(tiles);
      this.clearEntranceApproach(tiles);
      return;
    }
    if (meta.kind === 'abandoned_mine') {
      this.carveAbandonedMine(tiles, meta.biome);
      this.clearEntranceApproach(tiles);
      return;
    }
    if (meta.kind === 'ancient_ruins') {
      this.carveAncientRuins(tiles, meta.biome);
      this.clearEntranceApproach(tiles);
      return;
    }
    this.carveCrystalChamber(tiles, meta.biome);
    this.clearEntranceApproach(tiles);
  }

  private carveSecretRoom(tiles: Uint8Array): void {
    for (let ly = 4; ly <= 11; ly++) {
      for (let lx = 4; lx <= 11; lx++) {
        const isBorder = lx === 4 || lx === 11 || ly === 4 || ly === 11;
        if (isBorder) {
          tiles[ly * CHUNK_SIZE + lx] = lx === 7 && ly === 11 ? TileType.CRACKED_WALL : TileType.ANCIENT_BRICK;
        } else {
          tiles[ly * CHUNK_SIZE + lx] = TileType.BUILT_FLOOR;
        }
      }
    }
    tiles[7 * CHUNK_SIZE + 7] = TileType.CHEST_CLOSED;
    tiles[6 * CHUNK_SIZE + 9] = TileType.ENERGY_CRYSTAL;
    tiles[9 * CHUNK_SIZE + 6] = TileType.ALTAR;
  }

  private carveOutpost(tiles: Uint8Array): void {
    for (let ly = 3; ly <= 11; ly++) {
      for (let lx = 3; lx <= 11; lx++) {
        const isBorder = lx === 3 || lx === 11 || ly === 3 || ly === 11;
        if (isBorder) {
          tiles[ly * CHUNK_SIZE + lx] = lx === 7 && ly === 11 ? TileType.DOOR_CLOSED : TileType.ANCIENT_BRICK;
        } else {
          tiles[ly * CHUNK_SIZE + lx] = TileType.BUILT_FLOOR;
        }
      }
    }
    tiles[5 * CHUNK_SIZE + 5] = TileType.TORCH;
    tiles[5 * CHUNK_SIZE + 9] = TileType.CHEST_CLOSED;
    tiles[8 * CHUNK_SIZE + 7] = TileType.RECHARGE_STATION;
  }

  private carveAbandonedMine(tiles: Uint8Array, biome: BiomeId): void {
    const vein = this.getBiomeVeinTile(biome);
    const supportWall = biome === 'Magma' ? TileType.VOLCANIC_ROCK : TileType.ROCK;
    for (let ly = 3; ly <= 11; ly++) {
      for (let lx = 3; lx <= 11; lx++) {
        const isBorder = lx === 3 || lx === 11 || ly === 3 || ly === 11;
        if (isBorder) {
          tiles[ly * CHUNK_SIZE + lx] = ly === 11 && lx >= 6 && lx <= 8 ? TileType.FLOOR : supportWall;
        } else {
          tiles[ly * CHUNK_SIZE + lx] = TileType.FLOOR;
        }
      }
    }
    tiles[4 * CHUNK_SIZE + 4] = TileType.WOOD_PILLAR;
    tiles[4 * CHUNK_SIZE + 10] = TileType.WOOD_PILLAR;
    tiles[9 * CHUNK_SIZE + 5] = TileType.TORCH;
    tiles[5 * CHUNK_SIZE + 5] = vein;
    tiles[5 * CHUNK_SIZE + 9] = vein;
    tiles[6 * CHUNK_SIZE + 7] = TileType.CHEST_CLOSED;
    tiles[8 * CHUNK_SIZE + 9] = TileType.ORE;
  }

  private carveAncientRuins(tiles: Uint8Array, biome: BiomeId): void {
    for (let ly = 3; ly <= 11; ly++) {
      for (let lx = 3; lx <= 11; lx++) {
        const isBorder = lx === 3 || lx === 11 || ly === 3 || ly === 11;
        if (isBorder) {
          const isOpenArch = ly === 11 && lx >= 6 && lx <= 8;
          tiles[ly * CHUNK_SIZE + lx] = isOpenArch ? TileType.BUILT_FLOOR : TileType.ANCIENT_BRICK;
        } else {
          tiles[ly * CHUNK_SIZE + lx] = TileType.BUILT_FLOOR;
        }
      }
    }
    tiles[5 * CHUNK_SIZE + 5] = TileType.ANCIENT_BRICK;
    tiles[5 * CHUNK_SIZE + 9] = TileType.ANCIENT_BRICK;
    tiles[4 * CHUNK_SIZE + 7] = TileType.CHEST_CLOSED;
    tiles[7 * CHUNK_SIZE + 5] = TileType.ALTAR;
    tiles[7 * CHUNK_SIZE + 9] =
      biome === 'Sombrias' ? TileType.SHADOW_CRYSTAL : TileType.ENERGY_CRYSTAL;
  }

  private carveCrystalChamber(tiles: Uint8Array, biome: BiomeId): void {
    const wallTile = biome === 'Heladas' ? TileType.ICE : biome === 'Magma' ? TileType.VOLCANIC_ROCK : TileType.ROCK;
    const secondaryCrystal =
      biome === 'Heladas'
        ? TileType.ICE_CRYSTAL
        : biome === 'Magma'
        ? TileType.MAGMA_COAL
        : biome === 'Acuaticas'
        ? TileType.BLUE_QUARTZ
        : biome === 'Cristalinas'
        ? TileType.CRYSTAL_SPIRE
        : biome === 'Sombrias'
        ? TileType.NEON_MUSHROOM
        : TileType.ENERGY_CRYSTAL;

    for (let ly = 3; ly <= 11; ly++) {
      for (let lx = 3; lx <= 11; lx++) {
        const isBorder = lx === 3 || lx === 11 || ly === 3 || ly === 11;
        if (isBorder) {
          tiles[ly * CHUNK_SIZE + lx] = ly === 11 && lx >= 6 && lx <= 8 ? TileType.FLOOR : wallTile;
        } else {
          tiles[ly * CHUNK_SIZE + lx] = TileType.FLOOR;
        }
      }
    }
    tiles[5 * CHUNK_SIZE + 5] = TileType.ENERGY_CRYSTAL;
    tiles[5 * CHUNK_SIZE + 9] = secondaryCrystal;
    tiles[7 * CHUNK_SIZE + 4] = secondaryCrystal;
    tiles[4 * CHUNK_SIZE + 7] = TileType.EVO_STONE_VEIN;
    tiles[6 * CHUNK_SIZE + 7] = TileType.CHEST_CLOSED;
  }

  private getHandcraftedScenarioTile(x: number, y: number): TileType | null {
    // 1. Caverna del Descenso (160, 140) + Pasaje Secreto hacia Estela de Will Shane (144, 142)
    if (x >= 142 && x <= 167 && y >= 133 && y <= 148) {
      // Secret western shrine alcove (142..147, 139..145)
      if (x >= 142 && x <= 147 && y >= 139 && y <= 145) {
        if (x === 144 && y === 142) return TileType.ALTAR;
        if (x === 143 && y === 140) return TileType.CHEST_CLOSED;
        if (x === 146 && y === 140) return TileType.TORCH;
        if (x === 147 && y === 142) return TileType.CRACKED_WALL; // Secret cracked barrier
        if (x === 142 || x === 147 || y === 139 || y === 145) return TileType.ANCIENT_BRICK;
        return TileType.FLOOR;
      }
      // Connecting western path from Caverna plaza to cracked passage
      if (y >= 141 && y <= 143 && x >= 148 && x <= 154) {
        return TileType.FLOOR;
      }
      // Main Caverna del Descenso clearing (154..166, 134..147)
      if (x >= 154 && x <= 166 && y >= 134 && y <= 147) {
        if ((x === 155 || x === 165) && (y === 135 || y === 145)) return TileType.TORCH;
        if (x === 164 && y === 136) return TileType.CHEST_CLOSED;
        return TileType.FLOOR;
      }
    }

    // 2. Puesto del Valle Verde (185, 160) + camino conectado desde Refugio (168..178)
    if (x >= 168 && x <= 178 && y >= 159 && y <= 161) {
      return TileType.FLOOR;
    }
    if (x >= 178 && x <= 192 && y >= 154 && y <= 166) {
      const border = x === 178 || x === 192 || y === 154 || y === 166;
      if (border) {
        if ((x === 178 || x === 192) && y === 160) return TileType.DOOR_OPEN;
        if ((y === 154 || y === 166) && x === 185) return TileType.DOOR_OPEN;
        return TileType.ANCIENT_BRICK;
      }
      if (x === 185 && y === 156) return TileType.RECHARGE_STATION;
      if (x === 190 && y === 156) return TileType.CHEST_CLOSED;
      if ((x === 180 || x === 190) && y === 164) return TileType.TORCH;
      return TileType.BUILT_FLOOR;
    }

    // 3. Puesto de Contrabando Oscuro (196, 136) + camino desde Valle Verde (185..196, 143..154)
    if (x >= 184 && x <= 197 && y >= 143 && y <= 153 && (x === 196 || y === 148)) {
      return TileType.FLOOR;
    }
    if (x >= 190 && x <= 202 && y >= 130 && y <= 142) {
      const border = x === 190 || x === 202 || y === 130 || y === 142;
      if (border) {
        if (x === 196 && y === 142) return TileType.DOOR_CLOSED;
        if (x === 196 && y === 130) return TileType.DOOR_OPEN;
        return TileType.ANCIENT_BRICK;
      }
      if (x === 192 && y === 132) return TileType.RECHARGE_STATION;
      if (x === 200 && y === 132) return TileType.CHEST_CLOSED;
      if (x === 192 && y === 140) return TileType.TORCH;
      return TileType.BUILT_FLOOR;
    }

    // 4. Santuario de Cuevas Heladas (42, 162) + Archivo Cristalino (48, 148)
    if (x >= 35 && x <= 54 && y >= 145 && y <= 169) {
      if (x >= 46 && x <= 51 && y >= 146 && y <= 153) {
        if (x === 48 && y === 148) return TileType.ALTAR;
        if (x === 49 && y === 148) return TileType.TORCH;
        if (x === 48 && y === 153) return TileType.CRACKED_WALL;
        if (x === 46 || x === 51 || y === 146 || y === 153) return TileType.ICE;
        return TileType.ICE_FLOOR;
      }
      if (y >= 154 && y <= 169 && x >= 36 && x <= 53) {
        if (x === 37 && (y === 156 || y === 167)) return TileType.ICE_CRYSTAL;
        if (x === 50 && y === 156) return TileType.CHEST_CLOSED;
        if (x === 49 && y === 166) return TileType.RECHARGE_STATION;
        if (x === 42 && y === 162) return TileType.ICE_FLOOR;
        return TileType.ICE_FLOOR;
      }
    }

    // 5. Forja de Cavernas de Magma (162, 252) + Taller Trol (148, 244) + puente hacia Acelerador
    if (x >= 145 && x <= 171 && y >= 239 && y <= 259) {
      if (x >= 146 && x <= 152 && y >= 241 && y <= 247) {
        if (x === 148 && y === 244) return TileType.ALTAR;
        if (x === 149 && y === 242) return TileType.TORCH;
        if (x === 152 && y === 244) return TileType.CRACKED_WALL;
        if (x === 146 || x === 152 || y === 241 || y === 247) return TileType.ANCIENT_BRICK;
        return TileType.BUILT_FLOOR;
      }
      if (x >= 153 && x <= 156 && y >= 243 && y <= 245) return TileType.BUILT_FLOOR;
      if (x >= 156 && x <= 169 && y >= 240 && y <= 258) {
        if ((x === 157 || x === 167) && (y === 242 || y === 256)) return TileType.TORCH;
        if (x === 167 && y === 243) return TileType.CHEST_CLOSED;
        if (x === 158 && y === 243) return TileType.RECHARGE_STATION;
        return TileType.BUILT_FLOOR;
      }
    }

    // 6. Puente y Cámara del Acelerador 200 MPH (196, 248)
    if (x >= 170 && x <= 187 && y >= 247 && y <= 249) {
      return TileType.BUILT_FLOOR;
    }
    if (x >= 187 && x <= 204 && y >= 241 && y <= 255) {
      const border = x === 187 || x === 204 || y === 241 || y === 255;
      if (border) {
        if (x === 187 && y === 248) return TileType.DOOR_OPEN;
        return TileType.ANCIENT_BRICK;
      }
      if (x === 196 && y === 244) return TileType.RECHARGE_STATION;
      if (x === 201 && y === 244) return TileType.CHEST_CLOSED;
      if ((x === 193 || x === 199) && y === 248) return TileType.ENERGY_CRYSTAL;
      if (x === 196 && y === 251) return TileType.TORCH;
      return TileType.BUILT_FLOOR;
    }

    // 7. Bastión de las Cavernas Sombrías (276, 54) + Bóveda 200 MPH (262, 66)
    if (x >= 259 && x <= 283 && y >= 46 && y <= 69) {
      if (x >= 259 && x <= 265 && y >= 63 && y <= 69) {
        if (x === 262 && y === 66) return TileType.ALTAR;
        if (x === 260 && y === 64) return TileType.TORCH;
        if (x === 262 && y === 63) return TileType.CRACKED_WALL;
        if (x === 259 || x === 265 || y === 63 || y === 69) return TileType.ANCIENT_BRICK;
        return TileType.BUILT_FLOOR;
      }
      if (x >= 262 && x <= 282 && y >= 47 && y <= 62) {
        const border = x === 262 || x === 282 || y === 47 || y === 62;
        if (border) {
          if (x === 262 && y === 54) return TileType.DOOR_OPEN;
          if (x === 262 && y === 62) return TileType.FLOOR;
          return TileType.ANCIENT_BRICK;
        }
        if (x === 265 && y === 50) return TileType.RECHARGE_STATION;
        if (x === 279 && y === 50) return TileType.CHEST_CLOSED;
        if ((x === 268 || x === 279) && y === 59) return TileType.TORCH;
        return TileType.BUILT_FLOOR;
      }
    }

    // 8. Gruta de Cavernas Acuáticas (250, 232) + Cámara Sumergida (238, 224)
    if (x >= 235 && x <= 258 && y >= 221 && y <= 239) {
      if (x >= 235 && x <= 242 && y >= 221 && y <= 227) {
        if (x === 238 && y === 224) return TileType.ALTAR;
        if (x === 237 && y === 222) return TileType.TORCH;
        if (x === 242 && y === 226) return TileType.CRACKED_WALL;
        if (x === 235 || x === 242 || y === 221 || y === 227) return TileType.ANCIENT_BRICK;
        return TileType.BUILT_FLOOR;
      }
      if (x >= 243 && x <= 257 && y >= 226 && y <= 238) {
        if ((x === 246 || x === 254) && y === 226) return TileType.WATERFALL;
        if ((x === 245 || x === 255) && y === 227) return TileType.WATER;
        if (x === 245 && y === 229) return TileType.RECHARGE_STATION;
        if (x === 255 && y === 229) return TileType.CHEST_CLOSED;
        if ((x === 244 || x === 256) && y === 236) return TileType.KELP;
        if ((x === 248 || x === 252) && y === 228) return TileType.TORCH;
        return TileType.FLOOR;
      }
    }

    // 9. Templo de Cavernas Cristalinas (78, 66) + Eco de Will Shane (89, 66)
    if (x >= 72 && x <= 92 && y >= 60 && y <= 72) {
      if (x >= 85 && x <= 92 && y >= 63 && y <= 69) {
        if (x === 89 && y === 66) return TileType.ALTAR;
        if (x === 87 && y === 64) return TileType.TORCH;
        if (x === 85 && y === 66) return TileType.CRACKED_WALL;
        if (x === 85 || x === 92 || y === 63 || y === 69) return TileType.ANCIENT_BRICK;
        return TileType.BUILT_FLOOR;
      }
      if (x >= 72 && x <= 84 && y >= 60 && y <= 72) {
        const border = x === 72 || x === 84 || y === 60 || y === 72;
        if (border) {
          if ((y === 72 && x >= 77 && x <= 79) || (x === 84 && y >= 65 && y <= 67)) return TileType.BUILT_FLOOR;
          if ((x === 72 || x === 84) && (y === 60 || y === 72)) return TileType.CRYSTAL_SPIRE;
          return TileType.ANCIENT_BRICK;
        }
        if (x === 74 && y === 62) return TileType.RECHARGE_STATION;
        if (x === 82 && y === 62) return TileType.CHEST_CLOSED;
        if ((x === 75 || x === 81) && y === 69) return TileType.TORCH;
        return TileType.BUILT_FLOOR;
      }
    }

    return null;
  }

  private getStarterTile(x: number, y: number): TileType | null {
    const dx = x - SPAWN_X;
    const dy = y - SPAWN_Y;
    if (Math.abs(dx) > 7 || Math.abs(dy) > 7) return null;

    if (Math.abs(dx) === 7 || Math.abs(dy) === 7) {
      return TileType.FLOOR;
    }

    if (Math.abs(dx) === 5 || Math.abs(dy) === 5) {
      if ((dx === 0 && dy === -5) || (dx === 0 && dy === 5) || (dx === -5 && dy === 0) || (dx === 5 && dy === 0)) {
        return TileType.DOOR_OPEN;
      }
      return TileType.WALL;
    }

    if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
      if (dx === -3 && dy === -3) return TileType.RECHARGE_STATION;
      if (dx === 3 && dy === -3) return TileType.CHEST_CLOSED;
      if (dx === -3 && dy === 3) return TileType.TORCH;
      if (dx === 3 && dy === 3) return TileType.TORCH;
      if (dx === 0 && dy === -3) return TileType.ALTAR;
      return TileType.BUILT_FLOOR;
    }

    return TileType.FLOOR;
  }
}

