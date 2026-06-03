import * as Tone from 'tone';

import { TRACK_DEFINITIONS, type TrackId } from '../sequencer/tracks.ts';
import { getResolvedSamplePlayback } from './sampleTrim.ts';
import type { SampleTrim } from './sampleTrim.ts';
import { clearTrackSample } from './trackSamples.ts';
import { getTrackSynthKind } from './trackSynthKind.ts';

export type TrackSynth =
  | Tone.MembraneSynth
  | Tone.NoiseSynth
  | Tone.MonoSynth;

export type TrackChannel = {
  trackId: TrackId;
  synth: TrackSynth;
  volume: Tone.Volume;
  samplePlayer: Tone.Player | null;
  sampleFileName: string | null;
  sampleAudioBuffer: AudioBuffer | null;
  sampleTrim: SampleTrim | null;
};

export type TrackChannelMap = Record<TrackId, TrackChannel>;

const MONO_PITCH: Partial<Record<TrackId, string>> = {
  bass: 'C2',
  lead: 'G3',
};

const createKickSynth = (): Tone.MembraneSynth =>
  new Tone.MembraneSynth({
    pitchDecay: 0.05,
    octaves: 6,
    envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.05 },
  });

const createNoiseSynth = (decay: number): Tone.NoiseSynth =>
  new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay, sustain: 0, release: 0.02 },
  });

const createMonoSynth = (): Tone.MonoSynth =>
  new Tone.MonoSynth({
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.005, decay: 0.2, sustain: 0.15, release: 0.1 },
  });

const createSynthForTrack = (trackId: TrackId): TrackSynth => {
  const kind = getTrackSynthKind(trackId);

  switch (kind) {
    case 'kick':
      return createKickSynth();
    case 'mono':
      return createMonoSynth();
    case 'noise': {
      if (trackId === 'ohat') {
        return createNoiseSynth(0.22);
      }
      if (trackId === 'snare') {
        return createNoiseSynth(0.18);
      }
      return createNoiseSynth(0.1);
    }
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
};

export const createTrackChannels = (master: Tone.Gain): TrackChannelMap => {
  const channels = {} as TrackChannelMap;

  for (const { id } of TRACK_DEFINITIONS) {
    const volume = new Tone.Volume(0);
    const synth = createSynthForTrack(id);
    synth.connect(volume);
    volume.connect(master);
    channels[id] = {
      trackId: id,
      synth,
      volume,
      samplePlayer: null,
      sampleFileName: null,
      sampleAudioBuffer: null,
      sampleTrim: null,
    };
  }

  return channels;
};

export const applyChannelVolumeDb = (
  channel: TrackChannel,
  volumeDb: number,
): void => {
  channel.volume.volume.value = volumeDb;
};

export const triggerTrackChannel = (
  channel: TrackChannel,
  time: number,
): void => {
  if (channel.samplePlayer) {
    const playback = getResolvedSamplePlayback(channel);
    if (playback) {
      channel.samplePlayer.start(time, playback.offset, playback.duration);
    } else {
      channel.samplePlayer.start(time);
    }
    return;
  }

  const kind = getTrackSynthKind(channel.trackId);

  switch (kind) {
    case 'kick':
      (channel.synth as Tone.MembraneSynth).triggerAttackRelease('C1', '8n', time);
      break;
    case 'noise':
      (channel.synth as Tone.NoiseSynth).triggerAttackRelease('16n', time);
      break;
    case 'mono':
      (channel.synth as Tone.MonoSynth).triggerAttackRelease(
        MONO_PITCH[channel.trackId] ?? 'C3',
        '8n',
        time,
      );
      break;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
};

export const disposeTrackChannels = (channels: TrackChannelMap): void => {
  for (const { id } of TRACK_DEFINITIONS) {
    const channel = channels[id];
    clearTrackSample(channel);
    channel.synth.dispose();
    channel.volume.dispose();
  }
};
