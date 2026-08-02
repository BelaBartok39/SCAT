import { describe, it, expect } from 'vitest';
import { Modulator, bitsPerSymbol } from './modulator';
import { mulberry32 } from './rng';
import type { ConstellationKind } from './contracts';

const ALL_KINDS: ConstellationKind[] = [
  'bpsk', 'qpsk', 'pi4dqpsk', '8psk',
  'qam16', 'qam64', 'qam256', 'qam4096',
  'apsk16', 'apsk32',
  'gfsk', 'ask',
];

/** Mean |s|² of an interleaved point/symbol set. */
function averagePower(points: Float64Array): number {
  const count = points.length >> 1;
  let total = 0;
  for (let i = 0; i < count; i++) {
    total += points[2 * i]! ** 2 + points[2 * i + 1]! ** 2;
  }
  return total / count;
}

/** Phase of each point in degrees, wrapped to [0, 360). */
function phasesDeg(points: Float64Array): number[] {
  const out: number[] = [];
  for (let i = 0; i < points.length >> 1; i++) {
    const deg = (Math.atan2(points[2 * i + 1]!, points[2 * i]!) * 180) / Math.PI;
    out.push((deg + 360) % 360);
  }
  return out;
}

describe('constellationPoints', () => {
  it('places QPSK on the unit circle at 45/135/225/315°', () => {
    const points = Modulator.constellationPoints('qpsk');
    expect(points.length).toBe(8);

    for (let i = 0; i < 4; i++) {
      const magnitude = Math.hypot(points[2 * i]!, points[2 * i + 1]!);
      expect(magnitude).toBeCloseTo(1, 12);
    }

    const phases = phasesDeg(points).sort((a, b) => a - b);
    expect(phases.length).toBe(4);
    [45, 135, 225, 315].forEach((expected, i) => {
      expect(phases[i]!).toBeCloseTo(expected, 9);
    });
  });

  it('lays 16-QAM out as a 4×4 grid with unit average power', () => {
    const points = Modulator.constellationPoints('qam16');
    expect(points.length).toBe(32);

    const round = (v: number) => v.toFixed(9);
    const iLevels = new Set<string>();
    const qLevels = new Set<string>();
    const seen = new Set<string>();
    for (let i = 0; i < 16; i++) {
      iLevels.add(round(points[2 * i]!));
      qLevels.add(round(points[2 * i + 1]!));
      seen.add(`${round(points[2 * i]!)},${round(points[2 * i + 1]!)}`);
    }

    expect(iLevels.size).toBe(4);
    expect(qLevels.size).toBe(4);
    // A full grid: every (I, Q) combination appears exactly once.
    expect(seen.size).toBe(16);

    expect(averagePower(points)).toBeCloseTo(1, 9);
  });

  it('normalizes every constellation to unit average power', () => {
    for (const kind of ALL_KINDS) {
      expect(averagePower(Modulator.constellationPoints(kind))).toBeCloseTo(1, 9);
    }
  });

  it('sizes each point set to its bit width (π/4-DQPSK carries 8 positions)', () => {
    for (const kind of ALL_KINDS) {
      const count = Modulator.constellationPoints(kind).length >> 1;
      const expected = kind === 'pi4dqpsk' ? 8 : 1 << bitsPerSymbol(kind);
      expect(count).toBe(expected);
    }
  });

  it('puts BPSK/GFSK on the I axis and ASK at 0 and √2', () => {
    for (const kind of ['bpsk', 'gfsk'] as ConstellationKind[]) {
      expect(Array.from(Modulator.constellationPoints(kind))).toEqual([1, 0, -1, 0]);
    }
    const ask = Modulator.constellationPoints('ask');
    expect(ask[0]!).toBeCloseTo(0, 12);
    expect(ask[2]!).toBeCloseTo(Math.SQRT2, 12);
  });

  it('builds APSK as concentric rings with the DVB-S2 radius ratios', () => {
    const radii = (kind: ConstellationKind) => {
      const points = Modulator.constellationPoints(kind);
      const out: number[] = [];
      for (let i = 0; i < points.length >> 1; i++) {
        out.push(Math.hypot(points[2 * i]!, points[2 * i + 1]!));
      }
      return out;
    };

    const r16 = radii('apsk16');
    expect(r16[4]! / r16[0]!).toBeCloseTo(3.15, 9);

    const r32 = radii('apsk32');
    expect(r32[4]! / r32[0]!).toBeCloseTo(2.84, 9);
    expect(r32[16]! / r32[0]!).toBeCloseTo(5.27, 9);
  });

  it('hands back a copy, so callers cannot corrupt the cache', () => {
    const first = Modulator.constellationPoints('qpsk');
    first[0] = 99;
    expect(Modulator.constellationPoints('qpsk')[0]!).not.toBe(99);
  });
});

