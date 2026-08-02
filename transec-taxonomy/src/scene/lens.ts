/**
 * The objective lens — the centerpiece interaction.
 *
 * Selecting LPD/LPI/LPE/AJ/TFS re-skins every emitter from the matrix:
 * maturity drives color and brightness, the cell's mechanism drives
 * which waveform geometry appears. W cells go dark. Under TFS, six of
 * eight bands are W — the scene goes near-black and the taxonomy's
 * central gap claim becomes something you see.
 */

import * as THREE from 'three';
import { CELLS } from '../data/matrix';
import { MECHANISMS } from '../data/mechanisms';
import type { Maturity, MechanismId, ObjectiveId } from '../data/types';
import { cellFor } from '../data/types';
import type { EmitterHandle } from './emitters';
import type { Waveform, WaveformKind } from './waveforms';
import { createWaveform } from './waveforms';
import { RECEIVERS } from './props';
import { getState, subscribeKeys } from '../store';

/** Scene-tuned maturity palette (brighter than the matrix fills, for glow). */
export const MATURITY_SCENE_COLOR: Record<Maturity, number> = {
  N: 0x14b8a6,
  E: 0x6366f1,
  R: 0xf59e0b,
  W: 0x374151,
};

const MATURITY_INTENSITY: Record<Maturity, number> = {
  N: 0.9,
  E: 1.0,
  R: 0.6,
  W: 0.1,
};

const BASE_COLOR = new THREE.Color(0x6366f1);
const FADE_SPEED = 2.6; // 1/s — cross-fade rate

interface Slot {
  handle: EmitterHandle;
  active: Waveform | null;
  dying: Waveform[];
  targetFade: number;
  fade: number;
}

function visualFor(mechanismIds: MechanismId[]): WaveformKind | null {
  const primary = mechanismIds[0];
  if (!primary) return null;
  return MECHANISMS.find((m) => m.id === primary)?.sceneVisual ?? null;
}

export class Lens {
  private slots: Slot[];
  private applied: ObjectiveId | null | undefined = undefined; // undefined = never applied

  constructor(emitters: EmitterHandle[]) {
    this.slots = emitters.map((handle) => ({
      handle,
      active: null,
      dying: [],
      targetFade: 0,
      fade: 0,
    }));
    subscribeKeys(['lens'], () => this.apply(getState().lens));
    this.apply(getState().lens);
  }

  private apply(lens: ObjectiveId | null): void {
    if (lens === this.applied) return;
    this.applied = lens;

    for (const slot of this.slots) {
      const { handle } = slot;

      // Retire the current waveform (cross-fade out).
      if (slot.active) {
        slot.dying.push(slot.active);
        slot.active = null;
      }

      if (!lens) {
        // Neutral view: base indigo, ambient broadcast rings on every band.
        handle.setTint(BASE_COLOR, 0.5);
        handle.setDimmed(false);
        slot.active = createWaveform('omniRings', BASE_COLOR.clone().multiplyScalar(0.8));
        slot.targetFade = 0.22; // subtle ambience — props and links carry the story now
        slot.fade = 0;
        handle.group.add(slot.active.group);
        continue;
      }

      const cell = cellFor(CELLS, handle.band.id, lens);
      const color = new THREE.Color(MATURITY_SCENE_COLOR[cell.maturity]);
      const intensity = MATURITY_INTENSITY[cell.maturity];

      handle.setTint(color, intensity);
      handle.setDimmed(cell.maturity === 'W');

      const kind = cell.maturity === 'W' ? null : visualFor(cell.mechanismIds);
      if (kind) {
        // Keyed hop patterns are the military variant; beam-type visuals
        // aim at the band's actual receiver so cone and link agree.
        const keyed = handle.band.id === 'satcom-military';
        const toReceiver = RECEIVERS[handle.band.id].pos
          .clone()
          .add(new THREE.Vector3(0, 6, 0))
          .sub(handle.group.position);
        const distance = toReceiver.length();
        const aimDir = toReceiver.clone().normalize();
        slot.active = createWaveform(kind, color, { keyed, aimDir, distance });
        slot.targetFade = intensity;
        slot.fade = 0;
        handle.group.add(slot.active.group);
      } else {
        slot.targetFade = 0;
      }
    }
  }

  /**
   * Aim every active null at the adversary's position (world coords).
   * Called by the scene each frame with the warden marker — dragging the
   * jammer visibly drags the array's null with it.
   */
  setNullTarget(worldPos: THREE.Vector3): void {
    for (const slot of this.slots) {
      if (!slot.active?.setNullDir) continue;
      const dir = worldPos
        .clone()
        .add(new THREE.Vector3(0, 12, 0))
        .sub(slot.handle.group.position)
        .normalize();
      slot.active.setNullDir(dir);
    }
  }

  /** Per-frame: advance cross-fades and animate live waveforms. */
  update(dt: number, elapsed: number): void {
    // Reduced motion: fades still resolve (the lens must work as a static
    // re-skin) but waveform animation is frozen.
    const frozen = getState().reducedMotion;
    for (const slot of this.slots) {
      if (slot.active) {
        slot.fade = Math.min(slot.targetFade, slot.fade + dt * FADE_SPEED);
        slot.active.setFade(slot.fade);
        if (!frozen) slot.active.update(dt, elapsed);
      }
      for (let i = slot.dying.length - 1; i >= 0; i--) {
        const w = slot.dying[i]!;
        // Reuse targetFade bookkeeping: dying waveforms just run down.
        const f = Math.max(0, (w as unknown as { _f?: number })._f ?? 1) - dt * FADE_SPEED;
        (w as unknown as { _f?: number })._f = f;
        if (f <= 0) {
          w.dispose();
          slot.dying.splice(i, 1);
        } else {
          w.setFade(f);
          w.update(dt, elapsed);
        }
      }
    }
  }
}
