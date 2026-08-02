import { describe, it, expect } from 'vitest';
import { Channel } from './channel';
import { mulberry32 } from './rng';
import type { Rng } from './contracts';

/** Unit-power QPSK-ish buffer: `n` complex samples, all with |s| = 1. */
function qpskBuffer(n: number, rng: Rng): Float64Array {
  const iq = new Float64Array(2 * n);
  const a = Math.SQRT1_2;
  for (let i = 0; i < n; i++) {
    iq[2 * i] = rng.next() < 0.5 ? a : -a;
    iq[2 * i + 1] = rng.next() < 0.5 ? a : -a;
  }
  return iq;
}

/** Mean of I²+Q² per complex sample. */
function meanPower(iq: Float64Array): number {
  const n = iq.length >> 1;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += iq[2 * i]! ** 2 + iq[2 * i + 1]! ** 2;
  return sum / n;
}

/** Mean power of the difference of two equal-length buffers. */
function diffPower(a: Float64Array, b: Float64Array): number {
  const n = a.length >> 1;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += (a[2 * i]! - b[2 * i]!) ** 2 + (a[2 * i + 1]! - b[2 * i + 1]!) ** 2;
  }
  return sum / n;
}

function maxAbsDiff(a: Float64Array, b: Float64Array): number {
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i]! - b[i]!));
  return m;
}

const N = 4096;

describe('Channel.awgn', () => {
  it('injects noise at the requested SNR', () => {
    const clean = qpskBuffer(N, mulberry32(1));
    const noisy = Channel.awgn(clean, 10, mulberry32(7));
    // 10 dB SNR → noise power should be 1/10 of the signal power.
    const ratio = diffPower(noisy, clean) / meanPower(clean);
    expect(ratio).toBeGreaterThan(0.1 * 0.85);
    expect(ratio).toBeLessThan(0.1 * 1.15);
  });

  it('is deterministic per seed', () => {
    const clean = qpskBuffer(N, mulberry32(1));
    const a = Channel.awgn(clean, 10, mulberry32(42));
    const b = Channel.awgn(clean, 10, mulberry32(42));
    const c = Channel.awgn(clean, 10, mulberry32(43));
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(maxAbsDiff(a, c)).toBeGreaterThan(0);
  });

  it('is effectively a passthrough at very high SNR', () => {
    const clean = qpskBuffer(N, mulberry32(1));
    const noisy = Channel.awgn(clean, 100, mulberry32(7));
    expect(maxAbsDiff(noisy, clean)).toBeLessThan(1e-3);
  });

  it('returns a new buffer and leaves the input untouched', () => {
    const clean = qpskBuffer(256, mulberry32(1));
    const before = Array.from(clean);
    const noisy = Channel.awgn(clean, 10, mulberry32(7));
    expect(noisy).not.toBe(clean);
    expect(Array.from(clean)).toEqual(before);
  });
});

