import type {
  HiddenDiscoveryDef,
  PostGameChallengeDef,
  RivalDuelDef,
  SlugRaceDef,
  TournamentDef,
  TrainingChallengeDef,
} from './storyTypes';
import type { GameState, InventoryKey, MechaState, MechaTheme } from './types';

export interface MechaUpgradeDef {
  id: string;
  tier: 2 | 3;
  name: string;
  description: string;
  speedBonusPct: number;
  costTokens: number;
  requiredChapterOrder: number;
}

export interface MechaThemeDef {
  id: MechaTheme;
  name: string;
  primaryColor: string;
  accentColor: string;
  costTokens: number;
}

export interface MerchantOfferDef {
  id: string;
  name: string;
  description: string;
  category: 'suministros' | 'hogar' | 'evolucion';
  costTokens: number;
  costRelics?: number;
  outputKey: InventoryKey;
  outputQty: number;
  requiredChapterOrder?: number;
}

export const MECHA_THEMES: MechaThemeDef[] = [
  {
    id: 'shane_blue',
    name: 'Azul Shane Clásico',
    primaryColor: '#2563eb',
    accentColor: '#38bdf8',
    costTokens: 0,
  },
  {
    id: 'molten_core',
    name: 'Núcleo de Magma',
    primaryColor: '#dc2626',
    accentColor: '#fb923c',
    costTokens: 6,
  },
  {
    id: 'frost_pulse',
    name: 'Pulso Glacial',
    primaryColor: '#0284c7',
    accentColor: '#67e8f9',
    costTokens: 6,
  },
  {
    id: 'shadow_stealth',
    name: 'Sigilo Sombrío',
    primaryColor: '#7e22ce',
    accentColor: '#c084fc',
    costTokens: 8,
  },
];

export const MECHA_UPGRADES: MechaUpgradeDef[] = [
  {
    id: 'turbina_caverna_t2',
    tier: 2,
    name: 'Meca M2 · Turbina de Caverna',
    description: '+32% velocidad montado y mejor tracción sobre hielo y suelo irregular.',
    speedBonusPct: 32,
    costTokens: 10,
    requiredChapterOrder: 3,
  },
  {
    id: 'propulsor_200_t3',
    tier: 3,
    name: 'Meca M3 · Propulsor de 200 MPH',
    description: '+55% velocidad montado, ahorro de resistencia y máxima aceleración en Carreras.',
    speedBonusPct: 55,
    costTokens: 16,
    requiredChapterOrder: 6,
  },
];

