import type {
  BiomeId,
  CraftRecipe,
  ElementType,
  FurnitureDef,
  FurnitureKind,
  HabitatDef,
  HabitatId,
  HotbarSlot,
  Inventory,
  InventoryKey,
  QuestDef,
  Rarity,
  SlugInstance,
  SlugSpecies,
} from './types';

export const WORLD_W = 320;
export const WORLD_H = 320;
export const CHUNK_SIZE = 16;
export const TILE_PX = 28;
export const SPAWN_X = 160;
export const SPAWN_Y = 160;
export const MAX_ACTIVE_HOME_SLUGS = 6;
export const MAX_SLUGS_PER_HABITAT = 2;
export const MAX_HOME_FURNITURE = 32;
export const SHELTER_HOME_RADIUS = 16;
export const MAX_SLUG_LEVEL = 20;

export const HABITAT_DEFS: HabitatDef[] = [
  {
    id: 'habitat_thermal',
    name: 'Rincón Térmico',
    description: 'Zona cálida de brasas y piedra volcánica ideal para babosas de Fuego.',
    acceptedTypes: ['Fuego'],
    anchorX: SPAWN_X + 3,
    anchorY: SPAWN_Y - 1,
    accentColor: '#fb923c',
    floorTint: 'rgba(249, 115, 22, 0.22)',
  },
  {
    id: 'habitat_aquatic',
    name: 'Estanque Fresco',
    description: 'Rincón húmedo y cristalino pensado para babosas de Agua y Hielo.',
    acceptedTypes: ['Agua', 'Hielo'],
    anchorX: SPAWN_X - 3,
    anchorY: SPAWN_Y - 1,
    accentColor: '#38bdf8',
    floorTint: 'rgba(56, 189, 248, 0.22)',
  },
  {
    id: 'habitat_crystal',
    name: 'Rincón Cristalino',
    description: 'Cristales resonantes que recargan a babosas Eléctricas, de Energía y Luz.',
    acceptedTypes: ['Electrico', 'Energia', 'Luz'],
    anchorX: SPAWN_X - 1,
    anchorY: SPAWN_Y - 2,
    accentColor: '#facc15',
    floorTint: 'rgba(45, 212, 191, 0.20)',
  },
  {
    id: 'habitat_shadow',
    name: 'Rincón Sombrío',
    description: 'Penumbra serena con ecos oscuros adaptada a babosas de Sombra.',
    acceptedTypes: ['Sombra'],
    anchorX: SPAWN_X - 2,
    anchorY: SPAWN_Y + 2,
    accentColor: '#c084fc',
    floorTint: 'rgba(168, 85, 247, 0.22)',
  },
  {
    id: 'habitat_garden',
    name: 'Jardín Subterráneo',
    description: 'Musgo blando y tierra fértil para babosas de Planta y Tierra.',
    acceptedTypes: ['Planta', 'Tierra'],
    anchorX: SPAWN_X + 2,
    anchorY: SPAWN_Y + 2,
    accentColor: '#4ade80',
    floorTint: 'rgba(74, 222, 128, 0.20)',
  },
];

export const FURNITURE_DEFS: Record<FurnitureKind, FurnitureDef> = {
  nest: {
    kind: 'nest',
    name: 'Nido Acogedor',
    description: 'Refugio mullido donde las babosas recuperan energía más rápido.',
    comfortBonus: 12,
  },
  bed: {
    kind: 'bed',
    name: 'Cama del Refugio',
    description: 'Descanso profundo que aumenta la comodidad de la habitación.',
    comfortBonus: 15,
  },
  feeder: {
    kind: 'feeder',
    name: 'Comedero Subterráneo',
    description: 'Mantiene alimento fresco cerca y reduce la pérdida de saciedad.',
    comfortBonus: 12,
  },
  decor: {
    kind: 'decor',
    name: 'Lámpara de Cristal',
    description: 'Ilumina la estancia con luz suave y embellece el hogar.',
    comfortBonus: 10,
    emitsLight: true,
  },
};

export interface HomeFoodDef {
  key: InventoryKey;
  label: string;
  description: string;
  favoriteFor: ElementType[] | 'all';
}

export const HOME_FOOD_DEFS: HomeFoodDef[] = [
  {
    key: 'berries',
    label: 'Bayas',
    description: 'Alimento universal del subsuelo (+38 Saciedad).',
    favoriteFor: 'all',
  },
  {
    key: 'emberSnack',
    label: 'Bocado Ígneo',
    description: 'Favorito de Fuego y Tierra (+55 Saciedad, +5 Amistad).',
    favoriteFor: ['Fuego', 'Tierra'],
  },
  {
    key: 'frostNectar',
    label: 'Néctar Glacial',
    description: 'Favorito de Agua, Hielo y Luz (+55 Saciedad, +5 Amistad).',
    favoriteFor: ['Agua', 'Hielo', 'Luz'],
  },
  {
    key: 'core',
    label: 'Núcleo Energético',
    description: 'Favorito de Eléctrico, Energía y Sombra (+55 Saciedad, +5 Amistad).',
    favoriteFor: ['Electrico', 'Energia', 'Sombra'],
  },
];

