/**
 * Per-scheme signal generators. Each produces fresh view inputs every
 * frame from the DSP core — all synthesis is live and seeded, so runs
 * are reproducible and sliders change real math, not a recording.
 */

import { Modulator } from '../dsp/modulator';
import type { ConstellationKind } from '../dsp/contracts';
import { Shaping } from '../dsp/shaping';
import { Spreading } from '../dsp/spreading';
import { Hopping } from '../dsp/hopping';
import { Channel } from '../dsp/channel';
import { mulberry32 } from '../dsp/rng';
import { computePSD, hanningWindow, fft } from '../dsp/fft';
import type {
  ConstellationInput,
  EyeDiagramInput,
  SpectrumInput,
  SpreadingInput,
  TimeDomainInput,
  TimeFreqInput,
} from './contracts';
import type { ModulationScheme } from '../data/types';

export interface LabFrame {
  constellation?: ConstellationInput;
  timeDomain?: TimeDomainInput;
  spectrum?: SpectrumInput;
  eyeDiagram?: EyeDiagramInput;
  timeFreq?: TimeFreqInput;
  spreading?: SpreadingInput;
}

export interface Generator {
  /** Produce inputs for the next animation frame. */
  next(frame: number): LabFrame;
  /** Live-adjustable parameters (bound to panel sliders). */
  params: Record<string, number>;
}

const FFT_SIZE = 256;
const WINDOW = hanningWindow(FFT_SIZE);
const DB_MIN = -70;
const DB_MAX = 30;

function psdOf(iq: Float64Array): Float64Array {
  // Zero-pad or truncate to exactly FFT_SIZE complex samples.
  const buf = new Float64Array(2 * FFT_SIZE);
  buf.set(iq.subarray(0, Math.min(iq.length, 2 * FFT_SIZE)));
  return computePSD(buf, FFT_SIZE, WINDOW);
}

/** Scale a waveform to unit average power (fair-comparison guard: pulse
 *  shaping and OFDM synthesis change power, and PSD comparisons are
 *  meaningless unless both signals carry the same total power). */
function normalizePower(iq: Float64Array): Float64Array {
  let power = 0;
  const n = iq.length / 2;
  if (n === 0) return iq;
  for (let i = 0; i < iq.length; i++) power += iq[i]! * iq[i]!;
  power /= n;
  if (power <= 0) return iq;
  const s = 1 / Math.sqrt(power);
  const out = new Float64Array(iq.length);
  for (let i = 0; i < iq.length; i++) out[i] = iq[i]! * s;
  return out;
}

/** ifft via conjugation trick over the forward FFT. */
function ifft(real: Float64Array, imag: Float64Array): void {
  for (let i = 0; i < imag.length; i++) imag[i] = -imag[i]!;
  fft(real, imag);
  const n = real.length;
  for (let i = 0; i < n; i++) {
    real[i] = real[i]! / n;
    imag[i] = -imag[i]! / n;
  }
}

/** OFDM symbol: random QAM on `used` center bins of `n` → time waveform. */
function ofdmWaveform(n: number, used: number, kind: ConstellationKind, rng: ReturnType<typeof mulberry32>): Float64Array {
  const pts = Modulator.constellationPoints(kind);
  const nPts = pts.length / 2;
  const real = new Float64Array(n);
  const imag = new Float64Array(n);
  const start = Math.floor((n - used) / 2);
  for (let k = 0; k < used; k++) {
    const p = Math.floor(rng.next() * nPts);
    // Map to fft bin order (DC at 0): shift the centered index.
    const centered = start + k;
    const bin = (centered - n / 2 + n) % n;
    real[bin] = pts[2 * p]!;
    imag[bin] = pts[2 * p + 1]!;
  }
  ifft(real, imag);
  // Interleave + normalize to unit average power.
  const iq = new Float64Array(2 * n);
  let power = 0;
  for (let i = 0; i < n; i++) power += real[i]! * real[i]! + imag[i]! * imag[i]!;
  const scale = power > 0 ? Math.sqrt(n / power) : 1;
  for (let i = 0; i < n; i++) {
    iq[2 * i] = real[i]! * scale;
    iq[2 * i + 1] = imag[i]! * scale;
  }
  return iq;
}