export const MERCHANT_EXCHANGE_OFFERS: MerchantOfferDef[] = [
  {
    id: 'offer_capsules_pack',
    name: '3× Cilindros de Captura',
    description: 'Cápsulas calibradas para capturar nuevas especies salvajes.',
    category: 'suministros',
    costTokens: 3,
    outputKey: 'capsules',
    outputQty: 3,
  },
  {
    id: 'offer_master_capsule',
    name: '1× Cilindro Maestro',
    description: 'Cápsula de alta precisión para babosas raras y épicas.',
    category: 'suministros',
    costTokens: 6,
    outputKey: 'masterCapsules',
    outputQty: 1,
    requiredChapterOrder: 2,
  },
  {
    id: 'offer_berries_pack',
    name: '4× Bayas del Subsuelo',
    description: 'Suministro rápido de curación y cuidado en el Refugio.',
    category: 'suministros',
    costTokens: 2,
    outputKey: 'berries',
    outputQty: 4,
  },
  {
    id: 'offer_ember_snack',
    name: '2× Bocado Ígneo',
    description: 'Alimento favorito para babosas de Fuego y Tierra.',
    category: 'hogar',
    costTokens: 3,
    outputKey: 'emberSnack',
    outputQty: 2,
  },
  {
    id: 'offer_frost_nectar',
    name: '2× Néctar Glacial',
    description: 'Alimento favorito para babosas de Agua, Hielo y Luz.',
    category: 'hogar',
    costTokens: 3,
    outputKey: 'frostNectar',
    outputQty: 2,
  },
  {
    id: 'offer_recharge_station',
    name: '1× Estación de Recarga',
    description: 'Baliza portátil para restaurar al equipo en cavernas lejanas.',
    category: 'suministros',
    costTokens: 5,
    outputKey: 'stations',
    outputQty: 1,
    requiredChapterOrder: 2,
  },
  {
    id: 'offer_furniture_nest',
    name: '1× Nido Acogedor',
    description: 'Mobiliario del hogar que acelera el descanso de tus babosas.',
    category: 'hogar',
    costTokens: 4,
    outputKey: 'nest',
    outputQty: 1,
  },
  {
    id: 'offer_furniture_bed',
    name: '1× Cama del Refugio',
    description: 'Aumenta significativamente el confort (+15) en el Refugio.',
    category: 'hogar',
    costTokens: 5,
    outputKey: 'bed',
    outputQty: 1,
  },
  {
    id: 'offer_furniture_feeder',
    name: '1× Comedero Subterráneo',
    description: 'Reduce la pérdida de saciedad de las babosas residentes.',
    category: 'hogar',
    costTokens: 4,
    outputKey: 'feeder',
    outputQty: 1,
  },
  {
    id: 'offer_furniture_decor',
    name: '1× Lámpara de Cristal',
    description: 'Ilumina las estancias del hogar con luz cálida.',
    category: 'hogar',
    costTokens: 4,
    outputKey: 'decor',
    outputQty: 1,
  },
  {
    id: 'offer_elixir_mega',
    name: '1× Elixir Megamorph',
    description: 'Aumenta +25 Amistad y +35 EXP; catalizador tras el Acelerador (Cap. 7+).',
    category: 'evolucion',
    costTokens: 8,
    outputKey: 'elixirs',
    outputQty: 1,
    requiredChapterOrder: 7,
  },
  {
    id: 'offer_evostone_relic',
    name: '1× Piedra Evolutiva',
    description: 'Canjea una Reliquia Antigua por un catalizador evolutivo.',
    category: 'evolucion',
    costTokens: 4,
    costRelics: 1,
    outputKey: 'evoStone',
    outputQty: 1,
    requiredChapterOrder: 7,
  },
];

export const RIVAL_DUELS: RivalDuelDef[] = [
  {
    id: 'rival_kord_spar',
    name: 'Kord Zane (Práctica)',
    title: 'Calibración de Bláster',
    characterId: 'kord',
    speciesId: 'lariat',
    level: 3,
    biome: 'Verdes',
    chapterId: 'cap_02_refugio_banda',
    canonStatus: 'serie_canon',
    introQuote: '¡Veamos qué tan firme sostienes ese bláster, Eli!',
    victoryQuote: '¡Nada mal! Tu pulso mejora en cada disparo.',
    rewardTokens: 5,
    rewardItems: { capsules: 2 },
  },
  {
    id: 'rival_red_hook',
    name: 'Garfio Rojo (Red Hook)',
    title: 'Duelista Mercenario',
    characterId: 'red_hook',
    speciesId: 'rammstone',
    level: 5,
    biome: 'Magma',
    chapterId: 'cap_03_sombra_agua_oscura',
    canonStatus: 'serie_canon',
    introQuote: '¡Nadie cruza mi sector sin probar la embestida de mi Rammstone!',
    victoryQuote: 'Hmph... Los Shane siempre pelean con trucos nuevos.',
    rewardTokens: 8,
    rewardItems: { masterCapsules: 1, emberSnack: 1 },
  },
  {
    id: 'rival_twist',
    name: 'Twist',
    title: 'Sombra Fronteriza',
    characterId: 'twist',
    speciesId: 'tazerling',
    level: 6,
    biome: 'Heladas',
    chapterId: 'cap_05_fronteras_elementales',
    canonStatus: 'serie_canon',
    introQuote: 'Demasiado lento, Shane. ¡Veamos si esquivas esta descarga!',
    victoryQuote: 'Tch... esta vez te adelantaste. Nos volveremos a ver.',
    rewardTokens: 10,
    rewardItems: { crystal: 2, core: 2 },
  },
];

