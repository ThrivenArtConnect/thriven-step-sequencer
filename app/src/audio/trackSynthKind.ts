import type { TrackId } from '../sequencer/tracks.ts';

export type TrackSynthKind = 'kick' | 'noise' | 'mono';

const KICK_TRACKS: readonly TrackId[] = ['kick1', 'kick2'];
const MONO_TRACKS: readonly TrackId[] = ['bass', 'lead'];

export const getTrackSynthKind = (trackId: TrackId): TrackSynthKind => {
  if (KICK_TRACKS.includes(trackId)) {
    return 'kick';
  }
  if (MONO_TRACKS.includes(trackId)) {
    return 'mono';
  }
  return 'noise';
};
