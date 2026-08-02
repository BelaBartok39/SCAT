import { describe, it, expect } from 'vitest';
import { Shaping } from './shaping';
import { Modulator, bitsPerSymbol } from './modulator';
import { mulberry32 } from './rng';

function sum(taps: Float64Array): number {
  let total = 0;
  for (let i = 0; i < taps.length; i++) total += taps[i]!;
  return total;
}

function expectSymmetric(taps: Float64Array): void {
  for (let i = 0; i < taps.length >> 1; i++) {
    expect(taps[i]!).toBeCloseTo(taps[taps.length - 1 - i]!, 12);
  }
}

/** Flat taps of length `sps`, normalized to Σ = 1 — a rectangular pulse. */
function rectTaps(sps: number): Float64Array {
  return new Float64Array(sps).fill(1 / sps);
}

describe('rrcTaps', () => {
  it('is centered, odd-length, symmetric and sums to 1', () => {
    const taps = Shaping.rrcTaps(0.35, 8, 4);
    expect(taps.length).toBe(8 * 4 + 1);
    expect(taps.length % 2).toBe(1);
    expectSymmetric(taps);
    expect(sum(taps)).toBeCloseTo(1, 12);

    // Peak sits at the center tap.
    const center = (taps.length - 1) / 2;
    for (let i = 0; i < taps.length; i++) {
      if (i !== center) expect(taps[center]!).toBeGreaterThan(taps[i]!);
    }
  });

  it('stays finite through both removable singularities', () => {
    // β = 0.25 puts t = ±Ts/(4β) = ±1 symbol exactly on a sample.
    for (const beta of [0, 0.001, 0.25, 0.5, 1]) {
      const taps = Shaping.rrcTaps(beta, 6, 4);
      for (let i = 0; i < taps.length; i++) expect(Number.isFinite(taps[i]!)).toBe(true);
      expect(sum(taps)).toBeCloseTo(1, 12);
    }
  });

  it('widens the mainlobe as roll-off drops', () => {
    // Lower β concentrates less energy in the center tap.
    const narrow = Shaping.rrcTaps(0.1, 10, 8);
    const wide = Shaping.rrcTaps(0.9, 10, 8);
    const center = (narrow.length - 1) / 2;
    expect(wide[center]!).toBeGreaterThan(narrow[center]!);
  });
});

describe('gaussianTaps', () => {
  it('sums to ~1 and is symmetric', () => {
    const taps = Shaping.gaussianTaps(0.5, 4, 8);
    expect(taps.length).toBe(4 * 8 + 1);
    expect(sum(taps)).toBeCloseTo(1, 12);
    expectSymmetric(taps);
  });

  it('is strictly positive and unimodal about the center', () => {
    const taps = Shaping.gaussianTaps(0.3, 4, 8);
    const center = (taps.length - 1) / 2;
    for (let i = 0; i < taps.length; i++) expect(taps[i]!).toBeGreaterThan(0);
    for (let i = 1; i <= center; i++) expect(taps[i]!).toBeGreaterThan(taps[i - 1]!);
  });

  it('narrows in time as BT grows', () => {
    const loose = Shaping.gaussianTaps(0.3, 4, 8);
    const tight = Shaping.gaussianTaps(1.0, 4, 8);
    const center = (loose.length - 1) / 2;
    expect(tight[center]!).toBeGreaterThan(loose[center]!);
  });
});

describe('shape', () => {
  it('produces symbolCount × sps interleaved samples', () => {
    const { symbols } = Modulator.modulate('qpsk', Modulator.randomBits(2 * 16, mulberry32(3)));
    const iq = Shaping.shape(symbols, Shaping.rrcTaps(0.35, 6, 4), 4);
    expect(iq.samples.length).toBe(2 * 16 * 4);
  });

  it('reproduces the symbols at the sampling instants with a unit tap', () => {
    // A single tap is the identity filter: upsampling alone, zeros between.
    const symbols = Float64Array.from([1, 0.5, -1, 0.25]);
    const iq = Shaping.shape(symbols, Float64Array.from([1]), 3);

    expect(iq.samples.length).toBe(2 * 2 * 3);
    expect(iq.samples[0]!).toBeCloseTo(1, 12);
    expect(iq.samples[1]!).toBeCloseTo(0.5, 12);
    expect(iq.samples[6]!).toBeCloseTo(-1, 12);
    expect(iq.samples[7]!).toBeCloseTo(0.25, 12);
    // The sps−1 stuffed zeros between symbols.
    for (const i of [2, 3, 4, 5, 8, 9, 10, 11]) expect(iq.samples[i]!).toBeCloseTo(0, 12);
  });

  it('keeps I and Q independent', () => {
    const symbols = Float64Array.from([1, 0, 1, 0]);
    const iq = Shaping.shape(symbols, rectTaps(4), 4);
    for (let i = 0; i < iq.samples.length >> 1; i++) {
      expect(iq.samples[2 * i + 1]!).toBeCloseTo(0, 12);
    }
  });
});

describe('papr', () => {
  it('is ~0 dB for a constant-envelope signal', () => {
    const sps = 4;
    const count = 32;
    // Every symbol the same point + a rectangular pulse ⇒ a flat envelope.
    const symbols = new Float64Array(2 * count);
    for (let s = 0; s < count; s++) {
      symbols[2 * s] = Math.SQRT1_2;
      symbols[2 * s + 1] = Math.SQRT1_2;
    }
    const iq = Shaping.shape(symbols, rectTaps(sps), sps);

    // Trim the filter's edge transient — the first and last symbol periods
    // are partially filled by construction of a finite 'same' convolution.
    const trim = 2 * sps;
    const interior = {
      samples: iq.samples.slice(2 * trim, iq.samples.length - 2 * trim),
    };
    expect(interior.samples.length).toBeGreaterThan(0);
    expect(Shaping.papr(interior)).toBeCloseTo(0, 9);
  });

  it('exceeds 0 dB for a shaped multi-amplitude 16-QAM signal', () => {
    const sps = 8;
    const bits = Modulator.randomBits(4 * 256, mulberry32(2024));
    const { symbols } = Modulator.modulate('qam16', bits);
    const iq = Shaping.shape(symbols, Shaping.rrcTaps(0.35, 8, sps), sps);

    const papr = Shaping.papr(iq);
    expect(papr).toBeGreaterThan(0);
    // RRC-shaped 16-QAM lands in the usual few-dB range, not something absurd.
    expect(papr).toBeLessThan(20);
  });

  it('is larger for 16-QAM than for QPSK under the same shaping', () => {
    const sps = 8;
    const taps = Shaping.rrcTaps(0.35, 8, sps);
    const paprOf = (kind: 'qpsk' | 'qam16') => {
      const bits = Modulator.randomBits(bitsPerSymbol(kind) * 512, mulberry32(11));
      const { symbols } = Modulator.modulate(kind, bits);
      return Shaping.papr(Shaping.shape(symbols, taps, sps));
    };
    expect(paprOf('qam16')).toBeGreaterThan(paprOf('qpsk'));
  });

  it('returns 0 for an empty or all-zero waveform', () => {
    expect(Shaping.papr({ samples: new Float64Array(0) })).toBe(0);
    expect(Shaping.papr({ samples: new Float64Array(16) })).toBe(0);
  });
});