describe('Channel.jam', () => {
  it('barrage at 0 dB roughly doubles total power', () => {
    const clean = qpskBuffer(N, mulberry32(1));
    const jammed = Channel.jam(clean, { kind: 'barrage', powerDb: 0 }, mulberry32(9));
    const ratio = meanPower(jammed) / meanPower(clean);
    expect(ratio).toBeGreaterThan(2 * 0.8);
    expect(ratio).toBeLessThan(2 * 1.2);
  });

  it('partial-band with bandFraction 0.25 leaves the last 75% untouched', () => {
    const clean = qpskBuffer(N, mulberry32(1));
    const jammed = Channel.jam(
      clean,
      { kind: 'partial-band', powerDb: 0, bandFraction: 0.25 },
      mulberry32(9),
    );
    const cut = N / 4;
    // Jammed region actually took noise...
    expect(maxAbsDiff(jammed.subarray(0, 2 * cut), clean.subarray(0, 2 * cut))).toBeGreaterThan(0);
    // ...and the rest is bit-identical.
    expect(Array.from(jammed.subarray(2 * cut))).toEqual(Array.from(clean.subarray(2 * cut)));
  });

  it('follower with lagHops 0 jams the whole buffer, larger lag only a tail', () => {
    const clean = qpskBuffer(N, mulberry32(1));

    const tracked = Channel.jam(clean, { kind: 'follower', powerDb: 0, lagHops: 0 }, mulberry32(9));
    expect(tracked[0]).not.toBe(clean[0]);
    expect(diffPower(tracked, clean) / meanPower(clean)).toBeGreaterThan(0.8);

    // 16 hop slots per buffer, so lagHops 8 starts jamming halfway through.
    const lagged = Channel.jam(clean, { kind: 'follower', powerDb: 0, lagHops: 8 }, mulberry32(9));
    const half = N / 2;
    expect(Array.from(lagged.subarray(0, 2 * half))).toEqual(
      Array.from(clean.subarray(0, 2 * half)),
    );
    expect(maxAbsDiff(lagged.subarray(2 * half), clean.subarray(2 * half))).toBeGreaterThan(0);
    // Half the buffer hit → about half the average noise power of L = 0.
    const ratio = diffPower(lagged, clean) / diffPower(tracked, clean);
    expect(ratio).toBeGreaterThan(0.4);
    expect(ratio).toBeLessThan(0.6);
  });

  it('clamps a lag beyond the buffer to no jamming at all', () => {
    const clean = qpskBuffer(256, mulberry32(1));
    const jammed = Channel.jam(clean, { kind: 'follower', powerDb: 0, lagHops: 99 }, mulberry32(9));
    expect(Array.from(jammed)).toEqual(Array.from(clean));
  });
});

describe('Channel.artificialNoise', () => {
  it("degrades the eavesdropper's copy without touching the original", () => {
    const clean = qpskBuffer(N, mulberry32(1));
    const before = Array.from(clean);
    const eve = Channel.artificialNoise(clean, -3, mulberry32(11));

    expect(eve).not.toBe(clean);
    expect(maxAbsDiff(eve, clean)).toBeGreaterThan(0);
    expect(Array.from(clean)).toEqual(before);
    expect(meanPower(eve)).toBeGreaterThan(meanPower(clean));
  });

  it('adds noise at the requested power relative to the signal', () => {
    const clean = qpskBuffer(N, mulberry32(1));
    const eve = Channel.artificialNoise(clean, -6, mulberry32(11));
    const ratio = diffPower(eve, clean) / meanPower(clean);
    expect(ratio).toBeGreaterThan(0.25 * 0.85);
    expect(ratio).toBeLessThan(0.25 * 1.15);
  });
});

describe('Channel.spatialNullGainDb', () => {
  it('is a deep notch on-axis and transparent far off it', () => {
    expect(Channel.spatialNullGainDb(0, 30, 10)).toBeCloseTo(-30, 10);
    expect(Channel.spatialNullGainDb(50, 30, 10)).toBeGreaterThan(-0.1);
    expect(Channel.spatialNullGainDb(50, 30, 10)).toBeLessThanOrEqual(0);
  });

  it('is symmetric and monotonic away from the null', () => {
    expect(Channel.spatialNullGainDb(-7, 30, 10)).toBeCloseTo(
      Channel.spatialNullGainDb(7, 30, 10),
      12,
    );
    const gains = [0, 5, 10, 20, 40].map((t) => Channel.spatialNullGainDb(t, 30, 10));
    for (let i = 1; i < gains.length; i++) expect(gains[i]!).toBeGreaterThan(gains[i - 1]!);
  });
});

describe('Channel.beamGainDb', () => {
  it('peaks at boresight and is −3 dB at half the beamwidth', () => {
    expect(Channel.beamGainDb(0, 20, -25)).toBeCloseTo(0, 12);
    expect(Channel.beamGainDb(10, 20, -25)).toBeCloseTo(-3, 10);
    expect(Channel.beamGainDb(-10, 20, -25)).toBeCloseTo(-3, 10);
  });

  it('clamps to the sidelobe floor far off-axis', () => {
    expect(Channel.beamGainDb(90, 20, -25)).toBe(-25);
    expect(Channel.beamGainDb(180, 20, -25)).toBe(-25);
    // The floor is reached where −12·(θ/BW)² = floor, i.e. θ ≈ 28.9° here.
    expect(Channel.beamGainDb(25, 20, -25)).toBeGreaterThan(-25);
  });
});
