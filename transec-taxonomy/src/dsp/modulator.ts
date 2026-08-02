/**
 * Digital modulator — constellation geometry, bit mapping, hard-decision
 * demapping and the two link-quality metrics the lab plots (EVM, BER).
 *
 * Every constellation is normalized to unit average power (mean |s|² = 1)
 * so SNR settings in channel.ts mean the same thing across kinds.
 */

import type { ConstellationKind, ModulatorApi, Rng, SymbolStream } from './contracts';

// ——— Bit widths ——————————————————————————————————————————————————

const BITS_PER_SYMBOL: Record<ConstellationKind, number> = {
  bpsk: 1,
  qpsk: 2,
  pi4dqpsk: 2,
  '8psk': 3,
  qam16: 4,
  qam64: 6,
  qam256: 8,
  qam4096: 12,
  apsk16: 4,
  apsk32: 5,
  gfsk: 1,
  ask: 1,
};

/** Bits carried by one symbol of `kind`. */
export function bitsPerSymbol(kind: ConstellationKind): number {
  return BITS_PER_SYMBOL[kind];
}

// ——— Geometry helpers ————————————————————————————————————————————

/** Gray → binary, the inverse of `p ^ (p >>> 1)`. */
function grayToBinary(gray: number, bits: number): number {
  let b = gray;
  for (let shift = 1; shift < bits; shift <<= 1) b ^= b >>> shift;
  return b;
}

/** Scale an interleaved point set so its mean |s|² is exactly 1. */
function normalizePower(points: Float64Array): Float64Array {
  const count = points.length >> 1;
  let power = 0;
  for (let i = 0; i < count; i++) {
    const re = points[2 * i]!;
    const im = points[2 * i + 1]!;
    power += re * re + im * im;
  }
  const scale = power > 0 ? Math.sqrt(count / power) : 1;
  for (let i = 0; i < points.length; i++) points[i] = points[i]! * scale;
  return points;
}

/**
 * Square QAM on a Gray-coded 2^(m/2) × 2^(m/2) grid. The high half of the
 * symbol index drives I, the low half drives Q; each half is Gray-decoded
 * to a lattice position so horizontally/vertically adjacent points differ
 * in exactly one bit.
 */
function squareQam(bits: number): Float64Array {
  const half = bits >> 1;
  const levels = 1 << half;
  const size = 1 << bits;
  const points = new Float64Array(2 * size);
  const mask = levels - 1;

  for (let v = 0; v < size; v++) {
    const posI = grayToBinary(v >>> half, half);
    const posQ = grayToBinary(v & mask, half);
    // (levels-1) - 2p keeps symbol 0 in the first quadrant, matching the
    // conventional "amplitude = 1 - 2b" mapping used for BPSK/QPSK.
    points[2 * v] = levels - 1 - 2 * posI;
    points[2 * v + 1] = levels - 1 - 2 * posQ;
  }
  return normalizePower(points);
}

/** Concentric PSK rings: `counts[i]` points on a ring of radius `radii[i]`. */
function apskRings(counts: number[], radii: number[]): Float64Array {
  let total = 0;
  for (const c of counts) total += c;
  const points = new Float64Array(2 * total);

  let index = 0;
  for (let r = 0; r < counts.length; r++) {
    const count = counts[r]!;
    const radius = radii[r]!;
    // Half-step offset keeps rings from lining up radially.
    const offset = Math.PI / count;
    for (let k = 0; k < count; k++) {
      const angle = offset + (2 * Math.PI * k) / count;
      points[2 * index] = radius * Math.cos(angle);
      points[2 * index + 1] = radius * Math.sin(angle);
      index++;
    }
  }
  return normalizePower(points);
}

/** The 8 phase positions π/4-DQPSK walks between (a differential alphabet). */
function pi4Positions(): Float64Array {
  const points = new Float64Array(16);
  for (let k = 0; k < 8; k++) {
    const angle = (Math.PI * k) / 4;
    points[2 * k] = Math.cos(angle);
    points[2 * k + 1] = Math.sin(angle);
  }
  return points;
}

/**
 * Gray-coded differential phase steps, in units of π/4:
 * 00 → +π/4, 01 → +3π/4, 11 → −3π/4, 10 → −π/4.
 */
const PI4_STEP = [1, 3, 7, 5];
/** Inverse of PI4_STEP; even steps (only reachable under noise) fall to a neighbour. */
const PI4_STEP_TO_DIBIT = [0, 0, 1, 1, 3, 3, 2, 2];

function buildConstellation(kind: ConstellationKind): Float64Array {
  switch (kind) {
    case 'bpsk':
    case 'gfsk':
      // GFSK is treated as 2-FSK: the two tone symbols land on the I axis.
      return Float64Array.from([1, 0, -1, 0]);
    case 'ask':
      // 2-ASK / OOK: mean power of {0, 2} is 1.
      return Float64Array.from([0, 0, Math.SQRT2, 0]);
    case 'qpsk':
      return squareQam(2);
    case 'qam16':
      return squareQam(4);
    case 'qam64':
      return squareQam(6);
    case 'qam256':
      return squareQam(8);
    case 'qam4096':
      return squareQam(12);
    case 'pi4dqpsk':
      return pi4Positions();
    case '8psk': {
      const points = new Float64Array(16);
      for (let v = 0; v < 8; v++) {
        const angle = (2 * Math.PI * grayToBinary(v, 3)) / 8;
        points[2 * v] = Math.cos(angle);
        points[2 * v + 1] = Math.sin(angle);
      }
      return points;
    }
    case 'apsk16':
      // DVB-S2 4+12 APSK, outer/inner radius ratio γ = 3.15.
      return apskRings([4, 12], [1, 3.15]);
    case 'apsk32':
      // DVB-S2 4+12+16 APSK, radius ratios 2.84 and 5.27.
      return apskRings([4, 12, 16], [1, 2.84, 5.27]);
  }
}

