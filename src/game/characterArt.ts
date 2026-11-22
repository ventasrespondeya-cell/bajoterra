export type CharacterPortraitMood =
  | 'normal'
  | 'alegre'
  | 'decidido'
  | 'sorpresa'
  | 'serio'
  | 'alerta';

export interface CharacterVisualProfile {
  id: string;
  name: string;
  title: string;
  skinTone: string;
  hairColor: string;
  hairHighlight: string;
  eyeColor: string;
  outfitPrimary: string;
  outfitSecondary: string;
  accentColor: string;
  auraBg: string;
  blasterPrimary: string;
  blasterAccent: string;
  hasGoggles?: boolean;
  hasGoatee?: boolean;
  isVillain?: boolean;
  isTroll?: boolean;
  isMolenoid?: boolean;
  isGhostEcho?: boolean;
}

export const CHARACTER_VISUAL_PROFILES: Record<string, CharacterVisualProfile> = {
  eli_shane: {
    id: 'eli_shane',
    name: 'Eli Shane',
    title: 'Lanzador de los Shane',
    skinTone: '#f4c7a1',
    hairColor: '#1e1b4b',
    hairHighlight: '#4338ca',
    eyeColor: '#0f172a',
    outfitPrimary: '#0f172a',
    outfitSecondary: '#ea580c',
    accentColor: '#38bdf8',
    auraBg: '#0c2338',
    blasterPrimary: '#f97316',
    blasterAccent: '#38bdf8',
  },
  dr_blakk: {
    id: 'dr_blakk',
    name: 'Dr. Thaddius Blakk',
    title: 'Señor de Blakk Industries',
    skinTone: '#9ab094',
    hairColor: '#26231f',
    hairHighlight: '#44403c',
    eyeColor: '#dc2626',
    outfitPrimary: '#18181b',
    outfitSecondary: '#991b1b',
    accentColor: '#ef4444',
    auraBg: '#270a14',
    blasterPrimary: '#6b21a8',
    blasterAccent: '#ef4444',
    hasGoatee: true,
    isVillain: true,
  },
  comandante_blakk: {
    id: 'comandante_blakk',
    name: 'Comandante Blakk',
    title: 'Guardia de Agua Oscura',
    skinTone: '#94a3b8',
    hairColor: '#18181b',
    hairHighlight: '#52525b',
    eyeColor: '#f43f5e',
    outfitPrimary: '#1e1b2e',
    outfitSecondary: '#be123c',
    accentColor: '#c084fc',
    auraBg: '#220b2e',
    blasterPrimary: '#3b0764',
    blasterAccent: '#f43f5e',
    isVillain: true,
  },
  pronto: {
    id: 'pronto',
    name: 'Pronto',
    title: 'Rastreador Molenoide',
    skinTone: '#65a30d',
    hairColor: '#3f6212',
    hairHighlight: '#84cc16',
    eyeColor: '#0f172a',
    outfitPrimary: '#3f2e21',
    outfitSecondary: '#dc2626',
    accentColor: '#facc15',
    auraBg: '#112a1d',
    blasterPrimary: '#78350f',
    blasterAccent: '#facc15',
    hasGoggles: true,
    isMolenoid: true,
  },
  trixie: {
    id: 'trixie',
    name: 'Trixie',
    title: 'Cronista y Estratega',
    skinTone: '#f5ccb0',
    hairColor: '#dc2626',
    hairHighlight: '#fb7185',
    eyeColor: '#15803d',
    outfitPrimary: '#064e3b',
    outfitSecondary: '#10b981',
    accentColor: '#34d399',
    auraBg: '#0b2922',
    blasterPrimary: '#0d9488',
    blasterAccent: '#a7f3d0',
  },
  kord: {
    id: 'kord',
    name: 'Kord Zane',
    title: 'Mecánico de Mecas',
    skinTone: '#477694',
    hairColor: '#1e293b',
    hairHighlight: '#64748b',
    eyeColor: '#fbbf24',
    outfitPrimary: '#452b1a',
    outfitSecondary: '#f97316',
    accentColor: '#38bdf8',
    auraBg: '#122234',
    blasterPrimary: '#b45309',
    blasterAccent: '#38bdf8',
    hasGoggles: true,
    isTroll: true,
  },
  will_shane: {
    id: 'will_shane',
    name: 'Will Shane',
    title: 'Protector de las 99 Cavernas',
    skinTone: '#e8bc96',
    hairColor: '#1e293b',
    hairHighlight: '#94a3b8',
    eyeColor: '#0284c7',
    outfitPrimary: '#0c4a6e',
    outfitSecondary: '#0284c7',
    accentColor: '#67e8f9',
    auraBg: '#0e1b3c',
    blasterPrimary: '#0369a1',
    blasterAccent: '#67e8f9',
    isGhostEcho: true,
  },
  red_hook: {
    id: 'red_hook',
    name: 'Garfio Rojo',
    title: 'Duelista Mercenario',
    skinTone: '#d4a37c',
    hairColor: '#451a03',
    hairHighlight: '#92400e',
    eyeColor: '#f59e0b',
    outfitPrimary: '#450a0a',
    outfitSecondary: '#b91c1c',
    accentColor: '#fb923c',
    auraBg: '#260d0b',
    blasterPrimary: '#7f1d1d',
    blasterAccent: '#fb923c',
    isVillain: true,
  },
  twist: {
    id: 'twist',
    name: 'Twist',
    title: 'Lanzador Sombrío',
    skinTone: '#e2b89b',
    hairColor: '#111827',
    hairHighlight: '#374151',
    eyeColor: '#4ade80',
    outfitPrimary: '#1f2937',
    outfitSecondary: '#16a34a',
    accentColor: '#4ade80',
    auraBg: '#0d2219',
    blasterPrimary: '#166534',
    blasterAccent: '#86efac',
    isVillain: true,
  },
  mercader_subterraneo: {
    id: 'mercader_subterraneo',
    name: 'Mercader Subterráneo',
    title: 'Comerciante de Cristales',
    skinTone: '#d9b08c',
    hairColor: '#064e3b',
    hairHighlight: '#10b981',
    eyeColor: '#5eead4',
    outfitPrimary: '#065f46',
    outfitSecondary: '#0d9488',
    accentColor: '#fbbf24',
    auraBg: '#082624',
    blasterPrimary: '#0f766e',
    blasterAccent: '#fbbf24',
  },
  trainer: {
    id: 'trainer',
    name: 'Entrenador de Duelo',
    title: 'Maestro del Club Shane',
    skinTone: '#eec29c',
    hairColor: '#312e81',
    hairHighlight: '#6366f1',
    eyeColor: '#0284c7',
    outfitPrimary: '#1e293b',
    outfitSecondary: '#0ea5e9',
    accentColor: '#facc15',
    auraBg: '#0c1e33',
    blasterPrimary: '#38bdf8',
    blasterAccent: '#facc15',
  },
  mercenary: {
    id: 'mercenary',
    name: 'Soldado de Blakk',
    title: 'Guardia Táctico Oscuro',
    skinTone: '#94a3b8',
    hairColor: '#18181b',
    hairHighlight: '#3f3f46',
    eyeColor: '#ef4444',
    outfitPrimary: '#111827',
    outfitSecondary: '#991b1b',
    accentColor: '#ef4444',
    auraBg: '#230b14',
    blasterPrimary: '#581c87',
    blasterAccent: '#f43f5e',
    isVillain: true,
  },
  boss_aquatic: {
    id: 'boss_aquatic',
    name: 'Leviatán Abisal',
    title: 'Señor de las Cavernas Acuáticas',
    skinTone: '#38bdf8',
    hairColor: '#082f49',
    hairHighlight: '#67e8f9',
    eyeColor: '#fef08a',
    outfitPrimary: '#0c4a6e',
    outfitSecondary: '#06b6d4',
    accentColor: '#22d3ee',
    auraBg: '#071f2e',
    blasterPrimary: '#0369a1',
    blasterAccent: '#fde047',
    isVillain: true,
  },
  boss_magma: {
    id: 'boss_magma',
    name: 'Titán Piroclasto',
    title: 'Señor de la Fragua de Magma',
    skinTone: '#7c2d12',
    hairColor: '#f97316',
    hairHighlight: '#fde047',
    eyeColor: '#fde047',
    outfitPrimary: '#29120e',
    outfitSecondary: '#ea580c',
    accentColor: '#fb923c',
    auraBg: '#271009',
    blasterPrimary: '#9a3412',
    blasterAccent: '#fde047',
    isVillain: true,
  },
  boss_ice: {
    id: 'boss_ice',
    name: 'Reina Glaciomita',
    title: 'Soberana del Santuario Helado',
    skinTone: '#cffafe',
    hairColor: '#0e7490',
    hairHighlight: '#e0f2fe',
    eyeColor: '#0284c7',
    outfitPrimary: '#155e75',
    outfitSecondary: '#67e8f9',
    accentColor: '#a5f3fc',
    auraBg: '#092434',
    blasterPrimary: '#0891b2',
    blasterAccent: '#ffffff',
    isVillain: true,
  },
  boss_crystal: {
    id: 'boss_crystal',
    name: 'Oráculo Prisma',
    title: 'Guardián del Templo de Cuarzo',
    skinTone: '#e0e7ff',
    hairColor: '#4c1d95',
    hairHighlight: '#c084fc',
    eyeColor: '#67e8f9',
    outfitPrimary: '#312e81',
    outfitSecondary: '#8b5cf6',
    accentColor: '#c084fc',
    auraBg: '#1c1238',
    blasterPrimary: '#6366f1',
    blasterAccent: '#fde047',
    isVillain: true,
  },
  boss_shadow: {
    id: 'boss_shadow',
    name: 'Espectro del Abismo',
    title: 'Sombra de la Ciudadela',
    skinTone: '#64748b',
    hairColor: '#09090b',
    hairHighlight: '#be123c',
    eyeColor: '#f43f5e',
    outfitPrimary: '#09090b',
    outfitSecondary: '#be123c',
    accentColor: '#f43f5e',
    auraBg: '#1b0818',
    blasterPrimary: '#3b0764',
    blasterAccent: '#f43f5e',
    isVillain: true,
  },
};

