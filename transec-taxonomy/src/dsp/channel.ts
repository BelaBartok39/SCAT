/**
 * channel.ts — propagation impairments and adversary models.
 *
 * Every function is pure: buffers are never mutated in place, and all
 * randomness flows through the seeded `Rng` so lab runs replay exactly.
 * Buffers are interleaved [I,Q,I,Q,...]; "signal power" throughout means
 * the mean of I²+Q² over the complex samples of the buffer itself, so a
 * caller never has to tell us what power it thinks it transmitted.
 */

import type { ChannelApi, JammerConfig, Rng } from './contracts';
import { gaussian } from './rng';

/**
 * Hop slots assumed to fit in one IQ buffer, for the follower jammer's
 * timing model. The lab hands the channel a buffer that stands in for one
 * dwell window; 16 slots is the convention shared with hopping.ts.
 */
const HOP_SLOTS_PER_BUFFER = 16;

/** Mean power of an interleaved buffer: average of I²+Q² per complex sample. */
function meanPower(iq: Float64Array): number {
  const n = iq.length >> 1;
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const re = iq[2 * i]!;
    const im = iq[2 * i + 1]!;
    sum += re * re + im * im;
  }
  return sum / n;
}

function dbToLinear(db: number): number {
  return Math.pow(10, db / 10);
}

/**
 * Add circularly-symmetric complex Gaussian noise of total power
 * `noisePower` per complex sample to `out`, over complex samples
 * [startSample, endSample). Power splits evenly across I and Q, so each
 * real dimension gets variance noisePower/2.
 */
function addComplexNoise(
  out: Float64Array,
  noisePower: number,
  startSample: number,
  endSample: number,
  rng: Rng,
): void {
  if (!(noisePower > 0)) return;
  const sigma = Math.sqrt(noisePower / 2);
  for (let i = startSample; i < endSample; i++) {
    out[2 * i] = out[2 * i]! + gaussian(rng) * sigma;
    out[2 * i + 1] = out[2 * i + 1]! + gaussian(rng) * sigma;
  }
}

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

export const Channel: ChannelApi = {
  awgn(iq: Float64Array, snrDb: number, rng: Rng): Float64Array {
    const out = Float64Array.from(iq);
    const signalPower = meanPower(iq);
    // Noise power per complex sample = P_s / 10^(SNR/10); addComplexNoise
    // splits that into P_n/2 per real dimension.
    const noisePower = signalPower / dbToLinear(snrDb);
    addComplexNoise(out, noisePower, 0, iq.length >> 1, rng);
    return out;
  },

  jam(iq: Float64Array, config: JammerConfig, rng: Rng): Float64Array {
    const out = Float64Array.from(iq);
    const sampleCount = iq.length >> 1;
    if (sampleCount === 0) return out;

    // Jammer power is specified relative to the measured signal power, so
    // powerDb = 0 means "as strong as the signal".
    const jamPower = meanPower(iq) * dbToLinear(config.powerDb);

    switch (config.kind) {
      case 'barrage':
        // Wideband, always on: every sample takes the hit.
        addComplexNoise(out, jamPower, 0, sampleCount, rng);
        break;

      case 'partial-band': {
        // SIMPLIFICATION: a real partial-band jammer covers a contiguous
        // slice of *spectrum*. Working on a baseband time series, we use a
        // contiguous slice of *samples* as the proxy — the first
        // `bandFraction` of the buffer sees jammer noise at the same
        // spectral density as barrage, the rest is clean. That preserves
        // the property the lab cares about (only part of the signal is
        // hit) without needing a channelizer.
        const fraction = clamp(config.bandFraction ?? 1, 0, 1);
        const end = Math.round(fraction * sampleCount);
        addComplexNoise(out, jamPower, 0, end, rng);
        break;
      }

      case 'follower': {
        // A follower jammer sorts the hop, then retunes — so it only lands
        // on the tail of each dwell it was chasing. `lagHops` counts the
        // slots it falls behind out of HOP_SLOTS_PER_BUFFER; the buffer is
        // jammed from that offset to the end. lagHops = 0 is perfect
        // tracking (whole buffer jammed); lagHops >= HOP_SLOTS_PER_BUFFER
        // means it never catches up and nothing is jammed.
        const lag = clamp(config.lagHops ?? 0, 0, HOP_SLOTS_PER_BUFFER);
        const samplesPerHop = sampleCount / HOP_SLOTS_PER_BUFFER;
        const start = clamp(Math.floor(lag * samplesPerHop), 0, sampleCount);
        addComplexNoise(out, jamPower, start, sampleCount, rng);
        break;
      }
    }

    return out;
  },

  artificialNoise(iq: Float64Array, anPowerDb: number, rng: Rng): Float64Array {
    // Goel & Negi: the transmitter radiates noise into the null space of
    // the legitimate channel, so only the eavesdropper sees it. We model
    // the outcome rather than the precoder — this is Eve's copy; the caller
    // keeps `iq` itself as Bob's clean copy.
    const out = Float64Array.from(iq);
    const noisePower = meanPower(iq) * dbToLinear(anPowerDb);
    addComplexNoise(out, noisePower, 0, iq.length >> 1, rng);
    return out;
  },

  spatialNullGainDb(thetaDeg: number, nullDepthDb: number, nullWidthDeg: number): number {
    // Gaussian notch: −nullDepthDb at the null, relaxing to 0 dB (no
    // attenuation) once you are several null-widths off it.
    if (!(nullWidthDeg > 0)) return thetaDeg === 0 ? -nullDepthDb : 0;
    const x = thetaDeg / nullWidthDeg;
    return -nullDepthDb * Math.exp(-(x * x));
  },

  beamGainDb(thetaDeg: number, beamwidthDeg: number, sidelobeFloorDb: number): number {
    // Idealized Gaussian mainlobe: 0 dB at boresight, −12·(θ/BW)² dB off
    // it, which puts the −3 dB points at ±BW/2 (the usual 3 dB beamwidth
    // convention). Everything beyond the mainlobe is folded into a flat
    // sidelobe floor rather than modelling individual lobes.
    if (!(beamwidthDeg > 0)) return thetaDeg === 0 ? 0 : sidelobeFloorDb;
    const x = thetaDeg / beamwidthDeg;
    return Math.max(-12 * x * x, sidelobeFloorDb);
  },
};
