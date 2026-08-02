/**
 * About view — plain-language explanation of what this thing is and how
 * the scene works. Written for someone who just landed here: what the
 * warden does, what the regime strip means, how to read a cell.
 *
 * Objective and maturity text is pulled from the dataset rather than
 * retyped, so this page cannot drift from the taxonomy it describes.
 */

import { OBJECTIVES } from '../data/objectives';
import { BANDS } from '../data/bands';
import { CELLS } from '../data/matrix';
import { MATURITY_LABEL } from '../data/types';
import type { Maturity } from '../data/types';
import { setState } from '../store';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function mountAbout(container: HTMLElement): void {
  const wrap = document.createElement('div');
  wrap.className = 'about-wrap';

  const objectiveRows = OBJECTIVES.map(
    (o) => `<tr>
      <th scope="row"><span class="ab-abbr" style="background:${o.color}">${o.abbr}</span></th>
      <td><strong>${esc(o.name)}</strong><br><span class="ab-dim">${esc(o.definition)}</span></td>
    </tr>`,
  ).join('');

  const maturityCards = (['N', 'E', 'R', 'W'] as Maturity[])
    .map((m) => {
      const count = CELLS.filter((c) => c.maturity === m).length;
      const [head, tail] = MATURITY_LABEL[m].split(' — ');
      return `<div class="ab-mat mat-${m}">
        <span class="ab-mat-badge">${m}</span>
        <div>
          <strong>${esc(head!)}</strong>
          ${tail ? `<span class="ab-dim"> — ${esc(tail)}</span>` : ''}
          <div class="ab-count">${count} of ${CELLS.length} cells</div>
        </div>
      </div>`;
    })
    .join('');

  wrap.innerHTML = `
    <article class="about-doc">

      <header class="ab-hero">
        <h2>What this is</h2>
        <p class="ab-lede">
          Every wireless system has to answer a security question that encryption cannot:
          <em>can an adversary tell you are transmitting at all?</em> Encryption hides
          <strong>what you said</strong>. Transmission security — TRANSEC — hides
          <strong>that you spoke</strong>, who you are, and whether anyone can stop you.
        </p>
        <p>
          This site maps five TRANSEC objectives across ${BANDS.length} slices of the radio spectrum,
          from a contactless card at 13.56&nbsp;MHz to sub-terahertz research links, and from a
          phone in your hand to a satellite in geostationary orbit. Its central claim is that
          <strong>the band changes which security mechanisms physically exist</strong> — so the
          spectrum axis deserves to be a first-class part of the taxonomy, not a footnote.
        </p>
      </header>

      <section>
        <h3>The five objectives</h3>
        <p class="ab-dim">These are the columns of the matrix. Each asks a different question about what the adversary gets.</p>
        <table class="ab-obj-table">${objectiveRows}</table>
      </section>

      <section>
        <h3>How to read a cell</h3>
        <p>
          Every cell in the matrix answers: <em>for this band, how is this objective achieved —
          and how mature is it?</em> The letter is the maturity rating, the text underneath is the
          mechanism (or the reason there isn't one).
        </p>
        <div class="ab-mat-grid">${maturityCards}</div>
        <p class="ab-note">
          Most cells are <strong>Weak</strong>, and that is the finding, not a gap in the research.
          Upper-layer cryptography is out of scope here, so civil systems that lean on it — Wi-Fi,
          cellular, consumer satellite — correctly read as weak at the physical layer.
        </p>
      </section>

      <section>
        <h3>The scene: what you are looking at</h3>
        <p>
          The 3D view is a ground-to-orbit diorama. It is not decoration — every element is
          driven by the same data as the matrix.
        </p>
        <ul class="ab-list">
          <li><strong>Glowing nodes</strong> are transmitters, one per band, placed by altitude:
            personal devices on the ground, cell towers above them, then the LEO shell, the MEO
            navigation belt, and the GEO arc at the top.</li>
          <li><strong>Small props</strong> are the intended receivers — a house, a person with
            earbuds, a card at a reader, a flat-panel satellite terminal. Cyan dots travel the
            link lines between transmitter and receiver: that is the conversation.</li>
          <li><strong>The cones</strong> on 5G and 6G are serving beams, aimed at their actual
            receivers. Narrow beams are the whole high-band security story.</li>
          <li><strong>Orbit rings</strong> move at different speeds on purpose: LEO streams past,
            GNSS crawls, GEO hangs perfectly still. That is the orbit trade made visible.</li>
        </ul>
      </section>

      <section>
        <h3>The lens: five ways to re-skin the world</h3>
        <p>
          Pick an objective in the top-right (<span class="ab-key">LPD</span>
          <span class="ab-key">LPI</span> <span class="ab-key">LPE</span>
          <span class="ab-key">AJ</span> <span class="ab-key">TFS</span>) and the entire scene
          recolors by that objective's maturity, while each transmitter grows the visual for
          <em>how</em> it achieves that goal — a tight bubble for near-field decay, a noise-like
          haze for spread spectrum, a pencil beam for millimetre wave, hopping energy for
          frequency-hopped links.
        </p>
        <p class="ab-note">
          <strong>Try TFS.</strong> Traffic Flow Security is the emptiest column in the taxonomy,
          and under that lens nearly the whole scene goes dark — only military SATCOM's steady
          carrier stays lit. That blackout is the single clearest argument this project makes.
        </p>
      </section>

      <section>
        <h3>The warden: what an eavesdropper actually gets</h3>
        <p>
          The red figure is the <strong>warden</strong> — the adversary. Drag it anywhere on the
          ground and the panel recomputes, live, what someone standing there could pick up from
          every band, using the real geometry of the scene.
        </p>
        <div class="ab-verdicts">
          <div class="ab-v v-exposed"><span>EXPOSED</span> your transmission is recoverable from here</div>
          <div class="ab-v v-energy"><span>ENERGY ONLY</span> they detect something, but cannot resolve it</div>
          <div class="ab-v v-hidden"><span>HIDDEN</span> nothing reaches this position</div>
        </div>
        <p>
          Verdicts are worded from <strong>your</strong> side, the defender's: red is bad news for
          you, green is good. Lines drawn from the warden to each transmitter show the same thing
          in the scene — and when it hears nothing, there is simply no line.
        </p>
        <p>
          The three preset buttons stage the argument in one click. <em>Beside Wi-Fi</em>: beacons
          are broadcast by design, so it is exposed from anywhere. <em>In 5G beam</em>: step inside
          the cone and everything is readable. <em>Far off-axis</em>: a few degrees out of that same
          beam and the link vanishes. Same transmitter, opposite outcome — that is spatial security.
        </p>
        <p class="ab-note">
          The <strong>scatterer in beam</strong> toggle drops a reflective object into the 5G beam
          path. Watch 5G flip from HIDDEN back to EXPOSED even though the warden never moved: a
          scatterer re-enables eavesdropping, so millimetre-wave covertness is not automatic
          (Ma et&nbsp;al., <em>Nature</em> 563, 2018).
        </p>
      </section>

      <section>
        <h3>The strip above the spectrum bar</h3>
        <p>This band runs along the bottom of the scene, just above the frequency ruler:</p>
        <div class="ab-regime-demo" aria-hidden="true">
          <span class="r-signal">◀ SIGNAL-DOMAIN REGIME · SPREADING / HOPPING / CODING</span>
          <span class="r-transition">7–24 GHZ TRANSITION</span>
          <span class="r-spatial">PROPAGATION-SPATIAL REGIME · BEAMS / NULLS / ABSORPTION ▶</span>
        </div>
        <p>
          It is a map of <em>where security comes from</em> as you climb the spectrum, and it lines
          up with the frequency ruler beneath it.
        </p>
        <ul class="ab-list">
          <li><strong>Left — signal-domain regime (low bands).</strong> Security is built into the
            waveform itself: spread the signal thin, hop it around, code it. You are hiding in
            the <em>signal</em>. The ceiling is that narrow bandwidth caps how much you can spread,
            and a single antenna gives you no spatial options.</li>
          <li><strong>Right — propagation-spatial regime (high bands).</strong> Security comes from
            physics and geometry: pencil beams that only illuminate the receiver, spatial nulls
            aimed at the eavesdropper, and atmospheric absorption that kills the signal past a
            certain range. You are hiding in <em>space</em>. The ceiling is fragility — blockage
            breaks the link, and a scatterer breaks the secrecy.</li>
          <li><strong>Middle — the 7–24 GHz transition (hatched).</strong> The one region where a
            system can draw on <em>both</em> toolkits at once. It is the richest and least-mapped
            part of the taxonomy, and the likeliest home of 6G's first spectrum.</li>
        </ul>
        <p class="ab-note">
          This is why band has to be a real axis: the taxonomy is not just recording which systems
          are more secure, it is showing that <strong>the available mechanism changes with
          frequency</strong>. Spreading is not an option at 300 GHz; beam nulling is not an option
          at 13.56 MHz.
        </p>
      </section>

      <section>
        <h3>The spectrum bar itself</h3>
        <p>
          The bar underneath is a logarithmic ruler from 10 MHz to 1 THz. Each labelled chip is a
          band — click one to fly the camera to that transmitter. Hovering the bar reads out the
          frequency under your cursor.
        </p>
      </section>

      <section>
        <h3>The signal lab</h3>
        <p>
          Open any band and choose the <strong>Signal</strong> tab to see its actual waveform,
          generated live in your browser rather than replayed from a recording — so the sliders
          change real mathematics. This is the same argument one level down: the scene shows
          <em>where</em> security lives in space, the lab shows <em>how</em> it works in the signal.
        </p>
        <p class="ab-note">
          The clearest one: open the 3G DSSS demo and drag the noise floor up. The ordinary signal
          stays plainly visible while the spread-spectrum signal disappears beneath the noise —
          still perfectly decodable by anyone holding the code. That is low-probability-of-detection
          as an interactive fact instead of a claim.
        </p>
      </section>

      <section>
        <h3>The other views</h3>
        <ul class="ab-list">
          <li><strong>Matrix</strong> — the full grid, every band against every objective. The
            scholarly heart of the project, and fully keyboard-navigable.</li>
          <li><strong>Frontier</strong> — the same grid filtered to gaps and research-stage work:
            what is missing and where new contributions belong.</li>
        </ul>
        <p>
          Every band, cell, lens and lab demo has its own link, so any single claim here can be
          cited or shared directly.
        </p>
      </section>

      <footer class="ab-foot">
        <p>
          Companion to <em>Wireless Communication Bands</em> and <em>Mapping TRANSEC onto the
          Wireless Spectrum</em>. Restricted to the physical layer; COMSEC is out of scope.
          Nicholas D. Redmond · University of Memphis.
        </p>
        <div class="ab-cta">
          <button data-goto="scene">Open the scene</button>
          <button data-goto="matrix">See the matrix</button>
        </div>
      </footer>
    </article>
  `;

  container.appendChild(wrap);
  wrap.querySelectorAll<HTMLButtonElement>('[data-goto]').forEach((btn) => {
    btn.addEventListener('click', () =>
      setState({ view: btn.dataset.goto as 'scene' | 'matrix' }),
    );
  });
}
