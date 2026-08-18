/**
 * The warden — a draggable adversary on the ground plane.
 *
 * For every band it answers, live, from actual scene geometry: what
 * does an eavesdropper HERE actually get? Verdicts are drawn INTO the
 * scene as sightlines (red = signal recovered, amber = energy only,
 * no line = hears nothing) so the panel is a legend, not the only
 * source of truth. The beam math is the same dsp/channel model the lab
 * overlays use, and the beam axis is the same emitter→receiver link the
 * serving beams render — scene and model cannot disagree.
 *
 * Ma et al. 2018 as a toggle: place a scatterer in the mmWave beam and
 * off-axis visibility comes back.
 */

import * as THREE from 'three';
import { SCENE, signalAlpha } from './palette';
import { Channel } from '../dsp/channel';
import type { BandId } from '../data/types';
import { BAND_ORDER } from '../data/types';
import type { EmitterHandle } from './emitters';
import { RECEIVERS } from './props';
import { getState, setState, subscribeKeys } from '../store';

type Verdict = 'visible' | 'unresolvable' | 'nothing';

interface Observation {
  bandId: BandId;
  verdict: Verdict;
  reason: string;
  detailDb?: number;
}

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
  'satcom-civil': 'SAT GEO',
  'satcom-leo': 'SAT LEO',
  'satcom-military': 'SAT mil',
};

// Labels speak from the DEFENDER's perspective, matching the color code
// (red = your transmission is exposed, green = it is hidden). Wording the
// verdicts from the warden's side ("signal recovered") made red look like
// a success and green like a failure.
const VERDICT_META: Record<Verdict, { icon: string; cls: string; label: string }> = {
  visible: { icon: '●', cls: 'v-visible', label: 'EXPOSED' },
  unresolvable: { icon: '◐', cls: 'v-unresolvable', label: 'ENERGY ONLY' },
  nothing: { icon: '○', cls: 'v-nothing', label: 'HIDDEN' },
};

const SIGHT_COLOR: Record<Verdict, number> = {
  visible: 0xf43f5e,
  unresolvable: 0xf59e0b,
  nothing: 0x000000, // never drawn
};

/** Preset warden positions that stage the three contrasts. */
const PRESETS: { label: string; title: string; pos: () => THREE.Vector3 }[] = [
  {
    label: 'beside Wi-Fi',
    title: 'Broadcast bands are heard from anywhere in range',
    pos: () => RECEIVERS.wifi.pos.clone().add(new THREE.Vector3(30, 0, 24)),
  },
  {
    label: 'in 5G beam',
    title: 'Step into the serving beam and everything is visible',
    pos: () => RECEIVERS['cellular-5g'].pos.clone().add(new THREE.Vector3(-6, 0, 14)),
  },
  {
    label: 'far off-axis',
    title: 'Off-axis and out of range: geometry does the hiding',
    pos: () => new THREE.Vector3(-330, 0, -140),
  },
];

export class Warden {
  readonly marker = new THREE.Group();
  private hintRing: THREE.Mesh;
  private hasDragged = false;
  private scatterer: THREE.Mesh;
  private panel: HTMLElement;
  private dragging = false;
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private raycaster = new THREE.Raycaster();
  private throttle = 0;
  private sightGroup = new THREE.Group();
  private sightLines = new Map<BandId, THREE.Line>();
  private hoveredBand: BandId | null = null;

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

