import {
  INITIAL_CHAPTER_ID,
  INITIAL_SCENARIO_ID,
  MEGAMORPH_NARRATIVE_FLAG,
  MEGAMORPH_REQUIRED_CHAPTER_ID,
  STORY_CHAPTERS,
  STORY_CHAPTERS_BY_ID,
  STORY_MISSIONS,
  STORY_MISSIONS_BY_ID,
  STORY_MISSIONS_BY_LEGACY_ID,
  STORY_ROUTES,
  STORY_SCENARIOS,
} from './storyData';
import type {
  StoryChapterStatus,
  StoryHudSummary,
  StoryMissionDef,
  StoryMissionLifecycleState,
  StoryMissionSnapshotItem,
  StoryObjectiveDef,
  StoryProgressState,
  StoryRequirement,
  StoryRewardDef,
  StoryRouteSnapshotItem,
} from './storyTypes';
import type { GameState, InventoryKey, QuestMetric } from './types';

const SORTED_CHAPTERS = [...STORY_CHAPTERS].sort((a, b) => a.order - b.order);

function pushUnique(arr: string[], value: string): boolean {
  if (!arr.includes(value)) {
    arr.push(value);
    return true;
  }
  return false;
}

export function createInitialStoryState(): StoryProgressState {
  const chapterStates: Record<string, StoryChapterStatus> = {};
  for (const ch of SORTED_CHAPTERS) {
    chapterStates[ch.id] = ch.id === INITIAL_CHAPTER_ID ? 'active' : 'locked';
  }

  const missionStates: Record<string, StoryMissionLifecycleState> = {};
  for (const m of STORY_MISSIONS) {
    if (m.chapterId === INITIAL_CHAPTER_ID) {
      missionStates[m.id] = !m.optional && m.category === 'principal' ? 'active' : 'available';
    } else {
      missionStates[m.id] = 'locked';
    }
  }

  return {
    schemaVersion: 1,
    currentChapterId: INITIAL_CHAPTER_ID,
    currentScenarioId: INITIAL_SCENARIO_ID,
    chapterStates,
    missionStates,
    unlockedScenarioIds: ['esc_refugio_shane', 'esc_caverna_descenso'],
    visitedScenarioIds: [INITIAL_SCENARIO_ID],
    unlockedRouteIds: ['ruta_descenso_verde'],
    completedEvents: ['ev_descenso_iniciado'],
    storyFlags: {},
    claimedChapterRewards: [],
    claimedMissionRewards: [],
    scenarioPositions: {},
  };
}

export function ensureStoryState(state: GameState): StoryProgressState {
  if (!state.story) {
    state.story = createInitialStoryState();
    return state.story;
  }
  const s = state.story;
  s.schemaVersion = 1;
  if (!s.chapterStates || typeof s.chapterStates !== 'object') s.chapterStates = {};
  if (!s.missionStates || typeof s.missionStates !== 'object') s.missionStates = {};
  if (!Array.isArray(s.unlockedScenarioIds)) s.unlockedScenarioIds = [INITIAL_SCENARIO_ID];
  if (!Array.isArray(s.visitedScenarioIds)) s.visitedScenarioIds = [INITIAL_SCENARIO_ID];
  if (!Array.isArray(s.unlockedRouteIds)) s.unlockedRouteIds = ['ruta_descenso_verde'];
  if (!Array.isArray(s.completedEvents)) s.completedEvents = [];
  if (!s.storyFlags || typeof s.storyFlags !== 'object') s.storyFlags = {};
  if (!Array.isArray(s.claimedChapterRewards)) s.claimedChapterRewards = [];
  if (!Array.isArray(s.claimedMissionRewards)) s.claimedMissionRewards = [];
  if (!s.scenarioPositions || typeof s.scenarioPositions !== 'object') s.scenarioPositions = {};

  for (const ch of SORTED_CHAPTERS) {
    if (!s.chapterStates[ch.id]) {
      s.chapterStates[ch.id] = ch.id === INITIAL_CHAPTER_ID ? 'active' : 'locked';
    }
  }
  for (const m of STORY_MISSIONS) {
    if (!s.missionStates[m.id]) {
      s.missionStates[m.id] = 'locked';
    }
  }
  if (!STORY_CHAPTERS_BY_ID[s.currentChapterId]) {
    s.currentChapterId = INITIAL_CHAPTER_ID;
  }
  if (!STORY_SCENARIOS[s.currentScenarioId]) {
    s.currentScenarioId = INITIAL_SCENARIO_ID;
  }
  pushUnique(s.unlockedScenarioIds, INITIAL_SCENARIO_ID);
  pushUnique(s.visitedScenarioIds, s.currentScenarioId);
  return s;
}

