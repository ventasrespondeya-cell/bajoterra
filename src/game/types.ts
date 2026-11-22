import type { CanonSourceTag, StoryHudSummary, StoryProgressState } from './storyTypes';

export type BiomeId = 'Verdes' | 'Magma' | 'Heladas' | 'Sombrias';

export type ElementType =
  | 'Fuego'
  | 'Agua'
  | 'Electrico'
  | 'Hielo'
  | 'Sombra'
  | 'Luz'
  | 'Tierra'
  | 'Planta'
  | 'Energia';

export type Rarity = 'Común' | 'Rara' | 'Épica' | 'Legendaria';

export enum TileType {
  FLOOR = 0,
  WATER = 1,
  ROCK = 2,
  WOOD_PILLAR = 3,
  MUSHROOM = 4,
  ORE = 5,
  CRACKED_WALL = 6,
  LAVA = 7,
  ICE = 8,
  SHADOW_CRYSTAL = 9,
  WALL = 10,
  BUILT_FLOOR = 11,
  RECHARGE_STATION = 12,
  ENERGY_CRYSTAL = 13,
  TORCH = 14,
  DOOR_CLOSED = 15,
  DOOR_OPEN = 16,
  CHEST_CLOSED = 17,
  CHEST_OPEN = 18,
  ALTAR = 19,
  ICE_FLOOR = 20,
  ANCIENT_BRICK = 21,
  MAGMA_COAL = 22,
  THERMAL_COPPER = 23,
  ICE_CRYSTAL = 24,
  BLUE_QUARTZ = 25,
  DARK_IRON = 26,
  NEON_MUSHROOM = 27,
  KELP = 28,
  VOLCANIC_ROCK = 29,
  EVO_STONE_VEIN = 30,
}

export interface Chunk {
  cx: number;
  cy: number;
  tiles: Uint8Array; // 16 * 16 = 256
  lastUsed: number;
}

export type InventoryKey =
  | 'ore'
  | 'wood'
  | 'stone'
  | 'crystal'
  | 'shadowShard'
  | 'berries'
  | 'core'
  | 'capsules'
  | 'masterCapsules'
  | 'torches'
  | 'walls'
  | 'floors'
  | 'doors'
  | 'stations'
  | 'elixirs'
  | 'relics'
  | 'emberSnack'
  | 'frostNectar'
  | 'nest'
  | 'bed'
  | 'feeder'
  | 'decor'
  | 'rootWood'
  | 'magmaCoal'
  | 'thermalCopper'
  | 'iceCrystal'
  | 'blueQuartz'
  | 'darkIron'
  | 'neonMushroom'
  | 'evoStone';

export type Inventory = Record<InventoryKey, number>;

export type HotbarAction = 'pulse' | 'berry' | 'station';

export interface HotbarSlot {
  id: HotbarAction;
  label: string;
  keyHint: string;
  itemKey?: InventoryKey;
}

export interface SlugMove {
  id: string;
  name: string;
  power: number;
  energyCost: number;
  cooldown: number;
  effect?: 'burn' | 'chill' | 'stun' | 'heal' | 'shield' | 'pierce' | 'drain';
  description: string;
}

export type SlugPersonality =
  | 'juguetona'
  | 'calmada'
  | 'curiosa'
  | 'energetica'
  | 'timida'
  | 'orgullosa'
  | 'traviesa'
  | 'valiente';

export interface SlugSpecies {
  id: string;
  name: string;
  type: ElementType;
  rarity: Rarity;
  icon: string;
  color: string;
  accent: string;
  baseHp: number;
  baseAtk: number;
  baseDef: number;
  baseSpd: number;
  evoName: string;
  habitat: BiomeId;
  lore: string;
  canonStatus?: CanonSourceTag;
  canonNote?: string;
  specialMoves: [SlugMove, SlugMove];
}

export interface SlugInstance {
  uid: string;
  id: string;
  name: string;
  nickname?: string;
  personality?: SlugPersonality;
  type: ElementType;
  rarity: Rarity;
  icon: string;
  level: number;
  xp: number;
  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  atk: number;
  def: number;
  spd: number;
  bond: number;
  mega: boolean;
  isBred?: boolean;
  bonusTrait?: string;
  moveMastery?: [number, number];
}

export interface BreedingEgg {
  id: string;
  parentAName: string;
  parentBName: string;
  speciesId: string;
  stepsRemaining: number;
  totalSteps: number;
  bonusTrait: string;
}

