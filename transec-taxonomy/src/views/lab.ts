/**
 * Lab wiring: the modal's Signal tab (compact previews) and the
 * full-screen lab overlay (#/lab/<scheme>).
 */

import type { Band } from '../data/types';
import { schemesForBand, schemeById } from '../data/modulations';
import { BANDS } from '../data/bands';
import { LabPanel } from '../lab/LabPanel';
import { setSignalTabRenderer } from './modal';
import { getState, setState, subscribeKeys } from '../store';

const activePanels: LabPanel[] = [];

function clearPanels(): void {
  for (const p of activePanels) p.destroy();
  activePanels.length = 0;
}

/** Compact per-band preview inside the modal's Signal tab. */
function renderSignalTab(band: Band, el: HTMLElement): void {
  clearPanels();
  const schemes = schemesForBand(band.id);
  if (schemes.length === 0) {
    el.innerHTML = '<div class="signal-placeholder">No modulation demos for this band yet.</div>';
    return;
  }
  for (const scheme of schemes) {
    const block = document.createElement('div');
    block.className = 'signal-scheme';
    block.innerHTML = `<div class="signal-scheme-head">
      <span class="s-name">${scheme.name}</span>
      <button class="s-open" data-scheme="${scheme.id}">Open in lab ↗</button>
    </div>`;
    el.appendChild(block);
    block.querySelector<HTMLButtonElement>('.s-open')!.addEventListener('click', () => {
      clearPanels();
      setState({ labScheme: scheme.id, selectedBand: null, selectedCell: null });
    });
    activePanels.push(new LabPanel(block, scheme, { compact: true }));
  }
}

/** Full-screen lab overlay. */
export function mountLab(): void {
  setSignalTabRenderer(renderSignalTab);

  const overlay = document.createElement('div');
  overlay.className = 'lab-overlay';
  overlay.innerHTML = `
    <div class="lab-shell" role="dialog" aria-modal="true" aria-labelledby="lab-title">
      <div class="lab-head">
        <div>
          <div class="lab-title" id="lab-title"></div>
          <div class="lab-sub"></div>
        </div>
        <button class="modal-close lab-close" aria-label="Close lab">✕</button>
      </div>
      <div class="lab-body"></div>
    </div>`;
  document.body.appendChild(overlay);

  const titleEl = overlay.querySelector<HTMLElement>('.lab-title')!;
  const subEl = overlay.querySelector<HTMLElement>('.lab-sub')!;
  const bodyEl = overlay.querySelector<HTMLElement>('.lab-body')!;

  let panel: LabPanel | null = null;

  const close = () => setState({ labScheme: null });
  overlay.querySelector('.lab-close')!.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && getState().labScheme) close();
  });

  const sync = () => {
    const id = getState().labScheme;
    const scheme = id ? schemeById(id) : undefined;
    overlay.classList.toggle('open', !!scheme);
    if (panel) {
      panel.destroy();
      panel = null;
    }
    if (!scheme) return;
    const band = BANDS.find((b) => b.id === scheme.bandId);
    titleEl.textContent = scheme.name;
    subEl.textContent = band ? `${band.name} · ${band.tagline}` : '';
    bodyEl.innerHTML = '';
    panel = new LabPanel(bodyEl, scheme);
    overlay.querySelector<HTMLButtonElement>('.lab-close')!.focus();
  };
  subscribeKeys(['labScheme'], sync);
  sync();
}
