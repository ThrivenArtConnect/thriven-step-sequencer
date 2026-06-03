import { TRACK_DEFINITIONS, type TrackId } from '../sequencer/tracks.ts';

export const MIX_VOLUME_MIN_DB = -40;
export const MIX_VOLUME_MAX_DB = 6;
export const MIX_VOLUME_DEFAULT_DB = 0;

export type TrackMixState = {
  volumeDb: number;
  muted: boolean;
  solo: boolean;
};

export type TrackMixStateMap = Record<TrackId, TrackMixState>;

const clampVolumeDb = (db: number): number =>
  Math.min(MIX_VOLUME_MAX_DB, Math.max(MIX_VOLUME_MIN_DB, db));

const createDefaultTrackMixState = (): TrackMixState => ({
  volumeDb: MIX_VOLUME_DEFAULT_DB,
  muted: false,
  solo: false,
});

export const createDefaultMixStateMap = (): TrackMixStateMap => {
  const states = {} as TrackMixStateMap;
  for (const { id } of TRACK_DEFINITIONS) {
    states[id] = createDefaultTrackMixState();
  }
  return states;
};

let mixStates: TrackMixStateMap = createDefaultMixStateMap();

export const initMixState = (): void => {
  mixStates = createDefaultMixStateMap();
};

export const replaceMixStates = (next: TrackMixStateMap): void => {
  const merged = createDefaultMixStateMap();
  for (const { id } of TRACK_DEFINITIONS) {
    const entry = next[id];
    if (entry) {
      merged[id] = {
        volumeDb: clampVolumeDb(entry.volumeDb),
        muted: entry.muted,
        solo: entry.solo,
      };
    }
  }
  mixStates = merged;
};

export const getTrackMixStates = (): TrackMixStateMap => mixStates;

export const getTrackMixState = (trackId: TrackId): TrackMixState => mixStates[trackId];

export const setTrackVolumeDb = (trackId: TrackId, volumeDb: number): void => {
  mixStates[trackId].volumeDb = clampVolumeDb(volumeDb);
};

export const toggleTrackMute = (trackId: TrackId): void => {
  mixStates[trackId].muted = !mixStates[trackId].muted;
};

export const toggleTrackSolo = (trackId: TrackId): void => {
  mixStates[trackId].solo = !mixStates[trackId].solo;
};

/**
 * Single place for mute/solo rules:
 * - Mute always wins (muted tracks are never audible).
 * - If any track is soloed, only soloed non-muted tracks are audible.
 * - Otherwise all non-muted tracks are audible.
 */
export const resolveAudibleTrackIds = (
  states: TrackMixStateMap = mixStates,
): ReadonlySet<TrackId> => {
  const anySolo = TRACK_DEFINITIONS.some(({ id }) => states[id].solo);
  const audible = new Set<TrackId>();

  for (const { id } of TRACK_DEFINITIONS) {
    const state = states[id];
    if (state.muted) {
      continue;
    }
    if (anySolo && !state.solo) {
      continue;
    }
    audible.add(id);
  }

  return audible;
};

export const isTrackAudible = (trackId: TrackId): boolean =>
  resolveAudibleTrackIds().has(trackId);