export type EnemyStrategy = 'agresivo' | 'defensivo' | 'tactico' | 'jefe';

export interface CombatantState {
  uid: string;
  id: string;
  name: string;
  type: ElementType;
  icon: string;
  level: number;
  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  atk: number;
  def: number;
  spd: number;
  mega: boolean;
  shieldTurns: number; // active shield duration (> 0)
  burnTurns: number;
  stunTurns: number;
  chillTurns: number;
  telegraphing?: 'heavy' | 'heal' | 'pierce' | null;
  strategy?: EnemyStrategy;
  isBoss?: boolean;
  bossId?: string;
  isMercenary?: boolean;
  cooldowns: Record<string, number>;
  // Real-time status timers (seconds)
  burnTimer?: number;
  burnTickAccum?: number;
  stunTimer?: number;
  chillTimer?: number;
  shieldTimer?: number;
}

export interface CombatEffectEvent {
  id: number;
  target: 'enemy' | 'ally';
  kind: 'hit' | 'crit' | 'heal' | 'shield' | 'pulse' | 'capture' | 'status' | 'transform' | 'clash';
  text: string;
  color: string;
  x?: number;
  y?: number;
  age?: number;
}

export type ProjectilePhase = 'protoform' | 'transforming' | 'transformed';
export type BlasterShotMode = 'quick' | 0 | 1 | 'pulse';
export type ArenaObstacleKind = 'cover' | 'reflector' | 'boost_ring' | 'updraft';

export interface DuelArenaObstacle {
  id: string;
  kind: ArenaObstacleKind;
  x: number;
  y: number;
  w: number;
  h: number;
  hp?: number;
  maxHp?: number;
  element?: ElementType;
  label?: string;
}

export interface DuelistArenaState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  aimAngle: number;
  charge: number; // 0..1
  charging: boolean;
  recoil: number; // seconds
  guardTimer: number; // seconds remaining
  guardCooldown: number; // seconds remaining
  reloadTimer: number; // seconds remaining
  hitFlash: number; // seconds
  perfectFlash: number; // seconds
  telegraphProgress: number; // 0..1 for enemy
  aiCooldown: number; // seconds until next enemy decision
  aiTargetX?: number;
  aiTargetY: number;
}

export interface DuelProjectile {
  id: number;
  owner: 'ally' | 'enemy';
  speciesId: string;
  slugName: string;
  element: ElementType;
  mega: boolean;
  mode: 'quick' | 'move0' | 'move1' | 'pulse' | 'capsule';
  capsuleKey?: 'capsules' | 'masterCapsules';
  moveIndex?: 0 | 1;
  moveId?: string;
  moveEffect?: 'burn' | 'chill' | 'stun' | 'heal' | 'shield' | 'pierce' | 'drain';
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  radius: number;
  distanceTraveled: number;
  transformDist: number;
  phase: ProjectilePhase;
  transformTimer: number;
  chargeScore: number;
  perfectRelease: boolean;
  powerScore: number;
  gravityScale: number;
  homing: number; // rad/s
  bouncesLeft: number;
  phaseObstacles: boolean;
  pierceLeft: number;
  aoeRadius: number;
  trail: Array<{ x: number; y: number; r: number }>;
  alive: boolean;
  hitTarget?: boolean;
}

export interface DuelShockwave {
  id: number;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
  label?: string;
  kind: 'impact' | 'transform' | 'clash' | 'shield' | 'heal' | 'capture';
}

export interface BattleState {
  active: boolean;
  kind: 'wild' | 'mercenary' | 'boss';
  biome: BiomeId;
  subtitle: string;
  enemy: CombatantState;
  turn: 'duel' | 'ended';
  selectedMode: BlasterShotMode;
  pulseCharge: number; // 0..100
  pulseWindowActive: boolean;
  pulseReason: string;
  elapsedSec: number;
  hitstopTimer: number;
  cameraShake: number;
  playerDuelist: DuelistArenaState;
  enemyDuelist: DuelistArenaState;
  projectiles: DuelProjectile[];
  obstacles: DuelArenaObstacle[];
  shockwaves: DuelShockwave[];
  allyStatus: {
    shieldTimer: number;
    burnTimer: number;
    burnTickAccum: number;
    chillTimer: number;
    stunTimer: number;
  };
  log: string[];
  effects: CombatEffectEvent[];
  outcome?: 'victory' | 'defeat' | 'captured' | 'escaped';
  rewardText?: string;
  captureResult?: {
    slugUid: string;
    speciesId: string;
    slugName: string;
    level: number;
    element: ElementType;
    rarity: Rarity;
    isNewSpecies: boolean;
    destination: 'party' | 'storage';
  };
}