export function getQuestMetricFromState(state: GameState, metric: QuestMetric): number {
  switch (metric) {
    case 'oreMined':
      return state.stats?.oreMined ?? 0;
    case 'wins':
      return state.stats?.wins ?? 0;
    case 'biomesFound':
      return Array.isArray(state.discoveries) ? state.discoveries.length : 0;
    case 'torchesPlaced':
      return state.stats?.torchesPlaced ?? 0;
    case 'structuresBuilt':
      return state.stats?.structuresBuilt ?? 0;
    case 'chestsOpened':
      return state.stats?.chestsOpened ?? 0;
    case 'speciesCaptured':
      return state.capturedSpecies ? Object.keys(state.capturedSpecies).length : 0;
    case 'eggsHatched':
      return state.stats?.eggsHatched ?? 0;
    case 'shelterTier':
      return state.shelterTier ?? 1;
    case 'bossesDefeated':
      return Array.isArray(state.defeatedBosses) ? state.defeatedBosses.length : 0;
    case 'megaUnlocked':
      return state.stats?.megaUnlocked ?? 0;
    case 'challengesCleared':
      return state.clearedChallenges?.length ?? 0;
    case 'dialoguesDone':
      return state.completedDialogues?.length ?? 0;
    case 'tournamentsWon':
      return state.clearedTournaments?.length ?? 0;
    case 'racesWon':
      return Object.values(state.raceRecords || {}).filter((r) => r.cleared).length;
    default:
      return 0;
  }
}

function getAllPlayerSlugsMaxBond(state: GameState): number {
  let maxBond = 0;
  for (const s of state.party || []) {
    if ((s.bond || 0) > maxBond) maxBond = s.bond || 0;
  }
  for (const s of state.storage || []) {
    if ((s.bond || 0) > maxBond) maxBond = s.bond || 0;
  }
  for (const r of state.home?.residents || []) {
    if ((r.slug?.bond || 0) > maxBond) maxBond = r.slug.bond || 0;
  }
  return maxBond;
}

export function evaluateRequirement(
  state: GameState,
  req: StoryRequirement | undefined
): { met: boolean; unmetReasons: string[] } {
  if (!req) return { met: true, unmetReasons: [] };
  const story = ensureStoryState(state);
  const unmetReasons: string[] = [];

  if (req.requiredChaptersCompleted) {
    for (const chId of req.requiredChaptersCompleted) {
      if (story.chapterStates[chId] !== 'completed') {
        const ch = STORY_CHAPTERS_BY_ID[chId];
        unmetReasons.push(`Completa ${ch ? ch.title : chId}`);
      }
    }
  }

  if (req.requiredMissionsCompleted) {
    for (const mId of req.requiredMissionsCompleted) {
      if (story.missionStates[mId] !== 'completed') {
        const m = STORY_MISSIONS_BY_ID[mId];
        unmetReasons.push(`Completa la misión "${m ? m.title : mId}"`);
      }
    }
  }

  if (req.requiredFlags) {
    for (const flag of req.requiredFlags) {
      if (!story.storyFlags[flag]) {
        unmetReasons.push(`Hito pendiente: ${flag}`);
      }
    }
  }

  if (req.requiredBossesDefeated) {
    for (const bossId of req.requiredBossesDefeated) {
      if (!state.defeatedBosses?.includes(bossId)) {
        unmetReasons.push(`Derrota al jefe ${bossId}`);
      }
    }
  }

  if (req.requiredDiscoveredBiomes) {
    for (const biome of req.requiredDiscoveredBiomes) {
      if (!state.discoveries?.includes(biome)) {
        unmetReasons.push(`Descubre el bioma ${biome}`);
      }
    }
  }

  if (req.requiredClearedChallenges) {
    for (const challengeId of req.requiredClearedChallenges) {
      if (!state.clearedChallenges?.includes(challengeId)) {
        unmetReasons.push(`Supera el desafío ${challengeId}`);
      }
    }
  }

  if (req.requiredMetrics) {
    for (const mReq of req.requiredMetrics) {
      const val = getQuestMetricFromState(state, mReq.metric);
      if (val < mReq.goal) {
        unmetReasons.push(`${mReq.label}: ${val}/${mReq.goal}`);
      }
    }
  }

  if (typeof req.requiredShelterTier === 'number' && state.shelterTier < req.requiredShelterTier) {
    unmetReasons.push(`Refugio Nivel ${req.requiredShelterTier}`);
  }

  if (typeof req.requiredHomeResidents === 'number') {
    const count = state.home?.residents?.length ?? 0;
    if (count < req.requiredHomeResidents) {
      unmetReasons.push(`Residentes en el hogar: ${count}/${req.requiredHomeResidents}`);
    }
  }

  if (typeof req.requiredMaxSlugBond === 'number') {
    const maxBond = getAllPlayerSlugsMaxBond(state);
    if (maxBond < req.requiredMaxSlugBond) {
      unmetReasons.push(`Amistad máxima: ${maxBond}/${req.requiredMaxSlugBond}`);
    }
  }

  return {
    met: unmetReasons.length === 0,
    unmetReasons,
  };
}