export const TRAINING_CHALLENGES: TrainingChallengeDef[] = [
  {
    id: 'tr_precision',
    title: 'Puntería de Precisión',
    kind: 'precision',
    subtitle: 'Acierta a objetivos en movimiento con el bláster',
    description: 'Golpea blancos móviles en la galería del Refugio durante 15 segundos sin fallar la racha.',
    durationSec: 15,
    targetScoreA: 8,
    targetScoreS: 14,
    rewardTokens: 4,
    rewardMastery: 12,
    rewardBond: 5,
    rewardXp: 30,
  },
  {
    id: 'tr_velocity',
    title: 'Carga a 100 MPH',
    kind: 'velocity',
    subtitle: 'Suelta el disparo exactamente en la zona dorada',
    description: 'Mantén y libera el pulso de velocidad en la ventana óptima para despertar el ritmo Megamorph.',
    durationSec: 15,
    targetScoreA: 6,
    targetScoreS: 10,
    rewardTokens: 5,
    rewardMastery: 14,
    rewardBond: 6,
    rewardXp: 35,
  },
  {
    id: 'tr_interception',
    title: 'Intercepción Defensiva',
    kind: 'interception',
    subtitle: 'Desvía ráfagas sombrías con tu escudo de choque',
    description: 'Intercepta proyectiles entrantes en 3 carriles usando sincronización de Guardia.',
    durationSec: 15,
    targetScoreA: 7,
    targetScoreS: 12,
    rewardTokens: 5,
    rewardMastery: 15,
    rewardBond: 6,
    rewardXp: 40,
  },
];

export const BLASTER_TOURNAMENTS: TournamentDef[] = [
  {
    id: 'tour_valle_verde',
    name: 'Copa del Valle Verde',
    subtitle: 'Torneo de 3 rondas para lanzadores en ascenso',
    biome: 'Verdes',
    requiredChapterId: 'cap_02_refugio_banda',
    canonStatus: 'serie_canon',
    rounds: [
      {
        roundName: 'Ronda 1 · Cuartos',
        opponentName: 'Aprendiz del Valle',
        speciesId: 'bubbaleone',
        level: 3,
        strategyNote: 'Usa burbujas protectoras para aguantar intercambios.',
      },
      {
        roundName: 'Ronda 2 · Semifinal',
        opponentName: 'Exploradora Arachnet',
        speciesId: 'arachnet',
        level: 4,
        strategyNote: 'Controla el ritmo con redes y presión constante.',
      },
      {
        roundName: 'Ronda 3 · Final',
        opponentName: 'Campeón Kord Zane',
        speciesId: 'lariat',
        level: 5,
        strategyNote: 'Impactos terrestres firmes y alta resistencia.',
      },
    ],
    rewardTokens: 12,
    rewardItems: { masterCapsules: 1, nest: 1 },
    rewardSummary: '+12 Fichas · +1 Cilindro Maestro · +1 Nido Acogedor',
  },
  {
    id: 'tour_elemental',
    name: 'Torneo de Cavernas Elementales',
    subtitle: 'Desafío mixto entre hielo, voltaje y magma',
    biome: 'Magma',
    requiredChapterId: 'cap_05_fronteras_elementales',
    canonStatus: 'adaptacion_juego',
    rounds: [
      {
        roundName: 'Ronda 1 · Escarcha',
        opponentName: 'Centinela Glacial',
        speciesId: 'fandango',
        level: 6,
        strategyNote: 'Dispara ráfagas energéticas rápidas a distancia.',
      },
      {
        roundName: 'Ronda 2 · Acero',
        opponentName: 'Guardia de Forja',
        speciesId: 'armashelt',
        level: 7,
        strategyNote: 'Coraza blindada resistente al impacto frontal.',
      },
      {
        roundName: 'Ronda 3 · Final',
        opponentName: 'Garfio Rojo (Élite)',
        speciesId: 'rammstone',
        level: 7,
        strategyNote: 'Embestida agresiva de alta potencia.',
      },
    ],
    rewardTokens: 18,
    rewardItems: { elixirs: 1, relics: 1 },
    rewardSummary: '+18 Fichas · +1 Elixir · +1 Reliquia Antigua',
  },
  {
    id: 'tour_campeonato_shane',
    name: 'Gran Campeonato de las 99 Cavernas',
    subtitle: 'Copa maestra Post-Game frente a lanzadores legendarios',
    biome: 'Sombrias',
    requiredChapterId: 'cap_08_ciudadela_blakk',
    canonStatus: 'adaptacion_juego',
    rounds: [
      {
        roundName: 'Ronda 1 · Relámpago',
        opponentName: 'Twist (Desafío Maestro)',
        speciesId: 'voltrix',
        level: 9,
        strategyNote: 'Movilidad extrema y descargas perforantes.',
      },
      {
        roundName: 'Ronda 2 · Eclipse',
        opponentName: 'Escolta Sombría',
        speciesId: 'darkfurnus',
        level: 9,
        strategyNote: 'Drena vitalidad y aplica quemaduras sombrías.',
      },
      {
        roundName: 'Ronda 3 · Gran Final',
        opponentName: 'Sombra de Will Shane (Simulador)',
        speciesId: 'aetherion',
        level: 10,
        strategyNote: 'Energía prismática pura y precisión absoluta.',
      },
    ],
    rewardTokens: 30,
    rewardItems: { evoStone: 1, elixirs: 2, masterCapsules: 2 },
    rewardSummary: '+30 Fichas · +1 Piedra Evolutiva · +2 Elixires · +2 Maestros',
  },
];

