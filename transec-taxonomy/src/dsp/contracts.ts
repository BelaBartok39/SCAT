/**
 * DSP module contracts.
 *
 * FROZEN INTERFACE — Batch B agents implement modules against these
 * signatures; lab views and the warden consume them. All functions are
 * pure (deterministic given a seed) so they are unit-testable and the
 * lab stays reproducible.
 *
 * Conventions:
 *  - IQ buffers are interleaved Float64Array [I,Q,I,Q,...], unit-power
 *    signals target average |s|² = 1.
 *  - Sample counts, not seconds: callers own the sample-rate mapping.
 *  - Randomness ALWAYS flows through Rng — never Math.random().
 */

// ——— Shared primitives ————————————————————————————————————————————

/** Deterministic PRNG (implement as mulberry32 or similar). */
export interface Rng {
  /** Uniform [0,1). */
  next(): number;
}

export interface IQ {
  /** Interleaved I/Q samples. */
  samples: Float64Array;
}

export interface SymbolStream {
  /** Complex symbols, interleaved I/Q, one pair per symbol. */
  symbols: Float64Array;
  bitsPerSymbol: number;
  /** The source bits, for BER measurement downstream. */
  bits: Uint8Array;
}

// ——— modulator.ts ————————————————————————————————————————————————

export type ConstellationKind =
  | 'bpsk' | 'qpsk' | 'pi4dqpsk' | '8psk'
  | 'qam16' | 'qam64' | 'qam256' | 'qam4096'
  | 'apsk16' | 'apsk32'
  | 'gfsk' | 'ask';

export interface ModulatorApi {
  /** Ideal constellation points for a kind, interleaved I/Q, unit average power. */
  constellationPoints(kind: ConstellationKind): Float64Array;
  /** Map bits → symbols. bits.length must be a multiple of bitsPerSymbol. */
  modulate(kind: ConstellationKind, bits: Uint8Array): SymbolStream;
  /** Random bits from a seeded RNG. */
  randomBits(count: number, rng: Rng): Uint8Array;
  /** Hard-decision demap symbols → bits (nearest constellation point). */
  demodulate(kind: ConstellationKind, symbols: Float64Array): Uint8Array;
  /** Bit error rate between tx and rx bit arrays. */
  ber(tx: Uint8Array, rx: Uint8Array): number;
  /** Error vector magnitude (RMS, normalized) of received vs ideal. */
  evm(kind: ConstellationKind, symbols: Float64Array): number;
}

// ——— shaping.ts ——————————————————————————————————————————————————

export interface ShapingApi {
  /** Root-raised-cosine taps. span in symbols, sps = samples/symbol. */
  rrcTaps(beta: number, span: number, sps: number): Float64Array;
  /** Gaussian taps (for GFSK), bt = bandwidth-time product. */
  gaussianTaps(bt: number, span: number, sps: number): Float64Array;
  /** Upsample symbols by sps and filter → IQ waveform. */
  shape(symbols: Float64Array, taps: Float64Array, sps: number): IQ;
  /** Peak-to-average power ratio of a waveform, in dB. */
  papr(iq: IQ): number;
}

// ——— spreading.ts ————————————————————————————————————————————————

export interface SpreadingApi {
  /** ±1 PN chip sequence of given length from a seeded RNG. */
  pnSequence(length: number, rng: Rng): Int8Array;
  /** Spread each symbol by the chip sequence (DSSS). Output length = symbols × chips. */
  spread(symbols: Float64Array, chips: Int8Array): Float64Array;
  /** Despread with a candidate chip sequence; correct chips recover symbols. */
  despread(spread: Float64Array, chips: Int8Array): Float64Array;
  /** Processing gain in dB for a spreading factor. */
  processingGainDb(spreadingFactor: number): number;
}

// ——— hopping.ts ——————————————————————————————————————————————————

export interface HopPattern {
  /** Channel index per hop. */
  channels: Uint16Array;
  channelCount: number;
}

export interface HoppingApi {
  /** Public/predictable pattern (round-robin-like, as in civil AFH). */
  publicPattern(hops: number, channelCount: number): HopPattern;
  /** Keyed pseudorandom pattern (as in military EHF hopping). */
  keyedPattern(hops: number, channelCount: number, rng: Rng): HopPattern;
  /**
   * A follower/sorter tries to predict hop n+1 from hops 0..n.
   * Returns fraction of correct predictions — near 1 for public
   * patterns, near 1/channelCount for keyed ones.
   */
  predictability(pattern: HopPattern): number;
}

// ——— channel.ts ——————————————————————————————————————————————————

export type JammerKind = 'barrage' | 'partial-band' | 'follower';

export interface JammerConfig {
  kind: JammerKind;
  /** Jammer power relative to signal, dB. */
  powerDb: number;
  /** For partial-band: fraction of band hit (0..1). */
  bandFraction?: number;
  /** For follower: hops it lags behind (0 = perfect tracking). */
  lagHops?: number;
}

export interface ChannelApi {
  /** Add white Gaussian noise at the given SNR (dB) to an IQ buffer (returns new buffer). */
  awgn(iq: Float64Array, snrDb: number, rng: Rng): Float64Array;
  /** Apply a jammer to symbols spread across hop slots. */
  jam(iq: Float64Array, config: JammerConfig, rng: Rng): Float64Array;
  /**
   * Artificial noise (Goel & Negi): degrade only the eavesdropper.
   * Returns the eavesdropper's copy; the legitimate copy is untouched.
   */
  artificialNoise(iq: Float64Array, anPowerDb: number, rng: Rng): Float64Array;
  /**
   * Spatial null: attenuation experienced at angle `thetaDeg` off the
   * null direction — 0 dB far away, deep negative at the null.
   */
  spatialNullGainDb(thetaDeg: number, nullDepthDb: number, nullWidthDeg: number): number;
  /**
   * Beam gain at angle off boresight for an idealized array pattern —
   * used by both lab overlays and the 3D warden visibility model.
   */
  beamGainDb(thetaDeg: number, beamwidthDeg: number, sidelobeFloorDb: number): number;
}
