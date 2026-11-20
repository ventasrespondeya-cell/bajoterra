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
  | 'relics';

export type Inventory = Record<InventoryKey, number>;

export type HotbarAction =
  | 'mine'
  | 'torch'
  | 'wall'
  | 'floor'
  | 'door'
  | 'station'
  | 'berry'
  | 'pulse';

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
  specialMoves: [SlugMove, SlugMove];
}

export interface SlugInstance {
  uid: string;
  id: string;
  name: string;
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
  shieldTurns: number;
  burnTurns: number;
  stunTurns: number;
  chillTurns: number;
  telegraphing?: 'heavy' | 'heal' | 'pierce' | null;
  strategy?: EnemyStrategy;
  isBoss?: boolean;
  bossId?: string;
  isMercenary?: boolean;
  cooldowns: Record<string, number>;
}

export interface CombatEffectEvent {
  id: number;
  target: 'enemy' | 'ally';
  kind: 'hit' | 'crit' | 'heal' | 'shield' | 'pulse' | 'capture' | 'status';
  text: string;
  color: string;
}

export interface BattleState {
  active: boolean;
  kind: 'wild' | 'mercenary' | 'boss';
  subtitle: string;
  enemy: CombatantState;
  turn: 'player' | 'enemy' | 'resolving' | 'pulse_window' | 'ended';
  pulseCharge: number; // 0..100
  pulseWindowActive: boolean;
  pulseReason: string;
  log: string[];
  effects: CombatEffectEvent[];
  outcome?: 'victory' | 'defeat' | 'captured' | 'escaped';
  rewardText?: string;
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
  | 'megaUnlocked';

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
  kind: 'wild' | 'mercenary' | 'boss' | 'merchant';
  speciesId?: string;
  bossId?: string;
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

export interface GameState {
  version: '4.0';
  worldSeed: number;
  worldWidth: number;
  worldHeight: number;
  player: PlayerState;
  party: SlugInstance[];
  storage: SlugInstance[];
  activePartyIndex: number;
  inventory: Inventory;
  selectedHotbar: number;
  tilesDelta: Record<string, number>;
  exploredChunks: Record<string, number>; // "cx,cy": 1
  discoveries: BiomeId[];
  seenSpecies: Record<string, boolean>;
  capturedSpecies: Record<string, number>;
  eggs: BreedingEgg[];
  shelterTier: number;
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
  playTimeSec: number;
  options: GameOptions;
}

export type UIScreen = 'TITLE' | 'PLAYING' | 'PAUSED' | 'EXPEDITION' | 'FULL_MAP';

export interface HudSnapshot {
  screen: UIScreen;
  player: PlayerState;
  biome: BiomeId;
  party: SlugInstance[];
  storage: SlugInstance[];
  activePartyIndex: number;
  inventory: Inventory;
  selectedHotbar: number;
  discoveries: BiomeId[];
  seenSpecies: Record<string, boolean>;
  capturedSpecies: Record<string, number>;
  eggs: BreedingEgg[];
  shelterTier: number;
  stats: GameState['stats'];
  defeatedBosses: string[];
  claimedQuests: string[];
  options: GameOptions;
  battle: BattleState | null;
  toast: string;
  hasV4Save: boolean;
  hasV3Save: boolean;
  pulseCooldownPct: number;
}
