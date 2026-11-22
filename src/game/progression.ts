import { MAX_SLUG_LEVEL, getSpecies } from './data';
import { isMegamorphNarrativelyUnlocked } from './storyEngine';
import type { GameState, SlugInstance, SlugPersonality } from './types';

export { MAX_SLUG_LEVEL };
export const MAX_MOVE_MASTERY = 100;
export const MEGAMORPH_MIN_LEVEL = 5;
export const MEGAMORPH_MIN_BOND = 60;
export const MAX_SLUG_NICKNAME_LENGTH = 24;

export const SLUG_PERSONALITIES: readonly SlugPersonality[] = [
  'juguetona',
  'calmada',
  'curiosa',
  'energetica',
  'timida',
  'orgullosa',
  'traviesa',
  'valiente',
] as const;

export interface SlugPersonalityInfo {
  id: SlugPersonality;
  label: string;
  description: string;
  reactionQuote: string;
  walkSpeedMult: number;
  restBias: number;
  playBias: number;
  greetingChance: number;
  socialCooldown: number;
}

export const SLUG_PERSONALITY_CATALOG: Record<SlugPersonality, SlugPersonalityInfo> = {
  juguetona: {
    id: 'juguetona',
    label: 'Juguetona',
    description: 'Le encanta saltar por el Refugio y jugar con sus compañeras.',
    reactionQuote: '¡Wiii! ♪',
    walkSpeedMult: 1.15,
    restBias: 0.75,
    playBias: 1.45,
    greetingChance: 0.88,
    socialCooldown: 14,
  },
  calmada: {
    id: 'calmada',
    label: 'Calmada',
    description: 'Prefiere descansar en su hábitat y observar con serenidad.',
    reactionQuote: 'Paz total...',
    walkSpeedMult: 0.82,
    restBias: 1.45,
    playBias: 0.7,
    greetingChance: 0.65,
    socialCooldown: 24,
  },
  curiosa: {
    id: 'curiosa',
    label: 'Curiosa',
    description: 'Explora cada mueble y rincón del refugio y se acerca rápido a saludarte.',
    reactionQuote: '¿Qué es eso?',
    walkSpeedMult: 1.08,
    restBias: 0.9,
    playBias: 1.1,
    greetingChance: 0.96,
    socialCooldown: 16,
  },
  energetica: {
    id: 'energetica',
    label: 'Energética',
    description: 'Siempre lista para correr y recargar baterías a máxima velocidad.',
    reactionQuote: '¡A 100 MPH!',
    walkSpeedMult: 1.28,
    restBias: 0.65,
    playBias: 1.35,
    greetingChance: 0.85,
    socialCooldown: 15,
  },
  timida: {
    id: 'timida',
    label: 'Tímida',
    description: 'Necesita cariño gradual, pero es sumamente fiel cuando gana confianza.',
    reactionQuote: 'Holita...',
    walkSpeedMult: 0.88,
    restBias: 1.25,
    playBias: 0.85,
    greetingChance: 0.48,
    socialCooldown: 28,
  },
  orgullosa: {
    id: 'orgullosa',
    label: 'Orgullosa',
    description: 'Mantiene porte firme y busca destacar en los duelos de bláster.',
    reactionQuote: '¡Lista!',
    walkSpeedMult: 0.96,
    restBias: 1.05,
    playBias: 0.9,
    greetingChance: 0.6,
    socialCooldown: 22,
  },
  traviesa: {
    id: 'traviesa',
    label: 'Traviesa',
    description: 'Busca socializar y hacer piruetas impredecibles alrededor de otras babosas.',
    reactionQuote: '¡Jeje!',
    walkSpeedMult: 1.2,
    restBias: 0.75,
    playBias: 1.3,
    greetingChance: 0.78,
    socialCooldown: 12,
  },
  valiente: {
    id: 'valiente',
    label: 'Valiente',
    description: 'Siempre en guardia cerca del portal para proteger el Refugio Shane.',
    reactionQuote: '¡En guardia!',
    walkSpeedMult: 1.05,
    restBias: 0.85,
    playBias: 1.15,
    greetingChance: 0.9,
    socialCooldown: 18,
  },
};

