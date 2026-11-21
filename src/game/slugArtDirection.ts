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
  | 'celestial_core';

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

  // Blink window (~150ms every ~3.4s)
  const blinkCycle = t % 3.4;
  const blinkClosed =
    animState === 'sleep' ||
    animState === 'rest' ||
    (animState !== 'ko' && animState !== 'hit' && blinkCycle > 3.22);

  if (reducedMotion) {
    return {
      offsetX: 0,
      offsetY: animState === 'sleep' || animState === 'rest' ? 1.2 : 0,
      scaleX: animState === 'attack' || animState === 'fire' ? 1.05 : 1,
      scaleY: animState === 'rest' || animState === 'sleep' ? 0.94 : 1,
      tiltDeg: animState === 'attack' ? -5 : 0,
      blinkClosed,
      glowPulse: 0.72,
      crestBobPx: 0,
      tailWagDeg: 0,
    };
  }

  const agilityMult = posture === 'agile_lean' ? 1.45 : posture === 'low_crawler' || posture === 'armored_stout' ? 0.72 : 1.0;

  switch (animState) {
    case 'walk': {
      const s = Math.sin(t * 7.5 * agilityMult);
      return {
        offsetX: Math.sin(t * 3.8 * agilityMult) * 1.1,
        offsetY: -Math.abs(s) * (posture === 'low_crawler' ? 1.4 : 2.6),
        scaleX: 1 + s * 0.05,
        scaleY: 1 - s * 0.05,
        tiltDeg: s * (posture === 'low_crawler' ? 3 : 6),
        blinkClosed,
        glowPulse: 0.65 + Math.sin(t * 5) * 0.2,
        crestBobPx: -Math.abs(s) * 1.1,
        tailWagDeg: s * 14,
      };
    }
    case 'happy':
    case 'play':
    case 'victory': {
      const bounce = Math.abs(Math.sin(t * 6.8 * agilityMult));
      return {
        offsetX: animState === 'play' ? Math.sin(t * 4.2) * 1.8 : 0,
        offsetY: -bounce * 3.2,
        scaleX: 1.04 - bounce * 0.06,
        scaleY: 0.96 + bounce * 0.09,
        tiltDeg: Math.sin(t * 6.8) * 7,
        blinkClosed: false,
        glowPulse: 0.85 + Math.sin(t * 8) * 0.15,
        crestBobPx: -bounce * 1.6,
        tailWagDeg: Math.sin(t * 11) * 18,
      };
    }
    case 'eat': {
      const munch = Math.sin(t * 11.5);
      return {
        offsetX: 0,
        offsetY: Math.max(0, munch) * 1.4,
        scaleX: 1 + munch * 0.06,
        scaleY: 1 - munch * 0.06,
        tiltDeg: 5 + munch * 4,
        blinkClosed: munch > 0.35,
        glowPulse: 0.75 + Math.sin(t * 6) * 0.15,
        crestBobPx: munch * 0.7,
        tailWagDeg: Math.sin(t * 8) * 12,
      };
    }
    case 'rest':
    case 'sleep': {
      const breath = Math.sin(t * 1.9);
      return {
        offsetX: 0,
        offsetY: 1.4 + breath * 0.4,
        scaleX: 1.04 + breath * 0.03,
        scaleY: 0.92 - breath * 0.03,
        tiltDeg: 2,
        blinkClosed: true,
        glowPulse: 0.38 + breath * 0.12,
        crestBobPx: breath * 0.4,
        tailWagDeg: breath * 3,
      };
    }
    case 'react':
    case 'charge': {
      const pulse = Math.sin(t * 14);
      return {
        offsetX: animState === 'charge' ? pulse * 0.9 : 0,
        offsetY: -1.6 + pulse * 0.6,
        scaleX: 0.96 + pulse * 0.05,
        scaleY: 1.06 - pulse * 0.04,
        tiltDeg: animState === 'charge' ? -6 : -3,
        blinkClosed: false,
        glowPulse: 0.95,
        crestBobPx: -1.4 + pulse * 0.5,
        tailWagDeg: pulse * 16,
      };
    }
    case 'fire':
    case 'flight':
    case 'transform':
    case 'attack': {
      const surge = Math.sin(t * 16);
      return {
        offsetX: 0.8,
        offsetY: -1.2 + surge * 0.5,
        scaleX: animState === 'transform' ? 1.14 : 1.06,
        scaleY: animState === 'transform' ? 0.92 : 0.95,
        tiltDeg: -8 + surge * 2,
        blinkClosed: false,
        glowPulse: 1,
        crestBobPx: -1.5,
        tailWagDeg: surge * 20,
      };
    }
    case 'hit':
    case 'ko': {
      return {
        offsetX: animState === 'hit' ? Math.sin(t * 24) * 1.8 : 0,
        offsetY: animState === 'ko' ? 2.2 : 0.6,
        scaleX: animState === 'ko' ? 1.06 : 0.93,
        scaleY: animState === 'ko' ? 0.88 : 1.05,
        tiltDeg: animState === 'ko' ? 12 : 8,
        blinkClosed: animState === 'ko',
        glowPulse: animState === 'ko' ? 0.2 : 0.6,
        crestBobPx: 0.6,
        tailWagDeg: 0,
      };
    }
    case 'idle':
    default: {
      const breath = Math.sin(t * 2.8 * agilityMult);
      const hoverBoost = posture === 'hovering' ? -1.4 + Math.sin(t * 3.6) * 1.1 : 0;
      return {
        offsetX: 0,
        offsetY: hoverBoost + (posture === 'hovering' ? 0 : Math.max(0, -breath) * 0.5),
        scaleX: 1 + breath * 0.028,
        scaleY: 1 - breath * 0.028,
        tiltDeg: Math.sin(t * 1.5) * 1.8,
        blinkClosed,
        glowPulse: 0.65 + breath * 0.2,
        crestBobPx: breath * 0.7,
        tailWagDeg: Math.sin(t * 3.4) * 7,
      };
    }
  }
}
