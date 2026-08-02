/**
 * Eye diagram view.
 *
 * Pure renderer per the contract in ./contracts. The I component is folded
 * over 2-symbol windows (step = sps) and every window is overlaid at low
 * alpha; the eye opening is the negative space that emerges from the pile.
 * The y domain is FIXED at ±1.8 — never autoscaled per frame.
 */

import { THEME, type EyeDiagramInput, type LabView } from './contracts';

const MONO = '10px "JetBrains Mono", ui-monospace, SFMono-Regular, monospace';

/** Half-height of the displayed amplitude range. */
const Y_DOMAIN = 1.8;
/** Padding between the canvas edge and the plot area, in CSS px. */
const PAD_X = 14;
const PAD_Y = 16;
/** Per-trace alpha — low enough that density, not any one window, reads. */
const TRACE_ALPHA = 0.16;

export class EyeDiagramView implements LabView<EyeDiagramInput> {
  private readonly container: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly ro: ResizeObserver;

  private cssW = 0;
  private cssH = 0;
  private dpr = 1;

  /** Last frame, replayed on resize so a paused/reduced-motion view survives. */
  private last: EyeDiagramInput | null = null;

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

  render(input: EyeDiagramInput): void {
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

  private paint(input: EyeDiagramInput): void {
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

    const plotW = w - 2 * PAD_X;
    const plotH = h - 2 * PAD_Y;
    if (plotW > 8 && plotH > 8) {
      const left = PAD_X;
      const top = PAD_Y;
      const mid = top + plotH / 2;
      this.drawAxes(ctx, left, top, plotW, plotH, mid);
      this.drawTraces(ctx, input, left, plotW, plotH, mid);
    }

    if (input.label !== undefined && input.label.length > 0) {
      ctx.font = MONO;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = THEME.textBright;
      ctx.fillText(input.label.toUpperCase(), 8, h - 7);
    }
  }

  private drawAxes(
    ctx: CanvasRenderingContext2D,
    left: number,
    top: number,
    plotW: number,
    plotH: number,
    mid: number,
  ): void {
    ctx.save();
    ctx.lineWidth = 1;

    // Sampling instant: the eye is widest open at the centre of the window.
    ctx.strokeStyle = THEME.axis;
    ctx.globalAlpha = 0.55;
    ctx.setLineDash([3, 3]);
    const cx = Math.round(left + plotW / 2) + 0.5;
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(cx, top + plotH);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    const zero = Math.round(mid) + 0.5;
    ctx.beginPath();
    ctx.moveTo(left, zero);
    ctx.lineTo(left + plotW, zero);
    ctx.stroke();

    ctx.restore();
  }

  private drawTraces(
    ctx: CanvasRenderingContext2D,
    input: EyeDiagramInput,
    left: number,
    plotW: number,
    plotH: number,
    mid: number,
  ): void {
    const sps = Math.floor(input.sps);
    if (!Number.isFinite(sps) || sps < 1) return;

    const span = 2 * sps; // one eye = two symbol periods
    const iq = input.iq;
    const n = iq.length >> 1; // I-component sample count
    if (n < span || span < 2) return;

    const dx = plotW / (span - 1);
    const yScale = plotH / 2 / Y_DOMAIN;

    ctx.save();
    // Clip to the plot box so excursions past ±1.8 don't bleed over the frame.
    ctx.beginPath();
    ctx.rect(left, mid - plotH / 2, plotW, plotH);
    ctx.clip();

    ctx.globalAlpha = TRACE_ALPHA;
    ctx.strokeStyle = THEME.trace;
    ctx.lineWidth = 1;
    ctx.lineJoin = 'round';

    // One stroke PER window, not one path for all of them: alpha only
    // accumulates across separate composites, and that accumulation is the
    // whole point — it's what turns the pile of traces into an eye.
    for (let start = 0; start + span <= n; start += sps) {
      ctx.beginPath();
      for (let j = 0; j < span; j++) {
        const v = iq[(start + j) * 2];
        if (v === undefined) break;
        const x = left + j * dx;
        const y = mid - (Number.isFinite(v) ? v : 0) * yScale;
        if (j === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
}
