/**
 * Sequencer core: pattern data (tracks × 16 steps), step grid state, patches A–J, prob/tie logic.
 */

export type { PatchBank, PatchId, Pattern, Step } from './types.ts';
export { PATCH_IDS, STEP_COUNT } from './types.ts';

export type { TrackDefinition, TrackId } from './tracks.ts';
export { isTrackId, TRACK_DEFINITIONS } from './tracks.ts';

export {
  applyDefaultPatternSteps,
  createDefaultPatchBank,
  createDefaultPattern,
  createEmptyPattern,
  createEmptyStep,
  createEmptySteps,
  getPatternForPatch,
} from './pattern.ts';

export {
  copyPatternInto,
  patchHasContent,
  patternHasContent,
} from './patches.ts';

export type { Chain, ChainSlot } from './chain.ts';
export {
  addChainSlot,
  applyChainState,
  createDefaultChain,
  DEFAULT_CHAIN_REPEATS,
  getChain,
  getChainStartPatchId,
  getChainState,
  initChain,
  isChainEnabled,
  MAX_CHAIN_REPEATS,
  MIN_CHAIN_REPEATS,
  moveChainSlot,
  removeChainSlot,
  setChainEnabled,
  setSlotPatch,
  setSlotRepeats,
} from './chain.ts';

export type { ProjectSnapshot } from './projectSnapshot.ts';
export {
  buildProjectSnapshot,
  PROJECT_SCHEMA_VERSION,
} from './projectSnapshot.ts';

export {
  getActivePatchId,
  getPatchBank,
  setActivePatchId,
} from './stateAccess.ts';

import { scheduleAutoSave } from '../storage/autosave.ts';
import { initChain } from './chain.ts';
import { copyPatternInto, patchHasContent } from './patches.ts';
import { getPatternForPatch } from './pattern.ts';
import type { PatchId, Pattern } from './types.ts';
import { STEP_COUNT } from './types.ts';
import { TRACK_DEFINITIONS, type TrackId } from './tracks.ts';
import {
  getActivePatchId,
  patchBank,
  resetSequencerState,
  setActivePatchId,
} from './stateAccess.ts';
import { initMixState } from '../audio/mixState.ts';

export const initSequencer = (): void => {
  resetSequencerState();
  initChain();
  initMixState();
};

export const isPatchFilled = (patchId: PatchId): boolean =>
  patchHasContent(patchBank, patchId);

export const copyActivePatchTo = (targetPatchId: PatchId): void => {
  copyPatternInto(patchBank, getActivePatchId(), targetPatchId);
  scheduleAutoSave();
};

export const getActivePattern = (): Pattern =>
  getPatternForPatch(patchBank, getActivePatchId());

export const toggleStepOn = (trackId: TrackId, stepIndex: number): void => {
  if (stepIndex < 0 || stepIndex >= STEP_COUNT) {
    return;
  }
  const step = getActivePattern()[trackId][stepIndex];
  step.on = !step.on;
  if (!step.on) {
    step.prob = false;
    step.tie = false;
  }
  scheduleAutoSave();
};

export const selectActivePatch = (patchId: PatchId): void => {
  setActivePatchId(patchId);
  scheduleAutoSave();
};

export const getTrackDefinitions = (): readonly (typeof TRACK_DEFINITIONS)[number][] =>
  TRACK_DEFINITIONS;
