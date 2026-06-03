import { createDefaultPatchBank } from './pattern.ts';
import type { PatchBank, PatchId } from './types.ts';

export let patchBank: PatchBank = createDefaultPatchBank();
export let activePatchId: PatchId = 'A';

export const getPatchBank = (): PatchBank => patchBank;

export const getActivePatchId = (): PatchId => activePatchId;

export const setActivePatchId = (patchId: PatchId): void => {
  activePatchId = patchId;
};

export const replacePatchBank = (bank: PatchBank): void => {
  patchBank = bank;
};

export const resetSequencerState = (): void => {
  patchBank = createDefaultPatchBank();
  activePatchId = 'A';
};