export const ELEMENT_CHART: Record<ElementType, { strong: ElementType[]; weak: ElementType[]; color: string }> = {
  Fuego: { strong: ['Hielo', 'Planta'], weak: ['Agua', 'Tierra'], color: '#f97316' },
  Agua: { strong: ['Fuego', 'Tierra'], weak: ['Electrico', 'Planta'], color: '#38bdf8' },
  Electrico: { strong: ['Agua'], weak: ['Tierra'], color: '#facc15' },
  Hielo: { strong: ['Tierra', 'Planta', 'Energia'], weak: ['Fuego'], color: '#67e8f9' },
  Sombra: { strong: ['Luz', 'Energia'], weak: ['Luz'], color: '#a855f7' },
  Luz: { strong: ['Sombra'], weak: ['Sombra'], color: '#fde047' },
  Tierra: { strong: ['Electrico', 'Fuego'], weak: ['Agua', 'Hielo', 'Planta'], color: '#d97706' },
  Planta: { strong: ['Agua', 'Tierra'], weak: ['Fuego', 'Hielo'], color: '#4ade80' },
  Energia: { strong: ['Sombra', 'Electrico'], weak: ['Hielo'], color: '#2dd4bf' },
};

export const BIOME_INFO: Record<
  BiomeId,
  {
    name: string;
    subtitle: string;
    ambientHex: string;
    darknessAlpha: number;
    floorA: string;
    floorB: string;
    wall: string;
    accent: string;
    mapColor: string;
  }
> = {
  Verdes: {
    name: 'Cuevas Verdes',
    subtitle: 'Flora bioluminiscente, hongos y lagos subterráneos',
    ambientHex: '#0b201c',
    darknessAlpha: 0.28,
    floorA: '#2e4a3d',
    floorB: '#263e34',
    wall: '#3c4a49',
    accent: '#4ade80',
    mapColor: '#3b7556',
  },
  Magma: {
    name: 'Cavernas de Magma',
    subtitle: 'Roca volcánica, ríos de lava y fraguas antiguas',
    ambientHex: '#2a0d08',
    darknessAlpha: 0.34,
    floorA: '#4b2a22',
    floorB: '#3e221c',
    wall: '#5a362d',
    accent: '#fb923c',
    mapColor: '#9e4328',
  },
  Heladas: {
    name: 'Cuevas Heladas',
    subtitle: 'Cristales glaciales, nieve compacta y cámaras congeladas',
    ambientHex: '#0b1e2e',
    darknessAlpha: 0.24,
    floorA: '#35566f',
    floorB: '#2b475d',
    wall: '#5a7f9c',
    accent: '#67e8f9',
    mapColor: '#5fa4c4',
  },
  Sombrias: {
    name: 'Cavernas Sombrías',
    subtitle: 'Oscuridad densa, cristales de energía y secretos antiguos',
    ambientHex: '#0b0718',
    darknessAlpha: 0.62,
    floorA: '#27203d',
    floorB: '#1f1932',
    wall: '#3a3058',
    accent: '#c084fc',
    mapColor: '#674796',
  },
};

