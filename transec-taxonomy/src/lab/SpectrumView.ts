/**
 * SpectrumView — fixed-range PSD line plot with a filled trace.
 *
 * Pure renderer (see contracts.ts): owns a canvas, holds no signal state
 * beyond the last frame it was handed (kept only so a resize can repaint
 * instead of flashing empty). The y axis is pinned to [dbMin, dbMax] —
 * never autoscaled — so spreading gain and noise floors stay comparable
 * frame to frame.
 */

import { THEME } from './contracts';
import type { LabView, SpectrumInput } from './contracts';

const DPR_CAP = 2;
const PAD = { left: 30, right: 8, top: 10, bottom: 18 };
const GRID_STEP_DB = 20;
const MONO = '"JetBrains Mono", ui-monospace, monospace';

/** '#06b6d4' -> 'rgba(6, 182, 212, a)'. */
function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export class SpectrumView implements LabView<SpectrumInput> {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private ro: ResizeObserver;
  private dpr = 1;
  private cssW = 0;
  private cssH = 0;
  private last: SpectrumInput | null = null;

  constructor(private container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    container.appendChild(this.canvas);

    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('SpectrumView: 2d context unavailable');
    this.ctx = ctx;

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
  }

  render(input: SpectrumInput): void {
    this.last = input;
    this.resize();
    this.draw(input);
  }

  destroy(): void {
    this.ro.disconnect();
    this.canvas.remove();
  }

  // — sizing ————————————————————————————————————————————————————————

  private resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    if (w === this.cssW && h === this.cssH && dpr === this.dpr) return;

    this.cssW = w;
    this.cssH = h;
    this.dpr = dpr;
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
    if (this.last) this.draw(this.last);
  }

  /** Snap a CSS-space coordinate to a device-pixel centre for a crisp hairline. */
  private snap(v: number): number {
    return (Math.round(v * this.dpr) + 0.5) / this.dpr;
  }

  // — drawing ———————————————————————————————————————————————————————

  private draw(input: SpectrumInput): void {
    const { ctx, cssW, cssH, dpr } = this;
    const { psd, psdCompare, dbMin, dbMax } = input;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = THEME.bg;
    ctx.fillRect(0, 0, cssW, cssH);

    const left = PAD.left;
    const top = PAD.top;
    const plotW = Math.max(1, cssW - PAD.left - PAD.right);
    const plotH = Math.max(1, cssH - PAD.top - PAD.bottom);
    const bottom = top + plotH;
    const span = dbMax - dbMin || 1;
    const toY = (db: number): number => {
      const t = (dbMax - db) / span;
      return top + Math.min(1, Math.max(0, t)) * plotH;
    };

    this.drawGrid(left, top, plotW, plotH, dbMin, dbMax, toY);

    // Target resolution: at most one polyline point per device pixel.
    const maxPoints = Math.max(2, Math.round(plotW * dpr));

    if (psdCompare && psdCompare.length > 0) {
      const pts = reduce(psdCompare, maxPoints);
      ctx.strokeStyle = hexToRgba(THEME.trace2, 0.4);
      ctx.lineWidth = 1;
      ctx.lineJoin = 'round';
      tracePath(ctx, pts, left, plotW, toY);
      ctx.stroke();
    }

    if (input.noiseFloorDb !== undefined) {
      const y = this.snap(toY(input.noiseFloorDb));
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = hexToRgba(THEME.warn, 0.75);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(left + plotW, y);
      ctx.stroke();
      ctx.restore();

      ctx.font = `9px ${MONO}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = hexToRgba(THEME.warn, 0.85);
      ctx.fillText('noise floor', left + 4, y - 3);
    }

    if (psd.length > 0) {
      const pts = reduce(psd, maxPoints);

      // Fill under the trace: subtle vertical fade to transparent.
      const grad = ctx.createLinearGradient(0, top, 0, bottom);
      grad.addColorStop(0, hexToRgba(THEME.trace, 0.25));
      grad.addColorStop(1, hexToRgba(THEME.trace, 0));
      tracePath(ctx, pts, left, plotW, toY);
      ctx.lineTo(left + plotW, bottom);
      ctx.lineTo(left, bottom);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.save();
      ctx.strokeStyle = THEME.trace;
      ctx.lineWidth = 1.25;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.shadowColor = hexToRgba(THEME.trace, 0.5);
      ctx.shadowBlur = 5;
      tracePath(ctx, pts, left, plotW, toY);
      ctx.stroke();
      ctx.restore();
    }

    if (input.label) {
      ctx.font = `10px ${MONO}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = THEME.textBright;
      ctx.fillText(input.label.toUpperCase(), left, cssH - 5);
    }

    ctx.strokeStyle = THEME.grid;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, Math.max(0, cssW - 1), Math.max(0, cssH - 1));
  }

  private drawGrid(
    left: number,
    top: number,
    plotW: number,
    plotH: number,
    dbMin: number,
    dbMax: number,
    toY: (db: number) => number,
  ): void {
    const { ctx } = this;
    ctx.strokeStyle = THEME.grid;
    ctx.lineWidth = 1;
    ctx.font = `9px ${MONO}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    const first = Math.ceil(dbMin / GRID_STEP_DB) * GRID_STEP_DB;
    for (let db = first; db <= dbMax; db += GRID_STEP_DB) {
      const y = this.snap(toY(db));
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(left + plotW, y);
      ctx.stroke();
      ctx.fillStyle = THEME.text;
      ctx.fillText(String(db), left - 6, y);
    }

    ctx.strokeStyle = THEME.axis;
    ctx.beginPath();
    const baseY = this.snap(top + plotH);
    ctx.moveTo(left, baseY);
    ctx.lineTo(left + plotW, baseY);
    ctx.stroke();
  }
}

/**
 * Box-average `src` down to at most `maxPoints` samples so the drawn
 * polyline never carries more vertices than the device has pixels.
 */
function reduce(src: Float64Array, maxPoints: number): Float64Array {
  const n = src.length;
  if (n <= maxPoints) return src;
  const count = Math.max(2, maxPoints);
  const out = new Float64Array(count);
  for (let j = 0; j < count; j++) {
    const start = Math.floor((j * n) / count);
    const end = Math.max(start + 1, Math.floor(((j + 1) * n) / count));
    let sum = 0;
    for (let i = start; i < end; i++) sum += src[i]!;
    out[j] = sum / (end - start);
  }
  return out;
}

/** Lay a polyline across [left, left+plotW] with y mapped through `toY`. */
function tracePath(
  ctx: CanvasRenderingContext2D,
  pts: Float64Array,
  left: number,
  plotW: number,
  toY: (db: number) => number,
): void {
  const n = pts.length;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = left + (n === 1 ? 0 : (i / (n - 1)) * plotW);
    const y = toY(pts[i]!);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
}
