/**
 * Scene palette.
 *
 * The diorama is not a flat surface with colours on it, so a light theme
 * here is more than a hex swap. Three things have to move together:
 *
 *  1. BLENDING. Beams, waveforms, the warden's sight lines and the glow
 *     sprites are drawn with additive blending, which *adds* light to
 *     whatever is behind them. That is how you draw radiated energy on a
 *     night sky. On a pale ground the same arithmetic saturates towards
 *     white and every one of them disappears. Light mode therefore uses
 *     normal blending, where a translucent wedge darkens what is behind
 *     it — energy reads as ink rather than as light.
 *
 *  2. OPACITY. Additive layers are authored faint because they accumulate
 *     where they overlap. Normal blending does not accumulate the same
 *     way, so the same alpha reads as nearly nothing. `signalAlpha()`
 *     scales the authored value rather than making every call site carry
 *     two numbers.
 *
 *  3. GRADIENT TEXTURES. The dot, glow and beam falloff textures are
 *     white-to-transparent ramps. White is the wrong ink on white, so the
 *     ramp colour is a palette entry too.
 *
 * Everything is read through `SCENE`, which is mutated in place on theme
 * change. Materials capture their colour at construction time, so the
 * scene is rebuilt rather than repainted — see SceneRoot.dispose().
 */

import * as THREE from 'three';
import type { ThemeId } from '../theme';

export interface ScenePalette {
  // — environment —
  fog: number;
  fogDensity: number;
  ground: number;
  groundOpacity: number;
  gridMajor: number;
  gridMinor: number;
  gridOpacity: number;
  hazeLeo: number;
  hazeGeo: number;
  hazeOpacity: number;

  // — orbital furniture —
  leoDot: number;
  leoRing: number;
  leoRingOpacity: number;
  meoRing: number;
  meoRingOpacity: number;
  gnssDot: number;
  geoRing: number;
  geoRingOpacity: number;

  // — lights —
  ambient: number;
  ambientIntensity: number;
  key: number;
  keyIntensity: number;

  // — 2D canvas textures —
  labelBg: string;
  labelBorder: string;
  labelText: string;
  /** 'r,g,b' used as the core of every radial falloff texture. */
  glowRgb: string;

  // — structures —
  bodyBase: number;
  bodyEmissive: number;
  structure: number;
  structureEmissive: number;
  roof: number;
  roofEmissive: number;
  panelBright: number;
  groundPlate: number;
  groundPlateEmissive: number;

  // — signals —
  blending: THREE.Blending;
  /** Multiplier applied to authored signal-layer opacity. */
  signalGain: number;
  emitterBase: number;
  emitterShell: number;
  emitterShellEmissive: number;
  emitterCollar: number;
}

const DARK: ScenePalette = {
  fog: 0x07070f,
  fogDensity: 0.00062,
  ground: 0x0b0d1c,
  groundOpacity: 0.85,
  gridMajor: 0x2a2c4a,
  gridMinor: 0x181a30,
  gridOpacity: 0.5,
  hazeLeo: 0x2632aa,
  hazeGeo: 0x4c2a7a,
  hazeOpacity: 1,

  leoDot: 0x8fa3ff,
  leoRing: 0x8fa3ff,
  leoRingOpacity: 0.22,
  meoRing: 0xb9a8ff,
  meoRingOpacity: 0.16,
  gnssDot: 0xcbbcff,
  geoRing: 0x6b5aa8,
  geoRingOpacity: 0.5,

  ambient: 0x8888aa,
  ambientIntensity: 0.9,
  key: 0xaabbff,
  keyIntensity: 1.1,

  labelBg: 'rgba(12, 12, 26, 0.65)',
  labelBorder: 'rgba(139, 163, 255, 0.28)',
  labelText: '#8fa3ff',
  glowRgb: '255,255,255',

  bodyBase: 0x9aa4c8,
  bodyEmissive: 0x2b3050,
  structure: 0x3a3f63,
  structureEmissive: 0x191c33,
  roof: 0x2b2f52,
  roofEmissive: 0x14172b,
  panelBright: 0xb9c2e8,
  groundPlate: 0x232746,
  groundPlateEmissive: 0x0e1020,

  blending: THREE.AdditiveBlending,
  signalGain: 1,
  emitterBase: 0x6366f1,
  emitterShell: 0x2438a0,
  emitterShellEmissive: 0x16205a,
  emitterCollar: 0x30324e,
};

/**
 * Daylight, not an inversion. The sky becomes a pale haze, the ground a
 * cool grey disc, and the orbital furniture darkens so it sits *on* the
 * page rather than glowing off it. Hues are held close to their dark
 * counterparts so a reader who switches themes recognises the same
 * objects; only lightness and blending really move.
 */
const LIGHT: ScenePalette = {
  fog: 0xe9edf4,
  fogDensity: 0.00050,
  ground: 0xdde2ec,
  groundOpacity: 0.92,
  gridMajor: 0x8b93ab,
  gridMinor: 0xb9c0d0,
  gridOpacity: 0.85,
  hazeLeo: 0x6b78c8,
  hazeGeo: 0x9a72c0,
  hazeOpacity: 2.6,

  leoDot: 0x3f4d90,
  leoRing: 0x5d6aa8,
  leoRingOpacity: 0.5,
  meoRing: 0x7b64b8,
  meoRingOpacity: 0.42,
  gnssDot: 0x5b3fa8,
  geoRing: 0x5a4a96,
  geoRingOpacity: 0.7,

  ambient: 0xffffff,
  ambientIntensity: 1.25,
  key: 0xfff6e8,
  keyIntensity: 0.95,

  labelBg: 'rgba(255, 255, 255, 0.90)',
  labelBorder: 'rgba(20, 26, 48, 0.22)',
  labelText: '#39406b',
  glowRgb: '32,40,72',

  bodyBase: 0x7b86ab,
  bodyEmissive: 0x0b0d16,
  structure: 0x99a1bd,
  structureEmissive: 0x0a0c14,
  roof: 0x7f88a8,
  roofEmissive: 0x090b12,
  panelBright: 0x5f6b92,
  groundPlate: 0xa9b0c6,
  groundPlateEmissive: 0x0a0c14,

  blending: THREE.NormalBlending,
  // Additive layers are authored faint because they accumulate. Normal
  // blending does not, so the same alpha would read as nothing.
  signalGain: 1.9,
  emitterBase: 0x4f46e5,
  emitterShell: 0x5b6ad0,
  emitterShellEmissive: 0x0d1030,
  emitterCollar: 0x8b93ab,
};

/** Live palette; mutated in place on theme change. */
export const SCENE: ScenePalette = { ...DARK };

export function applyScenePalette(theme: ThemeId): void {
  Object.assign(SCENE, theme === 'light' ? LIGHT : DARK);
}

/** Scale an authored signal-layer alpha for the active blending mode. */
export function signalAlpha(authored: number): number {
  return Math.min(1, authored * SCENE.signalGain);
}

/** A radial falloff texture in the palette's ink, for dots and glows. */
export function radialTexture(size: number, stops: [number, number][]): THREE.Texture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d')!;
  const h = size / 2;
  const g = ctx.createRadialGradient(h, h, size / 32, h, h, h);
  for (const [pos, alpha] of stops) {
    g.addColorStop(pos, `rgba(${SCENE.glowRgb},${alpha})`);
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
