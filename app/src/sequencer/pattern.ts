import {
  STEP_COUNT,
  type PatchBank,
  type PatchId,
  PATCH_IDS,
  type Pattern,
  type Step,
} from './types.ts';
import { TRACK_DEFINITIONS, type TrackId } from './tracks.ts';

export const createEmptyStep = (): Step => ({
  on: false,
  prob: false,
  tie: false,
});

export const createEmptySteps = (): Step[] =>
  Array.from({ length: STEP_COUNT }, createEmptyStep);

/** Builds a pattern row for every track in the catalog (including newly added tracks). */
export const createEmptyPattern = (): Pattern => {
  const pattern = {} as Pattern;
  for (const { id } of TRACK_DEFINITIONS) {
    pattern[id] = createEmptySteps();
  }
  return pattern;
};

const ALL_STEP_INDICES: readonly number[] = Array.from(
  { length: STEP_COUNT },
  (_, index) => index,
);

const setStepsOn = (
  pattern: Pattern,
  trackId: TrackId,
  stepIndices: readonly number[],
  flags: Partial<Pick<Step, 'on' | 'prob' | 'tie'>> = { on: true },
): void => {
  const row = pattern[trackId];
  for (const index of stepIndices) {
    if (index < 0 || index >= STEP_COUNT) {
      continue;
    }
    const cell = row[index];
    if (flags.on !== undefined) {
      cell.on = flags.on;
    }
    if (flags.prob !== undefined) {
      cell.prob = flags.prob;
    }
    if (flags.tie !== undefined) {
      cell.tie = flags.tie;
    }
  }
};

/** Tekk-style starter pattern; track ids — not array indices. */
export const applyDefaultPatternSteps = (pattern: Pattern): void => {
  setStepsOn(pattern, 'kick1', [0, 4, 8, 12]);
  setStepsOn(pattern, 'clap', [4, 12]);
  setStepsOn(pattern, 'snare', [4, 12]);
  setStepsOn(pattern, 'chat', ALL_STEP_INDICES);
  setStepsOn(pattern, 'ohat', [2, 6, 10, 14]);
};

export const createDefaultPattern = (): Pattern => {
  const pattern = createEmptyPattern();
  applyDefaultPatternSteps(pattern);
  return pattern;
};

export const createDefaultPatchBank = (): PatchBank => {
  const bank = {} as PatchBank;
  for (const patchId of PATCH_IDS) {
    bank[patchId] =
      patchId === 'A' ? createDefaultPattern() : createEmptyPattern();
  }
  return bank;
};

export const getPatternForPatch = (
  bank: PatchBank,
  patchId: PatchId,
): Pattern => bank[patchId];
