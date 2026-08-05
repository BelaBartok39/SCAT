# Next Tool — Planning & Decisions

*Working notes for the successor to `transec-taxonomy`. Written 2026-08-05.
Read this first when resuming in a new session.*

---

## Where we are today

**`transec-taxonomy/` is finished and deployed** (Cloudflare Pages, Direct Upload,
no GitHub remote — deliberate). Branch `transec-taxonomy`, ~20 commits, clean tree,
57 DSP tests passing.

What exists:

- **Data layer** — 9 bands × 5 objectives = 45 typed cells, 9 mechanisms, 30 DOI-linked
  references. All transcribed from `transec_taxonomy.pptx` / `wireless_bands_survey.pptx`
  and verified cell-by-cell.
- **3D scene** — ground-to-orbit diorama, emitters + receiver props + link lines,
  objective lens (re-skins by maturity + mechanism), draggable warden with live
  verdicts and sightlines, orbit layers (LEO/MEO/GEO) with captions and drift.
- **Matrix / Frontier** — 9×5 grid, keyboard-navigable, compact heatmap on phones.
- **Signal Lab** — 6 Canvas2D primitives (constellation, time-domain, spectrum, eye,
  time-frequency waterfall, spreading) over a tested DSP core; 10 modulation schemes.
- **About** — plain-language explainer, reads live from the dataset.
- Mobile pass done: tap-to-open, responsive header, dvh-sized modals.

---

## The goal we are working toward

An **interactive tool accompanying a published paper about the tool itself**, focused on
**space communications**, extending the TRANSEC work with an **attack + mitigation layer**
concentrated on SATCOM.

The contribution claim is **the crossing**, not the axes:
link direction × PHY-layer TRANSEC objectives × orbit regime. Prior art covers the axes
separately — SPARTA splits uplink/downlink intercept, Tedeschi carries a link column,
Ben Yahia decomposes the link segment — but nobody crosses them with physical-layer
security objectives, and all of it is orbit-agnostic.

**Target venue: IEEE VizSec** (visualization for cyber security; publishes tool papers
and expects evaluation). Alternates: IEEE Aerospace, Computers & Security tools track.

---

## Decisions made

### Scope

1. **COMSEC stays out of scope.** Two reasons: SPARTA already covers upper layers, so
   there is no novelty there; and merging COMSEC into the cells dissolves the central
   finding (civil systems read Weak *because* they delegate upward). A layer-ablation
   model was considered and rejected for exactly this reason.
2. **The new axis is link direction**, not protocol layer:
   `uplink | downlink | isl | bidirectional`.
   The supported finding: **uplink is LPD + AJ dominant** (Koisser 2024 — terminal
   emissions triangulated from orbit; Yue 2023 — ground jammers hit the uplink);
   **downlink is LPI + LPE dominant** (Pavur 2020, Zhang 2025 — cleartext recovered at
   scale; Humphreys 2023 — frame structure publicly characterized).
3. **Additive only.** Do not restart or restructure the shipped tool. New capability is
   layered on; the existing 45-cell matrix must keep working unchanged.
4. **Satellite communications get the most detail.** Terrestrial bands stay as they are.

### Taxonomy content

5. **GNSS gets its own rows, split civil / military** (mirrors the existing SATCOM
   civil/military split). C/A is fully public; M-code uses encrypted spreading and
   BOC(10,5) with materially better AJ.
   - GNSS is the case that proves the direction axis is load-bearing: **it has no user
     uplink.** That is why spoofing works (no challenge-response path), why OSNMA
     authenticates *inside* the downlink via delayed key disclosure, and why receivers
     are trivially undetectable (they emit nothing).
6. **ISL is included, at PHY, and includes optical / infrared.**
7. **Optical ISL is expected to be the standout row.** Microradian divergence — metres of
   spot after 1000 km, roughly four orders of magnitude narrower than a 6G pencil beam —
   *and it propagates in vacuum*, so the Ma et al. (2018) scatterer counterexample does
   not apply. Interception requires physically placing an aperture in the beam corridor.
   Expect **strong LPD and AJ on a commercial system**, which productively complicates the
   "civil = weak at PHY" narrative. LPI and LPE should still read weak (CCSDS optical
   formats are published; confidentiality lives above PHY).