export const SPECIES_LIST: SlugSpecies[] = [
  // 9 species preserved from Bajoterra 3.0
  {
    id: 'infurnus',
    name: 'Infurnus',
    type: 'Fuego',
    rarity: 'Rara',
    icon: '🔥',
    color: '#ef4444',
    accent: '#fde047',
    baseHp: 56,
    baseAtk: 15,
    baseDef: 9,
    baseSpd: 11,
    evoName: 'Megamorph Infurnus',
    habitat: 'Verdes',
    canonStatus: 'serie_canon',
    canonNote: 'Especie emblemática de la familia Shane (Burpy en la serie animada).',
    lore: 'Babosa de llama noble capaz de encender túneles enteros con su impacto ígneo.',
    specialMoves: [
      { id: 'ignis', name: 'Impacto Ígneo', power: 1.35, energyCost: 4, cooldown: 1, effect: 'burn', description: 'Daño ígneo + quemadura por 2 turnos.' },
      { id: 'nova', name: 'Fulgor Solar', power: 1.75, energyCost: 7, cooldown: 3, effect: 'pierce', description: 'Ignora escudos enemigos.' },
    ],
  },
  // Remaining 14 existing species tagged + 5 Season 1 canon species = 20 total
  {
    id: 'aquabeak',
    name: 'Aquabeak',
    type: 'Agua',
    rarity: 'Común',
    icon: '💧',
    color: '#0ea5e9',
    accent: '#bae6fd',
    baseHp: 64,
    baseAtk: 12,
    baseDef: 12,
    baseSpd: 10,
    evoName: 'Megamorph Aquabeak',
    habitat: 'Verdes',
    canonStatus: 'serie_canon',
    canonNote: 'Especie acuática de la serie animada capaz de lanzar ráfagas presurizadas.',
    lore: 'Habita cerca de lagos subterráneos y dispara chorros de alta presión.',
    specialMoves: [
      { id: 'jet', name: 'Chorro Abisal', power: 1.3, energyCost: 4, cooldown: 1, description: 'Ataque preciso de agua comprimida.' },
      { id: 'veil', name: 'Manto Acuático', power: 0, energyCost: 5, cooldown: 2, effect: 'heal', description: 'Restaura 35% PS y limpia quemaduras.' },
    ],
  },
  {
    id: 'tazerling',
    name: 'Tazerling',
    type: 'Electrico',
    rarity: 'Común',
    icon: '⚡',
    color: '#eab308',
    accent: '#fef08a',
    baseHp: 50,
    baseAtk: 16,
    baseDef: 8,
    baseSpd: 16,
    evoName: 'Megamorph Tazerling',
    habitat: 'Verdes',
    canonStatus: 'serie_canon',
    canonNote: 'Especie eléctrica de la serie animada (Joule en el equipo de Eli).',
    lore: 'Velocidad relámpago; ideal para aturdir rivales antes de que ataquen.',
    specialMoves: [
      { id: 'volt', name: 'Pulso Voltio', power: 1.35, energyCost: 4, cooldown: 1, effect: 'stun', description: 'Chispa veloz con probabilidad de aturdir.' },
      { id: 'storm', name: 'Sobrecarga', power: 1.8, energyCost: 7, cooldown: 3, description: 'Descarga eléctrica de alto voltaje.' },
    ],
  },
  {
    id: 'frostcrawler',
    name: 'Frostcrawler',
    type: 'Hielo',
    rarity: 'Común',
    icon: '❄️',
    color: '#22d3ee',
    accent: '#e0f2fe',
    baseHp: 60,
    baseAtk: 14,
    baseDef: 11,
    baseSpd: 9,
    evoName: 'Megamorph Frostcrawler',
    habitat: 'Heladas',
    canonStatus: 'serie_canon',
    canonNote: 'Especie glacial de la serie animada (Chiller en la Banda Shane).',
    lore: 'Sus agujas de escarcha congelan el suelo y frenan a los depredadores.',
    specialMoves: [
      { id: 'needle', name: 'Aguja de Hielo', power: 1.3, energyCost: 4, cooldown: 1, effect: 'chill', description: 'Enfría al rival reduciendo su ataque.' },
      { id: 'glacier', name: 'Muro Glacial', power: 0.6, energyCost: 5, cooldown: 2, effect: 'shield', description: 'Daño ligero + escudo protector.' },
    ],
  },
  {
    id: 'doc',
    name: 'Doc',
    type: 'Luz',
    rarity: 'Rara',
    icon: '✨',
    color: '#facc15',
    accent: '#ffffff',
    baseHp: 60,
    baseAtk: 11,
    baseDef: 12,
    baseSpd: 12,
    evoName: 'Megamorph Doc',
    habitat: 'Verdes',
    canonStatus: 'serie_canon',
    canonNote: 'Babosa sanadora canónica (especie Boon Doc) que purifica la energía oscura.',
    lore: 'Babosa sanadora legendaria por purificar energía corrupta y curar aliados.',
    specialMoves: [
      { id: 'healray', name: 'Destello Sanador', power: 0, energyCost: 4, cooldown: 1, effect: 'heal', description: 'Recupera 42% PS propios.' },
      { id: 'prism', name: 'Rayo Prisma', power: 1.45, energyCost: 6, cooldown: 2, effect: 'pierce', description: 'Luz pura eficaz contra sombras.' },
    ],
  },
  {
    id: 'darkfurnus',
    name: 'Darkfurnus',
    type: 'Sombra',
    rarity: 'Épica',
    icon: '🌑',
    color: '#7e22ce',
    accent: '#e9d5ff',
    baseHp: 62,
    baseAtk: 17,
    baseDef: 10,
    baseSpd: 13,
    evoName: 'Megamorph Darkfurnus',
    habitat: 'Sombrias',
    canonStatus: 'serie_canon',
    canonNote: 'Versión corrompida por Agua Oscura de Infurnus (Darkfurnace en la serie).',
    lore: 'Corrompida por oscuridad pura; drena vitalidad con llamas sombrías.',
    specialMoves: [
      { id: 'umbral', name: 'Llama Umbría', power: 1.4, energyCost: 5, cooldown: 1, effect: 'burn', description: 'Fuego sombrío que quema al objetivo.' },
      { id: 'siphon', name: 'Sifón Nocturno', power: 1.3, energyCost: 6, cooldown: 2, effect: 'drain', description: 'Inflige daño y absorbe 40% en PS.' },
    ],
  },
  {
    id: 'flaringo',
    name: 'Flaringo',
    type: 'Fuego',
    rarity: 'Rara',
    icon: '🦩',
    color: '#fb7185',
    accent: '#fef08a',
    baseHp: 58,
    baseAtk: 16,
    baseDef: 9,
    baseSpd: 14,
    evoName: 'Megamorph Flaringo',
    habitat: 'Magma',
    canonStatus: 'serie_canon',
    canonNote: 'Especie ígnea de la serie animada conocida por su vuelo veloz.',
    lore: 'Ágil criatura de las cavernas de magma que ejecuta ráfagas carmesí acrobáticas.',
    specialMoves: [
      { id: 'crimson', name: 'Ráfaga Carmesí', power: 1.45, energyCost: 4, cooldown: 1, effect: 'burn', description: 'Chorro rápido con rastro ardiente.' },
      { id: 'spiral', name: 'Espiral Ígnea', power: 1.75, energyCost: 7, cooldown: 3, description: 'Impacto giratorio de gran potencia.' },
    ],
  },
  {
    id: 'lariat',
    name: 'Lariat',
    type: 'Tierra',
    rarity: 'Común',
    icon: '🪨',
    color: '#b45309',
    accent: '#fde68a',
    baseHp: 72,
    baseAtk: 15,
    baseDef: 14,
    baseSpd: 8,
    evoName: 'Megamorph Lariat',
    habitat: 'Magma',
    canonStatus: 'serie_canon',
    canonNote: 'Especie terrestre de la serie animada que utiliza su lengua-lazo.',
    lore: 'Robusta babosa de roca capaz de inmovilizar enemigos con su lazo sísmico.',
    specialMoves: [
      { id: 'lasso', name: 'Lazo Sísmico', power: 1.3, energyCost: 4, cooldown: 1, effect: 'stun', description: 'Atrapa y sacude al enemigo.' },
      { id: 'bastion', name: 'Bastión Pétreo', power: 0.7, energyCost: 5, cooldown: 2, effect: 'shield', description: 'Levanta armadura de roca dura.' },
    ],
  },
  {
    id: 'enigmo',
    name: 'Enigmo',
    type: 'Energia',
    rarity: 'Épica',
    icon: '🔮',
    color: '#14b8a6',
    accent: '#a7f3d0',
    baseHp: 56,
    baseAtk: 18,
    baseDef: 10,
    baseSpd: 15,
    evoName: 'Megamorph Enigmo',
    habitat: 'Sombrias',
    canonStatus: 'serie_canon',
    canonNote: 'Babosa mística de la serie capaz de alterar percepción y duplicar visiones.',
    lore: 'Emite ondas psíquicas que revelan fisuras ocultas y desestabilizan defensas.',
    specialMoves: [
      { id: 'mind', name: 'Pulso Mental', power: 1.45, energyCost: 5, cooldown: 1, effect: 'pierce', description: 'Ondas que atraviesan escudos.' },
      { id: 'rift', name: 'Fisura Astral', power: 1.85, energyCost: 8, cooldown: 3, effect: 'stun', description: 'Explosión energética desorientadora.' },
    ],
  },
  // 5 Verified Season 1 Canon Species added for Bajoterra 4.0 RPG
  {
    id: 'arachnet',
    name: 'Arachnet',
    type: 'Planta',
    rarity: 'Rara',
    icon: '🕸️',
    color: '#10b981',
    accent: '#d1fae5',
    baseHp: 58,
    baseAtk: 14,
    baseDef: 11,
    baseSpd: 13,
    evoName: 'Megamorph Arachnet',
    habitat: 'Verdes',
    canonStatus: 'serie_canon',
    canonNote: 'Especie canónica de la Temporada 1 (Spinner en el equipo de Eli); teje telarañas tácticas.',
    lore: 'Ágil babosa tejedora de las Cuevas Verdes que atrapa objetivos con redes tensadas en pleno vuelo.',
    specialMoves: [
      { id: 'web_snare', name: 'Red de Seda', power: 1.25, energyCost: 4, cooldown: 1, effect: 'stun', description: 'Dispara una telaraña densa capaz de aturdir.' },
      { id: 'cocoon_shield', name: 'Capullo Táctico', power: 0.75, energyCost: 5, cooldown: 2, effect: 'shield', description: 'Envuelve al lanzador en fibra elástica protectora.' },
    ],
  },
  {
    id: 'bubbaleone',
    name: 'Bubbaleone',
    type: 'Agua',
    rarity: 'Común',
    icon: '🫧',
    color: '#06b6d4',
    accent: '#cffafe',
    baseHp: 68,
    baseAtk: 12,
    baseDef: 13,
    baseSpd: 10,
    evoName: 'Megamorph Bubbaleone',
    habitat: 'Verdes',
    canonStatus: 'serie_canon',
    canonNote: 'Especie canónica de la Temporada 1 (Suds en el equipo de Eli); forma burbujas protectoras.',
    lore: 'Su cuerpo elástico genera esferas presurizadas que amortiguan impactos y arrastran rivales.',
    specialMoves: [
      { id: 'bubble_dome', name: 'Cúpula de Burbuja', power: 0.65, energyCost: 4, cooldown: 2, effect: 'shield', description: 'Genera una esfera acuática absorbente de daño.' },
      { id: 'foam_burst', name: 'Marea Espumosa', power: 1.4, energyCost: 5, cooldown: 1, effect: 'chill', description: 'Explosión de agua a presión que frena al rival.' },
    ],
  },
  {
    id: 'rammstone',
    name: 'Rammstone',
    type: 'Tierra',
    rarity: 'Rara',
    icon: '🐏',
    color: '#d97706',
    accent: '#fef3c7',
    baseHp: 74,
    baseAtk: 18,
    baseDef: 14,
    baseSpd: 9,
    evoName: 'Megamorph Rammstone',
    habitat: 'Magma',
    canonStatus: 'serie_canon',
    canonNote: 'Especie canónica de la Temporada 1 (Rocky en el equipo Shane); puños de roca y embestida.',
    lore: 'Al transformarse despliega cuernos y puños graníticos capaces de quebrar cualquier cobertura.',
    specialMoves: [
      { id: 'granite_ram', name: 'Ariete Granítico', power: 1.55, energyCost: 5, cooldown: 1, effect: 'pierce', description: 'Embestida frontal que perfora escudos.' },
      { id: 'seismic_slam', name: 'Puño Sísmico', power: 1.75, energyCost: 7, cooldown: 3, effect: 'stun', description: 'Choque de roca pesada con aturdimiento.' },
    ],
  },
  {
    id: 'fandango',
    name: 'Fandango',
    type: 'Energia',
    rarity: 'Rara',
    icon: '⚡',
    color: '#34d399',
    accent: '#fef9c3',
    baseHp: 55,
    baseAtk: 15,
    baseDef: 10,
    baseSpd: 15,
    evoName: 'Megamorph Fandango',
    habitat: 'Heladas',
    canonStatus: 'serie_canon',
    canonNote: 'Especie canónica de la Temporada 1 (Flash en la serie); recarga y amplifica energía.',
    lore: 'Irradia ráfagas armónicas que revitalizan el equipo y desestabilizan cargas enemigas.',
    specialMoves: [
      { id: 'amp_pulse', name: 'Pulso Armónico', power: 1.4, energyCost: 4, cooldown: 1, effect: 'pierce', description: 'Descarga limpia que ignora barreras.' },
      { id: 'charge_surge', name: 'Sobrecarga Vital', power: 0.4, energyCost: 5, cooldown: 2, effect: 'heal', description: 'Restaura salud del lanzador con energía pura.' },
    ],
  },
  {
    id: 'armashelt',
    name: 'Armashelt',
    type: 'Tierra',
    rarity: 'Épica',
    icon: '🛡️',
    color: '#92400e',
    accent: '#fed7aa',
    baseHp: 78,
    baseAtk: 19,
    baseDef: 16,
    baseSpd: 8,
    evoName: 'Megamorph Armashelt',
    habitat: 'Magma',
    canonStatus: 'serie_canon',
    canonNote: 'Especie canónica de la Temporada 1 (Banger en la Banda Shane); proyectil acorazado de artillería.',
    lore: 'Su caparazón blindado almacena presión cinética para detonar impactos demoledores.',
    specialMoves: [
      { id: 'mortar_shell', name: 'Impacto Mortero', power: 1.85, energyCost: 7, cooldown: 3, effect: 'pierce', description: 'Proyectil blindado de enorme penetración.' },
      { id: 'iron_guard', name: 'Coraza Blindada', power: 0.85, energyCost: 5, cooldown: 2, effect: 'shield', description: 'Refuerza la defensa con blindaje mineral.' },
    ],
  },
  // 6 Original Bajoterra 4.0 Species
  {
    id: 'musgacorn',
    name: 'Musgacorn',
    type: 'Planta',
    rarity: 'Común',
    icon: '🌿',
    color: '#22c55e',
    accent: '#bbf7d0',
    baseHp: 64,
    baseAtk: 12,
    baseDef: 12,
    baseSpd: 10,
    evoName: 'Megamorph Musgacorn',
    habitat: 'Verdes',
    canonStatus: 'adaptacion_juego',
    canonNote: 'Especie original de Bajoterra 4.0 adaptada para ampliar la fauna de Cuevas Verdes.',
    lore: 'Simbiosis entre musgo luminoso y coraza; regenera su salud con esporas.',
    specialMoves: [
      { id: 'spore', name: 'Espora Vital', power: 1.0, energyCost: 4, cooldown: 1, effect: 'drain', description: 'Drena energía vegetal del enemigo.' },
      { id: 'thorn', name: 'Raíz Punzante', power: 1.5, energyCost: 6, cooldown: 2, description: 'Ataque firme de lianas subterráneas.' },
    ],
  },
  {
    id: 'piroclasto',
    name: 'Piroclasto',
    type: 'Fuego',
    rarity: 'Épica',
    icon: '🌋',
    color: '#dc2626',
    accent: '#fdba74',
    baseHp: 68,
    baseAtk: 18,
    baseDef: 12,
    baseSpd: 9,
    evoName: 'Megamorph Piroclasto',
    habitat: 'Magma',
    canonStatus: 'adaptacion_juego',
    canonNote: 'Especie original de Bajoterra 4.0 para el santuario volcánico de Magma.',
    lore: 'Núcleo de obsidiana viva que libera erupciones tectónicas bajo presión.',
    specialMoves: [
      { id: 'eruption', name: 'Erupción Tectónica', power: 1.65, energyCost: 6, cooldown: 2, effect: 'burn', description: 'Explosión volcánica abrasadora.' },
      { id: 'magmaarmor', name: 'Corteza de Basalto', power: 0.75, energyCost: 5, cooldown: 2, effect: 'shield', description: 'Escudo volcánico de alta densidad.' },
    ],
  },
  {
    id: 'glaciomita',
    name: 'Glaciomita',
    type: 'Hielo',
    rarity: 'Rara',
    icon: '🧊',
    color: '#38bdf8',
    accent: '#f0f9ff',
    baseHp: 66,
    baseAtk: 15,
    baseDef: 13,
    baseSpd: 11,
    evoName: 'Megamorph Glaciomita',
    habitat: 'Heladas',
    canonStatus: 'adaptacion_juego',
    canonNote: 'Especie original de Bajoterra 4.0 adaptada al bioma de Cuevas Heladas.',
    lore: 'Esculpida en estalagmitas milenarias; domina ráfagas de ventisca cristalina.',
    specialMoves: [
      { id: 'blizzard', name: 'Ventisca Cristalina', power: 1.5, energyCost: 5, cooldown: 2, effect: 'chill', description: 'Congela al rival y baja su daño.' },
      { id: 'shard', name: 'Lanza de Escarcha', power: 1.3, energyCost: 4, cooldown: 1, effect: 'pierce', description: 'Fragmento afilado anti-escudo.' },
    ],
  },
  {
    id: 'voltrix',
    name: 'Voltrix',
    type: 'Electrico',
    rarity: 'Rara',
    icon: '💠',
    color: '#3b82f6',
    accent: '#fef08a',
    baseHp: 54,
    baseAtk: 17,
    baseDef: 9,
    baseSpd: 17,
    evoName: 'Megamorph Voltrix',
    habitat: 'Heladas',
    canonStatus: 'adaptacion_juego',
    canonNote: 'Especie original de Bajoterra 4.0 enfocada en velocidad electromagnética.',
    lore: 'Genera arcos voltaicos entre cristales congelados a velocidades extremas.',
    specialMoves: [
      { id: 'arc', name: 'Arco Voltaico', power: 1.45, energyCost: 4, cooldown: 1, effect: 'stun', description: 'Rayo encadenado de respuesta rápida.' },
      { id: 'rail', name: 'Cañón Estático', power: 1.8, energyCost: 7, cooldown: 3, effect: 'pierce', description: 'Disparo electromagnético perforante.' },
    ],
  },
  {
    id: 'umbrospect',
    name: 'Umbrospect',
    type: 'Sombra',
    rarity: 'Épica',
    icon: '👁️',
    color: '#9333ea',
    accent: '#f5d0fe',
    baseHp: 60,
    baseAtk: 19,
    baseDef: 10,
    baseSpd: 14,
    evoName: 'Megamorph Umbrospect',
    habitat: 'Sombrias',
    canonStatus: 'adaptacion_juego',
    canonNote: 'Especie original de Bajoterra 4.0 guardiana de las Cavernas Sombrías.',
    lore: 'Espectro de las profundidades que absorbe la luz y lanza eclipses abismales.',
    specialMoves: [
      { id: 'eclipse', name: 'Eclipse Abismal', power: 1.6, energyCost: 6, cooldown: 2, effect: 'chill', description: 'Debilita la ofensiva del oponente.' },
      { id: 'voiddrain', name: 'Vacío Devorador', power: 1.35, energyCost: 5, cooldown: 2, effect: 'drain', description: 'Roba vitalidad desde las sombras.' },
    ],
  },
  {
    id: 'aetherion',
    name: 'Aetherion',
    type: 'Energia',
    rarity: 'Legendaria',
    icon: '🌟',
    color: '#2dd4bf',
    accent: '#fef08a',
    baseHp: 74,
    baseAtk: 20,
    baseDef: 14,
    baseSpd: 16,
    evoName: 'Megamorph Aetherion',
    habitat: 'Sombrias',
    canonStatus: 'adaptacion_juego',
    canonNote: 'Especie legendaria original de Bajoterra 4.0 para el desenlace y Post-Game.',
    lore: 'Reliquia viviente del subsuelo profundo; armoniza todos los cristales de energía.',
    specialMoves: [
      { id: 'prisma', name: 'Singularidad Prisma', power: 1.9, energyCost: 7, cooldown: 3, effect: 'pierce', description: 'Explosión prismática imparable.' },
      { id: 'resonance', name: 'Resonancia Viva', power: 0, energyCost: 5, cooldown: 2, effect: 'heal', description: 'Restaura 45% PS y carga escudo.' },
    ],
  },
];

