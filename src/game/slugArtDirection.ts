import type { BiomeId, ElementType } from './types';

export type SlugAnatomyClass =
  | 'slender_flame'
  | 'armored_crawler'
  | 'bolt_sprinter'
  | 'hydro_torpedo'
  | 'seraph_sprite'
  | 'moss_horned'
  | 'crimson_acrobat'
  | 'heavy_rhino'
  | 'crystal_stalker'
  | 'rail_serpent'
  | 'obsidian_titan'
  | 'psychic_orb'
  | 'abyss_wyvern'
  | 'shadow_wraith'
  | 'celestial_core'
  | 'web_weaver'
  | 'bubble_orb'
  | 'granite_brawler'
  | 'harmonic_spark'
  | 'armored_mortar';

export type SlugMaterialFinish =
  | 'ember_skin'
  | 'frosted_chitin'
  | 'conductive_gel'
  | 'aqua_smooth'
  | 'luminous_silk'
  | 'bark_moss'
  | 'volcanic_crust'
  | 'crystalline_ice'
  | 'abyssal_velvet'
  | 'prismatic_aura';

export type SlugEyeStyle =
  | 'determined_slanted'
  | 'heavy_amber_slit'
  | 'wide_hyper_spark'
  | 'friendly_oval'
  | 'serene_luminous'
  | 'fierce_glowing'
  | 'sly_angular'
  | 'stoic_brow'
  | 'tri_optic'
  | 'cosmic_ring';

export type SlugMouthStyle =
  | 'fang_grin'
  | 'armored_jaw'
  | 'cheerful_open'
  | 'cute_beak'
  | 'gentle_smile'
  | 'smirk'
  | 'serene_dot'
  | 'fierce_scowl';

export type SlugAnimationState =
  | 'idle'
  | 'walk'
  | 'happy'
  | 'play'
  | 'eat'
  | 'rest'
  | 'sleep'
  | 'react'
  | 'charge'
  | 'fire'
  | 'flight'
  | 'transform'
  | 'attack'
  | 'hit'
  | 'ko'
  | 'victory';

export interface SlugDesignSheet {
  speciesId: string;
  storyOrder: number;
  storyChapter: string;
  biome: BiomeId;
  element: ElementType;
  prototypeTier: 'prototype_trio' | 'core_story' | 'deep_expedition';
  anatomyClass: SlugAnatomyClass;
  material: SlugMaterialFinish;
  bodyProportions: {
    widthScale: number;
    heightScale: number;
    headRatio: number;
    posture: 'upright' | 'low_crawler' | 'agile_lean' | 'hovering' | 'armored_stout';
  };
  silhouetteHooks: string[];
  eyeStyle: SlugEyeStyle;
  mouthStyle: SlugMouthStyle;
  palette: {
    primary: string;
    secondary: string;
    belly: string;
    shadow: string;
    highlight: string;
    eyeIris: string;
    energyCore: string;
  };
  temperament: string;
  personalityQuote: string;
  vfxSignature: {
    particleKind: 'ember' | 'crystal_flake' | 'volt_arc' | 'bubble' | 'halo_mote' | 'leaf_spore' | 'obsidian_shard' | 'void_wisp';
    transformLabel: string;
    impactSummary: string;
  };
}

export const ART_DIRECTION_GUIDE = {
  title: 'Bajoterra 4.0 — Dirección Artística Principal',
  lightDirectionDeg: -45, // Top-left key light consistently across tiles, sprites, portraits & arenas
  outlineHex: '#060c14',
  rimHighlightAlpha: 0.48,
  protoformSizeWorldPx: 24,
  portraitViewBox: 32,
  velocimorphScaleRange: [1.0, 1.48] as const,
  megamorphUnlockedLateOnly: true,
  prototypePriorityIds: ['infurnus', 'frostcrawler', 'tazerling'] as const,
} as const;

