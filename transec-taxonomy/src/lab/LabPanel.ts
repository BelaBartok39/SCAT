/**
 * LabPanel — composes lab views for one modulation scheme.
 * Owns the single RAF loop (throttled to 30 fps), pauses when
 * off-screen via IntersectionObserver, and honors reduced motion by
 * rendering one representative frame plus a manual STEP control.
 */

import type { ModulationScheme } from '../data/types';
import { subscribeTheme } from '../theme';
import type { LabView } from './contracts';
import { ConstellationView } from './ConstellationView';
import { TimeDomainView } from './TimeDomainView';
import { SpectrumView } from './SpectrumView';
import { EyeDiagramView } from './EyeDiagramView';
import { TimeFreqView } from './TimeFreqView';
import { SpreadingView } from './SpreadingView';
import { createGenerator } from './generators';
import type { Generator, LabFrame } from './generators';
import { getState } from '../store';

const FRAME_MS = 1000 / 30;

/** Sliders offered per parameter name (only shown when the scheme has it). */
const PARAM_META: Record<string, { label: string; min: number; max: number; step: number }> = {
  snrDb: { label: 'SNR (dB)', min: -6, max: 30, step: 1 },
  spreadFactor: { label: 'Spreading factor', min: 4, max: 128, step: 4 },
  spacingKhz: { label: 'Subcarrier spacing (kHz)', min: 15, max: 120, step: 15 },
  subcarriers: { label: 'Subcarriers', min: 8, max: 128, step: 8 },
};

type AnyView = LabView<never>;

export class LabPanel {
  private views = new Map<string, AnyView>();
  private gen: Generator;
  private raf = 0;
  private last = 0;
  private frame = 0;
  private visible = true;
  private destroyed = false;
  private unsubTheme: (() => void) | null = null;
  private io: IntersectionObserver;
  private root: HTMLElement;

  constructor(container: HTMLElement, scheme: ModulationScheme, opts: { compact?: boolean } = {}) {
    this.root = document.createElement('div');
    this.root.className = `lab-panel ${opts.compact ? 'compact' : ''}`;

    const caption = document.createElement('p');
    caption.className = 'lab-caption';
    caption.textContent = scheme.caption;

    const grid = document.createElement('div');
    grid.className = 'lab-grid';
    const viewsToShow = opts.compact ? scheme.views.slice(0, 1) : scheme.views;
    for (const kind of viewsToShow) {
      const cell = document.createElement('div');
      cell.className = 'lab-cell';
      grid.appendChild(cell);
      this.views.set(kind, this.makeView(kind, cell));
    }

    this.root.appendChild(grid);
    this.root.appendChild(caption);

    this.gen = createGenerator(scheme);

    if (!opts.compact) this.root.appendChild(this.buildControls());

    container.appendChild(this.root);

    this.io = new IntersectionObserver((entries) => {
      this.visible = entries[0]?.isIntersecting ?? true;
      this.syncLoop();
    });
    this.io.observe(this.root);
    this.unsubTheme = subscribeTheme(this.onThemeChange);

    if (getState().reducedMotion) {
      // Static representative frame; STEP advances manually.
      this.step();
    } else {
      this.syncLoop();
    }
  }

  private makeView(kind: string, cell: HTMLElement): AnyView {
    switch (kind) {
      case 'constellation': return new ConstellationView(cell);
      case 'timeDomain': return new TimeDomainView(cell);
      case 'spectrum': return new SpectrumView(cell);
      case 'eyeDiagram': return new EyeDiagramView(cell);
      case 'timeFreq': return new TimeFreqView(cell);
      case 'spreading': return new SpreadingView(cell);
      default: throw new Error(`unknown lab view: ${kind}`);
    }
  }

  private buildControls(): HTMLElement {
    const bar = document.createElement('div');
    bar.className = 'lab-controls';
    for (const [name, meta] of Object.entries(PARAM_META)) {
      if (!(name in this.gen.params)) continue;
      const wrap = document.createElement('label');
      wrap.className = 'lab-slider';
      wrap.innerHTML = `<span>${meta.label}</span>
        <input type="range" min="${meta.min}" max="${meta.max}" step="${meta.step}" value="${this.gen.params[name]}">
        <output>${this.gen.params[name]}</output>`;
      const input = wrap.querySelector('input')!;
      const output = wrap.querySelector('output')!;
      input.addEventListener('input', () => {
        this.gen.params[name] = Number(input.value);
        output.textContent = input.value;
        if (getState().reducedMotion) this.step();
      });
      bar.appendChild(wrap);
    }
    if (getState().reducedMotion) {
      const stepBtn = document.createElement('button');
      stepBtn.className = 'lab-step';
      stepBtn.textContent = 'STEP ▸';
      stepBtn.addEventListener('click', () => this.step());
      bar.appendChild(stepBtn);
    }
    return bar;
  }

  private step(): void {
    const frame: LabFrame = this.gen.next(this.frame++);
    for (const [kind, view] of this.views) {
      const input = frame[kind as keyof LabFrame];
      if (input) (view as LabView<unknown>).render(input);
    }
  }

  /** Repaint once on theme change: under reduced motion the RAF loop is
      off, so nothing would otherwise redraw with the new palette. */
  private onThemeChange = (): void => {
    if (!this.destroyed && this.visible) this.step();
  };

  private syncLoop(): void {
    const want = this.visible && !this.destroyed && !getState().reducedMotion;
    if (want && !this.raf) {
      const tick = (t: number) => {
        if (this.destroyed || !this.visible) { this.raf = 0; return; }
        this.raf = requestAnimationFrame(tick);
        if (t - this.last < FRAME_MS) return; // 30 fps throttle
        this.last = t;
        this.step();
      };
      this.raf = requestAnimationFrame(tick);
    } else if (!want && this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.unsubTheme?.();
    if (this.raf) cancelAnimationFrame(this.raf);
    this.io.disconnect();
    for (const v of this.views.values()) v.destroy();
    this.root.remove();
  }
}
