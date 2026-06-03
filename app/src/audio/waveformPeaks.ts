export type WaveformPeak = {
  readonly min: number;
  readonly max: number;
};

/**
 * Downsample channel data to one min/max peak pair per canvas pixel column.
 * Uses min/max (not average) so transients stay visible in the waveform.
 */
export const computeWaveformPeaks = (
  channelData: Float32Array,
  pixelWidth: number,
): WaveformPeak[] => {
  const width = Math.max(1, Math.floor(pixelWidth));
  const peaks: WaveformPeak[] = [];
  const samplesPerPixel = channelData.length / width;

  for (let x = 0; x < width; x += 1) {
    const start = Math.floor(x * samplesPerPixel);
    const end = Math.floor((x + 1) * samplesPerPixel);
    let min = 1;
    let max = -1;

    if (end <= start) {
      peaks.push({ min: 0, max: 0 });
      continue;
    }

    for (let i = start; i < end; i += 1) {
      const sample = channelData[i] ?? 0;
      if (sample < min) {
        min = sample;
      }
      if (sample > max) {
        max = sample;
      }
    }

    if (min > max) {
      peaks.push({ min: 0, max: 0 });
    } else {
      peaks.push({ min, max });
    }
  }

  return peaks;
};

/** Peaks for a sub-range of channel data (zoomed waveform window). */
export const computeWaveformPeaksForRange = (
  channelData: Float32Array,
  startIndex: number,
  endIndex: number,
  pixelWidth: number,
): WaveformPeak[] => {
  const start = clampRangeIndex(startIndex, channelData.length);
  const end = clampRangeIndex(endIndex, channelData.length);
  if (end <= start) {
    return computeWaveformPeaks(channelData.subarray(0, 0), pixelWidth);
  }
  return computeWaveformPeaks(channelData.subarray(start, end), pixelWidth);
};

const clampRangeIndex = (index: number, length: number): number =>
  Math.min(length, Math.max(0, index));

export type DrawWaveformOptions = {
  readonly peaks: readonly WaveformPeak[];
  readonly selectionStartRatio: number;
  readonly selectionEndRatio: number;
  readonly waveColor?: string;
  readonly selectionColor?: string;
  readonly backgroundColor?: string;
};

export const drawWaveformOnCanvas = (
  canvas: HTMLCanvasElement,
  options: DrawWaveformOptions,
): void => {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth;
  const cssHeight = canvas.clientHeight;
  if (cssWidth <= 0 || cssHeight <= 0) {
    return;
  }

  canvas.width = Math.floor(cssWidth * dpr);
  canvas.height = Math.floor(cssHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const waveColor = options.waveColor ?? '#6b7280';
  const selectionColor = options.selectionColor ?? 'rgba(0, 240, 255, 0.18)';
  const backgroundColor = options.backgroundColor ?? '#0c0e14';

  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, cssWidth, cssHeight);

  const midY = cssHeight / 2;
  const halfH = cssHeight * 0.46;
  const startX = Math.max(0, Math.min(1, options.selectionStartRatio)) * cssWidth;
  const endX = Math.max(0, Math.min(1, options.selectionEndRatio)) * cssWidth;
  const selLeft = Math.min(startX, endX);
  const selRight = Math.max(startX, endX);

  ctx.fillStyle = selectionColor;
  ctx.fillRect(selLeft, 0, selRight - selLeft, cssHeight);

  ctx.strokeStyle = waveColor;
  ctx.lineWidth = 1;

  const { peaks } = options;
  const step = cssWidth / Math.max(1, peaks.length);

  for (let i = 0; i < peaks.length; i += 1) {
    const peak = peaks[i];
    const x = i * step + step / 2;
    const yMin = midY - peak.min * halfH;
    const yMax = midY - peak.max * halfH;
    ctx.beginPath();
    ctx.moveTo(x, yMin);
    ctx.lineTo(x, yMax);
    ctx.stroke();
  }
};
