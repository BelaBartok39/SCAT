/**
 * Mechanism waveform visuals — one lightweight animated THREE.Group per
 * sceneVisual kind. Each shows HOW an objective is achieved in a band:
 * the geometry itself is the argument (bubble = physics-native decay,
 * pencil = spatial confinement, haze = noise-like spreading, ...).
 *
 * Lifecycle: created by the lens, faded in/out via setFade(), updated
 * once per frame, disposed on replacement.
 */

import * as THREE from 'three';
import { SCENE, signalAlpha } from './palette';
import type { Mechanism } from '../data/types';

export type WaveformKind = Mechanism['sceneVisual'];

export interface Waveform {
  group: THREE.Group;
  /** Per-frame animation. */
  update(dt: number, elapsed: number): void;
  /** Overall opacity multiplier 0..1 (lens cross-fades through this). */
  setFade(f: number): void;
  setColor(c: THREE.Color): void;
  /** Optional: aim the null/notch at a world direction (unit, emitter-local). */
  setNullDir?(dir: THREE.Vector3): void;
  dispose(): void;
}

/** Options shared by beam-type waveforms. `aimDir` is a unit direction in
 *  the emitter's local frame (== world, emitter groups are unrotated). */
export interface WaveformOpts {
  keyed?: boolean;
  aimDir?: THREE.Vector3;
  /** Emitter→receiver distance, so link-spanning visuals actually reach. */
  distance?: number;
}

const DOWN = new THREE.Vector3(0, -1, 0);

/** Orient an apex-at-origin, opening-along−Y cone toward `dir`. */
function aimCone(obj: THREE.Object3D, dir: THREE.Vector3): void {
  obj.quaternion.setFromUnitVectors(DOWN, dir.clone().normalize());
}

