import { CHUNK_SIZE, SPAWN_X, SPAWN_Y, WORLD_H, WORLD_W } from './data';
import { TileType, type BiomeId, type Chunk } from './types';

function hash2D(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
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
  // South = Magma, West = Heladas, East / Far North = Sombrias, Center/Mid = Verdes
  if (dy + warp > 54 && Math.abs(dx) < 105) return 'Magma';
  if (dx + warp < -58 && Math.abs(dy) < 105) return 'Heladas';
  if (dx + warp > 58 || dy - warp < -64 || dist > 118) return 'Sombrias';
  return 'Verdes';
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
    tile === TileType.ANCIENT_BRICK
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
      return 'Pilar de madera';
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

    // Deterministic structure check per chunk: abandoned outpost or secret chamber
    const structRoll = hash2D(cx, cy, this.worldSeed + 909);
    const isStarterChunk = cx === Math.floor(SPAWN_X / CHUNK_SIZE) && cy === Math.floor(SPAWN_Y / CHUNK_SIZE);
    const hasSecretRoom = !isStarterChunk && structRoll > 0.89 && structRoll <= 0.96;
    const hasOutpost = !isStarterChunk && structRoll > 0.96;

    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      const y = y0 + ly;
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const x = x0 + lx;
        tiles[ly * CHUNK_SIZE + lx] = this.computeBaseTile(x, y);
      }
    }

    if (hasSecretRoom) {
      this.carveSecretRoom(tiles);
    } else if (hasOutpost) {
      this.carveOutpost(tiles);
    }

    // Apply starter shelter safely over spawn area (154..166, 154..166)
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      const y = y0 + ly;
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const x = x0 + lx;
        const starterTile = this.getStarterTile(x, y);
        if (starterTile !== null) {
          tiles[ly * CHUNK_SIZE + lx] = starterTile;
        }
        // Apply player modifications
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

    // Main cardinal arteries so players can always reach all 4 biomes & bosses without deadlocks
    const onHorizontalRoad = Math.abs(y - SPAWN_Y) <= 1;
    const onVerticalRoad = Math.abs(x - SPAWN_X) <= 1;
    if (onHorizontalRoad || onVerticalRoad) {
      if (hash2D(x, y, this.worldSeed + 41) < 0.04) return TileType.MUSHROOM;
      return TileType.FLOOR;
    }

    const b = getBiomeAt(x, y, this.worldSeed);
    const caveNoise = fbm(x, y, this.worldSeed);
    const lakeNoise = fbm(x + 400, y + 400, this.worldSeed + 313);
    const r = hash2D(x, y, this.worldSeed + 17);

    // Cave walls vs open passages
    if (caveNoise > 0.67) {
      if (r < 0.14) return TileType.ORE;
      if (b === 'Sombrias' && r < 0.23) return TileType.SHADOW_CRYSTAL;
      if (b === 'Heladas' && r < 0.25) return TileType.ICE;
      return TileType.ROCK;
    }

    // Underground lakes & lava pools
    if (lakeNoise < 0.26) {
      if (b === 'Magma') return TileType.LAVA;
      if (b === 'Heladas') return TileType.ICE_FLOOR;
      return TileType.WATER;
    }

    // Biome flora, ores & crystals
    if (b === 'Verdes') {
      if (r < 0.032) return TileType.WOOD_PILLAR;
      if (r < 0.07) return TileType.ORE;
      if (r < 0.13) return TileType.MUSHROOM;
      if (r < 0.142) return TileType.ENERGY_CRYSTAL;
      return TileType.FLOOR;
    }

    if (b === 'Magma') {
      if (r < 0.055) return TileType.LAVA;
      if (r < 0.12) return TileType.ORE;
      if (r < 0.145) return TileType.ROCK;
      if (r < 0.16) return TileType.ENERGY_CRYSTAL;
      return TileType.FLOOR;
    }

    if (b === 'Heladas') {
      if (r < 0.06) return TileType.ICE;
      if (r < 0.12) return TileType.ORE;
      if (r < 0.26) return TileType.ICE_FLOOR;
      if (r < 0.28) return TileType.ENERGY_CRYSTAL;
      return TileType.FLOOR;
    }

    // Sombrias
    if (r < 0.045) return TileType.SHADOW_CRYSTAL;
    if (r < 0.075) return TileType.ENERGY_CRYSTAL;
    if (r < 0.14) return TileType.ORE;
    if (r < 0.19) return TileType.MUSHROOM;
    return TileType.FLOOR;
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

  private getStarterTile(x: number, y: number): TileType | null {
    const dx = x - SPAWN_X;
    const dy = y - SPAWN_Y;
    if (Math.abs(dx) > 7 || Math.abs(dy) > 7) return null;

    // Clear outer ring around shelter
    if (Math.abs(dx) === 7 || Math.abs(dy) === 7) {
      return TileType.FLOOR;
    }

    // Shelter walls (5-tile radius)
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
