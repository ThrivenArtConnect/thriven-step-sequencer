import { getTransportBpm, resetPlayback, syncEngineMixVolumes } from '../audio/index.ts';
import { exportActivePatchMidi, exportSongChainMidi } from '../midi/index.ts';
import {
  applyImportedProject,
  downloadProjectBackup,
  parseImportedProjectJson,
  resetProjectToDefaults,
} from '../storage/persistence.ts';

export const renderProjectBar = (container: HTMLElement): void => {
  const bar = document.createElement('div');
  bar.className = 'project-bar';

  const newButton = document.createElement('button');
  newButton.type = 'button';
  newButton.className = 'project-bar__btn';
  newButton.textContent = 'New';
  newButton.setAttribute('aria-label', 'Reset project to defaults');

  newButton.addEventListener('click', () => {
    const confirmed = window.confirm(
      'Gesamtes Projekt auf Tekk-Defaults zurücksetzen? Ungespeicherte Änderungen gehen verloren.',
    );
    if (!confirmed) {
      return;
    }
    resetPlayback();
    resetProjectToDefaults();
    syncEngineMixVolumes();
  });

  const exportButton = document.createElement('button');
  exportButton.type = 'button';
  exportButton.className = 'project-bar__btn';
  exportButton.textContent = 'Export JSON';
  exportButton.addEventListener('click', () => {
    downloadProjectBackup();
  });

  const importLabel = document.createElement('label');
  importLabel.className = 'project-bar__btn project-bar__btn--import';
  importLabel.textContent = 'Import JSON';

  const importInput = document.createElement('input');
  importInput.type = 'file';
  importInput.accept = 'application/json,.json';
  importInput.className = 'project-bar__file-input';
  importInput.setAttribute('aria-label', 'Import project JSON file');

  importInput.addEventListener('change', () => {
    const file = importInput.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        window.alert('Import fehlgeschlagen: Datei konnte nicht gelesen werden.');
        return;
      }

      const snapshot = parseImportedProjectJson(reader.result);
      if (!snapshot) {
        window.alert('Import fehlgeschlagen: Ungültiges oder inkompatibles JSON.');
        return;
      }

      resetPlayback();
      applyImportedProject(snapshot);
      syncEngineMixVolumes();
    };
    reader.onerror = () => {
      window.alert('Import fehlgeschlagen: Datei konnte nicht gelesen werden.');
    };
    reader.readAsText(file);
    importInput.value = '';
  });

  importLabel.append(importInput);

  const exportPatchButton = document.createElement('button');
  exportPatchButton.type = 'button';
  exportPatchButton.className = 'project-bar__btn';
  exportPatchButton.textContent = 'Export Patch';
  exportPatchButton.setAttribute('aria-label', 'Export active patch as MIDI file');
  exportPatchButton.addEventListener('click', () => {
    exportActivePatchMidi(getTransportBpm());
  });

  const exportSongButton = document.createElement('button');
  exportSongButton.type = 'button';
  exportSongButton.className = 'project-bar__btn';
  exportSongButton.textContent = 'Export Song';
  exportSongButton.setAttribute('aria-label', 'Export song chain as MIDI file');
  exportSongButton.addEventListener('click', () => {
    exportSongChainMidi(getTransportBpm());
  });

  bar.append(newButton, exportButton, importLabel, exportPatchButton, exportSongButton);
  container.replaceChildren(bar);
};
