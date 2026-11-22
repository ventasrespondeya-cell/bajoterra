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
export type MissionType = StoryMissionCategory;

export type StoryMissionLifecycleState = 'locked' | 'available' | 'active' | 'completed';
export type MissionStatus = StoryMissionLifecycleState;

export type StoryChapterStatus = 'locked' | 'active' | 'completed';
export type ChapterStatus = StoryChapterStatus;

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

export type StoryCondition = StoryRequirement;

export interface StoryScenarioDef {
  id: string;
  name: string;
  kind: ScenarioKind;
  biome: BiomeId;
  chapterId: string;
  canonStatus: CanonSourceTag;
  summary: string;
  regionName: string;
  facilities: string[];
  connectedRouteIds: string[];
  npcIds: string[];
  encounterIds: string[];
  secretIds?: string[];
  isSecretArea?: boolean;
  worldAnchor: { x: number; y: number };
  entryOffset?: { x: number; y: number };
}

export type StoryLocation = StoryScenarioDef;

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

export type MissionObjective = StoryObjectiveDef;

export interface StoryRewardDef {
  xp?: number;
  perk?: string;
  cavernTokens?: number;
  unlockMecha?: boolean;
  items?: Partial<Inventory>;
  unlockFlags?: string[];
  unlockRouteIds?: string[];
  unlockScenarioIds?: string[];
  unlockMissionIds?: string[];
  unlockJournalIds?: string[];
  summaryText: string;
}

export type StoryReward = StoryRewardDef;

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

export type StoryMission = StoryMissionDef;

export interface StoryCharacterRef {
  id: string;
  name: string;
  role: 'protagonista' | 'aliado' | 'mentor' | 'rival' | 'antagonista' | 'mercader';
  chapterIntroId: string;
  canonStatus: CanonSourceTag;
  summary: string;
  specialty?: string;
  signatureSlugId?: string;
}

export type StoryCharacter = StoryCharacterRef;

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

export type StoryChapter = StoryChapterDef;

export interface StoryEvent {
  id: string;
  title: string;
  chapterId: string;
  summary: string;
}

export interface DialogueLine {
  speakerId: string;
  speakerName: string;
  mood: 'neutral' | 'excited' | 'serious' | 'happy' | 'warning';
  text: string;
}

export interface DialogueChoice {
  id: string;
  label: string;
  replyText: string;
  giftTokens?: number;
  giftItems?: Partial<Inventory>;
  unlockFlag?: string;
}

export interface DialogueNode {
  id: string;
  title: string;
  chapterId: string;
  scenarioId: string;
  characterId: string;
  canonStatus: CanonSourceTag;
  lines: DialogueLine[];
  choices?: DialogueChoice[];
  onCompleteFlag?: string;
  onCompleteJournalId?: string;
  rewardTokens?: number;
  rewardItems?: Partial<Inventory>;
  rewardSummary?: string;
}

export interface AdventureJournalEntry {
  id: string;
  chapterId: string;
  category: 'historia' | 'personaje' | 'descubrimiento' | 'torneo' | 'postgame';
  title: string;
  summary: string;
  canonStatus: CanonSourceTag;
}

export interface RivalDuelDef {
  id: string;
  name: string;
  title: string;
  characterId: string;
  speciesId: string;
  level: number;
  biome: BiomeId;
  chapterId: string;
  canonStatus: CanonSourceTag;
  introQuote: string;
  victoryQuote: string;
  rewardTokens: number;
  rewardItems?: Partial<Inventory>;
}

export interface TrainingChallengeDef {
  id: string;
  title: string;
  kind: 'precision' | 'velocity' | 'interception';
  subtitle: string;
  description: string;
  durationSec: number;
  targetScoreA: number;
  targetScoreS: number;
  rewardTokens: number;
  rewardMastery: number;
  rewardBond: number;
  rewardXp: number;
}

export interface TournamentRoundDef {
  roundName: string;
  opponentName: string;
  speciesId: string;
  level: number;
  strategyNote: string;
}

export interface TournamentDef {
  id: string;
  name: string;
  subtitle: string;
  biome: BiomeId;
  requiredChapterId: string;
  canonStatus: CanonSourceTag;
  rounds: TournamentRoundDef[];
  rewardTokens: number;
  rewardItems?: Partial<Inventory>;
  rewardSummary: string;
}

export interface SlugRaceDef {
  id: string;
  name: string;
  subtitle: string;
  biome: BiomeId;
  requiredMecha: boolean;
  distanceMeters: number;
  parTimeSec: number;
  rewardTokens: number;
  rewardSummary: string;
}

export interface HiddenDiscoveryDef {
  id: string;
  title: string;
  biome: BiomeId;
  minChapterOrder: number;
  lore: string;
  rewardTokens: number;
  rewardItems?: Partial<Inventory>;
  canonStatus: CanonSourceTag;
  scenarioId?: string;
  worldCoords?: { x: number; y: number };
}

export interface PostGameChallengeDef {
  id: string;
  title: string;
  subtitle: string;
  bossName: string;
  speciesId: string;
  level: number;
  biome: BiomeId;
  rewardTokens: number;
  rewardItems?: Partial<Inventory>;
  rewardSummary: string;
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
  scenarioPositions?: Record<string, { x: number; y: number }>;
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
  postGameUnlocked: boolean;
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
