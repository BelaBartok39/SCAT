/**
 * Static scene furniture: ground disc + grid, atmosphere haze bands,
 * LEO shell of drifting dots, GEO arc. Ground → orbit, echoing the
 * reference infographic's vertical stack.
 */

import * as THREE from 'three';

// Compressed vertical stack: real orbits are unrenderable anyway, and a
// tighter diorama keeps ground props and satellites in one readable frame.
export const LAYER_HEIGHTS = {
  personal: 8,
  local: 18,
  cellular: 46,
  leo: 130,
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
  ctx.fillStyle = 'rgba(12, 12, 26, 0.65)';
  ctx.beginPath();
  ctx.roundRect(2, 2, w - 4, h - 4, 7);
  ctx.fill();
  ctx.strokeStyle = 'rgba(139, 163, 255, 0.28)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#8fa3ff';
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
  const cv = document.createElement('canvas');
  cv.width = cv.height = 32;
  const ctx = cv.getContext('2d')!;
  const g = ctx.createRadialGradient(16, 16, 1, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildLayers(scene: THREE.Scene): { leoDots: THREE.Points } {
  // — Ground disc —
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(620, 96),
    new THREE.MeshBasicMaterial({ color: 0x0b0d1c, transparent: true, opacity: 0.85 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.5;
  scene.add(ground);

  const grid = new THREE.PolarGridHelper(620, 12, 8, 64, 0x2a2c4a, 0x181a30);
  grid.position.y = 0;
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.5;
  scene.add(grid);

  // — Atmosphere haze rings (subtle horizontal bands at layer heights) —
  for (const [h, color, opacity] of [
    [LAYER_HEIGHTS.leo, 0x2632aa, 0.05],
    [LAYER_HEIGHTS.geo, 0x4c2a7a, 0.045],
  ] as const) {
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
      color: 0x8fa3ff,
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
    new THREE.MeshBasicMaterial({ color: 0x8fa3ff, transparent: true, opacity: 0.22 }),
  );
  leoRing.rotation.x = Math.PI / 2;
  leoRing.position.y = LAYER_HEIGHTS.leo;
  scene.add(leoRing);

  // — GEO arc: a thin ring far overhead —
  const geoRing = new THREE.Mesh(
    new THREE.TorusGeometry(390, 0.9, 8, 128),
    new THREE.MeshBasicMaterial({ color: 0x6b5aa8, transparent: true, opacity: 0.5 }),
  );
  geoRing.rotation.x = Math.PI / 2;
  geoRing.position.y = LAYER_HEIGHTS.geo;
  scene.add(geoRing);

  // — Layer captions (billboarded), echoing the infographic's edge labels —
  // Captions sit on the FAR arc of each ring — that's the part the default
  // camera actually sees (the near side passes behind the viewer).
  const geoCap = makeLayerCaption('GEO · 35,786 km · fixed overhead');
  geoCap.position.set(-345, LAYER_HEIGHTS.geo + 16, -180);
  scene.add(geoCap);
  const leoCap = makeLayerCaption('LEO shell · 160–2,000 km · constellations');
  leoCap.position.set(-300, LAYER_HEIGHTS.leo + 16, -275);
  scene.add(leoCap);

  // — Soft key light + ambient so emitter materials read —
  scene.add(new THREE.AmbientLight(0x8888aa, 0.9));
  const key = new THREE.DirectionalLight(0xaabbff, 1.1);
  key.position.set(200, 400, 150);
  scene.add(key);

  return { leoDots };
}
