import {
  getActivePatchId,
  getActivePattern,
  getChain,
  getPatchBank,
} from '../sequencer/index.ts';
import type { Pattern } from '../sequencer/types.ts';
import { buildMidiFromBars, downloadMidiBlob, type PatternBar } from './exportPattern.ts';

const patternToBar = (pattern: Pattern): PatternBar => ({ pattern });

export const buildPatchMidi = (bpm: number): Uint8Array =>
  buildMidiFromBars([patternToBar(getActivePattern())], bpm);

export const buildSongMidi = (bpm: number): Uint8Array => {
  const bank = getPatchBank();
  const bars: PatternBar[] = [];

  for (const slot of getChain()) {
    const pattern = bank[slot.patchId];
    for (let repeat = 0; repeat < slot.repeats; repeat += 1) {
      bars.push(patternToBar(pattern));
    }
  }

  if (bars.length === 0) {
    bars.push(patternToBar(getActivePattern()));
  }

  return buildMidiFromBars(bars, bpm);
};

export const exportActivePatchMidi = (bpm: number): void => {
  const patchId = getActivePatchId();
  const bytes = buildPatchMidi(bpm);
  downloadMidiBlob(bytes, `thriven-patch-${patchId}.mid`);
};

export const exportSongChainMidi = (bpm: number): void => {
  const bytes = buildSongMidi(bpm);
  downloadMidiBlob(bytes, 'thriven-song.mid');
};
