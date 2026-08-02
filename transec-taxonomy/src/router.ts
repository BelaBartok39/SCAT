/**
 * Hash router — deep links for every band, cell, lens, view, and lab demo.
 *
 *   #/view/matrix            → view switch
 *   #/lens/tfs               → objective lens
 *   #/band/cellular-5g       → band modal
 *   #/band/cellular-5g/lpd   → band modal at a specific objective tab
 *   #/lab/<schemeId>         → full-screen lab panel
 *
 * The router is bidirectional: state changes update the hash, and hash
 * changes (back button, cold load, pasted link) update state.
 */

import { getState, setState, subscribe } from './store';
import type { AppState } from './store';
import type { BandId, ObjectiveId } from './data/types';
import { BAND_ORDER, OBJECTIVE_ORDER } from './data/types';

const VIEWS = ['scene', 'matrix', 'frontier'] as const;

function isBand(s: string): s is BandId {
  return (BAND_ORDER as string[]).includes(s);
}
function isObjective(s: string): s is ObjectiveId {
  return (OBJECTIVE_ORDER as string[]).includes(s);
}
function isView(s: string): s is (typeof VIEWS)[number] {
  return (VIEWS as readonly string[]).includes(s);
}

/** Parse a location.hash into a state patch. Unknown routes → no-op patch. */
export function parseHash(hash: string): Partial<AppState> {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [head, a, b] = parts;
  switch (head) {
    case 'view':
      if (a && isView(a)) return { view: a, selectedBand: null, labScheme: null };
      break;
    case 'lens':
      if (a && isObjective(a)) return { lens: a, view: 'scene', selectedBand: null, labScheme: null };
      break;
    case 'band':
      if (a && isBand(a)) {
        return {
          selectedBand: a,
          selectedCell: b && isObjective(b) ? b : null,
          labScheme: null,
        };
      }
      break;
    case 'lab':
      if (a) return { labScheme: a, selectedBand: null };
      break;
  }
  return {};
}

/** Serialize current state into the canonical hash. */
export function toHash(s: Readonly<AppState>): string {
  if (s.labScheme) return `#/lab/${s.labScheme}`;
  if (s.selectedBand) {
    return s.selectedCell
      ? `#/band/${s.selectedBand}/${s.selectedCell}`
      : `#/band/${s.selectedBand}`;
  }
  if (s.view !== 'scene') return `#/view/${s.view}`;
  if (s.lens) return `#/lens/${s.lens}`;
  return '#/';
}

let applyingHash = false;

export function initRouter(): void {
  const applyFromLocation = () => {
    applyingHash = true;
    setState(parseHash(location.hash));
    applyingHash = false;
  };

  window.addEventListener('hashchange', applyFromLocation);

  // State → hash (skip while we're applying the hash to avoid loops).
  subscribe((s, changed) => {
    if (applyingHash) return;
    const routeKeys = ['view', 'lens', 'selectedBand', 'selectedCell', 'labScheme'];
    if (![...changed].some((k) => routeKeys.includes(k))) return;
    const h = toHash(s);
    if (location.hash !== h) history.replaceState(null, '', h);
  });

  // Cold load.
  if (location.hash) applyFromLocation();
  else history.replaceState(null, '', toHash(getState()));
}
