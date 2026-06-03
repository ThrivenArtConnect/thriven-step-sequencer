import { scheduleAutoSave } from '../storage/autosave.ts';
import type { PatchId } from './types.ts';
import { PATCH_IDS } from './types.ts';

export type ChainSlot = {
  patchId: PatchId;
  repeats: number;
};

export type Chain = ChainSlot[];

export const MIN_CHAIN_REPEATS = 1;
export const MAX_CHAIN_REPEATS = 64;
export const DEFAULT_CHAIN_REPEATS = 4;

const clampRepeats = (repeats: number): number =>
  Math.min(MAX_CHAIN_REPEATS, Math.max(MIN_CHAIN_REPEATS, Math.floor(repeats)));

const isPatchId = (value: string): value is PatchId =>
  (PATCH_IDS as readonly string[]).includes(value);

export const createDefaultChain = (): Chain => [
  { patchId: 'A', repeats: 4 },
  { patchId: 'B', repeats: 8 },
  { patchId: 'C', repeats: 2 },
  { patchId: 'D', repeats: 8 },
];

let chain: Chain = createDefaultChain();
let chainEnabled = false;

export const initChain = (): void => {
  chain = createDefaultChain();
  chainEnabled = false;
};

export const getChainState = (): { chain: Chain; chainEnabled: boolean } => ({
  chain: chain.map((slot) => ({ ...slot })),
  chainEnabled,
});

export const applyChainState = (nextChain: Chain, enabled: boolean): void => {
  chain = nextChain.map((slot) => ({
    patchId: slot.patchId,
    repeats: clampRepeats(slot.repeats),
  }));
  chainEnabled = enabled;
};

export const getChain = (): Chain => chain;

export const isChainEnabled = (): boolean => chainEnabled;

export const setChainEnabled = (enabled: boolean): void => {
  chainEnabled = enabled;
  scheduleAutoSave();
};

export const addChainSlot = (
  patchId: PatchId = 'A',
  repeats: number = DEFAULT_CHAIN_REPEATS,
): void => {
  chain.push({ patchId, repeats: clampRepeats(repeats) });
  scheduleAutoSave();
};

export const removeChainSlot = (index: number): void => {
  if (index < 0 || index >= chain.length) {
    return;
  }
  chain.splice(index, 1);
  scheduleAutoSave();
};

export const moveChainSlot = (index: number, direction: 'up' | 'down'): void => {
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || index >= chain.length || targetIndex < 0 || targetIndex >= chain.length) {
    return;
  }
  const slot = chain[index];
  chain[index] = chain[targetIndex];
  chain[targetIndex] = slot;
  scheduleAutoSave();
};

export const setSlotRepeats = (index: number, repeats: number): void => {
  if (index < 0 || index >= chain.length) {
    return;
  }
  chain[index].repeats = clampRepeats(repeats);
  scheduleAutoSave();
};

export const setSlotPatch = (index: number, patchId: PatchId): void => {
  if (index < 0 || index >= chain.length || !isPatchId(patchId)) {
    return;
  }
  chain[index].patchId = patchId;
  scheduleAutoSave();
};

/** First slot patch when chain playback starts or resets. */
export const getChainStartPatchId = (): PatchId | null =>
  chain.length > 0 ? chain[0].patchId : null;