export const HOTBAR_SLOTS: HotbarSlot[] = [
  { id: 'pulse', label: 'Pulso', keyHint: '1' },
  { id: 'berry', label: 'Baya', keyHint: '2', itemKey: 'berries' },
  { id: 'station', label: 'Estación', keyHint: '3', itemKey: 'stations' },
];

export const CRAFT_RECIPES: CraftRecipe[] = [];

export const QUEST_LIST: QuestDef[] = [
  {
    id: 'q_main_1',
    category: 'principal',
    title: '01. Primeros Pasos en Bajoterra',
    description: 'Explora la Caverna del Descenso y gana tu primer duelo de bláster.',
    metric: 'wins',
    goal: 1,
    rewardText: '+5 Fichas · +2 cilindros · +2 bayas · +35 EXP',
    rewards: { capsules: 2, berries: 2, xp: 35 },
  },
  {
    id: 'q_main_2',
    category: 'principal',
    title: '02. Alianza de la Banda Shane',
    description: 'Visita el Puesto del Valle Verde y gana 2 duelos para recibir el Meca Shane M1.',
    metric: 'wins',
    goal: 2,
    rewardText: 'Meca Shane M1 · +8 Fichas · +1 Lámpara · +55 EXP',
    rewards: { emberSnack: 1, frostNectar: 1, decor: 1, xp: 55 },
  },
  {
    id: 'q_main_3',
    category: 'principal',
    title: '03. Fronteras Elementales',
    description: 'Descubre los 4 biomas principales del mundo subterráneo.',
    metric: 'biomesFound',
    goal: 4,
    rewardText: '+2 Cilindros Maestros · Habilidad Resistencia Térmica',
    rewards: { masterCapsules: 2, crystal: 3, xp: 90, perk: 'Resistencia Térmica' },
  },
  {
    id: 'q_main_4',
    category: 'principal',
    title: '04. Guardianes del Abismo',
    description: 'Derrota a 2 Jefes de Bioma o al Comandante de Blakk.',
    metric: 'bossesDefeated',
    goal: 2,
    rewardText: '+3 Reliquias · +2 Elixires Megamorph · Habilidad Vínculo Maestro',
    rewards: { relics: 3, elixirs: 2, xp: 150, perk: 'Vínculo Maestro' },
  },
  {
    id: 'q_side_1',
    category: 'secundaria',
    title: 'Exploración del Subsuelo',
    description: 'Encuentra al menos 1 cofre antiguo en las cavernas iniciales.',
    metric: 'chestsOpened',
    goal: 1,
    rewardText: '+4 Fichas · +1 cilindro · +2 bayas',
    rewards: { capsules: 1, berries: 2, xp: 30 },
  },
  {
    id: 'q_side_2',
    category: 'secundaria',
    title: 'Cazador de Tesoros',
    description: 'Encuentra y abre 4 cofres en ruinas o cámaras secretas.',
    metric: 'chestsOpened',
    goal: 4,
    rewardText: '+2 cristales · +1 Cilindro Maestro',
    rewards: { crystal: 2, masterCapsules: 1, xp: 60 },
  },
  {
    id: 'q_side_3',
    category: 'secundaria',
    title: 'Coleccionista Vivo',
    description: 'Registra 6 especies distintas capturadas en tu Babosapedia.',
    metric: 'speciesCaptured',
    goal: 6,
    rewardText: '+3 cilindros · +2 núcleos · Habilidad Visión de Cristal',
    rewards: { capsules: 3, core: 2, xp: 80, perk: 'Visión de Cristal' },
  },
  {
    id: 'q_side_4',
    category: 'secundaria',
    title: 'Nueva Generación',
    description: 'Incuba y eclosiona 1 babosa en la Incubadora del Refugio.',
    metric: 'eggsHatched',
    goal: 1,
    rewardText: '+1 Elixir Megamorph · +3 bayas',
    rewards: { elixirs: 1, berries: 3, xp: 65 },
  },
  {
    id: 'q_side_5',
    category: 'secundaria',
    title: 'Despertar Megamorph',
    description: 'Alcanza la evolución Megamorph con al menos 1 babosa.',
    metric: 'megaUnlocked',
    goal: 1,
    rewardText: '+3 cristales sombríos · +2 Reliquias',
    rewards: { shadowShard: 3, relics: 2, xp: 120 },
  },
];

