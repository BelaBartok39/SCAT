/**
 * Persistent serving beams for the beamformed bands (5G FR2, 6G).
 *
 * These are always visible — the spatial-security argument depends on
 * the viewer seeing exactly where the beam points and who it serves.
 * "Step into the beam" must be a visible act, not a number in a panel.
 * The warden's beam math uses the same emitter→receiver axis (RECEIVERS),
 * so what you see is what the model computes.
 */

import * as THREE from 'three';
import { SCENE, signalAlpha } from './palette';
import type { BandId } from '../data/types';
import type { EmitterHandle } from './emitters';
import { RECEIVERS } from './props';
import { getBeamTexture } from './waveforms';

export const BEAM_BANDS: { id: BandId; apertureDeg: number; color: number }[] = [
  { id: 'cellular-5g', apertureDeg: 5, color: 0x818cf8 },
  { id: '6g-subthz', apertureDeg: 2.5, color: 0xf59e0b },
];

export class ServingBeams {
  readonly group = new THREE.Group();
  private mats: THREE.MeshBasicMaterial[] = [];

  constructor(scene: THREE.Scene, emitters: EmitterHandle[]) {
    for (const { id, apertureDeg, color } of BEAM_BANDS) {
      const h = emitters.find((e) => e.band.id === id)!;
      const from = h.group.position.clone();
      const to = RECEIVERS[id].pos.clone().add(new THREE.Vector3(0, 6, 0));
      const len = from.distanceTo(to);
      const r = Math.tan((apertureDeg * Math.PI) / 180) * len;

      const geo = new THREE.ConeGeometry(r, len, 20, 1, true);
      // Apex at origin, opening along -Y; then rotate -Y onto the link axis.
      geo.translate(0, -len / 2, 0);
      const mat = new THREE.MeshBasicMaterial({
        color,
        map: getBeamTexture(),
        transparent: true,
        opacity: signalAlpha(0.34),
        blending: SCENE.blending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      this.mats.push(mat);
      const cone = new THREE.Mesh(geo, mat);
      const dir = to.clone().sub(from).normalize();
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
      cone.position.copy(from);
      this.group.add(cone);

      // A bright ellipse where the beam lands, so the footprint is unmissable.
      const foot = new THREE.Mesh(
        new THREE.CircleGeometry(r * 1.15, 24),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: signalAlpha(0.3),
          blending: SCENE.blending,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      foot.rotation.x = -Math.PI / 2;
      foot.position.set(to.x, 0.6, to.z);
      this.group.add(foot);
    }
    scene.add(this.group);
  }

  /** Gentle shimmer so the beams read as live emission, not glass. */
  update(_dt: number, t: number): void {
    for (let i = 0; i < this.mats.length; i++) {
      this.mats[i]!.opacity = 0.32 + Math.sin(t * 1.7 + i) * 0.07;
    }
  }
}
