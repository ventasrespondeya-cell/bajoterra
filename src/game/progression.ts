import { MAX_SLUG_LEVEL, getSpecies } from './data';
import type { GameState, SlugInstance } from './types';

export { MAX_SLUG_LEVEL };
export const MAX_MOVE_MASTERY = 100;
export const MEGAMORPH_MIN_LEVEL = 5;
export const MEGAMORPH_MIN_BOND = 60;

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
  const msgs: string[] = [];
  const wasMegaEligible = !slug.mega && slug.level >= MEGAMORPH_MIN_LEVEL && slug.bond >= MEGAMORPH_MIN_BOND;

  if (opts?.bondDelta && opts.bondDelta > 0) {
    const bondRes = grantSlugBond(slug, opts.bondDelta, { allowTraitBonus: opts.allowTraitBonus });
    if (bondRes.tieredUp) {
      msgs.push(`¡${slug.name} alcanza ${bondRes.newTier.label} (Amistad ${bondRes.newBond})!`);
    }
    if (bondRes.grantedTrait) {
      msgs.push(`¡${slug.name} desarrolla el rasgo ${bondRes.grantedTrait}!`);
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
      msgs.push(`¡${slug.name} sube al nivel ${slug.level}!`);
      const newTrait = maybeGrantProgressionTrait(slug);
      if (newTrait) {
        msgs.push(`¡${slug.name} desarrolla el rasgo ${newTrait}!`);
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
      msgs.push(`¡${slug.name} desarrolla el rasgo ${newTrait}!`);
    }
  }

  const isNowMegaEligible = !slug.mega && slug.level >= MEGAMORPH_MIN_LEVEL && slug.bond >= MEGAMORPH_MIN_BOND;
  if (!wasMegaEligible && isNowMegaEligible) {
    msgs.push(`¡${slug.name} ya puede evolucionar a Megamorph desde su ficha!`);
  }

  return msgs;
}

export interface MegamorphCheck {
  eligible: boolean;
  alreadyMega: boolean;
  hasLevel: boolean;
  hasBond: boolean;
  hasResource: boolean;
  resourceKind: 'elixirs' | 'relics' | 'evoStone' | null;
  missingReasons: string[];
}

export function checkMegamorphEligibility(state: GameState, slug: SlugInstance): MegamorphCheck {
  ensureSlugProgressionFields(slug);
  if (slug.mega) {
    return {
      eligible: false,
      alreadyMega: true,
      hasLevel: true,
      hasBond: true,
      hasResource: true,
      resourceKind: null,
      missingReasons: ['Ya alcanzó su forma Megamorph.'],
    };
  }
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
  if (!hasLevel) missingReasons.push(`Nivel ${MEGAMORPH_MIN_LEVEL}+ (actual Nv.${slug.level})`);
  if (!hasBond) missingReasons.push(`Amistad ${MEGAMORPH_MIN_BOND}+ (actual ${slug.bond})`);
  if (!hasResource) missingReasons.push('1× Elixir, 1× Piedra Evolutiva o 1× Reliquia');

  return {
    eligible: hasLevel && hasBond && hasResource,
    alreadyMega: false,
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
    return { ok: false, message: `${slug.name} ya evolucionó a Megamorph.` };
  }
  if (!check.eligible || !check.resourceKind) {
    return {
      ok: false,
      message: `Faltan requisitos para Megamorph: ${check.missingReasons.join(' · ')}.`,
    };
  }

  state.inventory[check.resourceKind]--;
  const sp = getSpecies(slug.id);
  const oldName = slug.name;
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
  return {
    ok: true,
    slug,
    message: `¡EVOLUCIÓN MEGAMORPH! ${oldName} evolucionó a ${slug.name} usando ${resourceLabel}.`,
  };
}