function evaluateObjective(
  state: GameState,
  obj: StoryObjectiveDef
): { complete: boolean; current: number; goal: number; text: string } {
  const story = ensureStoryState(state);

  if (obj.metric && typeof obj.goal === 'number') {
    const cur = getQuestMetricFromState(state, obj.metric);
    const shown = Math.min(cur, obj.goal);
    return {
      complete: cur >= obj.goal,
      current: shown,
      goal: obj.goal,
      text: `${obj.label}: ${shown}/${obj.goal}`,
    };
  }

  if (obj.requiredFlag) {
    const ok = Boolean(story.storyFlags[obj.requiredFlag]);
    return {
      complete: ok,
      current: ok ? 1 : 0,
      goal: 1,
      text: `${obj.label}: ${ok ? '1/1' : '0/1'}`,
    };
  }

  if (obj.requiredBossId) {
    const ok = Boolean(state.defeatedBosses?.includes(obj.requiredBossId));
    return {
      complete: ok,
      current: ok ? 1 : 0,
      goal: 1,
      text: `${obj.label}: ${ok ? '1/1' : '0/1'}`,
    };
  }

  if (obj.requiredBiome) {
    const ok = Boolean(state.discoveries?.includes(obj.requiredBiome));
    return {
      complete: ok,
      current: ok ? 1 : 0,
      goal: 1,
      text: `${obj.label}: ${ok ? '1/1' : '0/1'}`,
    };
  }

  if (obj.requiredScenarioId) {
    const ok = story.visitedScenarioIds.includes(obj.requiredScenarioId);
    return {
      complete: ok,
      current: ok ? 1 : 0,
      goal: 1,
      text: `${obj.label}: ${ok ? '1/1' : '0/1'}`,
    };
  }

  if (obj.requiredRouteId) {
    const ok = story.unlockedRouteIds.includes(obj.requiredRouteId);
    return {
      complete: ok,
      current: ok ? 1 : 0,
      goal: 1,
      text: `${obj.label}: ${ok ? '1/1' : '0/1'}`,
    };
  }

  if (typeof obj.requiredHomeResidents === 'number') {
    const cur = state.home?.residents?.length ?? 0;
    const shown = Math.min(cur, obj.requiredHomeResidents);
    return {
      complete: cur >= obj.requiredHomeResidents,
      current: shown,
      goal: obj.requiredHomeResidents,
      text: `${obj.label}: ${shown}/${obj.requiredHomeResidents}`,
    };
  }

  if (typeof obj.requiredMaxSlugBond === 'number') {
    const cur = getAllPlayerSlugsMaxBond(state);
    const shown = Math.min(cur, obj.requiredMaxSlugBond);
    return {
      complete: cur >= obj.requiredMaxSlugBond,
      current: shown,
      goal: obj.requiredMaxSlugBond,
      text: `${obj.label}: ${shown}/${obj.requiredMaxSlugBond}`,
    };
  }

  return { complete: true, current: 1, goal: 1, text: obj.label };
}

export function getMissionProgressSummary(
  state: GameState,
  mission: StoryMissionDef
): { complete: boolean; text: string } {
  const parts = mission.objectives.map((obj) => evaluateObjective(state, obj));
  return {
    complete: parts.every((p) => p.complete),
    text: parts.map((p) => p.text).join(' · '),
  };
}

function grantStoryRewards(
  state: GameState,
  reward: StoryRewardDef,
  claimRegistry: string[],
  claimKey: string,
  opts?: { skipInventoryAndXp?: boolean }
): { xpGained: number; newlyUnlockedRoutes: string[]; newlyUnlockedScenarios: string[] } {
  const story = ensureStoryState(state);
  const newlyUnlockedRoutes: string[] = [];
  const newlyUnlockedScenarios: string[] = [];
  let xpGained = 0;

  if (claimRegistry.includes(claimKey)) {
    return { xpGained: 0, newlyUnlockedRoutes, newlyUnlockedScenarios };
  }
  claimRegistry.push(claimKey);

  if (!opts?.skipInventoryAndXp) {
    if (reward.items) {
      for (const [k, rawAmt] of Object.entries(reward.items)) {
        const amt = typeof rawAmt === 'number' && Number.isFinite(rawAmt) ? rawAmt : 0;
        if (amt > 0 && k in state.inventory) {
          const invKey = k as InventoryKey;
          state.inventory[invKey] = (state.inventory[invKey] || 0) + amt;
        }
      }
    }
    if (typeof reward.cavernTokens === 'number' && reward.cavernTokens > 0) {
      state.cavernTokens = (state.cavernTokens || 0) + reward.cavernTokens;
    }
    if (reward.perk && !state.player.perks.includes(reward.perk)) {
      state.player.perks.push(reward.perk);
    }
    if (typeof reward.xp === 'number' && reward.xp > 0) {
      xpGained = reward.xp;
    }
  }

  if (reward.unlockMecha) {
    if (!state.mecha) {
      state.mecha = {
        unlocked: true,
        active: false,
        name: 'Meca Shane M1',
        tier: 1,
        theme: 'shane_blue',
        unlockedThemes: ['shane_blue'],
        upgrades: ['chasis_m1'],
      };
    } else {
      state.mecha.unlocked = true;
    }
  }

  if (reward.unlockJournalIds) {
    if (!Array.isArray(state.journalEntries)) state.journalEntries = [];
    for (const jId of reward.unlockJournalIds) {
      pushUnique(state.journalEntries, jId);
    }
  }

  if (reward.unlockFlags) {
    for (const flag of reward.unlockFlags) {
      story.storyFlags[flag] = true;
    }
  }
  if (reward.unlockScenarioIds) {
    for (const scId of reward.unlockScenarioIds) {
      if (STORY_SCENARIOS[scId] && pushUnique(story.unlockedScenarioIds, scId)) {
        newlyUnlockedScenarios.push(scId);
      }
    }
  }
  if (reward.unlockRouteIds) {
    for (const rId of reward.unlockRouteIds) {
      const route = STORY_ROUTES[rId];
      if (route && pushUnique(story.unlockedRouteIds, rId)) {
        newlyUnlockedRoutes.push(rId);
        if (STORY_SCENARIOS[route.toScenarioId] && pushUnique(story.unlockedScenarioIds, route.toScenarioId)) {
          newlyUnlockedScenarios.push(route.toScenarioId);
        }
      }
    }
  }
  if (reward.unlockMissionIds) {
    for (const mId of reward.unlockMissionIds) {
      if (story.missionStates[mId] === 'locked') {
        story.missionStates[mId] = 'available';
      }
    }
  }

  return { xpGained, newlyUnlockedRoutes, newlyUnlockedScenarios };
}

