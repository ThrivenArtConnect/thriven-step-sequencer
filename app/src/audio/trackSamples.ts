import * as Tone from 'tone';

import { resetChannelSampleTrim } from './sampleTrim.ts';
import type { TrackChannel } from './trackChannels.ts';

const ACCEPTED_EXTENSIONS = ['.wav', '.mp3', '.ogg'] as const;

export const isAcceptedSampleFile = (file: File): boolean => {
  const lower = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
};

export const getTrackSampleFileName = (channel: TrackChannel): string | null =>
  channel.sampleFileName;

export const hasTrackSample = (channel: TrackChannel): boolean =>
  channel.samplePlayer !== null;

const disconnectSynth = (channel: TrackChannel): void => {
  channel.synth.disconnect(channel.volume);
};

const reconnectSynth = (channel: TrackChannel): void => {
  channel.synth.connect(channel.volume);
};

export const clearTrackSample = (channel: TrackChannel): void => {
  if (channel.samplePlayer) {
    channel.samplePlayer.stop();
    channel.samplePlayer.dispose();
    channel.samplePlayer = null;
    channel.sampleFileName = null;
    channel.sampleAudioBuffer = null;
    resetChannelSampleTrim(channel);
  }
  reconnectSynth(channel);
};

export const loadTrackSampleFromFile = async (
  channel: TrackChannel,
  file: File,
): Promise<void> => {
  if (!isAcceptedSampleFile(file)) {
    throw new Error('Unsupported format — use WAV, MP3, or OGG.');
  }

  await Tone.start();

  const arrayBuffer = await file.arrayBuffer();
  const audioBuffer = await Tone.getContext().decodeAudioData(arrayBuffer);

  clearTrackSample(channel);

  const player = new Tone.Player(audioBuffer).connect(channel.volume);
  disconnectSynth(channel);

  channel.samplePlayer = player;
  channel.sampleFileName = file.name;
  channel.sampleAudioBuffer = audioBuffer;
  resetChannelSampleTrim(channel);
};