export function getCharacterVisualProfile(characterId: string): CharacterVisualProfile {
  const low = characterId.toLowerCase();
  if (low.includes('acuat') || low.includes('aquat')) return CHARACTER_VISUAL_PROFILES.boss_aquatic;
  if (low.includes('magma')) return CHARACTER_VISUAL_PROFILES.boss_magma;
  if (low.includes('helad') || low.includes('ice')) return CHARACTER_VISUAL_PROFILES.boss_ice;
  if (low.includes('cristal') || low.includes('crystal')) return CHARACTER_VISUAL_PROFILES.boss_crystal;
  if (low.includes('somb') || low.includes('shadow')) return CHARACTER_VISUAL_PROFILES.boss_shadow;
  return CHARACTER_VISUAL_PROFILES[characterId] || CHARACTER_VISUAL_PROFILES.eli_shane;
}

export function normalizeCharacterMood(raw?: string): CharacterPortraitMood {
  const s = (raw || '').toLowerCase();
  if (s.includes('alegr') || s.includes('feliz') || s.includes('brom') || s.includes('entusias')) return 'alegre';
  if (s.includes('decid') || s.includes('valien') || s.includes('confi')) return 'decidido';
  if (s.includes('sorpr') || s.includes('asomb')) return 'sorpresa';
  if (s.includes('alert') || s.includes('peligr') || s.includes('amenaz') || s.includes('furi')) return 'alerta';
  if (s.includes('seri') || s.includes('firm') || s.includes('mister')) return 'serio';
  return 'normal';
}
