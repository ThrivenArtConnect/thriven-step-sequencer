import {
  copyActivePatchTo,
  getActivePatchId,
  isPatchFilled,
  PATCH_IDS,
  selectActivePatch,
  type PatchId,
} from '../sequencer/index.ts';
import { renderStepGrid } from './grid.ts';

const PATCH_BTN_CLASS = 'patch-btn';
const PATCH_BTN_ACTIVE_CLASS = 'patch-btn--active';
const PATCH_BTN_FILLED_CLASS = 'patch-btn--filled';

const paintPatchButtons = (buttons: Map<PatchId, HTMLButtonElement>): void => {
  const activeId = getActivePatchId();

  for (const patchId of PATCH_IDS) {
    const button = buttons.get(patchId);
    if (!button) {
      continue;
    }

    const filled = isPatchFilled(patchId);
    button.classList.toggle(PATCH_BTN_ACTIVE_CLASS, patchId === activeId);
    button.classList.toggle(PATCH_BTN_FILLED_CLASS, filled);
    button.setAttribute('aria-pressed', patchId === activeId ? 'true' : 'false');
    button.setAttribute('aria-label', `Patch ${patchId}${filled ? ', has steps' : ', empty'}`);
  }
};

const refreshCopyTargets = (
  select: HTMLSelectElement,
  activeId: PatchId,
): void => {
  select.replaceChildren();

  for (const patchId of PATCH_IDS) {
    if (patchId === activeId) {
      continue;
    }
    const option = document.createElement('option');
    option.value = patchId;
    option.textContent = patchId;
    select.appendChild(option);
  }

  select.disabled = select.options.length === 0;
};

export const renderPatchSelector = (
  container: HTMLElement,
  gridHost: HTMLElement,
  registerRefresh?: (refresh: () => void) => void,
): void => {
  const bar = document.createElement('div');
  bar.className = 'patch-bar';

  const slots = document.createElement('div');
  slots.className = 'patch-bar__slots';
  slots.setAttribute('role', 'group');
  slots.setAttribute('aria-label', 'Pattern patches A to J');

  const buttons = new Map<PatchId, HTMLButtonElement>();

  for (const patchId of PATCH_IDS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = PATCH_BTN_CLASS;
    button.dataset.patchId = patchId;
    button.textContent = patchId;

    button.addEventListener('click', () => {
      if (getActivePatchId() === patchId) {
        return;
      }
      selectActivePatch(patchId);
      renderStepGrid(gridHost);
      paintPatchButtons(buttons);
      refreshCopyTargets(copyTargetSelect, getActivePatchId());
    });

    buttons.set(patchId, button);
    slots.appendChild(button);
  }

  const copyGroup = document.createElement('div');
  copyGroup.className = 'patch-bar__copy';

  const copyLabel = document.createElement('span');
  copyLabel.className = 'patch-bar__copy-label';
  copyLabel.textContent = 'Copy to';

  const copyTargetSelect = document.createElement('select');
  copyTargetSelect.className = 'patch-bar__copy-select';
  copyTargetSelect.setAttribute('aria-label', 'Target patch for copy');

  const copyButton = document.createElement('button');
  copyButton.type = 'button';
  copyButton.className = 'patch-bar__copy-btn';
  copyButton.textContent = 'Copy';

  copyButton.addEventListener('click', () => {
    const target = copyTargetSelect.value;
    if (!target || target === getActivePatchId()) {
      return;
    }
    copyActivePatchTo(target as PatchId);
    paintPatchButtons(buttons);
    if (getActivePatchId() === target) {
      renderStepGrid(gridHost);
    }
  });

  copyGroup.append(copyLabel, copyTargetSelect, copyButton);
  bar.append(slots, copyGroup);
  container.replaceChildren(bar);

  const refresh = (): void => {
    paintPatchButtons(buttons);
    refreshCopyTargets(copyTargetSelect, getActivePatchId());
  };

  registerRefresh?.(refresh);
  refresh();
};