8. **Keep two regimes.** Optical is marked as the **endpoint where confinement becomes
   absolute**, not a third regime. Make the **vacuum/scatterer distinction explicit** —
   it is the cleanest statement of why space differs from terrestrial mmWave.
9. **Add `N/A` as a fifth maturity value**, with a deliberately tight definition:
   > **N/A** — the objective has no referent for this system, because the system lacks
   > the thing the objective protects.

   GNSS TFS qualifies (a broadcast beacon has no traffic pattern to conceal).
   "Not researched" or "hard" must never map to N/A.
   Render it as *outside the scale* — hatched or outlined, not a paler W.
   Side benefit: pulling inapplicable cells out means the remaining Weak count is all
   genuine failure, strengthening the headline finding.

### Views

10. **Frontier folds into Matrix as a filter/layer**, not a peer view. It is literally the
    same component with a different filter, and nav is getting crowded.
11. **Signal Lab becomes a first-class top-level view** (it is currently only reachable via
    a band modal tab or a deep link). With 25–40 schemes it needs its own browsing surface.
12. Nav becomes: **Scene · Matrix · Signal Lab · About**.

### Presentation

13. **Light and dark themes**, with readability fixes landing *first* — see below.
14. **Name: moving off SCAT and SCAMT.** SCAMT contains "scam", SCAT has the obvious
    scatological reading; both are liabilities said out loud at a session chair's podium.
    Leading candidates: **Penumbra** (recommended), Orrery, Sightline.
    Penumbra's justification is exact, not decorative — the warden's three verdicts map
    onto eclipse geometry: HIDDEN = umbra, ENERGY ONLY = penumbra, EXPOSED = full
    illumination. The tool's subject is the partial-concealment zone.
    No backronym; use "Name: descriptive subtitle" as tool papers conventionally do.

---

## Theme + readability plan

### Diagnosis: the problem may not be darkness

Contrast of current tokens against `--bg-deep: #07070f` (approximate, verify with a
checker):

| Token | Used in | Ratio | WCAG AA |
|---|---|---|---|
| `--text-secondary` #9ca3af | body copy | ~7.5:1 | passes |
| `--text-muted` #6b7280 | cell notes, captions | ~4.2:1 | marginal fail |
| `--text-label` #4b5563 | ribbon ticks, counts | ~2.6:1 | clear fail |

The failing tokens are attached to the *smallest* type — 9px warden reason lines, 9px
ribbon ticks, 11px mono cell notes. **A light theme with the same ratios and sizes would
still read badly.** Fix contrast and type scale first; ship themes second.

### Type rules

- **Minimum 11px anywhere.** Retire 9px and 9.5px entirely.
- **Mono is for data, never for prose.** Frequencies, dB values, cell notes, axis labels →
  JetBrains Mono. Explanatory sentences (warden reasons, captions) → Inter.
- **`font-variant-numeric: tabular-nums` on every live readout.** The warden's dB values
  and the lab's EVM/PAPR numbers currently change width as they update, which makes them
  jitter. This is a one-line fix with a disproportionate polish payoff.
- Keep the Inter + JetBrains Mono pairing. Both are good; churning fonts is not the win.

### Dark theme (revised tokens)

Keep the background dark and **lift the text** — raising the background would *lower*
contrast with light text.

```
--text-primary    #e8e8f5   (≈15:1)
--text-secondary  #a8b0c0   (≈8:1)
--text-muted      #8b93a7   (≈5.5:1)   was #6b7280
--text-label      #7b8395   (≈4.6:1)   was #4b5563
```

### Light theme

Not pure white — this is a data-dense tool and white glares.

```
--bg-deep         #f7f8fb
--bg-card         #ffffff
--border-subtle   rgba(30,35,60,0.12)
--text-primary    #12141c
--text-secondary  #3f4655
--text-muted      #5a6172
--text-label      #6b7383
```

**Accents need a parallel ramp** — the dark-theme accents fail badly on white:

| Accent | Dark | On white | Light-theme replacement |
|---|---|---|---|
| cyan | #06b6d4 | ~2.5:1 fail | #0e7490 |
| amber | #f59e0b | ~2.0:1 fail | #b45309 |
| green | #10b981 | ~2.4:1 fail | #047857 |
| pink | #f43f5e | ~3.5:1 marginal | #be123c |
| indigo | #6366f1 | ~4.5:1 borderline | #4338ca |

