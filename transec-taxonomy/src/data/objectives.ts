/**
 * The five TRANSEC objectives.
 *
 * Source: transec_taxonomy.pptx — slide 2 (definitions, 'Defeats:'),
 * slides 5–9 (one narrative slide per objective, in this order).
 * Colors are the per-objective accents used on the deck.
 */

import type { Objective } from './types';

export const OBJECTIVES: Objective[] = [
  {
    id: 'lpd',
    abbr: 'LPD',
    name: 'Low Probability of Detection',
    definition: 'Adversary cannot tell a transmission is happening at all.',
    defeats: 'Energy detection, spectrum surveillance.',
    color: '#0E7C86',
    howAchieved: [
      'NFC: near-field magnetic decay (~1/r³) makes emission undetectable past ~1 m — physics supplies LPD for free.',
      '3G DSSS: processing gain spreads energy toward the noise floor — a modest, code-public form of hiding.',
      '5G mmWave: beamforming confines energy to a narrow cone — a warden off-axis observes nothing (spatial LPD).',
      '6G sub-THz: molecular absorption plus pencil beams limit detection in both angle and range (propagation LPD).',
      'Military SATCOM: engineered spread-spectrum downlinks push emissions below detectability for off-target receivers.',
    ],
    whereStrong: [
      'Near-field (NFC) and the mmWave/THz frontier, where geometry and absorption do the work.',
      'Protected military SATCOM, by deliberate spread-spectrum design.',
    ],
    whereWeak: [
      'All civil terrestrial radio designed to be found: Wi-Fi beacons, cellular sync signals, BLE advertising.',
      'Deployment lags theory: the square-root law is well developed, fielded civil LPD is not.',
      'THz LPD is not automatic — a scatterer in the beam re-enables eavesdropping (Ma et al., 2018).',
    ],
    taxonomicReading:
      'LPD moves from a signal-domain mechanism (spreading) at low bands to a propagation/spatial mechanism (beams, absorption) at high bands — the band axis changes which mechanism is even available.',
    refIds: ['bash2013', 'chen2023', 'ma2018'],
  },
  {
    id: 'lpi',
    abbr: 'LPI',
    name: 'Low Probability of Intercept',
    definition:
      'Even if detected, adversary cannot determine it is a signal of interest or recover its parameters.',
    defeats: 'Parameter analysis, signal sorting.',
    color: '#2E7D32',
    howAchieved: [
      'Frequency hopping with a secret sequence: the observer sees energy but cannot predict where it goes next.',
      'Direct-sequence spreading with a secret code: the waveform looks noise-like without the code.',
      'Waveform / parameter randomization: deny the constant features a sorter keys on.',
      'Beam directionality (5G/6G) adds incidental LPI — only a receiver in the beam can even attempt analysis.',
      'Military EHF SATCOM: secret hop patterns are the reference implementation of fielded LPI.',
    ],
    whereStrong: [
      'Military systems using secret spreading / hopping — the intended home of LPI.',
    ],
    whereWeak: [
      'Every civil standard: hop sequences and spreading codes are published for interoperability, so parameters are recoverable by design.',
      'Bluetooth AFH and cellular hopping exist for coexistence, not concealment — they do not deny parameter analysis.',
    ],
    taxonomicReading:
      'LPI is almost entirely a military column. Civil interoperability requires published parameters, which is the opposite of LPI — the one objective where the commercial/defense split is sharpest.',
    refIds: ['cnssi4009', 'pirayesh2022'],
  },
  {
    id: 'lpe',
    abbr: 'LPE',
    name: 'Low Probability of Exploitation',
    definition:
      'Even if intercepted and characterized, adversary cannot derive intelligence from it.',
    defeats: 'Content and externals recovery at the PHY layer.',
    color: '#5B3FA8',
    howAchieved: [
      "Wiretap-channel coding: exploit a channel advantage so the eavesdropper's equivocation stays high (Wyner, 1975).",
      "Artificial noise: spend power to degrade only the eavesdropper's channel, not the intended one (Goel & Negi, 2008).",
      'MIMO / massive-MIMO beamforming: steer a spatial null toward the eavesdropper (5G, and 6G ultra-massive arrays).',
      'Channel-based key generation: derive shared keys from reciprocal channel randomness at the PHY layer.',
      "RIS-aided nulling (6G): reshape the environment to suppress the eavesdropper's received signal.",
    ],
    whereStrong: [
      'Multi-antenna bands (5G/6G): spatial degrees of freedom make secrecy and artificial noise practical.',
      'Military SATCOM: noise-like spread signals leak little from their externals.',
    ],
    whereWeak: [
      'Single-antenna, low-band systems (NFC, BLE, legacy cellular) have few PHY degrees of freedom to exploit.',
      'Most academic PLS work stops at simulation; reciprocity and CSI assumptions rarely survive deployment.',
    ],
    taxonomicReading:
      'LPE is where the academic PLS literature concentrates, and it scales with spatial degrees of freedom — which is exactly why it strengthens as bands rise and arrays grow.',
    refIds: ['wyner1975', 'goel2008'],
  },
  {
    id: 'aj',
    abbr: 'AJ',
    name: 'Anti-Jam',
    definition: 'Communication survives deliberate interference.',
    defeats: 'Barrage, partial-band, and follower jamming.',
    color: '#C0392B',
    howAchieved: [
      "Spread-spectrum processing gain: DSSS/FHSS raise the jammer's required power by the spreading factor.",
      'Frequency hopping: move faster than a follower jammer can track.',
      'Spatial nulling: adaptive antennas and massive MIMO place pattern nulls on the jammer (5G/6G).',
      'Pencil beams (6G/THz): an off-axis jammer contributes almost no power into the beam.',
      'Military SATCOM: nulling antennas plus EHF hopping are the fielded gold standard.',
    ],
    whereStrong: [
      'Military SATCOM and tactical radios — the best-developed TRANSEC column overall.',
      'Multi-antenna 5G/6G, where spatial nulling adds a new anti-jam axis.',
    ],
    whereWeak: [
      'GNSS: low received power makes it notoriously jammable; CRPA antennas only partly help.',
      'Civil Wi-Fi and cellular have little intrinsic AJ — DFS and power control are not jam resistance.',
      'Pencil-beam AJ trades one weakness for another: robust off-axis, but fragile to blockage.',
    ],
    taxonomicReading:
      'AJ is the most mature objective across the whole matrix, and the only one with both a deep signal-domain toolkit and a growing spatial one — the two regimes reinforce rather than replace each other here.',
    refIds: ['pirayesh2022', 'tedeschi2022'],
  },
  {
    id: 'tfs',
    abbr: 'TFS',
    name: 'Traffic Flow Security',
    definition:
      'Traffic externals — presence, volume, timing, endpoints — are concealed from analysis.',
    defeats: 'Traffic analysis, pattern-of-life inference.',
    color: '#B8860B',
    howAchieved: [
      'Emission control (EMCON): transmit only when necessary to deny a pattern of life.',
      'Cover / dummy traffic: keep emission constant so real activity is not distinguishable from idle.',
      'Constant-envelope continuous carriers: hide volume and timing behind a steady signal.',
      'Decoy-channel and dual-messaging schemes: emit structured traffic that masks the real channel (an active research direction).',
      'Address / identifier randomization (e.g. BLE RPA) partly hides endpoints — but at the link layer, not the PHY.',
    ],
    whereStrong: [
      'Military SATCOM and naval EMCON doctrine, where continuous-carrier and radio-silence practices are established.',
    ],
    whereWeak: [
      'Nearly every civil band: traffic timing and volume are exposed by design.',
      'PHY-layer TFS is thinly studied — most traffic-analysis defense lives at the network / anonymity layer, not the waveform.',
    ],
    taxonomicReading:
      'TFS is the empty column of the taxonomy at the physical layer — the clearest gap, and the strongest place for a new contribution (including PHY-layer dual-messaging / decoy-channel work).',
    refIds: ['cnssi4009', 'chen2023'],
  },
];
