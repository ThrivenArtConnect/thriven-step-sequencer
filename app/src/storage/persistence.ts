import {
  applyProjectSnapshot,
  buildProjectSnapshot,
  createDefaultProjectSnapshot,
  parseProjectSnapshot,
  type ProjectSnapshot,
} from '../sequencer/projectSnapshot.ts';
import {
  flushAutoSave,
  loadSnapshotFromLocalStorage,
  scheduleAutoSave,
  setAutoSaveSuppressed,
} from './autosave.ts';

let onProjectRestored: (() => void) | null = null;

export const registerProjectRestoreHandler = (handler: () => void): void => {
  onProjectRestored = handler;
};

const notifyRestored = (): void => {
  onProjectRestored?.();
};

export const tryLoadPersistedProject = (): boolean => {
  const snapshot = loadSnapshotFromLocalStorage();
  if (!snapshot) {
    return false;
  }

  setAutoSaveSuppressed(true);
  applyProjectSnapshot(snapshot);
  setAutoSaveSuppressed(false);
  return true;
};

export const resetProjectToDefaults = (): void => {
  setAutoSaveSuppressed(true);
  applyProjectSnapshot(createDefaultProjectSnapshot());
  setAutoSaveSuppressed(false);
  scheduleAutoSave();
  notifyRestored();
};

export const applyImportedProject = (snapshot: ProjectSnapshot): void => {
  setAutoSaveSuppressed(true);
  applyProjectSnapshot(snapshot);
  setAutoSaveSuppressed(false);
  flushAutoSave();
  notifyRestored();
};

export const exportProjectJson = (): string =>
  JSON.stringify(buildProjectSnapshot(), null, 2);

export const parseImportedProjectJson = (json: string): ProjectSnapshot | null =>
  parseProjectSnapshot(json);

export const downloadProjectBackup = (): void => {
  const blob = new Blob([exportProjectJson()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `thriven-project-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
};
