import type { CinematicEvent } from './cinematicEvents';

export interface DirectorQueueSnapshot {
  featured: CinematicEvent | null;
  ambient: CinematicEvent | null;
  pendingCount: number;
  battleIntroLocked: boolean;
}

const PRIORITY_WEIGHT: Record<CinematicEvent['priority'], number> = {
  ambient: 1,
  highlight: 2,
  dramatic: 3,
};

export function isBattleIntroEvent(ev: CinematicEvent | null): boolean {
  if (!ev) return false;
  return ev.type === 'combat_intro' || ev.type === 'encounter_intro';
}

export function getCinematicDurationMs(ev: CinematicEvent, reducedMotion = false): number {
  const scale = reducedMotion ? 0.65 : 1;
  switch (ev.type) {
    case 'slug_captured':
      return Math.round(3600 * scale);
    case 'megamorph_awakened':
      return Math.round(3200 * scale);
    case 'encounter_intro':
      return Math.round((ev.enemyKind === 'boss' ? 2300 : 1750) * scale);
    case 'combat_intro':
      return Math.round(1350 * scale);
    case 'biome_discovered':
      return Math.round(2800 * scale);
    case 'poi_discovered':
      return Math.round(2600 * scale);
    case 'campaign_victory':
      return Math.round(5200 * scale);
    default:
      return Math.round(2000 * scale);
  }
}

/**
 * Pure priority & deduplication coordinator used by CinematicDirector.
 * Keeps `ambient` discoveries completely non-blocking while ensuring
 * at most one `highlight`/`dramatic` sequence renders at a time.
 */
export class CinematicQueueController {
  private featured: CinematicEvent | null = null;
  private ambient: CinematicEvent | null = null;
  private queue: CinematicEvent[] = [];
  private seenKeys = new Map<string, number>();

  public enqueue(ev: CinematicEvent, nowMs = Date.now()): {
    accepted: boolean;
    startedFeatured: CinematicEvent | null;
    startedAmbient: CinematicEvent | null;
  } {
    const dedupeId = ev.dedupeKey || `${ev.type}:${ev.title}:${ev.speciesId || ''}`;
    const lastSeen = this.seenKeys.get(dedupeId);
    if (lastSeen !== undefined && nowMs - lastSeen < 2200) {
      return { accepted: false, startedFeatured: null, startedAmbient: null };
    }
    this.seenKeys.set(dedupeId, nowMs);
    if (this.seenKeys.size > 48) {
      const oldest = this.seenKeys.keys().next().value;
      if (oldest) this.seenKeys.delete(oldest);
    }

    // Ambient POIs appear in a separate discreet banner slot and never interrupt dramatic/highlight cinematics
    if (ev.priority === 'ambient') {
      this.ambient = ev;
      return { accepted: true, startedFeatured: null, startedAmbient: ev };
    }

    if (!this.featured) {
      this.featured = ev;
      return { accepted: true, startedFeatured: ev, startedAmbient: null };
    }

    // If a dramatic capture or megamorph interrupts a biome banner, promote smoothly
    if (
      PRIORITY_WEIGHT[ev.priority] > PRIORITY_WEIGHT[this.featured.priority] &&
      !isBattleIntroEvent(this.featured)
    ) {
      this.queue.unshift(this.featured);
      this.featured = ev;
      if (this.queue.length > 6) this.queue.length = 6;
      return { accepted: true, startedFeatured: ev, startedAmbient: null };
    }

    // Insert by priority preserving FIFO within same priority
    if (this.queue.length < 6) {
      const w = PRIORITY_WEIGHT[ev.priority];
      const idx = this.queue.findIndex((item) => PRIORITY_WEIGHT[item.priority] < w);
      if (idx === -1) this.queue.push(ev);
      else this.queue.splice(idx, 0, ev);
    }
    return { accepted: true, startedFeatured: null, startedAmbient: null };
  }

  public finishFeatured(): CinematicEvent | null {
    this.featured = this.queue.shift() || null;
    return this.featured;
  }

  public skipFeatured(): CinematicEvent | null {
    if (this.featured && !this.featured.skippable) {
      return this.featured;
    }
    return this.finishFeatured();
  }

  public finishAmbient(eventId?: string): void {
    if (!this.ambient) return;
    if (!eventId || this.ambient.id === eventId) {
      this.ambient = null;
    }
  }

  public clearAll(): void {
    this.featured = null;
    this.ambient = null;
    this.queue = [];
  }

  public getSnapshot(): DirectorQueueSnapshot {
    return {
      featured: this.featured,
      ambient: this.ambient,
      pendingCount: this.queue.length,
      battleIntroLocked: isBattleIntroEvent(this.featured),
    };
  }
}
