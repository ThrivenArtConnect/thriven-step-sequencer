import { getPatternForPatch } from './pattern.ts';
import type { PatchBank, PatchId, Pattern, Step } from './types.ts';
import { STEP_COUNT } from './types.ts';
import { TRACK_DEFINITIONS } from './tracks.ts';

const stepHasContent = (step: Step): boolean => step.on || step.prob || step.tie;

export const patternHasContent = (pattern: Pattern): boolean => {
  for (const { id } of TRACK_DEFINITIONS) {
    for (const step of pattern[id]) {
      if (stepHasContent(step)) {
        return true;
      }
    }
  }
  return false;
};

export const patchHasContent = (bank: PatchBank, patchId: PatchId): boolean =>
  patternHasContent(getPatternForPatch(bank, patchId));

const copyStep = (target: Step, source: Step): void => {
  target.on = source.on;
  target.prob = source.prob;
  target.tie = source.tie;
};

/** Deep-copies all track rows from one patch slot into another (same object refs in bank). */
export const copyPatternInto = (
  bank: PatchBank,
  fromPatchId: PatchId,
  toPatchId: PatchId,
): void => {
  const source = getPatternForPatch(bank, fromPatchId);
  const target = getPatternForPatch(bank, toPatchId);

  for (const { id } of TRACK_DEFINITIONS) {
    for (let stepIndex = 0; stepIndex < STEP_COUNT; stepIndex += 1) {
      copyStep(target[id][stepIndex], source[id][stepIndex]);
    }
  }
};
