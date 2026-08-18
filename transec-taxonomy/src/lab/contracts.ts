/**
 * Lab view contracts.
 *
 * FROZEN INTERFACE — Batch C agents implement views against these types.
 *
 * Architecture: every view is a PURE RENDERER. It owns a canvas and a
 * draw routine; it holds no timers and no signal state. The LabPanel
 * owns the single RAF loop, runs the DSP generators, and calls
 * `render(input)` with fresh data each frame. Reduced-motion then means
 * "call render once with a representative frame", and pausing costs
 * nothing. Views must tolerate render() at any cadence.
 *
 * Canvas conventions:
 *  - Constructor receives a container element; the view creates its own
 *    <canvas>, sizes it to the container via ResizeObserver, and scales
 *    for devicePixelRatio (cap 2).
 *  - Colors come from THEME below (matches the app design tokens).
 *    THEME is mutated in place when the user switches theme; read it
 *    at draw time, never cache its fields in a constructor.
 *  - Text: 10–11px "JetBrains Mono", labels uppercase, sparse.
 *  - destroy() removes the canvas and observers.
 */

export interface LabTheme {
  bg: string;
  grid: string;
  axis: string;
  text: string;
  textBright: string;
  trace: string;       // primary signal trace
  trace2: string;      // secondary trace (Q component, comparison)
  ideal: string;       // ideal constellation points
  good: string;        // legitimate receiver / pass
  bad: string;         // eavesdropper / jammer / fail
  warn: string;
}

const DARK: LabTheme = {
  bg: 'rgba(10, 10, 22, 0.92)',
  grid: 'rgba(99, 102, 241, 0.14)',
  axis: 'rgba(156, 163, 175, 0.5)',
  text: '#9ca3af',
  textBright: '#e0e0f0',
  trace: '#06b6d4',
  trace2: '#818cf8',
  ideal: '#6b7280',
  good: '#10b981',
  bad: '#f43f5e',
  warn: '#f59e0b',
};

/* Light is not an inversion. Traces darken so they carry against white,
   the grid drops to a neutral grey hairline rather than a tinted one,
   and `ideal` lightens because it sits *behind* the measured points in
   both themes and must stay the quieter of the two. */
const LIGHT: LabTheme = {
  bg: '#ffffff',
  grid: 'rgba(20, 26, 48, 0.10)',
  axis: 'rgba(20, 26, 48, 0.45)',
  text: '#6b7383',
  textBright: '#12141c',
  trace: '#0e7490',
  trace2: '#5b3fa8',
  ideal: '#a8b0c0',
  good: '#047857',
  bad: '#be123c',
  warn: '#b45309',
};

/**
 * Live palette. Mutated in place on theme change so the ~58 existing
 * `THEME.x` reads across the lab views keep working untouched; the RAF
 * loop picks up new values on its next frame.
 */
export const THEME: LabTheme = { ...DARK };

export function applyLabTheme(theme: 'dark' | 'light'): void {
  Object.assign(THEME, theme === 'light' ? LIGHT : DARK);
}

export interface LabView<TInput> {
  /** Draw one frame. Must be safe to call at any cadence, including once. */
  render(input: TInput): void;
  destroy(): void;
}

// ——— Per-view inputs ————————————————————————————————————————————————

export interface ConstellationInput {
  /** Ideal points, interleaved IQ (unit average power). */
  ideal: Float64Array;
  /** Received symbols to scatter, interleaved IQ. */
  rx: Float64Array;
  /** Optional readouts rendered in the corner. */
  evm?: number;
  berLabel?: string;
  /** Optional label, e.g. 'legitimate receiver' / 'eavesdropper'. */
  label?: string;
  /** Tint override for rx dots (defaults THEME.trace). */
  dotColor?: string;
}

export interface TimeDomainInput {
  /** Interleaved IQ waveform. */
  iq: Float64Array;
  /** Samples per symbol (marks symbol boundaries when > 0). */
  sps?: number;
  /** Show the |s(t)| envelope trace. */
  showEnvelope?: boolean;
  label?: string;
  /** Optional PAPR readout in dB. */
  paprDb?: number;
}

export interface SpectrumInput {
  /** Power spectral density in dB, DC-centered (from dsp/fft computePSD). */
  psd: Float64Array;
  /** Fixed display range in dB; views must NOT autoscale per frame. */
  dbMin: number;
  dbMax: number;
  /** Optional noise-floor line to draw, in dB. */
  noiseFloorDb?: number;
  /** Optional second PSD for comparison, dimmed. */
  psdCompare?: Float64Array;
  label?: string;
}

export interface EyeDiagramInput {
  /** Interleaved IQ waveform (I component is traced). */
  iq: Float64Array;
  /** Samples per symbol — one eye spans 2 symbol periods. */
  sps: number;
  label?: string;
}

export interface TimeFreqInput {
  /**
   * Waterfall rows, newest last. Each row is a PSD in dB (uniform length).
   * The view scrolls; callers append rows across frames.
   *
   * NOTE: this is a rolling window — its length plateaus once the buffer
   * is full, so it can NOT be used to detect new rows. Use `seq`.
   */
  rows: Float64Array[];
  /**
   * Total rows ever produced, monotonically increasing. The view diffs
   * this against its own progress to know how far to scroll. A decrease
   * (e.g. a restart resetting it to 0) triggers a full repaint.
   */
  seq?: number;
  dbMin: number;
  dbMax: number;
  /** Optional channel-index overlay per row (hop trajectory dots). */
  hopChannels?: Uint16Array;
  channelCount?: number;
  /** Predictability readout 0..1 (sorter lock quality). */
  predictability?: number;
  label?: string;
}

export interface SpreadingInput {
  /** Source data bits (0/1). */
  bits: Uint8Array;
  /** ±1 chip sequence. */
  chips: Int8Array;
  /** Spread waveform (I component, one value per chip). */
  spread: Float64Array;
  processingGainDb: number;
  label?: string;
}

// ——— Constructor shape every view module exports ————————————————————

export type LabViewCtor<TInput> = new (container: HTMLElement) => LabView<TInput>;
