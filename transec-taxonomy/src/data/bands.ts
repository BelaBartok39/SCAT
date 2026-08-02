/**
 * Band physics dataset.
 *
 * Source: wireless_bands_survey.pptx (Redmond, Univ. of Memphis, July 2026),
 * slides 2–9, which use one identical 7-field schema per band. Military SATCOM
 * has no slide of its own; its fields are assembled from the military fragments
 * inside slides 8–9 and the matching lines of transec_taxonomy.pptx.
 *
 * Layering convention (see PhysicsField in ./types):
 *   summary — one plain-language sentence, written here as a faithful rewording.
 *   details — the deck's own bullets, near-verbatim.
 */

import type { Band } from './types';

export const BANDS: Band[] = [
  // ——— 1. NFC —————————————————————————————————————————————————————
  {
    id: 'nfc',
    name: 'NFC — Near-Field Communication',
    shortName: 'NFC',
    freqLowHz: 13.553e6,
    freqHighHz: 13.567e6,
    tagline: '13.56 MHz · λ ≈ 22 m · range < 10 cm',
    sceneLayer: 'personal',
    physics: {
      frequencyRange: {
        summary:
          'NFC uses one fixed frequency near 13.56 MHz and only works when two devices are practically touching.',
        details: [
          '13.56 MHz (HF ISM band)',
          'λ ≈ 22 m, but operating range < 10 cm',
          'Device sits deep inside the near field (r ≪ λ/2π)',
        ],
      },
      waveCharacteristics: {
        summary:
          'The link is a shared magnetic field rather than a travelling radio wave, and it dies away so steeply with distance that the short range is set by physics, not by choice.',
        details: [
          'Inductive magnetic coupling — no propagating far-field link',
          'Field strength decays ~1/r³ → range is physics-limited',
          'Reader and tag behave as a loosely coupled transformer',
        ],
      },
      modulationAccess: {
        summary:
          'The reader sends data by switching its field strength, and a passive tag answers by loading that same field — a few hundred kilobits per second, with the reader always speaking first.',
        details: [
          'ASK (10% / 100%) with Miller or Manchester coding',
          'Passive tag replies by load modulation of the reader field',
          '106 / 212 / 424 kbps; simple reader-talks-first access',
        ],
      },
      power: {
        summary:
          'The tag carries no battery at all: it runs entirely on energy scavenged from the reader, which itself emits only a fraction of a watt.',
        details: [
          'Passive tags harvest all power from the reader field',
          'Reader field power ~100–500 mW',
          'Zero-battery operation on the tag side',
        ],
      },
      noiseInterference: {
        summary:
          'Ordinary radio traffic barely disturbs an NFC link, but nearby metal and bad alignment do — and eavesdroppers have listened in from metres away despite the centimetre design range.',
        details: [
          'Near-field link → largely immune to far-field RF interference',
          'Detuned by nearby metal; orientation-sensitive',
          'Eavesdropping demonstrated at meters despite cm-range design',
        ],
      },
      antenna: {
        summary:
          'The antenna is a flat wire coil printed into a card or phone, and what matters is how well two coils couple, not how much gain either one has.',
        details: [
          'Loop coil (magnetic antenna) — not a resonant λ-scaled radiator',
          'Flat printed spirals in cards and phone housings',
          'Coil geometry sets coupling, not gain',
        ],
      },
      applications: {
        summary:
          'Tap-to-pay, transit gates and door badges, plus cheap unpowered tags and the handshake that gets Bluetooth or Wi-Fi started.',
        details: [
          'Contactless payment (EMV), transit, access control',
          'Passive tags and smart posters',
          'Pairing bootstrap for Bluetooth / Wi-Fi',
        ],
      },
      benefitsLimitations: {
        summary:
          'Having to touch is itself a security feature, and the hardware is cheap and battery-free — but anything faster or further away needs a real radiating band.',
        details: [
          '+ Proximity acts as built-in access control; passive, cheap',
          '− Centimeter range, kbps rates',
          '→ Anything beyond touch-range or low-rate needs a radiating band',
        ],
      },
    },
    refIds: ['iso18092'],
  },

  // ——— 2. Bluetooth / BLE ——————————————————————————————————————————
  {
    id: 'bluetooth',
    name: 'Bluetooth / BLE',
    shortName: 'BT/BLE',
    freqLowHz: 2.4e9,
    freqHighHz: 2.4835e9,
    tagline: '2.400–2.4835 GHz · λ ≈ 12.5 cm · 1–100 m',
    sceneLayer: 'personal',
    physics: {
      frequencyRange: {
        summary:
          'Bluetooth lives in a licence-free slice of spectrum just above 2.4 GHz, chopped into dozens of narrow channels, and reaches anywhere from a metre to a hundred.',
        details: [
          '2.400–2.4835 GHz (global unlicensed ISM)',
          'Classic: 79 × 1 MHz channels; BLE: 40 × 2 MHz',
          'Range 1–100 m depending on power class',
        ],
      },
      waveCharacteristics: {
        summary:
          'The signal passes through walls reasonably well and bounces around indoors, and at wearable power levels even a human body in the way is significant.',
        details: [
          'UHF far-field; moderate wall penetration',
          'Rich indoor multipath; narrowband channels fade flat',
          'Body shadowing matters at wearable power levels',
        ],
      },
      modulationAccess: {
        summary:
          'Bluetooth shifts frequency slightly to carry bits and jumps between channels 1600 times a second — a scheduling trick that is, in effect, the first consumer-grade transmission-security relative.',
        details: [
          'GFSK (BLE / BR); π/4-DQPSK and 8DPSK for EDR (≤3 Mbps)',
          'FHSS at 1600 hops/s (Classic); adaptive hopping in BLE',
          'TDD master–slave scheduling — an early consumer TRANSEC relative',
        ],
      },
      power: {
        summary:
          'Transmit power runs from a hundred milliwatts down to one, and BLE duty-cycles so hard that a coin cell can last years.',
        details: [
          'Class 1: 100 mW · Class 2: 2.5 mW · Class 3: 1 mW',
          'BLE duty-cycled to ~µW–mW average',
          'Years on a coin cell is the defining design target',
        ],
      },
      noiseInterference: {
        summary:
          'The band is shared with Wi-Fi, Zigbee and microwave ovens, so the practical limit is other people\'s traffic rather than thermal noise; hopping simply avoids the busiest channels.',
        details: [
          'Shares 2.4 GHz with Wi-Fi, Zigbee, microwave ovens',
          'Adaptive frequency hopping blacklists occupied channels',
          'Interference-limited, not noise-limited, in practice',
        ],
      },
      antenna: {
        summary:
          'The wavelength is small enough to print the antenna inside the device, and it radiates in all directions with essentially no gain, so range depends on how sensitive the receiver is.',
        details: [
          'Chip, PIFA, or meander antennas — λ small enough to embed',
          'Near-omnidirectional, ~0 dBi',
          'No aperture to spare → link budget leans on receiver sensitivity',
        ],
      },
      applications: {
        summary:
          'Headphones, keyboards and wearables; beacons, sensors and mesh lighting; car keys and medical devices.',
        details: [
          'Audio, HID peripherals, wearables',
          'BLE beacons, sensors, mesh lighting',
          'Automotive keys, medical devices',
        ],
      },
      benefitsLimitations: {
        summary:
          'It is cheap, everywhere and sips power, but it is slow, short-range and fighting for a congested band — so heavier needs move to Wi-Fi or cellular.',
        details: [
          '+ Ultra-low power, negligible cost, ubiquitous',
          '− ≤3 Mbps, short range, ISM congestion',
          '→ Throughput and coverage needs push to Wi-Fi / cellular',
        ],
      },
    },
    refIds: ['bt-core-61'],
  },

  // ——— 3. Wi-Fi (802.11) ————————————————————————————————————————————
  {
    id: 'wifi',
    name: 'Wi-Fi (802.11)',
    shortName: 'Wi-Fi',
    freqLowHz: 2.4e9,
    freqHighHz: 7.125e9,
    tagline: '2.4 / 5 / 6 GHz (+60 GHz) · channels 20→320 MHz',
    sceneLayer: 'local',
    physics: {
      frequencyRange: {
        summary:
          'Wi-Fi spans three unlicensed bands — plus a 60 GHz variant — with channels that have grown sixteen-fold, and covers roughly a floor of a building.',
        details: [
          '2.4 GHz, 5 GHz, 6 GHz (Wi-Fi 6E/7); 60 GHz in 802.11ad/ay',
          'Channel widths 20 → 320 MHz (Wi-Fi 7)',
          '~50–100 m indoors; 2.4 GHz reaches farthest',
        ],
      },
      waveCharacteristics: {
        summary:
          'Indoors the signal arrives by many reflected paths at once; splitting it across many narrow subcarriers turns that difficult channel into a set of easy ones, and the higher bands trade range for rate.',
        details: [
          'Indoor multipath-rich, frequency-selective channels',
          'OFDM subcarriers turn one hard channel into many easy ones',
          '5/6 GHz penetrate walls worse than 2.4 — range/rate trade',
        ],
      },
      modulationAccess: {
        summary:
          'Data rides on many parallel subcarriers with very dense constellations, several users can be served at once in space, and everyone must listen before transmitting.',
        details: [
          'OFDM / OFDMA; up to 4096-QAM in Wi-Fi 7',
          'MU-MIMO spatial multiplexing',
          'CSMA/CA listen-before-talk — polite, but contention-bound',
        ],
      },
      power: {
        summary:
          'Regulators cap radiated power between roughly a tenth of a watt and a watt; access points are plugged in while clients must conserve battery.',
        details: [
          '~100 mW–1 W EIRP under regulatory caps',
          'APs mains-powered; clients battery-constrained',
          'Target-wake-time (Wi-Fi 6) trims client energy',
        ],
      },
      noiseInterference: {
        summary:
          'Because the spectrum is free to use, the binding constraint is competing traffic rather than noise, with extra radar-avoidance rules at 5 GHz.',
        details: [
          'Unlicensed → co-channel contention is the real limit',
          'DFS radar-avoidance constraints at 5 GHz',
          'Dense deployments become interference-limited',
        ],
      },
      antenna: {
        summary:
          'Access points use a handful of ordinary omnidirectional antennas and steer roughly by measuring the channel; capacity comes from the number of parallel streams, not antenna size.',
        details: [
          '2×2 up to 8×8 MIMO; omni dipoles in APs',
          'Implicit beamforming from channel sounding',
          'Spatial streams, not aperture, drive capacity',
        ],
      },
      applications: {
        summary:
          'Local network access almost everywhere, mesh and fixed-wireless links, and at 60 GHz short high-rate links for headsets and docking.',
        details: [
          'LAN access everywhere; cellular offload',
          'Mesh backhaul, fixed wireless in unlicensed bands',
          '60 GHz: AR/VR links, wireless docking',
        ],
      },
      benefitsLimitations: {
        summary:
          'It delivers gigabits at consumer prices and is universally adopted, but nothing guarantees service quality — throughput collapses under crowding, and wide-area mobility belongs to cellular.',
        details: [
          '+ Multi-Gbps at consumer cost, universal adoption',
          '− No guaranteed QoS; contention collapses under load; limited range',
          "→ Wide-area coverage and mobility are cellular's job",
        ],
      },
    },
    refIds: ['ieee80211be'],
  },

  // ——— 4. Cellular 3G → 4G ——————————————————————————————————————————
  {
    id: 'cellular-3g-4g',
    name: 'Cellular I: 3G → 4G',
    shortName: '3G/4G',
    freqLowHz: 600e6,
    freqHighHz: 3.5e9,
    tagline: '600 MHz – 3.5 GHz licensed spectrum · WCDMA → OFDMA',
    sceneLayer: 'cellular',
    physics: {
      frequencyRange: {
        summary:
          'Both generations use licensed spectrum below about 3.5 GHz, but 3G was locked to fixed 5 MHz carriers while 4G can size its carrier and glue several together.',
        details: [
          '3G — UMTS / WCDMA (≈2001): bands 850–2100 MHz; 5 MHz carriers',
          '4G — LTE / LTE-A (≈2010): bands 600 MHz–3.5 GHz; 1.4–20 MHz carriers + aggregation to 100 MHz',
        ],
      },
      waveCharacteristics: {
        summary:
          'Both fight the same echoing outdoor channel, but 3G gathered the echoes with a specialised receiver while 4G simply guards against them and corrects each subcarrier separately.',
        details: [
          '3G PHY machinery: RAKE receivers combine multipath; soft handover',
          '4G PHY machinery: cyclic prefix + per-subcarrier equalization replace RAKE; all-IP flat network',
          'Wider bandwidth makes RAKE multipath combining harder — a core reason the RAKE approach did not scale',
        ],
      },
      modulationAccess: {
        summary:
          'In 3G everyone transmits over the whole band at once and is told apart by a code; in 4G the band is divided into orthogonal subcarriers handed out per user, which is what let rates climb from tens of megabits to a gigabit.',
        details: [
          '3G access: DSSS CDMA at 3.84 Mcps — all users share the band, separated by code',
          '3G modulation: QPSK → 16-QAM (HSPA); 0.4–42 Mbps (HSPA+)',
          '4G access: OFDMA downlink; SC-FDMA uplink (lower PAPR spares the handset PA)',
          '4G modulation: up to 256-QAM; 2×2–4×4 MIMO; 100 Mbps–1 Gbps class',
        ],
      },
      power: {
        summary:
          'Handsets transmit at roughly a quarter of a watt in both generations, but 3G had to regulate that power constantly and precisely, because in a shared-code system every user is interference to every other.',
        details: [
          '3G power: UE up to 24 dBm, tightly controlled — every user is everyone else\'s interference',
          '3G fast power control fights the near–far problem',
          '4G power: UE 23 dBm; eNB tens of watts per sector',
        ],
      },
      noiseInterference: {
        summary:
          'A 3G cell gets noisier for everyone with each extra user, which caps its capacity; 4G removes that self-interference by keeping users on separate subcarriers.',
        details: [
          'CDMA capacity is intra-cell-interference-limited: every added user raises the noise floor for all others',
          'OFDMA sidesteps this — orthogonal subcarriers eliminate in-cell interference and make equalization trivial, so bandwidth and MIMO order can scale',
          '3G soft handover and fast power control exist to manage that shared noise floor',
        ],
      },
      antenna: {
        summary:
          'Both use sectored antennas on towers, but 3G handsets had a single antenna, whereas 4G made multiple antennas at both ends the main source of capacity.',
        details: [
          '3G antenna: sector antennas at cell sites; single antenna in handsets',
          '4G antenna: cross-polarized sector arrays; MIMO becomes the capacity engine',
        ],
      },
      applications: {
        summary:
          'Mobile broadband for phones — and the jump between generations was forced by demand, since smartphone video needs tens of megabits rather than hundreds of kilobits.',
        details: [
          'Applications made the jump non-optional: smartphone video needed tens of Mbps, not hundreds of kbps',
          '3G HSPA+ delivered 0.4–42 Mbps; 4G LTE-A reaches the 100 Mbps–1 Gbps class',
          '4G is an all-IP flat network — voice, video and data over one packet core',
        ],
      },
      benefitsLimitations: {
        summary:
          'Orthogonal subcarriers let bandwidth and antenna count keep scaling where the older code-sharing scheme was capped by its own interference — but scaling further needs wider carriers and much larger arrays.',
        details: [
          '+ OFDMA lets bandwidth and MIMO order scale, where CDMA capacity was interference-capped',
          '− 3G capacity degrades as users are added, and wideband CDMA equalization gets harder',
          '→ Wider carriers and massive arrays are the next step — 5G NR',
        ],
      },
    },
    refIds: ['3gpp-ts25211', '3gpp-ts36211'],
  },

  // ——— 5. Cellular 5G NR ————————————————————————————————————————————
  {
    id: 'cellular-5g',
    name: 'Cellular II: 5G NR',
    shortName: '5G NR',
    freqLowHz: 410e6,
    freqHighHz: 71e9,
    tagline: 'FR1: 0.41–7.125 GHz · FR2: 24–71 GHz',
    sceneLayer: 'cellular',
    physics: {
      frequencyRange: {
        summary:
          'One air interface covers everything from sub-gigahertz coverage spectrum up to millimetre waves, where channels are enormous but cells shrink to a few hundred metres of mostly line-of-sight.',
        details: [
          'FR1 (sub-6/7): coverage + capacity workhorse',
          'FR2 (mmWave, λ ≈ 4–12 mm): 400 MHz channels',
          'FR2 cells: ~100–500 m outdoor, LOS-favored',
        ],
      },
      waveCharacteristics: {
        summary:
          'At millimetre waves the signal behaves almost like light — hands, bodies and leaves block it, air and rain absorb it, and bending around obstacles stops working, so blockage becomes the defining feature of the channel.',
        details: [
          'FR2 is quasi-optical: hands, bodies, foliage block it',
          'O₂ absorption near 60 GHz; rain fade grows with f',
          'Diffraction stops helping → blockage becomes the channel model',
        ],
      },
      modulationAccess: {
        summary:
          'Subcarrier spacing and slot length are configurable so the same waveform can serve either huge throughput or millisecond latency — and choosing and tracking a beam is now part of connecting at all.',
        details: [
          'CP-OFDM, flexible numerology (15–120 kHz subcarriers)',
          'Up to 256-QAM; scalable slots for URLLC (~1 ms)',
          'Beam management is part of the access procedure itself',
        ],
      },
      power: {
        summary:
          'Handsets stay near a quarter of a watt while base stations focus watts into narrow beams, and that focusing gain is what recovers the loss suffered at millimetre waves.',
        details: [
          'UE 23–26 dBm; gNB arrays concentrate watts into beams',
          'Beamforming gain claws back mmWave path loss',
          'Energy per bit improves even as absolute power rises',
        ],
      },
      noiseInterference: {
        summary:
          'Very wide channels let in proportionally more thermal noise, oscillator imperfections start to matter at millimetre waves, and interference is now managed by pointing beams rather than by planning cells.',
        details: [
          'Wide channels → thermal-noise-limited (kTB grows with B)',
          'Phase noise becomes a real impairment at FR2',
          'Dense reuse managed by beams, not just cell planning',
        ],
      },
      antenna: {
        summary:
          'Arrays of dozens of elements are standard at mid-band, and because a millimetre-wave wavelength is about a centimetre, a whole phased array fits along the edge of a phone — that packing is the only reason the band is usable.',
        details: [
          'Massive MIMO (e.g., 64T64R) standard at mid-band',
          'λ ≈ 1 cm → phased arrays fit inside a phone edge',
          'Aperture scaling is the whole reason mmWave works at all',
        ],
      },
      applications: {
        summary:
          'Fast mobile broadband and home fixed-wireless, private factory networks, control loops that must not lag, and very large sensor populations.',
        details: [
          'eMBB, fixed wireless access, private industrial 5G',
          'URLLC: automation, vehicular',
          'mMTC: massive sensor populations',
        ],
      },
      benefitsLimitations: {
        summary:
          'It brings gigabit rates, low latency and per-service network slices, but millimetre-wave coverage is small and easily broken, so mid-band carries the real traffic and mmWave stays a hotspot tool.',
        details: [
          '+ Multi-Gbps, low latency, network slicing',
          '− FR2 coverage is tiny and fragile → densification cost',
          '→ Mid-band carries most real traffic; mmWave stays a hotspot tool',
        ],
      },
    },
    refIds: ['3gpp-ts38211', 'itu-p676'],
  },

  // ——— 6. 6G / sub-THz ——————————————————————————————————————————————
  {
    id: '6g-subthz',
    name: 'Cellular III: 6G and the sub-THz frontier',
    shortName: '6G',
    freqLowHz: 7e9,
    freqHighHz: 300e9,
    tagline: '7–24 GHz mid-band + 100–300 GHz research',
    sceneLayer: 'cellular',
    physics: {
      frequencyRange: {
        summary:
          'The first 6G spectrum is likely a mid-band slice around 7–24 GHz, while the research frontier sits at 100–300 GHz, chasing terabit rates over ranges measured in metres to a few hundred metres.',
        details: [
          'Upper mid-band 7–24 GHz: likely first 6G spectrum',
          'Sub-THz 100–300 GHz (λ ≈ 1–3 mm): target 100 Gbps–1 Tbps',
          'Sub-THz range: meters to a few hundred meters',
        ],
      },
      waveCharacteristics: {
        summary:
          'Water vapour absorbs whole slices of this spectrum, leaving usable windows between them; the signal travels like a light beam and scatters off rough surfaces — and that same absorption caps how far an eavesdropper can listen.',
        details: [
          'Molecular (H₂O) absorption lines carve usable spectral windows',
          'Quasi-optical; scattering off surface roughness matters',
          'Absorption limits eavesdropping distance — a TRANSEC upside',
        ],
      },
      modulationAccess: {
        summary:
          'No waveform has been settled on yet — several candidates compete, and one active idea is a single signal that both communicates and senses its surroundings.',
        details: [
          'Candidates: OFDM variants, single-carrier + equalization, OTFS',
          'ISAC: one waveform for sensing and communication',
          'Nothing standardized — waveform choice is an open problem',
        ],
      },
      power: {
        summary:
          'Amplifiers get drastically less efficient this high in frequency, so the real limit is energy spent per bit rather than peak speed, and new front-end technologies are still being researched.',
        details: [
          'PA efficiency collapses toward sub-THz (semiconductor limits)',
          'Energy-per-bit, not peak rate, is the binding constraint',
          'Photonic and hybrid front-ends under active research',
        ],
      },
      noiseInterference: {
        summary:
          'Imperfect hardware contributes as much corruption as thermal noise does, the absorbing atmosphere re-radiates its own noise, and interference between users is rare because each link is a narrow pencil.',
        details: [
          'Hardware impairments + phase noise rival thermal noise',
          'Molecular absorption re-emission adds a noise floor',
          'Interference scarce — beams are pencils, cells are bubbles',
        ],
      },
      antenna: {
        summary:
          'Hundreds to thousands of elements fit into a few square centimetres, producing pencil-thin beams close enough to the antenna that near-field effects matter, with reconfigurable surfaces proposed to steer signals around obstacles.',
        details: [
          'Ultra-massive arrays: 100s–1000s of elements in cm²',
          'Pencil beams; near-field effects enter the link budget',
          'RIS proposed to route around blockage',
        ],
      },
      applications: {
        summary:
          'Fibre-speed wireless links between network nodes, very short terabit hops such as kiosks or chip-to-chip, and combined sensing-and-communication systems.',
        details: [
          'Wireless backhaul / fronthaul at fiber-class rates',
          'Short-range Tbps links, kiosk / chip-to-chip',
          'Joint sensing + comms (ISAC)',
        ],
      },
      benefitsLimitations: {
        summary:
          'Nowhere else offers this much continuous bandwidth, but range, blockage, amplifier efficiency and immature hardware mean it will likely serve specific links rather than blanket coverage.',
        details: [
          '+ Contiguous GHz-scale bandwidth exists nowhere else',
          '− Range, blockage, PA efficiency, immature hardware',
          '→ Likely niche links + densification, not blanket coverage',
        ],
      },
    },
    refIds: ['itu-m2160', 'itu-m2541', 'rappaport2019', 'ma2018'],
  },

  // ——— 7. SATCOM — civil ————————————————————————————————————————————
  {
    id: 'satcom-civil',
    name: 'Satellite Communications — civil',
    shortName: 'SAT civ',
    freqLowHz: 1e9,
    freqHighHz: 50e9,
    tagline: 'L / S / C / X / Ku / Ka / Q-V · 160 km → 35,786 km',
    sceneLayer: 'geo',
    physics: {
      frequencyRange: {
        summary:
          'Satellite links use a ladder of bands from about 1 GHz up to 50 GHz, and the choice of orbit — from a few hundred kilometres up to geostationary altitude — sets delay, coverage and how many satellites are needed.',
        details: [
          'L/S (1–4 GHz): mobile SATCOM, GNSS — rain-tolerant',
          'C (4/6) legacy fixed; X (7/8) military; Ku (12/14) VSAT/DTH',
          'Ka (20/30) HTS; Q/V (40/50) feeders',
          'Orbits: LEO 160–2,000 km (Starlink ≈ 550 km) · MEO 2,000–35,786 km (GPS: 20,200 km) · GEO 35,786 km, equatorial',
        ],
      },
      waveCharacteristics: {
        summary:
          'The overwhelming fact of a satellite link is how much signal simply spreads out over the distance; rain absorbs more of it the higher the band goes, and the orbit decides whether the round trip takes tens of milliseconds or half a second.',
        details: [
          'Free-space path loss dominates: ~210 dB, GEO at Ka',
          'Rain fade grows steeply with band (Ka ≫ C)',
          'Scintillation, low-elevation atmospheric effects',
          'Round-trip latency ~20–40 ms (LEO) · ~130–250 ms (MEO) · ~500–600 ms (GEO)',
        ],
      },
      modulationAccess: {
        summary:
          'The civil standard adapts its coding and constellation to conditions, favouring phase-ring formats whose steady envelope suits a hard-driven amplifier — and low-orbit systems must hand users off continuously as satellites race past.',
        details: [
          'DVB-S2X: QPSK → 32APSK with adaptive coding & modulation',
          'APSK favored: nearly constant envelope suits saturated amps',
          'LEO: satellite moves ~7.6 km/s → large, fast-changing Doppler; continuous handover between satellites and beams',
          'GEO appears fixed in the sky → no tracking, cheap fixed dishes',
        ],
      },
      power: {
        summary:
          'Everything is negotiated in fractions of a decibel: amplifiers are run flat out for efficiency, the whole downlink is ultimately capped by how much solar power the spacecraft can collect, and low orbits ease the budget enough for small user terminals.',
        details: [
          'TWTA/SSPA run near saturation for efficiency',
          'Link budget in Eb/N0 and G/T, not raw SNR',
          'Solar-power ceiling caps the whole downlink budget',
          'Lowest free-space path loss at LEO → small user terminals work',
        ],
      },
      noiseInterference: {
        summary:
          'These links are limited by thermal noise and by how warm the antenna looks at the sky, and neighbouring satellites must be coordinated internationally to avoid interfering with one another.',
        details: [
          'Thermal-noise-limited; antenna temperature matters',
          'Adjacent-satellite interference → coordination regimes (ITU)',
          'Uplink jamming is the classic military threat model',
        ],
      },
      antenna: {
        summary:
          'Fixed dishes work for satellites that hold still in the sky, while flat electronically steered arrays are needed to follow fast-moving low-orbit satellites; spacecraft themselves paint many small spot beams to reuse the same spectrum.',
        details: [
          'High-gain parabolics for fixed GEO',
          'Electronically steered phased arrays track LEO (Starlink terminal)',
          'Multibeam spot arrays on the spacecraft reuse spectrum',
        ],
      },
      applications: {
        summary:
          'Broadband and broadcast from high-throughput and mega-constellation systems, satellite navigation, backhaul, ships and aircraft, and government traffic.',
        details: [
          'Broadband (HTS, LEO megaconstellations), broadcast',
          'GNSS, backhaul, maritime/aero, IoT',
          'Military and government protected comms',
        ],
      },
      benefitsLimitations: {
        summary:
          'Satellites reach places nothing else does, at the price of delay, Doppler, handover complexity, spectrum coordination and cost — and the orbit choice is a straight trade of link quality against constellation size.',
        details: [
          '+ Coverage where nothing else reaches',
          '− GEO delay; LEO Doppler + handover; spectrum coordination; cost',
          'The orbit trade: lower orbit buys latency and link budget but costs constellation size, Doppler compensation, and handover complexity',
          '→ Converging with terrestrial: 5G NTN puts handsets on satellites',
        ],
      },
    },
    refIds: ['etsi-dvbs2x', 'itu-p676', 'tedeschi2022', 'salim2025'],
  },

  // ——— 8. SATCOM — military ————————————————————————————————————————
  // No dedicated survey slide; assembled from the military fragments in
  // slides 8–9 of the survey deck and the corresponding taxonomy-deck lines.
  // Details are deliberately short where the source material is thin.
  {
    id: 'satcom-military',
    name: 'Satellite Communications — military',
    shortName: 'SAT mil',
    freqLowHz: 7e9,
    freqHighHz: 45e9,
    tagline: 'X / Ka / EHF · 7–45 GHz · protected government SATCOM',
    sceneLayer: 'geo',
    physics: {
      frequencyRange: {
        summary:
          'Protected government links sit in bands reserved for military use — X-band and the higher extremely-high-frequency allocations — rather than in the commercial slots below them.',
        details: [
          'X (7/8) military — the reserved government fixed-satellite allocation',
          'Ka (20/30) and EHF used for protected and wideband systems',
          'Same GEO geometry as civil SATCOM: 35,786 km, ~210 dB path loss at Ka',
        ],
      },
      waveCharacteristics: {
        summary:
          'The propagation is the same as any satellite link — dominated by spreading loss and, at the higher bands, by rain — but higher frequencies are chosen partly because their wide bandwidth is what makes spreading and hopping possible.',
        details: [
          'Free-space path loss dominates; rain fade grows steeply with band (Ka ≫ C)',
          'Wide EHF allocations supply the bandwidth that spreading and hopping consume',
        ],
      },
      modulationAccess: {
        summary:
          'The defining feature is deliberate spreading: signals hop across a wide band on a secret pattern, or are spread into a noise-like waveform, so an observer cannot predict or characterise them.',
        details: [
          'Military: FHSS at EHF for protected SATCOM; DSSS ranging',
          'Secret hop patterns are the reference implementation of fielded LPI',
          'Engineered spread-spectrum downlinks push emissions below detectability for off-target receivers',
        ],
      },
      power: {
        summary:
          'The same solar-limited, decibel-by-decibel link budget applies, but power is spent buying margin against jamming rather than raw throughput.',
        details: [
          'Link budget in Eb/N0 and G/T; solar-power ceiling caps the downlink budget',
          'Spread-spectrum processing gain raises the jammer\'s required power by the spreading factor',
        ],
      },
      noiseInterference: {
        summary:
          'Beyond ordinary thermal noise, the design assumption is a hostile transmitter: deliberate jamming of the uplink is the standard threat these systems are built against.',
        details: [
          'Uplink jamming is the classic military threat model',
          'Thermal-noise-limited otherwise; antenna temperature matters',
        ],
      },
      antenna: {
        summary:
          'Terminals use antennas that can steer a pattern null onto a jammer, which together with hopping is the established fielded defence.',
        details: [
          'Nulling antennas plus EHF hopping are the fielded gold standard',
          'High-gain parabolics and electronically steered arrays, as in civil SATCOM',
        ],
      },
      applications: {
        summary:
          'Military and government communications that must keep working, and stay unremarkable, under deliberate interference.',
        details: [
          'Military and government protected comms',
          'Naval EMCON doctrine: continuous-carrier and radio-silence practice',
        ],
      },
      benefitsLimitations: {
        summary:
          'This is the only band where all five transmission-security objectives are actually fielded together, but it costs dedicated spectrum, bespoke hardware and bandwidth spent on protection rather than data.',
        details: [
          '+ The only full-stack TRANSEC exemplar: spreading, hopping, nulling and emission control together',
          '− Dedicated spectrum and bespoke terminals; spreading gain is bandwidth not spent on throughput',
          '→ The reference point civil systems are measured against',
        ],
      },
    },
    refIds: ['tedeschi2022', 'salim2025', 'cnssi4009'],
  },
];
