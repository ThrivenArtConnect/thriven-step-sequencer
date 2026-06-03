import {
  addChainSlot,
  DEFAULT_CHAIN_REPEATS,
  getChain,
  isChainEnabled,
  MAX_CHAIN_REPEATS,
  MIN_CHAIN_REPEATS,
  moveChainSlot,
  PATCH_IDS,
  removeChainSlot,
  setChainEnabled,
  setSlotPatch,
  setSlotRepeats,
  type PatchId,
} from '../sequencer/index.ts';

const CHAIN_SLOT_CLASS = 'chain-slot';
const CHAIN_ENABLED_CLASS = 'chain-toggle--on';

const renderSlots = (
  listEl: HTMLElement,
  onMutate: () => void,
): void => {
  listEl.replaceChildren();
  const chain = getChain();

  chain.forEach((slot, index) => {
    const row = document.createElement('div');
    row.className = CHAIN_SLOT_CLASS;

    const indexLabel = document.createElement('span');
    indexLabel.className = 'chain-slot__index';
    indexLabel.textContent = String(index + 1);

    const patchSelect = document.createElement('select');
    patchSelect.className = 'chain-slot__patch';
    patchSelect.setAttribute('aria-label', `Slot ${index + 1} patch`);
    for (const patchId of PATCH_IDS) {
      const option = document.createElement('option');
      option.value = patchId;
      option.textContent = patchId;
      option.selected = patchId === slot.patchId;
      patchSelect.appendChild(option);
    }
    patchSelect.addEventListener('change', () => {
      setSlotPatch(index, patchSelect.value as PatchId);
      onMutate();
    });

    const repeatsInput = document.createElement('input');
    repeatsInput.type = 'number';
    repeatsInput.className = 'chain-slot__repeats';
    repeatsInput.min = String(MIN_CHAIN_REPEATS);
    repeatsInput.max = String(MAX_CHAIN_REPEATS);
    repeatsInput.step = '1';
    repeatsInput.value = String(slot.repeats);
    repeatsInput.setAttribute('aria-label', `Slot ${index + 1} repeats`);
    repeatsInput.addEventListener('change', () => {
      const parsed = Number.parseInt(repeatsInput.value, 10);
      if (!Number.isFinite(parsed)) {
        return;
      }
      setSlotRepeats(index, parsed);
      repeatsInput.value = String(getChain()[index].repeats);
      onMutate();
    });

    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.className = 'chain-slot__move';
    upBtn.textContent = '↑';
    upBtn.disabled = index === 0;
    upBtn.setAttribute('aria-label', `Move slot ${index + 1} up`);
    upBtn.addEventListener('click', () => {
      moveChainSlot(index, 'up');
      renderSlots(listEl, onMutate);
      onMutate();
    });

    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.className = 'chain-slot__move';
    downBtn.textContent = '↓';
    downBtn.disabled = index === chain.length - 1;
    downBtn.setAttribute('aria-label', `Move slot ${index + 1} down`);
    downBtn.addEventListener('click', () => {
      moveChainSlot(index, 'down');
      renderSlots(listEl, onMutate);
      onMutate();
    });

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'chain-slot__remove';
    removeBtn.textContent = '✕';
    removeBtn.setAttribute('aria-label', `Remove slot ${index + 1}`);
    removeBtn.addEventListener('click', () => {
      removeChainSlot(index);
      renderSlots(listEl, onMutate);
      onMutate();
    });

    row.append(indexLabel, patchSelect, repeatsInput, upBtn, downBtn, removeBtn);
    listEl.appendChild(row);
  });
};

export const renderSongChain = (
  container: HTMLElement,
  registerRefresh?: (refresh: () => void) => void,
): void => {
  const panel = document.createElement('section');
  panel.className = 'song-chain';
  panel.setAttribute('aria-label', 'Song chain arrangement');

  const header = document.createElement('div');
  header.className = 'song-chain__header';

  const title = document.createElement('h2');
  title.className = 'song-chain__title';
  title.textContent = 'Song Chain';

  const chainToggle = document.createElement('button');
  chainToggle.type = 'button';
  chainToggle.className = 'chain-toggle';
  chainToggle.id = 'chain-enabled-toggle';

  const syncToggle = (): void => {
    const on = isChainEnabled();
    chainToggle.classList.toggle(CHAIN_ENABLED_CLASS, on);
    chainToggle.textContent = on ? 'Chain ON' : 'Chain OFF';
    chainToggle.setAttribute('aria-pressed', on ? 'true' : 'false');
  };

  chainToggle.addEventListener('click', () => {
    setChainEnabled(!isChainEnabled());
    syncToggle();
  });

  header.append(title, chainToggle);

  const listEl = document.createElement('div');
  listEl.className = 'song-chain__slots';

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'song-chain__add';
  addBtn.textContent = '+ Add slot';
  addBtn.addEventListener('click', () => {
    addChainSlot('A', DEFAULT_CHAIN_REPEATS);
    renderSlots(listEl, refresh);
    refresh();
  });

  const refresh = (): void => {
    syncToggle();
    renderSlots(listEl, refresh);
  };

  registerRefresh?.(refresh);
  panel.append(header, listEl, addBtn);
  container.replaceChildren(panel);
  refresh();
};
