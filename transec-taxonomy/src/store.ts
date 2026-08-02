/**
 * Tiny pub/sub store. No framework — views subscribe and re-render
 * their own slice when the keys they care about change.
 */

import type { BandId, ObjectiveId } from './data/types';

export type ViewId = 'scene' | 'matrix' | 'frontier' | 'about';

export interface WardenPosition {
  x: number;          // scene-plane coords
  z: number;
  elevated: boolean;  // orbital/airborne toggle
}

export interface AppState {
  view: ViewId;
  lens: ObjectiveId | null;
  selectedBand: BandId | null;
  /** Objective tab targeted inside the modal, when opened from a matrix cell. */
  selectedCell: ObjectiveId | null;
  /** Open lab scheme id, or null when lab is closed. */
  labScheme: string | null;
  wardenPos: WardenPosition;
  scattererEnabled: boolean;
  reducedMotion: boolean;
}

export type StateKey = keyof AppState;
type Listener = (state: AppState, changed: Set<StateKey>) => void;

const state: AppState = {
  view: 'scene',
  lens: null,
  selectedBand: null,
  selectedCell: null,
  labScheme: null,
  wardenPos: { x: 60, z: 40, elevated: false },
  scattererEnabled: false,
  reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
};

const listeners = new Set<Listener>();

export function getState(): Readonly<AppState> {
  return state;
}

export function setState(patch: Partial<AppState>): void {
  const changed = new Set<StateKey>();
  for (const k of Object.keys(patch) as StateKey[]) {
    if (state[k] !== patch[k]) {
      (state as Record<StateKey, unknown>)[k] = patch[k];
      changed.add(k);
    }
  }
  if (changed.size === 0) return;
  for (const fn of listeners) fn(state, changed);
}

/** Subscribe; returns an unsubscribe function. */
export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Subscribe only to specific keys. */
export function subscribeKeys(keys: StateKey[], fn: Listener): () => void {
  const wanted = new Set(keys);
  return subscribe((s, changed) => {
    for (const k of changed) if (wanted.has(k)) { fn(s, changed); return; }
  });
}

// Track OS-level reduced-motion changes live.
window
  .matchMedia('(prefers-reduced-motion: reduce)')
  .addEventListener('change', (e) => setState({ reducedMotion: e.matches }));