export interface ReconcileStoryResult {
  newlyCompletedChapterIds: string[];
  newlyActivatedChapterIds: string[];
  newlyUnlockedRouteIds: string[];
  xpGained: number;
}

export function reconcileStoryProgress(
  state: GameState,
  opts?: { skipRewards?: boolean }
): ReconcileStoryResult {
  const story = ensureStoryState(state);
  const newlyCompletedChapterIds: string[] = [];
  const newlyActivatedChapterIds: string[] = [];
  const newlyUnlockedRouteIds: string[] = [];
  let xpGained = 0;

  let allPreviousCompleted = true;

  for (const ch of SORTED_CHAPTERS) {
    const curStatus = story.chapterStates[ch.id] || 'locked';

    if (!allPreviousCompleted) {
      // Strictly preserve linear chapter ordering: cannot activate or complete out of sequence
      if (curStatus !== 'locked') {
        story.chapterStates[ch.id] = 'locked';
      }
      for (const mId of ch.missionIds) {
        if (story.missionStates[mId] !== 'completed') {
          story.missionStates[mId] = 'locked';
        }
      }
      continue;
    }

    if (curStatus === 'locked') {
      story.chapterStates[ch.id] = 'active';
      story.currentChapterId = ch.id;
      pushUnique(story.unlockedScenarioIds, ch.entryScenarioId);
      newlyActivatedChapterIds.push(ch.id);
    }

    // Unlock missions inside active/completed chapters once prerequisites hold
    for (const mId of ch.missionIds) {
      const m = STORY_MISSIONS_BY_ID[mId];
      if (!m) continue;
      if (m.legacyQuestId && state.claimedQuests?.includes(m.legacyQuestId)) {
        story.missionStates[m.id] = 'completed';
        if (!story.claimedMissionRewards.includes(m.id)) {
          story.claimedMissionRewards.push(m.id);
        }
        if (m.onCompleteFlags) {
          for (const f of m.onCompleteFlags) story.storyFlags[f] = true;
        }
        if (m.onCompleteEvents) {
          for (const ev of m.onCompleteEvents) pushUnique(story.completedEvents, ev);
        }
        continue;
      }

      const mState = story.missionStates[m.id] || 'locked';
      if (mState === 'locked') {
        const prereq = evaluateRequirement(state, m.prerequisites);
        if (prereq.met) {
          story.missionStates[m.id] = !m.optional && m.category === 'principal' ? 'active' : 'available';
        }
      }
    }

    // Evaluate routes assigned to this chapter
    for (const route of Object.values(STORY_ROUTES)) {
      if (route.chapterId === ch.id) {
        const routeCheck = evaluateRequirement(state, route.unlockRequirements);
        if (routeCheck.met && pushUnique(story.unlockedRouteIds, route.id)) {
          newlyUnlockedRouteIds.push(route.id);
          pushUnique(story.unlockedScenarioIds, route.toScenarioId);
        } else if (story.unlockedRouteIds.includes(route.id)) {
          pushUnique(story.unlockedScenarioIds, route.toScenarioId);
        }
      }
    }

    if (story.chapterStates[ch.id] === 'completed') {
      allPreviousCompleted = true;
      continue;
    }

    // Check if active chapter is now complete
    const condCheck = evaluateRequirement(state, ch.completionConditions);
    const blockingMissionsComplete = ch.missionIds.every((mId) => {
      const m = STORY_MISSIONS_BY_ID[mId];
      if (!m || !m.blocksChapterCompletion) return true;
      return story.missionStates[mId] === 'completed';
    });

    if (condCheck.met && blockingMissionsComplete) {
      story.chapterStates[ch.id] = 'completed';
      newlyCompletedChapterIds.push(ch.id);
      for (const ev of ch.narrativeEvents) {
        pushUnique(story.completedEvents, ev);
      }

      const grantRes = grantStoryRewards(state, ch.rewards, story.claimedChapterRewards, ch.id, {
        skipInventoryAndXp: opts?.skipRewards,
      });
      xpGained += grantRes.xpGained;
      for (const rId of grantRes.newlyUnlockedRoutes) {
        pushUnique(newlyUnlockedRouteIds, rId);
      }

      if (ch.nextChapterId && STORY_CHAPTERS_BY_ID[ch.nextChapterId]) {
        const nextCh = STORY_CHAPTERS_BY_ID[ch.nextChapterId];
        if (story.chapterStates[nextCh.id] === 'locked') {
          story.chapterStates[nextCh.id] = 'active';
          newlyActivatedChapterIds.push(nextCh.id);
        }
        story.currentChapterId = nextCh.id;
        pushUnique(story.unlockedScenarioIds, nextCh.entryScenarioId);
      }
      allPreviousCompleted = true;
    } else {
      story.currentChapterId = ch.id;
      allPreviousCompleted = false;
    }
  }

  // Ensure currentChapterId never points to a completed chapter when an active one exists
  const activeChapter = SORTED_CHAPTERS.find((c) => story.chapterStates[c.id] === 'active');
  if (activeChapter) {
    story.currentChapterId = activeChapter.id;
  } else {
    const lastChapter = SORTED_CHAPTERS[SORTED_CHAPTERS.length - 1];
    story.currentChapterId = lastChapter.id;
  }

  // Always keep current scenario reachable if unlocked
  if (!story.unlockedScenarioIds.includes(story.currentScenarioId)) {
    story.currentScenarioId = INITIAL_SCENARIO_ID;
  }

  return {
    newlyCompletedChapterIds,
    newlyActivatedChapterIds,
    newlyUnlockedRouteIds,
    xpGained,
  };
}