export function getDeterministicPersonality(uid: string): SlugPersonality {
  let hash = 2166136261;
  for (let i = 0; i < uid.length; i++) {
    hash ^= uid.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const idx = Math.abs(hash) % SLUG_PERSONALITIES.length;
  return SLUG_PERSONALITIES[idx];
}

export function getSlugPersonality(slug: Pick<SlugInstance, 'uid' | 'personality'>): SlugPersonality {
  if (slug.personality && slug.personality in SLUG_PERSONALITY_CATALOG) {
    return slug.personality;
  }
  return getDeterministicPersonality(slug.uid);
}

export function getSlugPersonalityInfo(
  slug: Pick<SlugInstance, 'uid' | 'personality'>
): SlugPersonalityInfo {
  return SLUG_PERSONALITY_CATALOG[getSlugPersonality(slug)];
}

export function normalizeSlugNickname(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const cleaned = raw.replace(/[\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return undefined;
  return cleaned.slice(0, MAX_SLUG_NICKNAME_LENGTH);
}

export function getSlugDisplayName(slug: Pick<SlugInstance, 'name' | 'nickname'>): string {
  const nick = slug.nickname?.trim();
  return nick && nick.length > 0 ? nick : slug.name;
}

export function getSlugSpeciesName(slug: Pick<SlugInstance, 'id' | 'name' | 'mega'>): string {
  const sp = getSpecies(slug.id);
  return slug.mega ? sp.evoName : sp.name;
}

export interface BondTierInfo {
  tier: 1 | 2 | 3 | 4 | 5;
  label: string;
  min: number;
  nextMin: number | null;
  progressPct: number;
  color: string;
  summary: string;
}

export const BOND_TIERS: Array<{
  tier: 1 | 2 | 3 | 4 | 5;
  label: string;
  min: number;
  max: number;
  color: string;
  summary: string;
}> = [
  {
    tier: 1,
    label: 'Conocidos',
    min: 0,
    max: 24,
    color: '#94a3b8',
    summary: 'Vínculo inicial. Cuídala o combate junto a ella para ganar confianza.',
  },
  {
    tier: 2,
    label: 'Confianza',
    min: 25,
    max: 49,
    color: '#38bdf8',
    summary: 'Apta para crianza en la Incubadora del Refugio.',
  },
  {
    tier: 3,
    label: 'Amistad',
    min: 50,
    max: 74,
    color: '#4ade80',
    summary: 'Desbloquea rasgo propio si no tiene y acerca más rápido en el hogar.',
  },
  {
    tier: 4,
    label: 'Gran amistad',
    min: 75,
    max: 99,
    color: '#facc15',
    summary: 'Cumple el vínculo requerido para despertar Megamorph.',
  },
  {
    tier: 5,
    label: 'Vínculo excepcional',
    min: 100,
    max: 100,
    color: '#f472b6',
    summary: 'Compañera inseparable de máxima afinidad contigo.',
  },
];

export interface TraitInfo {
  id: string;
  label: string;
  description: string;
}

export const TRAIT_CATALOG: Record<string, TraitInfo> = {
  'Vitalidad +': {
    id: 'Vitalidad +',
    label: 'Vitalidad +',
    description: 'Rasgo de crianza: +10 PS máximos desde el nacimiento.',
  },
  'Potencia +': {
    id: 'Potencia +',
    label: 'Potencia +',
    description: 'Rasgo de crianza: +3 Ataque desde el nacimiento.',
  },
  'Velocidad +': {
    id: 'Velocidad +',
    label: 'Velocidad +',
    description: 'Rasgo de crianza: +3 Velocidad desde el nacimiento.',
  },
  Resistente: {
    id: 'Resistente',
    label: 'Resistente',
    description: 'Rasgo de experiencia: +4 Defensa permanente.',
  },
  Veloz: {
    id: 'Veloz',
    label: 'Veloz',
    description: 'Rasgo de experiencia: +3 Velocidad permanente.',
  },
  Vital: {
    id: 'Vital',
    label: 'Vital',
    description: 'Rasgo de experiencia: +12 PS máximos permanentes.',
  },
  Energética: {
    id: 'Energética',
    label: 'Energética',
    description: 'Rasgo de experiencia: +3 Energía máxima permanente.',
  },
  Leal: {
    id: 'Leal',
    label: 'Leal',
    description: 'Rasgo de vínculo: +1 Amistad adicional al fortalecer el lazo.',
  },
};

export const PROGRESSION_TRAIT_POOL = ['Resistente', 'Veloz', 'Vital', 'Energética', 'Leal'] as const;

export interface MoveMasteryRankInfo {
  rank: 0 | 1 | 2 | 3;
  label: string;
  points: number;
  nextThreshold: number | null;
  powerMultiplier: number;
  energyDiscount: number;
  bonusText: string;
}

export function ensureSlugProgressionFields(slug: SlugInstance): SlugInstance {
  if (!Array.isArray(slug.moveMastery) || slug.moveMastery.length !== 2) {
    slug.moveMastery = [0, 0];
  } else {
    slug.moveMastery = [
      Math.max(0, Math.min(MAX_MOVE_MASTERY, Math.round(slug.moveMastery[0] || 0))),
      Math.max(0, Math.min(MAX_MOVE_MASTERY, Math.round(slug.moveMastery[1] || 0))),
    ];
  }
  slug.bond = Math.max(0, Math.min(100, Math.round(Number.isFinite(slug.bond) ? slug.bond : 0)));
  slug.level = Math.max(
    1,
    Math.min(MAX_SLUG_LEVEL, Math.floor(Number.isFinite(slug.level) ? slug.level : 1))
  );
  if (slug.level >= MAX_SLUG_LEVEL) {
    slug.xp = 0;
  } else {
    slug.xp = Math.max(0, Math.round(Number.isFinite(slug.xp) ? slug.xp : 0));
  }
  slug.nickname = normalizeSlugNickname(slug.nickname);
  if (!slug.personality || !(slug.personality in SLUG_PERSONALITY_CATALOG)) {
    slug.personality = getDeterministicPersonality(slug.uid);
  }
  return slug;
}

export function getXpForNextLevel(level: number): number {
  return Math.max(1, Math.floor(level)) * 40;
}

export function getBondTierInfo(bond: number): BondTierInfo {
  const clamped = Math.max(0, Math.min(100, Math.round(bond || 0)));
  for (let i = 0; i < BOND_TIERS.length; i++) {
    const def = BOND_TIERS[i];
    if (clamped <= def.max || i === BOND_TIERS.length - 1) {
      const next = BOND_TIERS[i + 1] ?? null;
      const span = next ? next.min - def.min : 1;
      const progressPct = next ? Math.min(100, Math.max(0, Math.round(((clamped - def.min) / span) * 100))) : 100;
      return {
        tier: def.tier,
        label: def.label,
        min: def.min,
        nextMin: next ? next.min : null,
        progressPct,
        color: def.color,
        summary: def.summary,
      };
    }
  }
  const fallback = BOND_TIERS[0];
  return {
    tier: fallback.tier,
    label: fallback.label,
    min: fallback.min,
    nextMin: 25,
    progressPct: 0,
    color: fallback.color,
    summary: fallback.summary,
  };
}

export function getTraitInfo(trait?: string): TraitInfo | null {
  if (!trait) return null;
  return (
    TRAIT_CATALOG[trait] || {
      id: trait,
      label: trait,
      description: 'Rasgo especial adquirido durante la aventura.',
    }
  );
}

export function getMoveMasteryInfo(points = 0): MoveMasteryRankInfo {
  const pts = Math.max(0, Math.min(MAX_MOVE_MASTERY, Math.round(points)));
  if (pts >= 100) {
    return {
      rank: 3,
      label: 'Maestría',
      points: pts,
      nextThreshold: null,
      powerMultiplier: 1.22,
      energyDiscount: 1,
      bonusText: '+22% potencia · -1 EN (coste ≥5)',
    };
  }
  if (pts >= 50) {
    return {
      rank: 2,
      label: 'Dominio II',
      points: pts,
      nextThreshold: 100,
      powerMultiplier: 1.15,
      energyDiscount: 0,
      bonusText: '+15% potencia',
    };
  }
  if (pts >= 20) {
    return {
      rank: 1,
      label: 'Dominio I',
      points: pts,
      nextThreshold: 50,
      powerMultiplier: 1.08,
      energyDiscount: 0,
      bonusText: '+8% potencia',
    };
  }
  return {
    rank: 0,
    label: 'Base',
    points: pts,
    nextThreshold: 20,
    powerMultiplier: 1.0,
    energyDiscount: 0,
    bonusText: 'Usa la técnica para ganar maestría',
  };
}

export function getEffectiveMoveEnergyCost(baseCost: number, masteryPoints = 0): number {
  const info = getMoveMasteryInfo(masteryPoints);
  if (info.energyDiscount > 0 && baseCost >= 5) {
    return Math.max(3, baseCost - info.energyDiscount);
  }
  return baseCost;
}

export function grantMoveMastery(
  slug: SlugInstance,
  moveIndex: 0 | 1,
  points: number
): { previousRank: number; newRank: number; newLabel: string; gained: number } {
  ensureSlugProgressionFields(slug);
  const current = slug.moveMastery![moveIndex] || 0;
  const prevInfo = getMoveMasteryInfo(current);
  const safePts = Number.isFinite(points) ? Math.max(0, Math.round(points)) : 0;
  const next = Math.min(MAX_MOVE_MASTERY, current + safePts);
  slug.moveMastery![moveIndex] = next;
  const nextInfo = getMoveMasteryInfo(next);
  return {
    previousRank: prevInfo.rank,
    newRank: nextInfo.rank,
    newLabel: nextInfo.label,
    gained: next - current,
  };
}

export function maybeGrantProgressionTrait(slug: SlugInstance): string | null {
  ensureSlugProgressionFields(slug);
  if (slug.bonusTrait) return null;
  if (slug.level < 4 && slug.bond < 50) return null;

  const sp = getSpecies(slug.id);
  let chosen: string = PROGRESSION_TRAIT_POOL[0];
  if (slug.bond >= 50 && slug.level < 4) {
    chosen = 'Leal';
  } else if (sp.type === 'Electrico' || sp.type === 'Fuego') {
    chosen = 'Veloz';
  } else if (sp.type === 'Tierra' || sp.type === 'Hielo') {
    chosen = 'Resistente';
  } else if (sp.type === 'Luz' || sp.type === 'Planta' || sp.type === 'Agua') {
    chosen = 'Vital';
  } else {
    chosen = 'Energética';
  }

  slug.bonusTrait = chosen;
  if (chosen === 'Resistente') {
    slug.def += 4;
  } else if (chosen === 'Veloz') {
    slug.spd += 3;
  } else if (chosen === 'Vital') {
    slug.maxHp += 12;
    slug.hp = Math.min(slug.maxHp, slug.hp + 12);
  } else if (chosen === 'Energética') {
    slug.maxEnergy += 3;
    slug.energy = Math.min(slug.maxEnergy, slug.energy + 3);
  }
  return chosen;
}

export interface BondGrantResult {
  gained: number;
  previousBond: number;
  newBond: number;
  previousTier: BondTierInfo;
  newTier: BondTierInfo;
  tieredUp: boolean;
  grantedTrait: string | null;
}

export function grantSlugBond(
  slug: SlugInstance,
  baseDelta: number,
  opts?: { allowTraitBonus?: boolean }
): BondGrantResult {
  ensureSlugProgressionFields(slug);
  const previousBond = slug.bond;
  const previousTier = getBondTierInfo(previousBond);
  let delta = Number.isFinite(baseDelta) ? Math.max(0, Math.round(baseDelta)) : 0;
  if (delta > 0 && opts?.allowTraitBonus !== false && slug.bonusTrait === 'Leal') {
    delta += 1;
  }
  const newBond = Math.min(100, previousBond + delta);
  slug.bond = newBond;
  const newTier = getBondTierInfo(newBond);
  const grantedTrait = maybeGrantProgressionTrait(slug);

  return {
    gained: newBond - previousBond,
    previousBond,
    newBond,
    previousTier,
    newTier,
    tieredUp: newTier.tier > previousTier.tier,
    grantedTrait,
  };
}

export interface ExperienceGrantOptions {
  bondDelta?: number;
  allowTraitBonus?: boolean;
}

export function awardSlugExperience(
  _state: GameState,
  slug: SlugInstance,
  amount: number,
  opts?: ExperienceGrantOptions
): string[] {
  ensureSlugProgressionFields(slug);
  const displayName = getSlugDisplayName(slug);
  const msgs: string[] = [];
  const narrativeGate = isMegamorphNarrativelyUnlocked(_state);
  const wasMegaEligible =
    !slug.mega &&
    narrativeGate.unlocked &&
    slug.level >= MEGAMORPH_MIN_LEVEL &&
    slug.bond >= MEGAMORPH_MIN_BOND;

  if (opts?.bondDelta && opts.bondDelta > 0) {
    const bondRes = grantSlugBond(slug, opts.bondDelta, { allowTraitBonus: opts.allowTraitBonus });
    if (bondRes.tieredUp) {
      msgs.push(`¡${displayName} alcanza ${bondRes.newTier.label} (Amistad ${bondRes.newBond})!`);
    }
    if (bondRes.grantedTrait) {
      msgs.push(`¡${displayName} desarrolla el rasgo ${bondRes.grantedTrait}!`);
    }
  }

  const safeAmount = Number.isFinite(amount) && amount > 0 ? Math.round(amount) : 0;
  if (slug.level < MAX_SLUG_LEVEL && safeAmount > 0) {
    slug.xp += safeAmount;
    while (slug.level < MAX_SLUG_LEVEL && slug.xp >= getXpForNextLevel(slug.level)) {
      slug.xp -= getXpForNextLevel(slug.level);
      slug.level++;
      slug.maxHp += 8;
      slug.hp = slug.maxHp;
      slug.maxEnergy += 2;
      slug.energy = slug.maxEnergy;
      slug.atk += 3;
      slug.def += 2;
      slug.spd += 1;
      msgs.push(`¡${displayName} sube al nivel ${slug.level}!`);
      const newTrait = maybeGrantProgressionTrait(slug);
      if (newTrait) {
        msgs.push(`¡${displayName} desarrolla el rasgo ${newTrait}!`);
      }
    }
    if (slug.level >= MAX_SLUG_LEVEL) {
      slug.xp = 0;
    }
  } else {
    if (slug.level >= MAX_SLUG_LEVEL) {
      slug.xp = 0;
    }
    const newTrait = maybeGrantProgressionTrait(slug);
    if (newTrait) {
      msgs.push(`¡${displayName} desarrolla el rasgo ${newTrait}!`);
    }
  }

  const isNowMegaEligible =
    !slug.mega &&
    narrativeGate.unlocked &&
    slug.level >= MEGAMORPH_MIN_LEVEL &&
    slug.bond >= MEGAMORPH_MIN_BOND;
  if (!wasMegaEligible && isNowMegaEligible) {
    msgs.push(`¡${displayName} ya puede evolucionar a Megamorph desde su ficha!`);
  }

  return msgs;
}

export interface MegamorphCheck {
  eligible: boolean;
  alreadyMega: boolean;
  hasNarrativeUnlock: boolean;
  narrativeReason: string;
  hasLevel: boolean;
  hasBond: boolean;
  hasResource: boolean;
  resourceKind: 'elixirs' | 'relics' | 'evoStone' | null;
  missingReasons: string[];
}

export function checkMegamorphEligibility(state: GameState, slug: SlugInstance): MegamorphCheck {
  ensureSlugProgressionFields(slug);
  const narrativeGate = isMegamorphNarrativelyUnlocked(state);
  if (slug.mega) {
    return {
      eligible: false,
      alreadyMega: true,
      hasNarrativeUnlock: narrativeGate.unlocked,
      narrativeReason: narrativeGate.reason,
      hasLevel: true,
      hasBond: true,
      hasResource: true,
      resourceKind: null,
      missingReasons: ['Ya alcanzó su forma Megamorph.'],
    };
  }
  const hasNarrativeUnlock = narrativeGate.unlocked;
  const hasLevel = slug.level >= MEGAMORPH_MIN_LEVEL;
  const hasBond = slug.bond >= MEGAMORPH_MIN_BOND;
  const resourceKind: 'elixirs' | 'relics' | 'evoStone' | null =
    state.inventory.elixirs >= 1
      ? 'elixirs'
      : state.inventory.evoStone >= 1
      ? 'evoStone'
      : state.inventory.relics >= 1
      ? 'relics'
      : null;
  const hasResource = resourceKind !== null;

  const missingReasons: string[] = [];
  if (!hasNarrativeUnlock) missingReasons.push(narrativeGate.reason);
  if (!hasLevel) missingReasons.push(`Nivel ${MEGAMORPH_MIN_LEVEL}+ (actual Nv.${slug.level})`);
  if (!hasBond) missingReasons.push(`Amistad ${MEGAMORPH_MIN_BOND}+ (actual ${slug.bond})`);
  if (!hasResource) missingReasons.push('1× Elixir, 1× Piedra Evolutiva o 1× Reliquia');

  return {
    eligible: hasNarrativeUnlock && hasLevel && hasBond && hasResource,
    alreadyMega: false,
    hasNarrativeUnlock,
    narrativeReason: narrativeGate.reason,
    hasLevel,
    hasBond,
    hasResource,
    resourceKind,
    missingReasons,
  };
}

export function findSlugByUidAnywhere(state: GameState, slugUid: string): SlugInstance | null {
  const direct = [...state.party, ...state.storage].find((s) => s.uid === slugUid);
  if (direct) return direct;
  const homeRes = state.home?.residents.find((r) => r.slug.uid === slugUid);
  return homeRes ? homeRes.slug : null;
}

export function setSlugNickname(
  state: GameState,
  slugUid: string,
  rawNickname: string
): { ok: boolean; message: string; slug?: SlugInstance; displayName?: string } {
  const slug = findSlugByUidAnywhere(state, slugUid);
  if (!slug) {
    return { ok: false, message: 'No se encontró la babosa seleccionada.' };
  }
  const trimmedRaw = typeof rawNickname === 'string' ? rawNickname.replace(/[\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim() : '';
  if (trimmedRaw.length === 0) {
    return clearSlugNickname(state, slugUid);
  }
  if (trimmedRaw.length > MAX_SLUG_NICKNAME_LENGTH) {
    return {
      ok: false,
      message: `El apodo debe tener máximo ${MAX_SLUG_NICKNAME_LENGTH} caracteres.`,
    };
  }
  slug.nickname = trimmedRaw;
  const displayName = getSlugDisplayName(slug);
  return {
    ok: true,
    slug,
    displayName,
    message: `Apodo guardado: ${displayName} (${slug.name}).`,
  };
}

export function clearSlugNickname(
  state: GameState,
  slugUid: string
): { ok: boolean; message: string; slug?: SlugInstance } {
  const slug = findSlugByUidAnywhere(state, slugUid);
  if (!slug) {
    return { ok: false, message: 'No se encontró la babosa seleccionada.' };
  }
  delete slug.nickname;
  return {
    ok: true,
    slug,
    message: `Nombre restaurado al oficial de la especie (${slug.name}).`,
  };
}

export function evolveSlugToMegamorph(
  state: GameState,
  slugUid: string
): { ok: boolean; message: string; slug?: SlugInstance } {
  const slug = findSlugByUidAnywhere(state, slugUid);
  if (!slug) {
    return { ok: false, message: 'No se encontró la babosa seleccionada.' };
  }
  const check = checkMegamorphEligibility(state, slug);
  if (check.alreadyMega) {
    return { ok: false, message: `${getSlugDisplayName(slug)} ya evolucionó a Megamorph.` };
  }
  if (!check.eligible || !check.resourceKind) {
    return {
      ok: false,
      message: `Faltan requisitos para Megamorph: ${check.missingReasons.join(' · ')}.`,
    };
  }

  state.inventory[check.resourceKind]--;
  const sp = getSpecies(slug.id);
  const oldDisplay = getSlugDisplayName(slug);
  slug.mega = true;
  slug.name = sp.evoName;
  slug.maxHp += 22;
  slug.hp = slug.maxHp;
  slug.maxEnergy += 2;
  slug.energy = slug.maxEnergy;
  slug.atk += 6;
  slug.def += 4;
  slug.spd += 2;
  state.stats.megaUnlocked++;

  const resourceLabel =
    check.resourceKind === 'elixirs'
      ? '1 Elixir Megamorph'
      : check.resourceKind === 'evoStone'
      ? '1 Piedra Evolutiva'
      : '1 Reliquia Antigua';
  const resultName = slug.nickname ? `${slug.nickname} (${slug.name})` : slug.name;
  return {
    ok: true,
    slug,
    message: `¡EVOLUCIÓN MEGAMORPH! ${oldDisplay} evolucionó a ${resultName} usando ${resourceLabel}.`,
  };
}
