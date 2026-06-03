import * as Tone from 'tone';

import {
  applyTrackSampleTrim,
  getTrackSampleTrim,
  getTrackSampleWaveformSource,
  previewTrackSampleRegion,
  resetTrackSampleTrim,
} from '../audio/index.ts';
import {
  computeWaveformPeaksForRange,
  drawWaveformOnCanvas,
} from '../audio/waveformPeaks.ts';
import { computeMinTrimDurationSec } from '../audio/sampleTrim.ts';
import {
  clamp,
  clampViewStartSec,
  computeMaxZoom,
  getVisibleDurationSec,
  timeRangeToSampleIndices,
  timeToViewportRatio,
  viewportRatioToTimeSec,
} from '../audio/waveformViewport.ts';
import { TRACK_DEFINITIONS, type TrackId } from '../sequencer/tracks.ts';

const OVERLAY_CLASS = 'sample-editor-overlay';
const PANEL_CLASS = 'sample-editor-panel';
const CANVAS_CLASS = 'sample-editor-canvas';
const VIEWPORT_CLASS = 'sample-editor-viewport';
const MARKER_START_CLASS = 'sample-editor-marker sample-editor-marker--start';
const MARKER_END_CLASS = 'sample-editor-marker sample-editor-marker--end';
const MARKER_FOCUSED_CLASS = 'sample-editor-marker--focused';
const MARKER_HANDLE_CLASS = 'sample-editor-marker__handle';
const ZOOM_SLIDER_CLASS = 'sample-editor-zoom';
const SCROLL_SLIDER_CLASS = 'sample-editor-scroll';
const START_INPUT_CLASS = 'sample-editor-time-input--start';
const END_INPUT_CLASS = 'sample-editor-time-input--end';

const ZOOM_MIN = 1;
const ARROW_STEP_SEC = 0.001;
const ARROW_STEP_SHIFT_SEC = 0.01;
const WHEEL_ZOOM_FACTOR = 1.15;
const SCROLL_STEPS = 1000;

type MarkerDrag = 'start' | 'end' | null;
type FocusedMarker = 'start' | 'end';

let overlayEl: HTMLDivElement | null = null;
let viewportEl: HTMLDivElement | null = null;
let canvasEl: HTMLCanvasElement | null = null;
let markerStartEl: HTMLDivElement | null = null;
let markerEndEl: HTMLDivElement | null = null;
let titleEl: HTMLHeadingElement | null = null;
let fileNameEl: HTMLParagraphElement | null = null;
let timeLabelEl: HTMLSpanElement | null = null;
let zoomSliderEl: HTMLInputElement | null = null;
let zoomValueEl: HTMLSpanElement | null = null;
let scrollSliderEl: HTMLInputElement | null = null;
let scrollRowEl: HTMLDivElement | null = null;
let startInputEl: HTMLInputElement | null = null;
let endInputEl: HTMLInputElement | null = null;

let activeTrackId: TrackId | null = null;
let bufferDuration = 0;
let maxZoom = ZOOM_MIN;
let zoomLevel = ZOOM_MIN;
let viewStartSec = 0;
let selectionStartSec = 0;
let selectionEndSec = 0;
let focusedMarker: FocusedMarker = 'start';
let activeDrag: MarkerDrag = null;
let activePan = false;
let panLastClientX = 0;
let resizeObserver: ResizeObserver | null = null;

const getTrackDisplayName = (trackId: TrackId): string =>
  TRACK_DEFINITIONS.find((t) => t.id === trackId)?.name ?? trackId;

const getVisibleDuration = (): number =>
  getVisibleDurationSec(bufferDuration, zoomLevel);

const clampViewStart = (): void => {
  viewStartSec = clampViewStartSec(viewStartSec, bufferDuration, zoomLevel);
};

const getMinSelectionGap = (): number => {
  if (!activeTrackId) {
    return computeMinTrimDurationSec(48_000);
  }
  const source = getTrackSampleWaveformSource(activeTrackId);
  if (!source || source.duration <= 0) {
    return computeMinTrimDurationSec(48_000);
  }
  const sampleRate = source.channelData.length / source.duration;
  return computeMinTrimDurationSec(sampleRate);
};