export function activateMission(state: GameState, missionId: string): boolean {
  const story = ensureStoryState(state);
  const m = STORY_MISSIONS_BY_ID[missionId];
  if (!m) return false;
  const chState = story.chapterStates[m.chapterId];
  if (chState !== 'active' && chState !== 'completed') return false;
  const cur = story.missionStates[missionId];
  if (cur !== 'available') return false;
  story.missionStates[missionId] = 'active';
  return true;
}

export interface ClaimMissionResult {
  ok: boolean;
  message: string;
  xpGained: number;
  unlockedRoutes: string[];
  completedChapterId?: string;
  unlockedChapterId?: string;
}

export function claimStoryMission(state: GameState, missionId: string): ClaimMissionResult {
  const story = ensureStoryState(state);
  const m = STORY_MISSIONS_BY_ID[missionId];
  if (!m) {
    return { ok: false, message: 'Misión de historia no encontrada.', xpGained: 0, unlockedRoutes: [] };
  }

  const chState = story.chapterStates[m.chapterId];
  if (chState !== 'active' && chState !== 'completed') {
    return {
      ok: false,
      message: 'Esta misión pertenece a un capítulo todavía bloqueado.',
      xpGained: 0,
      unlockedRoutes: [],
    };
  }

  const mState = story.missionStates[m.id];
  if (mState === 'completed' || story.claimedMissionRewards.includes(m.id)) {
    return { ok: false, message: 'Esta misión ya fue reclamada.', xpGained: 0, unlockedRoutes: [] };
  }
  if (mState === 'locked') {
    const prereq = evaluateRequirement(state, m.prerequisites);
    if (!prereq.met) {
      return {
        ok: false,
        message: `Misión bloqueada: ${prereq.unmetReasons[0] || 'requisitos pendientes'}.`,
        xpGained: 0,
        unlockedRoutes: [],
      };
    }
    story.missionStates[m.id] = 'available';
  }

  const progress = getMissionProgressSummary(state, m);
  if (!progress.complete) {
    return {
      ok: false,
      message: `Objetivos incompletos (${progress.text}).`,
      xpGained: 0,
      unlockedRoutes: [],
    };
  }

  story.missionStates[m.id] = 'completed';
  if (m.legacyQuestId && !state.claimedQuests.includes(m.legacyQuestId)) {
    state.claimedQuests.push(m.legacyQuestId);
  }
  if (m.onCompleteFlags) {
    for (const f of m.onCompleteFlags) {
      story.storyFlags[f] = true;
    }
  }
  if (m.onCompleteEvents) {
    for (const ev of m.onCompleteEvents) {
      pushUnique(story.completedEvents, ev);
    }
  }

  const grantRes = grantStoryRewards(state, m.rewards, story.claimedMissionRewards, m.id);
  const reconcileRes = reconcileStoryProgress(state);

  const unlockedRoutes = Array.from(
    new Set([...grantRes.newlyUnlockedRoutes, ...reconcileRes.newlyUnlockedRouteIds])
  );

  return {
    ok: true,
    message: `Misión completada: ${m.title}`,
    xpGained: grantRes.xpGained + reconcileRes.xpGained,
    unlockedRoutes,
    completedChapterId: reconcileRes.newlyCompletedChapterIds[0],
    unlockedChapterId: reconcileRes.newlyActivatedChapterIds[0],
  };
}

