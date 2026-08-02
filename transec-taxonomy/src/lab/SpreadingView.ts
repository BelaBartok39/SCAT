/**
 * SpreadingView — the DSSS bookkeeping, drawn.
 *
 * Three stacked lanes on a shared time axis: the data bits, the ±1 chip
 * sequence tiled once per bit, and their product. Bit boundaries line up
 * vertically across all three, which is the whole point: one bit becomes
 * `chips.length` chips, and that ratio is the processing gain.
 *
 * A pure renderer per the LabView contract — no timers, no signal state.
 */

import { THEME } from './contracts';
import type { LabView, SpreadingInput } from './contracts';

const MONO = "'JetBrains Mono', 'Fira Code', monospace";

/** Left gutter reserved for lane labels. */
const GUTTER = 50;
const PAD_R = 8;
/** Vertical insets for the readout row and the label row. */
const PAD_T = 20;
const PAD_B = 20;
/** Fraction of a lane's height used by the waveform's half-swing. */
const SWING = 0.3;
/** Bit boundaries below this spacing (css px) read as a smear — drop them. */
const MIN_TICK_PX = 4;

export class SpreadingView implements LabView<SpreadingInput> {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private ro: ResizeObserver;
  private dpr = 0;
  private w = 0;
  private h = 0;
  /** Last frame, replayed on resize so the canvas is never left stale. */
  private last: SpreadingInput | null = null;

  constructor(private container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'lab-canvas';
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    container.appendChild(this.canvas);

    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('SpreadingView: 2d context unavailable');
    this.ctx = ctx;

    this.ro = new ResizeObserver(() => {
      if (this.syncSize() && this.last) this.draw(this.last);
    });
    this.ro.observe(container);
    this.syncSize();
  }

  render(input: SpreadingInput): void {
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

  private draw(input: SpreadingInput): void {
    const { ctx, w, h } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = THEME.bg;
    ctx.fillRect(0, 0, w, h);

    const plotX = GUTTER;
    const plotW = w - GUTTER - PAD_R;
    const laneTop = PAD_T;
    const laneSpan = h - PAD_T - PAD_B;
    const laneH = laneSpan / 3;

    const chipsPerBit = input.chips.length;
    // Cap chip density at one chip per device pixel: show only the leading
    // bits whose chips still get a pixel each.
    const maxChips = Math.max(1, Math.floor(plotW * this.dpr));
    const availableBits = Math.min(
      input.bits.length,
      chipsPerBit > 0 ? Math.floor(input.spread.length / chipsPerBit) : 0,
    );
    const bitCount =
      chipsPerBit > 0 ? Math.min(availableBits, Math.max(1, Math.floor(maxChips / chipsPerBit))) : 0;
    const chipCount = bitCount * chipsPerBit;

    if (chipCount > 0 && plotW > 4 && laneH > 6) {
      const bitW = plotW / bitCount;
      const chipW = plotW / chipCount;

      this.drawBitBoundaries(plotX, bitW, bitCount, laneTop, laneSpan);

      // — Lane 1: DATA — bits as a square wave, 0 low / 1 high.
      this.drawLane(laneTop, laneH, 'DATA', THEME.good, 2, bitCount, (b) => (input.bits[b] ? 1 : -1), plotX, bitW);

      // — Lane 2: CHIPS — the sequence tiled once per bit.
      this.drawLane(
        laneTop + laneH,
        laneH,
        'CHIPS',
        THEME.trace2,
        1.25,
        chipCount,
        (i) => (input.chips[i % chipsPerBit]! >= 0 ? 1 : -1),
        plotX,
        chipW,
      );

      // — Lane 3: SPREAD — the product, normalised to the lane swing.
      let peak = 0;
      for (let i = 0; i < chipCount; i++) peak = Math.max(peak, Math.abs(input.spread[i]!));
      const scale = peak > 0 ? 1 / peak : 0;
      this.drawLane(
        laneTop + 2 * laneH,
        laneH,
        'SPREAD',
        THEME.trace,
        1.5,
        chipCount,
        (i) => input.spread[i]! * scale,
        plotX,
        chipW,
      );
    }

    this.drawChrome(input);

    ctx.strokeStyle = THEME.grid;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
  }

  /** Faint verticals at every bit boundary, run through all three lanes. */
  private drawBitBoundaries(
    plotX: number,
    bitW: number,
    bitCount: number,
    laneTop: number,
    laneSpan: number,
  ): void {
    if (bitW < MIN_TICK_PX) return;
    const { ctx } = this;
    ctx.strokeStyle = THEME.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let b = 0; b <= bitCount; b++) {
      const x = Math.round(plotX + b * bitW) + 0.5;
      ctx.moveTo(x, laneTop);
      ctx.lineTo(x, laneTop + laneSpan);
    }
    ctx.stroke();
  }

  /**
   * One lane: a left label plus a square wave of `count` segments, each
   * `segW` wide, holding `valueAt(i)` in −1..1 across its span.
   */
  private drawLane(
    top: number,
    height: number,
    label: string,
    color: string,
    lineWidth: number,
    count: number,
    valueAt: (i: number) => number,
    plotX: number,
    segW: number,
  ): void {
    const { ctx } = this;
    const mid = top + height / 2;
    const amp = height * SWING;

    ctx.font = `9px ${MONO}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = THEME.text;
    ctx.fillText(label, 8, mid);

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = 'miter';
    ctx.lineCap = 'butt';
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const y = mid - valueAt(i) * amp;
      const x0 = plotX + i * segW;
      if (i === 0) ctx.moveTo(x0, y);
      else ctx.lineTo(x0, y); // vertical transition at the segment edge
      ctx.lineTo(x0 + segW, y);
    }
    ctx.stroke();
  }

  /** Processing-gain readout and label. */
  private drawChrome(input: SpreadingInput): void {
    const { ctx, w, h } = this;
    const gain = input.processingGainDb;

    if (Number.isFinite(gain)) {
      ctx.font = `10px ${MONO}`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = THEME.good;
      const sign = gain >= 0 ? '+' : '';
      ctx.fillText(`PROCESSING GAIN ${sign}${gain.toFixed(1)} dB`, w - 8, 11);
    }

    if (input.label) {
      ctx.font = `10px ${MONO}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = THEME.textBright;
      ctx.fillText(input.label.toUpperCase(), 8, h - 8);
    }
  }
}