export const SLUG_RACES: SlugRaceDef[] = [
  {
    id: 'race_verdes',
    name: 'Circuito del Valle Verde',
    subtitle: 'Túnel bioluminiscente ideal para estrenar tu Meca Shane',
    biome: 'Verdes',
    requiredMecha: true,
    distanceMeters: 600,
    parTimeSec: 18,
    rewardTokens: 6,
    rewardSummary: '+6 Fichas de Caverna · +25 EXP explorador',
  },
  {
    id: 'race_magma',
    name: 'Rally de las Grietas de Magma',
    subtitle: 'Salta fisuras ardientes aprovechando turbos de velocidad',
    biome: 'Magma',
    requiredMecha: true,
    distanceMeters: 850,
    parTimeSec: 21,
    rewardTokens: 9,
    rewardSummary: '+9 Fichas de Caverna · +40 EXP explorador',
  },
  {
    id: 'race_acuatica',
    name: 'Regata de las Mareas Subterráneas',
    subtitle: 'Esquiva corrientes rápidas entre cascadas luminosas',
    biome: 'Acuaticas',
    requiredMecha: true,
    distanceMeters: 780,
    parTimeSec: 20,
    rewardTokens: 8,
    rewardSummary: '+8 Fichas de Caverna · +35 EXP explorador',
  },
  {
    id: 'race_abismo',
    name: 'Copa Relámpago del Abismo',
    subtitle: 'Pista avanzada de alta velocidad para Meca M2/M3',
    biome: 'Sombrias',
    requiredMecha: true,
    distanceMeters: 1100,
    parTimeSec: 23,
    rewardTokens: 14,
    rewardSummary: '+14 Fichas de Caverna · +60 EXP explorador',
  },
];

export const HIDDEN_DISCOVERIES: HiddenDiscoveryDef[] = [
  {
    id: 'sec_santuario_shane',
    title: 'Estela de Will Shane',
    biome: 'Verdes',
    minChapterOrder: 1,
    scenarioId: 'esc_caverna_descenso',
    worldCoords: { x: 144, y: 142 },
    lore: 'Una placa grabada recuerda la promesa de los Shane: ningún lanzador abandona a sus babosas en la oscuridad.',
    rewardTokens: 5,
    rewardItems: { berries: 2, capsules: 1 },
    canonStatus: 'serie_canon',
  },
  {
    id: 'sec_fuente_abisal',
    title: 'Manantial Purificado Abisal',
    biome: 'Acuaticas',
    minChapterOrder: 4,
    scenarioId: 'esc_gruta_acuatica',
    worldCoords: { x: 238, y: 224 },
    lore: 'Una cámara sumergida donde las corrientes limpias revitalizan las cápsulas de agua y energía.',
    rewardTokens: 7,
    rewardItems: { frostNectar: 2, masterCapsules: 1 },
    canonStatus: 'adaptacion_juego',
  },
  {
    id: 'sec_taller_prototipo',
    title: 'Plano Antiguo de Mecas',
    biome: 'Magma',
    minChapterOrder: 2,
    scenarioId: 'esc_caverna_magma',
    worldCoords: { x: 148, y: 244 },
    lore: 'Esquemas olvidados por herreros trol que optimizan la suspensión en cavernas volcánicas.',
    rewardTokens: 7,
    rewardItems: { relics: 1 },
    canonStatus: 'adaptacion_juego',
  },
  {
    id: 'sec_archivo_cristal',
    title: 'Cámara del Eco Fandango',
    biome: 'Heladas',
    minChapterOrder: 5,
    scenarioId: 'esc_caverna_helada',
    worldCoords: { x: 48, y: 148 },
    lore: 'Cristales resonantes que amplifican la recarga de energía y guardan memoria de antiguas babosas de luz.',
    rewardTokens: 8,
    rewardItems: { frostNectar: 2, elixirs: 1 },
    canonStatus: 'adaptacion_juego',
  },
  {
    id: 'sec_eco_will_shane',
    title: 'Altar del Eco de Will Shane',
    biome: 'Cristalinas',
    minChapterOrder: 6,
    scenarioId: 'esc_templo_cristalino',
    worldCoords: { x: 89, y: 66 },
    lore: 'Prisma intacto donde Will Shane cifró las coordenadas de la bóveda secreta del Acelerador.',
    rewardTokens: 9,
    rewardItems: { crystal: 3, relics: 1 },
    canonStatus: 'serie_canon',
  },
  {
    id: 'sec_boveda_200mph',
    title: 'Registro del Primer Megamorph',
    biome: 'Sombrias',
    minChapterOrder: 7,
    scenarioId: 'esc_ciudadela_sombria',
    worldCoords: { x: 262, y: 66 },
    lore: 'Anotaciones de laboratorio que demuestran que el vínculo emocional reduce la sobrecarga al superar las 200 MPH.',
    rewardTokens: 10,
    rewardItems: { elixirs: 1 },
    canonStatus: 'serie_canon',
  },
];

