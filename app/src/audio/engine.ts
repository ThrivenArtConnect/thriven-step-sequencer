import * as Tone from 'tone';

import {
  getActivePattern,
  getChain,
  getChainStartPatchId,
  getTrackDefinitions,
  isChainEnabled,
  setActivePatchId,
  STEP_COUNT,
} from '../sequencer/index.ts';
import {
  applyChannelVolumeDb,
  createTrackChannels,
  disposeTrackChannels,
  triggerTrackChannel,
  type TrackChannelMap,
} from './trackChannels.ts';
import { scheduleAutoSave } from '../storage/autosave.ts';
import {
  getTrackMixStates,
  isTrackAudible,
  type TrackMixStateMap,
} from './mixState.ts';

export const DEFAULT_BPM = 162;
export const MIN_BPM = 80;
export const MAX_BPM = 220;

export const DEFAULT_SWING_PERCENT = 0;
export const MAX_SWING_PERCENT = 50;
export const SWING_SUBDIVISION = '16n' as const;

const stepIndices = Array.from({ length: STEP_COUNT }, (_, index) => index);
const LAST_STEP_INDEX = STEP_COUNT - 1;

export type PlayheadCallback = (stepIndex: number | null) => void;
export type ActivePatchChangeCallback = () => void;

/** idle = never started or reset; playing; paused (position kept). */
export type TransportPlaybackState = 'idle' | 'playing' | 'paused';

export type AudioEngine = {
  togglePlayback: () => Promise<boolean>;
  resetPlayback: () => void;
  isPlaying: () => boolean;
  getPlaybackState: () => TransportPlaybackState;
  setBpm: (bpm: number) => number;
  getBpm: () => number;
  getChannels: () => TrackChannelMap;
  syncChannelVolumes: (states?: TrackMixStateMap) => void;
  dispose: () => void;
};

const clampBpm = (bpm: number): number =>
  Math.min(MAX_BPM, Math.max(MIN_BPM, bpm));

const syncAllChannelVolumes = (
  channels: TrackChannelMap,
  states: TrackMixStateMap,
): void => {
  for (const track of getTrackDefinitions()) {
    applyChannelVolumeDb(channels[track.id], states[track.id].volumeDb);
  }
};

const shouldRunChain = (): boolean => isChainEnabled() && getChain().length > 0;

export const createAudioEngine = (
  onPlayheadStep: PlayheadCallback,
  onActivePatchChange?: ActivePatchChangeCallback,
): AudioEngine => {
  const master = new Tone.Gain(1).toDestination();
  const channels = createTrackChannels(master);
  syncAllChannelVolumes(channels, getTrackMixStates());

  Tone.Transport.bpm.value = DEFAULT_BPM;
  Tone.Transport.swingSubdivision = SWING_SUBDIVISION;
  Tone.Transport.swing = DEFAULT_SWING_PERCENT / 100;

  let playbackState: TransportPlaybackState = 'idle';
  let sequenceStarted = false;

  let chainSlotIndex = 0;
  let loopsInCurrentSlot = 0;
  let lastStepIndex = -1;

  const notifyActivePatchChange = (): void => {
    onActivePatchChange?.();
  };

  const applyChainStartPatch = (): void => {
    if (!shouldRunChain()) {
      return;
    }
    const startPatch = getChainStartPatchId();
    if (startPatch) {
      setActivePatchId(startPatch);
      scheduleAutoSave();
      notifyActivePatchChange();
    }
  };

  const resetChainPlayback = (): void => {
    chainSlotIndex = 0;
    loopsInCurrentSlot = 0;
    lastStepIndex = -1;
    applyChainStartPatch();
  };

  const advanceChainAfterLoop = (): void => {
    const chain = getChain();
    const slot = chain[chainSlotIndex];
    loopsInCurrentSlot += 1;

    if (loopsInCurrentSlot < slot.repeats) {
      return;
    }

    loopsInCurrentSlot = 0;
    chainSlotIndex = (chainSlotIndex + 1) % chain.length;
    setActivePatchId(chain[chainSlotIndex].patchId);
    scheduleAutoSave();
    notifyActivePatchChange();
  };

  const handleChainStep = (stepIndex: number): void => {
    if (!shouldRunChain()) {
      lastStepIndex = stepIndex;
      return;
    }

    if (lastStepIndex === LAST_STEP_INDEX && stepIndex === 0) {
      advanceChainAfterLoop();
    }

    lastStepIndex = stepIndex;
  };

  const playStep = (time: number, stepIndex: number): void => {
    const pattern = getActivePattern();

    for (const track of getTrackDefinitions()) {
      if (!isTrackAudible(track.id)) {
        continue;
      }

      const cell = pattern[track.id][stepIndex];
      if (!cell.on) {
        continue;
      }
      if (cell.prob && Math.random() < 0.5) {
        continue;
      }

      triggerTrackChannel(channels[track.id], time);

      if (cell.tie) {
        const rollTime = time + Tone.Time('32n').toSeconds();
        triggerTrackChannel(channels[track.id], rollTime);
      }
    }
  };

  const sequence = new Tone.Sequence(
    (time, stepIndex) => {
      handleChainStep(stepIndex);
      Tone.Draw.schedule(() => {
        onPlayheadStep(stepIndex);
      }, time);
      playStep(time, stepIndex);
    },
    stepIndices,
    '16n',
  );

  const armSequenceOnce = (): void => {
    if (!sequenceStarted) {
      sequence.start(0, 0);
      sequenceStarted = true;
    }
  };

  const pausePlayback = (): void => {
    Tone.Transport.pause();
    playbackState = 'paused';
  };

  const resumePlayback = (): void => {
    Tone.Transport.start();
    playbackState = 'playing';
  };

  const startFromIdleOrPaused = async (): Promise<void> => {
    await Tone.start();
    armSequenceOnce();

    if (playbackState === 'paused') {
      resumePlayback();
      return;
    }

    resetChainPlayback();
    Tone.Transport.start();
    playbackState = 'playing';
  };

  const resetPlayback = (): void => {
    Tone.Transport.stop();
    Tone.Transport.position = 0;
    playbackState = 'idle';
    resetChainPlayback();
    onPlayheadStep(null);
  };

  return {
    togglePlayback: async (): Promise<boolean> => {
      if (playbackState === 'playing') {
        pausePlayback();
        return false;
      }
      await startFromIdleOrPaused();
      return true;
    },
    resetPlayback,
    isPlaying: (): boolean => playbackState === 'playing',
    getPlaybackState: (): TransportPlaybackState => playbackState,
    setBpm: (bpm: number): number => {
      const clamped = clampBpm(bpm);
      Tone.Transport.bpm.value = clamped;
      return clamped;
    },
    getBpm: (): number => Tone.Transport.bpm.value,
    getChannels: (): TrackChannelMap => channels,
    syncChannelVolumes: (states = getTrackMixStates()): void => {
      syncAllChannelVolumes(channels, states);
    },
    dispose: (): void => {
      resetPlayback();
      sequence.stop(0);
      sequence.dispose();
      sequenceStarted = false;
      disposeTrackChannels(channels);
      master.dispose();
    },
  };
};
