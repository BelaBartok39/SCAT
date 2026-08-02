/**
 * Static scene furniture: ground disc + grid, atmosphere haze bands,
 * LEO shell of drifting dots, GEO arc. Ground → orbit, echoing the
 * reference infographic's vertical stack.
 */

import * as THREE from 'three';

export const LAYER_HEIGHTS = {
  personal: 8,
  local: 18,
  cellular: 46,
  leo: 230,
  geo: 345,
} as const;

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
    const r = 360 + Math.random() * 190;
    leoPos[i * 3] = Math.cos(a) * r;
    leoPos[i * 3 + 1] = LAYER_HEIGHTS.leo + (Math.random() - 0.5) * 36;
    leoPos[i * 3 + 2] = Math.sin(a) * r;
  }
  const leoGeo = new THREE.BufferGeometry();
  leoGeo.setAttribute('position', new THREE.BufferAttribute(leoPos, 3));
  const leoDots = new THREE.Points(
    leoGeo,
    new THREE.PointsMaterial({ color: 0x8fa3ff, size: 2.6, sizeAttenuation: true, transparent: true, opacity: 0.75 }),
  );
  scene.add(leoDots);

  // — GEO arc: a thin ring far overhead —
  const geoRing = new THREE.Mesh(
    new THREE.TorusGeometry(430, 0.9, 8, 128),
    new THREE.MeshBasicMaterial({ color: 0x6b5aa8, transparent: true, opacity: 0.5 }),
  );
  geoRing.rotation.x = Math.PI / 2;
  geoRing.position.y = LAYER_HEIGHTS.geo;
  scene.add(geoRing);

  // — Soft key light + ambient so emitter materials read —
  scene.add(new THREE.AmbientLight(0x8888aa, 0.9));
  const key = new THREE.DirectionalLight(0xaabbff, 1.1);
  key.position.set(200, 400, 150);
  scene.add(key);

  return { leoDots };
}
