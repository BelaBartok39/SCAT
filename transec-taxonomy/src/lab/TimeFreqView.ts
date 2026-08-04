/**
 * TimeFreqView — scrolling spectrogram (waterfall), newest row at the bottom.
 *
 * Pure renderer (see contracts.ts). The caller appends PSD rows across
 * frames; this view keeps an offscreen canvas holding the painted history,
 * scrolls it up by the number of NEW rows each frame, and paints only the
 * new scanlines. Progress is tracked purely from `rows.length`, so a caller
 * that resets its buffer (length shrinks) triggers a full repaint.
 */

import { THEME } from './contracts';
import type { LabView, TimeFreqInput } from './contracts';

const DPR_CAP = 2;
/** Device pixels per waterfall row. */
const ROW_H = 2;
const MONO = '"JetBrains Mono", ui-monospace, monospace';

/** Colour ramp, dark -> bright, sampled into a 256-entry LUT once. */
const RAMP: ReadonlyArray<readonly [number, string]> = [
  [0, '#0a0a16'],
  [0.34, '#1d2a6e'],
  [0.72, '#06b6d4'],
  [1, '#e0f6ff'],
];

const LUT = buildLut();

function buildLut(): Uint8Array {
  const lut = new Uint8Array(256 * 3);
  const stops = RAMP.map(([pos, hex]) => {
    const n = parseInt(hex.slice(1), 16);
    return { pos, r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  });
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let k = 0;
    while (k < stops.length - 2 && t > stops[k + 1]!.pos) k++;
    const a = stops[k]!;
    const b = stops[k + 1]!;
    const f = b.pos === a.pos ? 0 : (t - a.pos) / (b.pos - a.pos);
    const o = i * 3;
    lut[o] = a.r + (b.r - a.r) * f;
    lut[o + 1] = a.g + (b.g - a.g) * f;
    lut[o + 2] = a.b + (b.b - a.b) * f;
  }
  return lut;
}

/** '10, 10, 22' from THEME.bg, so the fade matches the panel background. */
const BG_RGB = ((): string => {
  const m = /rgba?\(([^)]+)\)/.exec(THEME.bg);
  if (!m) return '10, 10, 22';
  return m[1]!
    .split(',')
    .slice(0, 3)
    .map((s) => s.trim())
    .join(', ');
})();

