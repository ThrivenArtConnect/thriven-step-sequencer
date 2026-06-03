/**
 * Audio engine: Tone.js Transport, clock/tempo, synths, effects, and playback routing.
 */

export {
  DEFAULT_BPM,
  DEFAULT_SWING_PERCENT,
  MAX_BPM,
  MAX_SWING_PERCENT,
  MIN_BPM,
  SWING_SUBDIVISION,
} from './engine.ts';
export type {
  ActivePatchChangeCallback,
  AudioEngine,
  PlayheadCallback,
  TransportPlaybackState,
} from './engine.ts';
export { createAudioEngine } from './engine.ts';

export {
  MIX_VOLUME_DEFAULT_DB,
  MIX_VOLUME_MAX_DB,
  MIX_VOLUME_MIN_DB,
  getTrackMixState,
  getTrackMixStates,
  initMixState,
  isTrackAudible,
  resolveAudibleTrackIds,
  setTrackVolumeDb,
  toggleTrackMute,
  toggleTrackSolo,
} from './mixState.ts';
export type { TrackMixState, TrackMixStateMap } from './mixState.ts';

import * as Tone from 'tone';

import {
  createAudioEngine,
  DEFAULT_BPM,
  MAX_BPM,
  MAX_SWING_PERCENT,
  MIN_BPM,
  SWING_SUBDIVISION,
  type AudioEngine,
} from './engine.ts';
import type { TransportPlaybackState } from './engine.ts';
import {
  getTrackMixState,
  getTrackMixStates,
  setTrackVolumeDb,
  toggleTrackMute,
  toggleTrackSolo,
  type TrackMixState,
} from './mixState.ts';
import type { TrackId } from '../sequencer/tracks.ts';
import { scheduleAutoSave } from '../storage/autosave.ts';
import { applyChannelVolumeDb } from './trackChannels.ts';
import {
  getChannelSampleTrim,
  resetChannelSampleTrim,
  setChannelSampleTrim,
  type SampleTrim,
} from './sampleTrim.ts';
import {
  clearTrackSample,
  getTrackSampleFileName,
  hasTrackSample,
  isAcceptedSampleFile,
  loadTrackSampleFromFile,
} from './trackSamples.ts';

export type { SampleTrim } from './sampleTrim.ts';

let engine: AudioEngine | null = null;

export const initAudio = (
  onPlayheadStep: (stepIndex: number | null) => void,
  onActivePatchChange?: () => void,
): void => {
  engine?.dispose();
  engine = createAudioEngine(onPlayheadStep, onActivePatchChange);
};

export const togglePlayback = async (): Promise<boolean> => {
  if (!engine) {
    throw new Error('Audio engine not initialized — call initAudio() first');
  }
  return engine.togglePlayback();
};

export const resetPlayback = (): void => {
  if (!engine) {
    throw new Error('Audio engine not initialized — call initAudio() first');
  }
  engine.resetPlayback();
};

export const isPlaying = (): boolean => engine?.isPlaying() ?? false;

export const getPlaybackState = (): TransportPlaybackState =>
  engine?.getPlaybackState() ?? 'idle';

const clampTransportBpm = (bpm: number): number =>
  Math.min(MAX_BPM, Math.max(MIN_BPM, bpm));

/** Safe before initAudio — sets Tone.Transport directly when engine is not ready yet. */
export const setTransportBpm = (bpm: number): number => {
  const clamped = clampTransportBpm(bpm);
  if (engine) {
    engine.setBpm(clamped);
  } else {
    Tone.Transport.bpm.value = clamped;
  }
  scheduleAutoSave();
  return clamped;
};

export const getTransportBpm = (): number =>
  engine?.getBpm() ?? Tone.Transport.bpm.value ?? DEFAULT_BPM;

const clampSwingPercent = (percent: number): number =>
  Math.min(MAX_SWING_PERCENT, Math.max(0, percent));