**Note the bonus:** in light mode the maturity fills return close to the *source
presentation's* palette (the deck used light fills on white — `#E3E5EB` for Weak).
That makes light mode the natural source for **paper-ready figures**.

### Implementation approach

- `data-theme="dark|light"` on `<html>`; tokens defined per theme in `tokens.css`.
- Initial value from `prefers-color-scheme`, manual toggle persisted to `localStorage`.
- **Lab canvases read CSS custom properties** via `getComputedStyle` instead of importing
  a frozen `THEME` const — cache the values and invalidate on theme change. This makes
  canvas theming nearly free and keeps it in sync with CSS automatically.
- The **waterfall LUT needs a light-mode ramp**; its dark→bright gradient inverts
  meaninglessly on white. Consider a perceptually uniform map (viridis/magma) that works
  in both — arguably better science regardless.
- **The 3D scene stays dark in both themes**, presented as a deliberate viewport (the way
  Figma keeps its canvas dark). Nearly every glow, beam, haze and null uses additive
  blending, which saturates to white on a light background; re-deriving all of it is a
  project in itself and out of scope. Give it a distinct frame in light mode so it reads
  as intentional rather than broken.

### Tiering

| Tier | Surface | Cost |
|---|---|---|
| 1 | Matrix, About, modals, panels, ribbon | cheap — token swap |
| 2 | Six lab canvases | moderate — THEME becomes swappable + light colormap |
| 3 | 3D scene | expensive — **deferred, scene stays dark** |

---

## Data model sketch (additive)

Nothing existing changes shape. New tables reference existing entities.

```ts
type Direction = 'uplink' | 'downlink' | 'isl' | 'bidirectional';
type Maturity  = 'N' | 'E' | 'R' | 'W' | 'NA';   // NA is new

interface Threat {
  id: ThreatId;
  name: string;                  // 'terminal geolocation', 'downlink intercept'
  direction: Direction;
  attacks: ObjectiveId[];        // which of the five it defeats
  appliesTo: BandId[];
  segments?: SegmentId[];        // space | ground | link | user
  spartaId?: string;             // CROSS-REFERENCE ONLY — never mirror their text
  refIds: string[];
}

interface Mitigation {
  id: MitigationId;
  defeats: ThreatId[];
  direction: Direction;
  maturity: Maturity;
  mechanismId?: MechanismId;     // reuse existing PHY mechanisms where applicable
  refIds: string[];
}

interface Cell {
  /* ...everything currently in Cell, unchanged... */
  byDirection?: Partial<Record<Direction, { maturity: Maturity; note: string }>>;
}

interface Incident {             // real events anchor the model
  id: string;                    // 'viasat-acidrain-2022'
  threatIds: ThreatId[];
  systemIds: BandId[];
  outcome: string;
  refIds: string[];
}
```

**Discipline: derived, never authored twice.** Graph nodes and edges are *computed* from
`attacks` / `defeats` / `provisions`, never stored separately. Every bug found during the
TRANSEC build came from two tables drifting apart.

---

## Where the new axis surfaces in the existing scene

Three additions, all extending machinery that already exists:

1. **Split the link strands** — satellite links render as two strands, uplink and downlink,
   coloured by which objective is at risk in that direction.
2. **Give the warden an orbital vantage** — from the ground it observes downlinks; from
   orbit it observes *uplinks*, i.e. it geolocates the terminal (the Koisser threat).
   Two vantages, two threat models, one control.
   **`WardenPosition.elevated` already exists in the store and has never been read** — the
   hook is already there.
3. **Directional verdicts in the warden panel** — satellite rows split into two lines.

---

## Signal Lab expansion

Prioritised by value per unit of work:

1. **GNSS BOC family** — BPSK(1), BOC(1,1), CBOC, AltBOC, M-code BOC(10,5).
   Nearly free on the existing spreading code (BOC = PRN × square subcarrier). The
   split-spectrum signature is visually unmistakable and *explains* why M-code resists
   jamming and spoofing better than C/A. **Highest value addition.**
