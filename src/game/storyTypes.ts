import type { BiomeId, Inventory, QuestMetric } from './types';

export type CanonSourceTag = 'serie_canon' | 'adaptacion_juego' | 'pendiente_canon';

export type ScenarioKind =
  | 'interior'
  | 'caverna'
  | 'pueblo'
  | 'instalacion'
  | 'refugio'
  | 'arena'
  | 'especial';

export type RouteKind =
  | 'camino'
  | 'pasaje'
  | 'portal_descenso'
  | 'acceso_refugio'
  | 'puerta_sellada';

export type StoryMissionCategory = 'principal' | 'secundaria' | 'personaje' | 'hogar';

export type StoryMissionLifecycleState = 'locked' | 'available' | 'active' | 'completed';

export type StoryChapterStatus = 'locked' | 'active' | 'completed';

export interface StoryMetricRequirement {
  metric: QuestMetric;
  goal: number;
  label: string;
}

export interface StoryRequirement {
  requiredChaptersCompleted?: string[];
  requiredMissionsCompleted?: string[];
  requiredFlags?: string[];
  requiredBossesDefeated?: string[];
  requiredDiscoveredBiomes?: BiomeId[];
  requiredClearedChallenges?: string[];
  requiredMetrics?: StoryMetricRequirement[];
  requiredShelterTier?: number;
  requiredHomeResidents?: number;
  requiredMaxSlugBond?: number;
  description?: string;
}

export interface StoryScenarioDef {
  id: string;
  name: string;
  kind: ScenarioKind;
  biome: BiomeId;
  chapterId: string;
  canonStatus: CanonSourceTag;
  summary: string;
  connectedRouteIds: string[];
  npcIds: string[];
  encounterIds: string[];
  worldAnchor?: { x: number; y: number };
}

export interface StoryRouteDef {
  id: string;
  name: string;
  fromScenarioId: string;
  toScenarioId: string;
  chapterId: string;
  bidirectional: boolean;
  kind: RouteKind;
  unlockRequirements: StoryRequirement;
  lockedReason: string;
  canonStatus: CanonSourceTag;
}

export interface StoryObjectiveDef {
  id: string;
  label: string;
  metric?: QuestMetric;
  goal?: number;
  requiredFlag?: string;
  requiredBossId?: string;
  requiredBiome?: BiomeId;
  requiredScenarioId?: string;
  requiredRouteId?: string;
  requiredHomeResidents?: number;
  requiredMaxSlugBond?: number;
}

export interface StoryRewardDef {
  xp?: number;
  perk?: string;
  items?: Partial<Inventory>;
  unlockFlags?: string[];
  unlockRouteIds?: string[];
  unlockScenarioIds?: string[];
  unlockMissionIds?: string[];
  summaryText: string;
}

export interface StoryMissionDef {
  id: string;
  legacyQuestId?: string;
  category: StoryMissionCategory;
  chapterId: string;
  order: number;
  title: string;
  description: string;
  optional: boolean;
  blocksChapterCompletion: boolean;
  prerequisites: StoryRequirement;
  objectives: StoryObjectiveDef[];
  rewards: StoryRewardDef;
  onCompleteFlags?: string[];
  onCompleteEvents?: string[];
  canonStatus: CanonSourceTag;
}

export interface StoryCharacterRef {
  id: string;
  name: string;
  role: 'protagonista' | 'aliado' | 'mentor' | 'rival' | 'antagonista' | 'mercader';
  chapterIntroId: string;
  canonStatus: CanonSourceTag;
  summary: string;
}

export interface StoryEncounterRef {
  id: string;
  name: string;
  kind: 'tutorial' | 'salvaje' | 'duelo_rival' | 'jefe_capitulo' | 'emboscada';
  chapterId: string;
  scenarioId: string;
  bossId?: string;
  speciesId?: string;
  mandatoryForChapter: boolean;
  canonStatus: CanonSourceTag;
}

export interface StoryChapterDef {
  id: string;
  order: number;
  arc: string;
  title: string;
  subtitle: string;
  summary: string;
  canonStatus: CanonSourceTag;
  canonNote: string;
  prerequisiteChapterIds: string[];
  entryScenarioId: string;
  scenarioIds: string[];
  routeIds: string[];
  missionIds: string[];
  optionalContentIds: string[];
  characterIds: string[];
  encounterIds: string[];
  bossIds: string[];
  narrativeEvents: string[];
  completionConditions: StoryRequirement;
  rewards: StoryRewardDef;
  nextChapterId: string | null;
}

export interface StoryProgressState {
  schemaVersion: 1;
  currentChapterId: string;
  currentScenarioId: string;
  chapterStates: Record<string, StoryChapterStatus>;
  missionStates: Record<string, StoryMissionLifecycleState>;
  unlockedScenarioIds: string[];
  visitedScenarioIds: string[];
  unlockedRouteIds: string[];
  completedEvents: string[];
  storyFlags: Record<string, boolean>;
  claimedChapterRewards: string[];
  claimedMissionRewards: string[];
}

export interface StoryMissionSnapshotItem {
  id: string;
  legacyQuestId?: string;
  title: string;
  description: string;
  category: StoryMissionCategory;
  chapterId: string;
  state: StoryMissionLifecycleState;
  optional: boolean;
  progressText: string;
  readyToClaim: boolean;
  rewardText: string;
}

export interface StoryRouteSnapshotItem {
  id: string;
  name: string;
  fromScenarioId: string;
  toScenarioId: string;
  toScenarioName: string;
  unlocked: boolean;
  visitedDestination: boolean;
  lockedReason: string;
}

export interface StoryHudSummary {
  currentChapterId: string;
  currentChapterOrder: number;
  totalChapters: number;
  currentChapterTitle: string;
  currentChapterSubtitle: string;
  currentScenarioId: string;
  currentScenarioName: string;
  mainObjectiveText: string;
  chapterProgressPct: number;
  completedChaptersCount: number;
  activeMissions: StoryMissionSnapshotItem[];
  availableMissionsCount: number;
  nextRoute: StoryRouteSnapshotItem | null;
  unlockedRoutes: StoryRouteSnapshotItem[];
  megamorphGate: {
    unlocked: boolean;
    reason: string;
    requiredChapterTitle: string;
  };
  recentChapterAlert: string | null;
}
