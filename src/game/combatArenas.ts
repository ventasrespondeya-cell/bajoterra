import type { BiomeId, DuelArenaObstacle } from './types';

export const ARENA_WIDTH = 920;
export const ARENA_HEIGHT = 480;
export const ARENA_FLOOR_Y = 426;
export const ARENA_CEIL_Y = 58;
export const PLAYER_LANE_X = 128;
export const PLAYER_MIN_X = 56;
export const PLAYER_MAX_X = 416;
export const ENEMY_LANE_X = 792;
export const ENEMY_MIN_X = 504;
export const ENEMY_MAX_X = 864;
export const DUELIST_MIN_Y = 104;
export const DUELIST_MAX_Y = 392;
export const BASE_GRAVITY = 310; // px/s^2 multiplied by projectile gravityScale

export interface BiomeArenaTheme {
  biome: BiomeId;
  title: string;
  skyTop: string;
  skyBottom: string;
  caveMid: string;
  floorTop: string;
  floorBottom: string;
  glowColor: string;
  ambientSparkColor: string;
  obstacles: DuelArenaObstacle[];
}

export function buildArenaForBiome(biome: BiomeId): BiomeArenaTheme {
  switch (biome) {
    case 'Magma':
      return {
        biome,
        title: 'Fragua de Magma',
        skyTop: '#1c0906',
        skyBottom: '#34110b',
        caveMid: '#260d08',
        floorTop: '#56261d',
        floorBottom: '#2d120d',
        glowColor: '#fb923c',
        ambientSparkColor: '#fdba74',
        obstacles: [
          {
            id: 'magma_pillar',
            kind: 'cover',
            x: 432,
            y: 288,
            w: 56,
            h: 138,
            hp: 95,
            maxHp: 95,
            label: 'Basalto',
          },
          {
            id: 'magma_vent',
            kind: 'updraft',
            x: 328,
            y: 196,
            w: 76,
            h: 230,
            element: 'Fuego',
            label: 'Corriente Térmica',
          },
          {
            id: 'magma_prism',
            kind: 'boost_ring',
            x: 540,
            y: 126,
            w: 44,
            h: 82,
            element: 'Fuego',
            label: 'Núcleo Ígneo',
          },
        ],
      };
    case 'Heladas':
      return {
        biome,
        title: 'Santuario Glacial',
        skyTop: '#081826',
        skyBottom: '#132e44',
        caveMid: '#0d2233',
        floorTop: '#325a78',
        floorBottom: '#193247',
        glowColor: '#67e8f9',
        ambientSparkColor: '#e0f2fe',
        obstacles: [
          {
            id: 'ice_reflector_top',
            kind: 'reflector',
            x: 410,
            y: 108,
            w: 98,
            h: 26,
            element: 'Hielo',
            label: 'Prisma Glacial',
          },
          {
            id: 'ice_barrier_low',
            kind: 'cover',
            x: 442,
            y: 306,
            w: 46,
            h: 120,
            hp: 85,
            maxHp: 85,
            label: 'Bloque Helado',
          },
          {
            id: 'ice_ring',
            kind: 'boost_ring',
            x: 560,
            y: 198,
            w: 44,
            h: 76,
            element: 'Hielo',
            label: 'Estela Criogénica',
          },
        ],
      };
    case 'Sombrias':
      return {
        biome,
        title: 'Abismo Sombrío',
        skyTop: '#080514',
        skyBottom: '#17102c',
        caveMid: '#100a21',
        floorTop: '#312352',
        floorBottom: '#18102b',
        glowColor: '#c084fc',
        ambientSparkColor: '#e9d5ff',
        obstacles: [
          {
            id: 'shadow_monolith',
            kind: 'cover',
            x: 438,
            y: 260,
            w: 44,
            h: 166,
            hp: 100,
            maxHp: 100,
            label: 'Monolito Oscuro',
          },
          {
            id: 'astral_ring_high',
            kind: 'boost_ring',
            x: 432,
            y: 118,
            w: 56,
            h: 88,
            element: 'Energia',
            label: 'Nexo Astral',
          },
          {
            id: 'void_reflector',
            kind: 'reflector',
            x: 572,
            y: 334,
            w: 84,
            h: 24,
            element: 'Sombra',
            label: 'Losa Umbría',
          },
        ],
      };
    case 'Verdes':
    default:
      return {
        biome: 'Verdes',
        title: 'Caverna Bioluminiscente',
        skyTop: '#071a16',
        skyBottom: '#12332a',
        caveMid: '#0c241e',
        floorTop: '#2c5442',
        floorBottom: '#162d23',
        glowColor: '#4ade80',
        ambientSparkColor: '#a7f3d0',
        obstacles: [
          {
            id: 'mushroom_bounce',
            kind: 'reflector',
            x: 340,
            y: 342,
            w: 92,
            h: 24,
            element: 'Planta',
            label: 'Hongo Elástico',
          },
          {
            id: 'moss_ledge',
            kind: 'cover',
            x: 454,
            y: 294,
            w: 48,
            h: 132,
            hp: 90,
            maxHp: 90,
            label: 'Roca Musgosa',
          },
          {
            id: 'green_conduit',
            kind: 'boost_ring',
            x: 448,
            y: 142,
            w: 52,
            h: 82,
            element: 'Energia',
            label: 'Anillo Cristalino',
          },
        ],
      };
  }
}
