import { describe, it, expect } from 'vitest';
import { Hopping } from './hopping';
import { mulberry32 } from './rng';

const HOPS = 256;
const CHANNELS = 79;

describe('publicPattern', () => {
  it('follows the published affine walk and stays in band', () => {
    const pattern = Hopping.publicPattern(HOPS, CHANNELS);
    expect(pattern.channels.length).toBe(HOPS);
    expect(pattern.channelCount).toBe(CHANNELS);
    for (let n = 0; n < HOPS; n++) {
      expect(pattern.channels[n]!).toBe((n * 7 + 3) % CHANNELS);
    }
  });

  it('is near-perfectly predictable to a constant-stride follower', () => {
    const pattern = Hopping.publicPattern(HOPS, CHANNELS);
    expect(Hopping.predictability(pattern)).toBeGreaterThan(0.95);
  });
});

describe('keyedPattern', () => {
  it('is deterministic given the same seed and differs across seeds', () => {
    const a = Hopping.keyedPattern(HOPS, CHANNELS, mulberry32(0x5eed));
    const b = Hopping.keyedPattern(HOPS, CHANNELS, mulberry32(0x5eed));
    const c = Hopping.keyedPattern(HOPS, CHANNELS, mulberry32(0xbeef));

    expect(Array.from(a.channels)).toEqual(Array.from(b.channels));
    expect(Array.from(a.channels)).not.toEqual(Array.from(c.channels));
  });

  it('stays within the channel set', () => {
    const pattern = Hopping.keyedPattern(HOPS, CHANNELS, mulberry32(0x5eed));
    for (let n = 0; n < HOPS; n++) {
      expect(pattern.channels[n]!).toBeGreaterThanOrEqual(0);
      expect(pattern.channels[n]!).toBeLessThan(CHANNELS);
    }
  });

  it('leaves the follower guessing (≈1/channelCount)', () => {
    const pattern = Hopping.keyedPattern(HOPS, CHANNELS, mulberry32(0x5eed));
    expect(Hopping.predictability(pattern)).toBeLessThan(0.1);
  });
});

describe('predictability', () => {
  it('returns 0 when there is nothing to predict', () => {
    expect(Hopping.predictability(Hopping.publicPattern(2, CHANNELS))).toBe(0);
    expect(Hopping.predictability(Hopping.publicPattern(0, CHANNELS))).toBe(0);
  });
});
