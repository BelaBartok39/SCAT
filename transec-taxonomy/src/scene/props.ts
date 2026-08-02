/**
 * Receivers, props, and link lines — the other half of every conversation.
 *
 * TRANSEC is a three-party story: transmitter, intended receiver,
 * adversary. The emitters alone made a scatter plot; these props make it
 * a place where communication is visibly happening — which is what the
 * warden is trying to overhear.
 *
 * RECEIVERS is the single source of truth for who each band serves; the
 * serving beams and the warden's beam math both read from it.
 */

import * as THREE from 'three';
import type { BandId } from '../data/types';
import { LAYER_HEIGHTS } from './layers';

/** Where each band's intended receiver stands. */
export const RECEIVERS: Record<BandId, { pos: THREE.Vector3; label: string }> = {
  nfc: { pos: new THREE.Vector3(-228, 0, 142), label: 'card at reader' },
  bluetooth: { pos: new THREE.Vector3(-118, 0, 190), label: 'earbuds' },
  wifi: { pos: new THREE.Vector3(-64, 0, 168), label: 'laptop at home' },
  'cellular-3g-4g': { pos: new THREE.Vector3(52, 0, 200), label: 'phone' },
  'cellular-5g': { pos: new THREE.Vector3(120, 0, 280), label: 'phone in beam' },
  '6g-subthz': { pos: new THREE.Vector3(250, 0, 170), label: 'backhaul node' },
  'satcom-civil': { pos: new THREE.Vector3(-280, 0, -100), label: 'VSAT terminal' },
  'satcom-military': { pos: new THREE.Vector3(90, 0, -250), label: 'ground station' },
};

const BODY = 0x9aa4c8;
const BODY_EMISSIVE = 0x2b3050;

function standardMat(color: number, emissive = BODY_EMISSIVE): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, emissive, roughness: 0.65, metalness: 0.15 });
}

/** A small neutral human figure (cone body + sphere head). */
function person(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.ConeGeometry(2.6, 9, 10), standardMat(BODY));
  body.position.y = 4.5;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(1.8, 10, 8), standardMat(BODY));
  head.position.y = 10.5;
  g.add(head);
  return g;
}

/** A house: box + pyramid roof. */
function house(): THREE.Group {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(22, 12, 18), standardMat(0x3a3f63, 0x191c33));
  base.position.y = 6;
  g.add(base);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(16, 8, 4), standardMat(0x2b2f52, 0x14172b));
  roof.position.y = 16;
  roof.rotation.y = Math.PI / 4;
  g.add(roof);
  return g;
}

/** A parabolic ground terminal: pedestal + tilted dish. */
function dish(tiltToward: THREE.Vector3, at: THREE.Vector3): THREE.Group {
  const g = new THREE.Group();
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.2, 8, 8), standardMat(0x3a3f63));
  pedestal.position.y = 4;
  g.add(pedestal);
  const bowl = new THREE.Mesh(
    new THREE.SphereGeometry(7, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3),
    new THREE.MeshStandardMaterial({
      color: 0xb9c2e8,
      emissive: 0x2b3050,
      roughness: 0.4,
      side: THREE.DoubleSide,
    }),
  );
  bowl.position.y = 9;
  g.add(bowl);
  // Aim the bowl's opening at the satellite.
  const target = tiltToward.clone().sub(at).normalize();
  bowl.lookAt(bowl.position.clone().add(target));
  bowl.rotateX(-Math.PI / 2);
  return g;
}

/** NFC pair: terminal box + floating card. */
function nfcPair(): THREE.Group {
  const g = new THREE.Group();
  const terminal = new THREE.Mesh(new THREE.BoxGeometry(5, 7, 4), standardMat(0x3a3f63));
  terminal.position.y = 3.5;
  g.add(terminal);
  const card = new THREE.Mesh(new THREE.BoxGeometry(5.5, 3.4, 0.4), standardMat(0x06b6d4, 0x044a56));
  card.position.set(4.5, 6, 0);
  card.rotation.z = 0.35;
  g.add(card);
  return g;
}

