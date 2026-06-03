import {
  applyTrackVolumeDb,
  getTrackMixState,
  getTrackSampleName,
  loadTrackSampleFile,
  MIX_VOLUME_MAX_DB,
  MIX_VOLUME_MIN_DB,
  removeTrackSample,
  toggleTrackMuteAndSync,
  toggleTrackSoloAndSync,
  trackHasSample,
} from '../audio/index.ts';
import { openSampleEditor } from './sampleEditor.ts';
import {
  getActivePattern,
  getTrackDefinitions,
  STEP_COUNT,
  toggleStepOn,
  type Step,
} from '../sequencer/index.ts';
import { isTrackId, type TrackId } from '../sequencer/tracks.ts';

const STEP_CELL_CLASS = 'step-cell';
const STEP_CELL_ON_CLASS = 'step-cell--on';
const STEP_CELL_BEAT_CLASS = 'step-cell--beat';
const STEP_CELL_PLAYHEAD_CLASS = 'step-cell--playhead';

const TRACK_MUTE_CLASS = 'track-mute';
const TRACK_SOLO_CLASS = 'track-solo';
const TRACK_VOLUME_CLASS = 'track-volume';
const MIX_ACTIVE_CLASS = 'mix-btn--active';
const TRACK_SAMPLE_BTN_CLASS = 'track-sample-btn';
const TRACK_SAMPLE_CLEAR_CLASS = 'track-sample-clear';
const TRACK_SAMPLE_NAME_CLASS = 'track-sample-name';
const GRID_ROW_HAS_SAMPLE_CLASS = 'grid-row--has-sample';
const GRID_ROW_CONTROLS_CLASS = 'grid-row__controls';
const TRACK_SAMPLE_CLEAR_INACTIVE_CLASS = 'track-sample-clear--inactive';
const TRACK_SAMPLE_EDIT_CLASS = 'track-sample-edit';
const TRACK_SAMPLE_EDIT_INACTIVE_CLASS = 'track-sample-edit--inactive';

const paintStepCell = (button: HTMLButtonElement, step: Step): void => {
  button.classList.toggle(STEP_CELL_ON_CLASS, step.on);
  button.setAttribute('aria-pressed', step.on ? 'true' : 'false');
};

const paintMixButtons = (row: HTMLElement, trackId: TrackId): void => {
  const state = getTrackMixState(trackId);
  const muteBtn = row.querySelector<HTMLButtonElement>(`.${TRACK_MUTE_CLASS}`);
  const soloBtn = row.querySelector<HTMLButtonElement>(`.${TRACK_SOLO_CLASS}`);
  muteBtn?.classList.toggle(MIX_ACTIVE_CLASS, state.muted);
  muteBtn?.setAttribute('aria-pressed', state.muted ? 'true' : 'false');
  soloBtn?.classList.toggle(MIX_ACTIVE_CLASS, state.solo);
  soloBtn?.setAttribute('aria-pressed', state.solo ? 'true' : 'false');
};

const parseStepIndex = (value: string | undefined): number | null => {
  if (value === undefined) {
    return null;
  }
  const index = Number.parseInt(value, 10);
  if (!Number.isInteger(index) || index < 0 || index >= STEP_COUNT) {
    return null;
  }
  return index;
};

const handleGridClick = (event: MouseEvent): void => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const muteBtn = target.closest<HTMLButtonElement>(`.${TRACK_MUTE_CLASS}`);
  if (muteBtn?.dataset.trackId && isTrackId(muteBtn.dataset.trackId)) {
    toggleTrackMuteAndSync(muteBtn.dataset.trackId);
    const row = muteBtn.closest<HTMLElement>('.grid-row');
    if (row) {
      paintMixButtons(row, muteBtn.dataset.trackId);
    }
    return;
  }

  const sampleEditBtn = target.closest<HTMLButtonElement>(`.${TRACK_SAMPLE_EDIT_CLASS}`);
  if (
    sampleEditBtn?.dataset.trackId &&
    isTrackId(sampleEditBtn.dataset.trackId) &&
    !sampleEditBtn.classList.contains(TRACK_SAMPLE_EDIT_INACTIVE_CLASS)
  ) {
    openSampleEditor(sampleEditBtn.dataset.trackId);
    return;
  }

  const sampleClearBtn = target.closest<HTMLButtonElement>(`.${TRACK_SAMPLE_CLEAR_CLASS}`);
  if (sampleClearBtn?.dataset.trackId && isTrackId(sampleClearBtn.dataset.trackId)) {
    removeTrackSample(sampleClearBtn.dataset.trackId);
    const row = sampleClearBtn.closest<HTMLElement>('.grid-row');
    if (row) {
      paintSampleUi(row, sampleClearBtn.dataset.trackId);
    }
    return;
  }

  const soloBtn = target.closest<HTMLButtonElement>(`.${TRACK_SOLO_CLASS}`);
  if (soloBtn?.dataset.trackId && isTrackId(soloBtn.dataset.trackId)) {
    toggleTrackSoloAndSync(soloBtn.dataset.trackId);
    const row = soloBtn.closest<HTMLElement>('.grid-row');
    if (row) {
      paintMixButtons(row, soloBtn.dataset.trackId);
    }
    return;
  }

  const button = target.closest<HTMLButtonElement>(`.${STEP_CELL_CLASS}`);
  if (!button || !button.dataset.trackId || button.dataset.stepIndex === undefined) {
    return;
  }

  const trackIdRaw = button.dataset.trackId;
  if (!isTrackId(trackIdRaw)) {
    return;
  }

  const stepIndex = parseStepIndex(button.dataset.stepIndex);
  if (stepIndex === null) {
    return;
  }

  toggleStepOn(trackIdRaw, stepIndex);
  paintStepCell(button, getActivePattern()[trackIdRaw][stepIndex]);
};