export function canAccessRoute(
  state: GameState,
  routeId: string
): { allowed: boolean; unlocked: boolean; reason: string } {
  const story = ensureStoryState(state);
  const route = STORY_ROUTES[routeId];
  if (!route) {
    return { allowed: false, unlocked: false, reason: 'Ruta inexistente.' };
  }

  const chStatus = story.chapterStates[route.chapterId];
  if (chStatus !== 'active' && chStatus !== 'completed') {
    return { allowed: false, unlocked: false, reason: route.lockedReason };
  }

  const reqRes = evaluateRequirement(state, route.unlockRequirements);
  if (!reqRes.met && !story.unlockedRouteIds.includes(route.id)) {
    return {
      allowed: false,
      unlocked: false,
      reason: route.lockedReason || reqRes.unmetReasons[0] || 'Ruta bloqueada.',
    };
  }

  return { allowed: true, unlocked: true, reason: 'Ruta abierta.' };
}

function saveCurrentScenarioPosition(state: GameState, scenarioId: string): void {
  const story = ensureStoryState(state);
  if (!story.scenarioPositions) story.scenarioPositions = {};
  const sc = STORY_SCENARIOS[scenarioId];
  if (!sc) return;
  const dist = Math.hypot(state.player.x - sc.worldAnchor.x, state.player.y - sc.worldAnchor.y);
  if (dist <= 22) {
    story.scenarioPositions[scenarioId] = {
      x: Math.round(state.player.x * 100) / 100,
      y: Math.round(state.player.y * 100) / 100,
    };
  }
}

function getScenarioArrivalPoint(state: GameState, targetScenarioId: string): { x: number; y: number } {
  const target = STORY_SCENARIOS[targetScenarioId];
  if (!target) {
    return { x: state.player.x, y: state.player.y };
  }
  const saved = state.story?.scenarioPositions?.[targetScenarioId];
  if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
    const dist = Math.hypot(saved.x - target.worldAnchor.x, saved.y - target.worldAnchor.y);
    if (dist <= 20) {
      return { x: saved.x, y: saved.y };
    }
  }
  return {
    x: target.worldAnchor.x + (target.entryOffset?.x ?? 0),
    y: target.worldAnchor.y + (target.entryOffset?.y ?? 2),
  };
}

export function travelToScenario(
  state: GameState,
  targetScenarioId: string
): { ok: boolean; message: string; scenarioName?: string; destination?: { x: number; y: number } } {
  const story = ensureStoryState(state);
  const target = STORY_SCENARIOS[targetScenarioId];
  if (!target) {
    return { ok: false, message: 'Escenario no encontrado.' };
  }
  if (targetScenarioId === story.currentScenarioId) {
    return {
      ok: true,
      message: `Ya te encuentras en ${target.name}.`,
      scenarioName: target.name,
      destination: { x: state.player.x, y: state.player.y },
    };
  }

  const prevScenarioId = story.currentScenarioId;

  const commitTransition = (msg: string): {
    ok: boolean;
    message: string;
    scenarioName: string;
    destination: { x: number; y: number };
  } => {
    saveCurrentScenarioPosition(state, prevScenarioId);
    const dest = getScenarioArrivalPoint(state, targetScenarioId);
    story.currentScenarioId = targetScenarioId;
    pushUnique(story.unlockedScenarioIds, targetScenarioId);
    pushUnique(story.visitedScenarioIds, targetScenarioId);
    state.player.x = dest.x;
    state.player.y = dest.y;
    if (!state.discoveries.includes(target.biome)) {
      state.discoveries.push(target.biome);
    }
    return { ok: true, message: msg, scenarioName: target.name, destination: dest };
  };

  // Check if there is a connected route from current scenario to target scenario
  const directRoute = Object.values(STORY_ROUTES).find(
    (r) =>
      (r.fromScenarioId === story.currentScenarioId && r.toScenarioId === targetScenarioId) ||
      (r.bidirectional && r.toScenarioId === story.currentScenarioId && r.fromScenarioId === targetScenarioId)
  );

  if (directRoute) {
    const access = canAccessRoute(state, directRoute.id);
    if (!access.allowed) {
      return { ok: false, message: access.reason };
    }
    pushUnique(story.unlockedRouteIds, directRoute.id);
    return commitTransition(`Viajaste a ${target.name}.`);
  }

  // Allow fast backtracking between previously visited & unlocked scenarios
  if (story.unlockedScenarioIds.includes(targetScenarioId) && story.visitedScenarioIds.includes(targetScenarioId)) {
    return commitTransition(`Regresaste a ${target.name}.`);
  }

  // Check if a route pointing to target exists to show its exact locked reason
  const targetRoute = Object.values(STORY_ROUTES).find((r) => r.toScenarioId === targetScenarioId);
  if (targetRoute) {
    const access = canAccessRoute(state, targetRoute.id);
    if (!access.allowed) {
      return { ok: false, message: access.reason };
    }
    if (story.unlockedScenarioIds.includes(targetScenarioId)) {
      return commitTransition(`Viajaste a ${target.name}.`);
    }
    return {
      ok: false,
      message: `Debes avanzar por las rutas conectadas para llegar a ${target.name}.`,
    };
  }

  return { ok: false, message: `No hay una ruta desbloqueada hacia ${target.name}.` };
}

