/**
 * TimeDomainView — I/Q waveform against time.
 *
 * A pure renderer per the LabView contract: it owns a canvas and a draw
 * routine, holds no timers and no signal state. The y domain is fixed at
 * ±1.8 so amplitude changes between schemes are visible rather than
 * normalised away — a constant-envelope scheme and a high-PAPR one must
 * look different at the same scale.
 */

import { THEME } from './contracts';
import type { LabView, TimeDomainInput } from './contracts';

const MONO = "'JetBrains Mono', 'Fira Code', monospace";

/** Fixed vertical domain; never autoscaled per frame. */
const Y_DOMAIN = 1.8;
/** Vertical inset reserved for the readout / label rows. */
const PAD_Y = 16;
/** Symbol ticks below this spacing (css px) read as a smear — drop them. */
const MIN_TICK_PX = 3;

export class TimeDomainView implements LabView<TimeDomainInput> {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private ro: ResizeObserver;
  private dpr = 0;
  private w = 0;
  private h = 0;
  /** Last frame, replayed on resize so the canvas is never left stale. */
  private last: TimeDomainInput | null = null;

  constructor(private container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'lab-canvas';
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    container.appendChild(this.canvas);

    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('TimeDomainView: 2d context unavailable');
    this.ctx = ctx;

    this.ro = new ResizeObserver(() => {
      if (this.syncSize() && this.last) this.draw(this.last);
    });
    this.ro.observe(container);
    this.syncSize();
  }

  render(input: TimeDomainInput): void {
    this.last = input;
    this.syncSize();
    this.draw(input);
  }

  destroy(): void {
    this.ro.disconnect();
    this.canvas.remove();
    this.last = null;
  }

  /**
   * Match the backing store to the container and the current DPR.
   * Returns true when the geometry changed. Called from render() too, so a
   * DPR change (browser zoom, monitor switch) is picked up without a
   * resize event.
   */
  private syncSize(): boolean {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    if (w === this.w && h === this.h && dpr === this.dpr) return false;
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
    return true;
  }

  private draw(input: TimeDomainInput): void {
    const { ctx, w, h } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = THEME.bg;
    ctx.fillRect(0, 0, w, h);

    const n = Math.floor(input.iq.length / 2);
    const midY = h / 2;
    const halfH = Math.max(4, h / 2 - PAD_Y);
    const yOf = (v: number): number => midY - (v / Y_DOMAIN) * halfH;
    const xOf = (i: number): number => (n > 1 ? (i / (n - 1)) * w : w / 2);

    if (n > 1 && w > 2) {
      this.drawSymbolTicks(n, input.sps ?? 0, xOf);
      if (input.showEnvelope) this.drawEnvelope(input.iq, n, xOf, yOf);

      // Zero axis, under the traces.
      ctx.strokeStyle = THEME.axis;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, Math.round(midY) + 0.5);
      ctx.lineTo(w, Math.round(midY) + 0.5);
      ctx.stroke();

      // Q first so I reads as the foreground trace.
      ctx.globalAlpha = 0.7;
      this.drawComponent(input.iq, n, 1, THEME.trace2, xOf, yOf);
      ctx.globalAlpha = 1;
      this.drawComponent(input.iq, n, 0, THEME.trace, xOf, yOf);
    }

    this.drawChrome(input);

    // 1px inner border last, so no trace bleeds over the frame.
    ctx.strokeStyle = THEME.grid;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
  }

  /** Faint verticals at symbol boundaries, every `sps` samples. */
  private drawSymbolTicks(n: number, sps: number, xOf: (i: number) => number): void {
    if (sps <= 0) return;
    const spacing = (sps / (n - 1)) * this.w;
    if (spacing < MIN_TICK_PX) return; // too dense to be legible

    const { ctx } = this;
    ctx.strokeStyle = THEME.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = sps; i < n; i += sps) {
      const x = Math.round(xOf(i)) + 0.5;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.h);
    }
    ctx.stroke();
  }

  /** Soft ±|s(t)| band: filled interior with a thin outline on both edges. */
  private drawEnvelope(
    iq: Float64Array,
    n: number,
    xOf: (i: number) => number,
    yOf: (v: number) => number,
  ): void {
    const { ctx } = this;
    const env = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const re = iq[2 * i]!;
      const im = iq[2 * i + 1]!;
      env[i] = Math.hypot(re, im);
    }

    ctx.beginPath();
    for (let i = 0; i < n; i++) ctx.lineTo(xOf(i), yOf(env[i]!));
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(xOf(i), yOf(-env[i]!));
    ctx.closePath();
    ctx.fillStyle = THEME.textBright;
    ctx.globalAlpha = 0.08;
    ctx.fill();

    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = THEME.textBright;
    ctx.lineWidth = 1;
    for (const sign of [1, -1]) {
      ctx.beginPath();
      for (let i = 0; i < n; i++) ctx.lineTo(xOf(i), yOf(sign * env[i]!));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /** Polyline over one interleaved component (`offset` 0 = I, 1 = Q). */
  private drawComponent(
    iq: Float64Array,
    n: number,
    offset: number,
    color: string,
    xOf: (i: number) => number,
    yOf: (v: number) => number,
  ): void {
    const { ctx } = this;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < n; i++) ctx.lineTo(xOf(i), yOf(iq[2 * i + offset]!));
    ctx.stroke();
  }

  /** Legend chips, PAPR readout, label. */
  private drawChrome(input: TimeDomainInput): void {
    const { ctx, w, h } = this;

    // — Legend chips, top-left —
    ctx.font = `9px ${MONO}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 1.4;
    const chipY = 11;
    let chipX = 8;
    for (const [label, color] of [
      ['I', THEME.trace],
      ['Q', THEME.trace2],
    ] as const) {
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(chipX, chipY);
      ctx.lineTo(chipX + 8, chipY);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.fillText(label, chipX + 11, chipY + 0.5);
      chipX += 11 + ctx.measureText(label).width + 8;
    }

    // — PAPR readout, top-right —
    if (input.paprDb !== undefined && Number.isFinite(input.paprDb)) {
      ctx.font = `10px ${MONO}`;
      ctx.textAlign = 'right';
      ctx.fillStyle = THEME.textBright;
      ctx.fillText(`PAPR ${input.paprDb.toFixed(1)} dB`, w - 8, chipY + 0.5);
    }

    // — Label, bottom-left —
    if (input.label) {
      ctx.font = `10px ${MONO}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = THEME.textBright;
      ctx.fillText(input.label.toUpperCase(), 8, h - 8);
    }
  }
}