/** Shaped single-carrier burst → { symbols, waveform }. */
function scBurst(
  kind: ConstellationKind,
  count: number,
  sps: number,
  rng: ReturnType<typeof mulberry32>,
): { symbols: Float64Array; iq: Float64Array; bits: Uint8Array } {
  const stream = Modulator.modulate(kind, Modulator.randomBits(count * bitsPer(kind), rng));
  const taps = Shaping.rrcTaps(0.35, 6, sps);
  const { samples } = Shaping.shape(stream.symbols, taps, sps);
  return { symbols: stream.symbols, iq: samples, bits: stream.bits };
}

function bitsPer(kind: ConstellationKind): number {
  const map: Record<string, number> = {
    bpsk: 1, qpsk: 2, pi4dqpsk: 2, '8psk': 3,
    qam16: 4, qam64: 6, qam256: 8, qam4096: 12,
    apsk16: 4, apsk32: 5, gfsk: 1, ask: 1,
  };
  return map[kind] ?? 2;
}

/** Rolling waterfall helper: keeps N rows, appends per frame. */
class Waterfall {
  rows: Float64Array[] = [];
  constructor(private max = 90) {}
  push(row: Float64Array): Float64Array[] {
    this.rows.push(row);
    if (this.rows.length > this.max) this.rows.shift();
    return this.rows;
  }
}

/** Hop-channel PSD row: noise floor + a bump at the hop channel. */
function hopRow(channel: number, channelCount: number, rng: ReturnType<typeof mulberry32>, powerDb = 20): Float64Array {
  const row = new Float64Array(FFT_SIZE);
  for (let i = 0; i < FFT_SIZE; i++) row[i] = DB_MIN + 8 + rng.next() * 6;
  const center = Math.floor(((channel + 0.5) / channelCount) * FFT_SIZE);
  for (let d = -3; d <= 3; d++) {
    const i = center + d;
    if (i >= 0 && i < FFT_SIZE) row[i] = Math.max(row[i]!, powerDb - Math.abs(d) * 6);
  }
  return row;
}

// ——— Generator factory ————————————————————————————————————————————————

