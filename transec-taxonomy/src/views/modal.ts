/**
 * Band detail modal — four tabs: Physics · TRANSEC · Signal · References.
 * Layering rule: every section leads with one plain sentence; full deck
 * detail sits behind a disclosure. Opened via store (selectedBand), so
 * deep links, matrix cells, and scene emitters all share this path.
 */

import { BANDS } from '../data/bands';
import { OBJECTIVES } from '../data/objectives';
import { CELLS } from '../data/matrix';
import { MECHANISMS } from '../data/mechanisms';
import { REFERENCES } from '../data/refs';
import type { Band, BandPhysics, ObjectiveId } from '../data/types';
import { MATURITY_LABEL, OBJECTIVE_ORDER, cellFor } from '../data/types';
import { getState, setState, subscribeKeys } from '../store';

type TabId = 'physics' | 'transec' | 'signal' | 'refs';

const FIELD_LABELS: [keyof BandPhysics, string][] = [
  ['frequencyRange', 'Frequency & Range'],
  ['waveCharacteristics', 'Wave Characteristics'],
  ['modulationAccess', 'Modulation & Access'],
  ['power', 'Power'],
  ['noiseInterference', 'Noise & Interference'],
  ['antenna', 'Antenna Properties'],
  ['applications', 'Applications'],
  ['benefitsLimitations', 'Benefits & Limitations'],
];

let activeTab: TabId = 'physics';

/** Set by the lab module once it exists; renders a live preview into the Signal tab. */
export let renderSignalTab: ((band: Band, el: HTMLElement) => void) | null = null;
export function setSignalTabRenderer(fn: (band: Band, el: HTMLElement) => void): void {
  renderSignalTab = fn;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function physicsHtml(band: Band): string {
  return FIELD_LABELS.map(([key, label]) => {
    const f = band.physics[key];
    return `<div class="field-block">
      <div class="f-label">${label}</div>
      <div class="f-summary">${esc(f.summary)}</div>
      <details><summary>full detail</summary>
        <ul>${f.details.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>
      </details>
    </div>`;
  }).join('');
}

function transecHtml(band: Band, highlight: ObjectiveId | null): string {
  return OBJECTIVE_ORDER.map((oid) => {
    const o = OBJECTIVES.find((x) => x.id === oid)!;
    const c = cellFor(CELLS, band.id, oid);
    const chips = c.mechanismIds
      .map((mid) => {
        const m = MECHANISMS.find((x) => x.id === mid)!;
        return `<span class="mech-chip" title="${esc(m.description)}">${esc(m.name)}</span>`;
      })
      .join('');
    return `<div class="obj-section ${oid === highlight ? 'highlight' : ''}" style="--obj-color:${o.color}" ${oid === highlight ? 'data-highlighted' : ''}>
      <div class="o-head">
        <span class="o-abbr">${o.abbr}</span>
        <span class="o-maturity">${c.maturity} — ${MATURITY_LABEL[c.maturity]}</span>
      </div>
      <div class="o-note">${esc(c.note)}</div>
      ${c.detail ? `<div class="o-detail">${esc(c.detail)}</div>` : ''}
      ${chips ? `<div class="mech-chips">${chips}</div>` : ''}
      <details><summary>${esc(o.name)} — objective narrative</summary>
        <ul>
          <li><strong>Definition:</strong> ${esc(o.definition)}</li>
          <li><strong>Defeats:</strong> ${esc(o.defeats)}</li>
          <li><strong>Taxonomic reading:</strong> ${esc(o.taxonomicReading)}</li>
        </ul>
      </details>
    </div>`;
  }).join('');
}

function refsHtml(band: Band): string {
  const objRefIds = OBJECTIVE_ORDER.flatMap(
    (oid) => OBJECTIVES.find((x) => x.id === oid)!.refIds,
  );
  const wanted = new Set([...band.refIds, ...objRefIds]);
  const refs = REFERENCES.filter((r) => wanted.has(r.id));
  return refs
    .map((r) => {
      const link = r.doi
        ? `<a href="https://doi.org/${r.doi}" target="_blank" rel="noopener">doi:${r.doi}</a>`
        : r.url
          ? `<a href="${r.url}" target="_blank" rel="noopener">${new URL(r.url).hostname}</a>`
          : '';
      return `<div class="ref-item">
        <div class="r-authors">${esc(r.authors)} (${r.year})</div>
        <div class="r-title">${esc(r.title)}</div>
        <div class="r-venue">${esc(r.venue)}</div>
        ${link}
      </div>`;
    })
    .join('');
}

export function mountModal(): void {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal-head">
        <div>
          <div class="modal-title" id="modal-title"></div>
          <div class="modal-tagline"></div>
        </div>
        <button class="modal-close" aria-label="Close">✕</button>
      </div>
      <div class="modal-tabs" role="tablist">
        <button class="modal-tab" role="tab" data-tab="physics">Physics</button>
        <button class="modal-tab" role="tab" data-tab="transec">TRANSEC</button>
        <button class="modal-tab" role="tab" data-tab="signal">Signal</button>
        <button class="modal-tab" role="tab" data-tab="refs">References</button>
      </div>
      <div class="modal-body"></div>
    </div>
  `;
  document.body.appendChild(backdrop);

  const titleEl = backdrop.querySelector<HTMLElement>('.modal-title')!;
  const taglineEl = backdrop.querySelector<HTMLElement>('.modal-tagline')!;
  const bodyEl = backdrop.querySelector<HTMLElement>('.modal-body')!;
  const tabs = [...backdrop.querySelectorAll<HTMLButtonElement>('.modal-tab')];

  const close = () => setState({ selectedBand: null, selectedCell: null });
  backdrop.querySelector('.modal-close')!.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && getState().selectedBand) close();
  });

  function renderBody(band: Band): void {
    switch (activeTab) {
      case 'physics':
        bodyEl.innerHTML = physicsHtml(band);
        break;
      case 'transec': {
        bodyEl.innerHTML = transecHtml(band, getState().selectedCell);
        bodyEl.querySelector('[data-highlighted]')?.scrollIntoView({ block: 'nearest' });
        break;
      }
      case 'signal':
        if (renderSignalTab) {
          bodyEl.innerHTML = '';
          renderSignalTab(band, bodyEl);
        } else {
          bodyEl.innerHTML = `<div class="signal-placeholder">Live modulation lab for ${esc(band.name)} — coming in the lab phase.</div>`;
        }
        break;
      case 'refs':
        bodyEl.innerHTML = refsHtml(band);
        break;
    }
    tabs.forEach((t) => {
      const on = t.dataset.tab === activeTab;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', String(on));
    });
  }

  tabs.forEach((t) =>
    t.addEventListener('click', () => {
      activeTab = t.dataset.tab as TabId;
      const band = BANDS.find((b) => b.id === getState().selectedBand);
      if (band) renderBody(band);
    }),
  );

  const sync = () => {
    const s = getState();
    const band = BANDS.find((b) => b.id === s.selectedBand);
    backdrop.classList.toggle('open', !!band);
    if (!band) return;
    titleEl.textContent = band.name;
    taglineEl.textContent = band.tagline;
    // A cell click targets the TRANSEC tab; a plain band open keeps the last tab.
    if (s.selectedCell) activeTab = 'transec';
    renderBody(band);
    backdrop.querySelector<HTMLButtonElement>('.modal-close')!.focus();
  };
  subscribeKeys(['selectedBand', 'selectedCell'], sync);
  sync();
}
