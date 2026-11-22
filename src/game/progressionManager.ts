import {
  ADVENTURE_JOURNAL_ENTRIES,
  STORY_CHAPTERS,
  STORY_CHAPTERS_BY_ID,
  STORY_DIALOGUES,
  STORY_MISSIONS,
  STORY_MISSIONS_BY_ID,
} from './storyData';
import {
  activateMission as activateStoryMissionInternal,
  claimStoryMission,
  ensureStoryState,
  evaluateRequirement,
  getMissionProgressSummary,
  isMegamorphNarrativelyUnlocked,
  reconcileStoryProgress,
  setStoryFlag,
  travelToScenario,
} from './storyEngine';
import type {
  AdventureJournalEntry,
  DialogueNode,
  StoryChapterDef,
  StoryCondition,
  StoryMissionDef,
} from './storyTypes';
import type { GameState, InventoryKey } from './types';

export function canUnlockChapter(state: GameState, chapterId: string): boolean {
  const story = ensureStoryState(state);
  const ch = STORY_CHAPTERS_BY_ID[chapterId];
  if (!ch) return false;
  if (story.chapterStates[chapterId] === 'active' || story.chapterStates[chapterId] === 'completed') {
    return true;
  }
  return ch.prerequisiteChapterIds.every((reqId) => story.chapterStates[reqId] === 'completed');
}

export function unlockAvailableChapters(state: GameState): string[] {
  const res = reconcileStoryProgress(state);
  return res.newlyActivatedChapterIds;
}

export function activateMission(state: GameState, missionId: string): boolean {
  return activateStoryMissionInternal(state, missionId);
}

export function completeMission(state: GameState, missionId: string) {
  return claimStoryMission(state, missionId);
}

export function evaluateStoryCondition(
  state: GameState,
  condition: StoryCondition | undefined
): { met: boolean; unmetReasons: string[] } {
  return evaluateRequirement(state, condition);
}

export function getActiveChapter(state: GameState): StoryChapterDef {
  const story = ensureStoryState(state);
  return STORY_CHAPTERS_BY_ID[story.currentChapterId] || STORY_CHAPTERS[0];
}

export function getAvailableMissions(state: GameState): Array<{
  mission: StoryMissionDef;
  status: string;
  progressText: string;
  readyToClaim: boolean;
}> {
  const story = ensureStoryState(state);
  return STORY_MISSIONS.filter((m) => {
    const chState = story.chapterStates[m.chapterId];
    const mState = story.missionStates[m.id];
    return (chState === 'active' || chState === 'completed') && mState && mState !== 'locked';
  }).map((mission) => {
    const prog = getMissionProgressSummary(state, mission);
    const status = story.missionStates[mission.id] || 'locked';
    return {
      mission,
      status,
      progressText: prog.text,
      readyToClaim: status !== 'completed' && prog.complete,
    };
  });
}

export function isStoryMilestoneReached(state: GameState, flagOrChapterId: string): boolean {
  const story = ensureStoryState(state);
  if (story.storyFlags[flagOrChapterId]) return true;
  return story.chapterStates[flagOrChapterId] === 'completed';
}

export function isPostGameUnlocked(state: Pick<GameState, 'story'>): boolean {
  const story = state.story;
  if (!story) return false;
  return (
    story.chapterStates?.['cap_06_ciudadela_blakk'] === 'completed' ||
    Boolean(story.storyFlags?.['postgame_unlocked'])
  );
}

export function recordJournalEntry(state: GameState, entryId: string): boolean {
  const exists = ADVENTURE_JOURNAL_ENTRIES.some((j) => j.id === entryId);
  if (!exists) return false;
  if (!Array.isArray(state.journalEntries)) state.journalEntries = [];
  if (state.journalEntries.includes(entryId)) return false;
  state.journalEntries.push(entryId);
  return true;
}

export function getUnlockedJournalEntries(state: GameState): AdventureJournalEntry[] {
  const ids = new Set(state.journalEntries || []);
  const story = ensureStoryState(state);
  // Also auto-expose entries whose chapter is completed
  for (const j of ADVENTURE_JOURNAL_ENTRIES) {
    if (j.category === 'historia' && story.chapterStates[j.chapterId] === 'completed') {
      ids.add(j.id);
    }
  }
  return ADVENTURE_JOURNAL_ENTRIES.filter((j) => ids.has(j.id));
}

