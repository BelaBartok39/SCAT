/**
 * Modulation lab configs — which schemes each band demonstrates, which
 * views compose the panel, and the parameters the generators consume.
 * Derived from the survey deck's per-band "Modulation & Access" fields.
 */

import type { ModulationScheme } from './types';

export const MODULATIONS: ModulationScheme[] = [
  {
    id: 'nfc-ask',
    bandId: 'nfc',
    name: 'ASK + Manchester coding',
    views: ['timeDomain', 'spectrum'],
    params: { modIndex: 1.0, bitCount: 24, sps: 16, snrDb: 22 },
    demonstrates: ['lpd'],
    caption: 'Load-modulated ASK: the tag talks by detuning the reader field — physics keeps it short-range.',
  },
  {
    id: 'bt-dqpsk-afh',
    bandId: 'bluetooth',
    name: 'π/4-DQPSK + adaptive frequency hopping',
    views: ['constellation', 'timeFreq'],
    params: { kind: 'pi4dqpsk', snrDb: 18, channelCount: 79, hopsPerFrame: 1, keyed: 0 },
    demonstrates: ['lpi'],
    caption: 'The hop sequence is public — AFH exists for coexistence, not concealment. A sorter locks on instantly.',
  },
  {
    id: 'wifi-ofdm',
    bandId: 'wifi',
    name: 'OFDM · up to 4096-QAM',
    views: ['spectrum', 'constellation'],
    params: { subcarriers: 64, kind: 'qam64', snrDb: 24 },
    demonstrates: ['lpd'],
    caption: 'Dozens of orthogonal subcarriers turn one hard channel into many easy ones — and broadcast their presence.',
  },
  {
    id: '3g-dsss',
    bandId: 'cellular-3g-4g',
    name: 'DSSS-CDMA · QPSK at 3.84 Mcps',
    views: ['spreading', 'spectrum'],
    params: { spreadFactor: 32, snrDb: 14 },
    demonstrates: ['lpd', 'aj'],
    caption: 'Spreading pushes energy toward the noise floor — a modest, code-public form of hiding.',
  },
  {
    id: '4g-papr',
    bandId: 'cellular-3g-4g',
    name: 'OFDMA vs SC-FDMA — the PAPR trade',
    views: ['timeDomain', 'spectrum'],
    params: { subcarriers: 64, kind: 'qam16', compare: 1 },
    demonstrates: ['aj'],
    caption: 'Why the uplink differs: SC-FDMA’s lower peak-to-average power spares the handset amplifier.',
  },
  {
    id: '5g-numerology',
    bandId: 'cellular-5g',
    name: 'CP-OFDM · flexible numerology',
    views: ['spectrum', 'timeFreq'],
    params: { subcarriers: 64, spacingKhz: 30, kind: 'qam64', snrDb: 22 },
    demonstrates: ['lpe'],
    caption: 'One air interface, scalable subcarrier spacing: 15 kHz for coverage, 120 kHz for mmWave phase noise.',
  },
  {
    id: '6g-otfs',
    bandId: '6g-subthz',
    name: 'OTFS — delay-Doppler signaling',
    views: ['timeFreq', 'spectrum'],
    params: { gridDelay: 16, gridDoppler: 8, snrDb: 18 },
    demonstrates: ['lpd'],
    caption: 'Candidate 6G waveform: symbols live on a delay-Doppler grid, robust where sub-THz channels disperse.',
  },
  {
    id: 'satciv-apsk',
    bandId: 'satcom-civil',
    name: 'DVB-S2X · 16/32-APSK',
    views: ['constellation', 'timeDomain'],
    params: { kind: 'apsk32', snrDb: 20 },
    demonstrates: ['lpe'],
    caption: 'Ring constellations keep the envelope nearly constant — what a saturated satellite amplifier demands.',
  },
  {
    id: 'satleo-ofdm',
    bandId: 'satcom-leo',
    name: 'Beam-hopped OFDM downlink',
    views: ['spectrum', 'timeFreq'],
    params: { subcarriers: 52, snrDb: 16 },
    demonstrates: ['lpi', 'lpd'],
    caption:
      'The megaconstellation downlink: OFDM frames hopping between ground cells on a schedule — public enough that researchers repurpose them as navigation beacons.',
  },
  {
    id: 'satmil-fhss',
    bandId: 'satcom-military',
    name: 'EHF FHSS — keyed hopping + DSSS',
    views: ['timeFreq', 'spreading'],
    params: { channelCount: 79, keyed: 1, spreadFactor: 64, snrDb: 10 },
    demonstrates: ['lpi', 'aj', 'lpd'],
    caption: 'The reference implementation of fielded LPI: a keyed pattern the sorter cannot predict, spread below the floor.',
  },
];

export function schemesForBand(bandId: string): ModulationScheme[] {
  return MODULATIONS.filter((m) => m.bandId === bandId);
}

export function schemeById(id: string): ModulationScheme | undefined {
  return MODULATIONS.find((m) => m.id === id);
}