export function setStoryFlag(state: GameState, flag: string, value = true): void {
  const story = ensureStoryState(state);
  story.storyFlags[flag] = value;
  reconcileStoryProgress(state);
}

export function isMegamorphNarrativelyUnlocked(
  state: Pick<GameState, 'story'>
): { unlocked: boolean; reason: string; requiredChapterTitle: string } {
  const megaChapter = STORY_CHAPTERS_BY_ID[MEGAMORPH_REQUIRED_CHAPTER_ID];
  const requiredChapterTitle = megaChapter ? megaChapter.title : 'Capítulo 5 · El Secreto Megamorph';
  const story = state?.story;
  if (!story) {
    return {
      unlocked: false,
      reason: `Hito narrativo pendiente: ${requiredChapterTitle} (Acelerador 200 MPH)`,
      requiredChapterTitle,
    };
  }
  const hasFlag = Boolean(story.storyFlags?.[MEGAMORPH_NARRATIVE_FLAG]);
  const completedChapter = story.chapterStates?.[MEGAMORPH_REQUIRED_CHAPTER_ID] === 'completed';
  if (hasFlag || completedChapter) {
    return {
      unlocked: true,
      reason: 'Acelerador Megamorph desbloqueado en la historia.',
      requiredChapterTitle,
    };
  }
  return {
    unlocked: false,
    reason: `Hito narrativo pendiente: ${requiredChapterTitle} (Acelerador 200 MPH)`,
    requiredChapterTitle,
  };
}

export function migrateLegacyProgressToStory(state: GameState): StoryProgressState {
  const story = createInitialStoryState();
  const claimed = new Set(Array.isArray(state.claimedQuests) ? state.claimedQuests : []);

  // Reconstruct sequential chapter/mission completion deterministically without duplicating rewards
  let canAdvance = true;
  for (const ch of SORTED_CHAPTERS) {
    if (!canAdvance) {
      story.chapterStates[ch.id] = 'locked';
      continue;
    }

    story.chapterStates[ch.id] = 'active';
    story.currentChapterId = ch.id;
    pushUnique(story.unlockedScenarioIds, ch.entryScenarioId);

    // Sync any missions claimed via legacy quest IDs
    for (const mId of ch.missionIds) {
      const m = STORY_MISSIONS_BY_ID[mId];
      if (!m) continue;
      if (m.legacyQuestId && claimed.has(m.legacyQuestId)) {
        story.missionStates[m.id] = 'completed';
        pushUnique(story.claimedMissionRewards, m.id);
        if (m.onCompleteFlags) {
          for (const f of m.onCompleteFlags) story.storyFlags[f] = true;
        }
        if (m.onCompleteEvents) {
          for (const ev of m.onCompleteEvents) pushUnique(story.completedEvents, ev);
        }
      } else {
        story.missionStates[m.id] = !m.optional && m.category === 'principal' ? 'active' : 'available';
      }
    }

    // Legacy V3/V4 edge cases where chapter 3 or 5 had no legacyQuestId:
    // infer completion only if downstream legacy evidence proves player already reached later chapters OR already unlocked Megamorph
    if (ch.id === 'cap_03_sombra_agua_oscura') {
      const alreadyPassedCap3 =
        claimed.has('q_main_3') ||
        claimed.has('q_main_4') ||
        (state.discoveries?.length ?? 0) >= 4 ||
        (state.defeatedBosses?.length ?? 0) >= 1;
      if (alreadyPassedCap3 && (state.stats?.wins ?? 0) >= 3) {
        story.missionStates['m_cap3_rastro_oscuro'] = 'completed';
        pushUnique(story.claimedMissionRewards, 'm_cap3_rastro_oscuro');
        story.storyFlags['agua_oscura_investigada'] = true;
      }
    }

    if (ch.id === 'cap_05_acelerador_megamorph') {
      const alreadyHasMega = (state.stats?.megaUnlocked ?? 0) >= 1 || claimed.has('q_side_5') || claimed.has('q_main_4');
      if (alreadyHasMega && (state.defeatedBosses?.length ?? 0) >= 1) {
        story.missionStates['m_cap5_acelerador'] = 'completed';
        pushUnique(story.claimedMissionRewards, 'm_cap5_acelerador');
        story.storyFlags[MEGAMORPH_NARRATIVE_FLAG] = true;
      }
    }

    const blockingDone = ch.missionIds.every((mId) => {
      const m = STORY_MISSIONS_BY_ID[mId];
      return !m || !m.blocksChapterCompletion || story.missionStates[mId] === 'completed';
    });

    if (blockingDone) {
      story.chapterStates[ch.id] = 'completed';
      pushUnique(story.claimedChapterRewards, ch.id);
      for (const ev of ch.narrativeEvents) {
        pushUnique(story.completedEvents, ev);
      }
      if (ch.rewards.unlockFlags) {
        for (const f of ch.rewards.unlockFlags) story.storyFlags[f] = true;
      }
      if (ch.rewards.unlockMecha && state.mecha) {
        state.mecha.unlocked = true;
      }
      if (ch.rewards.unlockScenarioIds) {
        for (const sc of ch.rewards.unlockScenarioIds) pushUnique(story.unlockedScenarioIds, sc);
      }
      if (ch.rewards.unlockRouteIds) {
        for (const rId of ch.rewards.unlockRouteIds) pushUnique(story.unlockedRouteIds, rId);
      }
      canAdvance = true;
    } else {
      canAdvance = false;
    }
  }

  // Unlock any routes whose chapter is active/completed and requirements hold
  const tempState: GameState = { ...state, story };
  for (const route of Object.values(STORY_ROUTES)) {
    const chSt = story.chapterStates[route.chapterId];
    if ((chSt === 'active' || chSt === 'completed') && evaluateRequirement(tempState, route.unlockRequirements).met) {
      pushUnique(story.unlockedRouteIds, route.id);
      pushUnique(story.unlockedScenarioIds, route.toScenarioId);
    }
  }

  // Run reconciliation with skipRewards so active chapter pointers & scenario access are coherent without double rewards
  reconcileStoryProgress(tempState, { skipRewards: true });
  return story;
}