function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export class TimeFreqView implements LabView<TimeFreqInput> {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private off: HTMLCanvasElement;
  private octx: CanvasRenderingContext2D;
  private rowImage: ImageData | null = null;
  private ro: ResizeObserver;
  private dpr = 1;
  private cssW = 0;
  private cssH = 0;
  /** Device-pixel size of the offscreen history buffer. */
  private devW = 0;
  private devH = 0;
  /** How many rows of the caller's array are already painted offscreen. */
  private painted = 0;
  private last: TimeFreqInput | null = null;

  constructor(private container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    container.appendChild(this.canvas);

    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('TimeFreqView: 2d context unavailable');
    this.ctx = ctx;

    this.off = document.createElement('canvas');
    const octx = this.off.getContext('2d');
    if (!octx) throw new Error('TimeFreqView: offscreen 2d context unavailable');
    this.octx = octx;

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
  }

  render(input: TimeFreqInput): void {
    this.last = input;
    this.resize();
    this.paintRows(input);
    this.compose(input);
  }

  destroy(): void {
    this.ro.disconnect();
    this.canvas.remove();
    this.off.width = 0;
    this.off.height = 0;
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
    this.devW = Math.max(1, Math.round(w * dpr));
    this.devH = Math.max(1, Math.round(h * dpr));
    this.canvas.width = this.devW;
    this.canvas.height = this.devH;
    this.off.width = this.devW;
    this.off.height = this.devH;
    this.rowImage = this.octx.createImageData(this.devW, ROW_H);
    // The offscreen history is gone; rebuild it from the caller's rows.
    this.painted = 0;
    if (this.last) {
      this.paintRows(this.last);
      this.compose(this.last);
    }
  }

  private get maxRows(): number {
    return Math.max(1, Math.floor(this.devH / ROW_H));
  }

  // — history buffer ————————————————————————————————————————————————

  /** Scroll the offscreen history and paint whatever rows are new. */
  private paintRows(input: TimeFreqInput): void {
    const { octx, devW, devH } = this;
    // Progress must come from `seq` (rows ever produced), not rows.length:
    // the caller's buffer is a rolling window whose length plateaus, which
    // would read as "no new rows" and freeze the scroll permanently.
    const total = input.seq ?? input.rows.length;
    const newRows = total - this.painted;

    // Available history in the caller's rolling buffer. If more rows were
    // produced than the buffer still holds (long pause off-screen), the
    // missing ones are unrecoverable — repaint from what we have.
    const avail = input.rows.length;
    // Caller reset (or rewound) the buffer: start over.
    const full = newRows < 0 || newRows >= this.maxRows || newRows > avail;
    if (full) {
      octx.setTransform(1, 0, 0, 1, 0, 0);
      octx.fillStyle = `rgba(${BG_RGB}, 1)`;
      octx.fillRect(0, 0, devW, devH);
    } else if (newRows === 0) {
      return;
    } else {
      // Blit the existing image up to make room at the bottom.
      octx.globalCompositeOperation = 'copy';
      octx.drawImage(this.off, 0, -newRows * ROW_H);
      octx.globalCompositeOperation = 'source-over';
    }

    const count = Math.min(full ? this.maxRows : newRows, avail);
    for (let k = 0; k < count; k++) {
      // Newest `count` rows sit at the END of the rolling buffer.
      const idx = avail - count + k;
      const row = input.rows[idx];
      const y = devH - (count - k) * ROW_H;
      if (row && row.length > 0) this.paintScanline(row, input.dbMin, input.dbMax, y);
    }
    this.painted = total;
  }

  /** Paint one PSD row as a ROW_H-tall scanline at device-y `y`. */
  private paintScanline(row: Float64Array, dbMin: number, dbMax: number, y: number): void {
    const img = this.rowImage;
    if (!img) return;
    const { devW } = this;
    const data = img.data;
    const len = row.length;
    const span = dbMax - dbMin || 1;

    for (let x = 0; x < devW; x++) {
      const bin = Math.min(len - 1, Math.floor((x * len) / devW));
      const t = (row[bin]! - dbMin) / span;
      const idx = t <= 0 ? 0 : t >= 1 ? 255 : (t * 255) | 0;
      const o = idx * 3;
      const p = x * 4;
      data[p] = LUT[o]!;
      data[p + 1] = LUT[o + 1]!;
      data[p + 2] = LUT[o + 2]!;
      data[p + 3] = 255;
    }
    // Duplicate the first scanline down through the remaining rows.
    for (let r = 1; r < ROW_H; r++) data.copyWithin(r * devW * 4, 0, devW * 4);

    this.octx.putImageData(img, 0, y);
  }

  // — composition ———————————————————————————————————————————————————

  private compose(input: TimeFreqInput): void {
    const { ctx, cssW, cssH, dpr } = this;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = THEME.bg;
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.drawImage(this.off, 0, 0, cssW, cssH);

    this.drawHops(input);

    // Age fade: the oldest rows (top) dissolve into the background.
    const fade = ctx.createLinearGradient(0, 0, 0, cssH * 0.62);
    fade.addColorStop(0, `rgba(${BG_RGB}, 0.9)`);
    fade.addColorStop(0.45, `rgba(${BG_RGB}, 0.4)`);
    fade.addColorStop(1, `rgba(${BG_RGB}, 0)`);
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, cssW, cssH * 0.62);

    if (input.predictability !== undefined) {
      const p = input.predictability;
      ctx.font = `10px ${MONO}`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillStyle = p > 0.5 ? THEME.bad : p < 0.2 ? THEME.good : THEME.warn;
      ctx.fillText(`SORTER LOCK ${(p * 100).toFixed(0)}%`, cssW - 8, 8);
    }

    if (input.label) {
      ctx.font = `10px ${MONO}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = THEME.textBright;
      ctx.fillText(input.label.toUpperCase(), 8, cssH - 7);
    }

    ctx.strokeStyle = THEME.grid;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, Math.max(0, cssW - 1), Math.max(0, cssH - 1));
  }

  /** Hop trajectory: one dot per visible row that carries a channel index. */
  private drawHops(input: TimeFreqInput): void {
    const { hopChannels, channelCount, rows } = input;
    if (!hopChannels || !channelCount || channelCount <= 0) return;

    const { ctx, cssW, dpr, devH } = this;
    const visible = Math.min(rows.length, this.maxRows);
    const total = rows.length;
    const r = 1.6;

    ctx.fillStyle = THEME.warn;
    ctx.shadowColor = hexToRgba(THEME.warn, 0.6);
    ctx.shadowBlur = 4;
    for (let d = 0; d < visible; d++) {
      const idx = total - 1 - d; // d = 0 is the newest row, at the bottom
      const ch = hopChannels[idx];
      if (ch === undefined) continue;
      const x = ((ch + 0.5) / channelCount) * cssW;
      const y = (devH - (d + 0.5) * ROW_H) / dpr;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }
}
