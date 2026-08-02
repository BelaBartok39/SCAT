/**
 * Matrix view — the 9×5 taxonomy grid at full fidelity.
 * The canonical, keyboard-navigable representation of the dataset.
 * Also renders the Frontier variant (same table, gap emphasis).
 */

import { BANDS } from '../data/bands';
import { OBJECTIVES } from '../data/objectives';
import { CELLS } from '../data/matrix';
import type { BandId, ObjectiveId } from '../data/types';
import { BAND_ORDER, OBJECTIVE_ORDER, MATURITY_LABEL, cellFor } from '../data/types';
import { getState, setState, subscribeKeys } from '../store';

function bandName(id: BandId): string {
  return BANDS.find((b) => b.id === id)?.name ?? id;
}

export function mountMatrix(container: HTMLElement, variant: 'matrix' | 'frontier'): void {
  const wrap = document.createElement('div');
  wrap.className = 'matrix-wrap';

  const intro =
    variant === 'matrix'
      ? `<h2>The Mapping</h2>
         <p>Physical-layer TRANSEC maturity by band and objective. Each cell asks: for this band,
         how is this objective achieved — and how mature is it? Click any cell for the full story.
         Upper-layer cryptography (COMSEC) is out of scope, so civil systems that rely on it read as weak here.</p>`
      : `<h2>The Frontier</h2>
         <p>Only the gaps and the research edge: <strong>Weak/absent</strong> and <strong>Research</strong> cells.
         TFS at the physical layer is the emptiest column — the clearest opening for new work,
         including PHY-layer dual-messaging and decoy-channel schemes.</p>`;

  const headCells = OBJECTIVE_ORDER.map((oid) => {
    const o = OBJECTIVES.find((x) => x.id === oid)!;
    return `<th scope="col" data-obj="${oid}" style="--obj-color:${o.color}" title="${o.name}" tabindex="0">${o.abbr}</th>`;
  }).join('');

  const bodyRows = BAND_ORDER.map((bid) => {
    const cells = OBJECTIVE_ORDER.map((oid) => {
      const c = cellFor(CELLS, bid, oid);
      return `<td><button class="matrix-cell mat-${c.maturity}" data-band="${bid}" data-obj="${oid}"
        aria-label="${bandName(bid)}, ${oid.toUpperCase()}: ${MATURITY_LABEL[c.maturity]}. ${c.note}">
        <span class="m-badge">${c.maturity}</span>
        <span class="m-note">${c.note}</span>
      </button></td>`;
    }).join('');
    return `<tr><th scope="row">${bandName(bid)}</th>${cells}</tr>`;
  }).join('');

  const legend = (['N', 'E', 'R', 'W'] as const)
    .map(
      (m) => `<span class="leg"><span class="chip" style="background:var(--maturity-${m.toLowerCase()})"></span>${MATURITY_LABEL[m]}</span>`,
    )
    .join('');

  wrap.innerHTML = `
    <div class="matrix-intro">${intro}</div>
    <table class="matrix-table ${variant === 'frontier' ? 'frontier' : ''}" aria-label="TRANSEC maturity matrix">
      <thead><tr><th scope="col">Band</th>${headCells}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
    <div class="matrix-legend">${legend}</div>
  `;
  container.appendChild(wrap);

  const table = wrap.querySelector<HTMLTableElement>('.matrix-table')!;

  // Cell click → open the band modal at that objective tab.
  table.querySelectorAll<HTMLButtonElement>('.matrix-cell').forEach((btn) => {
    btn.addEventListener('click', () => {
      setState({
        selectedBand: btn.dataset.band as BandId,
        selectedCell: btn.dataset.obj as ObjectiveId,
      });
    });
  });

  // Column-header click → toggle that lens.
  table.querySelectorAll<HTMLTableCellElement>('thead th[data-obj]').forEach((th) => {
    const toggle = () => {
      const id = th.dataset.obj as ObjectiveId;
      setState({ lens: getState().lens === id ? null : id });
    };
    th.addEventListener('click', toggle);
    th.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
  });

  // Arrow-key navigation across the cell grid.
  table.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    if (!t.classList.contains('matrix-cell')) return;
    const bIdx = BAND_ORDER.indexOf(t.dataset.band as BandId);
    const oIdx = OBJECTIVE_ORDER.indexOf(t.dataset.obj as ObjectiveId);
    let nb = bIdx;
    let no = oIdx;
    if (e.key === 'ArrowRight') no++;
    else if (e.key === 'ArrowLeft') no--;
    else if (e.key === 'ArrowDown') nb++;
    else if (e.key === 'ArrowUp') nb--;
    else return;
    e.preventDefault();
    nb = Math.max(0, Math.min(BAND_ORDER.length - 1, nb));
    no = Math.max(0, Math.min(OBJECTIVE_ORDER.length - 1, no));
    table
      .querySelector<HTMLButtonElement>(`.matrix-cell[data-band="${BAND_ORDER[nb]}"][data-obj="${OBJECTIVE_ORDER[no]}"]`)
      ?.focus();
  });

  // Lens sync: highlight the active column, dim others.
  const syncLens = () => {
    const { lens } = getState();
    table.classList.toggle('lens-on', lens !== null);
    const color = lens ? OBJECTIVES.find((o) => o.id === lens)!.color : '';
    table.style.setProperty('--obj-color', color);
    table.querySelectorAll<HTMLTableCellElement>('thead th[data-obj]').forEach((th) => {
      th.classList.toggle('lens-active', th.dataset.obj === lens);
    });
    table.querySelectorAll<HTMLButtonElement>('.matrix-cell').forEach((btn) => {
      btn.classList.toggle('in-lens', btn.dataset.obj === lens);
    });
  };
  subscribeKeys(['lens'], syncLens);
  syncLens();
}
