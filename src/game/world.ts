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

export type WorldRegionKind = 'settlement' | 'dungeon' | 'enemy_base' | 'landmark';

export interface WorldRegionDef {
  id: string;
  name: string;
  kind: WorldRegionKind;
  biome: BiomeId;
  x: number;
  y: number;
  radius: number;
  description: string;
  scenarioId?: string;
}

export const WORLD_REGIONS: WorldRegionDef[] = [
  // ---- 5 ASENTAMIENTOS ----
  {
    id: 'reg_refugio_shane',
    name: 'Refugio Shane',
    kind: 'settlement',
    biome: 'Verdes',
    x: 160,
    y: 160,
    radius: 12,
    description: 'Base familiar de Eli Shane con hábitats vivos, estación de recarga y pasarela al valle.',
    scenarioId: 'esc_refugio_shane',
  },
  {
    id: 'reg_valle_verde',
    name: 'Puesto del Valle Verde',
    kind: 'settlement',
    biome: 'Verdes',
    x: 185,
    y: 160,
    radius: 11,
    description: 'Asentamiento comercial de adoquín donde se reúnen Kord, Trixie y los viajeros.',
    scenarioId: 'esc_pueblo_valle_verde',
  },
  {
    id: 'reg_marea_azul',
    name: 'Aldea Marea Azul',
    kind: 'settlement',
    biome: 'Acuaticas',
    x: 242,
    y: 206,
    radius: 11,
    description: 'Poblado palafítico junto a lagunas luminosas conectado por puentes colgantes.',
  },
  {
    id: 'reg_camp_termal',
    name: 'Campamento Termal Trol',
    kind: 'settlement',
    biome: 'Magma',
    x: 134,
    y: 234,
    radius: 11,
    description: 'Campamento fortificado con hogueras y pilares de basalto antes de la gran fragua.',
  },
  {
    id: 'reg_vigia_prisma',
    name: 'Vigía del Cuarto Prisma',
    kind: 'settlement',
    biome: 'Cristalinas',
    x: 104,
    y: 88,
    radius: 10,
    description: 'Puesto avanzado cristalino elevado sobre acantilados de cuarzo resonante.',
  },

  // ---- 6 MAZMORRAS / TEMPLOS / RUINAS PRINCIPALES ----
  {
    id: 'reg_santuario_musgo',
    name: 'Santuario de Musgo Antiguo',
    kind: 'dungeon',
    biome: 'Verdes',
    x: 132,
    y: 178,
    radius: 10,
    description: 'Ruinas cubiertas de hiedra luminosa y pilares grabados al suroeste del refugio.',
  },
  {
    id: 'reg_ruinas_cascada',
    name: 'Ruinas Sumergidas de la Cascada',
    kind: 'dungeon',
    biome: 'Acuaticas',
    x: 250,
    y: 232,
    radius: 12,
    description: 'Templo rodeado de cascadas cian brillantes donde habita el Leviatán Abisal.',
    scenarioId: 'esc_gruta_acuatica',
  },
  {
    id: 'reg_catacumba_glacial',
    name: 'Catacumba del Santuario Helado',
    kind: 'dungeon',
    biome: 'Heladas',
    x: 42,
    y: 162,
    radius: 12,
    description: 'Cámara milenaria de hielo y cristal custodiada por la Reina Glaciomita.',
    scenarioId: 'esc_caverna_helada',
  },
  {
    id: 'reg_fragua_magma',
    name: 'Forja de Cavernas de Magma',
    kind: 'dungeon',
    biome: 'Magma',
    x: 162,
    y: 252,
    radius: 12,
    description: 'Antigua fragua subterránea rodeada de magma y vigilada por el Titán Piroclasto.',
    scenarioId: 'esc_forja_magma',
  },
  {
    id: 'reg_templo_cuarzo',
    name: 'Templo de Cuarzo Resonante',
    kind: 'dungeon',
    biome: 'Cristalinas',
    x: 78,
    y: 66,
    radius: 12,
    description: 'Santuario sagrado de cristal donde resuena el eco de Will Shane y el Oráculo Prisma.',
    scenarioId: 'esc_templo_cristalino',
  },
  {
    id: 'reg_galeria_ecos',
    name: 'Galería de Ecos Antiguos',
    kind: 'dungeon',
    biome: 'Sombrias',
    x: 230,
    y: 82,
    radius: 11,
    description: 'Corredor ceremonial oscuro iluminado por hongos neón y obeliscos de sombra.',
  },

  // ---- 5 BASES E INSTALACIONES ENEMIGAS ----
  {
    id: 'reg_puesto_contrabando',
    name: 'Puesto de Contrabando Oscuro',
    kind: 'enemy_base',
    biome: 'Verdes',
    x: 196,
    y: 136,
    radius: 10,
    description: 'Fortín clandestino controlado por Garfio Rojo y traficantes de babosas malvadas.',
    scenarioId: 'esc_puesto_agua_oscura',
  },
  {
    id: 'reg_muelle_oscuro',
    name: 'Muelle de Agua Oscura',
    kind: 'enemy_base',
    biome: 'Acuaticas',
    x: 270,
    y: 212,
    radius: 10,
    description: 'Dique de carga donde Blakk Industries embarca contenedores corruptos.',
  },
  {
    id: 'reg_planta_termica',
    name: 'Cámara del Acelerador 200 MPH',
    kind: 'enemy_base',
    biome: 'Magma',
    x: 196,
    y: 248,
    radius: 11,
    description: 'Complejo de ingeniería térmica conectado por puentes sobre la lava.',
    scenarioId: 'esc_taller_acelerador',
  },
  {
    id: 'reg_torre_voltaica',
    name: 'Torre de Bloqueo Voltaico',
    kind: 'enemy_base',
    biome: 'Cristalinas',
    x: 56,
    y: 98,
    radius: 10,
    description: 'Emplazamiento de mercenarios que drenan la energía de las agujas de cuarzo.',
  },
  {
    id: 'reg_bastion_sombrio',
    name: 'Bastión de las Cavernas Sombrías',
    kind: 'enemy_base',
    biome: 'Sombrias',
    x: 276,
    y: 54,
    radius: 13,
    description: 'Cuartel principal del Dr. Blakk protegido por murallas y puentes sobre abismos.',
    scenarioId: 'esc_bastion_sombrio',
  },

  // ---- 26 PUNTOS DE REFERENCIA, PUENTES, CASCADAS Y MIRADORES ----
  { id: 'reg_caverna_descenso', name: 'Caverna del Descenso', kind: 'landmark', biome: 'Verdes', x: 160, y: 140, radius: 9, description: 'Punto de caída desde la superficie hacia las 99 Cavernas.', scenarioId: 'esc_caverna_descenso' },
  { id: 'reg_puente_abismo_verde', name: 'Puente Colgante del Abismo', kind: 'landmark', biome: 'Verdes', x: 160, y: 120, radius: 7, description: 'Pasarela de cuerdas suspendida sobre una profunda grieta verdosa.' },
  { id: 'reg_arboleda_esporas', name: 'Arboleda Bioluminiscente', kind: 'landmark', biome: 'Verdes', x: 140, y: 124, radius: 8, description: 'Bosquecillo de hongos gigantes cian y esporas flotantes.' },
  { id: 'reg_mirador_musgo', name: 'Mirador del Valle Sur', kind: 'landmark', biome: 'Verdes', x: 178, y: 184, radius: 8, description: 'Acantilado elevado con hoguera de orientación hacia las grutas acuáticas.' },
  { id: 'reg_paso_rio', name: 'Paso del Río Subterráneo', kind: 'landmark', biome: 'Verdes', x: 212, y: 186, radius: 7, description: 'Puente de madera sobre corrientes que descienden hacia Marea Azul.' },
  { id: 'reg_puente_marea', name: 'Puente de Marea Alta', kind: 'landmark', biome: 'Acuaticas', x: 226, y: 224, radius: 7, description: 'Cruza las lagunas profundas de caverna en dirección a las ruinas.' },
  { id: 'reg_catarata_luminosa', name: 'Catarata Luminosa', kind: 'landmark', biome: 'Acuaticas', x: 264, y: 244, radius: 8, description: 'Caída de agua resplandeciente con bruma continua.' },
  { id: 'reg_laguna_perlas', name: 'Laguna de Cristal Líquido', kind: 'landmark', biome: 'Acuaticas', x: 278, y: 258, radius: 8, description: 'Remanso tranquilo rico en minerales azules y babosas de agua.' },
  { id: 'reg_bahia_kelp', name: 'Bahía de Algas Gigantes', kind: 'landmark', biome: 'Acuaticas', x: 228, y: 254, radius: 8, description: 'Orilla cubierta de vegetación acuática fluorescente.' },
  { id: 'reg_puente_deshielo', name: 'Puente del Deshielo', kind: 'landmark', biome: 'Heladas', x: 84, y: 160, radius: 7, description: 'Puente de madera tensada sobre la sima helada occidental.' },
  { id: 'reg_garganta_escarcha', name: 'Garganta de Escarcha', kind: 'landmark', biome: 'Heladas', x: 64, y: 176, radius: 8, description: 'Paso escarpado flanqueado por bloques y cristales glaciales.' },
  { id: 'reg_lago_espejo', name: 'Lago Espejo Helado', kind: 'landmark', biome: 'Heladas', x: 34, y: 138, radius: 9, description: 'Superficie congelada reflectante bajo columnas de hielo.' },
  { id: 'reg_escalinata_norte', name: 'Escalinata del Ventisquero', kind: 'landmark', biome: 'Heladas', x: 54, y: 130, radius: 7, description: 'Tramo de escaleras antiguas que ascienden hacia las Cavernas Cristalinas.' },
  { id: 'reg_calzada_basalto', name: 'Calzada de Basalto Hexagonal', kind: 'landmark', biome: 'Magma', x: 160, y: 214, radius: 8, description: 'Sendero de columnas volcánicas que cruza el umbral ardiente.' },
  { id: 'reg_puente_grieta', name: 'Puente sobre la Grieta Ígnea', kind: 'landmark', biome: 'Magma', x: 178, y: 232, radius: 7, description: 'Pasarela colgante reforzada sobre un canal de lava activa.' },
  { id: 'reg_caldera_obsidiana', name: 'Caldera de Obsidiana', kind: 'landmark', biome: 'Magma', x: 140, y: 266, radius: 9, description: 'Cráter humeante rico en cobre térmico y carbón de magma.' },
  { id: 'reg_rio_escoria', name: 'Mirador del Río de Escoria', kind: 'landmark', biome: 'Magma', x: 192, y: 268, radius: 8, description: 'Plataforma rocosa sobre los lagos incandescentes del sur.' },
  { id: 'reg_sendero_agujas', name: 'Sendero de Agujas Azules', kind: 'landmark', biome: 'Cristalinas', x: 108, y: 108, radius: 8, description: 'Avenida flanqueada por espiras de cuarzo luminoso.' },
  { id: 'reg_puente_cuarzo', name: 'Puente del Precipicio Cuarzo', kind: 'landmark', biome: 'Cristalinas', x: 92, y: 86, radius: 7, description: 'Conecta la Vigía del Prisma con las escaleras hacia el templo.' },
  { id: 'reg_anfiteatro_resonante', name: 'Anfiteatro Resonante', kind: 'landmark', biome: 'Cristalinas', x: 64, y: 74, radius: 8, description: 'Cavidad acústica natural usada para entrenar velocidad 200 MPH.' },
  { id: 'reg_invernadero_neon', name: 'Jardín de Hongos Neón', kind: 'landmark', biome: 'Cristalinas', x: 96, y: 52, radius: 8, description: 'Gruta húmeda donde florecen hongos bioluminiscentes violetas.' },
  { id: 'reg_sima_lamentos', name: 'Sima de los Lamentos', kind: 'landmark', biome: 'Sombrias', x: 216, y: 98, radius: 8, description: 'Borde de un profundo abismo envuelto en neblina violeta.' },
  { id: 'reg_puente_negro', name: 'Puente de Piedra Negra', kind: 'landmark', biome: 'Sombrias', x: 246, y: 68, radius: 7, description: 'Acceso angosto hacia el Bastión del Comandante Blakk.' },
  { id: 'reg_paramo_maldito', name: 'Páramo de Cristales Malditos', kind: 'landmark', biome: 'Sombrias', x: 254, y: 92, radius: 9, description: 'Llanura corrupta saturada de minerales oscuros.' },
  { id: 'reg_acantilado_eclipse', name: 'Acantilado del Eclipse', kind: 'landmark', biome: 'Sombrias', x: 288, y: 80, radius: 8, description: 'Balcón rocoso orientado hacia el santuario abisal oriental.' },
  { id: 'reg_gran_falla', name: 'Cruce de la Gran Falla', kind: 'landmark', biome: 'Sombrias', x: 196, y: 96, radius: 8, description: 'Intersección entre el norte de Cuevas Verdes y la frontera sombría.' },
];

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
    tile === TileType.CRYSTAL_SPIRE ||
    tile === TileType.CHASM ||
    tile === TileType.RUIN_PILLAR ||
    tile === TileType.BASALT_COLUMN ||
    tile === TileType.CAMPFIRE
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
      return 'Acantilado / Roca';
    case TileType.WOOD_PILLAR:
      return 'Pilar de madera y raíces';
    case TileType.MUSHROOM:
      return 'Racimo de hongos luminosos';
    case TileType.ORE:
      return 'Veta de mineral';
    case TileType.CRACKED_WALL:
      return 'Muro agrietado secreto';
    case TileType.LAVA:
      return 'Río de lava';
    case TileType.ICE:
      return 'Bloque de hielo';
    case TileType.SHADOW_CRYSTAL:
      return 'Cristal sombrío';
    case TileType.WALL:
      return 'Muralla de madera y piedra';
    case TileType.BUILT_FLOOR:
      return 'Suelo de madera tratada';
    case TileType.RECHARGE_STATION:
      return 'Estación de recarga';
    case TileType.ENERGY_CRYSTAL:
      return 'Cristal de energía';
    case TileType.TORCH:
      return 'Antorcha de caverna';
    case TileType.DOOR_CLOSED:
      return 'Puerta cerrada';
    case TileType.DOOR_OPEN:
      return 'Puerta abierta';
    case TileType.CHEST_CLOSED:
      return 'Cofre del subsuelo';
    case TileType.CHEST_OPEN:
      return 'Cofre abierto';
    case TileType.ALTAR:
      return 'Altar rúnico antiguo';
    case TileType.ICE_FLOOR:
      return 'Suelo helado';
    case TileType.ANCIENT_BRICK:
      return 'Muro de ruinas antiguas';
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
      return 'Acantilado volcánico';
    case TileType.EVO_STONE_VEIN:
      return 'Veta de Piedra Evolutiva';
    case TileType.WATERFALL:
      return 'Cascada subterránea';
    case TileType.CRYSTAL_SPIRE:
      return 'Aguja cristalina';
    case TileType.CHASM:
      return 'Abismo subterráneo';
    case TileType.ROPE_BRIDGE:
      return 'Puente colgante de madera';
    case TileType.WOOD_STAIRS:
      return 'Escalera de madera';
    case TileType.COBBLESTONE:
      return 'Calzada de adoquín';
    case TileType.RUIN_PILLAR:
      return 'Pilar de ruina antigua';
    case TileType.BASALT_COLUMN:
      return 'Columna de basalto';
    case TileType.CAMPFIRE:
      return 'Hoguera de campamento';
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

    const dx = x - SPAWN_X;
    const dy = y - SPAWN_Y;
    const dist = Math.hypot(dx, dy);
    // Natural sinuous curve outside central shelter corridor so roads wind like real cavern galleries
    const waveX = dist > 26 ? Math.sin(y * 0.085) * 3.2 : 0;
    const waveY = dist > 26 ? Math.cos(x * 0.085) * 3.2 : 0;
    const onHorizontalRoad = Math.abs(dy + waveY) <= 1.5;
    const onVerticalRoad = Math.abs(dx + waveX) <= 1.5;
    const ringNoise = Math.sin(Math.atan2(dy, dx) * 5) * 3.5;
    const onInnerRing = Math.abs(dist - (72 + ringNoise)) <= 1.6;
    const onOuterRing = Math.abs(dist - (118 + ringNoise)) <= 1.6;

    const b = getBiomeAt(x, y, this.worldSeed);
    const caveNoise = fbm(x, y, this.worldSeed);
    const lakeNoise = fbm(x + 400, y + 400, this.worldSeed + 313);
    const chasmBand = smoothNoise(x * 0.045, y * 0.045, this.worldSeed + 881);
    const r = hash2D(x, y, this.worldSeed + 17);

    // Chasm ravines in deep zones; main arteries cross them via sturdy wooden ROPE_BRIDGEs!
    const inChasmTrench =
      dist > 34 &&
      ((chasmBand > 0.77 && chasmBand < 0.83) ||
        (Math.abs(dist - 40) <= 1.3 && Math.abs(dx) < 8 && dy < 0) ||
        (Math.abs(dx + 76) <= 1.4 && Math.abs(dy) < 9));

    if (onHorizontalRoad || onVerticalRoad || onInnerRing || onOuterRing) {
      if (inChasmTrench) return TileType.ROPE_BRIDGE;
      if (r < 0.032) return TileType.MUSHROOM;
      if (r < 0.055 && (onInnerRing || dist < 34)) return TileType.COBBLESTONE;
      return TileType.FLOOR;
    }

    if (inChasmTrench && caveNoise < 0.65) {
      return TileType.CHASM;
    }

    // Organic cliff walls and mineral formations
    if (caveNoise > 0.66) {
      if (b === 'Magma') {
        if (r < 0.14) return TileType.MAGMA_COAL;
        if (r < 0.22) return TileType.THERMAL_COPPER;
        if (r < 0.34) return TileType.BASALT_COLUMN;
        return TileType.VOLCANIC_ROCK;
      }
      if (b === 'Heladas') {
        if (r < 0.16) return TileType.ICE_CRYSTAL;
        if (r < 0.24) return TileType.BLUE_QUARTZ;
        if (r < 0.42) return TileType.ICE;
        return TileType.ROCK;
      }
      if (b === 'Acuaticas') {
        if (r < 0.16) return TileType.WATERFALL;
        if (r < 0.28) return TileType.BLUE_QUARTZ;
        if (r < 0.36) return TileType.ORE;
        return TileType.ROCK;
      }
      if (b === 'Cristalinas') {
        if (r < 0.24) return TileType.CRYSTAL_SPIRE;
        if (r < 0.36) return TileType.BLUE_QUARTZ;
        if (r < 0.46) return TileType.ENERGY_CRYSTAL;
        if (r < 0.485) return TileType.EVO_STONE_VEIN;
        return TileType.ROCK;
      }
      if (b === 'Sombrias') {
        if (r < 0.14) return TileType.DARK_IRON;
        if (r < 0.25) return TileType.SHADOW_CRYSTAL;
        if (r < 0.32) return TileType.RUIN_PILLAR;
        if (r < 0.335) return TileType.EVO_STONE_VEIN;
        return TileType.ROCK;
      }
      if (r < 0.15) return TileType.ORE;
      if (r < 0.2) return TileType.RUIN_PILLAR;
      return TileType.ROCK;
    }

    // Underground lakes, waterfalls & lava rivers
    if (lakeNoise < 0.25) {
      if (b === 'Magma') return TileType.LAVA;
      if (b === 'Heladas') {
        return lakeNoise < 0.15 ? TileType.WATER : TileType.ICE_FLOOR;
      }
      if (b === 'Acuaticas') {
        if (lakeNoise > 0.22 && r < 0.24) return TileType.WATERFALL;
        return TileType.WATER;
      }
      if (b === 'Verdes' && lakeNoise > 0.225 && r < 0.09) return TileType.WATERFALL;
      return TileType.WATER;
    }
    if (lakeNoise < 0.29 && (b === 'Verdes' || b === 'Heladas' || b === 'Acuaticas') && r < 0.28) {
      return TileType.KELP;
    }

    // Lush biome props, glowing mushroom clusters, basalt, ruins & flora
    if (b === 'Verdes') {
      if (r < 0.032) return TileType.WOOD_PILLAR;
      if (r < 0.056) return TileType.RUIN_PILLAR;
      if (r < 0.088) return TileType.ORE;
      if (r < 0.155) return TileType.MUSHROOM;
      if (r < 0.168) return TileType.ENERGY_CRYSTAL;
      return TileType.FLOOR;
    }

    if (b === 'Acuaticas') {
      if (r < 0.045) return TileType.WATER;
      if (r < 0.072) return TileType.WATERFALL;
      if (r < 0.145) return TileType.KELP;
      if (r < 0.185) return TileType.BLUE_QUARTZ;
      if (r < 0.215) return TileType.MUSHROOM;
      if (r < 0.24) return TileType.ORE;
      return TileType.FLOOR;
    }

    if (b === 'Magma') {
      if (r < 0.045) return TileType.LAVA;
      if (r < 0.085) return TileType.MAGMA_COAL;
      if (r < 0.118) return TileType.BASALT_COLUMN;
      if (r < 0.148) return TileType.THERMAL_COPPER;
      if (r < 0.175) return TileType.VOLCANIC_ROCK;
      if (r < 0.19) return TileType.ENERGY_CRYSTAL;
      return TileType.FLOOR;
    }

    if (b === 'Heladas') {
      if (r < 0.05) return TileType.ICE;
      if (r < 0.09) return TileType.ICE_CRYSTAL;
      if (r < 0.125) return TileType.BLUE_QUARTZ;
      if (r < 0.155) return TileType.ORE;
      if (r < 0.285) return TileType.ICE_FLOOR;
      if (r < 0.3) return TileType.ENERGY_CRYSTAL;
      return TileType.FLOOR;
    }

    if (b === 'Cristalinas') {
      if (r < 0.052) return TileType.CRYSTAL_SPIRE;
      if (r < 0.098) return TileType.ENERGY_CRYSTAL;
      if (r < 0.14) return TileType.BLUE_QUARTZ;
      if (r < 0.175) return TileType.NEON_MUSHROOM;
      if (r < 0.205) return TileType.RUIN_PILLAR;
      return TileType.FLOOR;
    }

    // Sombrias
    if (r < 0.046) return TileType.SHADOW_CRYSTAL;
    if (r < 0.082) return TileType.DARK_IRON;
    if (r < 0.122) return TileType.NEON_MUSHROOM;
    if (r < 0.148) return TileType.RUIN_PILLAR;
    if (r < 0.178) return TileType.ORE;
    return TileType.FLOOR;
  }

  private clearEntranceApproach(tiles: Uint8Array): void {
    for (let ly = 12; ly <= 14; ly++) {
      for (let lx = 5; lx <= 9; lx++) {
        tiles[ly * CHUNK_SIZE + lx] = lx === 7 ? TileType.COBBLESTONE : TileType.FLOOR;
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
    // Organic octagonal ancient vault (instead of boxy square)
    for (let ly = 3; ly <= 11; ly++) {
      for (let lx = 3; lx <= 11; lx++) {
        const d = Math.hypot(lx - 7, ly - 7);
        if (d > 4.6) continue;
        if (d > 3.5) {
          tiles[ly * CHUNK_SIZE + lx] = lx === 7 && ly === 11 ? TileType.CRACKED_WALL : TileType.ANCIENT_BRICK;
        } else {
          tiles[ly * CHUNK_SIZE + lx] = TileType.COBBLESTONE;
        }
      }
    }
    tiles[7 * CHUNK_SIZE + 7] = TileType.ALTAR;
    tiles[5 * CHUNK_SIZE + 7] = TileType.CHEST_CLOSED;
    tiles[6 * CHUNK_SIZE + 9] = TileType.ENERGY_CRYSTAL;
    tiles[9 * CHUNK_SIZE + 5] = TileType.TORCH;
  }

  private carveOutpost(tiles: Uint8Array): void {
    // Timber-and-stone organic camp plaza + campfire + stairs
    for (let ly = 2; ly <= 12; ly++) {
      for (let lx = 2; lx <= 12; lx++) {
        const d = Math.hypot(lx - 7, ly - 7);
        if (d > 5.4) continue;
        if (d > 4.2 && ly < 10) {
          tiles[ly * CHUNK_SIZE + lx] = TileType.WALL;
        } else {
          tiles[ly * CHUNK_SIZE + lx] = d < 2.6 ? TileType.COBBLESTONE : TileType.BUILT_FLOOR;
        }
      }
    }
    tiles[11 * CHUNK_SIZE + 7] = TileType.WOOD_STAIRS;
    tiles[7 * CHUNK_SIZE + 7] = TileType.CAMPFIRE;
    tiles[5 * CHUNK_SIZE + 5] = TileType.WOOD_PILLAR;
    tiles[5 * CHUNK_SIZE + 9] = TileType.CHEST_CLOSED;
    tiles[8 * CHUNK_SIZE + 5] = TileType.RECHARGE_STATION;
  }

  private carveAbandonedMine(tiles: Uint8Array, biome: BiomeId): void {
    const vein = this.getBiomeVeinTile(biome);
    const supportWall = biome === 'Magma' ? TileType.VOLCANIC_ROCK : TileType.ROCK;
    for (let ly = 2; ly <= 12; ly++) {
      for (let lx = 2; lx <= 12; lx++) {
        const d = Math.hypot(lx - 7, ly - 7);
        if (d > 5.3) continue;
        if (d > 4.2 && !(ly >= 10 && lx >= 6 && lx <= 8)) {
          tiles[ly * CHUNK_SIZE + lx] = supportWall;
        } else {
          tiles[ly * CHUNK_SIZE + lx] = TileType.FLOOR;
        }
      }
    }
    tiles[5 * CHUNK_SIZE + 4] = TileType.WOOD_PILLAR;
    tiles[5 * CHUNK_SIZE + 10] = TileType.WOOD_PILLAR;
    tiles[9 * CHUNK_SIZE + 6] = TileType.TORCH;
    tiles[5 * CHUNK_SIZE + 6] = vein;
    tiles[5 * CHUNK_SIZE + 8] = vein;
    tiles[7 * CHUNK_SIZE + 7] = TileType.CHEST_CLOSED;
  }

  private carveAncientRuins(tiles: Uint8Array, biome: BiomeId): void {
    // Circular temple colonnade with ruined pillars & rune altar
    for (let ly = 2; ly <= 12; ly++) {
      for (let lx = 2; lx <= 12; lx++) {
        const d = Math.hypot(lx - 7, ly - 7);
        if (d > 5.5) continue;
        if (d > 4.3 && !(ly >= 10 && lx >= 6 && lx <= 8)) {
          tiles[ly * CHUNK_SIZE + lx] = TileType.ANCIENT_BRICK;
        } else {
          tiles[ly * CHUNK_SIZE + lx] = d < 3.0 ? TileType.COBBLESTONE : TileType.BUILT_FLOOR;
        }
      }
    }
    tiles[5 * CHUNK_SIZE + 5] = TileType.RUIN_PILLAR;
    tiles[5 * CHUNK_SIZE + 9] = TileType.RUIN_PILLAR;
    tiles[9 * CHUNK_SIZE + 5] = TileType.RUIN_PILLAR;
    tiles[9 * CHUNK_SIZE + 9] = TileType.RUIN_PILLAR;
    tiles[4 * CHUNK_SIZE + 7] = TileType.CHEST_CLOSED;
    tiles[7 * CHUNK_SIZE + 7] = TileType.ALTAR;
    tiles[7 * CHUNK_SIZE + 10] =
      biome === 'Sombrias' ? TileType.SHADOW_CRYSTAL : TileType.ENERGY_CRYSTAL;
  }

  private carveCrystalChamber(tiles: Uint8Array, biome: BiomeId): void {
    const wallTile = biome === 'Heladas' ? TileType.ICE : biome === 'Magma' ? TileType.VOLCANIC_ROCK : TileType.ROCK;
    const secondaryCrystal =
      biome === 'Heladas'
        ? TileType.ICE_CRYSTAL
        : biome === 'Magma'
        ? TileType.BASALT_COLUMN
        : biome === 'Acuaticas'
        ? TileType.BLUE_QUARTZ
        : biome === 'Cristalinas'
        ? TileType.CRYSTAL_SPIRE
        : biome === 'Sombrias'
        ? TileType.NEON_MUSHROOM
        : TileType.MUSHROOM;

    for (let ly = 2; ly <= 12; ly++) {
      for (let lx = 2; lx <= 12; lx++) {
        const d = Math.hypot(lx - 7, ly - 7);
        if (d > 5.4) continue;
        if (d > 4.2 && !(ly >= 10 && lx >= 6 && lx <= 8)) {
          tiles[ly * CHUNK_SIZE + lx] = wallTile;
        } else {
          tiles[ly * CHUNK_SIZE + lx] = TileType.FLOOR;
        }
      }
    }
    tiles[5 * CHUNK_SIZE + 5] = TileType.ENERGY_CRYSTAL;
    tiles[5 * CHUNK_SIZE + 9] = secondaryCrystal;
    tiles[8 * CHUNK_SIZE + 4] = secondaryCrystal;
    tiles[4 * CHUNK_SIZE + 7] = TileType.EVO_STONE_VEIN;
    tiles[6 * CHUNK_SIZE + 7] = TileType.CHEST_CLOSED;
  }

  private getHandcraftedScenarioTile(x: number, y: number): TileType | null {
    // 0. Organic cobblestone terrace & mushroom lantern grove around Starter Refugio Shane (radius 7..13)
    const sd = Math.hypot(x - SPAWN_X, y - SPAWN_Y);
    if (sd > 6.5 && sd <= 12.5) {
      if (Math.abs(y - SPAWN_Y) <= 1 && x >= SPAWN_X + 6) return TileType.COBBLESTONE;
      if (Math.abs(x - SPAWN_X) <= 1 && y <= SPAWN_Y - 6) return TileType.COBBLESTONE;
      if ((x === SPAWN_X - 8 && y === SPAWN_Y + 4) || (x === SPAWN_X + 8 && y === SPAWN_Y + 4)) return TileType.CAMPFIRE;
      if ((x === SPAWN_X - 9 || x === SPAWN_X + 9) && y === SPAWN_Y - 5) return TileType.MUSHROOM;
    }

    // 1. Caverna del Descenso (160, 140) + Pasaje Secreto hacia Estela de Will Shane (144, 142)
    if (x >= 142 && x <= 167 && y >= 133 && y <= 148) {
      if (x >= 142 && x <= 147 && y >= 139 && y <= 145) {
        if (x === 144 && y === 142) return TileType.ALTAR;
        if (x === 143 && y === 140) return TileType.CHEST_CLOSED;
        if (x === 146 && y === 140) return TileType.TORCH;
        if (x === 147 && y === 142) return TileType.CRACKED_WALL;
        if (x === 142 || x === 147 || y === 139 || y === 145) return TileType.ANCIENT_BRICK;
        return TileType.COBBLESTONE;
      }
      if (y >= 141 && y <= 143 && x >= 148 && x <= 154) {
        return TileType.COBBLESTONE;
      }
      if (x >= 154 && x <= 166 && y >= 134 && y <= 147) {
        if (x === 160 && y === 134) return TileType.WOOD_STAIRS;
        if ((x === 155 || x === 165) && (y === 135 || y === 145)) return TileType.RUIN_PILLAR;
        if (x === 156 && y === 144) return TileType.CAMPFIRE;
        if (x === 164 && y === 136) return TileType.CHEST_CLOSED;
        return Math.hypot(x - 160, y - 140) < 3.5 ? TileType.COBBLESTONE : TileType.FLOOR;
      }
    }

    // 1b. Scenic Chasm & Wooden Rope Bridge N of Caverna del Descenso (160, 120)
    if (x >= 151 && x <= 169 && y >= 117 && y <= 123) {
      if (Math.abs(x - 160) <= 1) return TileType.ROPE_BRIDGE;
      if (y >= 118 && y <= 122) return TileType.CHASM;
    }

    // 2. Puesto del Valle Verde (185, 160) + cobblestone plaza + camino desde Refugio (168..178)
    if (x >= 168 && x <= 178 && y >= 159 && y <= 161) {
      return TileType.COBBLESTONE;
    }
    if (x >= 178 && x <= 192 && y >= 154 && y <= 166) {
      const border = x === 178 || x === 192 || y === 154 || y === 166;
      if (border) {
        if ((x === 178 || x === 192) && y === 160) return TileType.DOOR_OPEN;
        if ((y === 154 || y === 166) && x === 185) return TileType.DOOR_OPEN;
        if ((x === 178 || x === 192) && (y === 154 || y === 166)) return TileType.RUIN_PILLAR;
        return TileType.WALL;
      }
      if (x === 185 && y === 156) return TileType.RECHARGE_STATION;
      if (x === 190 && y === 156) return TileType.CHEST_CLOSED;
      if (x === 181 && y === 162) return TileType.CAMPFIRE;
      if (x === 189 && y === 162) return TileType.TORCH;
      if (Math.hypot(x - 185, y - 160) <= 2.3) return TileType.COBBLESTONE;
      return TileType.BUILT_FLOOR;
    }

    // 3. Puesto de Contrabando Oscuro (196, 136) + camino desde Valle Verde
    if (x >= 184 && x <= 197 && y >= 143 && y <= 153 && (x === 196 || y === 148)) {
      return TileType.COBBLESTONE;
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
      if (x === 192 && y === 140) return TileType.CAMPFIRE;
      return TileType.BUILT_FLOOR;
    }

    // 4. Santuario de Cuevas Heladas (42, 162) + Archivo Cristalino (48, 148) + Puente del Deshielo (84, 160)
    if (x >= 80 && x <= 88 && y >= 156 && y <= 164) {
      if (Math.abs(y - 160) <= 1) return TileType.ROPE_BRIDGE;
      if (x >= 82 && x <= 86) return TileType.CHASM;
    }
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
        if (x === 38 && y === 162) return TileType.CAMPFIRE;
        return TileType.ICE_FLOOR;
      }
    }

    // 5. Forja de Cavernas de Magma (162, 252) + Taller Trol (148, 244)
    if (x >= 145 && x <= 171 && y >= 239 && y <= 259) {
      if (x >= 146 && x <= 152 && y >= 241 && y <= 247) {
        if (x === 148 && y === 244) return TileType.ALTAR;
        if (x === 149 && y === 242) return TileType.TORCH;
        if (x === 152 && y === 244) return TileType.CRACKED_WALL;
        if (x === 146 || x === 152 || y === 241 || y === 247) return TileType.ANCIENT_BRICK;
        return TileType.BUILT_FLOOR;
      }
      if (x >= 153 && x <= 156 && y >= 243 && y <= 245) return TileType.COBBLESTONE;
      if (x >= 156 && x <= 169 && y >= 240 && y <= 258) {
        if ((x === 157 || x === 167) && (y === 242 || y === 256)) return TileType.BASALT_COLUMN;
        if (x === 167 && y === 243) return TileType.CHEST_CLOSED;
        if (x === 158 && y === 243) return TileType.RECHARGE_STATION;
        return TileType.BUILT_FLOOR;
      }
    }

    // 6. Puente colgante sobre lava + Cámara del Acelerador 200 MPH (196, 248)
    if (x >= 170 && x <= 187 && y >= 245 && y <= 251) {
      if (y >= 247 && y <= 249) return x >= 174 && x <= 183 ? TileType.ROPE_BRIDGE : TileType.COBBLESTONE;
      if (x >= 174 && x <= 183) return TileType.LAVA;
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

    // 7. Bastión de las Cavernas Sombrías (276, 54) + Bóveda 200 MPH (262, 66) + Puente Negro (246, 68)
    if (x >= 242 && x <= 250 && y >= 64 && y <= 72) {
      if (Math.abs(y - 68) <= 1) return TileType.ROPE_BRIDGE;
      if (x >= 244 && x <= 248) return TileType.CHASM;
    }
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

    // 8. Gruta de Cavernas Acuáticas (250, 232) + Cámara Sumergida (238, 224) + Puente Marea (226, 224)
    if (x >= 222 && x <= 230 && y >= 220 && y <= 228) {
      if (Math.abs(y - 224) <= 1) return TileType.ROPE_BRIDGE;
      if (x >= 224 && x <= 228) return TileType.WATER;
    }
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
        return TileType.COBBLESTONE;
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
        return TileType.COBBLESTONE;
      }
    }

    // 10. NUEVOS ASENTAMIENTOS Y MAZMORRAS DEL MUNDO REDISEÑADO:
    // Aldea Marea Azul (242, 206)
    if (Math.hypot(x - 242, y - 206) <= 6.5) {
      if (x === 242 && y === 203) return TileType.CAMPFIRE;
      if (x === 239 && y === 206) return TileType.RECHARGE_STATION;
      if (x === 245 && y === 206) return TileType.CHEST_CLOSED;
      if (Math.hypot(x - 242, y - 206) > 5.4 && Math.abs(x - 242) > 1 && Math.abs(y - 206) > 1) return TileType.WOOD_PILLAR;
      return Math.hypot(x - 242, y - 206) <= 3.5 ? TileType.COBBLESTONE : TileType.BUILT_FLOOR;
    }

    // Campamento Termal Trol (134, 234)
    if (Math.hypot(x - 134, y - 234) <= 6.5) {
      if (x === 134 && y === 234) return TileType.CAMPFIRE;
      if (x === 131 && y === 231) return TileType.BASALT_COLUMN;
      if (x === 137 && y === 231) return TileType.BASALT_COLUMN;
      if (x === 138 && y === 235) return TileType.CHEST_CLOSED;
      return TileType.COBBLESTONE;
    }

    // Vigía del Cuarto Prisma (104, 88)
    if (Math.hypot(x - 104, y - 88) <= 6) {
      if (x === 104 && y === 86) return TileType.ALTAR;
      if (x === 101 && y === 89) return TileType.CAMPFIRE;
      if (x === 107 && y === 89) return TileType.CRYSTAL_SPIRE;
      return TileType.COBBLESTONE;
    }

    // Santuario de Musgo Antiguo (132, 178)
    if (Math.hypot(x - 132, y - 178) <= 6) {
      if (x === 132 && y === 178) return TileType.ALTAR;
      if (Math.abs(x - 132) === 3 && Math.abs(y - 178) === 3) return TileType.RUIN_PILLAR;
      if (x === 132 && y === 182) return TileType.CHEST_CLOSED;
      return TileType.COBBLESTONE;
    }

    // Galería de Ecos Antiguos (230, 82)
    if (Math.hypot(x - 230, y - 82) <= 6) {
      if (x === 230 && y === 82) return TileType.ALTAR;
      if (Math.abs(x - 230) === 4 && Math.abs(y - 82) <= 1) return TileType.RUIN_PILLAR;
      if (x === 230 && y === 78) return TileType.CHEST_CLOSED;
      return TileType.COBBLESTONE;
    }

    // 6 Secretos adicionales (sec_7 .. sec_12)
    if (x === 140 && y === 124) return TileType.ALTAR;
    if (x === 228 && y === 254) return TileType.ALTAR;
    if (x === 140 && y === 266) return TileType.ALTAR;
    if (x === 34 && y === 138) return TileType.ALTAR;
    if (x === 64 && y === 74) return TileType.ALTAR;

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