export const SLUG_DESIGN_SHEETS: Record<string, SlugDesignSheet> = {
  // ---- TRÍO PROTOTIPO PRIORITARIO ----
  infurnus: {
    speciesId: 'infurnus',
    storyOrder: 1,
    storyChapter: 'Acto I · Cuevas Verdes',
    biome: 'Verdes',
    element: 'Fuego',
    prototypeTier: 'prototype_trio',
    anatomyClass: 'slender_flame',
    material: 'ember_skin',
    bodyProportions: { widthScale: 0.9, heightScale: 1.12, headRatio: 0.44, posture: 'upright' },
    silhouetteHooks: ['Cresta flamígera tricolor', 'Antenas esbeltas', 'Cola en lengua de fuego'],
    eyeStyle: 'determined_slanted',
    mouthStyle: 'fang_grin',
    palette: {
      primary: '#ef4444',
      secondary: '#f97316',
      belly: '#fde047',
      shadow: '#7f1d1d',
      highlight: '#fecaca',
      eyeIris: '#fef08a',
      energyCore: '#fb923c',
    },
    temperament: 'Valiente, impetuosa y protectora con su lanzador.',
    personalityQuote: '«Enciende el corazón antes de apretar el gatillo.»',
    vfxSignature: {
      particleKind: 'ember',
      transformLabel: 'Fénix Ígneo',
      impactSummary: 'Explosión solar radial con brasas ascendentes',
    },
  },
  frostcrawler: {
    speciesId: 'frostcrawler',
    storyOrder: 6,
    storyChapter: 'Acto II · Cuevas Heladas',
    biome: 'Heladas',
    element: 'Hielo',
    prototypeTier: 'prototype_trio',
    anatomyClass: 'armored_crawler',
    material: 'frosted_chitin',
    bodyProportions: { widthScale: 1.24, heightScale: 0.88, headRatio: 0.48, posture: 'low_crawler' },
    silhouetteHooks: ['Coraza dorsal hexagonal', 'Mandíbulas laterales glaciares', 'Triple cuerno de escarcha y cola maza'],
    eyeStyle: 'heavy_amber_slit',
    mouthStyle: 'armored_jaw',
    palette: {
      primary: '#0891b2',
      secondary: '#22d3ee',
      belly: '#e0f2fe',
      shadow: '#164e63',
      highlight: '#f0f9ff',
      eyeIris: '#fde047',
      energyCore: '#67e8f9',
    },
    temperament: 'Estoica, paciente y firme como un glaciar.',
    personalityQuote: '«Quien aguanta la ventisca domina la caverna.»',
    vfxSignature: {
      particleKind: 'crystal_flake',
      transformLabel: 'Taladro Escarcha',
      impactSummary: 'Anillo cristalino con fragmentos de hielo giratorios',
    },
  },
  tazerling: {
    speciesId: 'tazerling',
    storyOrder: 3,
    storyChapter: 'Acto I · Cuevas Verdes',
    biome: 'Verdes',
    element: 'Electrico',
    prototypeTier: 'prototype_trio',
    anatomyClass: 'bolt_sprinter',
    material: 'conductive_gel',
    bodyProportions: { widthScale: 0.86, heightScale: 0.96, headRatio: 0.5, posture: 'agile_lean' },
    silhouetteHooks: ['Antenas en zigzag voltáico', 'Mofletes conductores cargados', 'Cola bífida en rayo'],
    eyeStyle: 'wide_hyper_spark',
    mouthStyle: 'cheerful_open',
    palette: {
      primary: '#eab308',
      secondary: '#38bdf8',
      belly: '#fef9c3',
      shadow: '#854d0e',
      highlight: '#ffffff',
      eyeIris: '#0ea5e9',
      energyCore: '#fef08a',
    },
    temperament: 'Inquieta, veloz, juguetona e imparable.',
    personalityQuote: '«¡Ya di tres vueltas antes de que cargaras!»',
    vfxSignature: {
      particleKind: 'volt_arc',
      transformLabel: 'Relámpago Vivo',
      impactSummary: 'Descarga eléctrica quebrada con chispas neón',
    },
  },

  // ---- ACTO I: CUEVAS VERDES ----
  aquabeak: {
    speciesId: 'aquabeak',
    storyOrder: 2,
    storyChapter: 'Acto I · Cuevas Verdes',
    biome: 'Verdes',
    element: 'Agua',
    prototypeTier: 'core_story',
    anatomyClass: 'hydro_torpedo',
    material: 'aqua_smooth',
    bodyProportions: { widthScale: 0.98, heightScale: 1.0, headRatio: 0.45, posture: 'agile_lean' },
    silhouetteHooks: ['Aleta dorsal hidrodinámica', 'Aletas laterales natatorias', 'Pico corto amarillo'],
    eyeStyle: 'friendly_oval',
    mouthStyle: 'cute_beak',
    palette: {
      primary: '#0284c7',
      secondary: '#38bdf8',
      belly: '#bae6fd',
      shadow: '#0c4a6e',
      highlight: '#f0f9ff',
      eyeIris: '#061018',
      energyCore: '#7dd3fc',
    },
    temperament: 'Serena, curiosa y precisa bajo el agua.',
    personalityQuote: '«Fluye como la corriente subterránea.»',
    vfxSignature: {
      particleKind: 'bubble',
      transformLabel: 'Torpedo Abisal',
      impactSummary: 'Estela de burbujas a presión y ola expansiva',
    },
  },
  musgacorn: {
    speciesId: 'musgacorn',
    storyOrder: 4,
    storyChapter: 'Acto I · Cuevas Verdes',
    biome: 'Verdes',
    element: 'Planta',
    prototypeTier: 'core_story',
    anatomyClass: 'moss_horned',
    material: 'bark_moss',
    bodyProportions: { widthScale: 1.05, heightScale: 0.96, headRatio: 0.44, posture: 'upright' },
    silhouetteHooks: ['Brote de hojas en coronilla', 'Collar de pétalos verdes', 'Caparazón musgoso redondeado'],
    eyeStyle: 'friendly_oval',
    mouthStyle: 'gentle_smile',
    palette: {
      primary: '#16a34a',
      secondary: '#4ade80',
      belly: '#dcfce7',
      shadow: '#14532d',
      highlight: '#bbf7d0',
      eyeIris: '#052e16',
      energyCore: '#86efac',
    },
    temperament: 'Amable, paciente y simbiótica con la flora.',
    personalityQuote: '«Cada espora guarda vida nueva.»',
    vfxSignature: {
      particleKind: 'leaf_spore',
      transformLabel: 'Ciervo Espora',
      impactSummary: 'Lluvia de hojas bioluminiscentes y drenaje vital',
    },
  },
  doc: {
    speciesId: 'doc',
    storyOrder: 5,
    storyChapter: 'Acto I · Cuevas Verdes',
    biome: 'Verdes',
    element: 'Luz',
    prototypeTier: 'core_story',
    anatomyClass: 'seraph_sprite',
    material: 'luminous_silk',
    bodyProportions: { widthScale: 0.88, heightScale: 1.04, headRatio: 0.46, posture: 'hovering' },
    silhouetteHooks: ['Halo flotante dorado', 'Gema turquesa frontal', 'Aletas etéreas laterales'],
    eyeStyle: 'serene_luminous',
    mouthStyle: 'serene_dot',
    palette: {
      primary: '#eab308',
      secondary: '#2dd4bf',
      belly: '#fefce8',
      shadow: '#854d0e',
      highlight: '#ffffff',
      eyeIris: '#0f766e',
      energyCore: '#fef08a',
    },
    temperament: 'Compasiva, luminosa y protectora ante las Sombras.',
    personalityQuote: '«La luz limpia incluso la oscuridad más honda.»',
    vfxSignature: {
      particleKind: 'halo_mote',
      transformLabel: 'Serafín Prisma',
      impactSummary: 'Halos curativos y haz purificador dorado',
    },
  },

  // ---- ACTO II: CUEVAS HELADAS ----
  glaciomita: {
    speciesId: 'glaciomita',
    storyOrder: 7,
    storyChapter: 'Acto II · Cuevas Heladas',
    biome: 'Heladas',
    element: 'Hielo',
    prototypeTier: 'core_story',
    anatomyClass: 'crystal_stalker',
    material: 'crystalline_ice',
    bodyProportions: { widthScale: 0.94, heightScale: 1.14, headRatio: 0.42, posture: 'upright' },
    silhouetteHooks: ['Corona multifaceta de cuarzo glaciar', 'Hombreras prismáticas', 'Cola en aguja de hielo'],
    eyeStyle: 'sly_angular',
    mouthStyle: 'smirk',
    palette: {
      primary: '#0ea5e9',
      secondary: '#bae6fd',
      belly: '#f8fafc',
      shadow: '#075985',
      highlight: '#ffffff',
      eyeIris: '#0284c7',
      energyCore: '#e0f2fe',
    },
    temperament: 'Calculada, afilada y elegante en el rebote.',
    personalityQuote: '«Un ángulo exacto corta cualquier defensa.»',
    vfxSignature: {
      particleKind: 'crystal_flake',
      transformLabel: 'Lanza Prisma',
      impactSummary: 'Estallido de esquirlas reflectantes',
    },
  },
  voltrix: {
    speciesId: 'voltrix',
    storyOrder: 8,
    storyChapter: 'Acto II · Cuevas Heladas',
    biome: 'Heladas',
    element: 'Electrico',
    prototypeTier: 'core_story',
    anatomyClass: 'rail_serpent',
    material: 'conductive_gel',
    bodyProportions: { widthScale: 0.84, heightScale: 1.08, headRatio: 0.42, posture: 'agile_lean' },
    silhouetteHooks: ['Bobinas gemelas en los flancos', 'Cresta trasera inclinada', 'Cola riel magnética'],
    eyeStyle: 'determined_slanted',
    mouthStyle: 'smirk',
    palette: {
      primary: '#2563eb',
      secondary: '#fde047',
      belly: '#dbeafe',
      shadow: '#1e3a8a',
      highlight: '#fef08a',
      eyeIris: '#fde047',
      energyCore: '#60a5fa',
    },
    temperament: 'Precisa, fría y de aceleración supersónica.',
    personalityQuote: '«De cero al blanco en un parpadeo.»',
    vfxSignature: {
      particleKind: 'volt_arc',
      transformLabel: 'Víbora Riel',
      impactSummary: 'Haz electromagnético azul con arcos gemelos',
    },
  },

  // ---- ACTO III: CAVERNAS DE MAGMA ----
  flaringo: {
    speciesId: 'flaringo',
    storyOrder: 9,
    storyChapter: 'Acto III · Cavernas de Magma',
    biome: 'Magma',
    element: 'Fuego',
    prototypeTier: 'core_story',
    anatomyClass: 'crimson_acrobat',
    material: 'ember_skin',
    bodyProportions: { widthScale: 0.9, heightScale: 1.15, headRatio: 0.43, posture: 'upright' },
    silhouetteHooks: ['Penacho curvo carmesí', 'Plumas laterales llameantes', 'Cola estilizada de halcón'],
    eyeStyle: 'sly_angular',
    mouthStyle: 'smirk',
    palette: {
      primary: '#e11d48',
      secondary: '#fb7185',
      belly: '#fef08a',
      shadow: '#881337',
      highlight: '#ffe4e6',
      eyeIris: '#fef08a',
      energyCore: '#fb7185',
    },
    temperament: 'Teatral, acrobática y amante de las piruetas en el aire.',
    personalityQuote: '«¡Observa esta curva ardiente!»',
    vfxSignature: {
      particleKind: 'ember',
      transformLabel: 'Halcón Carmesí',
      impactSummary: 'Espiral rosa-dorada de fuego acrobático',
    },
  },
  lariat: {
    speciesId: 'lariat',
    storyOrder: 10,
    storyChapter: 'Acto III · Cavernas de Magma',
    biome: 'Magma',
    element: 'Tierra',
    prototypeTier: 'core_story',
    anatomyClass: 'heavy_rhino',
    material: 'volcanic_crust',
    bodyProportions: { widthScale: 1.22, heightScale: 0.95, headRatio: 0.46, posture: 'armored_stout' },
    silhouetteHooks: ['Cuerno frontal macizo', 'Cinturón lazo dorado', 'Hombros de roca basáltica'],
    eyeStyle: 'stoic_brow',
    mouthStyle: 'fierce_scowl',
    palette: {
      primary: '#b45309',
      secondary: '#f59e0b',
      belly: '#fde68a',
      shadow: '#451a03',
      highlight: '#fef3c7',
      eyeIris: '#1c1917',
      energyCore: '#fbbf24',
    },
    temperament: 'Testaruda, noble e inamovible como la piedra.',
    personalityQuote: '«Ni la lava mueve mi guardia.»',
    vfxSignature: {
      particleKind: 'obsidian_shard',
      transformLabel: 'Ariete Sísmico',
      impactSummary: 'Esquirlas de basalto y onda de choque terrestre',
    },
  },
  piroclasto: {
    speciesId: 'piroclasto',
    storyOrder: 11,
    storyChapter: 'Acto III · Cavernas de Magma',
    biome: 'Magma',
    element: 'Fuego',
    prototypeTier: 'deep_expedition',
    anatomyClass: 'obsidian_titan',
    material: 'volcanic_crust',
    bodyProportions: { widthScale: 1.2, heightScale: 1.05, headRatio: 0.45, posture: 'armored_stout' },
    silhouetteHooks: ['Cráter dorsal ardiente', 'Placas de obsidiana agrietada', 'Puños pétreos volcánicos'],
    eyeStyle: 'fierce_glowing',
    mouthStyle: 'armored_jaw',
    palette: {
      primary: '#991b1b',
      secondary: '#f97316',
      belly: '#fdba74',
      shadow: '#2b0909',
      highlight: '#fef08a',
      eyeIris: '#fde047',
      energyCore: '#ea580c',
    },
    temperament: 'Volcánica, imponente y de poder contenido.',
    personalityQuote: '«Presión y fuego hasta abrir la montaña.»',
    vfxSignature: {
      particleKind: 'ember',
      transformLabel: 'Meteoro Basalto',
      impactSummary: 'Cráter ígneo expansivo con fragmentos volcánicos',
    },
  },

  // ---- ACTO IV: CAVERNAS SOMBRÍAS ----
  enigmo: {
    speciesId: 'enigmo',
    storyOrder: 12,
    storyChapter: 'Acto IV · Cavernas Sombrías',
    biome: 'Sombrias',
    element: 'Energia',
    prototypeTier: 'deep_expedition',
    anatomyClass: 'psychic_orb',
    material: 'prismatic_aura',
    bodyProportions: { widthScale: 0.96, heightScale: 1.04, headRatio: 0.56, posture: 'hovering' },
    silhouetteHooks: ['Tercer ojo psíquico frontal', 'Tentáculos flotantes divididos', 'Orbe cerebral turquesa'],
    eyeStyle: 'tri_optic',
    mouthStyle: 'serene_dot',
    palette: {
      primary: '#0d9488',
      secondary: '#5eead4',
      belly: '#ccfbf1',
      shadow: '#134e4a',
      highlight: '#f0fdfa',
      eyeIris: '#fef08a',
      energyCore: '#2dd4bf',
    },
    temperament: 'Enigmática, telepática y perceptiva.',
    personalityQuote: '«Veo la trayectoria antes de que apuntes.»',
    vfxSignature: {
      particleKind: 'halo_mote',
      transformLabel: 'Visión Astral',
      impactSummary: 'Ondas psíquicas concéntricas perforantes',
    },
  },
  darkfurnus: {
    speciesId: 'darkfurnus',
    storyOrder: 13,
    storyChapter: 'Acto IV · Cavernas Sombrías',
    biome: 'Sombrias',
    element: 'Sombra',
    prototypeTier: 'deep_expedition',
    anatomyClass: 'abyss_wyvern',
    material: 'abyssal_velvet',
    bodyProportions: { widthScale: 0.95, heightScale: 1.12, headRatio: 0.44, posture: 'upright' },
    silhouetteHooks: ['Cuernos curvos abisales', 'Alas membranosas dentadas', 'Cola arpón violeta'],
    eyeStyle: 'fierce_glowing',
    mouthStyle: 'fang_grin',
    palette: {
      primary: '#581c87',
      secondary: '#a855f7',
      belly: '#e9d5ff',
      shadow: '#1e0836',
      highlight: '#f3e8ff',
      eyeIris: '#fde047',
      energyCore: '#c084fc',
    },
    temperament: 'Feroz, intensa y marcada por la energía oscura.',
    personalityQuote: '«Incluso la sombra obedece a un buen lazo.»',
    vfxSignature: {
      particleKind: 'void_wisp',
      transformLabel: 'Guiverno Abisal',
      impactSummary: 'Llamas púrpuras con sifón sombrío',
    },
  },
  umbrospect: {
    speciesId: 'umbrospect',
    storyOrder: 14,
    storyChapter: 'Acto IV · Cavernas Sombrías',
    biome: 'Sombrias',
    element: 'Sombra',
    prototypeTier: 'deep_expedition',
    anatomyClass: 'shadow_wraith',
    material: 'abyssal_velvet',
    bodyProportions: { widthScale: 0.92, heightScale: 1.14, headRatio: 0.46, posture: 'hovering' },
    silhouetteHooks: ['Manto espectral flotante', 'Ojo lunar magenta en la frente', 'Bordes rasgados etéreos'],
    eyeStyle: 'tri_optic',
    mouthStyle: 'smirk',
    palette: {
      primary: '#4c1d95',
      secondary: '#f472b6',
      belly: '#ddd6fe',
      shadow: '#170a33',
      highlight: '#fae8ff',
      eyeIris: '#f472b6',
      energyCore: '#a855f7',
    },
    temperament: 'Silenciosa, esquiva y capaz de atravesar obstáculos.',
    personalityQuote: '«Ningún muro detiene a un eclipse vivo.»',
    vfxSignature: {
      particleKind: 'void_wisp',
      transformLabel: 'Espectro Eclipse',
      impactSummary: 'Estela de vacío fantasmal y drenaje',
    },
  },
  aetherion: {
    speciesId: 'aetherion',
    storyOrder: 15,
    storyChapter: 'Acto IV · Corazón del Subsuelo',
    biome: 'Sombrias',
    element: 'Energia',
    prototypeTier: 'deep_expedition',
    anatomyClass: 'celestial_core',
    material: 'prismatic_aura',
    bodyProportions: { widthScale: 1.0, heightScale: 1.16, headRatio: 0.45, posture: 'hovering' },
    silhouetteHooks: ['Corona estelar flotante', 'Anillos armónicos orbitales', 'Cola prismática bifurcada'],
    eyeStyle: 'cosmic_ring',
    mouthStyle: 'gentle_smile',
    palette: {
      primary: '#0f766e',
      secondary: '#2dd4bf',
      belly: '#fef08a',
      shadow: '#042f2e',
      highlight: '#ffffff',
      eyeIris: '#fef08a',
      energyCore: '#5eead4',
    },
    temperament: 'Ancestral, serena y resonante con las 99 cavernas.',
    personalityQuote: '«Todos los elementos cantan en una sola frecuencia.»',
    vfxSignature: {
      particleKind: 'halo_mote',
      transformLabel: 'Singularidad Viva',
      impactSummary: 'Anillos orbitales dorados y haz prismático total',
    },
  },

  // ---- EXPANSIÓN CANÓNICA TEMPORADA 1 ----
  arachnet: {
    speciesId: 'arachnet',
    storyOrder: 16,
    storyChapter: 'Acto I · Cuevas Verdes',
    biome: 'Verdes',
    element: 'Planta',
    prototypeTier: 'core_story',
    anatomyClass: 'web_weaver',
    material: 'luminous_silk',
    bodyProportions: { widthScale: 1.0, heightScale: 0.96, headRatio: 0.45, posture: 'agile_lean' },
    silhouetteHooks: ['Cuatro patas arácnidas ágiles', 'Cresta de hileras sedosas', 'Marcas esmeralda en el abdomen'],
    eyeStyle: 'sly_angular',
    mouthStyle: 'smirk',
    palette: {
      primary: '#10b981',
      secondary: '#34d399',
      belly: '#d1fae5',
      shadow: '#064e3b',
      highlight: '#ecfdf5',
      eyeIris: '#fde047',
      energyCore: '#6ee7b7',
    },
    temperament: 'Táctica, alerta y maestra de emboscadas aéreas.',
    personalityQuote: '«Una red a tiempo cambia cualquier duelo.»',
    vfxSignature: {
      particleKind: 'leaf_spore',
      transformLabel: 'Tejedora Seda',
      impactSummary: 'Telaraña luminosa expansiva que frena al rival',
    },
  },
  bubbaleone: {
    speciesId: 'bubbaleone',
    storyOrder: 17,
    storyChapter: 'Acto I · Cuevas Verdes',
    biome: 'Verdes',
    element: 'Agua',
    prototypeTier: 'core_story',
    anatomyClass: 'bubble_orb',
    material: 'aqua_smooth',
    bodyProportions: { widthScale: 1.08, heightScale: 0.96, headRatio: 0.48, posture: 'upright' },
    silhouetteHooks: ['Cúpula dorsal de burbuja translúcida', 'Mofletes espumosos elásticos', 'Cola en gota acuática'],
    eyeStyle: 'friendly_oval',
    mouthStyle: 'cheerful_open',
    palette: {
      primary: '#06b6d4',
      secondary: '#67e8f9',
      belly: '#cffafe',
      shadow: '#155e75',
      highlight: '#ffffff',
      eyeIris: '#083344',
      energyCore: '#a5f3fc',
    },
    temperament: 'Alegre, elástica e imperturbable bajo presión.',
    personalityQuote: '«Lo que rebota en la burbuja vuelve con fuerza.»',
    vfxSignature: {
      particleKind: 'bubble',
      transformLabel: 'Esfera Presión',
      impactSummary: 'Cúpula hidrodinámica con burbujas en cadena',
    },
  },
  rammstone: {
    speciesId: 'rammstone',
    storyOrder: 18,
    storyChapter: 'Acto III · Cavernas de Magma',
    biome: 'Magma',
    element: 'Tierra',
    prototypeTier: 'core_story',
    anatomyClass: 'granite_brawler',
    material: 'volcanic_crust',
    bodyProportions: { widthScale: 1.2, heightScale: 1.02, headRatio: 0.46, posture: 'armored_stout' },
    silhouetteHooks: ['Cuernos curvos de granito gemelos', 'Puños pétreos delanteros', 'Ceño férreo de carnero'],
    eyeStyle: 'stoic_brow',
    mouthStyle: 'fierce_scowl',
    palette: {
      primary: '#d97706',
      secondary: '#f59e0b',
      belly: '#fef3c7',
      shadow: '#78350f',
      highlight: '#fffbeb',
      eyeIris: '#1c1917',
      energyCore: '#fbbf24',
    },
    temperament: 'Firme, decidida y lista para romper barreras.',
    personalityQuote: '«Cuando bajo los cuernos, la roca cede.»',
    vfxSignature: {
      particleKind: 'obsidian_shard',
      transformLabel: 'Carnero Granito',
      impactSummary: 'Impacto sísmico perforante con esquirlas doradas',
    },
  },
  fandango: {
    speciesId: 'fandango',
    storyOrder: 19,
    storyChapter: 'Acto II · Cuevas Heladas',
    biome: 'Heladas',
    element: 'Energia',
    prototypeTier: 'core_story',
    anatomyClass: 'harmonic_spark',
    material: 'prismatic_aura',
    bodyProportions: { widthScale: 0.9, heightScale: 1.06, headRatio: 0.46, posture: 'hovering' },
    silhouetteHooks: ['Corona armónica radiante', 'Nodos laterales conductores de luz', 'Estela chispeante bicolor'],
    eyeStyle: 'wide_hyper_spark',
    mouthStyle: 'gentle_smile',
    palette: {
      primary: '#10b981',
      secondary: '#fde047',
      belly: '#fef9c3',
      shadow: '#065f46',
      highlight: '#ffffff',
      eyeIris: '#047857',
      energyCore: '#fef08a',
    },
    temperament: 'Vibrante, optimista y llena de carga armónica.',
    personalityQuote: '«¡Siente cómo se acelera la recarga del equipo!»',
    vfxSignature: {
      particleKind: 'volt_arc',
      transformLabel: 'Resonador Flash',
      impactSummary: 'Pulso energético limpio que revitaliza al lanzador',
    },
  },
  armashelt: {
    speciesId: 'armashelt',
    storyOrder: 20,
    storyChapter: 'Acto III · Cavernas de Magma',
    biome: 'Magma',
    element: 'Tierra',
    prototypeTier: 'deep_expedition',
    anatomyClass: 'armored_mortar',
    material: 'volcanic_crust',
    bodyProportions: { widthScale: 1.24, heightScale: 0.94, headRatio: 0.44, posture: 'armored_stout' },
    silhouetteHooks: ['Caparazón segmentado de bronce', 'Visera acorazada frontal', 'Espolón de artillería trasero'],
    eyeStyle: 'heavy_amber_slit',
    mouthStyle: 'armored_jaw',
    palette: {
      primary: '#92400e',
      secondary: '#fb923c',
      belly: '#fed7aa',
      shadow: '#451a03',
      highlight: '#ffedd5',
      eyeIris: '#fde047',
      energyCore: '#f97316',
    },
    temperament: 'Blindada, metódica e implacable como un mortero.',
    personalityQuote: '«Aguanta el impacto, devuelve el doble.»',
    vfxSignature: {
      particleKind: 'obsidian_shard',
      transformLabel: 'Mortero Blindado',
      impactSummary: 'Proyectil balístico de bronce con choque expansivo',
    },
  },
};