const syncSelectionBounds = (): void => {
  const minGap = getMinSelectionGap();
  selectionStartSec = clamp(selectionStartSec, 0, bufferDuration - minGap);
  selectionEndSec = clamp(selectionEndSec, selectionStartSec + minGap, bufferDuration);
};

const updateMarkerPositions = (): void => {
  if (!markerStartEl || !markerEndEl) {
    return;
  }
  const visible = getVisibleDuration();
  const startRatio = timeToViewportRatio(selectionStartSec, viewStartSec, visible);
  const endRatio = timeToViewportRatio(selectionEndSec, viewStartSec, visible);
  markerStartEl.style.left = `${startRatio * 100}%`;
  markerEndEl.style.left = `${endRatio * 100}%`;
  markerStartEl.classList.toggle(MARKER_FOCUSED_CLASS, focusedMarker === 'start');
  markerEndEl.classList.toggle(MARKER_FOCUSED_CLASS, focusedMarker === 'end');
};

const updateTimeLabel = (): void => {
  if (!timeLabelEl) {
    return;
  }
  const visible = getVisibleDuration();
  const viewEnd = viewStartSec + visible;
  const start = selectionStartSec.toFixed(3);
  const end = selectionEndSec.toFixed(3);
  const len = (selectionEndSec - selectionStartSec).toFixed(3);
  timeLabelEl.textContent = `Trim: ${start}s – ${end}s (${len}s) · View: ${viewStartSec.toFixed(3)}s – ${viewEnd.toFixed(3)}s · Zoom ${zoomLevel.toFixed(1)}×`;
};

const syncNumericInputs = (): void => {
  if (startInputEl) {
    startInputEl.value = selectionStartSec.toFixed(3);
  }
  if (endInputEl) {
    endInputEl.value = selectionEndSec.toFixed(3);
  }
};

const syncZoomUi = (): void => {
  if (zoomSliderEl) {
    zoomSliderEl.min = String(ZOOM_MIN);
    zoomSliderEl.max = String(maxZoom);
    zoomSliderEl.value = String(Math.round(zoomLevel));
    zoomSliderEl.disabled = maxZoom <= ZOOM_MIN;
  }
  if (zoomValueEl) {
    zoomValueEl.textContent = `${zoomLevel.toFixed(1)}×`;
  }
};

const syncScrollUi = (): void => {
  if (!scrollSliderEl || !scrollRowEl) {
    return;
  }
  const visible = getVisibleDuration();
  const canScroll = zoomLevel > ZOOM_MIN + 0.001 && bufferDuration > visible + 0.000_001;
  scrollRowEl.hidden = !canScroll;

  if (!canScroll) {
    return;
  }

  const maxStart = Math.max(0, bufferDuration - visible);
  const ratio = maxStart > 0 ? viewStartSec / maxStart : 0;
  scrollSliderEl.value = String(Math.round(ratio * SCROLL_STEPS));
};

const redrawWaveform = (): void => {
  if (!canvasEl || !activeTrackId) {
    return;
  }
  const source = getTrackSampleWaveformSource(activeTrackId);
  if (!source) {
    return;
  }

  clampViewStart();
  syncSelectionBounds();

  const visible = getVisibleDuration();
  const viewEndSec = viewStartSec + visible;
  const { startIndex, endIndex } = timeRangeToSampleIndices(
    source.channelData.length,
    source.duration,
    viewStartSec,
    viewEndSec,
  );

  const peaks = computeWaveformPeaksForRange(
    source.channelData,
    startIndex,
    endIndex,
    canvasEl.clientWidth,
  );

  drawWaveformOnCanvas(canvasEl, {
    peaks,
    selectionStartRatio: timeToViewportRatio(selectionStartSec, viewStartSec, visible),
    selectionEndRatio: timeToViewportRatio(selectionEndSec, viewStartSec, visible),
    waveColor: '#00f0ff',
    selectionColor: 'rgba(0, 240, 255, 0.15)',
  });

  updateMarkerPositions();
  updateTimeLabel();
  syncNumericInputs();
  syncZoomUi();
  syncScrollUi();
};

