/**
 * BAJOTERRA 4.0 — Registro Maestro de Activos Visuales (Parte 1)
 * Catálogo centralizado de hojas de sprites HiDPI, dimensiones, estados de animación
 * y módulos de terreno/decoración/arquitectura para personajes, babosas, enemigos y biomas.
 */

export type AssetCategory =
  | 'characters'
  | 'slugs'
  | 'enemies'
  | 'portraits'
  | 'terrain'
  | 'biomeDecorations'
  | 'buildings'
  | 'effects'
  | 'ui'
  | 'animations';

export type CharacterAnimState =
  | 'idle'
  | 'walk'
  | 'interact'
  | 'combat'
  | 'hit'
  | 'special';

export type CharacterFacingDir = 'down' | 'up' | 'left' | 'right';

export type SlugAnimState =
  | 'idle'
  | 'walk'
  | 'hop'
  | 'float'
  | 'wing_flap'
  | 'swim'
  | 'charge'
  | 'fire'
  | 'transform'
  | 'attack'
  | 'hit'
  | 'sleep'
  | 'eat'
  | 'victory';

export interface AssetModuleSpec {
  id: string;
  category: AssetCategory;
  modulePath: string;
  frameWidth: number;
  frameHeight: number;
  directions?: readonly CharacterFacingDir[];
  animationStates: readonly string[];
  description: string;
}

export const HD_CHARACTER_SPRITE_SIZE = 64;
export const HD_BOSS_SPRITE_SIZE = 80;
export const HD_SLUG_SPRITE_SIZE = 64;
export const HD_TILE_SPRITE_SIZE = 56; // 2x HiDPI sobre TILE_PX = 28

export const ASSET_REGISTRY: AssetModuleSpec[] = [
  {
    id: 'hd_characters_heroes',
    category: 'characters',
    modulePath: 'src/assets/characters/characterSpritesheet.ts',
    frameWidth: HD_CHARACTER_SPRITE_SIZE,
    frameHeight: HD_CHARACTER_SPRITE_SIZE,
    directions: ['down', 'up', 'left', 'right'],
    animationStates: ['idle', 'walk', 'interact', 'combat', 'hit', 'special'],
    description:
      'Hojas HiDPI 64×64 con sombreado cel-shaded y 4 direcciones auténticas para Eli Shane, Kord Zane, Trixie Sting, Pronto, Will Shane, Mercader, Entrenadores y Mecha Shane.',
  },
  {
    id: 'hd_enemies_bosses',
    category: 'enemies',
    modulePath: 'src/assets/enemies/enemySpritesheet.ts',
    frameWidth: HD_BOSS_SPRITE_SIZE,
    frameHeight: HD_BOSS_SPRITE_SIZE,
    directions: ['down', 'up', 'left', 'right'],
    animationStates: ['idle', 'walk', 'interact', 'combat', 'hit', 'special'],
    description:
      'Hojas exclusivas para Garfio Rojo, Twist, Soldados de Blakk, Dr. Thaddius Blakk, Comandante Blakk y los 5 Jefes de Bioma 80×80 con siluetas y armas únicas.',
  },
  {
    id: 'hd_slug_anatomies',
    category: 'slugs',
    modulePath: 'src/assets/slugs/slugSpritesheet.ts',
    frameWidth: HD_SLUG_SPRITE_SIZE,
    frameHeight: HD_SLUG_SPRITE_SIZE,
    directions: ['down', 'left', 'right', 'up'],
    animationStates: [
      'idle',
      'walk',
      'hop',
      'float',
      'wing_flap',
      'swim',
      'charge',
      'fire',
      'transform',
      'attack',
      'hit',
      'sleep',
      'eat',
      'victory',
    ],
    description:
      '20 especies completas con anatomía única por especie, alas venadas desplegables, formas Normal / Velocimorph / Megamorph / Ghoul.',
  },
  {
    id: 'hd_portraits_ui',
    category: 'portraits',
    modulePath: 'src/components/CharacterPortrait.tsx',
    frameWidth: 128,
    frameHeight: 128,
    animationStates: ['idle', 'happy', 'combat', 'charge', 'sleep'],
    description:
      'Retratos vectoriales expresivos para personajes, jefes, diálogos y Babosapedia.',
  },
  {
    id: 'hd_terrain_autotile',
    category: 'terrain',
    modulePath: 'src/assets/environments/hdTileset.ts',
    frameWidth: HD_TILE_SPRITE_SIZE,
    frameHeight: HD_TILE_SPRITE_SIZE,
    animationStates: ['autotile_16', 'cliff_drop', 'chasm', 'shoreline_blend'],
    description:
      'Terreno 2.5D con acantilados estratificados, auto-tiling de bordes, enredaderas colgantes, abismos y transiciones orgánicas de orilla.',
  },
  {
    id: 'hd_biome_decorations',
    category: 'biomeDecorations',
    modulePath: 'src/assets/environments/biomeDecorations.ts',
    frameWidth: HD_TILE_SPRITE_SIZE,
    frameHeight: HD_TILE_SPRITE_SIZE,
    animationStates: ['ambient_glow', 'waterfall_mist', 'spore_pulse'],
    description:
      'Hongos luminosos en losas de piedra, cascadas cian con espuma, espiras de cristal, columnas de basalto y algas bioluminiscentes.',
  },
  {
    id: 'hd_buildings_bridges',
    category: 'buildings',
    modulePath: 'src/assets/buildings/caveArchitecture.ts',
    frameWidth: HD_TILE_SPRITE_SIZE,
    frameHeight: HD_TILE_SPRITE_SIZE,
    animationStates: ['rope_bridge', 'wood_stairs', 'campfire_burn', 'rune_circle', 'shane_dome'],
    description:
      'Puentes colgantes de cuerda sobre simas, escaleras de madera, hogueras de campamento, círculos rúnicos, cofres, altares y cúpula del Refugio Shane.',
  },
  {
    id: 'hd_combat_effects',
    category: 'effects',
    modulePath: 'src/game/combatRenderer.ts',
    frameWidth: 96,
    frameHeight: 96,
    animationStates: ['protoform_trail', 'velocimorph_burst', 'ghoul_aura', 'clash_shockwave'],
    description:
      'Efectos cinéticos de lanzamiento, metamorfosis Velocimorph, estelas por especie y duelos HiDPI en arena.',
  },
];

export const CHARACTER_ANIMATION_FRAME_COUNTS: Record<CharacterAnimState, number> = {
  idle: 4,
  walk: 4,
  interact: 3,
  combat: 4,
  hit: 2,
  special: 4,
};

export const SLUG_ANIMATION_FRAME_COUNTS: Record<SlugAnimState, number> = {
  idle: 4,
  walk: 4,
  hop: 4,
  float: 4,
  wing_flap: 4,
  swim: 4,
  charge: 3,
  fire: 4,
  transform: 4,
  attack: 4,
  hit: 2,
  sleep: 3,
  eat: 3,
  victory: 4,
};