export type QuestMetric =
  | 'oreMined'
  | 'wins'
  | 'biomesFound'
  | 'torchesPlaced'
  | 'structuresBuilt'
  | 'chestsOpened'
  | 'speciesCaptured'
  | 'eggsHatched'
  | 'shelterTier'
  | 'bossesDefeated'
  | 'megaUnlocked'
  | 'challengesCleared'
  | 'dialoguesDone'
  | 'tournamentsWon'
  | 'racesWon';

export interface QuestCondition {
  metric: QuestMetric;
  goal: number;
  label: string;
}

export interface QuestDef {
  id: string;
  category: 'principal' | 'secundaria';
  title: string;
  description: string;
  metric: QuestMetric;
  goal: number;
  extraConditions?: QuestCondition[];
  rewardText: string;
  rewards: Partial<Inventory> & { xp?: number; perk?: string };
}

export interface RoamingEntity {
  uid: string;
  kind: 'wild' | 'mercenary' | 'boss' | 'merchant' | 'story_npc';
  speciesId?: string;
  bossId?: string;
  challengeId?: string;
  characterId?: string;
  dialogueId?: string;
  scenarioId?: string;
  name: string;
  icon: string;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  biome: BiomeId;
  level: number;
  hp: number;
  dir: number;
  cooldown: number;
}

export interface CraftRecipe {
  id: string;
  name: string;
  description: string;
  outputKey: InventoryKey;
  outputQty: number;
  cost: Partial<Inventory>;
}

export interface GameOptions {
  soundEnabled: boolean;
  volume: number;
  touchControls: 'auto' | 'on' | 'off';
  lightingQuality: 'high' | 'eco';
  showMinimap: boolean;
  reducedMotion?: boolean;
}

export interface PlayerState {
  x: number;
  y: number;
  facingX: number;
  facingY: number;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  level: number;
  xp: number;
  perks: string[];
}

export interface SaveMetadata {
  revision: number;
  savedAt: number;
}

export type HabitatId =
  | 'habitat_thermal'
  | 'habitat_aquatic'
  | 'habitat_crystal'
  | 'habitat_shadow'
  | 'habitat_garden';

export type FurnitureKind = 'nest' | 'bed' | 'feeder' | 'decor';

export type HomeMood = 'contenta' | 'tranquila' | 'hambrienta' | 'cansada';

export type HomeBehavior = 'pasear' | 'descansar' | 'acercarse' | 'jugar';

export interface HabitatDef {
  id: HabitatId;
  name: string;
  description: string;
  acceptedTypes: ElementType[];
  anchorX: number;
  anchorY: number;
  accentColor: string;
  floorTint: string;
}

export interface FurnitureDef {
  kind: FurnitureKind;
  name: string;
  description: string;
  comfortBonus: number;
  emitsLight?: boolean;
}

export interface HomeFurniture {
  id: string;
  kind: FurnitureKind;
  x: number;
  y: number;
}

export interface HomeSlugEntry {
  slug: SlugInstance;
  habitatId: HabitatId;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  behavior: HomeBehavior;
  behaviorTimer: number;
  mood: HomeMood;
  hunger: number; // 0..100
  energy: number; // 0..100
  happiness: number; // 0..100
  lastPetAt: number; // playTimeSec
  lastPlayAt: number; // playTimeSec
  lastFeedAt: number; // playTimeSec
  lastGreetAt?: number; // transient playTimeSec greeting cooldown
  lastSocialAt?: number; // transient playTimeSec slug-to-slug socialization cooldown
  visualActivity?: 'walk' | 'look' | 'eat' | 'play' | 'sleep' | 'social' | 'greet';
  facingX?: number; // >= 0 facing right, < 0 facing left
  reactionText?: string;
  reactionTimer?: number;
}

export interface HomeState {
  residents: HomeSlugEntry[];
  furniture: HomeFurniture[];
  lastNeedsTickSec: number;
}

export interface RoomValidationInfo {
  id: string;
  label: string;
  closed: boolean;
  hasDoor: boolean;
  hasLight: boolean;
  tileCount: number;
  walkableCount: number;
  furnitureCount: number;
  comfortScore: number;
  issues: string[];
  centerX: number;
  centerY: number;
}

export type POIKind =
  | 'secret_chamber'
  | 'outpost'
  | 'abandoned_mine'
  | 'ancient_ruins'
  | 'crystal_chamber';

