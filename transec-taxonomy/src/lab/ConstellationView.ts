/**
 * Constellation scatter view.
 *
 * Pure renderer per the contract in ./contracts: it owns a canvas and a draw
 * routine, holds no timers, and tolerates render() at any cadence. The IQ
 * domain is FIXED at ±1.6 (unit average power) — never autoscaled per frame,
 * because a moving scale makes the scatter jitter and destroys the read.
 */

import { THEME, type ConstellationInput, type LabView } from './contracts';

const MONO = '10px "JetBrains Mono", ui-monospace, SFMono-Regular, monospace';

/** Half-width of the displayed IQ plane, in units of nominal symbol amplitude. */
const DOMAIN = 1.6;
/** Padding between the canvas edge and the square plot area, in CSS px. */
const PAD = 16;
/** Grid rings/lines drawn inside the domain. */
const GRID_STEPS = [0.5, 1.0, 1.5];

export class ConstellationView implements LabView<ConstellationInput> {
  private readonly container: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly ro: ResizeObserver;

  private cssW = 0;
  private cssH = 0;
  private dpr = 1;

  /** Last frame, replayed on resize so a paused/reduced-motion view survives. */
  private last: ConstellationInput | null = null;

  constructor(container: HTMLElement) {
    this.container = container;

    this.canvas = document.createElement('canvas');
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    container.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d');

    this.ro = new ResizeObserver(() => {
      if (this.measure() && this.last) this.paint(this.last);
    });
    this.ro.observe(container);

    this.measure();
  }

  render(input: ConstellationInput): void {
    this.last = input;
    this.measure();
    this.paint(input);
  }

  destroy(): void {
    this.ro.disconnect();
    this.canvas.remove();
    this.last = null;
  }

  // ——— canvas plumbing ————————————————————————————————————————————————

  /** Sync backing store to container size × devicePixelRatio. True if changed. */
  private measure(): boolean {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(0, this.container.clientWidth);
    const h = Math.max(0, this.container.clientHeight);
    if (w === this.cssW && h === this.cssH && dpr === this.dpr) return false;

    this.cssW = w;
    this.cssH = h;
    this.dpr = dpr;
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
    return true;
  }

  // ——— drawing ————————————————————————————————————————————————————————

  private paint(input: ConstellationInput): void {
    const ctx = this.ctx;
    const w = this.cssW;
    const h = this.cssH;
    if (!ctx || w <= 0 || h <= 0) return;

    // All geometry below is in CSS px; the transform handles the DPR scale.
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = THEME.bg;
    ctx.fillRect(0, 0, w, h);

    ctx.lineWidth = 1;
    ctx.strokeStyle = THEME.grid;
    ctx.strokeRect(0.5, 0.5, Math.max(0, w - 1), Math.max(0, h - 1));

    const size = Math.min(w, h) - 2 * PAD;
    if (size > 8) {
      const cx = w / 2;
      const cy = h / 2;
      const scale = size / 2 / DOMAIN;
      this.drawGrid(ctx, cx, cy, size, scale);
      this.drawIdeal(ctx, input.ideal, cx, cy, scale);
      this.drawRx(ctx, input.rx, cx, cy, scale, input.dotColor ?? THEME.trace);
    }

    this.drawReadouts(ctx, input, w, h);
  }

  private drawGrid(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    size: number,
    scale: number,
  ): void {
    const half = size / 2;

    ctx.lineWidth = 1;
    ctx.strokeStyle = THEME.grid;
    ctx.beginPath();
    for (const step of GRID_STEPS) {
      const d = step * scale;
      if (d > half) continue;
      // Half-pixel offsets keep the hairlines from smearing across two rows.
      const up = Math.round(cy - d) + 0.5;
      const dn = Math.round(cy + d) + 0.5;
      const lf = Math.round(cx - d) + 0.5;
      const rt = Math.round(cx + d) + 0.5;
      ctx.moveTo(cx - half, up);
      ctx.lineTo(cx + half, up);
      ctx.moveTo(cx - half, dn);
      ctx.lineTo(cx + half, dn);
      ctx.moveTo(lf, cy - half);
      ctx.lineTo(lf, cy + half);
      ctx.moveTo(rt, cy - half);
      ctx.lineTo(rt, cy + half);
    }
    ctx.stroke();

    // Unit circle: the nominal symbol energy locus.
    ctx.beginPath();
    ctx.arc(cx, cy, scale, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = THEME.axis;
    ctx.beginPath();
    const ax = Math.round(cx) + 0.5;
    const ay = Math.round(cy) + 0.5;
    ctx.moveTo(cx - half, ay);
    ctx.lineTo(cx + half, ay);
    ctx.moveTo(ax, cy - half);
    ctx.lineTo(ax, cy + half);
    ctx.stroke();
  }

  private drawIdeal(
    ctx: CanvasRenderingContext2D,
    ideal: Float64Array,
    cx: number,
    cy: number,
    scale: number,
  ): void {
    ctx.lineWidth = 1;
    ctx.strokeStyle = THEME.ideal;
    ctx.beginPath();
    for (let k = 0; k + 1 < ideal.length; k += 2) {
      const re = ideal[k];
      const im = ideal[k + 1];
      if (re === undefined || im === undefined) break;
      if (!Number.isFinite(re) || !Number.isFinite(im)) continue;
      if (Math.abs(re) > DOMAIN || Math.abs(im) > DOMAIN) continue;
      const x = cx + re * scale;
      const y = cy - im * scale;
      ctx.moveTo(x + 3.5, y);
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    }
    ctx.stroke();
  }

  private drawRx(
    ctx: CanvasRenderingContext2D,
    rx: Float64Array,
    cx: number,
    cy: number,
    scale: number,
    color: string,
  ): void {
    if (rx.length < 2) return;
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let k = 0; k + 1 < rx.length; k += 2) {
      const re = rx[k];
      const im = rx[k + 1];
      if (re === undefined || im === undefined) break;
      if (!Number.isFinite(re) || !Number.isFinite(im)) continue;
      // Clip rather than clamp: a symbol thrown far out of the plane should
      // vanish, not pile up on the frame edge and fake a cluster.
      if (Math.abs(re) > DOMAIN || Math.abs(im) > DOMAIN) continue;
      const x = cx + re * scale;
      const y = cy - im * scale;
      ctx.moveTo(x + 2.5, y);
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.restore();
  }

  private drawReadouts(
    ctx: CanvasRenderingContext2D,
    input: ConstellationInput,
    w: number,
    h: number,
  ): void {
    ctx.font = MONO;
    ctx.textBaseline = 'top';
    ctx.fillStyle = THEME.text;

    if (input.evm !== undefined && Number.isFinite(input.evm)) {
      ctx.textAlign = 'left';
      ctx.fillText(`EVM ${(input.evm * 100).toFixed(1)}%`, 8, 7);
    }
    if (input.berLabel !== undefined && input.berLabel.length > 0) {
      ctx.textAlign = 'right';
      ctx.fillText(input.berLabel, w - 8, 7);
    }
    if (input.label !== undefined && input.label.length > 0) {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = THEME.textBright;
      ctx.fillText(input.label.toUpperCase(), 8, h - 7);
    }
  }
}