const clientXToViewportRatio = (clientX: number): number => {
  if (!viewportEl) {
    return 0;
  }
  const rect = viewportEl.getBoundingClientRect();
  return clamp((clientX - rect.left) / rect.width, 0, 1);
};

const applyDragAtRatio = (marker: MarkerDrag, ratio: number): void => {
  const time = viewportRatioToTimeSec(ratio, viewStartSec, getVisibleDuration());
  const minGap = getMinSelectionGap();

  if (marker === 'start') {
    selectionStartSec = clamp(time, 0, selectionEndSec - minGap);
    focusedMarker = 'start';
  } else if (marker === 'end') {
    selectionEndSec = clamp(time, selectionStartSec + minGap, bufferDuration);
    focusedMarker = 'end';
  }
  redrawWaveform();
};

const setZoomAtPointer = (newZoom: number, anchorRatio: number): void => {
  const clampedZoom = clamp(newZoom, ZOOM_MIN, maxZoom);
  const oldVisible = getVisibleDurationSec(bufferDuration, zoomLevel);
  const anchorTime = viewStartSec + anchorRatio * oldVisible;
  zoomLevel = clampedZoom;
  const newVisible = getVisibleDuration();
  viewStartSec = anchorTime - anchorRatio * newVisible;
  clampViewStart();
  redrawWaveform();
};

const handleWheel = (event: WheelEvent): void => {
  event.preventDefault();
  const anchorRatio = clientXToViewportRatio(event.clientX);
  const factor = event.deltaY < 0 ? WHEEL_ZOOM_FACTOR : 1 / WHEEL_ZOOM_FACTOR;
  setZoomAtPointer(zoomLevel * factor, anchorRatio);
};

const stopDrag = (): void => {
  activeDrag = null;
  activePan = false;
};

const handlePointerMove = (event: PointerEvent): void => {
  if (activePan && viewportEl) {
    const rect = viewportEl.getBoundingClientRect();
    const deltaX = event.clientX - panLastClientX;
    panLastClientX = event.clientX;
    const deltaTime = (-deltaX / rect.width) * getVisibleDuration();
    viewStartSec += deltaTime;
    clampViewStart();
    redrawWaveform();
    return;
  }

  if (!activeDrag) {
    return;
  }
  applyDragAtRatio(activeDrag, clientXToViewportRatio(event.clientX));
};

const handlePointerUp = (): void => {
  stopDrag();
};

const nudgeFocusedMarker = (direction: -1 | 1, large: boolean): void => {
  const step = large ? ARROW_STEP_SHIFT_SEC : ARROW_STEP_SEC;
  const delta = direction * step;
  const minGap = getMinSelectionGap();

  if (focusedMarker === 'start') {
    selectionStartSec = clamp(
      selectionStartSec + delta,
      0,
      selectionEndSec - minGap,
    );
  } else {
    selectionEndSec = clamp(
      selectionEndSec + delta,
      selectionStartSec + minGap,
      bufferDuration,
    );
  }
  ensureMarkerInView(focusedMarker === 'start' ? selectionStartSec : selectionEndSec);
  redrawWaveform();
};

/** Scroll/zoom so the edited marker stays visible when nudging off-screen. */
const ensureMarkerInView = (timeSec: number): void => {
  const visible = getVisibleDuration();
  const viewEnd = viewStartSec + visible;
  const margin = visible * 0.05;
  if (timeSec < viewStartSec + margin) {
    viewStartSec = clamp(timeSec - margin, 0, bufferDuration - visible);
  } else if (timeSec > viewEnd - margin) {
    viewStartSec = clamp(timeSec - visible + margin, 0, bufferDuration - visible);
  }
  clampViewStart();
};

const applyNumericStart = (): void => {
  if (!startInputEl) {
    return;
  }
  const parsed = Number.parseFloat(startInputEl.value);
  if (!Number.isFinite(parsed)) {
    syncNumericInputs();
    return;
  }
  const minGap = getMinSelectionGap();
  selectionStartSec = clamp(parsed, 0, selectionEndSec - minGap);
  redrawWaveform();
};