export const POSTGAME_CHALLENGES: PostGameChallengeDef[] = [
  {
    id: 'pg_eco_pirita',
    title: 'Guardián de Obsidiana',
    subtitle: 'Desafío Post-Game de Fuego y Coraza',
    bossName: 'Armashelt Alfa',
    speciesId: 'armashelt',
    level: 10,
    biome: 'Magma',
    rewardTokens: 16,
    rewardItems: { evoStone: 1, relics: 1 },
    rewardSummary: '+16 Fichas · +1 Piedra Evolutiva · +1 Reliquia',
  },
  {
    id: 'pg_sombra_suprema',
    title: 'Sombra del Abismo Profundo',
    subtitle: 'Enfrentamiento de élite tras la caída del Comandante Blakk',
    bossName: 'Darkfurnus Primigenia',
    speciesId: 'darkfurnus',
    level: 11,
    biome: 'Sombrias',
    rewardTokens: 20,
    rewardItems: { elixirs: 2, masterCapsules: 1 },
    rewardSummary: '+20 Fichas · +2 Elixires · +1 Cilindro Maestro',
  },
  {
    id: 'pg_aetherion_prueba',
    title: 'Prueba del Núcleo Aetherion',
    subtitle: 'Duelo supremo contra la energía armónica de Bajoterra',
    bossName: 'Avatar Aetherion',
    speciesId: 'aetherion',
    level: 12,
    biome: 'Sombrias',
    rewardTokens: 25,
    rewardItems: { evoStone: 2, elixirs: 2 },
    rewardSummary: '+25 Fichas · +2 Piedras Evolutivas · +2 Elixires',
  },
];

export function createDefaultMechaState(): MechaState {
  return {
    unlocked: false,
    active: false,
    name: 'Meca Shane M1',
    tier: 1,
    theme: 'shane_blue',
    unlockedThemes: ['shane_blue'],
    upgrades: ['chasis_m1'],
  };
}

export function ensureMechaState(state: GameState): MechaState {
  if (!state.mecha) {
    state.mecha = createDefaultMechaState();
  }
  if (!Array.isArray(state.mecha.unlockedThemes) || state.mecha.unlockedThemes.length === 0) {
    state.mecha.unlockedThemes = ['shane_blue'];
  }
  if (!Array.isArray(state.mecha.upgrades)) {
    state.mecha.upgrades = ['chasis_m1'];
  }
  return state.mecha;
}

export function getMechaSpeedMultiplier(state: GameState): number {
  const m = state.mecha;
  if (!m || !m.unlocked || !m.active) return 1;
  if (m.tier >= 3) return 1.55;
  if (m.tier >= 2) return 1.32;
  return 1.18;
}