export function createGenerator(scheme: ModulationScheme): Generator {
  const p: Record<string, number> = {};
  for (const [k, v] of Object.entries(scheme.params)) {
    if (typeof v === 'number') p[k] = v;
  }
  const rng = mulberry32(0xc0ffee ^ scheme.id.length);

  switch (scheme.id) {
    case 'nfc-ask': {
      return {
        params: p,
        next(): LabFrame {
          const sps = p.sps ?? 16;
          const bits = Modulator.randomBits(p.bitCount ?? 24, rng);
          // Manchester: each bit → high-low or low-high half-cells.
          const iq = new Float64Array(2 * bits.length * sps);
          for (let b = 0; b < bits.length; b++) {
            for (let s = 0; s < sps; s++) {
              const firstHalf = s < sps / 2;
              const on = bits[b]! === 1 ? firstHalf : !firstHalf;
              iq[2 * (b * sps + s)] = on ? 1.35 : 0.12;
            }
          }
          const noisy = Channel.awgn(iq, p.snrDb ?? 22, rng);
          return {
            timeDomain: { iq: noisy, sps, showEnvelope: true, label: 'ASK · Manchester-coded reader field' },
            spectrum: { psd: psdOf(noisy), dbMin: DB_MIN, dbMax: DB_MAX, label: '13.56 MHz — narrow and obvious' },
          };
        },
      };
    }

    case 'bt-dqpsk-afh': {
      const wf = new Waterfall();
      const pattern = Hopping.publicPattern(4096, p.channelCount ?? 79);
      const hops: number[] = [];
      let hopIdx = 0;
      return {
        params: p,
        next(): LabFrame {
          const { symbols } = scBurst('pi4dqpsk', 96, 4, rng);
          const rx = Channel.awgn(symbols, p.snrDb ?? 18, rng);
          const ch = pattern.channels[hopIdx++ % pattern.channels.length]!;
          hops.push(ch);
          if (hops.length > 90) hops.shift();
          const rows = wf.push(hopRow(ch, pattern.channelCount, rng));
          return {
            constellation: {
              ideal: Modulator.constellationPoints('pi4dqpsk'),
              rx,
              evm: Modulator.evm('pi4dqpsk', rx),
              label: 'π/4-DQPSK',
            },
            timeFreq: {
              rows,
              dbMin: DB_MIN,
              dbMax: DB_MAX,
              hopChannels: Uint16Array.from(hops),
              channelCount: pattern.channelCount,
              predictability: Hopping.predictability({ channels: Uint16Array.from(hops), channelCount: pattern.channelCount }),
              label: 'AFH — public sequence',
            },
          };
        },
      };
    }

    case 'wifi-ofdm': {
      return {
        params: p,
        next(): LabFrame {
          const kind = 'qam64' as ConstellationKind;
          const iq = ofdmWaveform(FFT_SIZE, p.subcarriers ?? 64, kind, rng);
          const noisy = Channel.awgn(iq, p.snrDb ?? 24, rng);
          const { symbols } = scBurst(kind, 128, 1, rng);
          const rxSym = Channel.awgn(symbols, p.snrDb ?? 24, rng);
          return {
            spectrum: { psd: psdOf(noisy), dbMin: DB_MIN, dbMax: DB_MAX, label: 'OFDM — occupied subcarrier block' },
            constellation: {
              ideal: Modulator.constellationPoints(kind),
              rx: rxSym,
              evm: Modulator.evm(kind, rxSym),
              label: '64-QAM per subcarrier',
            },
          };
        },
      };
    }

    case '3g-dsss': {
      // EMA-smoothed PSDs: single-frame periodograms have ~5 dB variance,
      // which buries the ~10·log10(SF/occupancy) level difference the demo
      // exists to show. Smoothing makes the relative levels legible.
      let emaSpread: Float64Array | null = null;
      let emaNarrow: Float64Array | null = null;
      const ema = (prev: Float64Array | null, cur: Float64Array): Float64Array => {
        if (!prev) return cur.slice();
        for (let i = 0; i < cur.length; i++) prev[i] = prev[i]! * 0.82 + cur[i]! * 0.18;
        return prev;
      };
      return {
        params: p,
        next(): LabFrame {
          const sf = Math.max(4, Math.round(p.spreadFactor ?? 32));
          const chips = Spreading.pnSequence(sf, mulberry32(1234)); // fixed public code
          const bits = Modulator.randomBits(8, rng);
          const stream = Modulator.modulate('bpsk', bits);
          const spread = Spreading.spread(stream.symbols, chips);
          const noisySpread = Channel.awgn(normalizePower(spread), p.snrDb ?? 14, rng);
          // Narrowband reference: the SAME power unspread — towering PSD peak.
          const narrow = normalizePower(scBurst('qpsk', FFT_SIZE / 8, 8, rng).iq);
          emaSpread = ema(emaSpread, psdOf(noisySpread));
          emaNarrow = ema(emaNarrow, psdOf(narrow));
          return {
            spreading: {
              bits,
              chips,
              spread: (() => {
                const iOnly = new Float64Array(spread.length / 2);
                for (let i = 0; i < iOnly.length; i++) iOnly[i] = spread[2 * i]!;
                return iOnly;
              })(),
              processingGainDb: Spreading.processingGainDb(sf),
              label: `spreading factor ${sf}`,
            },
            spectrum: {
              psd: emaSpread,
              psdCompare: emaNarrow,
              dbMin: DB_MIN,
              dbMax: DB_MAX,
              noiseFloorDb: -35,
              label: 'spread (cyan) vs narrowband (dim)',
            },
          };
        },
      };
    }

    case '4g-papr': {
      return {
        params: p,
        next(): LabFrame {
          const ofdm = ofdmWaveform(FFT_SIZE, p.subcarriers ?? 64, 'qam16', rng);
          const sc = normalizePower(scBurst('qam16', 64, 4, rng).iq);
          // Normalize sc to unit power for a fair PAPR comparison (shape() output is filtered).
          return {
            timeDomain: {
              iq: ofdm,
              showEnvelope: true,
              paprDb: Shaping.papr({ samples: ofdm }),
              label: 'OFDMA downlink — ragged envelope',
            },
            spectrum: {
              psd: psdOf(ofdm),
              psdCompare: psdOf(sc),
              dbMin: DB_MIN,
              dbMax: DB_MAX,
              label: `SC-FDMA PAPR ${Shaping.papr({ samples: sc }).toFixed(1)} dB vs OFDMA ${Shaping.papr({ samples: ofdm }).toFixed(1)} dB`,
            },
          };
        },
      };
    }

    case '5g-numerology': {
      const wf = new Waterfall();
      return {
        params: p,
        next(): LabFrame {
          // Wider spacing → fewer, fatter subcarriers in the same bandwidth.
          const spacing = p.spacingKhz ?? 30;
          const used = Math.max(8, Math.round((64 * 15) / spacing));
          const iq = ofdmWaveform(FFT_SIZE, used, 'qam64', rng);
          const noisy = Channel.awgn(iq, p.snrDb ?? 22, rng);
          const psd = psdOf(noisy);
          const rows = wf.push(psd);
          return {
            spectrum: { psd, dbMin: DB_MIN, dbMax: DB_MAX, label: `CP-OFDM · ${spacing} kHz spacing · ${used} subcarriers` },
            timeFreq: { rows, dbMin: DB_MIN, dbMax: DB_MAX, label: 'resource grid over time' },
          };
        },
      };
    }

    case '6g-otfs': {
      const wf = new Waterfall();
      let t = 0;
      return {
        params: p,
        next(): LabFrame {
          t++;
          // Delay-Doppler raster: sparse impulses on a fixed grid, appearing
          // row-block by row-block — localized where TF signaling smears.
          const nd = Math.max(4, Math.round(p.gridDelay ?? 16));
          const row = new Float64Array(FFT_SIZE);
          for (let i = 0; i < FFT_SIZE; i++) row[i] = DB_MIN + 6 + Math.random() * 4;
          if (t % Math.max(2, Math.round(p.gridDoppler ?? 8) / 2) === 0) {
            for (let k = 0; k < nd; k++) {
              const c = Math.floor(((k + 0.5) / nd) * FFT_SIZE);
              row[c] = 18;
              if (c + 1 < FFT_SIZE) row[c + 1] = 8;
            }
          }
          const rows = wf.push(row);
          const iq = ofdmWaveform(FFT_SIZE, 48, 'qpsk', rng);
          return {
            timeFreq: { rows, dbMin: DB_MIN, dbMax: DB_MAX, label: 'delay-Doppler grid (OTFS)' },
            spectrum: { psd: psdOf(iq), dbMin: DB_MIN, dbMax: DB_MAX, label: 'equivalent TF occupancy' },
          };
        },
      };
    }

    case 'satleo-ofdm': {
      const wf = new Waterfall();
      let beamCell = 0;
      let dwell = 0;
      return {
        params: p,
        next(): LabFrame {
          // Beam-hopping: the OFDM block jumps between ground-cell slots on a
          // fixed schedule — energetic, structured, and utterly public.
          if (++dwell % 22 === 0) beamCell = (beamCell + 1) % 4;
          const used = Math.max(16, Math.round(p.subcarriers ?? 52));
          const iq = ofdmWaveform(FFT_SIZE, used, 'qpsk', rng);
          const noisy = Channel.awgn(iq, p.snrDb ?? 16, rng);
          const psd = psdOf(noisy);
          // Shift the occupied block to the current beam cell's sub-band.
          const row = new Float64Array(FFT_SIZE);
          row.fill(DB_MIN + 8);
          const cellW = Math.floor(FFT_SIZE / 4);
          const start = beamCell * cellW;
          const center = Math.floor((FFT_SIZE - used) / 2);
          for (let i = 0; i < cellW && start + i < FFT_SIZE; i++) {
            const src = center + Math.floor((i / cellW) * used);
            row[start + i] = psd[src] ?? DB_MIN + 8;
          }
          const rows = wf.push(row);
          return {
            spectrum: { psd, dbMin: DB_MIN, dbMax: DB_MAX, label: 'OFDM downlink — one spot-beam dwell' },
            timeFreq: { rows, dbMin: DB_MIN, dbMax: DB_MAX, label: 'beam-hop schedule across ground cells' },
          };
        },
      };
    }

    case 'satciv-apsk': {
      return {
        params: p,
        next(): LabFrame {
          const { symbols } = scBurst('apsk32', 128, 6, rng);
          const rx = Channel.awgn(symbols, p.snrDb ?? 20, rng);
          const shaped = scBurst('apsk32', 48, 8, rng).iq;
          return {
            constellation: {
              ideal: Modulator.constellationPoints('apsk32'),
              rx,
              evm: Modulator.evm('apsk32', rx),
              label: '32-APSK — DVB-S2X rings',
            },
            timeDomain: {
              iq: shaped,
              showEnvelope: true,
              paprDb: Shaping.papr({ samples: shaped }),
              label: 'near-constant envelope for a saturated TWTA',
            },
          };
        },
      };
    }

    case 'satmil-fhss': {
      const wf = new Waterfall();
      const keyedRng = mulberry32(0x5ec2e7);
      const pattern = Hopping.keyedPattern(4096, p.channelCount ?? 79, keyedRng);
      const hops: number[] = [];
      let hopIdx = 0;
      return {
        params: p,
        next(): LabFrame {
          const ch = pattern.channels[hopIdx++ % pattern.channels.length]!;
          hops.push(ch);
          if (hops.length > 90) hops.shift();
          // Spread energy: barely above the floor.
          const rows = wf.push(hopRow(ch, pattern.channelCount, rng, -14));
          const sf = Math.max(8, Math.round(p.spreadFactor ?? 64));
          const chips = Spreading.pnSequence(sf, mulberry32(42));
          const bits = Modulator.randomBits(6, rng);
          const stream = Modulator.modulate('bpsk', bits);
          const spread = Spreading.spread(stream.symbols, chips);
          return {
            timeFreq: {
              rows,
              dbMin: DB_MIN,
              dbMax: DB_MAX,
              hopChannels: Uint16Array.from(hops),
              channelCount: pattern.channelCount,
              predictability: Hopping.predictability({ channels: Uint16Array.from(hops), channelCount: pattern.channelCount }),
              label: 'EHF keyed hopping — sorter blind',
            },
            spreading: {
              bits,
              chips,
              spread: (() => {
                const iOnly = new Float64Array(spread.length / 2);
                for (let i = 0; i < iOnly.length; i++) iOnly[i] = spread[2 * i]!;
                return iOnly;
              })(),
              processingGainDb: Spreading.processingGainDb(sf),
              label: `DSSS ranging · factor ${sf}`,
            },
          };
        },
      };
    }

    default: {
      // Unknown scheme: safe empty frames.
      return { params: p, next: () => ({}) };
    }
  }
}
