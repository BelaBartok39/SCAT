/**
 * Direct-sequence spread spectrum (DSSS).
 *
 * Each complex symbol is multiplied by a ±1 chip sequence, trading
 * bandwidth for processing gain. Despreading correlates against a
 * candidate sequence: the matched code integrates the symbol coherently
 * (gain L), any independent code averages to ≈ 1/√L of it.
 */

import type { Rng, SpreadingApi } from './contracts';

/** ±1 chip sequence of `length` chips, drawn from a seeded RNG. */
function pnSequence(length: number, rng: Rng): Int8Array {
  const chips = new Int8Array(length);
  for (let i = 0; i < length; i++) {
    chips[i] = rng.next() < 0.5 ? -1 : 1;
  }
  return chips;
}

/**
 * Spread interleaved IQ symbols by the chip sequence: symbol s becomes
 * chips.length chips, chip k being symbol × chips[k].
 */
function spread(symbols: Float64Array, chips: Int8Array): Float64Array {
  if (symbols.length % 2 !== 0) {
    throw new Error('spread: symbols must be interleaved I/Q (even length)');
  }
  const chipCount = chips.length;
  const symbolCount = symbols.length / 2;
  const out = new Float64Array(symbols.length * chipCount);

  for (let s = 0; s < symbolCount; s++) {
    const i = symbols[2 * s]!;
    const q = symbols[2 * s + 1]!;
    const base = 2 * s * chipCount;
    for (let k = 0; k < chipCount; k++) {
      const chip = chips[k]!;
      out[base + 2 * k] = i * chip;
      out[base + 2 * k + 1] = q * chip;
    }
  }

  return out;
}

/**
 * Correlate each block of chips.length chips against the candidate
 * sequence. The matched sequence recovers the original symbols exactly;
 * an independent one leaves ≈ 1/√L of the symbol amplitude.
 */
function despread(spreadIq: Float64Array, chips: Int8Array): Float64Array {
  const chipCount = chips.length;
  const blockLength = 2 * chipCount;
  if (spreadIq.length % blockLength !== 0) {
    throw new Error('despread: spread length must be a multiple of 2 × chips.length');
  }
  const symbolCount = spreadIq.length / blockLength;
  const out = new Float64Array(2 * symbolCount);

  for (let s = 0; s < symbolCount; s++) {
    const base = s * blockLength;
    let sumI = 0;
    let sumQ = 0;
    for (let k = 0; k < chipCount; k++) {
      const chip = chips[k]!;
      sumI += spreadIq[base + 2 * k]! * chip;
      sumQ += spreadIq[base + 2 * k + 1]! * chip;
    }
    out[2 * s] = sumI / chipCount;
    out[2 * s + 1] = sumQ / chipCount;
  }

  return out;
}

/** Processing gain in dB for a spreading factor (chips per symbol). */
function processingGainDb(spreadingFactor: number): number {
  return 10 * Math.log10(spreadingFactor);
}

export const Spreading: SpreadingApi = {
  pnSequence,
  spread,
  despread,
  processingGainDb,
};
