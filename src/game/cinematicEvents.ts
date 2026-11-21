import type { BiomeId, ElementType, POIKind, Rarity } from './types';

export type CinematicEventType =
  | 'slug_captured'
  | 'encounter_intro'
  | 'combat_intro'
  | 'megamorph_awakened'
  | 'biome_discovered'
  | 'poi_discovered';

export type AudioCueMood =
  | 'exploration_calm'
  | 'discovery_wonder'
  | 'duel_tension'
  | 'boss_ominous'
  | 'victory_fanfare'
  | 'capture_chime'
  | 'megamorph_fanfare';

export interface CinematicEvent {
  id: string;
  type: CinematicEventType;
  timestampMs: number;
  title: string;
  subtitle?: string;
  biome?: BiomeId;
  speciesId?: string;
  poiKind?: POIKind;
  audioCue: AudioCueMood;
  skippable: boolean;
  priority: 'ambient' | 'highlight' | 'dramatic';
  enemyKind?: 'wild' | 'mercenary' | 'boss';
  enemyLevel?: number;
  allySpeciesId?: string;
  allyName?: string;
  allyMega?: boolean;
  isNewSpecies?: boolean;
  captureDestination?: 'party' | 'storage';
  slugName?: string;
  slugElement?: ElementType;
  slugRarity?: Rarity;
  loreLine?: string;
  dedupeKey?: string;
}

export type CinematicEventListener = (event: CinematicEvent) => void;

class CinematicEventBus {
  private listeners = new Set<CinematicEventListener>();
  private recentQueue: CinematicEvent[] = [];
  private seq = 1;

  public subscribe(listener: CinematicEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public emit(payload: Omit<CinematicEvent, 'id' | 'timestampMs'>): CinematicEvent {
    const event: CinematicEvent = {
      ...payload,
      id: `cin_${this.seq++}_${Date.now().toString(36)}`,
      timestampMs: Date.now(),
    };
    this.recentQueue.push(event);
    if (this.recentQueue.length > 16) {
      this.recentQueue.shift();
    }
    this.listeners.forEach((fn) => {
      try {
        fn(event);
      } catch {
        // Never allow cinematic listeners to disrupt the core game loop
      }
    });
    return event;
  }

  public getRecentEvents(): CinematicEvent[] {
    return this.recentQueue.map((e) => ({ ...e }));
  }

  public clear(): void {
    this.recentQueue = [];
  }
}

export const cinematicEvents = new CinematicEventBus();