export interface DiscoveredPOI {
  id: string;
  name: string;
  kind: POIKind;
  biome: BiomeId;
  x: number;
  y: number;
}

export type MechaTheme = 'shane_blue' | 'molten_core' | 'frost_pulse' | 'shadow_stealth';

export interface MechaState {
  unlocked: boolean;
  active: boolean;
  name: string;
  tier: 1 | 2 | 3;
  theme: MechaTheme;
  unlockedThemes: MechaTheme[];
  upgrades: string[];
}

export interface TrainingRecord {
  bestScore: number;
  bestRank: 'B' | 'A' | 'S';
  completions: number;
}

export interface RaceRecord {
  bestTimeSec: number;
  cleared: boolean;
  wins: number;
}

export interface GameState {
  version: '4.0';
  saveMeta?: SaveMetadata;
  worldSeed: number;
  worldWidth: number;
  worldHeight: number;
  player: PlayerState;
  party: SlugInstance[];
  storage: SlugInstance[];
  activePartyIndex: number;
  inventory: Inventory;
  cavernTokens?: number;
  selectedHotbar: number;
  tilesDelta: Record<string, number>;
  exploredChunks: Record<string, number>; // "cx,cy": 1
  discoveries: BiomeId[];
  discoveredPOIs?: DiscoveredPOI[];
  clearedChallenges?: string[];
  seenSpecies: Record<string, boolean>;
  capturedSpecies: Record<string, number>;
  eggs: BreedingEgg[];
  shelterTier: number;
  home?: HomeState;
  mecha?: MechaState;
  trainingRecords?: Record<string, TrainingRecord>;
  clearedTournaments?: string[];
  raceRecords?: Record<string, RaceRecord>;
  journalEntries?: string[];
  completedDialogues?: string[];
  discoveredSecrets?: string[];
  stats: {
    oreMined: number;
    wins: number;
    torchesPlaced: number;
    structuresBuilt: number;
    chestsOpened: number;
    eggsHatched: number;
    bossesDefeated: number;
    megaUnlocked: number;
    steps: number;
  };
  defeatedBosses: string[];
  claimedQuests: string[];
  story?: StoryProgressState;
  playTimeSec: number;
  options: GameOptions;
}

export type UIScreen = 'TITLE' | 'PLAYING' | 'PAUSED' | 'EXPEDITION' | 'FULL_MAP';

export type ExplorationActionKind =
  | 'talk'
  | 'combat'
  | 'open_door'
  | 'close_door'
  | 'open_chest'
  | 'recharge'
  | 'altar'
  | 'discover_secret'
  | 'inspect_gate'
  | 'break_secret'
  | 'pickup_furniture'
  | 'interact_slug'
  | 'berry'
  | 'place_station'
  | 'pulse'
  | 'none';

export interface ExplorationContextualAction {
  kind: ExplorationActionKind;
  label: string;
  detail: string;
  canAct: boolean;
}

export interface HudSnapshot {
  screen: UIScreen;
  player: PlayerState;
  biome: BiomeId;
  party: SlugInstance[];
  storage: SlugInstance[];
  activePartyIndex: number;
  inventory: Inventory;
  cavernTokens: number;
  selectedHotbar: number;
  contextualAction: ExplorationContextualAction;
  discoveries: BiomeId[];
  discoveredPOIs: DiscoveredPOI[];
  clearedChallenges: string[];
  seenSpecies: Record<string, boolean>;
  capturedSpecies: Record<string, number>;
  eggs: BreedingEgg[];
  shelterTier: number;
  home: HomeState;
  mecha: MechaState;
  trainingRecords: Record<string, TrainingRecord>;
  clearedTournaments: string[];
  raceRecords: Record<string, RaceRecord>;
  journalEntries: string[];
  completedDialogues: string[];
  discoveredSecrets: string[];
  rooms: RoomValidationInfo[];
  nearbyHomeSlug: HomeSlugEntry | null;
  stats: GameState['stats'];
  defeatedBosses: string[];
  claimedQuests: string[];
  story: StoryHudSummary;
  storyState: StoryProgressState;
  options: GameOptions;
  battle: BattleState | null;
  activeDialogueId: string | null;
  activeTournament: {
    tournamentId: string;
    name: string;
    roundIndex: number;
    totalRounds: number;
  } | null;
  toast: string;
  hasV4Save: boolean;
  hasV3Save: boolean;
  pulseCooldownPct: number;
}