describe('modulate / demodulate', () => {
  it('recovers the exact bits over a noiseless channel', () => {
    for (const kind of ALL_KINDS) {
      const rng = mulberry32(0xc0ffee);
      const bits = Modulator.randomBits(bitsPerSymbol(kind) * 200, rng);
      const tx = Modulator.modulate(kind, bits);

      expect(tx.bitsPerSymbol).toBe(bitsPerSymbol(kind));
      expect(tx.symbols.length).toBe(2 * 200);

      const rx = Modulator.demodulate(kind, tx.symbols);
      expect(rx.length).toBe(bits.length);
      expect(Array.from(rx)).toEqual(Array.from(bits));
      expect(Modulator.ber(bits, rx)).toBe(0);
    }
  });

  it('round-trips QPSK, 16-QAM and 64-QAM specifically', () => {
    for (const kind of ['qpsk', 'qam16', 'qam64'] as ConstellationKind[]) {
      const rng = mulberry32(7);
      const bits = Modulator.randomBits(bitsPerSymbol(kind) * 512, rng);
      const rx = Modulator.demodulate(kind, Modulator.modulate(kind, bits).symbols);
      expect(Modulator.ber(bits, rx)).toBe(0);
    }
  });

  it('rejects a bit count that is not a whole number of symbols', () => {
    expect(() => Modulator.modulate('qam16', new Uint8Array(6))).toThrow(/multiple of 4/);
  });

  it('keeps modulated symbols on the constellation', () => {
    const rng = mulberry32(42);
    const bits = Modulator.randomBits(4 * 64, rng);
    const { symbols } = Modulator.modulate('qam16', bits);
    expect(averagePower(symbols)).toBeGreaterThan(0.5);
    expect(Modulator.evm('qam16', symbols)).toBeCloseTo(0, 12);
  });
});

describe('randomBits', () => {
  it('is deterministic per seed and emits only 0/1', () => {
    const a = Modulator.randomBits(256, mulberry32(99));
    const b = Modulator.randomBits(256, mulberry32(99));
    expect(Array.from(a)).toEqual(Array.from(b));
    for (const bit of a) expect(bit === 0 || bit === 1).toBe(true);
    // Not a constant stream.
    expect(new Set(a).size).toBe(2);
  });
});

describe('ber', () => {
  it('is 0 for identical arrays and 1 for inverted ones', () => {
    const rng = mulberry32(1234);
    const tx = Modulator.randomBits(1000, rng);
    const inverted = Uint8Array.from(tx, (b) => (b ^ 1) as 0 | 1);

    expect(Modulator.ber(tx, tx)).toBe(0);
    expect(Modulator.ber(tx, inverted)).toBe(1);
  });

  it('compares over the shorter array when lengths differ', () => {
    const tx = Uint8Array.from([1, 0, 1, 0, 1, 1]);
    const rx = Uint8Array.from([1, 0, 0, 0]);
    expect(Modulator.ber(tx, rx)).toBeCloseTo(0.25, 12);
    expect(Modulator.ber(new Uint8Array(0), rx)).toBe(0);
  });
});

describe('evm', () => {
  it('is ~0 for ideal symbols and grows with the error vector', () => {
    for (const kind of ALL_KINDS) {
      const ideal = Modulator.constellationPoints(kind);
      expect(Modulator.evm(kind, ideal)).toBeCloseTo(0, 12);
    }

    const points = Modulator.constellationPoints('qpsk');
    const nudged = Float64Array.from(points, (v, i) => (i % 2 === 0 ? v + 0.1 : v));
    // Reference RMS is 1 for a unit-power constellation, so EVM is the
    // RMS error vector itself: 0.1 on I for every symbol.
    expect(Modulator.evm('qpsk', nudged)).toBeCloseTo(0.1, 9);
  });

  it('returns 0 for an empty symbol buffer', () => {
    expect(Modulator.evm('qpsk', new Float64Array(0))).toBe(0);
  });
});
