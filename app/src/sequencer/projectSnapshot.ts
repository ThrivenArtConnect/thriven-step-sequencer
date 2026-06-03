import * as Tone from 'tone';

import { SWING_SUBDIVISION } from '../audio/engine.ts';
import {
  createDefaultMixStateMap,
  getTrackMixStates,
  replaceMixStates,
  type TrackMixStateMap,
} from '../audio/mixState.ts';
import { applyChainState, createDefaultChain, getChainState } from './chain.ts';
import { createDefaultPatchBank, createEmptyPattern } from './pattern.ts';
import type { Chain, ChainSlot } from './chain.ts';
import type { PatchBank, PatchId, Pattern, Step } from './types.ts';
import { PATCH_IDS, STEP_COUNT } from './types.ts';
import { TRACK_DEFINITIONS } from './tracks.ts';
import {
  getActivePatchId,
  getPatchBank,
  replacePatchBank,
  setActivePatchId,
} from './stateAccess.ts';

export const PROJECT_SCHEMA_VERSION = 1;
export const DEFAULT_PROJECT_BPM = 162;
export const DEFAULT_PROJECT_SWING_PERCENT = 0;
export const MIN_PROJECT_BPM = 80;
export const MAX_PROJECT_BPM = 220;
export const MAX_PROJECT_SWING_PERCENT = 50;

export type ProjectSnapshot = {
  version: number;
  patchBank: PatchBank;
  activePatchId: PatchId;
  chain: Chain;
  chainEnabled: boolean;
  bpm: number;
  swingPercent: number;
  mixStates: TrackMixStateMap;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isStep = (value: unknown): value is Step => {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.on === 'boolean' &&
    typeof value.prob === 'boolean' &&
    typeof value.tie === 'boolean'
  );
};

const isPatchId = (value: unknown): value is PatchId =>
  typeof value === 'string' && (PATCH_IDS as readonly string[]).includes(value);

const clampBpm = (bpm: number): number =>
  Math.min(MAX_PROJECT_BPM, Math.max(MIN_PROJECT_BPM, Math.round(bpm)));

const clampSwingPercent = (percent: number): number =>
  Math.min(MAX_PROJECT_SWING_PERCENT, Math.max(0, Math.round(percent)));

const clonePatchBank = (bank: PatchBank): PatchBank =>
  JSON.parse(JSON.stringify(bank)) as PatchBank;

const normalizePattern = (partial: Pattern | undefined): Pattern => {
  const pattern = createEmptyPattern();
  if (!partial) {
    return pattern;
  }

  for (const { id } of TRACK_DEFINITIONS) {
    const row = partial[id];
    if (!row || row.length !== STEP_COUNT) {
      continue;
    }
    for (let stepIndex = 0; stepIndex < STEP_COUNT; stepIndex += 1) {
      const step = row[stepIndex];
      if (isStep(step)) {
        pattern[id][stepIndex] = { on: step.on, prob: step.prob, tie: step.tie };
      }
    }
  }

  return pattern;
};

const normalizePatchBank = (raw: unknown): PatchBank => {
  const bank = {} as PatchBank;
  const source = isRecord(raw) ? raw : {};

  for (const patchId of PATCH_IDS) {
    bank[patchId] = normalizePattern(source[patchId] as Pattern | undefined);
  }

  return bank;
};

const normalizeChain = (raw: unknown): Chain => {
  if (!Array.isArray(raw)) {
    return [];
  }

  const slots: ChainSlot[] = [];
  for (const entry of raw) {
    if (!isRecord(entry) || !isPatchId(entry.patchId)) {
      continue;
    }
    const repeats = Number(entry.repeats);
    if (!Number.isFinite(repeats)) {
      continue;
    }
    slots.push({
      patchId: entry.patchId,
      repeats: Math.min(64, Math.max(1, Math.floor(repeats))),
    });
  }
  return slots;
};

const normalizeMixStates = (raw: unknown): TrackMixStateMap => {
  const defaults = createDefaultMixStateMap();
  const source = isRecord(raw) ? raw : {};

  for (const { id } of TRACK_DEFINITIONS) {
    const entry = source[id];
    if (!isRecord(entry)) {
      continue;
    }
    const volumeDb = Number(entry.volumeDb);
    defaults[id] = {
      volumeDb: Number.isFinite(volumeDb)
        ? Math.min(6, Math.max(-40, volumeDb))
        : defaults[id].volumeDb,
      muted: typeof entry.muted === 'boolean' ? entry.muted : defaults[id].muted,
      solo: typeof entry.solo === 'boolean' ? entry.solo : defaults[id].solo,
    };
  }

  return defaults;
};

export const buildProjectSnapshot = (
  bpm = Tone.Transport.bpm.value,
  swingPercent = Math.round(Tone.Transport.swing * 100),
): ProjectSnapshot => {
  const { chain, chainEnabled } = getChainState();

  return {
    version: PROJECT_SCHEMA_VERSION,
    patchBank: clonePatchBank(getPatchBank()),
    activePatchId: getActivePatchId(),
    chain: chain.map((slot) => ({ ...slot })),
    chainEnabled,
    bpm: clampBpm(bpm),
    swingPercent: clampSwingPercent(swingPercent),
    mixStates: JSON.parse(JSON.stringify(getTrackMixStates())) as TrackMixStateMap,
  };
};

export const isValidProjectSnapshot = (value: unknown): value is ProjectSnapshot => {
  if (!isRecord(value)) {
    return false;
  }
  return value.version === PROJECT_SCHEMA_VERSION && isPatchId(value.activePatchId);
};

export const parseProjectSnapshot = (json: string): ProjectSnapshot | null => {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!isValidProjectSnapshot(parsed)) {
      return null;
    }

    return {
      version: PROJECT_SCHEMA_VERSION,
      patchBank: normalizePatchBank(parsed.patchBank),
      activePatchId: parsed.activePatchId,
      chain: normalizeChain(parsed.chain),
      chainEnabled: Boolean(parsed.chainEnabled),
      bpm: clampBpm(Number(parsed.bpm)),
      swingPercent: clampSwingPercent(Number(parsed.swingPercent)),
      mixStates: normalizeMixStates(parsed.mixStates),
    };
  } catch {
    return null;
  }
};

export const applyProjectSnapshot = (snapshot: ProjectSnapshot): void => {
  replacePatchBank(snapshot.patchBank);
  setActivePatchId(snapshot.activePatchId);
  applyChainState(snapshot.chain, snapshot.chainEnabled);
  replaceMixStates(snapshot.mixStates);

  Tone.Transport.bpm.value = clampBpm(snapshot.bpm);
  Tone.Transport.swing = clampSwingPercent(snapshot.swingPercent) / 100;
  Tone.Transport.swingSubdivision = SWING_SUBDIVISION;
};

export const createDefaultProjectSnapshot = (): ProjectSnapshot => ({
  version: PROJECT_SCHEMA_VERSION,
  patchBank: createDefaultPatchBank(),
  activePatchId: 'A',
  chain: createDefaultChain(),
  chainEnabled: false,
  bpm: DEFAULT_PROJECT_BPM,
  swingPercent: DEFAULT_PROJECT_SWING_PERCENT,
  mixStates: createDefaultMixStateMap(),
});