/** Low-poly city blocks under the cellular towers. */
function cityBlocks(rng: () => number): THREE.Group {
  const g = new THREE.Group();
  const mat = standardMat(0x232746, 0x0e1020);
  for (let i = 0; i < 26; i++) {
    const w = 10 + rng() * 14;
    const h = 12 + rng() * 42;
    const d = 10 + rng() * 14;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    b.position.set(60 + rng() * 260, h / 2, -20 + rng() * 130);
    g.add(b);
  }
  return g;
}

// ——— Link lines with traveling dots ————————————————————————————————

interface Link {
  dots: THREE.Mesh[];
  from: THREE.Vector3;
  to: THREE.Vector3;
  phase: number;
  speed: number;
}

export class Props {
  readonly group = new THREE.Group();
  private links: Link[] = [];

  constructor(scene: THREE.Scene, emitterPos: (id: BandId) => THREE.Vector3) {
    // Deterministic layout rng so the city doesn't reshuffle every load.
    let seed = 7;
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

    // — Receiver props —
    const add = (obj: THREE.Group, at: THREE.Vector3) => {
      obj.position.copy(at);
      this.group.add(obj);
    };
    add(nfcPair(), RECEIVERS.nfc.pos);
    add(person(), RECEIVERS.bluetooth.pos);
    add(house(), RECEIVERS.wifi.pos);
    add(person(), RECEIVERS['cellular-3g-4g'].pos);
    add(person(), RECEIVERS['cellular-5g'].pos);
    // 6G backhaul node: a small kiosk box with an antenna stub.
    const kiosk = new THREE.Group();
    const kbox = new THREE.Mesh(new THREE.BoxGeometry(8, 10, 8), standardMat(0x3a3f63));
    kbox.position.y = 5;
    kiosk.add(kbox);
    const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 8, 6), standardMat(BODY));
    stub.position.y = 14;
    kiosk.add(stub);
    add(kiosk, RECEIVERS['6g-subthz'].pos);
    add(dish(emitterPos('satcom-civil'), RECEIVERS['satcom-civil'].pos), RECEIVERS['satcom-civil'].pos);
    add(dish(emitterPos('satcom-military'), RECEIVERS['satcom-military'].pos), RECEIVERS['satcom-military'].pos);

    // — City under the towers —
    this.group.add(cityBlocks(rng));

    // — Link lines —
    const linkColor = 0x06b6d4;
    for (const id of Object.keys(RECEIVERS) as BandId[]) {
      const from = emitterPos(id);
      const to = RECEIVERS[id].pos.clone().add(new THREE.Vector3(0, 8, 0));
      // Faint static line…
      const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
      const line = new THREE.Line(
        geo,
        new THREE.LineBasicMaterial({ color: linkColor, transparent: true, opacity: 0.16 }),
      );
      this.group.add(line);
      // …with bright dots traveling down it.
      const dots: THREE.Mesh[] = [];
      const isOrbital = id === 'satcom-civil' || id === 'satcom-military';
      const n = isOrbital ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const dot = new THREE.Mesh(
          new THREE.SphereGeometry(1.3, 8, 6),
          new THREE.MeshBasicMaterial({
            color: linkColor,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        );
        dots.push(dot);
        this.group.add(dot);
      }
      this.links.push({ dots, from, to, phase: rng(), speed: isOrbital ? 0.10 : 0.22 });
    }

    scene.add(this.group);
  }

  /** Advance link dots. No-ops cleanly when reduced motion holds t at a constant. */
  update(_dt: number, t: number): void {
    for (const link of this.links) {
      for (let i = 0; i < link.dots.length; i++) {
        const p = (t * link.speed + link.phase + i / link.dots.length) % 1;
        link.dots[i]!.position.lerpVectors(link.from, link.to, p);
      }
    }
  }
}

/** Satellite layer height, re-exported for prop placement sanity checks. */
export const GEO_HEIGHT = LAYER_HEIGHTS.geo;
