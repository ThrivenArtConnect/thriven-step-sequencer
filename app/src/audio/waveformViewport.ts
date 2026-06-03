export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const getVisibleDurationSec = (
  bufferDurationSec: number,
  zoom: number,
): number => bufferDurationSec / Math.max(1, zoom);

export const clampViewStartSec = (
  viewStartSec: number,
  bufferDurationSec: number,
  zoom: number,
): number => {
  const visible = getVisibleDurationSec(bufferDurationSec, zoom);
  const maxStart = Math.max(0, bufferDurationSec - visible);
  return clamp(viewStartSec, 0, maxStart);
};

/** 0 = left edge of visible window, 1 = right edge. Clamped when time is outside view. */
export const timeToViewportRatio = (
  timeSec: number,
  viewStartSec: number,
  viewDurationSec: number,
): number => {
  if (viewDurationSec <= 0) {
    return 0;
  }
  return clamp((timeSec - viewStartSec) / viewDurationSec, 0, 1);
};

export const viewportRatioToTimeSec = (
  ratio: number,
  viewStartSec: number,
  viewDurationSec: number,
): number => viewStartSec + clamp(ratio, 0, 1) * viewDurationSec;

export const timeRangeToSampleIndices = (
  channelLength: number,
  bufferDurationSec: number,
  startSec: number,
  endSec: number,
): { startIndex: number; endIndex: number } => {
  if (bufferDurationSec <= 0 || channelLength <= 0) {
    return { startIndex: 0, endIndex: 0 };
  }
  const samplesPerSec = channelLength / bufferDurationSec;
  return {
    startIndex: clamp(Math.floor(startSec * samplesPerSec), 0, channelLength),
    endIndex: clamp(Math.ceil(endSec * samplesPerSec), 0, channelLength),
  };
};

/** Max zoom so roughly one buffer sample maps to one screen pixel column. */
export const computeMaxZoom = (
  channelLength: number,
  pixelWidth: number,
  cap = 2048,
): number => Math.max(1, Math.min(cap, Math.floor(channelLength / Math.max(1, pixelWidth))));