export const STORY_ORDERED_SPECIES_IDS: string[] = Object.values(SLUG_DESIGN_SHEETS)
  .sort((a, b) => a.storyOrder - b.storyOrder)
  .map((s) => s.speciesId);

export function getSlugDesignSheet(speciesId: string): SlugDesignSheet {
  return SLUG_DESIGN_SHEETS[speciesId] || SLUG_DESIGN_SHEETS.infurnus;
}

export interface SlugAnimFrameSample {
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
  tiltDeg: number;
  blinkClosed: boolean;
  glowPulse: number;
  crestBobPx: number;
  tailWagDeg: number;
  eyeLookX: number;
  eyeLookY: number;
  crestTiltDeg: number;
  jawOpen: number;
  sparkAlpha: number;
  cheekPulse: number;
  auraScale: number;
}

/**
 * Unified reusable animation evaluator for SVG portraits, world slugs & duel previews.
 */
export function sampleSlugAnimationFrame(
  speciesId: string,
  animState: SlugAnimationState,
  timeSec: number,
  reducedMotion = false
): SlugAnimFrameSample {
  const sheet = getSlugDesignSheet(speciesId);
  const posture = sheet.bodyProportions.posture;

  // Deterministic species phase offset so slugs in the same room feel organic
  let hash = 0;
  for (let i = 0; i < speciesId.length; i++) hash = (hash * 31 + speciesId.charCodeAt(i)) | 0;
  const phase = (Math.abs(hash) % 100) * 0.0628;
  const t = timeSec + phase;

  // Species temperament cadence:
  // - Infurnus: vibrant agile buoyant flame pulse
  // - Frostcrawler: heavy armored glacial weight
  // - Tazerling: rapid hyperactive electric darting
  const isInfurnus = speciesId === 'infurnus';
  const isFrostcrawler = speciesId === 'frostcrawler';
  const isTazerling = speciesId === 'tazerling';

  const blinkPeriod = isTazerling ? 2.8 : isFrostcrawler ? 4.2 : 3.4;
  const blinkCycle = t % blinkPeriod;
  const blinkClosed =
    animState === 'sleep' ||
    animState === 'rest' ||
    (animState !== 'ko' && animState !== 'hit' && blinkCycle > blinkPeriod - 0.16);

  if (reducedMotion) {
    const isAttackPose = animState === 'attack' || animState === 'fire' || animState === 'flight';
    const isChargePose = animState === 'charge' || animState === 'transform';
    const isRestPose = animState === 'sleep' || animState === 'rest';
    return {
      offsetX: 0,
      offsetY: isRestPose ? 1.2 : 0,
      scaleX: isAttackPose ? 1.05 : isRestPose ? 1.03 : 1,
      scaleY: isRestPose ? 0.94 : 1,
      tiltDeg: isAttackPose ? -5 : isChargePose ? -3 : 0,
      blinkClosed,
      glowPulse: 0.72,
      crestBobPx: 0,
      tailWagDeg: 0,
      eyeLookX: 0,
      eyeLookY: 0,
      crestTiltDeg: 0,
      jawOpen: animState === 'eat' || animState === 'happy' || isAttackPose ? 0.5 : 0,
      sparkAlpha: isChargePose || isAttackPose ? 0.65 : 0.25,
      cheekPulse: 0.6,
      auraScale: 1,
    };
  }

  const agilityMult = isTazerling
    ? 1.55
    : isFrostcrawler
    ? 0.68
    : posture === 'agile_lean'
    ? 1.45
    : posture === 'low_crawler' || posture === 'armored_stout'
    ? 0.72
    : 1.0;

  // Subtle organic glance drift (quick saccades for Tazerling, slow scan for Frostcrawler)
  const lookFreq = isTazerling ? 2.9 : isFrostcrawler ? 0.85 : 1.45;
  const baseLookX = Math.sin(t * lookFreq) * (isTazerling ? 0.72 : isFrostcrawler ? 0.35 : 0.5);
  const baseLookY = Math.cos(t * lookFreq * 0.7) * (isTazerling ? 0.32 : 0.18);

  // Intermittent spark flare for energetic species (especially Tazerling & Infurnus)
  const sparkBurst = Math.max(0, Math.sin(t * (isTazerling ? 9.5 : 5.2)) * 0.65 + Math.cos(t * 14.3) * 0.35);

  switch (animState) {
    case 'walk': {
      const s = Math.sin(t * 7.8 * agilityMult);
      const lift = isFrostcrawler ? 1.2 : isTazerling ? 3.0 : 2.5;
      return {
        offsetX: Math.sin(t * 3.9 * agilityMult) * (isFrostcrawler ? 0.7 : 1.35),
        offsetY: -Math.abs(s) * lift,
        scaleX: 1 + s * (isFrostcrawler ? 0.035 : 0.055),
        scaleY: 1 - s * (isFrostcrawler ? 0.035 : 0.055),
        tiltDeg: s * (isFrostcrawler ? 2.8 : isTazerling ? 7.5 : 5.8),
        blinkClosed,
        glowPulse: 0.68 + Math.sin(t * 5.5) * 0.22,
        crestBobPx: -Math.abs(s) * (isInfurnus ? 1.45 : 1.05),
        tailWagDeg: s * (isTazerling ? 19 : isFrostcrawler ? 8 : 15),
        eyeLookX: 0.35 + baseLookX * 0.3,
        eyeLookY: -0.1,
        crestTiltDeg: -s * (isInfurnus ? 9 : isTazerling ? 11 : 3),
        jawOpen: isTazerling ? 0.35 : 0.12,
        sparkAlpha: Math.min(1, 0.3 + sparkBurst * (isTazerling ? 0.7 : 0.45)),
        cheekPulse: 0.65 + Math.abs(s) * 0.3,
        auraScale: 1 + Math.abs(s) * 0.04,
      };
    }
    case 'happy':
    case 'play':
    case 'victory': {
      const bounce = Math.abs(Math.sin(t * 6.8 * agilityMult));
      const jumpScale = isFrostcrawler ? 2.1 : isTazerling ? 3.8 : 3.2;
      return {
        offsetX: animState === 'play' ? Math.sin(t * 4.4 * agilityMult) * (isFrostcrawler ? 1.0 : 2.1) : 0,
        offsetY: -bounce * jumpScale,
        scaleX: 1.04 - bounce * (isFrostcrawler ? 0.04 : 0.07),
        scaleY: 0.96 + bounce * (isFrostcrawler ? 0.06 : 0.1),
        tiltDeg: Math.sin(t * 6.8 * agilityMult) * (isFrostcrawler ? 4.5 : 8),
        blinkClosed: false,
        glowPulse: 0.85 + Math.sin(t * 8.5) * 0.15,
        crestBobPx: -bounce * (isInfurnus ? 1.9 : 1.5),
        tailWagDeg: Math.sin(t * 11.5) * (isFrostcrawler ? 11 : 21),
        eyeLookX: animState === 'play' ? Math.sin(t * 4.4) * 0.65 : 0,
        eyeLookY: -0.25,
        crestTiltDeg: Math.sin(t * 9.5) * (isFrostcrawler ? 4 : 12),
        jawOpen: 0.65 + bounce * 0.35,
        sparkAlpha: Math.min(1, 0.5 + sparkBurst * 0.5),
        cheekPulse: 0.85 + bounce * 0.15,
        auraScale: 1.05 + bounce * 0.08,
      };
    }
    case 'eat': {
      const munch = Math.sin(t * (isFrostcrawler ? 8.5 : 11.8));
      return {
        offsetX: 0,
        offsetY: Math.max(0, munch) * (isFrostcrawler ? 0.9 : 1.4),
        scaleX: 1 + munch * 0.06,
        scaleY: 1 - munch * 0.06,
        tiltDeg: 4 + munch * 4,
        blinkClosed: munch > 0.35,
        glowPulse: 0.75 + Math.sin(t * 6) * 0.15,
        crestBobPx: munch * 0.75,
        tailWagDeg: Math.sin(t * 8) * 12,
        eyeLookX: 0.2,
        eyeLookY: 0.35,
        crestTiltDeg: munch * 5,
        jawOpen: 0.35 + Math.max(0, munch) * 0.65,
        sparkAlpha: 0.35,
        cheekPulse: 0.6 + Math.max(0, munch) * 0.35,
        auraScale: 1.02,
      };
    }
    case 'rest':
    case 'sleep': {
      const breath = Math.sin(t * (isFrostcrawler ? 1.4 : 1.9));
      return {
        offsetX: 0,
        offsetY: 1.4 + breath * 0.4,
        scaleX: 1.04 + breath * 0.032,
        scaleY: 0.92 - breath * 0.032,
        tiltDeg: isFrostcrawler ? 1 : 2,
        blinkClosed: true,
        glowPulse: 0.36 + breath * 0.12,
        crestBobPx: breath * 0.4,
        tailWagDeg: breath * 3,
        eyeLookX: 0,
        eyeLookY: 0,
        crestTiltDeg: breath * 2,
        jawOpen: Math.max(0, breath * 0.18),
        sparkAlpha: 0.1,
        cheekPulse: 0.3 + breath * 0.1,
        auraScale: 0.94,
      };
    }
    case 'react':
    case 'charge': {
      const pulse = Math.sin(t * (isTazerling ? 20 : 14));
      return {
        offsetX: animState === 'charge' ? pulse * (isTazerling ? 1.35 : 0.85) : 0,
        offsetY: animState === 'react' ? -2.1 + pulse * 0.45 : -0.8 + pulse * 0.55,
        scaleX: animState === 'charge' ? 0.95 + pulse * 0.05 : 0.97 + pulse * 0.03,
        scaleY: animState === 'charge' ? 1.08 - pulse * 0.04 : 1.05,
        tiltDeg: animState === 'charge' ? -7 : -3 + pulse * 2,
        blinkClosed: false,
        glowPulse: 0.95 + Math.abs(pulse) * 0.05,
        crestBobPx: -1.6 + pulse * 0.65,
        tailWagDeg: pulse * (isFrostcrawler ? 10 : 18),
        eyeLookX: animState === 'react' ? Math.sin(t * 5) * 0.55 : 0.45,
        eyeLookY: -0.25,
        crestTiltDeg: pulse * (isTazerling ? 14 : 9),
        jawOpen: animState === 'charge' ? 0.55 : 0.28,
        sparkAlpha: animState === 'charge' ? 0.85 + Math.abs(pulse) * 0.15 : 0.72,
        cheekPulse: 1,
        auraScale: 1.08 + Math.abs(pulse) * 0.08,
      };
    }
    case 'fire':
    case 'flight':
    case 'transform':
    case 'attack': {
      const surge = Math.sin(t * 17);
      const isFlight = animState === 'fire' || animState === 'flight';
      return {
        offsetX: isFlight ? 1.4 : 0.8,
        offsetY: -1.3 + surge * 0.5,
        scaleX: animState === 'transform' ? 1.15 : isFlight ? 1.1 : 1.06,
        scaleY: animState === 'transform' ? 0.9 : isFlight ? 0.93 : 0.95,
        tiltDeg: (isFlight ? -10 : -8) + surge * 2.5,
        blinkClosed: false,
        glowPulse: 1,
        crestBobPx: -1.8 + surge * 0.5,
        tailWagDeg: surge * 22,
        eyeLookX: 0.55,
        eyeLookY: -0.15,
        crestTiltDeg: -10 + surge * 8,
        jawOpen: 0.88,
        sparkAlpha: 1,
        cheekPulse: 1,
        auraScale: 1.14 + Math.abs(surge) * 0.06,
      };
    }
    case 'hit':
    case 'ko': {
      const shudder = animState === 'hit' ? Math.sin(t * 28) : 0;
      return {
        offsetX: animState === 'hit' ? shudder * 1.9 : 0,
        offsetY: animState === 'ko' ? 2.2 : 0.7,
        scaleX: animState === 'ko' ? 1.06 : 0.92,
        scaleY: animState === 'ko' ? 0.88 : 1.06,
        tiltDeg: animState === 'ko' ? 14 : 9 + shudder * 3,
        blinkClosed: animState === 'ko',
        glowPulse: animState === 'ko' ? 0.2 : 0.65,
        crestBobPx: 0.7,
        tailWagDeg: shudder * 8,
        eyeLookX: -0.35,
        eyeLookY: 0.25,
        crestTiltDeg: animState === 'ko' ? 14 : 10,
        jawOpen: animState === 'hit' ? 0.7 : 0.15,
        sparkAlpha: animState === 'hit' ? 0.55 : 0,
        cheekPulse: animState === 'ko' ? 0.15 : 0.6,
        auraScale: animState === 'ko' ? 0.85 : 0.96,
      };
    }
    case 'idle':
    default: {
      const breath = Math.sin(t * 2.8 * agilityMult);
      const hoverBoost = posture === 'hovering' ? -1.4 + Math.sin(t * 3.6) * 1.1 : 0;
      const microJitterX = isTazerling && Math.sin(t * 7.3) > 0.88 ? Math.sin(t * 42) * 0.55 : 0;
      return {
        offsetX: microJitterX,
        offsetY: hoverBoost + (posture === 'hovering' ? 0 : Math.max(0, -breath) * (isFrostcrawler ? 0.35 : 0.65)),
        scaleX: 1 + breath * (isFrostcrawler ? 0.036 : 0.028),
        scaleY: 1 - breath * (isFrostcrawler ? 0.036 : 0.028),
        tiltDeg: Math.sin(t * 1.6 * agilityMult) * (isFrostcrawler ? 1.0 : isTazerling ? 3.2 : 2.1),
        blinkClosed,
        glowPulse: 0.66 + breath * 0.2,
        crestBobPx: breath * (isInfurnus ? 0.95 : 0.65),
        tailWagDeg: Math.sin(t * 3.6 * agilityMult) * (isFrostcrawler ? 4.5 : isTazerling ? 12 : 8.5),
        eyeLookX: baseLookX,
        eyeLookY: baseLookY,
        crestTiltDeg: Math.sin(t * 3.1 * agilityMult) * (isInfurnus ? 6.5 : isTazerling ? 8 : 2),
        jawOpen: isTazerling ? 0.25 + Math.max(0, breath) * 0.15 : 0.08,
        sparkAlpha: isTazerling ? Math.max(0, sparkBurst - 0.15) : isInfurnus ? 0.35 + Math.max(0, breath) * 0.25 : 0.2,
        cheekPulse: 0.6 + breath * 0.22,
        auraScale: 1 + breath * 0.03,
      };
    }
  }
}
