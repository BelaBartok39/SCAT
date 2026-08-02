/**
 * The nine PHY mechanisms on the MECHANISM axis.
 *
 * Source: transec_taxonomy.pptx — slide 3 (the axis itself) and slide 10
 * (the two regimes: security built in the waveform vs. security from
 * geometry and physics).
 */

import type { Mechanism } from './types';

export const MECHANISMS: Mechanism[] = [
  {
    id: 'spreading',
    name: 'Spreading',
    regime: 'signal-domain',
    sceneVisual: 'spreadHaze',
    description:
      'Direct-sequence spreading trades bandwidth for processing gain, pushing signal energy down toward the noise floor. With a secret code the waveform looks noise-like; with a public one it only buys margin.',
  },
  {
    id: 'hopping',
    name: 'Frequency hopping',
    regime: 'signal-domain',
    sceneVisual: 'hopScatter',
    description:
      'The carrier moves across a channel set faster than an adversary can track. A secret sequence denies parameter analysis and outruns a follower jammer; a published one only provides coexistence.',
  },
  {
    id: 'power-control',
    name: 'Power control',
    regime: 'signal-domain',
    sceneVisual: 'omniRings',
    description:
      'Transmit no more power than the link needs, shrinking the radius at which anyone else can hear it. It is a detection-range mechanism, not jam resistance.',
  },
  {
    id: 'beam-confinement',
    name: 'Beam confinement',
    regime: 'propagation-spatial',
    sceneVisual: 'pencilBeam',
    description:
      'Phased arrays concentrate energy into a narrow cone, so a warden off-axis observes nothing and an off-axis jammer couples almost no power in. Robustness in angle is paid for with fragility to blockage.',
  },
  {
    id: 'spatial-nulling',
    name: 'Spatial nulling',
    regime: 'propagation-spatial',
    sceneVisual: 'nulledLobe',
    description:
      'Adaptive antennas and massive MIMO place a pattern null on a specific direction — an eavesdropper for LPE, a jammer for AJ. It scales directly with spatial degrees of freedom.',
  },
  {
    id: 'wiretap-coding',
    name: 'Wiretap coding',
    regime: 'signal-domain',
    sceneVisual: 'spreadHaze',
    description:
      "Coding that exploits a channel advantage so the eavesdropper's equivocation stays high (Wyner, 1975). Channel-based key generation from reciprocal randomness belongs to the same PHY-secrecy family.",
  },
  {
    id: 'artificial-noise',
    name: 'Artificial noise',
    regime: 'signal-domain',
    sceneVisual: 'nulledLobe',
    description:
      "Spend part of the power budget on noise injected into the eavesdropper's subspace, degrading only their channel and not the intended receiver's (Goel & Negi, 2008).",
  },
  {
    id: 'absorption',
    name: 'Molecular absorption',
    regime: 'propagation-spatial',
    sceneVisual: 'absorptionFalloff',
    description:
      'At sub-THz, molecular absorption lines cut the link off sharply with range, so eavesdropping distance is limited by the atmosphere itself. Covertness supplied by propagation rather than by the waveform.',
  },
  {
    id: 'emission-control',
    name: 'Emission control',
    regime: 'signal-domain',
    sceneVisual: 'constantCarrier',
    description:
      'Manage when and how much you emit: EMCON radio silence, cover traffic, and constant-envelope continuous carriers that hide volume and timing behind a steady signal.',
  },
];
