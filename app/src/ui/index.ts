/**
 * UI layer: DOM rendering, step-grid buttons, transport/mixer/SC controls, view switching (SEQ/MIX/SC).
 */

import { registerProjectRestoreHandler } from '../storage/persistence.ts';
import { renderSongChain } from './chain.ts';
import { renderStepGrid } from './grid.ts';
import { renderPatchSelector } from './patches.ts';
import { renderProjectBar } from './project.ts';
import { renderTransport } from './transport.ts';

export { renderStepGrid, updatePlayheadStep } from './grid.ts';
export { renderSongChain } from './chain.ts';
export { renderPatchSelector } from './patches.ts';
export { renderProjectBar } from './project.ts';
export { renderTransport } from './transport.ts';

export const mountApp = (root: HTMLElement): (() => void) => {
  root.innerHTML = `
    <header class="app-header">
      <h1 class="app-title">Thriven Step Sequencer</h1>
      <p class="app-tagline">SEQ · MIX · SC</p>
    </header>
    <main id="app-main" class="app-main" aria-label="Sequencer workspace"></main>
  `;

  const main = root.querySelector<HTMLElement>('#app-main');
  if (!main) {
    throw new Error('Missing #app-main inside app root');
  }

  const projectHost = document.createElement('div');
  projectHost.className = 'project-host';
  const transportHost = document.createElement('div');
  transportHost.className = 'transport-host';
  const patchHost = document.createElement('div');
  patchHost.className = 'patch-host';
  const chainHost = document.createElement('div');
  chainHost.className = 'chain-host';
  const gridHost = document.createElement('div');
  gridHost.className = 'grid-host';

  main.append(projectHost, transportHost, patchHost, chainHost, gridHost);

  let refreshPatches = (): void => {};
  let refreshTransport = (): void => {};
  let refreshChain = (): void => {};

  const refreshAll = (): void => {
    refreshTransport();
    refreshPatches();
    refreshChain();
    renderStepGrid(gridHost);
  };

  registerProjectRestoreHandler(refreshAll);

  renderProjectBar(projectHost);
  renderTransport(transportHost, (refresh) => {
    refreshTransport = refresh;
  });
  renderPatchSelector(patchHost, gridHost, (refresh) => {
    refreshPatches = refresh;
  });
  renderSongChain(chainHost, (refresh) => {
    refreshChain = refresh;
  });
  renderStepGrid(gridHost);

  return refreshAll;
};
