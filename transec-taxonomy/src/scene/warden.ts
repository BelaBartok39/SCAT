/**
 * The warden — a draggable adversary on the ground plane.
 *
 * For every band it answers, live, from actual scene geometry: what
 * does an eavesdropper HERE actually get? The beam math is the same
 * dsp/channel model the lab overlays use (beamGainDb), so the 3D scene
 * and the signal panels never disagree.
 *
 * Ma et al. 2018 as a toggle: place a scatterer in the mmWave/THz beam
 * and off-axis visibility comes back.
 */

import * as THREE from 'three';
import { Channel } from '../dsp/channel';
import type { BandId } from '../data/types';
import { BAND_ORDER } from '../data/types';
import type { EmitterHandle } from './emitters';
import { getState, setState, subscribeKeys } from '../store';

type Verdict = 'visible' | 'unresolvable' | 'nothing';

interface Observation {
  bandId: BandId;
  verdict: Verdict;
  reason: string;
  detailDb?: number;
}

/** Where each beamformed band is pointing (its served user on the ground). */
const SERVE_POINT: Partial<Record<BandId, THREE.Vector3>> = {
  'cellular-5g': new THREE.Vector3(120, 0, 280),
  '6g-subthz': new THREE.Vector3(250, 0, 170),
};

const BEAMWIDTH_DEG: Partial<Record<BandId, number>> = {
  'cellular-5g': 10,
  '6g-subthz': 5,
};

const BAND_SHORT: Record<BandId, string> = {
  nfc: 'NFC',
  bluetooth: 'BT/BLE',
  wifi: 'Wi-Fi',
  'cellular-3g-4g': '3G/4G',
  'cellular-5g': '5G NR',
  '6g-subthz': '6G',
  'satcom-civil': 'SAT civ',
  'satcom-military': 'SAT mil',
};

const VERDICT_META: Record<Verdict, { icon: string; cls: string; label: string }> = {
  visible: { icon: '●', cls: 'v-visible', label: 'SIGNAL RECOVERED' },
  unresolvable: { icon: '◐', cls: 'v-unresolvable', label: 'ENERGY ONLY' },
  nothing: { icon: '○', cls: 'v-nothing', label: 'NOTHING' },
};

export class Warden {
  readonly marker = new THREE.Group();
  private scatterer: THREE.Mesh;
  private panel: HTMLElement;
  private dragging = false;
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private raycaster = new THREE.Raycaster();
  private throttle = 0;