export function getDialogueById(dialogueId: string): DialogueNode | undefined {
  return STORY_DIALOGUES.find((d) => d.id === dialogueId);
}

export function getAvailableDialogues(state: GameState): Array<{
  dialogue: DialogueNode;
  completed: boolean;
}> {
  const story = ensureStoryState(state);
  const doneSet = new Set(state.completedDialogues || []);
  return STORY_DIALOGUES.filter((d) => {
    const chStatus = story.chapterStates[d.chapterId];
    return chStatus === 'active' || chStatus === 'completed';
  }).map((dialogue) => ({
    dialogue,
    completed: doneSet.has(dialogue.id),
  }));
}

export function completeDialogue(
  state: GameState,
  dialogueId: string,
  choiceId?: string
): {
  ok: boolean;
  message: string;
  replyText?: string;
  tokensGained: number;
  journalAdded: string | null;
} {
  const dlg = getDialogueById(dialogueId);
  if (!dlg) {
    return { ok: false, message: 'Diálogo no encontrado.', tokensGained: 0, journalAdded: null };
  }
  const story = ensureStoryState(state);
  const chStatus = story.chapterStates[dlg.chapterId];
  if (chStatus !== 'active' && chStatus !== 'completed') {
    return { ok: false, message: 'Este diálogo pertenece a un capítulo bloqueado.', tokensGained: 0, journalAdded: null };
  }

  if (!Array.isArray(state.completedDialogues)) state.completedDialogues = [];
  const alreadyCompleted = state.completedDialogues.includes(dialogueId);
  const choice = choiceId ? dlg.choices?.find((c) => c.id === choiceId) : undefined;

  let tokensGained = 0;
  let journalAdded: string | null = null;

  if (!alreadyCompleted) {
    state.completedDialogues.push(dialogueId);
    tokensGained += dlg.rewardTokens || 0;
    if (dlg.rewardItems) {
      for (const [k, rawAmt] of Object.entries(dlg.rewardItems)) {
        const amt = typeof rawAmt === 'number' && rawAmt > 0 ? rawAmt : 0;
        if (amt > 0 && k in state.inventory) {
          state.inventory[k as InventoryKey] = (state.inventory[k as InventoryKey] || 0) + amt;
        }
      }
    }
    if (choice) {
      tokensGained += choice.giftTokens || 0;
      if (choice.giftItems) {
        for (const [k, rawAmt] of Object.entries(choice.giftItems)) {
          const amt = typeof rawAmt === 'number' && rawAmt > 0 ? rawAmt : 0;
          if (amt > 0 && k in state.inventory) {
            state.inventory[k as InventoryKey] = (state.inventory[k as InventoryKey] || 0) + amt;
          }
        }
      }
      if (choice.unlockFlag) {
        setStoryFlag(state, choice.unlockFlag, true);
      }
    }
    if (tokensGained > 0) {
      state.cavernTokens = (state.cavernTokens || 0) + tokensGained;
    }
    if (dlg.onCompleteFlag) {
      setStoryFlag(state, dlg.onCompleteFlag, true);
    }
    if (dlg.onCompleteJournalId && recordJournalEntry(state, dlg.onCompleteJournalId)) {
      journalAdded = dlg.onCompleteJournalId;
    }
  } else {
    if (dlg.onCompleteJournalId && recordJournalEntry(state, dlg.onCompleteJournalId)) {
      journalAdded = dlg.onCompleteJournalId;
    }
  }

  return {
    ok: true,
    message: alreadyCompleted
      ? `Conversación repasada: ${dlg.title}.`
      : `Conversación completada${tokensGained > 0 ? ` (+${tokensGained} Fichas)` : ''}.`,
    replyText: choice?.replyText,
    tokensGained,
    journalAdded,
  };
}

export {
  STORY_CHAPTERS,
  STORY_CHAPTERS_BY_ID,
  STORY_MISSIONS,
  STORY_MISSIONS_BY_ID,
  isMegamorphNarrativelyUnlocked,
  reconcileStoryProgress,
  travelToScenario,
};
