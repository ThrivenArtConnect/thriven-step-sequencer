import type { TrackChannel } from './trackChannels.ts';

/** Non-destructive playback window: offset + duration in seconds (RAM only). */
export type SampleTrim = {
  readonly startOffset: number;
  readonly duration: number;
};

/** Minimum playback length in frames — avoids zero-duration `player.start()`. */
export const MIN_TRIM_FRAME_COUNT = 2;

/** Smallest allowed trim length from sample rate (time-based, not pixels or buffer %). */
export const computeMinTrimDurationSec = (sampleRate: number): number =>
  MIN_TRIM_FRAME_COUNT / Math.max(1, sampleRate);

export const resetChannelSampleTrim = (channel: TrackChannel): void => {
  channel.sampleTrim = null;
};

export const getChannelSampleTrim = (channel: TrackChannel): SampleTrim | null =>
  channel.sampleTrim;

export const setChannelSampleTrim = (
  channel: TrackChannel,
  startOffset: number,
  duration: number,
): void => {
  const buffer = channel.sampleAudioBuffer;
  if (!buffer) {
    throw new Error('No sample loaded on this track');
  }

  const maxDuration = buffer.duration;
  const minDuration = computeMinTrimDurationSec(buffer.sampleRate);
  const start = Math.max(0, Math.min(startOffset, maxDuration - minDuration));
  const end = Math.min(start + Math.max(duration, minDuration), maxDuration);
  const resolvedDuration = end - start;

  channel.sampleTrim = {
    startOffset: start,
    duration: resolvedDuration,
  };
};

/** When null, sequencer plays the full buffer via `player.start(time)`. */
export const getResolvedSamplePlayback = (
  channel: TrackChannel,
): { offset: number; duration: number } | null => {
  if (!channel.samplePlayer || !channel.sampleTrim) {
    return null;
  }
  return {
    offset: channel.sampleTrim.startOffset,
    duration: channel.sampleTrim.duration,
  };
};
