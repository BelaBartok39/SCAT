/**
 * Emitter nodes — one per band, positioned by scene layer.
 * Each emitter: a core mesh (raycast target), a glow sprite, and a
 * billboard label. The lens phase re-skins these via EmitterHandle.
 */

import * as THREE from 'three';
import { BANDS } from '../data/bands';
import type { Band, BandId } from '../data/types';
import { LAYER_HEIGHTS } from './layers';

export interface EmitterHandle {
  band: Band;
  group: THREE.Group;
  core: THREE.Mesh;
  glow: THREE.Sprite;
  label: THREE.Sprite;
  /** Anchor the camera flies to when focusing this emitter. */
  focus: { position: THREE.Vector3; lookAt: THREE.Vector3 };
  setTint(color: THREE.Color, intensity: number): void;
  setDimmed(dimmed: boolean): void;
}

/** Hand-placed positions: ground personal cluster → towers → orbit. */
const POSITIONS: Record<BandId, [number, number, number]> = {
  nfc: [-240, LAYER_HEIGHTS.personal, 130],
  bluetooth: [-140, LAYER_HEIGHTS.personal + 4, 170],
  wifi: [-30, LAYER_HEIGHTS.local, 130],
  'cellular-3g-4g': [90, LAYER_HEIGHTS.cellular, 110],
  'cellular-5g': [200, LAYER_HEIGHTS.cellular, 150],
  '6g-subthz': [268, LAYER_HEIGHTS.cellular - 6, 60],
  'satcom-civil': [-130, LAYER_HEIGHTS.geo, -150],
  'satcom-military': [150, LAYER_HEIGHTS.geo, -120],
};

const BASE_COLOR = new THREE.Color(0x6366f1);

function makeLabelSprite(text: string, sub: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const scale = 4; // supersample for crisp text
  const probe = canvas.getContext('2d')!;
  probe.font = '700 17px Inter, sans-serif';
  const wText = probe.measureText(text).width;
  probe.font = '500 11px "JetBrains Mono", monospace';
  const wSub = probe.measureText(sub).width;
  const w = Math.ceil(Math.max(wText, wSub, 120)) + 30; // padding
  const h = 64;

  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);

  ctx.fillStyle = 'rgba(12, 12, 26, 0.78)';
  ctx.beginPath();
  ctx.roundRect(4, 4, w - 8, h - 8, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#e0e0f0';
  ctx.font = '700 17px Inter, sans-serif';
  ctx.fillText(text, 14, 28);
  ctx.fillStyle = '#06b6d4';
  ctx.font = '500 11px "JetBrains Mono", monospace';
  ctx.fillText(sub, 14, 48);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  // World scale tracks the canvas aspect so text is never squashed or clipped.
  const worldH = 15;
  sprite.scale.set((w / h) * worldH, worldH, 1);
  sprite.userData.baseScale = { x: (w / h) * worldH, y: worldH };
  return sprite;
}

function makeGlowSprite(): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.28)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: BASE_COLOR,
    }),
  );
  sprite.scale.set(30, 30, 1);
  return sprite;
}

export function buildEmitters(scene: THREE.Scene): EmitterHandle[] {
  const handles: EmitterHandle[] = [];

  for (const band of BANDS) {
    const [x, y, z] = POSITIONS[band.id];
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.name = `emitter-${band.id}`;

    const isOrbital = band.sceneLayer === 'geo' || band.sceneLayer === 'leo';

    // Core: satellites get boxes with panels, terrestrial get icosahedra.
    const coreGeo = isOrbital
      ? new THREE.BoxGeometry(11, 11, 11)
      : new THREE.IcosahedronGeometry(8, 1);
    const coreMat = new THREE.MeshStandardMaterial({
      color: BASE_COLOR.clone(),
      emissive: BASE_COLOR.clone(),
      emissiveIntensity: 0.5,
      roughness: 0.4,
      metalness: 0.3,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.userData.bandId = band.id;
    group.add(core);

    if (isOrbital) {
      // Solar panels
      const panelMat = new THREE.MeshStandardMaterial({
        color: 0x2438a0,
        emissive: 0x16205a,
        roughness: 0.6,
      });
      for (const side of [-1, 1]) {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(18, 0.9, 9), panelMat);
        panel.position.x = side * 16;
        group.add(panel);
      }
    } else {
      // Terrestrial mast down to the ground
      const mast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.9, y, 6),
        new THREE.MeshBasicMaterial({ color: 0x30324e, transparent: true, opacity: 0.8 }),
      );
      mast.position.y = -y / 2;
      group.add(mast);
    }

    const glow = makeGlowSprite();
    group.add(glow);

    const label = makeLabelSprite(band.name, band.tagline.split('·')[0]!.trim());
    label.position.y = 18;
    group.add(label);

    scene.add(group);

    const pos = new THREE.Vector3(x, y, z);
    const focusDir = pos.clone().setY(0).normalize().multiplyScalar(120);
    const focus = {
      position: pos.clone().add(new THREE.Vector3(focusDir.x, 40, focusDir.z + 90)),
      lookAt: pos.clone(),
    };

    const handle: EmitterHandle = {
      band,
      group,
      core,
      glow,
      label,
      focus,
      setTint(color: THREE.Color, intensity: number): void {
        coreMat.color.copy(color);
        coreMat.emissive.copy(color);
        coreMat.emissiveIntensity = 0.2 + intensity * 0.8;
        (glow.material as THREE.SpriteMaterial).color.copy(color);
        (glow.material as THREE.SpriteMaterial).opacity = 0.25 + intensity * 0.75;
      },
      setDimmed(dimmed: boolean): void {
        const op = dimmed ? 0.16 : 1;
        coreMat.transparent = dimmed;
        coreMat.opacity = op;
        (glow.material as THREE.SpriteMaterial).opacity = dimmed ? 0.05 : 0.6;
        (label.material as THREE.SpriteMaterial).opacity = dimmed ? 0.25 : 1;
      },
    };
    handles.push(handle);
  }

  return handles;
}