2. **DVB-S2X modcod ladder** — 64/128/256-APSK is more rings in the existing generator.
3. **OQPSK** — half-symbol Q offset; explains the saturated-amplifier constraint.
4. **PCM/PSK/PM residual carrier** — classic TT&C, taxonomically pointed (an always-on
   residual carrier is an LPD catastrophe by design).
5. **GMSK, SOQPSK, PPM** — need continuous-phase machinery. Real lift, defer.

**The demo to build the paper around: GNSS spoofing.** Authentic → meaconed (delayed
replay) → synthetic, with the correlation peak visibly splitting and being dragged off;
then Galileo OSNMA toggled as the mitigation. Exercises the threat/mitigation model, the
expanded modulation library, and the direction asymmetry at once — and it is grounded in
an ongoing real-world problem (Baltic / Eastern Mediterranean interference).

### Lab view layout

- Left rail: schemes grouped by family (linear, spread spectrum, CPM, GNSS/BOC, optical, TT&C).
- Filters: by band, by family, **and by objective demonstrated** — the thread tying the lab
  back to the taxonomy ("show me every waveform that achieves LPD").
- **Compare mode**: two panels side by side. Most of these only mean something in contrast
  (C/A vs M-code, OQPSK vs QPSK, BPSK(1) vs BOC(1,1)). One comparison is already hard-coded
  (OFDMA vs SC-FDMA PAPR); generalising it turns a fixed demo into a tool.
- **Adversary controls**: surface the jammers that already exist.

---

## Latent assets already in the codebase

- **`dsp/channel.ts` already implements the jammers** — barrage, partial-band, follower —
  plus artificial noise and spatial nulls, all with passing tests. **None of it is surfaced
  in any UI.** The attack layer is substantially less new code than it appears.
- **`WardenPosition.elevated`** exists in the store, never read. Defined for exactly the
  orbital-vantage case.

---

## Architecture notes

- **`lab/generators.ts` must become a registry before authoring 30 more schemes.** It is
  already a ~400-line switch with one case per scheme; at 40 it is unmaintainable. One
  module per scheme family, self-registering, with the panel composing from declared
  metadata. This refactor pays for itself around scheme fifteen and is far cheaper to do
  *before* the authoring push than after.
- Keep the DSP core as the shared, stable, tested foundation. It has zero UI coupling.
- Freeze interfaces before any parallel authoring. Every integration bug in the TRANSEC
  build (doubled cones, black null wedge, mid-air carrier, frozen waterfall, stranded hop
  dots) came from two independently-correct components disagreeing about a shared
  assumption left ambiguous in a contract.

---

## Evaluation plan (a tool paper needs one)

This is what separates accepted tool papers from rejected ones. Plan it now — it shapes
the build.

- **Classroom deployment** — most achievable and most credible. Use it in a course,
  collect pre/post comprehension data. Fits VizSec, USENIX ASE, SIGCSE.
- **Expert walkthrough** — structured think-aloud with SIGINT/EW practitioners.
- **Task-based study** — "which bands are vulnerable to follower jamming?" measured with
  and without the tool.
- **Case-study validation** — reproduce known incidents end-to-end (Viasat/AcidRain 2022,
  Baltic GNSS jamming, Turla satellite-downlink C2) and show the model accounts for them.

---

## Open questions

- **Final name** — check Google Scholar, GitHub, npm and domains before committing.
  Known adjacency: Penumbra (a game series, a medical-device company); Sightline (Sightline
  Media Group publishes *Defense News* — mild adjacency in-field).
- **Threat count target** — ~25–40 SATCOM-focused entries feels right: enough to be a
  contribution, small enough to author carefully with real citations.
- **SPARTA licensing** — it is Aerospace Corporation's work. Referencing technique IDs and
  linking out is almost certainly fine; mirroring descriptions may not be. **Author original
  descriptions and cite SPARTA IDs as cross-references.** Check their terms before
  committing to it as a spine.
- **Is this a second paper or the same paper's second half?**
- **Does ISL get a full row set or a partial one?** It is the least-studied direction in the
  literature, which makes it either the best frontier claim or a distraction.
- **Repo strategy** — new branch off `transec-taxonomy`; decide whether the successor is a
  sibling app directory or an in-place expansion. Current lean: in-place expansion, since
  the paper is about *one* tool.