const handleGridInput = (event: Event): void => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || !target.classList.contains(TRACK_VOLUME_CLASS)) {
    return;
  }
  if (!target.dataset.trackId || !isTrackId(target.dataset.trackId)) {
    return;
  }
  const volumeDb = Number.parseFloat(target.value);
  if (!Number.isFinite(volumeDb)) {
    return;
  }
  applyTrackVolumeDb(target.dataset.trackId, volumeDb);
};

const paintSampleUi = (row: HTMLElement, trackId: TrackId): void => {
  const loaded = trackHasSample(trackId);
  row.classList.toggle(GRID_ROW_HAS_SAMPLE_CLASS, loaded);

  const sampleBtn = row.querySelector<HTMLButtonElement>(`.${TRACK_SAMPLE_BTN_CLASS}`);
  const editBtn = row.querySelector<HTMLButtonElement>(`.${TRACK_SAMPLE_EDIT_CLASS}`);
  const clearBtn = row.querySelector<HTMLButtonElement>(`.${TRACK_SAMPLE_CLEAR_CLASS}`);
  const nameEl = row.querySelector<HTMLSpanElement>(`.${TRACK_SAMPLE_NAME_CLASS}`);

  sampleBtn?.classList.toggle('track-sample-btn--loaded', loaded);
  if (editBtn) {
    editBtn.classList.toggle(TRACK_SAMPLE_EDIT_INACTIVE_CLASS, !loaded);
    editBtn.setAttribute('aria-hidden', loaded ? 'false' : 'true');
    editBtn.tabIndex = loaded ? 0 : -1;
  }
  if (clearBtn) {
    clearBtn.classList.toggle(TRACK_SAMPLE_CLEAR_INACTIVE_CLASS, !loaded);
    clearBtn.setAttribute('aria-hidden', loaded ? 'false' : 'true');
    clearBtn.tabIndex = loaded ? 0 : -1;
  }

  const fileName = getTrackSampleName(trackId);
  if (nameEl) {
    nameEl.textContent = loaded && fileName ? fileName : '';
    nameEl.title = loaded && fileName ? fileName : '';
  }
};

const createSampleControls = (trackId: TrackId, trackName: string): HTMLElement => {
  const wrap = document.createElement('div');
  wrap.className = 'grid-row__sample';

  const sampleBtn = document.createElement('button');
  sampleBtn.type = 'button';
  sampleBtn.className = TRACK_SAMPLE_BTN_CLASS;
  sampleBtn.textContent = 'Sample';
  sampleBtn.dataset.trackId = trackId;
  sampleBtn.setAttribute('aria-label', `Load sample for ${trackName}`);

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.className = 'track-sample-input';
  fileInput.accept = 'audio/wav,audio/mpeg,audio/ogg,.wav,.mp3,.ogg';
  fileInput.dataset.trackId = trackId;
  fileInput.setAttribute('aria-label', `Sample file for ${trackName}`);

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    const trackIdRaw = fileInput.dataset.trackId;
    if (!file || !trackIdRaw || !isTrackId(trackIdRaw)) {
      return;
    }

    void loadTrackSampleFile(trackIdRaw, file)
      .then(() => {
        const row = fileInput.closest<HTMLElement>('.grid-row');
        if (row) {
          paintSampleUi(row, trackIdRaw);
        }
      })
      .catch((err: unknown) => {
        console.error('[Thriven] sample load failed:', err);
        window.alert(
          err instanceof Error ? err.message : 'Sample konnte nicht geladen werden.',
        );
      });

    fileInput.value = '';
  });

  sampleBtn.addEventListener('click', () => {
    if (trackHasSample(trackId)) {
      return;
    }
    fileInput.click();
  });

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = TRACK_SAMPLE_CLEAR_CLASS;
  clearBtn.textContent = '✕';
  clearBtn.classList.add(TRACK_SAMPLE_CLEAR_INACTIVE_CLASS);
  clearBtn.setAttribute('aria-hidden', 'true');
  clearBtn.tabIndex = -1;
  clearBtn.dataset.trackId = trackId;
  clearBtn.setAttribute('aria-label', `Remove sample from ${trackName}`);

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = TRACK_SAMPLE_EDIT_CLASS;
  editBtn.classList.add(TRACK_SAMPLE_EDIT_INACTIVE_CLASS);
  editBtn.textContent = '✎';
  editBtn.setAttribute('aria-hidden', 'true');
  editBtn.tabIndex = -1;
  editBtn.dataset.trackId = trackId;
  editBtn.setAttribute('aria-label', `Edit sample trim for ${trackName}`);

  const nameEl = document.createElement('span');
  nameEl.className = TRACK_SAMPLE_NAME_CLASS;

  wrap.append(sampleBtn, editBtn, fileInput, clearBtn, nameEl);
  return wrap;
};