  constructor(
    private emitters: EmitterHandle[],
    scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
    private dom: HTMLElement,
    private setControlsEnabled: (on: boolean) => void,
    container: HTMLElement,
  ) {
    // — Marker: a figure-like cone + ring, unmistakably "someone standing here" —
    const body = new THREE.Mesh(
      new THREE.ConeGeometry(4, 14, 12),
      new THREE.MeshStandardMaterial({ color: 0xf43f5e, emissive: 0x8b1129, roughness: 0.5 }),
    );
    body.position.y = 7;
    this.marker.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(2.6, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xf43f5e, emissive: 0x8b1129 }),
    );
    head.position.y = 16.5;
    this.marker.add(head);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(9, 0.5, 8, 40),
      new THREE.MeshBasicMaterial({ color: 0xf43f5e, transparent: true, opacity: 0.6 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.5;
    this.marker.add(ring);
    const { x, z } = getState().wardenPos;
    this.marker.position.set(x, 0, z);
    this.marker.traverse((o) => (o.userData.warden = true));
    scene.add(this.marker);

    // — Scatterer (Ma et al. 2018): sits in the 5G serving beam path —
    this.scatterer = new THREE.Mesh(
      new THREE.OctahedronGeometry(5),
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0x7c4a02,
        metalness: 0.9,
        roughness: 0.15,
        transparent: true,
        opacity: 0.95,
      }),
    );
    const sp = SERVE_POINT['cellular-5g']!;
    this.scatterer.position.set(sp.x * 0.55, 8, sp.z * 0.55); // mid-beam
    this.scatterer.visible = getState().scattererEnabled;
    scene.add(this.scatterer);

    // — Observation panel —
    this.panel = document.createElement('aside');
    this.panel.className = 'warden-panel';
    this.panel.innerHTML = `
      <div class="wp-head">
        <span class="wp-title">⌖ WARDEN OBSERVES</span>
        <span class="wp-hint">drag the red marker</span>
      </div>
      <ul class="wp-list" aria-live="polite"></ul>
      <div class="wp-toggles">
        <button class="wp-toggle" data-toggle="scatterer" aria-pressed="false"
          title="Ma et al., Nature 563 (2018): a scatterer in the beam re-enables eavesdropping">
          scatterer in beam</button>
      </div>`;
    container.appendChild(this.panel);
    this.panel.querySelector<HTMLButtonElement>('[data-toggle=scatterer]')!.addEventListener('click', () => {
      setState({ scattererEnabled: !getState().scattererEnabled });
    });
    subscribeKeys(['scattererEnabled'], () => {
      this.scatterer.visible = getState().scattererEnabled;
      this.syncToggles();
      this.refresh();
    });
    this.syncToggles();

    // — Dragging —
    dom.addEventListener('pointerdown', this.onDown);
    dom.addEventListener('pointermove', this.onMove);
    dom.addEventListener('pointerup', this.onUp);

    this.refresh();
  }

  private syncToggles(): void {
    const btn = this.panel.querySelector<HTMLButtonElement>('[data-toggle=scatterer]')!;
    const on = getState().scattererEnabled;
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', String(on));
  }

  private pointerRay(e: PointerEvent): THREE.Raycaster {
    const rect = this.dom.getBoundingClientRect();
    const p = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(p, this.camera);
    return this.raycaster;
  }

  private onDown = (e: PointerEvent): void => {
    const hits = this.pointerRay(e).intersectObject(this.marker, true);
    if (hits.length) {
      this.dragging = true;
      this.setControlsEnabled(false);
      this.dom.style.cursor = 'move';
    }
  };

  private onMove = (e: PointerEvent): void => {
    if (!this.dragging) return;
    const pt = new THREE.Vector3();
    if (this.pointerRay(e).ray.intersectPlane(this.groundPlane, pt)) {
      // Keep the warden on the observable field.
      const r = Math.hypot(pt.x, pt.z);
      if (r > 580) pt.multiplyScalar(580 / r);
      this.marker.position.set(pt.x, 0, pt.z);
      this.throttle += 1;
      if (this.throttle % 3 === 0) this.refresh();
    }
  };

  private onUp = (): void => {
    if (!this.dragging) return;
    this.dragging = false;
    this.setControlsEnabled(true);
    this.dom.style.cursor = 'grab';
    setState({ wardenPos: { ...getState().wardenPos, x: this.marker.position.x, z: this.marker.position.z } });
    this.refresh();
  };

  /** Angle (deg) at the emitter between its serving beam and the warden. */
  private offAxisDeg(bandId: BandId): number {
    const h = this.emitters.find((e) => e.band.id === bandId)!;
    const serve = SERVE_POINT[bandId]!;
    const ePos = h.group.position;
    const a = serve.clone().sub(ePos).normalize();
    const b = this.marker.position.clone().sub(ePos).normalize();
    return (Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1)) * 180) / Math.PI;
  }

  private observe(): Observation[] {
    const w = this.marker.position;
    const scatterer = getState().scattererEnabled;
    const out: Observation[] = [];

    for (const bandId of BAND_ORDER) {
      const h = this.emitters.find((e) => e.band.id === bandId)!;
      const d = w.distanceTo(h.group.position);

      switch (bandId) {
        case 'nfc': {
          const groundD = Math.hypot(w.x - h.group.position.x, w.z - h.group.position.z);
          out.push(
            groundD < 16
              ? { bandId, verdict: 'visible', reason: 'inside the near field — full read at touch range' }
              : { bandId, verdict: 'nothing', reason: `1/r³ decay: field is gone at ${groundD.toFixed(0)} m-scale range` },
          );
          break;
        }
        case 'bluetooth':
          out.push(
            d < 320
              ? { bandId, verdict: 'visible', reason: 'advertising beacons broadcast by design; hop map public' }
              : { bandId, verdict: 'nothing', reason: 'out of link range (low power)' },
          );
          break;
        case 'wifi':
          out.push({ bandId, verdict: 'visible', reason: 'beacons announce the network from anywhere in range' });
          break;
        case 'cellular-3g-4g':
          out.push({ bandId, verdict: 'visible', reason: 'sync/broadcast channels are public by design' });
          break;
        case 'cellular-5g':
        case '6g-subthz': {
          const theta = this.offAxisDeg(bandId);
          const bw = BEAMWIDTH_DEG[bandId]!;
          const gain = Channel.beamGainDb(theta, bw, -30);
          const inBeam = gain > -12;
          const ranged = bandId === '6g-subthz' && d > 260;
          if (ranged) {
            out.push({ bandId, verdict: 'nothing', reason: 'molecular absorption: signal is gone at this range', detailDb: gain });
          } else if (inBeam) {
            out.push({ bandId, verdict: 'visible', reason: `inside the serving beam (${theta.toFixed(1)}° off-axis)`, detailDb: gain });
          } else if (scatterer) {
            out.push({
              bandId,
              verdict: 'visible',
              reason: 'scatterer in the beam re-enables eavesdropping (Ma 2018)',
              detailDb: -8,
            });
          } else {
            out.push({
              bandId,
              verdict: 'nothing',
              reason: `beam confinement: ${theta.toFixed(0)}° off-axis`,
              detailDb: gain,
            });
          }
          break;
        }
        case 'satcom-civil':
          out.push({ bandId, verdict: 'visible', reason: 'continental footprint; DVB-S2X waveform is an open standard' });
          break;
        case 'satcom-military':
          out.push({
            bandId,
            verdict: 'unresolvable',
            reason: 'wideband noise-like energy; keyed hop pattern unpredictable',
          });
          break;
      }
    }
    return out;
  }

  /** Recompute + re-render the observation list. */
  refresh(): void {
    const list = this.panel.querySelector<HTMLElement>('.wp-list')!;
    list.innerHTML = this.observe()
      .map((o) => {
        const m = VERDICT_META[o.verdict];
        const db = o.detailDb !== undefined ? `<span class="wp-db">${o.detailDb.toFixed(0)} dB</span>` : '';
        return `<li class="${m.cls}">
          <span class="wp-band">${m.icon} ${BAND_SHORT[o.bandId]}</span>
          <span class="wp-verdict">${m.label}${db}</span>
          <span class="wp-reason">${o.reason}</span>
        </li>`;
      })
      .join('');
  }

  update(_dt: number, t: number): void {
    // Idle spin on the scatterer so it reads as "an object", not UI.
    if (this.scatterer.visible) this.scatterer.rotation.y = t * 0.8;
  }
}
