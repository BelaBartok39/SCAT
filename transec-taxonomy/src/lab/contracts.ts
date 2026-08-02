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
 *  - Text: 10–11px "JetBrains Mono", labels uppercase, sparse.
 *  - destroy() removes the canvas and observers.
 */

export const THEME = {
  bg: 'rgba(10, 10, 22, 0.92)',
  grid: 'rgba(99, 102, 241, 0.14)',
  axis: 'rgba(156, 163, 175, 0.5)',
  text: '#9ca3af',
  textBright: '#e0e0f0',
  trace: '#06b6d4',      // primary signal trace
  trace2: '#818cf8',     // secondary trace (Q component, comparison)
  ideal: '#6b7280',      // ideal constellation points
  good: '#10b981',       // legitimate receiver / pass
  bad: '#f43f5e',        // eavesdropper / jammer / fail
  warn: '#f59e0b',
} as const;

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
   */
  rows: Float64Array[];
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