export const BOSS_DEFINITIONS = [
  {
    id: 'boss_magma',
    name: 'Titán Piroclasto',
    speciesId: 'piroclasto',
    biome: 'Magma' as BiomeId,
    x: 162,
    y: 252,
    level: 6,
    icon: '🌋',
  },
  {
    id: 'boss_ice',
    name: 'Reina Glaciomita',
    speciesId: 'glaciomita',
    biome: 'Heladas' as BiomeId,
    x: 42,
    y: 162,
    level: 6,
    icon: '🧊',
  },
  {
    id: 'boss_shadow',
    name: 'Espectro del Abismo',
    speciesId: 'umbrospect',
    biome: 'Sombrias' as BiomeId,
    x: 274,
    y: 158,
    level: 8,
    icon: '👁️',
  },
  {
    id: 'boss_blakk',
    name: 'Comandante Blakk',
    speciesId: 'darkfurnus',
    biome: 'Sombrias' as BiomeId,
    x: 276,
    y: 54,
    level: 9,
    icon: '🦹',
  },
];

export function createDefaultInventory(): Inventory {
  return {
    ore: 4,
    wood: 6,
    stone: 10,
    crystal: 1,
    shadowShard: 0,
    berries: 4,
    core: 2,
    capsules: 4,
    masterCapsules: 0,
    torches: 4,
    walls: 4,
    floors: 4,
    doors: 1,
    stations: 0,
    elixirs: 0,
    relics: 0,
    emberSnack: 0,
    frostNectar: 0,
    nest: 0,
    bed: 0,
    feeder: 0,
    decor: 0,
    rootWood: 0,
    magmaCoal: 0,
    thermalCopper: 0,
    iceCrystal: 0,
    blueQuartz: 0,
    darkIron: 0,
    neonMushroom: 0,
    evoStone: 0,
  };
}

