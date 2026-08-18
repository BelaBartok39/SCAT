/**
 * Static scene furniture: ground disc + grid, atmosphere haze bands,
 * LEO shell of drifting dots, GEO arc. Ground → orbit, echoing the
 * reference infographic's vertical stack.
 */

import * as THREE from 'three';
import { SCENE, radialTexture } from './palette';

// Compressed vertical stack: real orbits are unrenderable anyway, and a
// tighter diorama keeps ground props and satellites in one readable frame.
export const LAYER_HEIGHTS = {
  personal: 8,
  local: 18,
  cellular: 46,
  leo: 130,
  meo: 196,
  geo: 268,
} as const;

/** Small caption sprite for orbit-layer labels (mono, dimmer than emitter labels). */
function makeLayerCaption(text: string): THREE.Sprite {
  const scale = 4;
  const canvas = document.createElement('canvas');
  const probe = canvas.getContext('2d')!;
  probe.font = '600 12px "JetBrains Mono", monospace';
  const w = Math.ceil(probe.measureText(text).width) + 22;
  const h = 28;
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.fillStyle = SCENE.labelBg;
  ctx.beginPath();
  ctx.roundRect(2, 2, w - 4, h - 4, 7);
  ctx.fill();
  ctx.strokeStyle = SCENE.labelBorder;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = SCENE.labelText;
  ctx.font = '600 12px "JetBrains Mono", monospace';
  ctx.fillText(text, 11, 19);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.9 }),
  );
  const worldH = 13;
  sprite.scale.set((w / h) * worldH, worldH, 1);
  return sprite;
}

/** Soft round dot texture so LEO points read as lights, not squares. */
function makeDotTexture(): THREE.Texture {
  return radialTexture(32, [[0, 1], [0.4, 0.55], [1, 0]]);
}

export interface LayerHandles {
  leoDots: THREE.Points;
  leoRing: THREE.Mesh;
  /** GNSS constellation group (MEO scenery — not a taxonomy band). */
  gnss: THREE.Group;
}

