import { describe, it, expect } from 'vitest';
import { Spreading } from './spreading';
import { mulberry32 } from './rng';

/** 8 QPSK-like symbols, unit average power, interleaved I/Q. */
function qpskSymbols(): Float64Array {
  const a = Math.SQRT1_2;
  return new Float64Array([
    a, a, -a, a, -a, -a, a, -a,
    a, a, a, -a, -a, a, -a, -a,
  ]);
}

function rms(x: Float64Array): number {
  let sum = 0;
  for (let i = 0; i < x.length; i++) sum += x[i]! * x[i]!;
  return Math.sqrt(sum / x.length);
}

describe('pnSequence', () => {
  it('is deterministic for the same seed and differs across seeds', () => {
    const a = Spreading.pnSequence(64, mulberry32(0xc0de));
    const b = Spreading.pnSequence(64, mulberry32(0xc0de));
    const c = Spreading.pnSequence(64, mulberry32(0xface));

    expect(Array.from(a)).toEqual(Array.from(b));
    expect(Array.from(a)).not.toEqual(Array.from(c));
  });

  it('emits only ±1 chips', () => {
    const chips = Spreading.pnSequence(512, mulberry32(1));
    expect(chips.length).toBe(512);
    for (let i = 0; i < chips.length; i++) {
      expect(Math.abs(chips[i]!)).toBe(1);
    }
  });
});

describe('spread / despread', () => {
  it('recovers the original symbols with the correct chip sequence', () => {
    const symbols = qpskSymbols();
    const chips = Spreading.pnSequence(32, mulberry32(0xc0de));

    const chipped = Spreading.spread(symbols, chips);
    expect(chipped.length).toBe(symbols.length * chips.length);

    const recovered = Spreading.despread(chipped, chips);
    expect(recovered.length).toBe(symbols.length);
    for (let i = 0; i < symbols.length; i++) {
      expect(recovered[i]!).toBeCloseTo(symbols[i]!, 12);
    }
  });

  it('suppresses the signal when despread with an independent code', () => {
    const symbols = qpskSymbols();
    const chips = Spreading.pnSequence(32, mulberry32(0xc0de));
    const chipped = Spreading.spread(symbols, chips);

    const wrong = Spreading.pnSequence(32, mulberry32(0xface));
    const recovered = Spreading.despread(chipped, wrong);

    expect(rms(recovered)).toBeLessThan(0.3 * rms(symbols));
  });

  it('suppresses by ≈1/√L on average, not just for one lucky code', () => {
    // Cross-correlation of two independent ±1 codes has magnitude ≈ 1/√L,
    // so a single draw can be unlucky; the mean over many is the real claim.
    const symbols = qpskSymbols();
    const chips = Spreading.pnSequence(32, mulberry32(0xc0de));
    const chipped = Spreading.spread(symbols, chips);
    const reference = rms(symbols);

    let total = 0;
    const trials = 64;
    for (let t = 1; t <= trials; t++) {
      const wrong = Spreading.pnSequence(32, mulberry32(t * 7919));
      total += rms(Spreading.despread(chipped, wrong)) / reference;
    }

    expect(total / trials).toBeLessThan(0.3);
  });
});

describe('processingGainDb', () => {
  it('is 10·log10(spreading factor)', () => {
    expect(Spreading.processingGainDb(128)).toBeCloseTo(21.07, 2);
    expect(Spreading.processingGainDb(1)).toBeCloseTo(0, 12);
    expect(Spreading.processingGainDb(1024)).toBeCloseTo(30.1, 1);
  });
});
