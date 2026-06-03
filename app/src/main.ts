/**
 * Application entry: global styles and ordered bootstrap of feature modules.
 */
import './style.css';

import { initAudio } from './audio/index.ts';
import { initMidi } from './midi/index.ts';
import { initSequencer } from './sequencer/index.ts';
import { tryLoadPersistedProject } from './storage/persistence.ts';
import { mountApp, updatePlayheadStep } from './ui/index.ts';

const bootstrap = async (): Promise<void> => {
  const root = document.querySelector<HTMLDivElement>('#app');
  if (!root) {
    throw new Error('Missing #app mount point in index.html');
  }

  initSequencer();
  tryLoadPersistedProject();
  const refreshActivePatchUi = mountApp(root);
  initAudio(updatePlayheadStep, refreshActivePatchUi);
  await initMidi();
};

bootstrap().catch((err: unknown) => {
  console.error('[Thriven] bootstrap failed:', err);
});
