/**
 * Scene view mount — instantiates SceneRoot lazily (first show) and
 * mirrors emitters into a visually-hidden list so the 3D canvas is
 * never the only path to band content.
 */

import { SceneRoot } from '../scene/SceneRoot';
import { BANDS } from '../data/bands';
import type { BandId } from '../data/types';
import { getState, setState, subscribeKeys } from '../store';

let root: SceneRoot | null = null;

export function getSceneRoot(): SceneRoot | null {
  return root;
}

export function mountScene(container: HTMLElement): void {
  container.classList.add('scene-container');

  // Accessible mirror of the emitters.
  const list = document.createElement('nav');
  list.className = 'visually-hidden';
  list.setAttribute('aria-label', 'Bands in the scene');
  list.innerHTML = `<ul>${BANDS.map(
    (b) => `<li><button data-band="${b.id}">${b.name} — open details</button></li>`,
  ).join('')}</ul>`;
  list.querySelectorAll<HTMLButtonElement>('button').forEach((btn) => {
    btn.addEventListener('click', () =>
      setState({ selectedBand: btn.dataset.band as BandId, selectedCell: null }),
    );
  });
  container.appendChild(list);

  let failed = false;
  const init = () => {
    if (!root && !failed && getState().view === 'scene') {
      try {
        root = new SceneRoot(container);
      } catch (err) {
        // WebGL unavailable — degrade gracefully; matrix view remains the
        // canonical representation and must never be taken down with us.
        failed = true;
        console.warn('3D scene unavailable, falling back to matrix view:', err);
        const note = document.createElement('div');
        note.className = 'scene-fallback';
        note.innerHTML = `<p>The 3D scene needs WebGL, which this browser doesn't provide.
          All content is available in the <button data-goto-matrix>Matrix view</button>.</p>`;
        note.querySelector('button')!.addEventListener('click', () => setState({ view: 'matrix' }));
        container.appendChild(note);
      }
    }
  };
  subscribeKeys(['view'], init);
  init();
}