export function buildLayers(scene: THREE.Scene): LayerHandles {
  // — Ground disc —
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(620, 96),
    new THREE.MeshBasicMaterial({
      color: SCENE.ground,
      transparent: true,
      opacity: SCENE.groundOpacity,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.5;
  scene.add(ground);

  const grid = new THREE.PolarGridHelper(620, 12, 8, 64, SCENE.gridMajor, SCENE.gridMinor);
  grid.position.y = 0;
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = SCENE.gridOpacity;
  scene.add(grid);

  // — Atmosphere haze rings (subtle horizontal bands at layer heights) —
  for (const [h, color, opacity] of [
    [LAYER_HEIGHTS.leo, SCENE.hazeLeo, 0.05 * SCENE.hazeOpacity],
    [LAYER_HEIGHTS.geo, SCENE.hazeGeo, 0.045 * SCENE.hazeOpacity],
  ] as [number, number, number][]) {
    const band = new THREE.Mesh(
      new THREE.RingGeometry(400, 640, 64),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    band.rotation.x = -Math.PI / 2;
    band.position.y = h;
    scene.add(band);
  }

  // — LEO shell: a scattering of small satellites that drift slowly —
  const leoCount = 90;
  const leoPos = new Float32Array(leoCount * 3);
  for (let i = 0; i < leoCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 320 + Math.random() * 180;
    leoPos[i * 3] = Math.cos(a) * r;
    leoPos[i * 3 + 1] = LAYER_HEIGHTS.leo + (Math.random() - 0.5) * 28;
    leoPos[i * 3 + 2] = Math.sin(a) * r;
  }
  const leoGeo = new THREE.BufferGeometry();
  leoGeo.setAttribute('position', new THREE.BufferAttribute(leoPos, 3));
  const leoDots = new THREE.Points(
    leoGeo,
    new THREE.PointsMaterial({
      color: SCENE.leoDot,
      size: 4.2,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.8,
      map: makeDotTexture(),
      alphaTest: 0.02,
      depthWrite: false,
    }),
  );
  scene.add(leoDots);

  // — A faint ring at LEO height so the shell reads as a layer, not stray dots —
  const leoRing = new THREE.Mesh(
    new THREE.TorusGeometry(410, 0.6, 8, 128),
    new THREE.MeshBasicMaterial({
      color: SCENE.leoRing,
      transparent: true,
      opacity: SCENE.leoRingOpacity,
    }),
  );
  leoRing.rotation.x = Math.PI / 2;
  leoRing.position.y = LAYER_HEIGHTS.leo;
  scene.add(leoRing);

  // — MEO: the GNSS shelf. Not a taxonomy band (no GNSS row in the matrix),
  //   but the orbit ladder is incomplete — and misleading — without it. —
  const gnss = new THREE.Group();
  const meoRing = new THREE.Mesh(
    new THREE.TorusGeometry(400, 0.5, 8, 128),
    new THREE.MeshBasicMaterial({
      color: SCENE.meoRing,
      transparent: true,
      opacity: SCENE.meoRingOpacity,
    }),
  );
  meoRing.rotation.x = Math.PI / 2;
  gnss.add(meoRing);
  const gnssDotMat = new THREE.PointsMaterial({
    color: SCENE.gnssDot,
    size: 5.2,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.85,
    map: makeDotTexture(),
    alphaTest: 0.02,
    depthWrite: false,
  });
  const gnssPos = new Float32Array(6 * 3);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    gnssPos[i * 3] = Math.cos(a) * 400;
    gnssPos[i * 3 + 1] = (Math.random() - 0.5) * 10;
    gnssPos[i * 3 + 2] = Math.sin(a) * 400;
  }
  const gnssGeo = new THREE.BufferGeometry();
  gnssGeo.setAttribute('position', new THREE.BufferAttribute(gnssPos, 3));
  gnss.add(new THREE.Points(gnssGeo, gnssDotMat));
  gnss.position.y = LAYER_HEIGHTS.meo;
  scene.add(gnss);

  // — GEO arc: a thin ring far overhead —
  const geoRing = new THREE.Mesh(
    new THREE.TorusGeometry(390, 0.9, 8, 128),
    new THREE.MeshBasicMaterial({
      color: SCENE.geoRing,
      transparent: true,
      opacity: SCENE.geoRingOpacity,
    }),
  );
  geoRing.rotation.x = Math.PI / 2;
  geoRing.position.y = LAYER_HEIGHTS.geo;
  scene.add(geoRing);

  // — Layer captions (billboarded), echoing the infographic's edge labels —
  // Captions sit on the FAR arc of each ring — that's the part the default
  // camera actually sees (the near side passes behind the viewer).
  const geoCap = makeLayerCaption('GEO · 35,786 km · DTH / VSAT / AEHF · fixed overhead');
  geoCap.position.set(-345, LAYER_HEIGHTS.geo + 16, -180);
  scene.add(geoCap);
  const meoCap = makeLayerCaption('MEO · 20,200 km · GNSS: GPS / Galileo / BeiDou');
  meoCap.position.set(-155, LAYER_HEIGHTS.meo + 14, -355);
  scene.add(meoCap);
  const leoCap = makeLayerCaption('LEO · 160–2,000 km · Starlink / OneWeb / Kuiper');
  leoCap.position.set(-300, LAYER_HEIGHTS.leo + 16, -275);
  scene.add(leoCap);

  // — Soft key light + ambient so emitter materials read —
  scene.add(new THREE.AmbientLight(SCENE.ambient, SCENE.ambientIntensity));
  const key = new THREE.DirectionalLight(SCENE.key, SCENE.keyIntensity);
  key.position.set(200, 400, 150);
  scene.add(key);

  return { leoDots, leoRing, gnss };
}
