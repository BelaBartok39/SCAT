/**
 * Spectrum ribbon — log-scale 10 MHz → 1 THz navigation rail.
 * Click a band segment to fly the camera to its emitter. The rail's
 * gradient encodes the two mechanism regimes (signal-domain low,
 * propagation/spatial high) with the 7–24 GHz transition band hatched.
 */

import { BANDS } from '../data/bands';
import type { BandId } from '../data/types';

const LOG_MIN = Math.log10(10e6); // 10 MHz
const LOG_MAX = Math.log10(1e12); // 1 THz

function toPct(hz: number): number {
  const p = ((Math.log10(hz) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * 100;
  return Math.max(0, Math.min(100, p));
}

function fmtHz(hz: number): string {
  if (hz >= 1e12) return (hz / 1e12).toFixed(1) + ' THz';
  if (hz >= 1e9) return (hz / 1e9).toFixed(hz < 10e9 ? 2 : 1) + ' GHz';
  if (hz >= 1e6) return (hz / 1e6).toFixed(0) + ' MHz';
  return hz.toFixed(0) + ' Hz';
}

export function mountRibbon(
  container: HTMLElement,
  onFocusBand: (id: BandId) => void,
): void {
  const el = document.createElement('div');
  el.className = 'ribbon';

  // Display anchors, not true spans: several bands overlap heavily around
  // 2.4 GHz (and 5G NR alone spans 0.41–71 GHz), so span-accurate segments
  // pile five deep. The survey deck's own footer ribbon uses representative
  // positions — we follow it. True ranges stay in the tooltip.
  const ANCHOR_HZ: Record<BandId, number> = {
    nfc: 13.56e6,
    'cellular-3g-4g': 1.2e9,
    bluetooth: 2.44e9,
    wifi: 5.5e9,
    'satcom-civil': 14e9,
    'satcom-leo': 10.7e9,
    'cellular-5g': 28e9,
    'satcom-military': 44e9,
    '6g-subthz': 150e9,
  };
  const CHIP_W = 6.5; // % — fixed chip width, centered on the anchor

  const sorted = [...BANDS].sort((a, b) => ANCHOR_HZ[a.id] - ANCHOR_HZ[b.id]);
  const laneEnd: number[] = [-100, -100];
  const laneOf = new Map<BandId, number>();
  for (const b of sorted) {
    const center = toPct(ANCHOR_HZ[b.id]);
    const lo = center - CHIP_W / 2;
    const lane = laneEnd[0]! <= lo ? 0 : 1;
    laneOf.set(b.id, lane);
    laneEnd[lane] = center + CHIP_W / 2 + 0.6;
  }

  const segs = sorted
    .map((b) => {
      const center = toPct(ANCHOR_HZ[b.id]);
      const lo = Math.max(0, Math.min(100 - CHIP_W, center - CHIP_W / 2));
      return `<button class="ribbon-seg" data-band="${b.id}" data-lane="${laneOf.get(b.id)}"
        style="left:${lo.toFixed(2)}%;width:${CHIP_W}%"
        title="${b.name} · ${b.tagline}">${b.shortName}</button>`;
    })
    .join('');

  const tickHz = [10e6, 100e6, 1e9, 10e9, 100e9, 1e12];
  const ticks = tickHz
    .map((hz) => `<span style="left:${toPct(hz).toFixed(2)}%">${fmtHz(hz).replace('.0', '')}</span>`)
    .join('');

  const tLo = toPct(7e9);
  const tHi = toPct(24e9);

  el.innerHTML = `
    <div class="ribbon-regime" aria-hidden="true">
      <span class="r-signal">◀ signal-domain regime · spreading / hopping / coding</span>
      <span class="r-transition">7–24 GHz transition</span>
      <span class="r-spatial">propagation-spatial regime · beams / nulls / absorption ▶</span>
    </div>
    <div class="ribbon-rail" role="group" aria-label="Spectrum navigation, 10 megahertz to 1 terahertz">
      <div class="ribbon-transition" style="left:${tLo.toFixed(2)}%;width:${(tHi - tLo).toFixed(2)}%"></div>
      ${segs}
      <div class="ribbon-readout"></div>
    </div>
    <div class="ribbon-ticks" aria-hidden="true">${ticks}</div>
  `;
  container.appendChild(el);

  el.querySelectorAll<HTMLButtonElement>('.ribbon-seg').forEach((btn) => {
    btn.addEventListener('click', () => onFocusBand(btn.dataset.band as BandId));
  });

  // Frequency readout under the cursor.
  const rail = el.querySelector<HTMLElement>('.ribbon-rail')!;
  const readout = el.querySelector<HTMLElement>('.ribbon-readout')!;
  rail.addEventListener('pointermove', (e) => {
    const rect = rail.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const hz = 10 ** (LOG_MIN + frac * (LOG_MAX - LOG_MIN));
    readout.textContent = fmtHz(hz);
    readout.style.left = `${(frac * 100).toFixed(2)}%`;
  });
}
