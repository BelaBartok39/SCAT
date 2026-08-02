/**
 * App chrome: header with title, view switch, and the objective lens bar.
 * The lens bar is global chrome (not scene-only) because the lens also
 * drives matrix highlighting and lab adversary overlays.
 */

import { getState, setState, subscribeKeys } from '../store';
import type { ViewId } from '../store';
import type { ObjectiveId } from '../data/types';
import { OBJECTIVE_ORDER } from '../data/types';

const OBJ_META: Record<ObjectiveId, { abbr: string; color: string; title: string }> = {
  lpd: { abbr: 'LPD', color: 'var(--obj-lpd)', title: 'Low Probability of Detection' },
  lpi: { abbr: 'LPI', color: 'var(--obj-lpi)', title: 'Low Probability of Intercept' },
  lpe: { abbr: 'LPE', color: 'var(--obj-lpe)', title: 'Low Probability of Exploitation' },
  aj:  { abbr: 'AJ',  color: 'var(--obj-aj)',  title: 'Anti-Jam' },
  tfs: { abbr: 'TFS', color: 'var(--obj-tfs)', title: 'Traffic Flow Security' },
};

const VIEW_META: { id: ViewId; label: string }[] = [
  { id: 'scene', label: 'Scene' },
  { id: 'matrix', label: 'Matrix' },
  { id: 'frontier', label: 'Frontier' },
  { id: 'about', label: 'About' },
];

export function mountChrome(root: HTMLElement): void {
  const header = document.createElement('header');
  header.className = 'app-header';
  header.innerHTML = `
    <div class="app-title">
      TRANSEC Taxonomy
      <span class="sub">physical-layer transmission security · NFC → THz · ground → orbit</span>
    </div>
    <nav class="view-switch" aria-label="View">
      ${VIEW_META.map((v) => `<button class="view-btn" data-view="${v.id}">${v.label}</button>`).join('')}
    </nav>
    <div class="lens-bar" role="group" aria-label="Objective lens">
      <span class="lens-label">Lens</span>
      ${OBJECTIVE_ORDER.map((id) => {
        const m = OBJ_META[id];
        return `<button class="lens-btn" data-lens="${id}" style="--obj-color:${m.color}" title="${m.title}" aria-pressed="false">${m.abbr}</button>`;
      }).join('')}
    </div>
  `;
  root.appendChild(header);

  header.querySelectorAll<HTMLButtonElement>('.view-btn').forEach((btn) => {
    btn.addEventListener('click', () => setState({ view: btn.dataset.view as ViewId }));
  });
  header.querySelectorAll<HTMLButtonElement>('.lens-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.lens as ObjectiveId;
      // Toggle: clicking the active lens clears it.
      setState({ lens: getState().lens === id ? null : id });
    });
  });

  const lensBar = header.querySelector<HTMLElement>('.lens-bar')!;

  const sync = () => {
    const s = getState();
    header.querySelectorAll<HTMLButtonElement>('.view-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === s.view);
    });
    // The lens drives the scene and the matrix columns; on About it would
    // be a control with nothing to control.
    lensBar.style.visibility = s.view === 'about' ? 'hidden' : '';
    header.querySelectorAll<HTMLButtonElement>('.lens-btn').forEach((btn) => {
      const active = btn.dataset.lens === s.lens;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  };
  subscribeKeys(['view', 'lens'], sync);
  sync();
}
