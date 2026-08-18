/**
 * App chrome: header with title, view switch, and the objective lens bar.
 * The lens bar is global chrome (not scene-only) because the lens also
 * drives matrix highlighting and lab adversary overlays.
 */

import { getState, setState, subscribeKeys } from '../store';
import { getTheme, toggleTheme, subscribeTheme } from '../theme';
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
    <button class="theme-toggle" type="button" aria-live="polite">
      <span class="tt-icon" aria-hidden="true"></span>
      <span class="tt-label"></span>
    </button>
  `;
  root.appendChild(header);

  const SUN = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" '
    + 'stroke="currentColor" stroke-width="2" stroke-linecap="round">'
    + '<circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.4M12 19.6V22M2 12h2.4'
    + 'M19.6 12H22M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M19.1 4.9l-1.7 1.7'
    + 'M6.6 17.4l-1.7 1.7"/></svg>';
  const MOON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" '
    + 'stroke="currentColor" stroke-width="2" stroke-linecap="round" '
    + 'stroke-linejoin="round"><path d="M20 14.2A8.2 8.2 0 1 1 9.8 4'
    + 'a6.4 6.4 0 0 0 10.2 10.2z"/></svg>';

  const themeBtn = header.querySelector<HTMLButtonElement>('.theme-toggle')!;
  const themeIcon = themeBtn.querySelector<HTMLElement>('.tt-icon')!;
  const themeLabel = themeBtn.querySelector<HTMLElement>('.tt-label')!;
  themeBtn.addEventListener('click', toggleTheme);

  const syncTheme = () => {
    // The control is labelled with what it will DO, not what is active.
    const next = getTheme() === 'dark' ? 'light' : 'dark';
    themeIcon.innerHTML = next === 'light' ? SUN : MOON;
    themeLabel.textContent = next === 'light' ? 'Light' : 'Dark';
    themeBtn.title = `Switch to ${next} theme`;
    themeBtn.setAttribute('aria-label', `Switch to ${next} theme`);
  };
  subscribeTheme(syncTheme);
  syncTheme();

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