/** Gradient texture used by beams/falloff cones (built once, shared). */
let beamTex: THREE.Texture | null = null;
export function getBeamTexture(): THREE.Texture {
  if (beamTex) return beamTex;
  const cv = document.createElement('canvas');
  cv.width = 1;
  cv.height = 64;
  const ctx = cv.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, `rgba(${SCENE.glowRgb},0.85)`);
  g.addColorStop(0.6, `rgba(${SCENE.glowRgb},0.25)`);
  g.addColorStop(1, `rgba(${SCENE.glowRgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1, 64);
  beamTex = new THREE.CanvasTexture(cv);
  beamTex.colorSpace = THREE.SRGBColorSpace;
  return beamTex;
}

function additiveMat(color: THREE.Color, opacity: number, map?: THREE.Texture): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: signalAlpha(opacity),
    map,
    blending: SCENE.blending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

/** Base class handling fade bookkeeping over a set of materials. */
abstract class BaseWaveform implements Waveform {
  group = new THREE.Group();
  protected fade = 0;
  protected mats: { mat: THREE.MeshBasicMaterial | THREE.PointsMaterial; base: number }[] = [];

  protected track<T extends THREE.MeshBasicMaterial | THREE.PointsMaterial>(mat: T): T {
    this.mats.push({ mat, base: mat.opacity });
    return mat;
  }

  setFade(f: number): void {
    this.fade = f;
    for (const { mat, base } of this.mats) mat.opacity = base * f;
  }

  setColor(c: THREE.Color): void {
    for (const { mat } of this.mats) mat.color.copy(c);
  }

  abstract update(dt: number, elapsed: number): void;

  dispose(): void {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Points || o instanceof THREE.Line) {
        o.geometry.dispose();
      }
    });
    for (const { mat } of this.mats) mat.dispose();
    this.group.removeFromParent();
  }
}

// ——— nearFieldBubble: tight 1/r³ falloff sphere (NFC) ————————————————

class NearFieldBubble extends BaseWaveform {
  private shells: THREE.Mesh[] = [];
  constructor(color: THREE.Color) {
    super();
    for (const [r, op] of [[7, 0.5], [10, 0.22], [13, 0.08]] as const) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), this.track(additiveMat(color, op)));
      this.shells.push(m);
      this.group.add(m);
    }
  }
  update(_dt: number, t: number): void {
    // Gentle breathing — the bubble is small and STAYS small; that is the point.
    const s = 1 + Math.sin(t * 2.1) * 0.045;
    for (const sh of this.shells) sh.scale.setScalar(s);
  }
}

// ——— omniRings: expanding isotropic rings (broadcast) ————————————————

class OmniRings extends BaseWaveform {
  private rings: { mesh: THREE.Mesh; phase: number }[] = [];
  private maxR = 55;
  constructor(color: THREE.Color, private speed = 0.34) {
    super();
    for (let i = 0; i < 3; i++) {
      const mesh = new THREE.Mesh(
        new THREE.TorusGeometry(1, 0.35, 8, 48),
        this.track(additiveMat(color, 0.55)),
      );
      mesh.rotation.x = Math.PI / 2;
      this.rings.push({ mesh, phase: i / 3 });
      this.group.add(mesh);
    }
  }
  update(_dt: number, t: number): void {
    for (const r of this.rings) {
      const p = (t * this.speed + r.phase) % 1;
      const radius = 4 + p * this.maxR;
      r.mesh.scale.setScalar(radius);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - p) * this.fade;
    }
  }
  // opacity handled per-frame; keep base bookkeeping in sync
  override setFade(f: number): void {
    this.fade = f;
  }
}

// ——— spreadHaze: noise-like cloud near the floor (DSSS / noise-like) ——

class SpreadHaze extends BaseWaveform {
  private pts: THREE.Points;
  private seed: Float32Array;
  constructor(color: THREE.Color) {
    super();
    const n = 260;
    const pos = new Float32Array(n * 3);
    this.seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 8 + Math.random() * 42;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 18;
      pos[i * 3 + 2] = Math.sin(a) * r;
      this.seed[i] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color,
      size: 1.7,
      transparent: true,
      opacity: signalAlpha(0.5),
      blending: SCENE.blending,
      depthWrite: false,
    });
    this.track(mat);
    this.pts = new THREE.Points(geo, mat);
    this.group.add(this.pts);
  }
  update(_dt: number, t: number): void {
    // Slow rotation + twinkle: energy everywhere, structure nowhere.
    this.pts.rotation.y = t * 0.05;
    (this.pts.material as THREE.PointsMaterial).size = 1.7 + Math.sin(t * 7) * 0.25;
  }
}

// ——— hopScatter: energy jumping across channel slots ————————————————

class HopScatter extends BaseWaveform {
  private slots: THREE.Mesh[] = [];
  private dot: THREE.Mesh;
  private hopT = 0;
  private current = 0;
  constructor(color: THREE.Color, private keyed: boolean) {
    super();
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const slot = new THREE.Mesh(
        new THREE.BoxGeometry(4.5, 0.8, 2.4),
        this.track(additiveMat(color, 0.18)),
      );
      slot.position.set(Math.cos(a) * 26, Math.sin(a * 3) * 4, Math.sin(a) * 26);
      slot.rotation.y = -a;
      this.slots.push(slot);
      this.group.add(slot);
    }
    this.dot = new THREE.Mesh(new THREE.SphereGeometry(2.4, 12, 8), this.track(additiveMat(color, 0.95)));
    this.group.add(this.dot);
  }
  update(dt: number, _t: number): void {
    this.hopT += dt;
    if (this.hopT > 0.22) {
      this.hopT = 0;
      const prev = this.slots[this.current]!;
      (prev.material as THREE.MeshBasicMaterial).opacity = 0.18 * this.fade;
      // Public pattern walks predictably; keyed pattern jumps randomly.
      this.current = this.keyed
        ? Math.floor(Math.random() * this.slots.length)
        : (this.current + 2) % this.slots.length;
      const slot = this.slots[this.current]!;
      (slot.material as THREE.MeshBasicMaterial).opacity = 0.7 * this.fade;
      this.dot.position.copy(slot.position);
    }
  }
}

// ——— pencilBeam: narrow steerable cone (mmWave / THz) ————————————————

class PencilBeam extends BaseWaveform {
  constructor(color: THREE.Color, aimDir?: THREE.Vector3, distance?: number, apertureDeg = 4.5) {
    super();
    const len = distance ?? 85;
    const r = Math.tan((apertureDeg * Math.PI) / 180) * len;
    const geo = new THREE.ConeGeometry(r, len, 20, 1, true);
    geo.translate(0, -len / 2, 0); // apex at origin
    const cone = new THREE.Mesh(geo, this.track(additiveMat(color, 0.5, getBeamTexture())));
    // Aim at the served receiver so the mechanism cone and the link agree.
    aimCone(cone, aimDir ?? new THREE.Vector3(0.8, -0.5, 0.6));
    this.group.add(cone);
  }
  update(_dt: number, t: number): void {
    // Subtle steering sway about vertical — beams track users.
    this.group.rotation.y = Math.sin(t * 0.5) * 0.12;
  }
}

// ——— nulledLobe: broad lobe with a carved null ————————————————————————

class NulledLobe extends BaseWaveform {
  private notch: THREE.Group;
  constructor(color: THREE.Color, aimDir?: THREE.Vector3) {
    super();
    // Broad serving lobe, aimed at the receiver.
    const len = 55;
    const lobe = new THREE.Mesh(
      (() => {
        const g = new THREE.ConeGeometry(Math.tan(0.5) * len, len, 24, 1, true);
        g.translate(0, -len / 2, 0);
        return g;
      })(),
      this.track(additiveMat(color, 0.3, getBeamTexture())),
    );
    aimCone(lobe, aimDir ?? new THREE.Vector3(0.8, -0.5, 0.6));
    this.group.add(lobe);

    // The null: the wedge the array deliberately goes deaf toward.
    // Solid black failed on a dark scene — render it as a translucent
    // shadow with a warden-red wireframe rim, and aim it at the warden
    // (setNullDir) so dragging the adversary moves the null.
    const ng = new THREE.ConeGeometry(Math.tan(0.16) * 60, 60, 10, 1, true);
    ng.translate(0, -30, 0);
    this.notch = new THREE.Group();
    const fill = new THREE.Mesh(
      ng,
      new THREE.MeshBasicMaterial({
        color: SCENE.fog,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.notch.add(fill);
    const rimMat = new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    this.track(rimMat);
    this.notch.add(new THREE.Mesh(ng.clone(), rimMat));
    aimCone(this.notch, new THREE.Vector3(0.2, -0.4, 0.9));
    this.group.add(this.notch);
  }
  /** Aim the null at the adversary (unit direction, emitter-local frame). */
  setNullDir(dir: THREE.Vector3): void {
    aimCone(this.notch, dir);
  }
  update(): void {
    /* statically aimed; the null tracks the warden via setNullDir */
  }
}

// ——— absorptionFalloff: beam that dies with distance (sub-THz) ————————

class AbsorptionFalloff extends BaseWaveform {
  private motes: THREE.Points;
  constructor(color: THREE.Color, aimDir?: THREE.Vector3) {
    super();
    // Short beam whose gradient dies well before the scene edge.
    const dir = (aimDir ?? new THREE.Vector3(0.8, -0.5, 0.6)).clone().normalize();
    const len = 48;
    const geo = new THREE.ConeGeometry(Math.tan(0.06) * len, len, 14, 1, true);
    geo.translate(0, -len / 2, 0);
    const beam = new THREE.Mesh(geo, this.track(additiveMat(color, 0.75, getBeamTexture())));
    aimCone(beam, dir);
    this.group.add(beam);
    // Absorption motes: the medium itself eating the signal, along the beam.
    const n = 60;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const d = Math.random() * len * 0.9;
      pos[i * 3] = dir.x * d + (Math.random() - 0.5) * 6;
      pos[i * 3 + 1] = dir.y * d + (Math.random() - 0.5) * 6;
      pos[i * 3 + 2] = dir.z * d + (Math.random() - 0.5) * 6;
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pm = new THREE.PointsMaterial({
      color: 0xf59e0b,
      size: 1.1,
      transparent: true,
      opacity: signalAlpha(0.4),
      blending: SCENE.blending,
      depthWrite: false,
    });
    this.track(pm);
    this.motes = new THREE.Points(pg, pm);
    this.group.add(this.motes);
  }
  update(_dt: number, t: number): void {
    (this.motes.material as THREE.PointsMaterial).opacity = (0.28 + Math.sin(t * 3) * 0.12) * this.fade;
  }
}

// ——— constantCarrier: steady, unwavering emission (TFS / EMCON) ———————

class ConstantCarrier extends BaseWaveform {
  constructor(color: THREE.Color, aimDir?: THREE.Vector3, distance?: number) {
    super();
    // A perfectly steady column down the real link — the absence of
    // variation IS the message. It must reach the receiver: a carrier
    // that stops in mid-air says nothing about emission control.
    const dir = (aimDir ?? DOWN).clone().normalize();
    const len = distance ?? 120;
    for (const [radius, opacity] of [[1.1, 0.55], [2.6, 0.14]] as const) {
      const geo = new THREE.CylinderGeometry(radius, radius, len, 10, 1, true);
      geo.translate(0, -len / 2, 0); // top end at the emitter
      const mesh = new THREE.Mesh(geo, this.track(additiveMat(color, opacity)));
      aimCone(mesh, dir);
      this.group.add(mesh);
    }
  }
  update(): void {
    /* deliberately static — constant envelope */
  }
}

// ——— factory ————————————————————————————————————————————————————————

export function createWaveform(
  kind: WaveformKind,
  color: THREE.Color,
  opts: WaveformOpts = {},
): Waveform {
  switch (kind) {
    case 'nearFieldBubble': return new NearFieldBubble(color);
    case 'omniRings': return new OmniRings(color);
    case 'spreadHaze': return new SpreadHaze(color);
    case 'hopScatter': return new HopScatter(color, opts.keyed ?? false);
    case 'pencilBeam': return new PencilBeam(color, opts.aimDir, opts.distance);
    case 'nulledLobe': return new NulledLobe(color, opts.aimDir);
    // absorptionFalloff keeps its own short length ON PURPOSE — the beam
    // dying before it arrives is the mechanism being illustrated.
    case 'absorptionFalloff': return new AbsorptionFalloff(color, opts.aimDir);
    case 'constantCarrier': return new ConstantCarrier(color, opts.aimDir, opts.distance);
  }
}