const createMixControls = (trackId: TrackId, trackName: string): HTMLElement => {
  const mix = document.createElement('div');
  mix.className = 'grid-row__mix';

  const muteBtn = document.createElement('button');
  muteBtn.type = 'button';
  muteBtn.className = `${TRACK_MUTE_CLASS} mix-btn`;
  muteBtn.textContent = 'M';
  muteBtn.dataset.trackId = trackId;
  muteBtn.setAttribute('aria-label', `Mute ${trackName}`);

  const soloBtn = document.createElement('button');
  soloBtn.type = 'button';
  soloBtn.className = `${TRACK_SOLO_CLASS} mix-btn`;
  soloBtn.textContent = 'S';
  soloBtn.dataset.trackId = trackId;
  soloBtn.setAttribute('aria-label', `Solo ${trackName}`);

  const volume = document.createElement('input');
  volume.type = 'range';
  volume.className = TRACK_VOLUME_CLASS;
  volume.min = String(MIX_VOLUME_MIN_DB);
  volume.max = String(MIX_VOLUME_MAX_DB);
  volume.step = '1';
  volume.value = String(getTrackMixState(trackId).volumeDb);
  volume.dataset.trackId = trackId;
  volume.setAttribute('aria-label', `Volume ${trackName}`);

  mix.append(muteBtn, soloBtn, volume);
  return mix;
};

const createStepButton = (
  trackId: TrackId,
  stepIndex: number,
  step: Step,
): HTMLButtonElement => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = STEP_CELL_CLASS;
  if (stepIndex % 4 === 0) {
    button.classList.add(STEP_CELL_BEAT_CLASS);
  }
  button.dataset.trackId = trackId;
  button.dataset.stepIndex = String(stepIndex);
  button.setAttribute(
    'aria-label',
    `${trackId} step ${stepIndex + 1}${step.on ? ', on' : ', off'}`,
  );
  paintStepCell(button, step);
  return button;
};

const createTrackRow = (
  trackId: TrackId,
  trackName: string,
  steps: Step[],
): HTMLElement => {
  const row = document.createElement('div');
  row.className = 'grid-row';
  row.dataset.trackId = trackId;

  const label = document.createElement('span');
  label.className = 'grid-row__name';
  label.textContent = trackName;

  const sample = createSampleControls(trackId, trackName);
  const mix = createMixControls(trackId, trackName);

  const controls = document.createElement('div');
  controls.className = GRID_ROW_CONTROLS_CLASS;
  controls.append(label, sample, mix);

  const stepsEl = document.createElement('div');
  stepsEl.className = 'grid-row__steps';
  stepsEl.setAttribute('role', 'group');
  stepsEl.setAttribute('aria-label', `${trackName} steps`);

  for (let stepIndex = 0; stepIndex < STEP_COUNT; stepIndex += 1) {
    stepsEl.appendChild(createStepButton(trackId, stepIndex, steps[stepIndex]));
  }

  row.append(controls, stepsEl);
  paintMixButtons(row, trackId);
  paintSampleUi(row, trackId);
  return row;
};

/** Highlights the current transport step column (all tracks). Pass null to clear. */
export const updatePlayheadStep = (stepIndex: number | null): void => {
  const cells = document.querySelectorAll<HTMLButtonElement>(`.${STEP_CELL_CLASS}`);
  cells.forEach((cell) => {
    cell.classList.remove(STEP_CELL_PLAYHEAD_CLASS);
  });

  if (stepIndex === null) {
    return;
  }

  document
    .querySelectorAll<HTMLButtonElement>(
      `.${STEP_CELL_CLASS}[data-step-index="${stepIndex}"]`,
    )
    .forEach((cell) => {
      cell.classList.add(STEP_CELL_PLAYHEAD_CLASS);
    });
};

/** Builds the 16-step grid into #app-main and wires click → pattern toggle. */
export const renderStepGrid = (container: HTMLElement): void => {
  const pattern = getActivePattern();
  const grid = document.createElement('div');
  grid.className = 'step-grid';
  grid.setAttribute('role', 'grid');
  grid.setAttribute('aria-label', 'Step sequencer');

  for (const track of getTrackDefinitions()) {
    grid.appendChild(createTrackRow(track.id, track.name, pattern[track.id]));
  }

  grid.addEventListener('click', handleGridClick);
  grid.addEventListener('input', handleGridInput);
  container.replaceChildren(grid);
};
