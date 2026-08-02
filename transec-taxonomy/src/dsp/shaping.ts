/**
 * Pulse shaping — the filters that decide how much spectrum a waveform
 * actually occupies, and the PAPR penalty that comes with them.
 *
 * Time is measured in symbol periods (Ts = 1); callers own the mapping to
 * seconds via `sps`. Tap sets are normalized to Σtaps = 1 so a shaped
 * waveform keeps the DC gain of its symbol stream — the eye-diagram and
 * constellation views read directly in symbol units, which is what the lab
 * displays. (Note this is *not* the Σtaps² = 1 convention a matched-filter
 * receiver would want.)
 */

import type { IQ, ShapingApi } from './contracts';

/** Filters are centered, so tap counts are odd: span symbols × sps + 1. */
function tapCount(span: number, sps: number): number {
  return span * sps + 1;
}

/** Scale taps so they sum to 1. */
function normalizeSum(taps: Float64Array): Float64Array {
  let sum = 0;
  for (let i = 0; i < taps.length; i++) sum += taps[i]!;
  if (sum === 0) return taps;
  for (let i = 0; i < taps.length; i++) taps[i] = taps[i]! / sum;
  return taps;
}

export const Shaping: ShapingApi = {
  rrcTaps(beta: number, span: number, sps: number): Float64Array {
    const n = tapCount(span, sps);
    const center = (n - 1) / 2;
    const taps = new Float64Array(n);
    const eps = 1e-8;
    // The second removable singularity, at t = ±Ts/(4β); unreachable at β = 0.
    const singular = beta > 0 ? 1 / (4 * beta) : Infinity;

    for (let i = 0; i < n; i++) {
      const t = (i - center) / sps;

      if (Math.abs(t) < eps) {
        taps[i] = 1 + beta * (4 / Math.PI - 1);
      } else if (Math.abs(Math.abs(t) - singular) < eps) {
        const a = Math.PI / (4 * beta);
        taps[i] =
          (beta / Math.SQRT2) *
          ((1 + 2 / Math.PI) * Math.sin(a) + (1 - 2 / Math.PI) * Math.cos(a));
      } else {
        const numerator =
          Math.sin(Math.PI * t * (1 - beta)) +
          4 * beta * t * Math.cos(Math.PI * t * (1 + beta));
        const denominator = Math.PI * t * (1 - (4 * beta * t) ** 2);
        taps[i] = numerator / denominator;
      }
    }

    return normalizeSum(taps);
  },

  gaussianTaps(bt: number, span: number, sps: number): Float64Array {
    const n = tapCount(span, sps);
    const center = (n - 1) / 2;
    const taps = new Float64Array(n);

    // GFSK convention: the 3 dB bandwidth-time product bt fixes the pulse
    // width via σ = √(ln 2) / (2π·BT), in symbol periods.
    const sigma = Math.sqrt(Math.LN2) / (2 * Math.PI * bt);
    const denominator = 2 * sigma * sigma;

    for (let i = 0; i < n; i++) {
      const t = (i - center) / sps;
      taps[i] = Math.exp(-(t * t) / denominator);
    }

    return normalizeSum(taps);
  },

  shape(symbols: Float64Array, taps: Float64Array, sps: number): IQ {
    const symbolCount = symbols.length >> 1;
    const length = symbolCount * sps;
    const out = new Float64Array(2 * length);

    // Equivalent to zero-stuffing by sps then convolving 'same': each symbol
    // scatters the tap set into the output, centered on its own sample slot.
    const delay = (taps.length - 1) >> 1;

    for (let s = 0; s < symbolCount; s++) {
      const re = symbols[2 * s]!;
      const im = symbols[2 * s + 1]!;
      if (re === 0 && im === 0) continue;
      const base = s * sps - delay;

      for (let k = 0; k < taps.length; k++) {
        const i = base + k;
        if (i < 0) continue;
        if (i >= length) break;
        const tap = taps[k]!;
        out[2 * i] = out[2 * i]! + re * tap;
        out[2 * i + 1] = out[2 * i + 1]! + im * tap;
      }
    }

    return { samples: out };
  },

  papr(iq: IQ): number {
    const samples = iq.samples;
    const count = samples.length >> 1;
    if (count === 0) return 0;

    let peak = 0;
    let total = 0;
    for (let i = 0; i < count; i++) {
      const re = samples[2 * i]!;
      const im = samples[2 * i + 1]!;
      const power = re * re + im * im;
      total += power;
      if (power > peak) peak = power;
    }

    const mean = total / count;
    if (mean <= 0) return 0;
    return 10 * Math.log10(peak / mean);
  },
};
