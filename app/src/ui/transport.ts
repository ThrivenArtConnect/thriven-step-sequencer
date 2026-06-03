import {
  DEFAULT_BPM,
  DEFAULT_SWING_PERCENT,
  getPlaybackState,
  getTransportBpm,
  getTransportSwingPercent,
  isPlaying,
  MAX_BPM,
  MAX_SWING_PERCENT,
  MIN_BPM,
  resetPlayback,
  setTransportBpm,
  setTransportSwingPercent,
  togglePlayback,
} from '../audio/index.ts';

const TRANSPORT_PLAY_CLASS = 'transport-play';
const TRANSPORT_RESET_CLASS = 'transport-reset';
const TRANSPORT_PLAY_ACTIVE_CLASS = 'transport-play--active';
const BPM_INPUT_CLASS = 'transport-bpm-input';
const BPM_SLIDER_CLASS = 'transport-bpm-slider';
const SWING_SLIDER_CLASS = 'transport-swing-slider';
const SWING_VALUE_CLASS = 'transport-swing-value';

const syncPlayButton = (button: HTMLButtonElement): void => {
  const playing = isPlaying();
  const paused = getPlaybackState() === 'paused';

  button.classList.toggle(TRANSPORT_PLAY_ACTIVE_CLASS, playing);
  button.textContent = playing ? '⏸ Pause' : '▶ Play';
  button.setAttribute('aria-pressed', playing ? 'true' : 'false');
  button.setAttribute(
    'aria-label',
    playing ? 'Pause sequencer' : paused ? 'Resume sequencer' : 'Play sequencer',
  );
};

const syncBpmControls = (
  input: HTMLInputElement,
  slider: HTMLInputElement,
  bpm: number,
): number => {
  const clamped = setTransportBpm(bpm);
  const rounded = Math.round(clamped);
  input.value = String(rounded);
  slider.value = String(clamped);
  return clamped;
};

const syncSwingControl = (
  slider: HTMLInputElement,
  valueLabel: HTMLSpanElement,
  percent: number,
): number => {
  const clamped = setTransportSwingPercent(percent);
  slider.value = String(clamped);
  valueLabel.textContent = `${clamped}%`;
  return clamped;
};

export const renderTransport = (
  container: HTMLElement,
  registerRefresh?: (refresh: () => void) => void,
): void => {
  const bar = document.createElement('div');
  bar.className = 'transport';

  const controls = document.createElement('div');
  controls.className = 'transport__controls';

  const playButton = document.createElement('button');
  playButton.type = 'button';
  playButton.className = TRANSPORT_PLAY_CLASS;
  playButton.id = 'transport-play';
  syncPlayButton(playButton);

  playButton.addEventListener('click', () => {
    void togglePlayback()
      .then(() => {
        syncPlayButton(playButton);
      })
      .catch((err: unknown) => {
        console.error('[Thriven] playback toggle failed:', err);
      });
  });

  const resetButton = document.createElement('button');
  resetButton.type = 'button';
  resetButton.className = TRANSPORT_RESET_CLASS;
  resetButton.id = 'transport-reset';
  resetButton.textContent = '■';
  resetButton.setAttribute('aria-label', 'Reset transport to step 1');

  resetButton.addEventListener('click', () => {
    resetPlayback();
    syncPlayButton(playButton);
  });

  controls.append(playButton, resetButton);

  const bpmGroup = document.createElement('div');
  bpmGroup.className = 'transport__bpm-group';

  const bpmLabel = document.createElement('label');
  bpmLabel.className = 'transport__bpm-label';
  bpmLabel.htmlFor = 'transport-bpm-input';
  bpmLabel.textContent = 'BPM';

  const bpmInput = document.createElement('input');
  bpmInput.type = 'number';
  bpmInput.id = 'transport-bpm-input';
  bpmInput.className = BPM_INPUT_CLASS;
  bpmInput.min = String(MIN_BPM);
  bpmInput.max = String(MAX_BPM);
  bpmInput.step = '1';

  const bpmSlider = document.createElement('input');
  bpmSlider.type = 'range';
  bpmSlider.id = 'transport-bpm-slider';
  bpmSlider.className = BPM_SLIDER_CLASS;
  bpmSlider.min = String(MIN_BPM);
  bpmSlider.max = String(MAX_BPM);
  bpmSlider.step = '1';

  const initialBpm = getTransportBpm() || DEFAULT_BPM;
  syncBpmControls(bpmInput, bpmSlider, initialBpm);

  bpmSlider.addEventListener('input', () => {
    syncBpmControls(bpmInput, bpmSlider, Number.parseFloat(bpmSlider.value));
  });

  bpmInput.addEventListener('input', () => {
    const parsed = Number.parseFloat(bpmInput.value);
    if (!Number.isFinite(parsed)) {
      return;
    }
    syncBpmControls(bpmInput, bpmSlider, parsed);
  });

  bpmInput.addEventListener('change', () => {
    syncBpmControls(bpmInput, bpmSlider, Number.parseFloat(bpmInput.value));
  });

  bpmGroup.append(bpmLabel, bpmInput, bpmSlider);

  const swingGroup = document.createElement('div');
  swingGroup.className = 'transport__swing-group';

  const swingLabel = document.createElement('label');
  swingLabel.className = 'transport__swing-label';
  swingLabel.htmlFor = 'transport-swing-slider';
  swingLabel.textContent = 'Swing';

  const swingSlider = document.createElement('input');
  swingSlider.type = 'range';
  swingSlider.id = 'transport-swing-slider';
  swingSlider.className = SWING_SLIDER_CLASS;
  swingSlider.min = '0';
  swingSlider.max = String(MAX_SWING_PERCENT);
  swingSlider.step = '1';

  const swingValue = document.createElement('span');
  swingValue.className = SWING_VALUE_CLASS;
  swingValue.setAttribute('aria-live', 'polite');

  const initialSwing = getTransportSwingPercent() || DEFAULT_SWING_PERCENT;
  syncSwingControl(swingSlider, swingValue, initialSwing);

  swingSlider.addEventListener('input', () => {
    syncSwingControl(swingSlider, swingValue, Number.parseFloat(swingSlider.value));
  });

  swingGroup.append(swingLabel, swingSlider, swingValue);

  const timing = document.createElement('div');
  timing.className = 'transport__timing';
  timing.append(bpmGroup, swingGroup);

  bar.append(controls, timing);
  container.replaceChildren(bar);

  const refresh = (): void => {
    syncPlayButton(playButton);
    syncBpmControls(bpmInput, bpmSlider, getTransportBpm() || DEFAULT_BPM);
    syncSwingControl(
      swingSlider,
      swingValue,
      getTransportSwingPercent() || DEFAULT_SWING_PERCENT,
    );
  };

  registerRefresh?.(refresh);
  refresh();
};