    // Pulsing "drag me" ring — retired after the first drag or preset.
    this.hintRing = new THREE.Mesh(
      new THREE.TorusGeometry(14, 0.7, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0xf43f5e, transparent: true, opacity: 0.5 }),
    );
    this.hintRing.rotation.x = Math.PI / 2;
    this.hintRing.position.y = 0.5;
    this.marker.add(this.hintRing);

    const { x, z } = getState().wardenPos;
    this.marker.position.set(x, 0, z);
    this.marker.traverse((o) => (o.userData.warden = true));
    scene.add(this.marker);
    scene.add(this.sightGroup);

    // — Scatterer (Ma et al. 2018): physically ON the 5G beam path —
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
    const e5g = this.emitterPos('cellular-5g');
    this.scatterer.position.lerpVectors(e5g, RECEIVERS['cellular-5g'].pos, 0.55);
    this.scatterer.position.y = Math.max(this.scatterer.position.y, 8);
    this.scatterer.visible = getState().scattererEnabled;
    scene.add(this.scatterer);

    // — Observation panel (collapsible; scrolls internally, never covers the ribbon) —
    this.panel = document.createElement('aside');
    this.panel.className = 'warden-panel';
    this.panel.innerHTML = `
      <button class="wp-head" aria-expanded="true">
        <span class="wp-title">⌖ WARDEN OBSERVES</span>
        <span class="wp-hint">drag the red marker</span>
        <span class="wp-chevron" aria-hidden="true">▾</span>
      </button>
      <div class="wp-body">
        <div class="wp-presets">
          ${PRESETS.map((p, i) => `<button class="wp-preset" data-preset="${i}" title="${p.title}">${p.label}</button>`).join('')}
        </div>
        <ul class="wp-list" aria-live="polite"></ul>
        <div class="wp-toggles">
          <button class="wp-toggle" data-toggle="scatterer" aria-pressed="false"
            title="Ma et al., Nature 563 (2018): a scatterer in the beam re-enables eavesdropping">
            scatterer in beam</button>
        </div>
      </div>`;
    container.appendChild(this.panel);

    // Collapse/expand. On small screens the expanded panel would bury the
    // scene, so it starts collapsed there — one tap opens it.
    const headBtn = this.panel.querySelector<HTMLButtonElement>('.wp-head')!;
    headBtn.addEventListener('click', () => {
      const collapsed = this.panel.classList.toggle('collapsed');
      headBtn.setAttribute('aria-expanded', String(!collapsed));
    });
    if (window.innerWidth < 700) {
      this.panel.classList.add('collapsed');
      headBtn.setAttribute('aria-expanded', 'false');
    }

    // Presets.
    this.panel.querySelectorAll<HTMLButtonElement>('.wp-preset').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = PRESETS[Number(btn.dataset.preset)]!;
        const pos = p.pos();
        this.marker.position.set(pos.x, 0, pos.z);
        this.retireHint();
        setState({ wardenPos: { ...getState().wardenPos, x: pos.x, z: pos.z } });
        this.refresh();
      });
    });

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

  private emitterPos(id: BandId): THREE.Vector3 {
    return this.emitters.find((e) => e.band.id === id)!.group.position;
  }

  private retireHint(): void {
    if (!this.hasDragged) {
      this.hasDragged = true;
      this.hintRing.visible = false;
    }
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
    this.retireHint();
    this.setControlsEnabled(true);
    this.dom.style.cursor = 'grab';
    setState({ wardenPos: { ...getState().wardenPos, x: this.marker.position.x, z: this.marker.position.z } });
    this.refresh();
  };

  /** Angle (deg) at the emitter between its serving link and the warden. */
  private offAxisDeg(bandId: BandId): number {
    const ePos = this.emitterPos(bandId);
    const a = RECEIVERS[bandId].pos.clone().sub(ePos).normalize();
    const b = this.marker.position.clone().sub(ePos).normalize();
    return (Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1)) * 180) / Math.PI;
  }

  private observe(): Observation[] {
    const w = this.marker.position;
    const scatterer = getState().scattererEnabled;
    const out: Observation[] = [];

    for (const bandId of BAND_ORDER) {
      const d = w.distanceTo(this.emitterPos(bandId));

      switch (bandId) {
        case 'nfc': {
          const ePos = this.emitterPos(bandId);
          const groundD = Math.hypot(w.x - ePos.x, w.z - ePos.z);
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
          } else if (scatterer && bandId === 'cellular-5g') {
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
        case 'satcom-leo':
          out.push({
            bandId,
            verdict: 'visible',
            reason: 'spot beam floods this whole ground cell; frame structure publicly characterized',
          });
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

  /** Rebuild the warden→emitter sightlines from the current verdicts. */
  private rebuildSightlines(obs: Observation[]): void {
    for (const line of this.sightLines.values()) {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    }
    this.sightGroup.clear();
    this.sightLines.clear();

    const eye = this.marker.position.clone().add(new THREE.Vector3(0, 15, 0));
    for (const o of obs) {
      if (o.verdict === 'nothing') continue; // silence is drawn as absence
      const geo = new THREE.BufferGeometry().setFromPoints([eye, this.emitterPos(o.bandId)]);
      const mat = new THREE.LineBasicMaterial({
        color: SIGHT_COLOR[o.verdict],
        transparent: true,
        opacity: signalAlpha(o.bandId === this.hoveredBand ? 0.95 : 0.4),
        blending: SCENE.blending,
        depthWrite: false,
      });
      const line = new THREE.Line(geo, mat);
      this.sightGroup.add(line);
      this.sightLines.set(o.bandId, line);
    }
  }

  /** Recompute verdicts, redraw sightlines, re-render the panel list. */
  refresh(): void {
    const obs = this.observe();
    this.rebuildSightlines(obs);

    const list = this.panel.querySelector<HTMLElement>('.wp-list')!;
    list.innerHTML = obs
      .map((o) => {
        const m = VERDICT_META[o.verdict];
        const db = o.detailDb !== undefined ? `<span class="wp-db">${o.detailDb.toFixed(0)} dB</span>` : '';
        return `<li class="${m.cls}" data-band="${o.bandId}">
          <span class="wp-band">${m.icon} ${BAND_SHORT[o.bandId]}</span>
          <span class="wp-verdict">${m.label}${db}</span>
          <span class="wp-reason">${o.reason}</span>
        </li>`;
      })
      .join('');

    // Row hover ↔ sightline + emitter highlight.
    list.querySelectorAll<HTMLElement>('li').forEach((li) => {
      const bandId = li.dataset.band as BandId;
      li.addEventListener('mouseenter', () => this.setHover(bandId));
      li.addEventListener('mouseleave', () => this.setHover(null));
    });
  }

  private setHover(bandId: BandId | null): void {
    this.hoveredBand = bandId;
    for (const [id, line] of this.sightLines) {
      (line.material as THREE.LineBasicMaterial).opacity = id === bandId ? 0.95 : bandId ? 0.15 : 0.4;
    }
    for (const h of this.emitters) {
      const b = h.label.userData.baseScale as { x: number; y: number };
      const f = h.band.id === bandId ? 1.25 : 1;
      h.label.scale.set(b.x * f, b.y * f, 1);
    }
  }

  update(_dt: number, t: number): void {
    if (getState().reducedMotion) return;
    // Idle spin on the scatterer so it reads as "an object", not UI.
    if (this.scatterer.visible) this.scatterer.rotation.y = t * 0.8;
    // Pulsing drag hint until first interaction.
    if (!this.hasDragged) {
      const s = 1 + Math.sin(t * 2.4) * 0.28;
      this.hintRing.scale.setScalar(s);
      (this.hintRing.material as THREE.MeshBasicMaterial).opacity = 0.34 + Math.sin(t * 2.4) * 0.22;
    }
  }
}