/** Constellations are immutable and reused, so build each kind once. */
const constellationCache = new Map<ConstellationKind, Float64Array>();

function pointsOf(kind: ConstellationKind): Float64Array {
  let points = constellationCache.get(kind);
  if (!points) {
    points = buildConstellation(kind);
    constellationCache.set(kind, points);
  }
  return points;
}

/** Index of the constellation point closest to (re, im). */
function nearestIndex(points: Float64Array, re: number, im: number): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < points.length >> 1; i++) {
    const dre = re - points[2 * i]!;
    const dim = im - points[2 * i + 1]!;
    const dist = dre * dre + dim * dim;
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

// ——— API ——————————————————————————————————————————————————————————

export const Modulator: ModulatorApi = {
  constellationPoints(kind: ConstellationKind): Float64Array {
    // Copy so callers cannot corrupt the cached geometry.
    return Float64Array.from(pointsOf(kind));
  },

  modulate(kind: ConstellationKind, bits: Uint8Array): SymbolStream {
    const m = BITS_PER_SYMBOL[kind];
    if (bits.length % m !== 0) {
      throw new Error(`${kind}: bit count ${bits.length} is not a multiple of ${m}`);
    }

    const points = pointsOf(kind);
    const count = bits.length / m;
    const symbols = new Float64Array(2 * count);

    if (kind === 'pi4dqpsk') {
      // Differential: the transmitted phase accumulates, so the same dibit
      // maps to a different point depending on where the walk currently is.
      let position = 0;
      for (let s = 0; s < count; s++) {
        const dibit = (bits[2 * s]! << 1) | bits[2 * s + 1]!;
        position = (position + PI4_STEP[dibit]!) & 7;
        symbols[2 * s] = points[2 * position]!;
        symbols[2 * s + 1] = points[2 * position + 1]!;
      }
      return { symbols, bitsPerSymbol: m, bits };
    }

    for (let s = 0; s < count; s++) {
      let value = 0;
      for (let b = 0; b < m; b++) value = (value << 1) | bits[s * m + b]!;
      symbols[2 * s] = points[2 * value]!;
      symbols[2 * s + 1] = points[2 * value + 1]!;
    }
    return { symbols, bitsPerSymbol: m, bits };
  },

  randomBits(count: number, rng: Rng): Uint8Array {
    const bits = new Uint8Array(count);
    for (let i = 0; i < count; i++) bits[i] = rng.next() < 0.5 ? 0 : 1;
    return bits;
  },

  demodulate(kind: ConstellationKind, symbols: Float64Array): Uint8Array {
    const m = BITS_PER_SYMBOL[kind];
    const points = pointsOf(kind);
    const count = symbols.length >> 1;
    const bits = new Uint8Array(count * m);

    if (kind === 'pi4dqpsk') {
      // Quantize to the nearest of the 8 positions, then read off the step.
      let previous = 0;
      for (let s = 0; s < count; s++) {
        const position = nearestIndex(points, symbols[2 * s]!, symbols[2 * s + 1]!);
        const step = (position - previous) & 7;
        previous = position;
        const dibit = PI4_STEP_TO_DIBIT[step]!;
        bits[2 * s] = (dibit >> 1) & 1;
        bits[2 * s + 1] = dibit & 1;
      }
      return bits;
    }

    for (let s = 0; s < count; s++) {
      const value = nearestIndex(points, symbols[2 * s]!, symbols[2 * s + 1]!);
      for (let b = 0; b < m; b++) bits[s * m + b] = (value >> (m - 1 - b)) & 1;
    }
    return bits;
  },

  ber(tx: Uint8Array, rx: Uint8Array): number {
    const n = Math.min(tx.length, rx.length);
    if (n === 0) return 0;
    let errors = 0;
    for (let i = 0; i < n; i++) if (tx[i] !== rx[i]) errors++;
    return errors / n;
  },

  evm(kind: ConstellationKind, symbols: Float64Array): number {
    const count = symbols.length >> 1;
    if (count === 0) return 0;

    const points = pointsOf(kind);
    const pointCount = points.length >> 1;

    let errorPower = 0;
    for (let s = 0; s < count; s++) {
      const re = symbols[2 * s]!;
      const im = symbols[2 * s + 1]!;
      const i = nearestIndex(points, re, im);
      const dre = re - points[2 * i]!;
      const dim = im - points[2 * i + 1]!;
      errorPower += dre * dre + dim * dim;
    }

    let referencePower = 0;
    for (let i = 0; i < pointCount; i++) {
      const re = points[2 * i]!;
      const im = points[2 * i + 1]!;
      referencePower += re * re + im * im;
    }

    const reference = Math.sqrt(referencePower / pointCount);
    if (reference === 0) return 0;
    return Math.sqrt(errorPower / count) / reference;
  },
};
