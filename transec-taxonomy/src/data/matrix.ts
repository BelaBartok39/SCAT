/**
 * The matrix: 8 bands × 5 objectives = 40 cells.
 *
 * Source: transec_taxonomy.pptx — slide 4. `maturity` and `note` are
 * transcribed exactly from the slide grid; `mechanismIds` and `detail`
 * are read off the per-objective narratives on slides 5–9.
 *
 * Slide-4 footnote: LPE here means physical-layer exploitation resistance
 * (wiretap coding, artificial noise, PHY key generation). Upper-layer
 * cryptography (COMSEC) is out of scope, so civil systems that rely on it
 * read as weak.
 */

import type { Cell } from './types';

export const CELLS: Cell[] = [
  // ——— NFC ————————————————————————————————————————————————————————
  {
    bandId: 'nfc',
    objectiveId: 'lpd',
    maturity: 'N',
    note: 'near-field decay',
    mechanismIds: [],
    detail:
      'Inductive coupling decays ~1/r³, so emission is undetectable past about a metre — no engineered mechanism is involved, the physics supplies LPD for free.',
  },
  {
    bandId: 'nfc',
    objectiveId: 'lpi',
    maturity: 'W',
    note: 'proximity only',
    mechanismIds: [],
    detail:
      'Whatever concealment exists comes from having to stand centimetres away; the ASK/Miller waveform parameters are fully published and trivially characterized once in range.',
  },
  {
    bandId: 'nfc',
    objectiveId: 'lpe',
    maturity: 'W',
    note: '—',
    mechanismIds: [],
  },
  {
    bandId: 'nfc',
    objectiveId: 'aj',
    maturity: 'W',
    note: 'close-range only',
    mechanismIds: [],
    detail:
      'There is no processing gain or spatial handle; the link survives interference only because a jammer would have to be as close as the reader.',
  },
  {
    bandId: 'nfc',
    objectiveId: 'tfs',
    maturity: 'W',
    note: '—',
    mechanismIds: [],
  },

  // ——— Bluetooth / BLE ————————————————————————————————————————————
  {
    bandId: 'bluetooth',
    objectiveId: 'lpd',
    maturity: 'W',
    note: 'low power',
    mechanismIds: ['power-control'],
    detail:
      'Milliwatt-class output and heavy BLE duty cycling shrink the detection radius, but advertising packets are broadcast precisely so devices can be found.',
  },
  {
    bandId: 'bluetooth',
    objectiveId: 'lpi',
    maturity: 'W',
    note: 'public hop seq',
    mechanismIds: ['hopping'],
    detail:
      'Classic Bluetooth hops 1600 times per second, but the sequence is derived from a public device address, so an observer can predict and follow it.',
  },
  {
    bandId: 'bluetooth',
    objectiveId: 'lpe',
    maturity: 'W',
    note: '—',
    mechanismIds: [],
  },
  {
    bandId: 'bluetooth',
    objectiveId: 'aj',
    maturity: 'W',
    note: 'AFH = coexist',
    mechanismIds: ['hopping'],
    detail:
      'Adaptive frequency hopping blacklists channels occupied by Wi-Fi and other ISM traffic — a coexistence feature, not resistance to a deliberate jammer.',
  },
  {
    bandId: 'bluetooth',
    objectiveId: 'tfs',
    maturity: 'W',
    note: 'RPA (link only)',
    mechanismIds: [],
    detail:
      'Resolvable private addresses rotate the identifier at the link layer; the timing, volume and presence of emissions at the PHY remain fully exposed.',
  },

  // ——— Wi-Fi ——————————————————————————————————————————————————————
  {
    bandId: 'wifi',
    objectiveId: 'lpd',
    maturity: 'W',
    note: 'beacons broadcast',
    mechanismIds: [],
    detail:
      'Access points emit periodic beacons at full power so clients can discover them — a standard-mandated announcement of exactly the fact LPD exists to hide.',
  },
  {
    bandId: 'wifi',
    objectiveId: 'lpi',
    maturity: 'W',
    note: 'standardized',
    mechanismIds: [],
    detail:
      'Preambles, subcarrier numerology and rate sets are published for interoperability, so every constant feature a signal sorter keys on is known in advance.',
  },
  {
    bandId: 'wifi',
    objectiveId: 'lpe',
    maturity: 'R',
    note: 'PHY key gen',
    mechanismIds: ['wiretap-coding'],
    detail:
      'Channel-based key generation from reciprocal multipath randomness is an active research line on 802.11 hardware, but nothing in the standard deploys it.',
  },
  {
    bandId: 'wifi',
    objectiveId: 'aj',
    maturity: 'W',
    note: 'DFS ≠ AJ',
    mechanismIds: [],
    detail:
      'Dynamic frequency selection vacates a channel when it hears radar — regulatory avoidance of an incumbent, not resistance to an adversary who follows you.',
  },
  {
    bandId: 'wifi',
    objectiveId: 'tfs',
    maturity: 'W',
    note: 'open',
    mechanismIds: [],
    detail:
      'Frame timing, burst volume and MAC endpoints are readable by any passive monitor, so a pattern of life falls out of the capture directly.',
  },

  // ——— Cellular 3G / 4G ———————————————————————————————————————————
  {
    bandId: 'cellular-3g-4g',
    objectiveId: 'lpd',
    maturity: 'W',
    note: '3G gain modest',
    mechanismIds: ['spreading'],
    detail:
      'WCDMA processing gain at 3.84 Mcps pushes energy toward the noise floor, but the gain is small, the codes are public, and 4G OFDMA drops spreading entirely.',
  },
  {
    bandId: 'cellular-3g-4g',
    objectiveId: 'lpi',
    maturity: 'W',
    note: 'sync broadcast',
    mechanismIds: [],
    detail:
      'Synchronization and broadcast channels must be findable by any handset in the cell, so the parameters an analyst needs are transmitted on purpose.',
  },
  {
    bandId: 'cellular-3g-4g',
    objectiveId: 'lpe',
    maturity: 'W',
    note: '—',
    mechanismIds: [],
  },
  {
    bandId: 'cellular-3g-4g',
    objectiveId: 'aj',
    maturity: 'W',
    note: '3G DSSS partial',
    mechanismIds: ['spreading'],
    detail:
      "DSSS raises a jammer's required power by the spreading factor, which helps partially in 3G; LTE has no equivalent, and fast power control is not jam resistance.",
  },
  {
    bandId: 'cellular-3g-4g',
    objectiveId: 'tfs',
    maturity: 'W',
    note: '—',
    mechanismIds: [],
  },

  // ——— Cellular 5G NR —————————————————————————————————————————————
  {
    bandId: 'cellular-5g',
    objectiveId: 'lpd',
    maturity: 'R',
    note: 'beam confinement',
    mechanismIds: ['beam-confinement'],
    detail:
      'FR2 beamforming confines energy into a narrow cone so a warden off-axis observes nothing — spatial LPD as a side effect of link budget, not a covertness design.',
  },
  {
    bandId: 'cellular-5g',
    objectiveId: 'lpi',
    maturity: 'W',
    note: 'beam incidental',
    mechanismIds: ['beam-confinement'],
    detail:
      'Directionality means only a receiver inside the beam can attempt analysis, but the waveform itself is a published 3GPP standard, so being in the beam is enough.',
  },
  {
    bandId: 'cellular-5g',
    objectiveId: 'lpe',
    maturity: 'R',
    note: 'MIMO null + AN',
    mechanismIds: ['spatial-nulling', 'artificial-noise'],
    detail:
      'Massive MIMO can steer a spatial null at an eavesdropper and spend surplus power on artificial noise that degrades only their channel — heavily studied, essentially undeployed.',
  },
  {
    bandId: 'cellular-5g',
    objectiveId: 'aj',
    maturity: 'R',
    note: 'spatial nulling',
    mechanismIds: ['spatial-nulling'],
    detail:
      'Adaptive massive-MIMO arrays can place pattern nulls on a jammer, adding a spatial anti-jam axis that sub-6 single-antenna systems never had.',
  },
  {
    bandId: 'cellular-5g',
    objectiveId: 'tfs',
    maturity: 'W',
    note: '—',
    mechanismIds: [],
  },

  // ——— 6G / sub-THz ———————————————————————————————————————————————
  {
    bandId: '6g-subthz',
    objectiveId: 'lpd',
    maturity: 'R',
    note: 'absorption+pencil',
    mechanismIds: ['absorption', 'beam-confinement'],
    detail:
      'Molecular absorption limits detection in range while pencil beams limit it in angle — but the confinement is not automatic: a scatterer in the beam re-enables eavesdropping (Ma et al., 2018).',
  },
  {
    bandId: '6g-subthz',
    objectiveId: 'lpi',
    maturity: 'R',
    note: 'narrow beam',
    mechanismIds: ['beam-confinement'],
    detail:
      'Only an observer inside a pencil beam can even attempt parameter analysis, and with no standardized sub-THz waveform yet there is nothing published to key on.',
  },
  {
    bandId: '6g-subthz',
    objectiveId: 'lpe',
    maturity: 'R',
    note: 'UM-MIMO / RIS',
    mechanismIds: ['spatial-nulling'],
    detail:
      "Ultra-massive arrays and RIS-aided nulling reshape the environment to suppress the eavesdropper's received signal — proposed and simulated, not built.",
  },
  {
    bandId: '6g-subthz',
    objectiveId: 'aj',
    maturity: 'R',
    note: 'pencil off-axis',
    mechanismIds: ['beam-confinement'],
    detail:
      'An off-axis jammer couples almost no power into a pencil beam, which trades jam robustness for fragility to blockage on the wanted path.',
  },
  {
    bandId: '6g-subthz',
    objectiveId: 'tfs',
    maturity: 'R',
    note: 'proposed',
    mechanismIds: ['emission-control'],
    detail:
      'Decoy-channel and dual-messaging schemes that mask the real channel with structured cover traffic are an active proposal at this band, with nothing fielded.',
  },

  // ——— SATCOM — civil —————————————————————————————————————————————
  {
    bandId: 'satcom-civil',
    objectiveId: 'lpd',
    maturity: 'W',
    note: 'wide footprint',
    mechanismIds: [],
    detail:
      'Even a spot beam illuminates a footprint hundreds of kilometres across, so the downlink is detectable by anyone under it with a modest dish.',
  },
  {
    bandId: 'satcom-civil',
    objectiveId: 'lpi',
    maturity: 'W',
    note: 'DVB-S2X open',
    mechanismIds: [],
    detail:
      'DVB-S2X framing, pilot symbols and modcods are an open ETSI specification, so a carrier can be sorted and characterized straight from the standard.',
  },
  {
    bandId: 'satcom-civil',
    objectiveId: 'lpe',
    maturity: 'W',
    note: '—',
    mechanismIds: [],
  },
  {
    bandId: 'satcom-civil',
    objectiveId: 'aj',
    maturity: 'W',
    note: 'limited',
    mechanismIds: [],
    detail:
      'Civil transponders carry little intrinsic anti-jam; uplink jamming is the classic threat model and adaptive coding and modulation is not a countermeasure to it.',
  },
  {
    bandId: 'satcom-civil',
    objectiveId: 'tfs',
    maturity: 'W',
    note: '—',
    mechanismIds: [],
  },

  // ——— SATCOM — civil LEO ——————————————————————————————————————————
  // Split from the civil row: megaconstellation links have their own
  // TRANSEC story — the downlink floods a whole ground cell, and the
  // frame structure has been publicly reverse-engineered.
  {
    bandId: 'satcom-leo',
    objectiveId: 'lpd',
    maturity: 'W',
    note: 'cell-wide downlink',
    mechanismIds: [],
    detail:
      'The spot beam illuminates a ground cell far larger than any one user, so the downlink is trivially detectable by every receiver in it. The uplink is the direction that actually matters for LPD: a directional terminal still radiates, and satellite-side monitoring can triangulate the user on the ground (Koisser et al., 2024).',
  },
  {
    bandId: 'satcom-leo',
    objectiveId: 'lpi',
    maturity: 'W',
    note: 'frames characterized',
    mechanismIds: [],
    detail:
      'The Ku-band downlink frame and synchronization structure have been blindly reverse-engineered from third-party observation and reused as navigation beacons (Humphreys et al., 2023; Kozhaya et al., 2025) — the opposite of resisting parameter analysis, and the intercept margin improves as more of the beacon is decoded.',
  },
  {
    bandId: 'satcom-leo',
    objectiveId: 'lpe',
    maturity: 'W',
    note: 'crypto above PHY',
    mechanismIds: [],
    detail:
      'Exploitation resistance rests entirely on upper-layer encryption; the physical layer adds none. The precedent is GEO, where cheap consumer equipment recovered cleartext downlink payloads at scale (Pavur et al., 2020; Zhang et al., 2025) — LEO payloads appear encrypted, but that protection lives above the PHY, which is out of TRANSEC scope.',
  },
  {
    bandId: 'satcom-leo',
    objectiveId: 'aj',
    maturity: 'R',
    note: 'beam + orbit agility',
    mechanismIds: ['beam-confinement'],
    detail:
      'Beam-hopped spot beams, constellation diversity and rapid handover give an emerging, partly demonstrated resilience (Yue et al., 2023) — but it is architectural agility, not an engineered PHY anti-jam waveform, and LEO proximity also lets a ground jammer succeed at lower power.',
  },
  {
    bandId: 'satcom-leo',
    objectiveId: 'tfs',
    maturity: 'W',
    note: '—',
    mechanismIds: [],
    detail:
      'Beam-hop schedules and per-cell traffic timing are observable externals; nothing at the PHY conceals activity patterns.',
  },

  // ——— SATCOM — military ——————————————————————————————————————————
  {
    bandId: 'satcom-military',
    objectiveId: 'lpd',
    maturity: 'E',
    note: 'spread spectrum',
    mechanismIds: ['spreading'],
    detail:
      'Deliberately engineered spread-spectrum downlinks push emissions below the detection threshold of any off-target receiver — fielded LPD, not a research result.',
  },
  {
    bandId: 'satcom-military',
    objectiveId: 'lpi',
    maturity: 'E',
    note: 'EHF secret hop',
    mechanismIds: ['hopping'],
    detail:
      'Secret EHF hop patterns are the reference fielded implementation of LPI: the observer sees energy but cannot predict where it goes next or sort it as a signal of interest.',
  },
  {
    bandId: 'satcom-military',
    objectiveId: 'lpe',
    maturity: 'E',
    note: 'noise-like signal',
    mechanismIds: ['spreading'],
    detail:
      'Without the spreading code the waveform is indistinguishable from noise, so even a captured, characterized intercept leaks very little from its externals.',
  },
  {
    bandId: 'satcom-military',
    objectiveId: 'aj',
    maturity: 'E',
    note: 'null + FHSS',
    mechanismIds: ['hopping', 'spatial-nulling'],
    detail:
      'Nulling antennas placed on the jammer combined with EHF frequency hopping are the fielded gold standard — the one cell where both regimes are mature at once.',
  },
  {
    bandId: 'satcom-military',
    objectiveId: 'tfs',
    maturity: 'E',
    note: 'continuous carrier',
    mechanismIds: ['emission-control'],
    detail:
      'Constant-envelope continuous carriers plus naval EMCON doctrine hide volume and timing behind either a steady signal or deliberate radio silence.',
  },
];