const applyNumericEnd = (): void => {
  if (!endInputEl) {
    return;
  }
  const parsed = Number.parseFloat(endInputEl.value);
  if (!Number.isFinite(parsed)) {
    syncNumericInputs();
    return;
  }
  const minGap = getMinSelectionGap();
  selectionEndSec = clamp(parsed, selectionStartSec + minGap, bufferDuration);
  redrawWaveform();
};

const handlePreview = (): void => {
  if (!activeTrackId) {
    return;
  }
  const duration = selectionEndSec - selectionStartSec;
  void previewTrackSampleRegion(activeTrackId, selectionStartSec, duration).catch(
    (err: unknown) => {
      console.error('[Thriven] sample preview failed:', err);
    },
  );
};

const handleApply = (): void => {
  if (!activeTrackId) {
    return;
  }
  const duration = selectionEndSec - selectionStartSec;
  try {
    applyTrackSampleTrim(activeTrackId, selectionStartSec, duration);
    closeSampleEditor();
  } catch (err: unknown) {
    console.error('[Thriven] apply trim failed:', err);
    window.alert(err instanceof Error ? err.message : 'Trim konnte nicht gespeichert werden.');
  }
};

const handleReset = (): void => {
  if (!activeTrackId) {
    return;
  }
  resetTrackSampleTrim(activeTrackId);
  selectionStartSec = 0;
  selectionEndSec = bufferDuration;
  zoomLevel = ZOOM_MIN;
  viewStartSec = 0;
  redrawWaveform();
};

const closeSampleEditor = (): void => {
  if (!overlayEl) {
    return;
  }
  overlayEl.hidden = true;
  activeTrackId = null;
  stopDrag();
};

const handleEditorKeydown = (event: KeyboardEvent): void => {
  if (!overlayEl || overlayEl.hidden) {
    return;
  }

  if (event.key === 'Escape') {
    closeSampleEditor();
    return;
  }

  const target = event.target;
  if (
    target instanceof HTMLInputElement &&
    (target.type === 'number' || target.type === 'range')
  ) {
    return;
  }

  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    nudgeFocusedMarker(-1, event.shiftKey);
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    nudgeFocusedMarker(1, event.shiftKey);
  }
};

const syncSelectionFromTrim = (trackId: TrackId, duration: number): void => {
  const trim = getTrackSampleTrim(trackId);
  if (trim) {
    selectionStartSec = trim.startOffset;
    selectionEndSec = trim.startOffset + trim.duration;
  } else {
    selectionStartSec = 0;
    selectionEndSec = duration;
  }
};

