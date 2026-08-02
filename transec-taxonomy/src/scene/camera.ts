/**
 * Camera fly-to targets and easing. Used by the ribbon, matrix
 * cross-navigation, and emitter focus.
 */

import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export interface FlyTarget {
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
}

interface FlightState {
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
  t: number;
  duration: number;
}

export class CameraDirector {
  private flight: FlightState | null = null;

  constructor(
    private camera: THREE.PerspectiveCamera,
    private controls: OrbitControls,
    private reducedMotion: () => boolean,
  ) {}

  flyTo(target: FlyTarget, duration = 1.4): void {
    if (this.reducedMotion()) {
      // Reduced motion: jump, don't glide.
      this.camera.position.copy(target.position);
      this.controls.target.copy(target.lookAt);
      this.controls.update();
      return;
    }
    this.flight = {
      fromPos: this.camera.position.clone(),
      toPos: target.position.clone(),
      fromTarget: this.controls.target.clone(),
      toTarget: target.lookAt.clone(),
      t: 0,
      duration,
    };
  }

  cancel(): void {
    this.flight = null;
  }

  get flying(): boolean {
    return this.flight !== null;
  }

  /** Advance the flight; call once per frame. */
  update(dt: number): void {
    const f = this.flight;
    if (!f) return;
    f.t += dt / f.duration;
    if (f.t >= 1) {
      this.camera.position.copy(f.toPos);
      this.controls.target.copy(f.toTarget);
      this.flight = null;
    } else {
      // easeInOutCubic
      const e = f.t < 0.5 ? 4 * f.t ** 3 : 1 - (-2 * f.t + 2) ** 3 / 2;
      this.camera.position.lerpVectors(f.fromPos, f.toPos, e);
      this.controls.target.lerpVectors(f.fromTarget, f.toTarget, e);
    }
    this.controls.update();
  }
}
