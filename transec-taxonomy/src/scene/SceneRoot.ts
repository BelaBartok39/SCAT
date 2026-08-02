/**
 * SceneRoot — renderer, camera, controls, raycast picking, RAF loop.
 * Owns the frame loop; other scene modules register per-frame updaters.
 * The loop pauses when a modal is open or the tab is hidden.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildLayers } from './layers';
import { buildEmitters } from './emitters';
import type { EmitterHandle } from './emitters';
import { CameraDirector } from './camera';
import { Lens, MATURITY_SCENE_COLOR } from './lens';
import { Warden } from './warden';
import { Props } from './props';
import { ServingBeams } from './beams';
import { CELLS } from '../data/matrix';
import { cellFor } from '../data/types';
import { getState, setState, subscribeKeys } from '../store';
import type { BandId } from '../data/types';

export type FrameUpdater = (dt: number, elapsed: number) => void;

export class SceneRoot {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly controls: OrbitControls;
  readonly director: CameraDirector;
  readonly emitters: EmitterHandle[];

  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private hovered: EmitterHandle | null = null;
  private updaters: FrameUpdater[] = [];
  private clock = new THREE.Clock();
  private running = false;
  private animId = 0;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.domElement.classList.add('scene-canvas');
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(50, 1, 1, 4000);
    this.camera.position.set(30, 215, 600);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(30, 78, 20);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 80;
    this.controls.maxDistance = 1400;
    this.controls.maxPolarAngle = Math.PI * 0.52; // don't go under the ground
    this.controls.autoRotate = !getState().reducedMotion;
    this.controls.autoRotateSpeed = 0.25;

    // Any manual interaction cancels idle drift and active flights.
    this.controls.addEventListener('start', () => {
      this.controls.autoRotate = false;
      this.director.cancel();
    });

    this.scene.fog = new THREE.FogExp2(0x07070f, 0.00062);

    const { leoDots, leoRing, gnss } = buildLayers(this.scene);
    // LEO drifts fast, GNSS crawls, GEO hangs still — the orbit trade in motion.
    this.addUpdater((dt) => {
      if (getState().reducedMotion) return;
      leoDots.rotation.y += dt * 0.045;
      gnss.rotation.y += dt * 0.008;
    });
    this.emitters = buildEmitters(this.scene);

    // The LEO shell IS the Starlink half of civil SATCOM: under a lens it
    // takes that band's maturity color and dims when the cell is Weak, so
    // the megaconstellation joins the band's story (and the TFS blackout).
    // GNSS is scenery (no matrix row) and simply recedes under any lens.
    const leoDotMat = leoDots.material as THREE.PointsMaterial;
    const leoRingMat = leoRing.material as THREE.MeshBasicMaterial;
    const syncOrbitLayers = () => {
      const lensId = getState().lens;
      gnss.visible = true;
      gnss.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | undefined;
        if (m && 'opacity' in m) (m as THREE.Material & { opacity: number }).opacity = lensId ? 0.08 : (o instanceof THREE.Points ? 0.85 : 0.16);
      });
      if (!lensId) {
        leoDotMat.color.set(0x8fa3ff);
        leoDotMat.opacity = 0.8;
        leoRingMat.opacity = 0.22;
        return;
      }
      const cell = cellFor(CELLS, 'satcom-civil', lensId);
      leoDotMat.color.set(MATURITY_SCENE_COLOR[cell.maturity]);
      leoDotMat.opacity = cell.maturity === 'W' ? 0.12 : 0.8;
      leoRingMat.opacity = cell.maturity === 'W' ? 0.05 : 0.25;
    };
    subscribeKeys(['lens'], syncOrbitLayers);
    syncOrbitLayers();
    this.director = new CameraDirector(this.camera, this.controls, () => getState().reducedMotion);

    const emitterPos = (id: string) =>
      this.emitters.find((e) => e.band.id === id)!.group.position;
    const props = new Props(this.scene, (id) => emitterPos(id));
    this.addUpdater((dt, elapsed) => {
      if (!getState().reducedMotion) props.update(dt, elapsed);
    });

    const beams = new ServingBeams(this.scene, this.emitters);
    this.addUpdater((dt, elapsed) => {
      if (!getState().reducedMotion) beams.update(dt, elapsed);
    });

    const lens = new Lens(this.emitters);
    this.addUpdater((dt, elapsed) => lens.update(dt, elapsed));

    const warden = new Warden(
      this.emitters,
      this.scene,
      this.camera,
      this.renderer.domElement,
      (on) => { this.controls.enabled = on; },
      container,
    );
    this.addUpdater((dt, elapsed) => warden.update(dt, elapsed));
    // The adversary drives the arrays' nulls: drag the jammer, drag the null.
    this.addUpdater(() => lens.setNullTarget(warden.marker.position));

    // Under any lens the mechanism waveforms carry the story; the static
    // serving beams would double the cones (and break the TFS blackout).
    const syncBeams = () => { beams.group.visible = getState().lens === null; };
    subscribeKeys(['lens'], syncBeams);
    syncBeams();
    // Lens changes must repaint even when the loop is paused (reduced motion).
    subscribeKeys(['lens'], () => {
      if (!this.running) this.renderFrame(1 / 60, this.clock.elapsedTime);
    });

    // — Picking —
    const dom = this.renderer.domElement;
    dom.addEventListener('pointermove', (e) => this.onPointerMove(e));
    dom.addEventListener('click', () => {
      if (this.hovered) setState({ selectedBand: this.hovered.band.id, selectedCell: null });
    });

    // — Resize —
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(container);
    this.resize();

    // — Pause when modal open / tab hidden; resume otherwise —
    subscribeKeys(['selectedBand', 'labScheme', 'view'], () => this.syncRunning());
    document.addEventListener('visibilitychange', () => this.syncRunning());
    subscribeKeys(['reducedMotion'], () => {
      this.controls.autoRotate = !getState().reducedMotion && this.controls.autoRotate;
    });

    this.syncRunning();
  }

  /** Register a per-frame updater (lens animation, warden, etc). */
  addUpdater(fn: FrameUpdater): void {
    this.updaters.push(fn);
  }

  focusBand(bandId: BandId): void {
    const h = this.emitters.find((e) => e.band.id === bandId);
    if (!h) return;
    this.controls.autoRotate = false;
    this.director.flyTo(h.focus);
  }

  private resize(): void {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderFrame(0, 0); // keep the last frame fresh even when paused
  }

  private onPointerMove(e: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private pick(): void {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const cores = this.emitters.map((h) => h.core);
    const hits = this.raycaster.intersectObjects(cores, false);
    const hit = hits.length
      ? this.emitters.find((h) => h.core === hits[0]!.object) ?? null
      : null;
    if (hit !== this.hovered) {
      const setScale = (h: EmitterHandle, f: number) => {
        const b = h.label.userData.baseScale as { x: number; y: number };
        h.label.scale.set(b.x * f, b.y * f, 1);
      };
      if (this.hovered) setScale(this.hovered, 1);
      this.hovered = hit;
      if (hit) setScale(hit, 1.2);
      this.renderer.domElement.style.cursor = hit ? 'pointer' : 'grab';
    }
  }

  private shouldRun(): boolean {
    const s = getState();
    return s.view === 'scene' && !s.selectedBand && !s.labScheme && !document.hidden;
  }

  private syncRunning(): void {
    const want = this.shouldRun();
    if (want && !this.running) {
      this.running = true;
      this.clock.getDelta(); // swallow the pause gap
      this.loop();
    } else if (!want && this.running) {
      this.running = false;
      cancelAnimationFrame(this.animId);
    }
  }

  private loop = (): void => {
    if (!this.running) return;
    this.animId = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    const elapsed = this.clock.elapsedTime;
    this.renderFrame(dt, elapsed);
  };

  private renderFrame(dt: number, elapsed: number): void {
    this.director.update(dt);
    this.controls.update();
    this.pick();
    for (const fn of this.updaters) fn(dt, elapsed);
    this.renderer.render(this.scene, this.camera);
  }
}