const ensureOverlay = (): void => {
  if (overlayEl) {
    return;
  }

  overlayEl = document.createElement('div');
  overlayEl.className = OVERLAY_CLASS;
  overlayEl.hidden = true;
  overlayEl.setAttribute('role', 'presentation');

  const panel = document.createElement('div');
  panel.className = PANEL_CLASS;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.tabIndex = -1;

  titleEl = document.createElement('h2');
  titleEl.className = 'sample-editor-title';

  fileNameEl = document.createElement('p');
  fileNameEl.className = 'sample-editor-filename';

  timeLabelEl = document.createElement('span');
  timeLabelEl.className = 'sample-editor-time';

  const zoomRow = document.createElement('div');
  zoomRow.className = 'sample-editor-zoom-row';

  const zoomLabel = document.createElement('label');
  zoomLabel.className = 'sample-editor-zoom-label';
  zoomLabel.textContent = 'Zoom';

  zoomSliderEl = document.createElement('input');
  zoomSliderEl.type = 'range';
  zoomSliderEl.className = ZOOM_SLIDER_CLASS;
  zoomSliderEl.min = String(ZOOM_MIN);
  zoomSliderEl.max = String(ZOOM_MIN);
  zoomSliderEl.value = String(ZOOM_MIN);
  zoomSliderEl.setAttribute('aria-label', 'Waveform zoom');

  zoomValueEl = document.createElement('span');
  zoomValueEl.className = 'sample-editor-zoom-value';
  zoomValueEl.textContent = '1×';

  zoomLabel.append(zoomSliderEl);
  zoomRow.append(zoomLabel, zoomValueEl);

  zoomSliderEl.addEventListener('input', () => {
    const nextZoom = Number.parseFloat(zoomSliderEl?.value ?? String(ZOOM_MIN));
    if (!Number.isFinite(nextZoom)) {
      return;
    }
    setZoomAtPointer(nextZoom, 0.5);
  });

  const timeInputsRow = document.createElement('div');
  timeInputsRow.className = 'sample-editor-time-inputs';

  const startLabel = document.createElement('label');
  startLabel.className = 'sample-editor-time-input-label';
  startLabel.textContent = 'Start (s)';
  startInputEl = document.createElement('input');
  startInputEl.type = 'number';
  startInputEl.className = START_INPUT_CLASS;
  startInputEl.min = '0';
  startInputEl.step = '0.0001';
  startInputEl.setAttribute('aria-label', 'Trim start in seconds');
  startLabel.append(startInputEl);
  startInputEl.addEventListener('change', applyNumericStart);

  const endLabel = document.createElement('label');
  endLabel.className = 'sample-editor-time-input-label';
  endLabel.textContent = 'Ende (s)';
  endInputEl = document.createElement('input');
  endInputEl.type = 'number';
  endInputEl.className = END_INPUT_CLASS;
  endInputEl.min = '0';
  endInputEl.step = '0.0001';
  endInputEl.setAttribute('aria-label', 'Trim end in seconds');
  endLabel.append(endInputEl);
  endInputEl.addEventListener('change', applyNumericEnd);

  timeInputsRow.append(startLabel, endLabel);

  viewportEl = document.createElement('div');
  viewportEl.className = VIEWPORT_CLASS;

  canvasEl = document.createElement('canvas');
  canvasEl.className = CANVAS_CLASS;
  canvasEl.setAttribute('aria-label', 'Sample waveform');

  markerStartEl = document.createElement('div');
  markerStartEl.className = MARKER_START_CLASS;
  markerStartEl.setAttribute('role', 'slider');
  markerStartEl.setAttribute('aria-label', 'Trim start');
  markerStartEl.setAttribute('aria-orientation', 'horizontal');
  markerStartEl.tabIndex = 0;
  const startHandle = document.createElement('span');
  startHandle.className = MARKER_HANDLE_CLASS;
  markerStartEl.appendChild(startHandle);

  markerEndEl = document.createElement('div');
  markerEndEl.className = MARKER_END_CLASS;
  markerEndEl.setAttribute('role', 'slider');
  markerEndEl.setAttribute('aria-label', 'Trim end');
  markerEndEl.setAttribute('aria-orientation', 'horizontal');
  markerEndEl.tabIndex = 0;
  const endHandle = document.createElement('span');
  endHandle.className = MARKER_HANDLE_CLASS;
  markerEndEl.appendChild(endHandle);

  const startDrag = (marker: MarkerDrag) => (event: PointerEvent): void => {
    if (event.altKey) {
      return;
    }
    event.preventDefault();
    activeDrag = marker;
    focusedMarker = marker === 'start' ? 'start' : 'end';
    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };

  markerStartEl.addEventListener('pointerdown', startDrag('start'));
  markerEndEl.addEventListener('pointerdown', startDrag('end'));
  markerStartEl.addEventListener('focus', () => {
    focusedMarker = 'start';
    updateMarkerPositions();
  });
  markerEndEl.addEventListener('focus', () => {
    focusedMarker = 'end';
    updateMarkerPositions();
  });

  viewportEl.append(canvasEl, markerStartEl, markerEndEl);
  viewportEl.addEventListener('wheel', handleWheel, { passive: false });
  viewportEl.addEventListener('pointermove', handlePointerMove);
  viewportEl.addEventListener('pointerup', handlePointerUp);
  viewportEl.addEventListener('pointercancel', handlePointerUp);

  viewportEl.addEventListener('pointerdown', (event) => {
    if (!event.altKey || event.button !== 0) {
      return;
    }
    if ((event.target as Element).closest(`.${MARKER_HANDLE_CLASS}`)) {
      return;
    }
    event.preventDefault();
    activePan = true;
    panLastClientX = event.clientX;
    viewportEl?.setPointerCapture(event.pointerId);
  });

  scrollRowEl = document.createElement('div');
  scrollRowEl.className = 'sample-editor-scroll-row';
  scrollRowEl.hidden = true;

  const scrollLabel = document.createElement('label');
  scrollLabel.className = 'sample-editor-scroll-label';
  scrollLabel.textContent = 'Position';

  scrollSliderEl = document.createElement('input');
  scrollSliderEl.type = 'range';
  scrollSliderEl.className = SCROLL_SLIDER_CLASS;
  scrollSliderEl.min = '0';
  scrollSliderEl.max = String(SCROLL_STEPS);
  scrollSliderEl.value = '0';
  scrollSliderEl.setAttribute('aria-label', 'Scroll waveform view');

  scrollLabel.append(scrollSliderEl);
  scrollRowEl.append(scrollLabel);

  scrollSliderEl.addEventListener('input', () => {
    const visible = getVisibleDuration();
    const maxStart = Math.max(0, bufferDuration - visible);
    const ratio = Number.parseInt(scrollSliderEl?.value ?? '0', 10) / SCROLL_STEPS;
    viewStartSec = ratio * maxStart;
    clampViewStart();
    redrawWaveform();
  });

  const actions = document.createElement('div');
  actions.className = 'sample-editor-actions';

  const previewBtn = document.createElement('button');
  previewBtn.type = 'button';
  previewBtn.className = 'sample-editor-btn sample-editor-btn--preview';
  previewBtn.textContent = 'Vorhören';
  previewBtn.addEventListener('click', handlePreview);

  const applyBtn = document.createElement('button');
  applyBtn.type = 'button';
  applyBtn.className = 'sample-editor-btn sample-editor-btn--apply';
  applyBtn.textContent = 'Übernehmen';
  applyBtn.addEventListener('click', handleApply);

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'sample-editor-btn sample-editor-btn--reset';
  resetBtn.textContent = 'Reset';
  resetBtn.addEventListener('click', handleReset);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'sample-editor-btn sample-editor-btn--close';
  closeBtn.textContent = 'Schließen';
  closeBtn.addEventListener('click', closeSampleEditor);

  actions.append(previewBtn, applyBtn, resetBtn, closeBtn);

  panel.append(
    titleEl,
    fileNameEl,
    timeLabelEl,
    zoomRow,
    timeInputsRow,
    viewportEl,
    scrollRowEl,
    actions,
  );
  overlayEl.append(panel);

  overlayEl.addEventListener('click', (event) => {
    if (event.target === overlayEl) {
      closeSampleEditor();
    }
  });

  document.addEventListener('keydown', handleEditorKeydown);

  document.body.appendChild(overlayEl);

  resizeObserver = new ResizeObserver(() => {
    if (!overlayEl?.hidden && activeTrackId && canvasEl) {
      const source = getTrackSampleWaveformSource(activeTrackId);
      if (source) {
        maxZoom = computeMaxZoom(source.channelData.length, canvasEl.clientWidth);
        if (zoomLevel > maxZoom) {
          zoomLevel = maxZoom;
        }
      }
      redrawWaveform();
    }
  });
  resizeObserver.observe(viewportEl);
};

export const openSampleEditor = (trackId: TrackId): void => {
  void Tone.start().catch(() => {
    /* preview may still fail loudly */
  });

  const source = getTrackSampleWaveformSource(trackId);
  if (!source) {
    window.alert('Kein Sample auf diesem Track geladen.');
    return;
  }

  ensureOverlay();
  if (!overlayEl || !canvasEl) {
    return;
  }

  activeTrackId = trackId;
  bufferDuration = source.duration;
  syncSelectionFromTrim(trackId, source.duration);
  zoomLevel = ZOOM_MIN;
  viewStartSec = 0;
  focusedMarker = 'start';
  maxZoom = computeMaxZoom(source.channelData.length, canvasEl.clientWidth || 600);

  if (titleEl) {
    titleEl.textContent = `Sample trim — ${getTrackDisplayName(trackId)}`;
  }
  if (fileNameEl) {
    fileNameEl.textContent = source.fileName ?? '';
  }

  overlayEl.hidden = false;
  overlayEl.querySelector<HTMLElement>(`.${PANEL_CLASS}`)?.focus();

  requestAnimationFrame(() => {
    redrawWaveform();
  });
};
