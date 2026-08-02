/**
 * Type contracts for the TRANSEC taxonomy dataset.
 *
 * FROZEN INTERFACE — data-authoring agents code against these types.
 * Source of truth: transec_taxonomy.pptx (objectives, matrix, mechanisms)
 * and wireless_bands_survey.pptx (band physics). Do not change shapes
 * without updating every data file together.
 */

// ——— Identifiers ———————————————————————————————————————————————

export type BandId =
  | 'nfc'
  | 'bluetooth'
  | 'wifi'
  | 'cellular-3g-4g'
  | 'cellular-5g'
  | '6g-subthz'
  | 'satcom-civil'
  | 'satcom-military';

export type ObjectiveId = 'lpd' | 'lpi' | 'lpe' | 'aj' | 'tfs';

export type MechanismId =
  | 'spreading'
  | 'hopping'
  | 'power-control'
  | 'beam-confinement'
  | 'spatial-nulling'
  | 'wiretap-coding'
  | 'artificial-noise'
  | 'absorption'
  | 'emission-control';

/** N = Native (physics gives it) · E = Engineered (deployed) · R = Research · W = Weak/absent */
export type Maturity = 'N' | 'E' | 'R' | 'W';

/** Which physical regime a mechanism lives in (slide 10 of the taxonomy deck). */
export type Regime = 'signal-domain' | 'propagation-spatial';

// ——— References ————————————————————————————————————————————————

export interface Reference {
  id: string;              // short citation key, e.g. 'bash2013'
  authors: string;         // 'B. A. Bash, D. Goeckel, D. Towsley'
  title: string;
  venue: string;           // journal/standard body + vol/no
  year: number;
  doi?: string;            // bare DOI, e.g. '10.1109/JSAC.2013.130923'
  url?: string;            // canonical URL when no DOI (standards, gov docs)
  tags: (ObjectiveId | 'band-context' | 'foundation')[];
}

// ——— Bands (from wireless_bands_survey.pptx) ————————————————————

/**
 * The 7-field physics schema used identically on every band slide.
 * Each field: `summary` is one plain-language sentence (public layer),
 * `details` are the precise bullet points (academic layer).
 */
export interface PhysicsField {
  summary: string;
  details: string[];
}

export interface BandPhysics {
  frequencyRange: PhysicsField;
  waveCharacteristics: PhysicsField;
  modulationAccess: PhysicsField;
  power: PhysicsField;
  noiseInterference: PhysicsField;
  antenna: PhysicsField;
  applications: PhysicsField;
  benefitsLimitations: PhysicsField;
}

export interface Band {
  id: BandId;
  name: string;             // 'Cellular 5G NR'
  shortName: string;        // '5G NR' — ribbon + emitter labels
  /** Representative frequency span in Hz for ribbon placement (log scale). */
  freqLowHz: number;
  freqHighHz: number;
  /** One-line descriptor, e.g. '2.400–2.4835 GHz · λ ≈ 12.5 cm · 1–100 m' */
  tagline: string;
  /** Scene placement layer, ground → orbit. */
  sceneLayer: 'personal' | 'local' | 'cellular' | 'leo' | 'geo';
  physics: BandPhysics;
  refIds: string[];
}

// ——— Objectives (from transec_taxonomy.pptx slides 2, 5–9) ——————

export interface Objective {
  id: ObjectiveId;
  abbr: string;             // 'LPD'
  name: string;             // 'Low Probability of Detection'
  /** One-sentence definition (slide 2). */
  definition: string;
  /** What attacks it defeats (slide 2 'Defeats:'). */
  defeats: string;
  /** Accent color from the deck, hex with '#'. */
  color: string;
  /** Narrative sections from the per-objective slide (5–9). */
  howAchieved: string[];    // 'How it is achieved, low band → high band'
  whereStrong: string[];
  whereWeak: string[];      // 'Where it fails or is missing'
  taxonomicReading: string;
  refIds: string[];
}

// ——— Mechanisms (slide 3 axis) ———————————————————————————————————

export interface Mechanism {
  id: MechanismId;
  name: string;             // 'Frequency hopping'
  regime: Regime;
  /** Which scene waveform visual renders this mechanism. */
  sceneVisual:
    | 'nearFieldBubble'
    | 'omniRings'
    | 'spreadHaze'
    | 'hopScatter'
    | 'pencilBeam'
    | 'nulledLobe'
    | 'absorptionFalloff'
    | 'constantCarrier';
  description: string;
}

// ——— The matrix (slide 4) ————————————————————————————————————————

export interface Cell {
  bandId: BandId;
  objectiveId: ObjectiveId;
  maturity: Maturity;
  /** Verbatim short note from the slide-4 cell, e.g. 'beam confinement'. '—' allowed. */
  note: string;
  /** Mechanisms at work in this cell (may be empty for W cells). */
  mechanismIds: MechanismId[];
  /** Optional cell-specific elaboration beyond the slide note. */
  detail?: string;
}

// ——— Modulation lab configs ——————————————————————————————————————

export type LabViewKind =
  | 'constellation'
  | 'timeDomain'
  | 'spectrum'
  | 'eyeDiagram'
  | 'timeFreq'
  | 'spreading';

export interface ModulationScheme {
  id: string;               // 'dsss-cdma', 'ofdm', 'gfsk', ...
  bandId: BandId;
  name: string;             // 'DSSS-CDMA @ 3.84 Mcps'
  /** Which lab primitives compose this scheme's panel, in display order. */
  views: LabViewKind[];
  /** Free-form parameters consumed by the lab generators. */
  params: Record<string, number | string | boolean>;
  /** Which objectives this scheme's adversary overlay demonstrates. */
  demonstrates: ObjectiveId[];
  caption: string;          // one-line 'why this matters' teaching hook
}

// ——— Dataset root ————————————————————————————————————————————————

export interface Taxonomy {
  bands: Band[];
  objectives: Objective[];
  mechanisms: Mechanism[];
  cells: Cell[];
  modulations: ModulationScheme[];
  references: Reference[];
}

// ——— Constants shared by views ———————————————————————————————————

export const MATURITY_LABEL: Record<Maturity, string> = {
  N: 'Native — propagation or design gives it',
  E: 'Engineered — deployed, known mechanism',
  R: 'Research — emerging or proposed',
  W: 'Weak / absent',
};

/** Fill colors as used on slide 4 of the taxonomy deck. */
export const MATURITY_COLOR: Record<Maturity, string> = {
  N: '#0E7C86',
  E: '#27327F',
  R: '#D97706',
  W: '#E3E5EB',
};

export const BAND_ORDER: BandId[] = [
  'nfc',
  'bluetooth',
  'wifi',
  'cellular-3g-4g',
  'cellular-5g',
  '6g-subthz',
  'satcom-civil',
  'satcom-military',
];

export const OBJECTIVE_ORDER: ObjectiveId[] = ['lpd', 'lpi', 'lpe', 'aj', 'tfs'];

/** Look up a cell; throws on a missing pair so gaps fail loudly in dev. */
export function cellFor(cells: Cell[], bandId: BandId, objectiveId: ObjectiveId): Cell {
  const c = cells.find((c) => c.bandId === bandId && c.objectiveId === objectiveId);
  if (!c) throw new Error(`matrix cell missing: ${bandId}/${objectiveId}`);
  return c;
}
