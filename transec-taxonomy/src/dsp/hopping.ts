/**
 * Frequency hopping patterns and how well a follower can track them.
 *
 * The public pattern is a published affine walk — the sort of thing a
 * civil AFH map or a documented hop set gives away — so a listener that
 * has seen two hops can extrapolate the rest. The keyed pattern draws
 * each hop from a keyed RNG, leaving the follower with a blind guess.
 */

import type { HopPattern, HoppingApi, Rng } from './contracts';

/** Non-negative modulo (JS `%` keeps the sign of the dividend). */
function mod(x: number, m: number): number {
  return ((x % m) + m) % m;
}

function assertPattern(hops: number, channelCount: number): void {
  if (hops < 0) throw new Error('hopping: hops must be non-negative');
  if (channelCount < 1) throw new Error('hopping: channelCount must be at least 1');
}

/**
 * Public/predictable hop map: a fixed affine walk, channel[n] = (7n + 3)
 * mod channelCount. Constant stride, so it is trivially extrapolated.
 */
function publicPattern(hops: number, channelCount: number): HopPattern {
  assertPattern(hops, channelCount);
  const channels = new Uint16Array(hops);
  for (let n = 0; n < hops; n++) {
    channels[n] = (n * 7 + 3) % channelCount;
  }
  return { channels, channelCount };
}

/** Keyed pseudorandom hop map: each hop drawn uniformly from the RNG. */
function keyedPattern(hops: number, channelCount: number, rng: Rng): HopPattern {
  assertPattern(hops, channelCount);
  const channels = new Uint16Array(hops);
  for (let n = 0; n < hops; n++) {
    const draw = Math.floor(rng.next() * channelCount);
    // rng.next() is [0,1), but clamp so a value of exactly 1 cannot escape.
    channels[n] = Math.min(draw, channelCount - 1);
  }
  return { channels, channelCount };
}

/**
 * Constant-stride follower: having seen hops n−2 and n−1, it assumes the
 * stride holds and predicts (2·c[n−1] − c[n−2]) mod channelCount.
 * Returns the fraction of correct predictions — 1 for an affine public
 * pattern, ≈ 1/channelCount for a keyed one.
 */
function predictability(pattern: HopPattern): number {
  const { channels, channelCount } = pattern;
  const predictions = channels.length - 2;
  if (predictions <= 0) return 0;

  let correct = 0;
  for (let n = 2; n < channels.length; n++) {
    const predicted = mod(2 * channels[n - 1]! - channels[n - 2]!, channelCount);
    if (predicted === channels[n]!) correct++;
  }

  return correct / predictions;
}

export const Hopping: HoppingApi = {
  publicPattern,
  keyedPattern,
  predictability,
};
