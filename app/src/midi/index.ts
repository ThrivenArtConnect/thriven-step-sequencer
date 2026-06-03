/**
 * MIDI: Standard MIDI File export and Web MIDI API output to external hardware.
 */

export { MIDI_PPQ, MIDI_STEP_TICKS } from './constants.ts';
export { buildPatchMidi, buildSongMidi, exportActivePatchMidi, exportSongChainMidi } from './export.ts';

export const initMidi = async (): Promise<void> => {
  // Web MIDI hardware output will be wired in a later phase.
};
