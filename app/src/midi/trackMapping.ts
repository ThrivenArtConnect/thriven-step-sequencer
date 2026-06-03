import type { TrackId } from '../sequencer/tracks.ts';

export type TrackMidiMapping = {
  note: number;
  /** MIDI channel 0–15 (9 = GM drums channel 10). */
  channel: number;
};

/** GM drum channel 10 → index 9. Melodic tracks on separate channels. */
const DRUM_CHANNEL = 9;

export const TRACK_MIDI_MAP: Record<TrackId, TrackMidiMapping> = {
  kick1: { note: 36, channel: DRUM_CHANNEL },
  kick2: { note: 35, channel: DRUM_CHANNEL },
  clap: { note: 39, channel: DRUM_CHANNEL },
  snare: { note: 38, channel: DRUM_CHANNEL },
  chat: { note: 42, channel: DRUM_CHANNEL },
  ohat: { note: 46, channel: DRUM_CHANNEL },
  perc1: { note: 49, channel: DRUM_CHANNEL },
  perc2: { note: 54, channel: DRUM_CHANNEL },
  fx: { note: 52, channel: DRUM_CHANNEL },
  bass: { note: 48, channel: 0 },
  lead: { note: 55, channel: 1 },
};

export const getTrackMidiMapping = (trackId: TrackId): TrackMidiMapping =>
  TRACK_MIDI_MAP[trackId];
