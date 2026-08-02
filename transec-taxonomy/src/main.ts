/**
 * TRANSEC Taxonomy — bootstrap.
 * Order matters: chrome → view containers → router (router applies the
 * cold-load hash, so views must already be subscribed).
 */

import './styles/tokens.css';
import './styles/app.css';
import './styles/matrix.css';
import './styles/modal.css';

import { subscribeKeys, getState } from './store';
import { initRouter } from './router';
import { mountChrome } from './views/chrome';
import { mountMatrix } from './views/matrix';
import { mountModal } from './views/modal';

const app = document.getElementById('app')!;

// Ambient glows (ported pattern from rf-spectrum-viewer).
for (const n of [1, 2, 3]) {
  const glow = document.createElement('div');
  glow.className = `bg-glow bg-glow-${n}`;
  document.body.appendChild(glow);
}

mountChrome(app);

// View containers — populated by their modules as phases land.
const viewRoot = document.createElement('main');
viewRoot.className = 'view-root';
app.appendChild(viewRoot);

const containers = {
  scene: document.createElement('div'),
  matrix: document.createElement('div'),
  frontier: document.createElement('div'),
} as const;

for (const [id, el] of Object.entries(containers)) {
  el.className = 'screen hidden';
  el.dataset.viewContainer = id;
  viewRoot.appendChild(el);
}

function syncViews(): void {
  const { view } = getState();
  for (const [id, el] of Object.entries(containers)) {
    el.classList.toggle('hidden', id !== view);
  }
}
subscribeKeys(['view'], syncViews);

mountMatrix(containers.matrix, 'matrix');
mountMatrix(containers.frontier, 'frontier');
mountModal();

initRouter();
syncViews();

export { containers };
