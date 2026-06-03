import {
  buildProjectSnapshot,
  parseProjectSnapshot,
  type ProjectSnapshot,
} from '../sequencer/projectSnapshot.ts';

const STORAGE_KEY = 'thriven-step-sequencer-v1';
const SAVE_DEBOUNCE_MS = 120;

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let suppressAutoSave = false;

export const setAutoSaveSuppressed = (suppressed: boolean): void => {
  suppressAutoSave = suppressed;
};

export const scheduleAutoSave = (): void => {
  if (suppressAutoSave) {
    return;
  }

  if (saveTimer !== null) {
    clearTimeout(saveTimer);
  }

  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      const snapshot = buildProjectSnapshot();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch (err: unknown) {
      console.error('[Thriven] auto-save failed:', err);
    }
  }, SAVE_DEBOUNCE_MS);
};

export const loadSnapshotFromLocalStorage = (): ProjectSnapshot | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return parseProjectSnapshot(raw);
  } catch {
    return null;
  }
};

export const flushAutoSave = (): void => {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (suppressAutoSave) {
    return;
  }
  try {
    const snapshot = buildProjectSnapshot();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch (err: unknown) {
    console.error('[Thriven] auto-save flush failed:', err);
  }
};