export function getSpecies(id: string): SlugSpecies {
  return SPECIES_LIST.find((s) => s.id === id) || SPECIES_LIST[0];
}

export function getHabitatDef(id: HabitatId): HabitatDef {
  return HABITAT_DEFS.find((h) => h.id === id) || HABITAT_DEFS[0];
}

export function isSpeciesCompatibleWithHabitat(speciesId: string, habitatId: HabitatId): boolean {
  const sp = getSpecies(speciesId);
  const hab = getHabitatDef(habitatId);
  return hab.acceptedTypes.includes(sp.type);
}

export function getCompatibleHabitatsForSpecies(speciesId: string): HabitatDef[] {
  const sp = getSpecies(speciesId);
  return HABITAT_DEFS.filter((h) => h.acceptedTypes.includes(sp.type));
}

export function getFavoriteFoodForSpecies(speciesId: string): HomeFoodDef {
  const sp = getSpecies(speciesId);
  return (
    HOME_FOOD_DEFS.find((f) => Array.isArray(f.favoriteFor) && f.favoriteFor.includes(sp.type)) ||
    HOME_FOOD_DEFS[0]
  );
}

let slugUidSeq = 1;

const PERSONALITY_POOL: readonly SlugInstance['personality'][] = [
  'juguetona',
  'calmada',
  'curiosa',
  'energetica',
  'timida',
  'orgullosa',
  'traviesa',
  'valiente',
] as const;