/** UI percent 0–50 → Tone.Transport.swing 0–0.5. Safe before initAudio. */
export const setTransportSwingPercent = (percent: number): number => {
  const clamped = clampSwingPercent(percent);
  Tone.Transport.swing = clamped / 100;
  Tone.Transport.swingSubdivision = SWING_SUBDIVISION;
  scheduleAutoSave();
  return clamped;
};

export const getTransportSwingPercent = (): number =>
  Math.round((Tone.Transport.swing ?? 0) * 100);

export const syncEngineMixVolumes = (): void => {
  engine?.syncChannelVolumes();
};

export const applyTrackVolumeDb = (trackId: TrackId, volumeDb: number): void => {
  setTrackVolumeDb(trackId, volumeDb);
  const channel = engine?.getChannels()[trackId];
  if (channel) {
    applyChannelVolumeDb(channel, getTrackMixStates()[trackId].volumeDb);
  }
  scheduleAutoSave();
};

export const toggleTrackMuteAndSync = (trackId: TrackId): TrackMixState => {
  toggleTrackMute(trackId);
  scheduleAutoSave();
  return getTrackMixState(trackId);
};

export const toggleTrackSoloAndSync = (trackId: TrackId): TrackMixState => {
  toggleTrackSolo(trackId);
  scheduleAutoSave();
  return getTrackMixState(trackId);
};

const requireChannel = (trackId: TrackId) => {
  const channel = engine?.getChannels()[trackId];
  if (!channel) {
    throw new Error('Audio engine not initialized — call initAudio() first');
  }
  return channel;
};

export const trackHasSample = (trackId: TrackId): boolean => {
  const channel = engine?.getChannels()[trackId];
  return channel ? hasTrackSample(channel) : false;
};

export const getTrackSampleName = (trackId: TrackId): string | null => {
  const channel = engine?.getChannels()[trackId];
  return channel ? getTrackSampleFileName(channel) : null;
};

export const loadTrackSampleFile = async (
  trackId: TrackId,
  file: File,
): Promise<void> => {
  if (!isAcceptedSampleFile(file)) {
    throw new Error('Unsupported format — use WAV, MP3, or OGG.');
  }
  await Tone.start();
  const channel = requireChannel(trackId);
  await loadTrackSampleFromFile(channel, file);
};

export const removeTrackSample = (trackId: TrackId): void => {
  const channel = requireChannel(trackId);
  clearTrackSample(channel);
};

export const getTrackSampleTrim = (trackId: TrackId): SampleTrim | null => {
  const channel = engine?.getChannels()[trackId];
  return channel ? getChannelSampleTrim(channel) : null;
};

export const applyTrackSampleTrim = (
  trackId: TrackId,
  startOffset: number,
  duration: number,
): void => {
  const channel = requireChannel(trackId);
  setChannelSampleTrim(channel, startOffset, duration);
};

export const resetTrackSampleTrim = (trackId: TrackId): void => {
  const channel = requireChannel(trackId);
  resetChannelSampleTrim(channel);
};

export type TrackSampleWaveformSource = {
  readonly channelData: Float32Array;
  readonly duration: number;
  readonly fileName: string | null;
};

export const getTrackSampleWaveformSource = (
  trackId: TrackId,
): TrackSampleWaveformSource | null => {
  const channel = engine?.getChannels()[trackId];
  if (!channel?.sampleAudioBuffer) {
    return null;
  }
  const buffer = channel.sampleAudioBuffer;
  return {
    channelData: buffer.getChannelData(0),
    duration: buffer.duration,
    fileName: channel.sampleFileName,
  };
};

export const previewTrackSampleRegion = async (
  trackId: TrackId,
  startOffset: number,
  duration: number,
): Promise<void> => {
  await Tone.start();
  const channel = requireChannel(trackId);
  if (!channel.samplePlayer) {
    throw new Error('No sample loaded on this track');
  }
  channel.samplePlayer.stop();
  channel.samplePlayer.start(Tone.now(), startOffset, duration);
};