export function buildStoryHudSummary(state: GameState, recentChapterAlert: string | null = null): StoryHudSummary {
  const story = ensureStoryState(state);
  const currentChapter = STORY_CHAPTERS_BY_ID[story.currentChapterId] || SORTED_CHAPTERS[0];
  const currentScenario = STORY_SCENARIOS[story.currentScenarioId] || STORY_SCENARIOS[INITIAL_SCENARIO_ID];

  const completedChaptersCount = SORTED_CHAPTERS.filter((c) => story.chapterStates[c.id] === 'completed').length;
  const chapterProgressPct = Math.round((completedChaptersCount / SORTED_CHAPTERS.length) * 100);

  // Gather active/available missions (plus recently completed ones of current chapter for context)
  const visibleMissions: StoryMissionSnapshotItem[] = [];
  for (const m of STORY_MISSIONS) {
    const chStatus = story.chapterStates[m.chapterId];
    if (chStatus !== 'active' && chStatus !== 'completed') continue;
    const mState = story.missionStates[m.id] || 'locked';
    if (mState === 'locked') continue;
    if (mState === 'completed' && m.chapterId !== currentChapter.id) continue;

    const prog = getMissionProgressSummary(state, m);
    visibleMissions.push({
      id: m.id,
      legacyQuestId: m.legacyQuestId,
      title: m.title,
      description: m.description,
      category: m.category,
      chapterId: m.chapterId,
      state: mState,
      optional: m.optional,
      progressText: prog.text,
      readyToClaim: mState !== 'completed' && prog.complete,
      rewardText: m.rewards.summaryText,
    });
  }

  const availableMissionsCount = visibleMissions.filter((m) => m.readyToClaim).length;
  const primaryActive =
    visibleMissions.find((m) => m.category === 'principal' && m.state !== 'completed') ||
    visibleMissions.find((m) => m.state !== 'completed') ||
    null;

  const mainObjectiveText = primaryActive
    ? `${primaryActive.title} (${primaryActive.progressText})`
    : currentChapter.completionConditions.description || currentChapter.subtitle;

  const connectedRoutes: StoryRouteSnapshotItem[] = [];
  for (const rId of currentScenario.connectedRouteIds) {
    const r = STORY_ROUTES[rId];
    if (!r) continue;
    const destId = r.fromScenarioId === currentScenario.id ? r.toScenarioId : r.fromScenarioId;
    const dest = STORY_SCENARIOS[destId];
    if (!dest) continue;
    const access = canAccessRoute(state, r.id);
    connectedRoutes.push({
      id: r.id,
      name: r.name,
      fromScenarioId: currentScenario.id,
      toScenarioId: destId,
      toScenarioName: dest.name,
      unlocked: access.allowed,
      visitedDestination: story.visitedScenarioIds.includes(destId),
      lockedReason: access.reason,
    });
  }

  // Pick forward route or first locked route as nextRoute indicator
  const forwardCandidate =
    connectedRoutes.find((r) => !r.visitedDestination) ||
    connectedRoutes.find((r) => r.unlocked) ||
    connectedRoutes[0] ||
    null;

  const postGameUnlocked =
    story.chapterStates['cap_06_ciudadela_blakk'] === 'completed' ||
    Boolean(story.storyFlags['postgame_unlocked']);

  return {
    currentChapterId: currentChapter.id,
    currentChapterOrder: currentChapter.order,
    totalChapters: SORTED_CHAPTERS.length,
    currentChapterTitle: currentChapter.title,
    currentChapterSubtitle: currentChapter.subtitle,
    currentScenarioId: currentScenario.id,
    currentScenarioName: currentScenario.name,
    mainObjectiveText,
    chapterProgressPct,
    completedChaptersCount,
    postGameUnlocked,
    activeMissions: visibleMissions,
    availableMissionsCount,
    nextRoute: forwardCandidate,
    unlockedRoutes: connectedRoutes,
    megamorphGate: isMegamorphNarrativelyUnlocked(state),
    recentChapterAlert,
  };
}