function pickPersonalityFromUid(uid: string): NonNullable<SlugInstance['personality']> {
  let hash = 2166136261;
  for (let i = 0; i < uid.length; i++) {
    hash ^= uid.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return PERSONALITY_POOL[Math.abs(hash) % PERSONALITY_POOL.length] || 'curiosa';
}

export function createSlugInstance(
  id: string,
  level = 1,
  opts?: { isBred?: boolean; bonusTrait?: string; nickname?: string; personality?: SlugInstance['personality'] }
): SlugInstance {
  const sp = getSpecies(id);
  const clampedLevel = Math.max(1, Math.min(MAX_SLUG_LEVEL, Math.floor(Number.isFinite(level) ? level : 1)));
  const traitHp = opts?.bonusTrait === 'Vitalidad +' ? 10 : 0;
  const traitAtk = opts?.bonusTrait === 'Potencia +' ? 3 : 0;
  const traitSpd = opts?.bonusTrait === 'Velocidad +' ? 3 : 0;
  const maxHp = sp.baseHp + clampedLevel * 6 + traitHp;
  const maxEnergy = 14 + Math.floor(clampedLevel * 1.5);
  const uid = `${sp.id}_${Date.now().toString(36)}_${slugUidSeq++}_${Math.random().toString(36).slice(2, 6)}`;
  return {
    uid,
    id: sp.id,
    name: sp.name,
    ...(opts?.nickname?.trim() ? { nickname: opts.nickname.trim().slice(0, 24) } : {}),
    personality: opts?.personality || pickPersonalityFromUid(uid),
    type: sp.type,
    rarity: sp.rarity,
    icon: sp.icon,
    level: clampedLevel,
    xp: 0,
    hp: maxHp,
    maxHp,
    energy: maxEnergy,
    maxEnergy,
    atk: sp.baseAtk + Math.floor(clampedLevel * 2.1) + traitAtk,
    def: sp.baseDef + Math.floor(clampedLevel * 1.4),
    spd: sp.baseSpd + Math.floor(clampedLevel * 1.2) + traitSpd,
    bond: opts?.isBred ? 35 : 22,
    mega: false,
    isBred: opts?.isBred,
    bonusTrait: opts?.bonusTrait,
    moveMastery: [0, 0],
  };
}

export function getElementMultiplier(atkType: ElementType, defType: ElementType): number {
  const entry = ELEMENT_CHART[atkType];
  if (!entry) return 1;
  if (entry.strong.includes(defType)) return 1.75;
  if (entry.weak.includes(defType)) return 0.65;
  return 1;
}

export const RARITY_WEIGHTS: Record<Rarity, number> = {
  Común: 55,
  Rara: 28,
  Épica: 13,
  Legendaria: 4,
};

export function pickWeightedSpeciesByBiome(biome: BiomeId, rng: () => number = Math.random): SlugSpecies {
  const pool = SPECIES_LIST.filter((s) => s.habitat === biome);
  const candidates = pool.length > 0 ? pool : SPECIES_LIST;
  const totalWeight = candidates.reduce((acc, sp) => acc + (RARITY_WEIGHTS[sp.rarity] ?? 10), 0);
  let roll = rng() * totalWeight;
  for (const sp of candidates) {
    roll -= RARITY_WEIGHTS[sp.rarity] ?? 10;
    if (roll <= 0) return sp;
  }
  return candidates[candidates.length - 1];
}
