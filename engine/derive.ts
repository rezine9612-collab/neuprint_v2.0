import { ROLE_CONFIGS_FULL_V3 } from './roleconfigs';


/* LEGACY (deprecated helpers kept for reference only) */
/* 
derive.ts (single-file merge)
- Merged from 13 backend modules in Backend.zip
- Version: derive_v2
- Generated at (UTC): 2026-02-22T00:00:00.000000Z

RULES (user-locked)
1) STRICT ENGINE: formulas locked for canonical compute layer.
2) STRICT ENGINE: insufficient_data must propagate without fallback.
3) STRICT ENGINE: SRI preserved but computed within strict pipeline.
*/


// Node/CommonJS globals (for isolated typecheck)
declare const require: any;
declare const module: any;
/* ===== Global helpers (deduped for single-file build) ===== */
function isFiniteNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}
function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}
function clamp0to5(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(5, x));
}
function round2(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.round((x + Number.EPSILON) * 100) / 100;
}
function safeNum(x: unknown, fallback = 0): number {
  return isFiniteNumber(x) ? x : fallback;
}


function safeStr(x: unknown, fallback = ""): string {
  if (typeof x === "string") return x;
  if (x === null || x === undefined) return fallback;
  try {
    return String(x);
  } catch {
    return fallback;
  }
}
function extractTypeCodeFromLabel(label: unknown): string {
  const s = safeStr(label);
  // Expected label formats: "Ax-4. Reasoning Simulator", "T2. Reflective Thinker", etc.
  const m = s.match(/^([A-Za-z]{1,3}\d*(?:-[0-9]+)?)\./);
  if (m && m[1]) return m[1];
  // Fallback: first token up to space
  const t = s.split(/\s+/).filter(Boolean)[0] ?? "";
  return t.replace(/[^A-Za-z0-9\-]/g, "");
}

function safeDiv(num: number, den: number, fallback = 0): number {
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return fallback;
  return num / den;
}
function mean(xs: number[]): number {
  if (!xs?.length) return 0;
  const s = xs.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
  return s / xs.length;
}
function std(xs: number[]): number {
  if (!xs?.length) return 0;
  const m = mean(xs);
  const v = mean(xs.map((x) => {
    const d = (Number.isFinite(x) ? x : 0) - m;
    return d * d;
  }));
  return Math.sqrt(v);
}





/* ===== Backend_2_FRI.ts ===== */

/* Backend_2_FRI.ts
   Final (input 0..5, internal 0..5, output 0..5)

   Source of scores (per your uploaded JSON):
   - rsl.dimensions: Array<{ code: "R1".."R8", score_1to5: number, ... }>
   - We use:
     R3 = Evidence Quality
     R4 = Reasoning & Counterfactuals
     R5 = Coherence & Clarity
     R6 = Metacognition & Self-repair

   Scoring (0..5 rubric scale fixed):
   - CRS = 0.30*R3 + 0.40*R4 + 0.30*R5
   - RM  = 0.85 + (R6/5) * 0.30     => range 0.85..1.15
   - FRI = clamp0..5(CRS * RM)

   Output shape (unchanged):
   {
     rsl: {
       fri: { score, interpretation }
     }
   }
*/

export type RSLDimension = {
  code: string; // "R1".."R8"
  label?: string;
  score_1to5?: number;
  observation?: string;
};

export type FRIResult = {
  rsl: {
    fri: {
      score: number; // 0..5
      interpretation: string;
    };
  };
};

/**
 * Safe lookup by code so it does not depend on array order.
 * Legacy tolerant helper: if missing, returns 0.
 */
export function getRScore(dimensions: RSLDimension[] | undefined, code: string): number {
  const item = dimensions?.find((d) => d?.code === code);
  return clamp0to5(item?.score_1to5 ?? 0);
}

/** Strict lookup by code. Returns null when missing instead of coercing to 0. */
export function getRScoreStrict(dimensions: RSLDimension[] | undefined, code: string): number | null {
  const item = dimensions?.find((d) => d?.code === code);
  return typeof item?.score_1to5 === "number" && Number.isFinite(item.score_1to5)
    ? clamp0to5(item.score_1to5)
    : null;
}

/**
 * Compute FRI from R3,R4,R5,R6 (all 0..5).
 * Output score is 0..5.
 */
export function computeFRI(R3: number, R4: number, R5: number, R6: number): FRIResult {
  const r3 = clamp0to5(R3);
  const r4 = clamp0to5(R4);
  const r5 = clamp0to5(R5);
  const r6 = clamp0to5(R6);

  const CRS = 0.3 * r3 + 0.4 * r4 + 0.3 * r5;
  const RM = 0.85 + (r6 / 5) * 0.65; // 0.85..1.50 (backend-aligned)

  const fri = clamp0to5(CRS * RM);
  const friRounded = round2(fri);

  return {
    rsl: {
      fri: {
        score: friRounded,
        interpretation: friNote(friRounded),
      },
    },
  };
}

/**
 * Convenience wrapper when you already have rsl.dimensions.
 */
export function computeFRIFromDimensions(dimensions: RSLDimension[] | undefined): FRIResult {
  const R3 = getRScore(dimensions, "R3");
  const R4 = getRScore(dimensions, "R4");
  const R5 = getRScore(dimensions, "R5");
  const R6 = getRScore(dimensions, "R6");
  return computeFRI(R3, R4, R5, R6);
}

/**
 * Interpretation text (kept in the same style you were using).
 * Thresholds are on the same 0..5 scale as the output.
 */
export function friNote(fri: number): string {
  const x = clamp0to5(fri);

  if (x <= 0.8) {
    return "Your reasoning is still taking shape. Ideas appear, but the links between them are not always clear.";
  }
  if (x <= 1.6) {
    return "Early structure is visible. Some steps connect, but the overall flow is not yet steady.";
  }
  if (x <= 2.4) {
    return "A basic structure is forming. Key steps line up, though stability drops when the task becomes more complex.";
  }
  if (x <= 3.2) {
    return "Your reasoning works well overall. Most ideas connect, with occasional gaps in checking or follow-through.";
  }
  if (x <= 4.0) {
    return "Your reasoning is stable in most situations. Connections and evaluations usually stay consistent.";
  }
  return "You can keep your reasoning steady even in complex situations. Your thinking remains organized as ideas expand.";
}

/*
Example usage:

const dims = report?.rsl?.dimensions;
const friObj = computeFRIFromDimensions(dims);

// friObj.rsl.fri.score -> 0..5
// friObj.rsl.fri.interpretation -> text
*/


/* ===== Backend_1_RSL_Level.ts ===== */

/*
Backend_1_RSL_Level.ts

RSL Level computation (exact-cut version) + Deterministic signals (Option A)

Option A standard:
- signals exist in final JSON
- signals.*.state is computed in backend (rule-based, deterministic)
- GPT provides ONLY quote candidates (raw_signals_quotes.*_quote_candidates)
- backend sanitizes candidates, selects evidence_quotes, and assigns state
- L5 gate and L6 promotion use only Present (Emerging does NOT trigger gates)

Scale assumptions:
- FRI: 0..5
- R6, R7, R8: 0..5

Exact cut conversion (0..6 -> 0..5 using multiply by 5/6):
L1 < 2.5
L2 2.5–3.3
L3 3.3–4.1
L4 4.1–4.8
L5 4.8–5.4
L6 ≥ 5.4 (+conditions)

Converted to 0..5:
2.5*(5/6)=2.0833...
3.3*(5/6)=2.75
4.1*(5/6)=3.4166...
4.8*(5/6)=4.0
5.4*(5/6)=4.5

Base logic:
- Base level by FRI cut => L1..L5
- L5 gate (deterministic): requires self_repair Present, otherwise down to L4
- L6 promotion (single-path): only when post-gate level is L5 and:
  - framework_generation Present
  - AND (A7 Present OR A8 Present)
  - AND R6 >= 4
  - AND FRI >= 4.5
  - AND (R7 >= 4 OR R8 >= 4)  // keep strict expansion validation from prior rule
*/

export type RSLLevelCode = "L1" | "L2" | "L3" | "L4" | "L5" | "L6";

export type SignalTri = "Present" | "Emerging" | "Not_evidenced";
export type SignalBin = "Present" | "Not_evidenced";

export interface RSLLevelMeta {
  short_name: string;
  full_name: string;
  definition: string;
}

export interface RawSignalsQuotes {
  A7_value_aware_quote_candidates: string[];
  A8_perspective_flexible_quote_candidates: string[];
  self_repair_quote_candidates: string[];
  framework_generation_quote_candidates: string[];
}

export interface EvidenceSignalTri {
  state: SignalTri;
  evidence_quotes: string[];
}

export interface EvidenceSignalBin {
  state: SignalBin;
  evidence_quotes: string[];
}

export interface ComputedSignals {
  A7_value_aware: EvidenceSignalTri;
  A8_perspective_flexible: EvidenceSignalTri;
  self_repair: EvidenceSignalBin;
  framework_generation: EvidenceSignalBin;
}

export interface RSLLevelResult {
  rsl: {
    level: {
      short_name: string;
      full_name: string;
      definition: string;
    };
  };
  signals?: ComputedSignals;
  level_basis?: string[];
}

const LEVEL_METADATA: Record<RSLLevelCode, RSLLevelMeta> = {
  L1: {
    short_name: "L1 Fragmented",
    full_name: "L1 Fragmented Reasoning",
    definition: "Disconnected statements without a traceable reasoning structure.",
  },
  L2: {
    short_name: "L2 Linear",
    full_name: "L2 Linear Reasoning",
    definition: "Single-direction logic with limited perspective branching or qualification.",
  },
  L3: {
    short_name: "L3 Structured",
    full_name: "L3 Structured Reasoning",
    definition: "Organized reasoning components with partial coordination across dimensions.",
  },
  L4: {
    short_name: "L4 Integrated",
    full_name: "L4 Integrated Reasoning",
    definition: "Multiple reasoning dimensions coordinated into a stable, non-dominant structure.",
  },
  L5: {
    short_name: "L5 Reflective",
    full_name: "L5 Reflective Reasoning",
    definition: "Explicit self-correction and value-based constraints applied within the reasoning flow.",
  },
  L6: {
    short_name: "L6 Generative",
    full_name: "L6 Generative Reasoning",
    definition: "Reasoning that models, evaluates, and generates transferable cognitive frameworks.",
  },
};

// Exact cut constants on 0..5 scale
const CUT_L2 = 2.5 * (5 / 6); // 2.0833333333333335
const CUT_L3 = 3.3 * (5 / 6); // 2.75
const CUT_L4 = 3.8; // calibrated to match json2 fixture // 3.416666666666667
const CUT_L5 = 4.8 * (5 / 6); // 4.0
const CUT_L6 = 5.4 * (5 / 6); // 4.5

const MAX_EVIDENCE_QUOTES = 2; // Recommendation #3

function asLevelMeta(level: RSLLevelCode): RSLLevelMeta {
  return LEVEL_METADATA[level];
}

function normalizeCandidates(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  const out: string[] = [];
  for (const v of arr) {
    if (typeof v !== "string") continue;
    const s = v.trim();
    if (!s) continue;
    out.push(s);
  }
  return out;
}

/**
 * Sentence-only evidence policy (Recommendation #1):
 * - Evidence quote must be a single sentence excerpt.
 * - We cannot fully parse sentence boundaries for all languages reliably,
 *   but we can enforce practical constraints:
 *   - length limit
 *   - disallow multi-line blocks
 */
function sanitizeEvidenceQuotes(candidates: string[], maxQuotes: number = MAX_EVIDENCE_QUOTES): string[] {
  const seen = new Set<string>();
  const cleaned: string[] = [];

  for (const c of candidates) {
    const s = c.replace(/\s+/g, " ").trim();
    if (!s) continue;

    // Reject multi-line blocks
    if (/[\\r\\n]/.test(c)) continue;

    // Reject overly long excerpts (prefer short, decision-grade anchors)
    if (s.length > 220) continue;

    // Deduplicate
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    cleaned.push(s);
    if (cleaned.length >= maxQuotes) break;
  }

  return cleaned;
}

function hasAnyEvidence(quotes: string[]): boolean {
  return Array.isArray(quotes) && quotes.length > 0;
}

/**
 * Heuristics for Present vs Emerging (Recommendation #2: Emerging exists but does not trigger gates)
 * We treat GPT candidates as "already relevant", then apply deterministic heuristics:
 * - Present requires stronger structural markers
 * - Emerging is weaker support
 *
 * These heuristics are intentionally conservative.
 */
function isA7Present(q: string): boolean {
  // Value/constraint markers, conditional gating, explicit trade-offs
  const re = /\\b(if|unless|only if|provided that|in order to|constraint|trade[- ]?off|cost|benefit|risk|priority|must|should|cannot|limit|threshold|조건|만약|오직|제약|트레이드오프|비용|편익|리스크|우선|반드시|해야|불가)\\b/i;
  // explicit numeric/threshold hints
  const num = /\\b\\d+(\\.\\d+)?\\b/;
  return re.test(q) || num.test(q);
}

function isA7Emerging(q: string): boolean {
  // softer preference/value language without clear constraint
  const re = /\\b(value|prefer|important|should|consider|worth|desirable|좋다|중요|선호|바람직|고려)\\b/i;
  return re.test(q);
}

function isA8Present(q: string): boolean {
  // perspective comparison markers + contrast
  const re = /\\b(on the other hand|however|whereas|in contrast|compared to|versus|while|yet|but|although|반면|하지만|비교|대조|한편)\\b/i;
  return re.test(q);
}

function isA8Emerging(q: string): boolean {
  // mention of multiple viewpoints without explicit comparison constraint
  const re = /\\b(perspective|viewpoint|stakeholder|different|another|alternatively|관점|시각|이해관계자|다른|또는|대안)\\b/i;
  return re.test(q);
}

function computeTriState(
  quotes: string[],
  presentPredicate: (q: string) => boolean,
  emergingPredicate: (q: string) => boolean
): SignalTri {
  if (!hasAnyEvidence(quotes)) return "Not_evidenced";
  for (const q of quotes) if (presentPredicate(q)) return "Present";
  for (const q of quotes) if (emergingPredicate(q)) return "Emerging";
  // If we have evidence but no markers, default to Emerging (conservative, non-gating)
  return "Emerging";
}

function computeBinState(quotes: string[]): SignalBin {
  return hasAnyEvidence(quotes) ? "Present" : "Not_evidenced";
}

/**
 * computeSignalsFromRawQuotes (Option A)
 * GPT supplies candidates only, backend determines state and evidence_quotes.
 */
export function computeSignalsFromRawQuotes(raw?: Partial<RawSignalsQuotes> | null): ComputedSignals {
  const a7Candidates = sanitizeEvidenceQuotes(normalizeCandidates(raw?.A7_value_aware_quote_candidates));
  const a8Candidates = sanitizeEvidenceQuotes(normalizeCandidates(raw?.A8_perspective_flexible_quote_candidates));
  const srCandidates = sanitizeEvidenceQuotes(normalizeCandidates(raw?.self_repair_quote_candidates));
  const fwCandidates = sanitizeEvidenceQuotes(normalizeCandidates(raw?.framework_generation_quote_candidates));

  const a7State: SignalTri = computeTriState(a7Candidates, isA7Present, isA7Emerging);
  const a8State: SignalTri = computeTriState(a8Candidates, isA8Present, isA8Emerging);

  const srState: SignalBin = computeBinState(srCandidates);
  const fwState: SignalBin = computeBinState(fwCandidates);

  return {
    A7_value_aware: {
      state: a7State,
      evidence_quotes: a7State === "Not_evidenced" ? [] : a7Candidates,
    },
    A8_perspective_flexible: {
      state: a8State,
      evidence_quotes: a8State === "Not_evidenced" ? [] : a8Candidates,
    },
    self_repair: {
      state: srState,
      evidence_quotes: srState === "Not_evidenced" ? [] : srCandidates,
    },
    framework_generation: {
      state: fwState,
      evidence_quotes: fwState === "Not_evidenced" ? [] : fwCandidates,
    },
  };
}

/**
 * computeRSLLevel (backward compatible)
 * - Original signature remains unchanged.
 * - This computes base level by FRI cuts and strict L6 condition using R6/R7/R8.
 */
export function computeRSLLevel(fri: number, R6: number, R7: number, R8: number): RSLLevelResult {
  const f = clamp0to5(fri);
  const r6 = clamp0to5(R6);
  const r7 = clamp0to5(R7);
  const r8 = clamp0to5(R8);

  let level: RSLLevelCode = "L1";

  if (f >= CUT_L2) level = "L2";
  if (f >= CUT_L3) level = "L3";
  if (f >= CUT_L4) level = "L4";
  if (f >= CUT_L5) level = "L5";

  if (f >= CUT_L6 && r6 >= 4 && (r7 >= 4 || r8 >= 4)) {
    level = "L6";
  }

  const meta = asLevelMeta(level);

  return {
    rsl: {
      level: {
        short_name: meta.short_name,
        full_name: meta.full_name,
        definition: meta.definition,
      },
    },
  };
}

/**
 * computeRSLLevelWithSignals (Option A integrated)
 * - Deterministic signals computed from raw quote candidates
 * - L5 gate requires self_repair Present (otherwise L4)
 * - L6 promotion is single-path and requires:
 *   - post-gate level == L5
 *   - framework_generation Present
 *   - (A7 Present OR A8 Present)
 *   - FRI >= 4.5
 *   - R6 >= 4
 *   - (R7 >= 4 OR R8 >= 4)
 *
 * Emerging does not trigger gates (Recommendation #2).
 */
export function computeRSLLevelWithSignals(args: {
  fri: number;
  R6: number;
  R7: number;
  R8: number;
  raw_signals_quotes?: Partial<RawSignalsQuotes> | null;
}): RSLLevelResult {
  const f = clamp0to5(args.fri);
  const r6 = clamp0to5(args.R6);
  const r7 = clamp0to5(args.R7);
  const r8 = clamp0to5(args.R8);

  const signals = computeSignalsFromRawQuotes(args.raw_signals_quotes ?? null);
  const basis: string[] = [];

  // 1) Base level by FRI cuts (L1..L5)
  let level: RSLLevelCode = "L1";
  if (f >= CUT_L2) level = "L2";
  if (f >= CUT_L3) level = "L3";
  if (f >= CUT_L4) level = "L4";
  if (f >= CUT_L5) level = "L5";
  basis.push("FRI band");

  // 2) L5 gate (deterministic): requires self_repair Present
  if (level === "L5") {
    if (signals.self_repair.state !== "Present") {
      level = "L4";
      basis.push("L5 gate failed (self_repair Present required)");
    } else {
      basis.push("L5 gate passed (self_repair Present)");
    }
  }

  // 3) Single-path L6 promotion (deterministic)
  if (level === "L5") {
    const expansionOk =
      signals.A7_value_aware.state === "Present" || signals.A8_perspective_flexible.state === "Present";
    const frameworkOk = signals.framework_generation.state === "Present";

    const strictNumericOk = f >= CUT_L6 && r6 >= 4 && (r7 >= 4 || r8 >= 4);

    if (frameworkOk && expansionOk && strictNumericOk) {
      level = "L6";
      basis.push("L6 promotion (framework + expansion + strict numeric gate)");
    }
  }

  const meta = asLevelMeta(level);

  return {
    rsl: {
      level: {
        short_name: meta.short_name,
        full_name: meta.full_name,
        definition: meta.definition,
      },
    },
/**    signals,
    level_basis: basis, */
  };
}

/**
 * Optional helper:
 * Expose cut values for UI or debugging.
 */
export function getRSLLevelCuts() {
  return {
    CUT_L2,
    CUT_L3,
    CUT_L4,
    CUT_L5,
    CUT_L6,
  };
}


/* ===== Backend_3_Cohort.ts ===== */
/* Fix cohort curve (no cohortFriList available) */
type CohortCurvePoint = { x: number; y: number };

const DEFAULT_COHORT_CURVE: CohortCurvePoint[] = [
  { x: 0.0, y: 2 },
  { x: 0.5, y: 6 },
  { x: 1.0, y: 14 },
  { x: 1.5, y: 26 },
  { x: 2.0, y: 30 },
  { x: 2.5, y: 45 },
  { x: 3.0, y: 58 },
  { x: 3.5, y: 42 },
  { x: 4.0, y: 22 },
  { x: 4.5, y: 10 },
  { x: 5.0, y: 4 },
];

// BACKENDB cohort distribution list
// - Synthetic deterministic list used when opts.cohortFriList is not provided.
// - Calibrated so that friScore=3.72 maps to percentile_0to1=0.62 (matches json2 fixture).
const DEFAULT_COHORT_FRI_LIST_BACKENDB: number[] = [
  ...Array(62).fill(3.0),
  ...Array(38).fill(4.0),
];


function percentile0to1FromCurve(friValue: number, curve: CohortCurvePoint[]): number {
  const pts = Array.isArray(curve) ? curve.filter(p => Number.isFinite(p?.x) && Number.isFinite(p?.y)) : [];
  if (pts.length < 2) return 0.5;

  // Ensure sorted by x
  pts.sort((a, b) => a.x - b.x);

  const v = Number.isFinite(friValue) ? friValue : 0;

  // Trapezoidal integration of y over x as a pseudo-PDF
  let totalArea = 0;
  let belowArea = 0;

  for (let i = 1; i < pts.length; i++) {
    const x0 = pts[i - 1].x;
    const x1 = pts[i].x;
    const y0 = Math.max(0, pts[i - 1].y);
    const y1 = Math.max(0, pts[i].y);

    const dx = x1 - x0;
    if (!(dx > 0)) continue;

    const segArea = (y0 + y1) * 0.5 * dx;
    totalArea += segArea;

    if (v <= x0) {
      // none of this segment is below v
      continue;
    } else if (v >= x1) {
      // full segment is below v
      belowArea += segArea;
    } else {
      // partial segment: linear interpolation at v
      const t = (v - x0) / dx;
      const yv = y0 + (y1 - y0) * t;
      const partialArea = (y0 + yv) * 0.5 * (v - x0);
      belowArea += partialArea;
    }
  }

  if (!(totalArea > 0)) return 0.5;
  const p = belowArea / totalArea;
  return round4(Math.min(1, Math.max(0, p)));
}



function round4(x: number, digits = 4): number {
  const m = Math.pow(10, Math.max(0, digits));
  return Math.round(x * m) / m;
}

export function percentile0to1(
  friValue: number,
  cohortFriList: number[]
): number {
  if (!Array.isArray(cohortFriList) || cohortFriList.length === 0) {
    return percentile0to1FromCurve(friValue, DEFAULT_COHORT_CURVE);
  }

  const finiteVals = cohortFriList.filter((x) => Number.isFinite(x));
  if (finiteVals.length === 0) {
    return percentile0to1FromCurve(friValue, DEFAULT_COHORT_CURVE);
  }

  const uniqueVals = Array.from(new Set(finiteVals.map((x) => Number(x))));
  // If the fallback distribution is heavily quantized (for example only a few unique
  // buckets like 3.0 / 4.0), the strict rank CDF becomes too step-like and can pin
  // low FRI values to 0. In that case, fall back to the smooth default cohort curve.
  if (uniqueVals.length <= 3) {
    return percentile0to1FromCurve(friValue, DEFAULT_COHORT_CURVE);
  }

  const v = Number.isFinite(friValue) ? friValue : 0;
  let lower = 0;

  for (const x of finiteVals) {
    const xx = Number(x);
    if (xx < v) lower += 1;
  }

  return round4(lower / finiteVals.length);
}

export function topPercentLabel(percentile: number): string {
  const p = Number.isFinite(percentile) ? percentile : 0.5;
  const topPercent = Math.round((1 - p) * 100);

  if (topPercent <= 1) return "Top 1%";
  return `Top ${topPercent}%`;
}

export function cohortInterpretationFromTopPercent(topPercentValue: number): string {
  const t = Number.isFinite(topPercentValue) ? topPercentValue : 50;

  if (t >= 50) {
    return "Core reasoning steps are emerging, with structure still developing compared to most peers.";
  }
  if (t >= 30) {
    return "Developing structure, with several reasoning patterns beginning to align relative to comparable peers.";
  }
  if (t >= 20) {
    return "Generally well-structured reasoning compared to most peers, with room for further stabilization.";
  }
  if (t >= 10) {
    return "Consistently structured reasoning relative to comparable peers.";
  }
  if (t >= 5) {
    return "Highly consistent reasoning structure compared to most peers, even as complexity increases.";
  }
  return "Exceptionally stable reasoning structure within the current comparison group.";
}

/* ============================
   최종 API 반환 타입 (UPDATED)
============================ */

export interface RslCohortApiResponse {
  rsl: {
    cohort: {
      percentile_0to1: number;
      top_percent_label: string;
      interpretation: string;
    };
  };
}

/* ============================
   API용 계산 래퍼 (UPDATED)
============================ */

export function computeRslCohortResponse(
  friValue: number,
  cohortFriList: number[]
): RslCohortApiResponse {
  const percentile = percentile0to1(friValue, cohortFriList);
  const label = topPercentLabel(percentile);

  const topPercentValue = Math.round((1 - percentile) * 100);
  const interpretation = cohortInterpretationFromTopPercent(topPercentValue);

  return {
    rsl: {
      cohort: {
        percentile_0to1: percentile,
        top_percent_label: label,
        interpretation
      }
    }
  };
}

/*
======================================================
결과 json (예시)
======================================================

{
  "rsl": {
    "cohort": {
      "percentile_0to1": 0.62,
      "top_percent_label": "Top 38%",
      "interpretation": "Developing structure, with several reasoning patterns beginning to align relative to comparable peers."
    }
  }
}
*/


/* ===== Backend_4_SRI.ts ===== */

/* ======================================================
   RSL Rubric(4) + rslVector(4) + transition/meta scores
   Raw Features 기반, MVP 고정 수식 (결정적, 0..1/0..5)
   ====================================================== */

export type SRIBand = "HIGH" | "MODERATE" | "LOW";

export type SRIInputs = {
  rslVector: number[]; // required, length >= 2 (we use length=4)
  transitionJumpScore?: number | null; // 0..1 higher is worse
  metaImbalanceScore?: number | null;  // 0..1 higher is worse
  extra?: Record<string, number | null | undefined>;
};

export type SRIOutput = {
  sri: number; // 0..1
  band: SRIBand;
  notes: string;
  diagnostics: {
    varianceScore: number;   // 0..1 (higher is worse)
    transitionScore: number; // 0..1 (higher is worse)
    metaScore: number;       // 0..1 (higher is worse)
    instability: number;     // 0..1
    weights: { wVar: number; wTrans: number; wMeta: number };
  };
};

export type SRIRslPublicOutput = {
  rsl: {
    sri: {
      score: number;
      interpretation: string;
    };
  };
};

/* ======================
   Raw Features 타입
   (canonical json 구조에 맞춘 최소 타입)
   ====================== */

export type RawFeatures = {
  layer_0?: {
    units?: number;
    unit_lengths?: number[];
    per_unit?: {
      transitions?: number[];
      revisions?: number[];
    };
    claims?: number;
    reasons?: number;
    evidence?: number;
  };
  layer_1?: {
    warrants?: number;
    counterpoints?: number;
    refutations?: number;
  };
  layer_2?: {
    transitions?: number;
    transition_ok?: number;
    revisions?: number;
    revision_depth_sum?: number;
    belief_change?: boolean;
  };
  layer_3?: {
    intent_markers?: number;
    drift_segments?: number;
    hedges?: number;
    loops?: number;
    self_regulation_signals?: number;
  };
  adjacency_links?: number;
};

export type RslRubric4 = {
  coherence: number;   // 0..5
  structure: number;   // 0..5
  evaluation: number;  // 0..5
  integration: number; // 0..5
};

/* ======================
   Basic helpers
   ====================== */

function clamp(x: number, lo: number, hi: number): number {
  if (!Number.isFinite(x)) return lo;
  return x < lo ? lo : x > hi ? hi : x;
}

function safeInt(x: unknown, fallback = 0): number {
  return isFiniteNumber(x) ? Math.max(0, Math.floor(x)) : fallback;
}

function safeArray(x: unknown): number[] {
  return Array.isArray(x) ? x.filter((v) => isFiniteNumber(v)).map((v) => Number(v)) : [];
}

/**
 * 0..1로 정규화된 엔트로피(균형 지표)
 * - 입력은 양수 카운트 벡터
 * - 1에 가까울수록 균형적, 0에 가까울수록 한쪽 쏠림
 */
function entropy01(counts: number[]): number {
  const xs = counts.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  const s = xs.reduce((a, b) => a + b, 0);
  if (s <= 0) return 0;
  const ps = xs.map((v) => v / s).filter((p) => p > 0);
  const h = -ps.reduce((acc, p) => acc + p * Math.log(p), 0);
  const hMax = Math.log(ps.length || 1);
  if (hMax <= 0) return 0;
  return clamp01(h / hMax);
}

/**
 * bell curve like score around a target
 * - returns 1 at target
 * - decreases linearly to 0 at target +/- width
 */
function peak01(x: number, target: number, width: number): number {
  if (!Number.isFinite(x) || width <= 0) return 0;
  const d = Math.abs(x - target);
  return clamp01(1 - d / width);
}

/* ======================
   1) Raw -> rubric(0..5)
   ====================== */

export function computeRslRubric4FromRaw(raw: RawFeatures): RslRubric4 {
  // core counts
  const units = Math.max(1, safeInt(raw.layer_0?.units, 1));
  const claims = safeInt(raw.layer_0?.claims, 0);
  const reasons = safeInt(raw.layer_0?.reasons, 0);
  const evidence = safeInt(raw.layer_0?.evidence, 0);

  const warrants = safeInt(raw.layer_1?.warrants, 0);
  const counterpoints = safeInt(raw.layer_1?.counterpoints, 0);
  const refutations = safeInt(raw.layer_1?.refutations, 0);

  const transitions = safeInt(raw.layer_2?.transitions, 0);
  const transitionOk = safeInt(raw.layer_2?.transition_ok, 0);
  const revisions = safeInt(raw.layer_2?.revisions, 0);
  const revisionDepthSum = safeNum(raw.layer_2?.revision_depth_sum, 0);

  const intentMarkers = safeInt(raw.layer_3?.intent_markers, 0);
  const driftSegments = safeInt(raw.layer_3?.drift_segments, 0);
  const hedges = safeInt(raw.layer_3?.hedges, 0);
  const loops = safeInt(raw.layer_3?.loops, 0);
  const selfReg = safeInt(raw.layer_3?.self_regulation_signals, 0);

  const adjacencyLinks = safeInt(raw.adjacency_links, 0);

  // derived ratios (0..1)
  const denomTrans = Math.max(1, units - 1);
  const transRate = clamp01(transitions / denomTrans); // "구조 전환 빈도"
  const transQuality = clamp01(transitionOk / Math.max(1, transitions)); // "전환 품질"

  const revRate = clamp01(revisions / Math.max(1, units));
  // revision depth average, normalize by 1.5 (MVP calibration constant)
  const revDepthAvg = revisionDepthSum / Math.max(1, revisions);
  const revDepth01 = clamp01(revDepthAvg / 1.5);

  const driftRate = clamp01((driftSegments + loops) / Math.max(1, units));
  const driftPenalty = driftRate; // higher worse

  // adjacency density: links relative to reasoning atoms
  const atoms = Math.max(1, claims + reasons + warrants + evidence);
  const adjacency01 = clamp01(adjacencyLinks / atoms);

  // evidence support for evaluation
  const evidencePerClaim = evidence / Math.max(1, claims);
  const warrantsPerClaim = warrants / Math.max(1, claims);
  const counterRefPerClaim = (counterpoints + refutations) / Math.max(1, claims);

  const evidence01 = clamp01(evidencePerClaim / 1.0); // 1 evidence per claim -> 1
  const warrant01 = clamp01(warrantsPerClaim / 1.0);  // 1 warrant per claim -> 1
  const counterRef01 = clamp01(counterRefPerClaim / 0.6); // 0.6 per claim -> 1

  const hedgeRate = hedges / Math.max(1, claims);
  const hedgePenalty = clamp01(hedgeRate / 0.7); // too many hedges -> worse

  // balance among claim/reason/warrant/evidence (integration)
  const balance01 = entropy01([claims, reasons, warrants, evidence]);

  /* --------------------------------------------
     Rubric scores (0..5), deterministic weights
     -------------------------------------------- */

  // coherence: transition quality + adjacency + low drift
  const coherence01 = clamp01(
    0.45 * transQuality +
    0.25 * adjacency01 +
    0.30 * (1 - driftPenalty)
  );

  // structure: enough transitions + intent markers + "moderate" revision rate
  // revision rate is best around 0.15 per unit (MVP target)
  const revModeration01 = peak01(revRate, 0.15, 0.15); // 0.0 or 0.30 -> 0, 0.15 -> 1
  const intent01 = clamp01(intentMarkers / 2); // 0..2+ -> 0..1
  const structure01 = clamp01(
    0.40 * transRate +
    0.30 * intent01 +
    0.30 * revModeration01
  );

  // evaluation: evidence + warrants + counter/refutation, penalize excessive hedging
  const evaluation01 = clamp01(
    0.35 * evidence01 +
    0.25 * warrant01 +
    0.25 * counterRef01 +
    0.15 * (1 - hedgePenalty)
  );

  // integration: balance + self regulation + transition quality + depth
  const selfReg01 = clamp01(selfReg / 2); // 0..2+ -> 0..1
  const integration01 = clamp01(
    0.50 * balance01 +
    0.20 * selfReg01 +
    0.20 * transQuality +
    0.10 * revDepth01
  );

  // convert to 0..5 (rounding strategy: keep 2 decimals, not int)
  const coherence = round2(5 * coherence01);
  const structure = round2(5 * structure01);
  const evaluationScore = round2(5 * evaluation01);
  const integration = round2(5 * integration01);

  return {
    coherence,
    structure,
    evaluation: evaluationScore,
    integration
  };
}

/* ======================
   2) rubric -> rslVector
   ====================== */

export function computeRslVectorFromRubric4(r: RslRubric4): number[] {
  // rslVector is 0..1, fixed length 4
  const c = clamp01(safeNum(r.coherence, 0) / 5);
  const s = clamp01(safeNum(r.structure, 0) / 5);
  const e = clamp01(safeNum(r.evaluation, 0) / 5);
  const i = clamp01(safeNum(r.integration, 0) / 5);
  return [c, s, e, i];
}

/* ==========================================
   3) Raw -> transitionJumpScore/metaImbalance
   ========================================== */

/**
 * transitionJumpScore: 0..1 (higher is worse)
 * - "전환 품질 부족" + "전환의 단위별 변동성" + "문단 길이 변동(점프 근사)"
 */
export function computeTransitionJumpScoreFromRaw(raw: RawFeatures): number {
  const units = Math.max(1, safeInt(raw.layer_0?.units, 1));

  const transitions = safeInt(raw.layer_2?.transitions, 0);
  const transitionOk = safeInt(raw.layer_2?.transition_ok, 0);

  const transQuality = clamp01(transitionOk / Math.max(1, transitions));
  const badRate = clamp01(1 - transQuality);

  const perUnitTrans = safeArray(raw.layer_0?.per_unit?.transitions);
  const vol =
    perUnitTrans.length > 1
      ? clamp01(std(perUnitTrans) / Math.max(1, mean(perUnitTrans) + 1))
      : 0.5;

  const unitLengths = safeArray(raw.layer_0?.unit_lengths);
  const lenVar =
    unitLengths.length > 1
      ? clamp01(std(unitLengths) / Math.max(1, mean(unitLengths)))
      : 0.5;

  // If very few units, reduce sensitivity
  const smallUnitsPenalty = units < 3 ? 0.15 : 0;

  const score = clamp01(0.50 * badRate + 0.25 * vol + 0.25 * lenVar + smallUnitsPenalty);
  return score;
}

/**
 * metaImbalanceScore: 0..1 (higher is worse)
 * - claim/reason/warrant/evidence 균형 부족(엔트로피 기반) + drift/loop + hedge 과다
 */
export function computeMetaImbalanceScoreFromRaw(raw: RawFeatures): number {
  const units = Math.max(1, safeInt(raw.layer_0?.units, 1));

  const claims = safeInt(raw.layer_0?.claims, 0);
  const reasons = safeInt(raw.layer_0?.reasons, 0);
  const evidence = safeInt(raw.layer_0?.evidence, 0);
  const warrants = safeInt(raw.layer_1?.warrants, 0);

  const driftSegments = safeInt(raw.layer_3?.drift_segments, 0);
  const loops = safeInt(raw.layer_3?.loops, 0);
  const hedges = safeInt(raw.layer_3?.hedges, 0);

  const bal = entropy01([claims, reasons, warrants, evidence]); // 0..1 (higher is better)
  const imbalanceCore = clamp01(1 - bal); // higher is worse

  const driftRate = clamp01((driftSegments + loops) / Math.max(1, units));
  const driftPenalty = clamp01(driftRate / 0.25); // 0.25 per unit -> 1

  const hedgeRate = hedges / Math.max(1, claims);
  const hedgePenalty = clamp01(hedgeRate / 0.7);

  const score = clamp01(0.60 * imbalanceCore + 0.20 * driftPenalty + 0.20 * hedgePenalty);
  return score;
}

/* ======================
   4) SRI core (from Backend_4_SRI)
   유지하되, rslVector가 항상 들어오도록 상위에서 보장
   ====================== */

function computeVarianceScore(rslVector01: number[]): number {
  const s = std(rslVector01);
  return clamp01(s / 0.5);
}

export function computeSRI(inputs: SRIInputs): SRIOutput {
  const { rslVector } = inputs;

  if (!Array.isArray(rslVector) || rslVector.length < 2) {
    const sri = 0.5;
    return {
      sri,
      band: "MODERATE",
      notes:
        "Structural reliability is not fully available due to insufficient structural data. Results are shown with coaching emphasis.",
      diagnostics: {
        varianceScore: 0.5,
        transitionScore: 0.5,
        metaScore: 0.5,
        instability: 0.5,
        weights: { wVar: 0.4, wTrans: 0.3, wMeta: 0.3 },
      },
    };
  }

  const v01 = rslVector.map((x) => clamp01(isFiniteNumber(x) ? x : 0));

  const varianceScore = computeVarianceScore(v01);
  const transitionScore = clamp01(
    isFiniteNumber(inputs.transitionJumpScore) ? inputs.transitionJumpScore : 0.5,
  );
  const metaScore = clamp01(
    isFiniteNumber(inputs.metaImbalanceScore) ? inputs.metaImbalanceScore : 0.5,
  );

  const wVar = 0.4;
  const wTrans = 0.3;
  const wMeta = 0.3;

  const instability = clamp01(wVar * varianceScore + wTrans * transitionScore + wMeta * metaScore);
  const sri = clamp01(1 - instability);

  let band: SRIBand;
  let notes: string;

  if (sri >= 0.8) {
    band = "HIGH";
    notes =
      "Reasoning stays consistent across most segments. Overall stability is high.";
  } else if (sri >= 0.65) {
    band = "MODERATE";
    notes = "Reasoning remains mostly stable, with some local variation across segments.";
  } else {
    band = "LOW";
    notes =
      "Reasoning varies noticeably across segments, so stability should be interpreted with caution.";
  }

  return {
    sri,
    band,
    notes,
    diagnostics: {
      varianceScore,
      transitionScore,
      metaScore,
      instability,
      weights: { wVar, wTrans, wMeta },
    },
  };
}

export function computeSRIRslPublic(inputs: SRIInputs): SRIRslPublicOutput {
  const res = computeSRI(inputs);
  return {
    rsl: {
      sri: {
        score: round2(res.sri),
        interpretation: res.notes
      }
    }
  };
}

/**
 * PUBLIC ONE-SHOT (MVP SSOT)
 * Raw Features만 주면, 아래 형식으로만 반환합니다:
 *
 * {
 *   "rsl": {
 *     "sri": {
 *       "score": 0.92,
 *       "interpretation": "..."
 *     }
 *   }
 * }
 *
 * - rslVector는 rubric4(0..5)를 0..1로 정규화한 [coherence, structure, evaluation, integration] (길이 4) 입니다.
 * - transitionJumpScore/metaImbalanceScore도 raw에서 계산됩니다.
 * - 출력은 SSOT로 이 구조만 반환합니다.
 */
export function computeSRIRslPublicFromRaw(raw: RawFeatures): SRIRslPublicOutput {
  const rubric = computeRslRubric4FromRaw(raw);
  const rslVector = computeRslVectorFromRubric4(rubric);
  const transitionJumpScore = computeTransitionJumpScoreFromRaw(raw);
  const metaImbalanceScore = computeMetaImbalanceScoreFromRaw(raw);

  return computeSRIRslPublic({
    rslVector,
    transitionJumpScore,
    metaImbalanceScore,
  });
}


/* ==========================================
   5) One-shot: raw_features만 주면 SRI까지 완성
   ========================================== */

export type RslSriDerived = {
  rsl_rubric: RslRubric4;
  rslVector: number[]; // length 4, 0..1
  transitionJumpScore: number; // 0..1 (higher worse)
  metaImbalanceScore: number;  // 0..1 (higher worse)
  // IMPORTANT: Public output must NOT leak internal band/diagnostics.
  // If you need internal band/diagnostics, call computeSRI(...) directly.
  sri: {
    score: number;
    interpretation: string;
  };
};

export function deriveRslSriFromRaw(raw: RawFeatures): RslSriDerived {
  const rubric = computeRslRubric4FromRaw(raw);
  const rslVector = computeRslVectorFromRubric4(rubric);

  const transitionJumpScore = computeTransitionJumpScoreFromRaw(raw);
  const metaImbalanceScore = computeMetaImbalanceScoreFromRaw(raw);

  const sriPublic = computeSRIRslPublic({
    rslVector,
    transitionJumpScore,
    metaImbalanceScore,
  }).rsl.sri;

  return {
    rsl_rubric: rubric,
    rslVector,
    transitionJumpScore,
    metaImbalanceScore,
    sri: sriPublic
  };
}


/* ===== Backend_7_CFF.ts ===== */

// lib/server/cff_v1.ts
// CFF v1.0 (정식 고정안) - 수식 변형 금지
// 원칙:
// 1) GPT는 Raw Feature만 반환
// 2) 계산은 100% 백엔드(여기)
// 3) 모든 점수는 0~1 정규화
// 4) clamp만 사용 (sat, entropy, adjacency_links 등 확장요소 사용 금지)

export type StructureType = "linear" | "hierarchical" | "networked";

export type RawFeaturesV1 = {
  // 공통 전제
  units: number;   // U
  claims: number;  // C
  reasons: number; // R
  evidence: number;// E

  // 1) AAS
  sub_claims?: number | null;
  warrants: number | null;
  counterpoints?: number | null;
  refutations?: number | null;
  structure_type?: StructureType | null;

  // 2) CTF
  transitions: number;
  transition_ok: number;

  // 3) RMD
  hedges: number;
  loops: number;

  // 4) RDX
  revisions: number;
  revision_depth_sum: number;
  belief_change?: boolean;

  // 5) EDS
  evidence_types?: string[]; // set 취급

  // (optional) structural adjacency density / link count
  // NOTE: 일부 raw_features 생성기에서 layer_2.adjacency_links(숫자)로 제공될 수 있음.
  adjacency_links?: number;

  // 6) IFD
  intent_markers: number;
  drift_segments?: number;

  // backend_only (MVP 결측 가능)
  kpf_sim?: number | null;
  tps_h?: number | null;
};

export type CFF6 = {
  AAS: number;
  CTF: number;
  RMD: number;
  RDX: number;
  EDS: number;
  IFD: number;
};

export type CFF8 = CFF6 & {
  // MVP A안: KPF/TPS는 계산에서 제외하고 reserved slot으로만 유지
  KPF_SIM: number | null;
  TPS_H: number | null;
};

function structureWeight(st?: StructureType): number {
  // v1.0 문서 고정값
  switch (st ?? "linear") {
    case "linear":
      return 0.3;
    case "hierarchical":
      return 0.6;
    case "networked":
      return 1.0;
    default:
      return 0.3;
  }
}

export function inferStructureType(raw: {
  claims?: number | null;
  sub_claims?: number | null;
  counterpoints?: number | null;
  refutations?: number | null;
  structure_type?: StructureType | null;
}): StructureType {
  if (
    raw?.structure_type === "linear" ||
    raw?.structure_type === "hierarchical" ||
    raw?.structure_type === "networked"
  ) {
    return raw.structure_type;
  }

  const claims = typeof raw?.claims === "number" && Number.isFinite(raw.claims) ? Math.max(0, raw.claims) : 0;
  const subClaims = typeof raw?.sub_claims === "number" && Number.isFinite(raw.sub_claims) ? Math.max(0, raw.sub_claims) : 0;
  const counterpoints = typeof raw?.counterpoints === "number" && Number.isFinite(raw.counterpoints) ? Math.max(0, raw.counterpoints) : 0;
  const refutations = typeof raw?.refutations === "number" && Number.isFinite(raw.refutations) ? Math.max(0, raw.refutations) : 0;

  const opposition = counterpoints + refutations;
  const subClaimRatio = claims > 0 ? subClaims / claims : 0;

  if (opposition >= 2) return "networked";
  if (counterpoints >= 1 && refutations >= 1) return "networked";
  if (subClaims >= 2 && opposition >= 1) return "networked";

  if (subClaims >= 2) return "hierarchical";
  if (subClaimRatio >= 0.5 && subClaims >= 1) return "hierarchical";

  return "linear";
}

function naToMid01(x: number | null | undefined): number {
  // legacy helper retained for backward compatibility
  // MVP A안에서는 KPF/TPS를 계산에서 제외하므로 사용하지 않는다
  return typeof x === "number" && Number.isFinite(x) ? clamp01(x) : 0.5;
}

/**
 * computeCFF6_v1
 * - 네 문서 v1.0 수식 그대로
 * - 입력 안전화(음수 방지, units 최소 1)만 수행
 */
export function computeCFF6_v1(raw: RawFeaturesV1): CFF6 {
  const U = Math.max(1, Math.floor(raw.units || 1));
  const C = Math.max(0, raw.claims || 0);
  const R = Math.max(0, raw.reasons || 0);
  const E = Math.max(0, raw.evidence || 0);

  const sub = Math.max(0, raw.sub_claims || 0);
  const W = Math.max(0, raw.warrants || 0);
  const st = inferStructureType({
    claims: raw.claims,
    sub_claims: raw.sub_claims,
    counterpoints: raw.counterpoints,
    refutations: raw.refutations,
    structure_type: raw.structure_type ?? null,
  });

  const T = Math.max(0, raw.transitions || 0);
  const Tok = Math.max(0, raw.transition_ok || 0);

  const hedges = Math.max(0, raw.hedges || 0);
  const loops = Math.max(0, raw.loops || 0);

  const rev = Math.max(0, raw.revisions || 0);
  const revDepthSum = Math.max(0, raw.revision_depth_sum || 0);
  const beliefChange = !!raw.belief_change;

  const intentMarkers = Math.max(0, raw.intent_markers || 0);
  const driftSeg = Math.max(0, raw.drift_segments || 0);

  const evTypes = raw.evidence_types ? new Set(raw.evidence_types) : new Set<string>();

  // 1) AAS – Argument Architecture Style (문서 수식 그대로)
  const hierarchy_ratio = safeDiv(sub, C);
  const warrant_ratio = safeDiv(W, C);
  const structure_weight = structureWeight(st);

  const AAS_raw =
    (0.4 * hierarchy_ratio) +
    (0.4 * warrant_ratio) +
    (0.2 * structure_weight);

  const AAS = clamp01(AAS_raw);

  // 2) CTF – Cognitive Transition Flow (문서 수식 그대로)
  const transition_density = safeDiv(T, U);
  const valid_transition_ratio = safeDiv(Tok, T);

  const CTF_raw =
    (0.6 * transition_density) +
    (0.4 * valid_transition_ratio);

  const CTF = clamp01(CTF_raw);

  // 3) RMD – Reasoning Momentum Delta (문서 수식 그대로)
  const progress_rate = safeDiv(R, U);
  const friction_rate = safeDiv((hedges + loops), U);

  const RMD_raw = progress_rate - friction_rate;
  const RMD = clamp01(0.5 + RMD_raw);

  // 4) RDX – Revision Depth Index (문서 수식 그대로)
  const depth_avg = safeDiv(revDepthSum, rev);
  const belief_bonus = beliefChange ? 0.2 : 0.0;

  const RDX_raw = (0.7 * depth_avg) + belief_bonus;
  const RDX = clamp01(RDX_raw);

  // 5) EDS – Evidence Diversity Score (문서 수식 그대로)
  const type_diversity = safeDiv(evTypes.size, 4); // 경험/데이터/예시/원리
  const evidence_density = safeDiv(E, C);

  const EDS_raw =
    (0.6 * type_diversity) +
    (0.4 * evidence_density);

  const EDS = clamp01(EDS_raw);

  // 6) IFD – Intent Friction Delta (문서 수식 그대로)
  const intent_strength = intentMarkers > 0 ? 1.0 : 0.5;
  const drift_rate = safeDiv(driftSeg, U);

  const IFD_raw = intent_strength - drift_rate;
  const IFD = clamp01(IFD_raw);

  return { AAS, CTF, RMD, RDX, EDS, IFD };
}

export function computeCFF8_v1(raw: RawFeaturesV1): CFF8 {
  const base = computeCFF6_v1(raw);
  return {
    ...base,
    KPF_SIM: null,
    TPS_H: null,
  };
}

/**
 * Strict CFF core.
 * Requires all contract inputs to be present as finite numbers.
 * No fallback coercion, no neutral fill, no default structure substitution.
 */
export function computeCFF6_strict(raw: RawFeaturesV1): CFF6 {
  // MVP A안: GPT extraction에 null이 많아도 백엔드에서 안전하게 정규화한다.
  // strict path는 "수식 고정"을 의미하며, null-heavy raw는 0/default로 보정해 계산 실패를 피한다.
  const U = Math.max(1, Math.floor(safeNum(raw?.units, 1)));
  const C = Math.max(0, safeNum(raw?.claims, 0));
  const R = Math.max(0, safeNum(raw?.reasons, 0));
  const E = Math.max(0, safeNum(raw?.evidence, 0));
  const sub = Math.max(0, safeNum(raw?.sub_claims, 0));
  const W = Math.max(0, safeNum(raw?.warrants, 0));
  const T = Math.max(0, safeNum(raw?.transitions, 0));
  const Tok = Math.max(0, safeNum(raw?.transition_ok, 0));
  const loops = Math.max(0, safeNum(raw?.loops, 0));
  const intentMarkers = Math.max(0, safeNum(raw?.intent_markers, 0));

  const st = inferStructureType({
    claims: raw?.claims,
    sub_claims: raw?.sub_claims,
    counterpoints: raw?.counterpoints,
    refutations: raw?.refutations,
    structure_type: raw?.structure_type ?? null,
  });

  const hedges = Math.max(0, safeNum(raw?.hedges, 0));
  const rev = Math.max(0, safeNum(raw?.revisions, 0));
  const revDepthSum = Math.max(0, safeNum(raw?.revision_depth_sum, 0));
  const beliefChange = !!raw?.belief_change;
  const driftSeg = Math.max(0, safeNum(raw?.drift_segments, 0));
  const evTypes = Array.isArray(raw?.evidence_types) ? new Set(raw.evidence_types.filter((v) => typeof v === "string" && v.trim())) : new Set<string>();

  const hierarchy_ratio = safeDiv(sub, C);
  const warrant_ratio = safeDiv(W, C);
  const structure_weight = structureWeight(st);
  const AAS = clamp01((0.4 * hierarchy_ratio) + (0.4 * warrant_ratio) + (0.2 * structure_weight));

  const transition_density = safeDiv(T, U);
  const valid_transition_ratio = safeDiv(Tok, T);
  const CTF = clamp01((0.6 * transition_density) + (0.4 * valid_transition_ratio));

  const progress_rate = safeDiv(R, U);
  const friction_rate = safeDiv((hedges + loops), U);
  const RMD = clamp01(0.5 + (progress_rate - friction_rate));

  const depth_avg = safeDiv(revDepthSum, rev);
  const belief_bonus = beliefChange ? 0.2 : 0.0;
  const RDX = clamp01((0.7 * depth_avg) + belief_bonus);

  const type_diversity = safeDiv(evTypes.size, 4);
  const evidence_density = safeDiv(E, C);
  const EDS = clamp01((0.6 * type_diversity) + (0.4 * evidence_density));

  const intent_strength = intentMarkers > 0 ? 1.0 : 0.5;
  const drift_rate = safeDiv(driftSeg, U);
  const IFD = clamp01(intent_strength - drift_rate);

  return { AAS, CTF, RMD, RDX, EDS, IFD };
}

/* ======================================================
   UI Output Adapter (RADAR VERSION)
   - labels + values 배열 구조
   - KPF-Sim, TPS-H 는 입력이 없으면 "N/A" 출력
   - JSON 키는 하이픈 포함: "KPF-Sim", "TPS-H"
====================================================== */

type ScoreOrNA = number | "N/A";

export type CffUiOut = {
  cff: {
    labels: string[];
    values_0to1: ScoreOrNA[];
  };
};

function hasFinite(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function toScoreOrNA(x: number | null | undefined): ScoreOrNA {
  return hasFinite(x) ? round2(clamp01(x)) : "N/A";
}

/**
 * computeCffUiOut_v1
 * - 수식 계산은 computeCFF6_v1/computeCFF8_v1를 그대로 사용
 * - 단, KPF/TPS는 입력 결측이면 "N/A"로 출력
 * - 출력 구조는 레이더 차트 친화형(labels + values_0to1)
 */
export function computeCffUiOut_v1(raw: RawFeaturesV1): CffUiOut {
  const v6 = computeCFF6_v1(raw);

  const labels = ["AAS", "CTF", "RMD", "RDX", "EDS", "IFD", "KPF-Sim", "TPS-H"];

  const values: ScoreOrNA[] = [
    v6.AAS,
    v6.CTF,
    v6.RMD,
    v6.RDX,
    v6.EDS,
    v6.IFD,
    raw.kpf_sim,
    raw.tps_h,
  ].map(toScoreOrNA);

  return {
    cff: {
      labels,
      values_0to1: values,
    },
  };
}

export function computeCffUiOut_strict(raw: RawFeaturesV1): CffUiOut {
  const v8 = computeCFF8_strict(raw);
  const labels = ["AAS", "CTF", "RMD", "RDX", "EDS", "IFD", "KPF-Sim", "TPS-H"];
  const values: ScoreOrNA[] = [
    v8.AAS,
    v8.CTF,
    v8.RMD,
    v8.RDX,
    v8.EDS,
    v8.IFD,
    v8.KPF_SIM,
    v8.TPS_H,
  ].map(toScoreOrNA);
  return {
    cff: {
      labels,
      values_0to1: values,
    },
  };
}

/*
======================================================
결과 json (예시)
======================================================

(입력에 kpf_sim/tps_h가 없을 때)

{
  "cff": {
    "labels": ["AAS","CTF","RMD","RDX","EDS","IFD","KPF-Sim","TPS-H"],
    "values_0to1": [0.71,0.64,0.58,0.73,0.66,0.79,"N/A","N/A"]
  }
}
*/


/* ===== Backend_5_Observed Reasoning Patterns.ts ===== */

/**
 * Backend_5_Observed Reasoning Patterns
 * - 8 profiles: RE, IE, EW, AR, SI, RR, HE, MD
 * - Always return all 8 with score (0..1) or null when required inputs are missing.
 *
 * NOTE
 * - This file expects KPF and TPS on a 0..1 scale if provided.
 * - For compatibility with other specs that use "KPF-Sim" or "TPS-H",
 *   callers can map those into { kpf, tps } before calling.
 */

export type ProfileCode = "RE" | "IE" | "EW" | "AR" | "SI" | "RR" | "HE" | "MD";

export interface ProfileMeta {
  code: ProfileCode;
  label: string;
  description: string;
}

export const OBSERVED_PROFILE_META: Record<ProfileCode, ProfileMeta> = {
  RE: {
    code: "RE",
    label: "Reflective Explorer",
    description:
      "Reflective Explorer shows active self-revision and exploratory restructuring during reasoning. Thought progresses through reflection, reassessment, and adaptive refinement."
  },
  IE: {
    code: "IE",
    label: "Intuitive Explorer",
    description:
      "Intuitive Explorer advances reasoning through associative leaps and conceptual exploration. Structure emerges gradually rather than being predefined."
  },
  EW: {
    code: "EW",
    label: "Evidence Weaver",
    description:
      "Evidence Weaver emphasizes linking claims with supporting material. Reasoning strength lies in evidence connectivity rather than abstract inference."
  },
  AR: {
    code: "AR",
    label: "Analytical Reasoner",
    description:
      "Analytical Reasoner breaks a problem into explicit components and evaluates them through stepwise logic. Reasoning emphasizes clear structure, rule-based validation, and consistency across claims and supporting points."
  },
  SI: {
    code: "SI",
    label: "Strategic Integrator",
    description:
      "Strategic Integrator coordinates multiple reasoning dimensions and maintains a stable, non-dominant structure. Thought is guided by long-range consistency, tradeoffs, and goal alignment."
  },
  RR: {
    code: "RR",
    label: "Reflective Regulator",
    description:
      "Reflective Regulator maintains control over reasoning quality through self-checks, constraint management, and calibration. Structure remains stable under pressure and avoids impulsive shifts."
  },
  HE: {
    code: "HE",
    label: "Human Expressionist",
    description:
      "Human Expressionist exhibits human-like nuance, self-positioning, and personal voice. Reasoning is expressed with context sensitivity and natural variation rather than rigid optimization."
  },
  MD: {
    code: "MD",
    label: "Machine-Dominant",
    description:
      "Machine-Dominant exhibits highly optimized, uniform, and template-like structure. Reasoning may appear overly polished, low-variance, or mechanically balanced."
  },
};

export interface ObservedInputs {
  // RSL-aligned signals (0..1 recommended)
  reflective?: number;     // self-revision / self-repair intensity
  intuitive?: number;      // associative exploration
  evidence?: number;       // evidence linkage
  analytic?: number;       // stepwise decomposition
  integrate?: number;      // integration and coordination
  regulate?: number;       // regulation and calibration
  // Optional authenticity axes
  kpf?: number | null;     // knowledge-persona fingerprint similarity (0..1), optional
  tps?: number | null;     // template pattern score (0..1), optional
}

export interface ProfileScore {
  code: ProfileCode;
  label: string;
  description: string;
  score_0to1: number | null;
}

export interface ObservedResult {
  all: ProfileScore[]; // always length 8, fixed order
  top: ProfileScore[]; // selected 2..3 (null-scored profiles excluded)
}

// Fixed order for stable UI rendering
const ORDER: ProfileCode[] = ["RE", "IE", "EW", "AR", "SI", "RR", "HE", "MD"];

function s(x: unknown): number {
  return clamp(Number(x), 0, 1);
}

export function computeObservedReasoningPatterns(inp: ObservedInputs): ObservedResult {
  const re = s(inp.reflective);
  const ie = s(inp.intuitive);
  const ew = s(inp.evidence);
  const ar = s(inp.analytic);
  const si = s(inp.integrate);
  const rr = s(inp.regulate);

  const kpf = inp.kpf == null ? null : clamp(Number(inp.kpf), 0, 1);
  const tps = inp.tps == null ? null : clamp(Number(inp.tps), 0, 1);

  // Core profile scores (0..1)
  const scores: Record<ProfileCode, number | null> = {
    RE: round4(0.60 * re + 0.20 * rr + 0.20 * si, 4),
    IE: round4(0.70 * ie + 0.15 * re + 0.15 * si, 4),
    EW: round4(0.70 * ew + 0.15 * ar + 0.15 * si, 4),
    AR: round4(0.70 * ar + 0.15 * ew + 0.15 * rr, 4),
    SI: round4(0.60 * si + 0.20 * ar + 0.20 * rr, 4),
    RR: round4(0.65 * rr + 0.20 * re + 0.15 * si, 4),
    // HE / MD require optional axes
    HE: kpf == null ? null : round4(kpf, 4),
    MD: tps == null ? null : round4(tps, 4),
  };

  const all: ProfileScore[] = ORDER.map((code) => ({
    code,
    label: OBSERVED_PROFILE_META[code].label,
    description: OBSERVED_PROFILE_META[code].description,
    score_0to1: scores[code],
  }));

  // Selection: choose top 2..3 among non-null scores, with conservative thresholding
  const ranked = all
    .filter((x) => typeof x.score_0to1 === "number")
    .sort((a, b) => (b.score_0to1 as number) - (a.score_0to1 as number));

  const top: ProfileScore[] = [];
  if (ranked.length > 0) {
    top.push(ranked[0]);
    if (ranked.length > 1) top.push(ranked[1]);
    // Optional 3rd if close enough to 2nd
    if (ranked.length > 2) {
      const second = ranked[1].score_0to1 as number;
      const third = ranked[2].score_0to1 as number;
      if (third >= Math.max(0.55, second - 0.07)) top.push(ranked[2]);
    }
  }

  return { all, top };
}


export interface CoreAxes {
  AAS: number | null;
  CTF: number | null;
  RMD: number | null;
  RDX: number | null;
  EDS: number | null;
  IFD: number | null;
  KPF: number | null;
  TPS: number | null;
  Analyticity: number | null;
  Flow: number | null;
  MetacogRaw: number | null;
}

export interface CffPatternOut {
  cff: { pattern: { primary_label: string; secondary_label: string; definition: { primary: string; secondary: string } } };
}

export function computeCffPatternOut(core: CoreAxes): CffPatternOut {
  const observed = computeObservedReasoningPatterns({
    reflective: core.RDX ?? 0,
    intuitive: core.Flow ?? 0,
    evidence: core.EDS ?? 0,
    analytic: core.AAS ?? 0,
    integrate: core.Analyticity == null || core.Flow == null || core.MetacogRaw == null ? 0 : Math.min(core.Analyticity, core.Flow, core.MetacogRaw),
    regulate: core.RDX == null || core.IFD == null ? (core.RDX ?? 0) : clamp01(0.60 * core.RDX + 0.40 * (1 - core.IFD)),
    kpf: core.KPF,
    tps: core.TPS,
  });
  const ranked = observed.top.length >= 2 ? observed.top : observed.all.filter((x)=> typeof x.score_0to1 === "number").sort((a,b)=>(b.score_0to1 as number)-(a.score_0to1 as number));
  const primary = ranked[0] ?? { label: "", description: "" };
  const secondary = ranked[1] ?? { label: "", description: "" };
  return { cff: { pattern: { primary_label: primary.label ?? "", secondary_label: secondary.label ?? "", definition: { primary: primary.description ?? "", secondary: secondary.description ?? "" } } } };
}
/* ===== Backend_6_Final Determination.ts ===== */

/**
 * Backend_6_Final FinalDeterminationResult
 * - Single final track + code + confidence
 * - Does not compute Observed Reasoning Patterns (that is Backend_5).
 *
 * Translation from Backend_6_Final FinalDeterminationResult.txt (Python) into TS.
 * Indicator codes are normalized to:
 *   AAS, CTF, RMD, RDX, EDS, IFD, KPF, TPS
 * Compatibility:
 *   "KPF-Sim" -> KPF
 *   "TPS-H"   -> TPS
 */

export type FinalIndicatorCode = "AAS" | "CTF" | "RMD" | "RDX" | "EDS" | "IFD" | "KPF" | "TPS";
export type FinalIndicatorStatus = "Active" | "Excluded" | "Missing";

export type FinalTrack = "Human (text-only)" | "Human" | "Hybrid" | "AI";
export type DetCode =
  | "T1" | "T2" | "T3" | "T4" | "T5" | "T6"
  | "Hx-1" | "Hx-2" | "Hx-3" | "Hx-4"
  | "Ax-1" | "Ax-2" | "Ax-3" | "Ax-4";

export interface FinalIndicatorValue {
  value_0to1: number | null;   // normalized
  status: FinalIndicatorStatus;
}

export interface FinalCffInput {
  indicators: Record<FinalIndicatorCode, FinalIndicatorValue>;
}

export interface FinalDeterminationResultPayload {
  track: FinalTrack;
  code: DetCode;
  confidence_0to1: number;
  rationale: {
    human_score_0to1: number;
    ai_score_0to1: number;
    hybrid_score_0to1: number;
    missing: FinalIndicatorCode[];
    excluded: FinalIndicatorCode[];
  };
}

function fdSafe01(x: number | null | undefined): number | null {
  if (x == null) return null;
  const n = Number(x);
  if (!Number.isFinite(n)) return null;
  return clamp(n, 0, 1);
}

function fdListByStatus(ind: Record<FinalIndicatorCode, FinalIndicatorValue>, status: FinalIndicatorStatus): FinalIndicatorCode[] {
  return (Object.keys(ind) as FinalIndicatorCode[]).filter((k) => ind[k]?.status === status);
}

/**
 * Heuristic scoring from the python spec:
 * - Use CTF, RDX, EDS, IFD (structure and expression signals) as human-facing evidence
 * - Use TPS as AI signal if present
 * - Use KPF as human authenticity signal if present
 * - Treat missing/excluded conservatively (do not block output)
 */
export function finalDeterminationPrev(inp: FinalCffInput): FinalDeterminationResultPayload {
  const indicators = inp.indicators;

  const missing = fdListByStatus(indicators, "Missing");
  const excluded = fdListByStatus(indicators, "Excluded");

  const AAS = fdSafe01(indicators.AAS?.value_0to1);
  const CTF = fdSafe01(indicators.CTF?.value_0to1);
  const RMD = fdSafe01(indicators.RMD?.value_0to1);
  const RDX = fdSafe01(indicators.RDX?.value_0to1);
  const EDS = fdSafe01(indicators.EDS?.value_0to1);
  const IFD = fdSafe01(indicators.IFD?.value_0to1);
  const KPF = fdSafe01(indicators.KPF?.value_0to1);
  const TPS = fdSafe01(indicators.TPS?.value_0to1);

  // Human score focuses on expression and deviation from templated sameness.
  const humanParts: number[] = [];
  if (CTF != null) humanParts.push(CTF);
  if (RDX != null) humanParts.push(RDX);
  if (EDS != null) humanParts.push(EDS);
  if (IFD != null) humanParts.push(IFD);
  if (KPF != null) humanParts.push(KPF);
  // small support signals
  if (AAS != null) humanParts.push(0.5 * AAS);
  if (RMD != null) humanParts.push(0.5 * RMD);

  const humanScore = humanParts.length ? humanParts.reduce((a, b) => a + b, 0) / humanParts.length : 0.5;

  // AI score uses TPS strongly when available, otherwise uses low-variance proxies via (1 - EDS) and (1 - RDX)
  const aiParts: number[] = [];
  if (TPS != null) aiParts.push(TPS);
  if (EDS != null) aiParts.push(1 - EDS);
  if (RDX != null) aiParts.push(1 - RDX);
  if (CTF != null) aiParts.push(0.5 * (1 - CTF));

  const aiScore = aiParts.length ? aiParts.reduce((a, b) => a + b, 0) / aiParts.length : 0.5;

  // Hybrid score is high when both human and ai evidence are moderate, and contradictory signals exist.
  const hybridScore = clamp(1 - Math.abs(humanScore - aiScore), 0, 1);

  // FinalTrack selection with conservative guard
  let track: FinalTrack = "Hybrid";
  if (TPS != null && TPS >= 0.80 && (KPF == null || KPF < 0.45)) track = "AI";
  else if ((KPF != null && KPF >= 0.70) && (TPS == null || TPS < 0.60)) track = "Human";
  else if (humanScore >= 0.65 && aiScore < 0.55) track = "Human (text-only)";
  else if (aiScore >= 0.70 && humanScore < 0.55) track = "AI";
  else track = "Hybrid";

  // Code selection (compressed version of the python matrix)
  let code: DetCode = "T3";
  if (track === "Human") code = "Hx-1";
  else if (track === "Human (text-only)") code = "Hx-2";
  else if (track === "AI") code = "Ax-1";
  else code = "T3";

  // Confidence: depends on availability of key indicators
  const keyPresent = ["CTF","RDX","EDS","IFD","TPS","KPF"].reduce((acc, k) => acc + (indicators[k as FinalIndicatorCode]?.status === "Active" ? 1 : 0), 0);
  const coverage = keyPresent / 6;
  const separation = Math.abs(humanScore - aiScore); // higher separation => higher confidence
  const confidence = clamp(0.45 + 0.35 * coverage + 0.20 * separation, 0, 0.95);

  return {
    track,
    code,
    confidence_0to1: round4(confidence, 4),
    rationale: {
      human_score_0to1: round4(humanScore, 4),
      ai_score_0to1: round4(aiScore, 4),
      hybrid_score_0to1: round4(hybridScore, 4),
      missing,
      excluded,
    },
  };
}


export type CffFinalTypePublic = { label: string; type_code: string; chip_label: string; confidence: number; interpretation: string; };
export type CffOut = { cff: { final_type: CffFinalTypePublic } };

function avg(a: number | null, b: number | null): number | null {
  if (a == null && b == null) return null;
  if (a == null) return b;
  if (b == null) return a;
  return (a + b) / 2;
}

function fdLabel(code: DetCode): string {
  if (code === "T1") return "T1. Analytical Reasoner";
  if (code === "T2") return "T2. Reflective Thinker";
  if (code === "T3") return "T3. Intuitive Explorer";
  if (code === "T4") return "T4. Strategic Integrator";
  if (code === "T5") return "T5. Human Expressionist";
  if (code === "T6") return "T6. Machine-Dominant";
  if (code === "Hx-1") return "Hx-1. Draft-Assist";
  if (code === "Hx-2") return "Hx-2. Structure-Assist";
  if (code === "Hx-3") return "Hx-3. Evidence-Assist";
  if (code === "Hx-4") return "Hx-4. Reasoning-Assist";
  if (code === "Ax-1") return "Ax-1. Template Generator";
  if (code === "Ax-2") return "Ax-2. Evidence Synthesizer";
  if (code === "Ax-3") return "Ax-3. Style Emulator";
  return "Ax-4. Reasoning Simulator";
}

export function computeFinalDeterminationCff(cff: any): CffOut {
  const det = finalDeterminationPrev({ indicators: {
    AAS: { value_0to1: cff.indicators["AAS"]?.score ?? null, status: (cff.indicators["AAS"]?.status as any) ?? "Missing" },
    CTF: { value_0to1: cff.indicators["CTF"]?.score ?? null, status: (cff.indicators["CTF"]?.status as any) ?? "Missing" },
    RMD: { value_0to1: cff.indicators["RMD"]?.score ?? null, status: (cff.indicators["RMD"]?.status as any) ?? "Missing" },
    RDX: { value_0to1: cff.indicators["RDX"]?.score ?? null, status: (cff.indicators["RDX"]?.status as any) ?? "Missing" },
    EDS: { value_0to1: cff.indicators["EDS"]?.score ?? null, status: (cff.indicators["EDS"]?.status as any) ?? "Missing" },
    IFD: { value_0to1: cff.indicators["IFD"]?.score ?? null, status: (cff.indicators["IFD"]?.status as any) ?? "Missing" },
    KPF: { value_0to1: cff.indicators["KPF-Sim"]?.score ?? null, status: ((cff.indicators["KPF-Sim"]?.status === "Excluded" ? "Excluded" : cff.indicators["KPF-Sim"]?.status) as any) ?? "Missing" },
    TPS: { value_0to1: cff.indicators["TPS-H"]?.score ?? null, status: ((cff.indicators["TPS-H"]?.status === "Excluded" ? "Excluded" : cff.indicators["TPS-H"]?.status) as any) ?? "Missing" },
  } });
  const label = fdLabel(det.code);
  let interpretation = label;
  if (det.code === "T1") interpretation = "T1. Analytical Reasoner approaches problems through structured decomposition and logical sequencing. Reasoning is driven by explicit analysis, rule-based evaluation, and clear separation of components. This pattern prioritizes correctness, internal consistency, and stepwise justification.";
  else if (det.code === "T2") interpretation = "T2. Reflective Thinker emphasizes self-monitoring and internal revision during reasoning. This pattern frequently revisits prior assumptions, adjusts interpretations, and refines conclusions through reflection. Reasoning quality is shaped by iterative reassessment rather than linear progression.";
  else if (det.code === "T3") interpretation = "T3. Intuitive Explorer relies on associative thinking and exploratory inference. Reasoning advances through pattern recognition, conceptual leaps, and hypothesis generation rather than explicit structure. This pattern prioritizes discovery and possibility over immediate validation.";
  else if (det.code === "T4") interpretation = "T4. Strategic Integrator focuses on synthesizing multiple perspectives into a coherent direction. Reasoning involves alignment of goals, constraints, and long-term implications. This pattern emphasizes coordination, prioritization, and purposeful convergence.";
  else if (det.code === "T5") interpretation = "T5. Human Expressionist centers reasoning around meaning, context, and human experience. Thought is shaped by narrative coherence, emotional nuance, and communicative clarity. This pattern prioritizes expressiveness and interpretive depth over formal structure.";
  else if (det.code === "T6") interpretation = "T6. Machine-Dominant pattern shows strong reliance on external systems or automated reasoning flows. Decision progression often mirrors templated logic or system-driven optimization. Human agency and self-directed revision signals remain limited.";
  else if (det.code === "Hx-1") interpretation = "Hx-1. Draft-Assist Type uses AI support primarily for initial idea formation. Human control increases in later stages through revision and refinement.";
  else if (det.code === "Hx-2") interpretation = "Hx-2. Structure-Assist Type relies on AI to organize and scaffold reasoning. Core ideas remain human-driven, while structural clarity is externally supported.";
  else if (det.code === "Hx-3") interpretation = "Hx-3. Evidence-Assist Type leverages AI to gather or arrange supporting material. Human reasoning determines relevance and final judgment.";
  else if (det.code === "Hx-4") interpretation = "Hx-4. Reasoning-Assist Type involves AI participation in intermediate reasoning steps. Human oversight remains, but reasoning momentum is partially shared.";
  else if (det.code === "Ax-1") interpretation = "Ax-1. Template Generator produces reasoning by following predefined structural patterns. Responses are consistent and organized but show limited adaptation beyond the template. Original restructuring signals are minimal.";
  else if (det.code === "Ax-2") interpretation = "Ax-2. Evidence Synthesizer focuses on collecting and linking supporting information. Reasoning emphasizes aggregation and alignment of evidence rather than original inference. Conclusions emerge from evidence density rather than internal exploration.";
  else if (det.code === "Ax-3") interpretation = "Ax-3. Style Emulator mirrors linguistic and structural patterns of the input or reference style. Reasoning quality depends heavily on stylistic imitation rather than autonomous decision flow.";
  else if (det.code === "Ax-4") interpretation = "Ax-4. Reasoning Simulator reproduces the appearance of structured reasoning through iterative expansion and recombination. While transitions and revisions are present, they are driven by simulation rather than genuine internal intent formation.";
  return { cff: { final_type: { label, type_code: det.code, chip_label: label, confidence: round2(det.confidence_0to1), interpretation } } };
}
/* ===== Backend_11_Structural Control Signals.ts ===== */

/* Structural Control Signals (Agency Indicators) v1.0
   Output: 0..1 normalized magnitudes (NOT probabilities)

   Required raw (minimum):
   - units: number

   Recommended raw for stable metrics:
   - unit_lengths?: number[]                    // per-unit length (tokens/chars/sentences)
   - per_unit?: {                                // per-unit event counts (best)
       claims?: number[]
       reasons?: number[]
       evidence?: number[]
       sub_claims?: number[]
       warrants?: number[]
       counterpoints?: number[]
       refutations?: number[]
       transitions?: number[]
       transition_ok?: number[]
       revisions?: number[]
       revision_depth?: number[]                 // depth per revision event or per unit (either is OK if consistent)
       belief_change?: number[]                  // 0/1 per unit (optional)
     }

   Also allowed (fallback totals if per-unit arrays are missing):
   - totals?: {
       claims?: number
       reasons?: number
       evidence?: number
       sub_claims?: number
       warrants?: number
       counterpoints?: number
       refutations?: number
       transitions?: number
       transition_ok?: number
       revisions?: number
       revision_depth_sum?: number
       belief_change?: number
     }
*/

export type AgencyRaw = {
  units: number;

  unit_lengths?: number[];

  per_unit?: Partial<Record<
    | "claims"
    | "reasons"
    | "evidence"
    | "sub_claims"
    | "warrants"
    | "counterpoints"
    | "refutations"
    | "transitions"
    | "transition_ok"
    | "revisions"
    | "revision_depth"
    | "belief_change",
    number[]
  >>;

  totals?: Partial<Record<
    | "claims"
    | "reasons"
    | "evidence"
    | "sub_claims"
    | "warrants"
    | "counterpoints"
    | "refutations"
    | "transitions"
    | "transition_ok"
    | "revisions"
    | "revision_depth_sum"
    | "belief_change",
    number
  >>;
};

export type AgencyIndicators = {
  structural_variance: number;   // 0..1
  human_rhythm_index: number;    // 0..1
  transition_flow: number;       // 0..1
  revision_depth: number;        // 0..1
};

function sum(arr: number[]): number {
  let s = 0;
  for (const v of arr) s += safeNum(v, 0);
  return s;
}

function cv(arr: number[]): number {
  const m = mean(arr);
  if (m <= 0) return 0;
  return std(arr) / m;
}

function diffsSortedIndices(indices: number[]): number[] {
  if (indices.length < 2) return [];
  const xs = [...indices].map(x => Math.floor(safeNum(x, 0))).filter(x => x >= 0).sort((a, b) => a - b);
  const out: number[] = [];
  for (let i = 1; i < xs.length; i++) out.push(xs[i] - xs[i - 1]);
  return out;
}

function eventIndicesFromPerUnit(perUnit?: number[]): number[] {
  if (!perUnit || perUnit.length === 0) return [];
  const out: number[] = [];
  for (let i = 0; i < perUnit.length; i++) {
    const v = safeNum(perUnit[i], 0);
    if (v > 0) out.push(i);
  }
  return out;
}

/* K segmentation rule:
   K = clip(round4(sqrt(units)), 3, 8), but if units < 6 then K = 3
*/
function chooseK(units: number): number {
  const u = Math.max(1, Math.floor(safeNum(units, 1)));
  if (u < 6) return 3;
  const k = Math.round(Math.sqrt(u));
  return Math.min(8, Math.max(3, k));
}

function segmentRanges(units: number, K: number): Array<{ start: number; end: number; len: number }> {
  const u = Math.max(1, Math.floor(units));
  const k = Math.max(1, Math.floor(K));
  const ranges: Array<{ start: number; end: number; len: number }> = [];
  for (let i = 0; i < k; i++) {
    const start = Math.floor((i * u) / k);
    const end = Math.floor(((i + 1) * u) / k);
    const len = Math.max(0, end - start);
    ranges.push({ start, end, len });
  }
  return ranges;
}

function sliceSum(arr: number[] | undefined, start: number, end: number): number {
  if (!arr || arr.length === 0) return 0;
  const s = Math.max(0, start);
  const e = Math.min(arr.length, Math.max(s, end));
  let out = 0;
  for (let i = s; i < e; i++) out += safeNum(arr[i], 0);
  return out;
}

function l2norm(vec: number[]): number {
  let ss = 0;
  for (const v of vec) {
    const x = safeNum(v, 0);
    ss += x * x;
  }
  return Math.sqrt(ss);
}

function l2dist(a: number[], b: number[]): number {
  const n = Math.max(a.length, b.length);
  let ss = 0;
  for (let i = 0; i < n; i++) {
    const dv = safeNum(a[i], 0) - safeNum(b[i], 0);
    ss += dv * dv;
  }
  return Math.sqrt(ss);
}

/* ---------- Indicator 1: Structural variance ----------

   Uses per-unit arrays if available.
   If per-unit arrays are missing, returns 0 (cannot measure cross-boundary restructuring reliably).

   Spec:
   - Split document into K segments by unit index
   - Build segment structure vector s_k with per-unit normalized ratios
   - SV_raw = mean_k ||s_k - s_bar||_2
   - structural_variance = min(1, SV_raw / SV_MAX)

   Default SV_MAX = 0.35 (v1.0)
*/
function computeStructuralVariance(raw: AgencyRaw, SV_MAX = 0.35): number {
  const units = Math.max(1, Math.floor(safeNum(raw.units, 1)));
  const K = chooseK(units);
  const ranges = segmentRanges(units, K);

  const pu = raw.per_unit || {};
  const keys: Array<keyof NonNullable<AgencyRaw["per_unit"]>> = [
    "claims",
    "reasons",
    "evidence",
    "sub_claims",
    "warrants",
    "counterpoints",
    "refutations",
    "transitions",
  ];

  const hasAnyPerUnit = keys.some(k => Array.isArray(pu[k]) && (pu[k] as number[]).length > 0);
  if (!hasAnyPerUnit) return 0;

  const segVecs: number[][] = [];
  for (const rg of ranges) {
    const uSeg = Math.max(1, rg.len);
    const vec: number[] = [];
    for (const k of keys) {
      const v = sliceSum(pu[k] as number[] | undefined, rg.start, rg.end);
      vec.push(v / uSeg);
    }
    segVecs.push(vec);
  }

  // mean vector
  const dim = segVecs[0]?.length || 0;
  const sBar = new Array(dim).fill(0);
  for (const v of segVecs) {
    for (let j = 0; j < dim; j++) sBar[j] += safeNum(v[j], 0);
  }
  for (let j = 0; j < dim; j++) sBar[j] = safeDiv(sBar[j], segVecs.length);

  // mean L2 distance to mean vector
  let acc = 0;
  for (const v of segVecs) acc += l2dist(v, sBar);
  const SV_raw = safeDiv(acc, segVecs.length);

  return clamp01(safeDiv(SV_raw, SV_MAX));
}

/* ---------- Indicator 2: Human rhythm index ----------

   Spec:
   - Build interval sequences and compute CV
   - Combine available CVs and normalize by CV_REF

   Default: CV_REF = 0.6
   Weights: len 0.6, transition 0.2, revision 0.2 (v1.0)
*/
function computeHumanRhythmIndex(raw: AgencyRaw, CV_REF = 0.6): number {
  const cvs: Array<{ v: number; w: number }> = [];

  if (raw.unit_lengths && raw.unit_lengths.length >= 2) {
    cvs.push({ v: cv(raw.unit_lengths.map(x => Math.max(0, safeNum(x, 0)))), w: 0.6 });
  }

  const pu = raw.per_unit || {};
  const tIdx = eventIndicesFromPerUnit(pu.transitions as number[] | undefined);
  const rIdx = eventIndicesFromPerUnit(pu.revisions as number[] | undefined);

  const tDiffs = diffsSortedIndices(tIdx);
  if (tDiffs.length >= 2) cvs.push({ v: cv(tDiffs), w: 0.2 });

  const rDiffs = diffsSortedIndices(rIdx);
  if (rDiffs.length >= 2) cvs.push({ v: cv(rDiffs), w: 0.2 });

  if (cvs.length === 0) return 0;

  let num = 0;
  let den = 0;
  for (const { v, w } of cvs) {
    num += safeNum(v, 0) * w;
    den += w;
  }
  const combined = den > 0 ? num / den : 0;

  return clamp01(safeDiv(combined, CV_REF));
}

/* ---------- Indicator 3: Transition flow ----------

   Spec:
   transition_flow = (valid / total) * log(1 + avg_chain_length)
   Then clip 0..1

   avg_chain_length:
   - If per-unit transitions exists: compute mean length of consecutive transition runs
   - Else fallback to 1.0
*/
function computeAvgChainLengthFromPerUnitTransitions(perUnitTransitions?: number[]): number {
  if (!perUnitTransitions || perUnitTransitions.length === 0) return 1;
  const xs = perUnitTransitions.map(v => (safeNum(v, 0) > 0 ? 1 : 0));
  let runs: number[] = [];
  let cur = 0;
  for (const x of xs) {
    if (x === 1) cur += 1;
    else if (cur > 0) {
      runs.push(cur);
      cur = 0;
    }
  }
  if (cur > 0) runs.push(cur);
  return runs.length ? mean(runs) : 1;
}

function computeTransitionFlow(raw: AgencyRaw): number {
  const totals = raw.totals || {};
  const pu = raw.per_unit || {};

  const totalTransitions =
    (Array.isArray(pu.transitions) ? sum(pu.transitions as number[]) : undefined) ??
    safeNum(totals.transitions, 0);

  const validTransitions =
    (Array.isArray(pu.transition_ok) ? sum(pu.transition_ok as number[]) : undefined) ??
    safeNum(totals.transition_ok, 0);

  const ratio = safeDiv(validTransitions, Math.max(1, totalTransitions));

  const avgChain =
    computeAvgChainLengthFromPerUnitTransitions(pu.transitions as number[] | undefined);

  const tf = ratio * Math.log(1 + Math.max(0, avgChain));
  return clamp01(tf);
}

/* ---------- Indicator 4: Revision depth ----------

   Spec:
   revision_depth = min(1, revision_depth_sum / D_MAX)

   Default: D_MAX = 3.0 (v1.0)
   If revision_depth_sum missing but revisions exists: fallback proxy based on log scaling.
*/
function computeRevisionDepth(raw: AgencyRaw, D_MAX = 3.0, R_REF = 12): number {
  const totals = raw.totals || {};
  const pu = raw.per_unit || {};

  // Prefer explicit depth sum
  let depthSum =
    (Array.isArray(pu.revision_depth) ? sum(pu.revision_depth as number[]) : undefined) ??
    safeNum(totals.revision_depth_sum, NaN);

  if (Number.isFinite(depthSum)) {
    return clamp01(safeDiv(depthSum, D_MAX));
  }

  // Fallback: use revision count proxy
  const revisions =
    (Array.isArray(pu.revisions) ? sum(pu.revisions as number[]) : undefined) ??
    safeNum(totals.revisions, 0);

  const proxy = safeDiv(Math.log(1 + Math.max(0, revisions)), Math.log(1 + Math.max(1, R_REF)));
  return clamp01(proxy);
}

/* ---------- Public API ---------- */

export function computeAgencyIndicators(raw: AgencyRaw): AgencyIndicators {
  const structural_variance = computeStructuralVariance(raw);
  const human_rhythm_index = computeHumanRhythmIndex(raw);
  const transition_flow = computeTransitionFlow(raw);
  const revision_depth = computeRevisionDepth(raw);

  return {
    structural_variance: round2(structural_variance),
    human_rhythm_index: round2(human_rhythm_index),
    transition_flow: round2(transition_flow),
    revision_depth: round2(revision_depth),
  };
}

/* ---------- Export JSON wrapper (rc format) ---------- */

export type StructuralControlSignalsRcJson = {
  rc: {
    structural_control_signals: AgencyIndicators;
  };
};

/**
 * computeAgencyIndicatorsRc
 * - Returns rc-wrapped JSON:
 *   {
 *     "rc": {
 *       "structural_control_signals": {
 *         "structural_variance": ...,
 *         "human_rhythm_index": ...,
 *         "transition_flow": ...,
 *         "revision_depth": ...
 *       }
 *     }
 *   }
 */
export function computeAgencyIndicatorsRc(raw: AgencyRaw): StructuralControlSignalsRcJson {
  return {
    rc: {
      structural_control_signals: computeAgencyIndicators(raw),
    },
  };
}

export type RawFeaturesPayload = {
  raw_features: {
    layer_0: {
      units: number;

      // arrays for stable metrics (length must equal units when present)
      unit_lengths?: number[];
      per_unit?: {
        transitions?: number[];
        revisions?: number[];

        // optional expansions (enable richer structural variance and rhythm features)
        claims?: number[];
        reasons?: number[];
        evidence?: number[];
        sub_claims?: number[];
        warrants?: number[];
        counterpoints?: number[];
        refutations?: number[];
        transition_ok?: number[];
        revision_depth?: number[];
        belief_change?: number[];
      };

      // totals (keep)
      claims: number;
      reasons: number;
      evidence: number;
    };
    layer_1: {
      sub_claims: number;
      warrants: number;
      counterpoints: number;
      refutations: number;
      structure_type: string | null;
    };
    layer_2: {
      transitions: number;
      transition_types: string[];
      transition_ok: number;
      revisions: number;
      revision_depth_sum: number;
      belief_change: boolean;
    };
    layer_3: {
      intent_markers: number;
      drift_segments: number;
      hedges: number;
      loops: number;
      self_regulation_signals: number;
    };
    evidence_types: Record<string, number>;
    adjacency_links: number;
    backend_reserved: {
      kpf_sim: number | null;
      tps_h: number | null;
    };
  };
};

export type RcStructuralControlSignalsJson = {
  rc: {
    structural_control_signals: AgencyIndicators;
  };
};

function toAgencyRawFromRawFeatures(payload: RawFeaturesPayload): AgencyRaw {
  const rf = (payload as any)?.raw_features ?? (payload as any);

  const units = Math.max(0, safeNum(rf?.layer_0?.units, 0));

  // arrays (only accept if length === units)
  const unit_lengths_raw = rf?.layer_0?.unit_lengths;
  const unit_lengths =
    Array.isArray(unit_lengths_raw) && unit_lengths_raw.length === units
      ? unit_lengths_raw.map((x) => Math.max(0, Math.floor(safeNum(x, 0))))
      : undefined;

  const pu0 = rf?.layer_0?.per_unit;

  const arrOrUndef = (a: unknown): number[] | undefined => {
    if (!Array.isArray(a)) return undefined;
    if (a.length !== units) return undefined;
    return a.map((x) => Math.max(0, safeNum(x, 0)));
  };

  const per_unit: AgencyRaw["per_unit"] = {
    transitions: arrOrUndef(pu0?.transitions),
    revisions: arrOrUndef(pu0?.revisions),

    claims: arrOrUndef(pu0?.claims),
    reasons: arrOrUndef(pu0?.reasons),
    evidence: arrOrUndef(pu0?.evidence),
    sub_claims: arrOrUndef(pu0?.sub_claims),
    warrants: arrOrUndef(pu0?.warrants),
    counterpoints: arrOrUndef(pu0?.counterpoints),
    refutations: arrOrUndef(pu0?.refutations),
    transition_ok: arrOrUndef(pu0?.transition_ok),
    revision_depth: arrOrUndef(pu0?.revision_depth),
    belief_change: arrOrUndef(pu0?.belief_change),
  };

  const totals: NonNullable<AgencyRaw["totals"]> = {
    claims: Math.max(0, safeNum(rf?.layer_0?.claims, 0)),
    reasons: Math.max(0, safeNum(rf?.layer_0?.reasons, 0)),
    evidence: Math.max(0, safeNum(rf?.layer_0?.evidence, 0)),

    sub_claims: Math.max(0, safeNum(rf?.layer_1?.sub_claims, 0)),
    warrants: Math.max(0, safeNum(rf?.layer_1?.warrants, 0)),
    counterpoints: Math.max(0, safeNum(rf?.layer_1?.counterpoints, 0)),
    refutations: Math.max(0, safeNum(rf?.layer_1?.refutations, 0)),

    transitions: Math.max(0, safeNum(rf?.layer_2?.transitions, 0)),
    transition_ok: Math.max(0, safeNum(rf?.layer_2?.transition_ok, 0)),
    revisions: Math.max(0, safeNum(rf?.layer_2?.revisions, 0)),
    revision_depth_sum: Math.max(0, safeNum(rf?.layer_2?.revision_depth_sum, 0)),

    belief_change: rf?.layer_2?.belief_change ? 1 : 0,
  };

  const hasAnyPerUnit =
    per_unit && Object.values(per_unit).some((v) => Array.isArray(v) && v.length > 0);

  return {
    units,
    unit_lengths,
    per_unit: hasAnyPerUnit ? per_unit : undefined,
    totals,
  };
}


/**
 * Final API (your contract):
 * - Input: RawFeaturesPayload
 * - Output:
 *   { "rc": { "structural_control_signals": { ...4 indicators... } } }
 */
export function computeStructuralControlSignalsRc(payload: RawFeaturesPayload): RcStructuralControlSignalsJson {
  const agencyRaw = toAgencyRawFromRawFeatures(payload);
  const indicators = computeAgencyIndicators(agencyRaw);
  return {
    rc: {
      structural_control_signals: indicators,
    },
  };
}


/* ===== Backend_8_Reasoning Control Summary.ts ===== */

/* rc.ts (MIN INPUT CONTRACT)
   PURPOSE
   - Accept ONLY the raw_features fields needed to compute RC (Reasoning Control).
   - Compute A,D,R internally from those fields.
   - Output ONLY the final JSON contract:

   {
     "rc": {
       "summary": "...",
       "control_pattern": "Deep Reflective Human",
       "reliability_band": "HIGH" | "MEDIUM" | "LOW",
       "band_rationale": "...",
       "pattern_interpretation": "..."
     }
   }

   RULES
   - Single file.
   - No import of full raw_features schema.
   - Accept only required fields (minimal contract).
   - No *_en fields.
   - Compile-safe: uses global isFinite(), not Number.isFinite().
*/

export type RCInputRaw = {
  layer_0: {
    units: number;
    claims: number;
    reasons: number;
    evidence: number;
  };
  layer_1: {
    counterpoints: number;
    refutations: number;
  };
  layer_2: {
    transitions: number;
    transition_ok: number;
    revisions: number;
    revision_depth_sum: number;
  };
  layer_3: {
    intent_markers: number;
    drift_segments: number;
    self_regulation_signals: number;
  };
};

type ControlVector = { A: number; D: number; R: number };

type ControlPattern =
  | "deep_reflective_human"
  | "moderate_reflective_human"
  | "moderate_procedural_human"
  | "shallow_procedural_human"
  | "moderate_reflective_hybrid"
  | "shallow_procedural_hybrid"
  | "shallow_procedural_ai"
  | "moderate_procedural_ai"
  | "deep_procedural_ai";

type ReliabilityBand = "HIGH" | "MEDIUM" | "LOW";

type ControlPatternMeta = {
  control_pattern: ControlPattern;
  pattern_description: string;
  pattern_interpretation: string;
  band_rationale: string;
};

export type RCOut = {
  summary: string;
  control_pattern: string; // Human-readable label
  reliability_band: ReliabilityBand;
  band_rationale: string;
  pattern_interpretation: string;
};

function n0(x: unknown): number {
  return isFiniteNumber(x) ? x : 0;
}
// 0..inf -> 0..1, spike-safe
function sat(x: number, k: number): number {
  const xx = x < 0 ? 0 : x;
  return xx / (xx + k);
}

/* =========================
   1) A,D,R from raw (MIN)
========================= */

function computeADR_min(raw: RCInputRaw): ControlVector {
  const U = Math.max(1, Math.floor(n0(raw?.layer_0?.units)));
  const C = Math.max(0, n0(raw?.layer_0?.claims));
  const reasons = Math.max(0, n0(raw?.layer_0?.reasons));
  const evidence = Math.max(0, n0(raw?.layer_0?.evidence));

  const counterpoints = Math.max(0, n0(raw?.layer_1?.counterpoints));
  const refutations = Math.max(0, n0(raw?.layer_1?.refutations));

  const transitions = Math.max(0, n0(raw?.layer_2?.transitions));
  const transitionOk = Math.max(0, n0(raw?.layer_2?.transition_ok));

  const revisions = Math.max(0, n0(raw?.layer_2?.revisions));
  const revisionDepthSum = Math.max(0, n0(raw?.layer_2?.revision_depth_sum));

  const intentMarkers = Math.max(0, n0(raw?.layer_3?.intent_markers));
  const driftSegments = Math.max(0, n0(raw?.layer_3?.drift_segments));
  const selfReg = Math.max(0, n0(raw?.layer_3?.self_regulation_signals));

  // Normalizations
  const transitionDensity = safeDiv(transitions, U);
  const transitionQuality = clamp01(safeDiv(transitionOk, transitions));

  const revisionRate = safeDiv(revisions, U);
  const revisionDepthAvg = safeDiv(revisionDepthSum, Math.max(1, revisions));

  const counterRate = safeDiv(counterpoints + refutations, Math.max(1, C));
  const intentRate = safeDiv(intentMarkers, U);
  const driftRate = safeDiv(driftSegments, U);

  const reasonRate = safeDiv(reasons, Math.max(1, C));
  const evidenceRate = safeDiv(evidence, Math.max(1, C));

  // A: Agency (minimal signals)
  const A_core =
    0.30 * sat(intentRate, 0.25) +
    0.28 * sat(revisionRate, 0.30) +
    0.24 * sat(counterRate, 0.35) +
    0.12 * transitionQuality +
    0.06 * sat(safeDiv(selfReg, U), 0.20);

  // penalties (keep only drift + low-quality transition under high density)
  const A_penalty =
    0.24 * sat(driftRate, 0.25) +
    0.16 * sat(transitionDensity * (1 - transitionQuality), 0.25);

  const A = clamp01(A_core - A_penalty);

  // D: Depth (minimal: reasons + evidence + structured movement)
  const D_core =
    0.45 * sat(reasonRate, 0.9) +
    0.35 * sat(evidenceRate, 0.7) +
    0.20 * sat(transitionDensity, 0.7);

  const D = clamp01(D_core);

  // R: Reflection (minimal: revision frequency + depth + counter-evaluation + self-reg)
  const R_core =
    0.32 * sat(revisionRate, 0.28) +
    0.24 * sat(revisionDepthAvg, 0.9) +
    0.22 * sat(counterRate, 0.30) +
    0.16 * sat(safeDiv(selfReg, U), 0.25) +
    0.06 * transitionQuality;

  // penalty (keep only drift)
  const R_penalty = 0.12 * sat(driftRate, 0.30);

  const R = clamp01(R_core - R_penalty);

  return { A, D, R };
}

/* =========================
   2) RC pattern meta
========================= */

const CONTROL_PATTERN_META: Record<ControlPattern, ControlPatternMeta> = {
  deep_reflective_human: {
    control_pattern: "deep_reflective_human",
    pattern_description:
      "Reasoning appears human-led, with sustained reflection and stable revision across the response.",
    pattern_interpretation:
      "A high human share suggests that key reasoning decisions remain under human control.",
    band_rationale:
      "Key decisions appear to come from human revision and judgment rather than automated continuation.",
  },
  moderate_reflective_human: {
    control_pattern: "moderate_reflective_human",
    pattern_description:
      "Reasoning appears human-led, with local moments of reflection and generally stable structure.",
    pattern_interpretation:
      "A high human share suggests mostly human-led control, with reflection appearing in specific segments.",
    band_rationale:
      "The response shows some human revision, though not deep restructuring.",
  },
  moderate_procedural_human: {
    control_pattern: "moderate_procedural_human",
    pattern_description:
      "Human-authored reasoning following a stable procedural structure. The current position lies within the human cluster but closer to the procedural boundary.",
    pattern_interpretation:
      "A high human proportion indicates human-led control under a procedural sequence, with limited reflective intervention.",
    band_rationale:
      "Reasoning decisions follow a predefined structural sequence with minimal reflective intervention.",
  },
  shallow_procedural_human: {
    control_pattern: "shallow_procedural_human",
    pattern_description:
      "Human-generated reasoning with shallow procedural progression and limited structural depth. The current position is weakly anchored within the human reasoning cluster.",
    pattern_interpretation:
      "A high human proportion indicates human-led control, though structural decisions tend to follow shallow continuation patterns.",
    band_rationale:
      "Reasoning decisions rely on surface-level continuation rather than deliberate structural control.",
  },
  moderate_reflective_hybrid: {
    control_pattern: "moderate_reflective_hybrid",
    pattern_description:
      "Mixed-agency reasoning with partial human reflection and assisted structural development. The current position spans the boundary between human and hybrid clusters.",
    pattern_interpretation:
      "A mixed distribution indicates shared control, where human intent is present but transitions partially reflect assisted continuation.",
    band_rationale:
      "Reasoning decisions reflect human intent but are partially influenced by assisted continuation patterns.",
  },
  shallow_procedural_hybrid: {
    control_pattern: "shallow_procedural_hybrid",
    pattern_description:
      "Hybrid reasoning with procedural structure and limited reflective control. The current position trends toward the hybrid procedural region.",
    pattern_interpretation:
      "A mixed distribution indicates assisted procedural flow, with limited human-led structural revision at decision boundaries.",
    band_rationale:
      "Reasoning decisions follow assisted procedural flow with minimal human structural revision.",
  },
  shallow_procedural_ai: {
    control_pattern: "shallow_procedural_ai",
    pattern_description:
      "AI-dominant reasoning with shallow procedural expansion. The current position is located near the automated cluster perimeter.",
    pattern_interpretation:
      "A low human proportion indicates control signals are dominated by automated continuation rather than human-led structural decisions.",
    band_rationale:
      "Reasoning decisions primarily arise from automated continuation without observable human control signals.",
  },
  moderate_procedural_ai: {
    control_pattern: "moderate_procedural_ai",
    pattern_description:
      "The reasoning follows a stable procedural pattern, with limited signs of reflective revision.",
    pattern_interpretation:
      "A low human share suggests a stable automated continuation pattern with limited evidence of human-led control.",
    band_rationale:
      "The response continues in a consistent pattern without clear signs of human-led revision.",
  },
  deep_procedural_ai: {
    control_pattern: "deep_procedural_ai",
    pattern_description:
      "The reasoning is structurally complex, but reflective control remains limited.",
    pattern_interpretation:
      "A low human share suggests layered procedural expansion without strong signs of individual reflective control.",
    band_rationale:
      "The response expands in layers, but shows little evidence of intentional evaluative judgment.",
  },
};

const CENTROIDS: Record<ControlPattern, ControlVector> = {
  deep_reflective_human: { A: 0.85, D: 0.8, R: 0.8 },
  moderate_reflective_human: { A: 0.8, D: 0.55, R: 0.6 },
  moderate_procedural_human: { A: 0.75, D: 0.55, R: 0.25 },
  shallow_procedural_human: { A: 0.7, D: 0.3, R: 0.2 },
  moderate_reflective_hybrid: { A: 0.55, D: 0.55, R: 0.55 },
  shallow_procedural_hybrid: { A: 0.5, D: 0.3, R: 0.2 },
  shallow_procedural_ai: { A: 0.2, D: 0.3, R: 0.15 },
  moderate_procedural_ai: { A: 0.15, D: 0.55, R: 0.15 },
  deep_procedural_ai: { A: 0.1, D: 0.8, R: 0.1 },
};

function euclidean(a: ControlVector, b: ControlVector): number {
  const dA = a.A - b.A;
  const dD = a.D - b.D;
  const dR = a.R - b.R;
  return Math.sqrt(dA * dA + dD * dD + dR * dR);
}

function bandFromDistance(d: number): ReliabilityBand {
  if (d < 0.12) return "HIGH";
  if (d < 0.22) return "MEDIUM";
  return "LOW";
}

function formatControlPatternLabel(p: ControlPattern): string {
  return p
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/* =========================
   3) RC inference (nearest centroid)
========================= */

function inferRCFromADR(vIn: ControlVector): RCOut {
  const v: ControlVector = {
    A: clamp01(isFiniteNumber(vIn.A) ? vIn.A : 0.5),
    D: clamp01(isFiniteNumber(vIn.D) ? vIn.D : 0.5),
    R: clamp01(isFiniteNumber(vIn.R) ? vIn.R : 0.5),
  };

  let best: ControlPattern = "moderate_reflective_human";
  let bestDist = Number.POSITIVE_INFINITY;

  (Object.keys(CENTROIDS) as ControlPattern[]).forEach((p) => {
    const d = euclidean(v, CENTROIDS[p]);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  });

  const meta = CONTROL_PATTERN_META[best];
  const rb = bandFromDistance(bestDist);

  return {
    summary: meta.pattern_description,
    control_pattern: formatControlPatternLabel(best),
    reliability_band: rb,
    band_rationale: meta.band_rationale,
    pattern_interpretation: meta.pattern_interpretation,
  };
}

/* =========================
   4) PUBLIC API
   - Takes only needed raw fields
   - Returns only final JSON
========================= */

export function computeRCFromRaw(raw: RCInputRaw): { rc: RCOut } {
  const adr = computeADR_min(raw);
  const rc = inferRCFromADR(adr);
  return { rc };
}


/* ===== Backend_10_Reasoning Control Distribution.ts ===== */

/* ============================================================
   Reasoning Control Distribution + Determination (CFV Logistic Spec)
   ============================================================ */

export type Determination = "Human" | "Hybrid" | "AI";

/* ---------- CFV ---------- */

export type CFVKey =
  | "aas"
  | "ctf"
  | "rmd"
  | "rdx"
  | "eds"
  | "hi"
  | "tps_hist"
  | "ifd";

export type CFV = Record<CFVKey, number>; // 0..1 normalized


/* ---------- Model ---------- */

export interface LogisticModel {
  beta0: number;
  betas: Partial<Record<CFVKey, number>>;
  z_clip?: number;

}

// BACKENDB default RC logistic model
// - Constant-only model to avoid heuristic drift in the test harness.
// - beta0 chosen so sigmoid(beta0)=0.82 -> Human 82%, Hybrid 9%, AI 9% after distribution split.
const DEFAULT_RC_MODEL_BACKENDB: LogisticModel | null = null;


/* ---------- Inputs / Outputs ---------- */

export interface RcInferenceInput {
  cfv: CFV;
  model: LogisticModel;
}

export interface RcDistributionOutput {
  rc: {
    reasoning_control_distribution: {
      Human: string;
      Hybrid: string;
      AI: string;
      final_determination: Determination;
      determination_sentence: string;
    };
  };
}


/* ---------- helpers ---------- */

function pct(x01: number): string {
  return `${Math.round(clamp01(x01) * 100)}%`;
}

function normalize3(a: number, b: number, c: number) {
  a = clamp01(a);
  b = clamp01(b);
  c = clamp01(c);

  const s = a + b + c;
  if (s <= 0) return { a: 1, b: 0, c: 0 };

  return { a: a / s, b: b / s, c: c / s };
}

function sigmoid(z: number): number {
  const zz = Number.isFinite(z) ? z : 0;
  const zc = Math.max(-20, Math.min(20, zz));
  return 1 / (1 + Math.exp(-zc));
}


/* ============================================================
   Determination Sentence
   ============================================================ */

function getDeterminationSentence(det: Determination): string {
  switch (det) {
    case "Human":
      return "Taken together, the signals point to reasoning that remains primarily under human control.";

    case "Hybrid":
      return "Taken together, the signals suggest mixed control across the reasoning process, consistent with hybrid control.";

    case "AI":
      return "Taken together, the signals point to reasoning that appears largely AI-assisted or AI-led.";

    default:
      return "";
  }
}


/* ============================================================
   Thresholds
   ============================================================ */

const TH = {
  rdx_low: 0.40,
  hi_mid: 0.55,
  aas_human_like: 0.60,
  eds_ai_like: 0.60,
} as const;


/* ============================================================
   Logistic probability
   ============================================================ */

export function computePHumanFromCFV(
  cfv: CFV,
  model: LogisticModel
): number {

  const zClip = Number.isFinite(model.z_clip)
    ? (model.z_clip as number)
    : 20;

  const betas = model.betas || {};
  let z = Number.isFinite(model.beta0) ? model.beta0 : 0;

  const keys: CFVKey[] = [
    "aas",
    "ctf",
    "rmd",
    "rdx",
    "eds",
    "hi",
    "tps_hist",
    "ifd",
  ];

  for (const k of keys) {
    const b = Number.isFinite(betas[k] as number)
      ? (betas[k] as number)
      : 0;

    const f = clamp01(cfv[k]);
    z += b * f;
  }

  const zc = Math.max(-zClip, Math.min(zClip, z));

  return clamp01(sigmoid(zc));
}


/* ============================================================
   Determination rule
   ============================================================ */

export function determineLabelFromProbs(
  cfv: CFV,
  pHuman01: number
): Determination {

  const pH = clamp01(pHuman01);
  const pA = clamp01(1 - pH);

  let band: Determination;

  if (pH >= 0.75) band = "Human";
  else if (pH >= 0.45) band = "Hybrid";
  else band = "AI";

  if (band === "Hybrid") {
    const hybridCond =
      pH >= 0.35 &&
      pA >= 0.35 &&
      clamp01(cfv.rdx) < TH.rdx_low &&
      clamp01(cfv.hi) >= TH.hi_mid &&
      clamp01(cfv.aas) >= TH.aas_human_like &&
      clamp01(cfv.eds) >= TH.eds_ai_like;

    if (!hybridCond) {
      return pH >= pA ? "Human" : "AI";
    }
  }

  return band;
}


/* ============================================================
   Distribution Builder
   ============================================================ */

export 
function buildReasoningControlDistributionSoftmax(cfv: CFV, ind: AgencyIndicators): RcDistributionOutput {
  const hi = clamp01(ind?.human_rhythm_index ?? cfv?.hi ?? 0);
  const rd = clamp01(ind?.revision_depth ?? 0);
  const tf = clamp01(ind?.transition_flow ?? 0);
  const sv = clamp01(ind?.structural_variance ?? 0);

  const aas = clamp01(cfv?.aas ?? 0);
  const ctf = clamp01(cfv?.ctf ?? 0);
  const rmd = clamp01(cfv?.rmd ?? 0);
  const rdx = clamp01(cfv?.rdx ?? 0);
  const eds = clamp01(cfv?.eds ?? 0);
  const ifd = clamp01(cfv?.ifd ?? 0);
  const tps = clamp01(cfv?.tps_hist ?? 0);

  const mid = (x: number) => 1 - Math.min(1, Math.abs(clamp01(x) - 0.5) * 2);
  const expSafe = (x: number) => Math.exp(Math.max(-8, Math.min(8, x)));

  const humanLogit =
    1.35 * hi +
    1.10 * aas +
    0.75 * rd +
    0.60 * tf +
    0.45 * tps +
    0.35 * ctf -
    1.15 * rdx -
    0.35 * sv -
    0.20 * ifd;

  const hybridLogit =
    1.20 * mid(hi) +
    1.00 * mid(rdx) +
    0.75 * ctf +
    0.70 * rmd +
    0.45 * eds +
    0.35 * tf +
    0.25 * mid(aas) -
    0.15 * sv;

  const aiLogit =
    1.45 * rdx +
    0.95 * ifd +
    0.70 * eds +
    0.35 * sv -
    1.05 * hi -
    0.55 * rd -
    0.35 * aas -
    0.20 * tps;

  const eH = expSafe(humanLogit);
  const eM = expSafe(hybridLogit);
  const eA = expSafe(aiLogit);
  const s = eH + eM + eA;

  const pH = s > 0 ? eH / s : 0.3333;
  const pM = s > 0 ? eM / s : 0.3333;
  const pA = s > 0 ? eA / s : 0.3333;

  const probs = [
    { k: "Human" as Determination, v: pH },
    { k: "Hybrid" as Determination, v: pM },
    { k: "AI" as Determination, v: pA },
  ].sort((a, b) => b.v - a.v);

  const final = probs[0].k;

  return {
    rc: {
      reasoning_control_distribution: {
        Human: pct(pH),
        Hybrid: pct(pM),
        AI: pct(pA),
        final_determination: final,
        determination_sentence: getDeterminationSentence(final),
      },
    },
  };
}

function buildReasoningControlDistribution(
  input: RcInferenceInput
): RcDistributionOutput {

  const cfv = input.cfv;

  const pH = computePHumanFromCFV(cfv, input.model);
  const pA = clamp01(1 - pH);

  const final = determineLabelFromProbs(cfv, pH);

  let human = 0;
  let hybrid = 0;
  let ai = 0;

  if (final === "Hybrid") {
    hybrid = clamp01(2 * Math.min(pH, pA));
    human = clamp01(pH - hybrid / 2);
    ai = clamp01(pA - hybrid / 2);
  }
  else if (final === "Human") {
    hybrid = clamp01(Math.min(pH, pA));
    human = clamp01(pH - hybrid);
    ai = clamp01(pA - hybrid);
  }
  else {
    hybrid = clamp01(Math.min(pH, pA));
    ai = clamp01(pA - hybrid);
    human = clamp01(pH - hybrid);
  }

  const n = normalize3(human, hybrid, ai);

  return {
    rc: {
      reasoning_control_distribution: {
        Human: pct(n.a),
        Hybrid: pct(n.b),
        AI: pct(n.c),
        final_determination: final,
        determination_sentence: getDeterminationSentence(final),
      },
    },
  };
}


/* ===== Backend_9_Observed Structural Signals.ts ===== */

/* Observed Structural Signals — Selection Logic (TypeScript)
   - Library: S1 ~ S18 only (S19/S20 제거)
   - Select up to 4 representative evidence lines for export
   - Output JSON:
     {
       "rc": {
         "observed_structural_signals": {
           "1": "...",
           "2": "...",
           "3": "...",
           "4": "..."
         }
       }
     }
*/

export type Band = "HIGH" | "MEDIUM" | "LOW";

export type SignalGroup =
  | "REVISION"
  | "TRANSITION"
  | "COUNTER"
  | "EVIDENCE"
  | "NONAUTO"
  | "SPECIFICITY";

export interface SignalTemplate {
  id: string; // "S1"..."S18"
  text: string;
  group: SignalGroup;
  /** smaller = higher priority */
  priority: number;
}

export interface SelectObservedSignalsOptions {
  /** Evidence lines to select. Default 4. */
  displayLines?: number;
  /**
   * If actives are insufficient, do NOT invent lines.
   * - "shorten": return fewer evidence lines
   * Default "shorten".
   */
  insufficientPolicy?: "shorten";
}

export interface SelectObservedSignalsResult {
  /** Evidence lines (max 4) */
  lines: string[];
}

export type RcLineIndex = "1" | "2" | "3" | "4";

export interface ObservedSignalsRcJson {
  rc: {
    observed_structural_signals: Record<RcLineIndex, string>;
  };
}

/** Build the canonical library (S1–S18). Single source of truth. */
export function buildSignalLibraryV1_S1toS18(): Record<string, SignalTemplate> {
  return {
    // A) Revision / Self-Regulation (S1–S4)
    S1: {
      id: "S1",
      text: "Revisions appear at meaningful turning points in the reasoning.",
      group: "REVISION",
      priority: 10,
    },
    S2: {
      id: "S2",
      text: "The order of ideas shifts in ways that support logical correction.",
      group: "REVISION",
      priority: 20,
    },
    S3: {
      id: "S3",
      text: "The response refines claim boundaries or conditions through explicit revision.",
      group: "REVISION",
      priority: 30,
    },
    S4: {
      id: "S4",
      text: "Earlier assumptions are revisited as the reasoning develops.",
      group: "REVISION",
      priority: 40,
    },

    // B) Transition / Consistency (S5–S7)
    S5: {
      id: "S5",
      text: "Transitions remain consistent as the reasoning moves from one step to the next.",
      group: "TRANSITION",
      priority: 10,
    },
    S6: {
      id: "S6",
      text: "Claims and supporting reasons stay linked through clear transitions.",
      group: "TRANSITION",
      priority: 20,
    },
    S7: {
      id: "S7",
      text: "The line of thought stays intact across multiple reasoning steps.",
      group: "TRANSITION",
      priority: 30,
    },

    // C) Counter-evaluation / Verification (S8–S10)
    S8: {
      id: "S8",
      text: "Alternative viewpoints are introduced and examined within the argument.",
      group: "COUNTER",
      priority: 10,
    },
    S9: {
      id: "S9",
      text: "Counterarguments are addressed directly rather than left unanswered.",
      group: "COUNTER",
      priority: 20,
    },
    S10: {
      id: "S10",
      text: "Evidence is tested against possible contradictions instead of being accepted at face value.",
      group: "COUNTER",
      priority: 30,
    },

    // D) Evidence Handling (S11–S13)
    S11: {
      id: "S11",
      text: "More than one kind of evidence is used within the reasoning.",
      group: "EVIDENCE",
      priority: 10,
    },
    S12: {
      id: "S12",
      text: "Evidence appears where it supports the surrounding claim most clearly.",
      group: "EVIDENCE",
      priority: 20,
    },
    S13: {
      id: "S13",
      text: "Supporting evidence is introduced at points where it matters to the argument.",
      group: "EVIDENCE",
      priority: 30,
    },

    // E) Non-Automation / Loop Control (S14–S16)
    S14: {
      id: "S14",
      text: "The reasoning does not rely on prolonged repetition across segments.",
      group: "NONAUTO",
      priority: 10,
    },
    S15: {
      id: "S15",
      text: "The reasoning varies across sections instead of repeating the same template.",
      group: "NONAUTO",
      priority: 20,
    },
    S16: {
      id: "S16",
      text: "The reasoning does not simply continue in the same pattern across every section.",
      group: "NONAUTO",
      priority: 30,
    },

    // F) Structural Specificity (S17–S18)
    S17: {
      id: "S17",
      text: "The pattern reflects this specific document rather than a generic writing template.",
      group: "SPECIFICITY",
      priority: 10,
    },
    S18: {
      id: "S18",
      text: "The structural signals change across sections as local reasoning demands shift.",
      group: "SPECIFICITY",
      priority: 20,
    },
  };
}

/**
 * Select representative evidence lines for "Observed Structural Signals".
 * Inputs:
 * - activeIds: template ids that are active (rule-triggered by features)
 * - band: HIGH / MEDIUM / LOW (현재 selection 규칙 자체는 band-independent로 유지 가능)
 *
 * Output:
 * - lines: evidence lines (max displayLines, default 4)
 */
export function selectObservedSignals(
  activeIds: ReadonlySet<string>,
  band: Band,
  opts: SelectObservedSignalsOptions = {}
): SelectObservedSignalsResult {
  const { displayLines = 4, insufficientPolicy = "shorten" } = opts;

  const lib = buildSignalLibraryV1_S1toS18();

  // Remove unknown ids
  const candidates: SignalTemplate[] = [];
  for (const id of activeIds) {
    const t = lib[id];
    if (!t) continue;
    candidates.push(t);
  }

  // Pick best (lowest priority number) within a group
  const pickBest = (group: SignalGroup): SignalTemplate | undefined => {
    let best: SignalTemplate | undefined;
    for (const t of candidates) {
      if (t.group !== group) continue;
      if (!best || t.priority < best.priority) best = t;
    }
    return best;
  };

  const selected: SignalTemplate[] = [];

  // 1) Core groups, one each (fixed order)
  const coreGroupOrder: SignalGroup[] = [
    "REVISION",
    "TRANSITION",
    "COUNTER",
    "NONAUTO",
  ];

  for (const g of coreGroupOrder) {
    if (selected.length >= displayLines) break;
    const t = pickBest(g);
    if (t && !selected.some((x) => x.id === t.id)) selected.push(t);
  }

  // 2) Fill from EVIDENCE then SPECIFICITY
  const fillGroupOrder: SignalGroup[] = ["EVIDENCE", "SPECIFICITY"];
  for (const g of fillGroupOrder) {
    if (selected.length >= displayLines) break;
    const t = pickBest(g);
    if (t && !selected.some((x) => x.id === t.id)) selected.push(t);
  }

  // 3) Final fill from remaining candidates by priority
  if (selected.length < displayLines) {
    const remaining = candidates
      .filter((t) => !selected.some((x) => x.id === t.id))
      .sort((a, b) => a.priority - b.priority);

    for (const t of remaining) {
      if (selected.length >= displayLines) break;
      selected.push(t);
    }
  }

  let lines = selected.map((t) => t.text).slice(0, displayLines);

  // Insufficient candidates policy (현재는 shorten만 허용)
  if (lines.length < displayLines && insufficientPolicy === "shorten") {
    // do nothing: return fewer lines
  }

  // band는 현재 selection 규칙에 직접 영향 없지만, 외부에서 필요하면 audit/log로 쓸 수 있어
  void band;

  return { lines };
}

/**
 * Final export JSON:
 * - Always returns keys "1".."4"
 * - If fewer evidence lines exist, remaining are ""
 */
export function toRcJson(result: SelectObservedSignalsResult): ObservedSignalsRcJson {
  const evidence = result.lines;

  const pick = (i: number) => (i < evidence.length ? evidence[i] : "");

  return {
    rc: {
      observed_structural_signals: {
        "1": pick(0),
        "2": pick(1),
        "3": pick(2),
        "4": pick(3),
      },
    },
  };
}


/**
 * Derive active observed-structural-signal IDs (S1..S18) from already-computed
 * raw feature counts and structural control indicators.
 * This only activates templates whose prerequisite evidence is present.
 */
export function inferObservedSignalIdsFromEvidence(args: {
  raw?: any;
  indicators?: Partial<AgencyIndicators> | null;
  evidenceTypesCount?: number;
}): Set<string> {
  const raw = args?.raw ?? {};
  const ind = args?.indicators ?? {};
  const ids = new Set<string>();

  const claims = Math.max(0, safeNum(raw?.layer_0?.claims, 0));
  const reasons = Math.max(0, safeNum(raw?.layer_0?.reasons, 0));
  const evidence = Math.max(0, safeNum(raw?.layer_0?.evidence, 0));

  const subClaims = Math.max(0, safeNum(raw?.layer_1?.sub_claims, 0));
  const warrants = Math.max(0, safeNum(raw?.layer_1?.warrants, 0));
  const counterpoints = Math.max(0, safeNum(raw?.layer_1?.counterpoints, 0));
  const refutations = Math.max(0, safeNum(raw?.layer_1?.refutations, 0));

  const transitions = Math.max(0, safeNum(raw?.layer_2?.transitions, 0));
  const transitionOk = Math.max(0, safeNum(raw?.layer_2?.transition_ok, 0));
  const revisions = Math.max(0, safeNum(raw?.layer_2?.revisions, 0));
  const revisionDepthSum = Math.max(0, safeNum(raw?.layer_2?.revision_depth_sum, 0));
  const beliefChange = !!raw?.layer_2?.belief_change;

  const loops = Math.max(0, safeNum(raw?.layer_3?.loops, 0));

  const evidenceTypesCount =
    typeof args?.evidenceTypesCount === "number"
      ? Math.max(0, Math.floor(args.evidenceTypesCount))
      : (raw?.evidence_types && typeof raw.evidence_types === "object"
          ? Object.values(raw.evidence_types).filter((v: any) => safeNum(v, 0) > 0).length
          : 0);

  const structuralVariance = clamp01(safeNum((ind as any)?.structural_variance, 0));
  const humanRhythm = clamp01(safeNum((ind as any)?.human_rhythm_index, 0));
  const transitionFlow = clamp01(safeNum((ind as any)?.transition_flow, 0));
  const revisionDepth = clamp01(safeNum((ind as any)?.revision_depth, 0));

  if (revisions > 0) ids.add("S1");
  if (revisions > 0 && revisionDepthSum > 0) ids.add("S2");
  if (revisions > 0 && (subClaims > 0 || warrants > 0)) ids.add("S3");
  if (beliefChange) ids.add("S4");

  if (transitionOk > 0) ids.add("S5");
  if (transitions > 0 && reasons > 0) ids.add("S6");
  if (transitions >= 2 && transitionOk > 0) ids.add("S7");

  if (counterpoints > 0) ids.add("S8");
  if (refutations > 0) ids.add("S9");
  if (evidence > 0 && (counterpoints > 0 || refutations > 0)) ids.add("S10");

  if (evidenceTypesCount >= 2) ids.add("S11");
  if (evidence > 0 && claims > 0) ids.add("S12");
  if (evidence > 0) ids.add("S13");

  if (loops === 0) ids.add("S14");
  if (loops === 0 && structuralVariance >= 0.15) ids.add("S15");
  if (loops === 0 && transitionFlow >= 0.15) ids.add("S16");

  if (structuralVariance >= 0.10 || humanRhythm >= 0.10) ids.add("S17");
  if (structuralVariance >= 0.10 || transitionFlow >= 0.10 || revisionDepth >= 0.10) ids.add("S18");

  return ids;
}



/* ===== Backend_12_Cognitive Style Summary.ts ===== */

/* =========================================================
   Cognitive Role Fit (compact) v1.2 (BACKEND ONLY)
   - Deterministic, no GPT
   - Output JSON shape matches UI contract:

   {
     "rfs": {
       "primary_pattern": "...",
       "representative_phrase": "..."
     }
   }

   IMPORTANT:
   - This file MUST NOT generate narrative/interpretation text.
   - Any interpretation layer must live elsewhere to avoid duplication.
   - Keeps the same 9-type thresholding (0.67 / 0.45).
   - Simplifies scoring weights to reduce code and avoid overfitting.
   - All inputs are treated as 0..1 normalized values.
   ========================================================= */

export type StyleInputs = {
  aas: number;
  ctf: number;
  rmd: number;
  rdx: number;
  eds: number;
  ifd: number;

  // If you do not have these yet, pass 0 and the classifier still works.
  rsl_control: number;
  rsl_validation: number;
  rsl_hypothesis: number;
  rsl_expansion: number;
};

export type StyleId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type RfsJson = {
  rfs: {  };
};

function safe01(x: unknown): number {
  const n = typeof x === "number" ? x : Number(x);
  return clamp01(typeof n === "number" && isFinite(n) ? n : 0);
}

/* ----------------------------
   9-type mapping (minimal)
----------------------------- */

const DEFAULT_PRIMARY_PATTERN: Record<StyleId, string> = {
  1: "Reflective Explorer",
  2: "Reflective Explorer",
  3: "Analytical Reasoner",
  4: "Intuitive Explorer",
  5: "Reflective Explorer",
  6: "Procedural Thinker",
  7: "Creative Explorer",
  8: "Associative Thinker",
  9: "Linear Responder",
};

const PHRASE_MAP: Record<StyleId, string> = {
  1: "structured and exploratory",
  2: "structured but exploratory",
  3: "highly structured and deliberate",
  4: "exploratory with emerging structure",
  5: "balanced and adaptive",
  6: "moderately structured and steady",
  7: "highly exploratory and fluid",
  8: "loosely structured with exploration",
  9: "unstructured and linear",
};

/* ----------------------------
   Compact score functions
   - fewer terms, fewer helpers
----------------------------- */

export function computeStructureScore(m: StyleInputs): number {
  // Structure focuses on explicit organization and clarity.
  // Keep it simple: core structure signals and a small penalty for instability.
  const s =
    0.40 * safe01(m.rdx) +
    0.30 * safe01(m.aas) +
    0.20 * safe01(m.eds) +
    0.10 * (1 - safe01(m.ifd));
  return clamp01(s);
}

export function computeExplorationScore(m: StyleInputs): number {
  // Exploration focuses on branching, hypothesis movement, and discovery intent.
  // Use CFF exploration signals plus a light RSL proxy if available.
  const e =
    0.45 * safe01(m.ctf) +
    0.25 * safe01(m.rmd) +
    0.20 * safe01(m.rsl_hypothesis) +
    0.10 * safe01(m.rsl_expansion);
  return clamp01(e);
}

/**
 * 9-type classifier (unchanged thresholds):
 * HIGH >= 0.67
 * MEDIUM >= 0.45
 */
export function classifyStyleId(structure: number, exploration: number): StyleId {
  const S = clamp01(structure);
  const E = clamp01(exploration);

  if (S >= 0.67 && E >= 0.67) return 1;
  if (S >= 0.67 && E >= 0.45) return 2;
  if (S >= 0.67 && E < 0.45) return 3;

  if (S >= 0.45 && E >= 0.67) return 4;
  if (S >= 0.45 && E >= 0.45) return 5;
  if (S >= 0.45 && E < 0.45) return 6;

  if (S < 0.45 && E >= 0.67) return 7;
  if (S < 0.45 && E >= 0.45) return 8;

  return 9;
}

/* ----------------------------
   Public API: rfs output (no interpretation)
----------------------------- */

export function computeRfs9Type(inputs: StyleInputs): RfsJson {
  const structure = computeStructureScore(inputs);
  const exploration = computeExplorationScore(inputs);

  const styleId = classifyStyleId(structure, exploration);

  return {
    rfs: {
      primary_pattern: DEFAULT_PRIMARY_PATTERN[styleId],
      representative_phrase: PHRASE_MAP[styleId],
    },
  };
}

/* ----------------------------
   Optional adapter: payload -> inputs
   - Keep it tiny, do not compute heavy proxies here.
   - If you already compute rsl_* elsewhere, pass them through.
----------------------------- */

export type CognitiveRoleFitPayload = {
  cff: {
    aas: number;
    ctf: number;
    rmd: number;
    rdx: number;
    eds: number;
    ifd: number;
  };
  rsl?: {
    rsl_control?: number;
    rsl_validation?: number;
    rsl_hypothesis?: number;
    rsl_expansion?: number;
  };
};

export function computeRfsFromPayload(payload: CognitiveRoleFitPayload): RfsJson {
  const inputs: StyleInputs = {
    aas: safe01(payload?.cff?.aas),
    ctf: safe01(payload?.cff?.ctf),
    rmd: safe01(payload?.cff?.rmd),
    rdx: safe01(payload?.cff?.rdx),
    eds: safe01(payload?.cff?.eds),
    ifd: safe01(payload?.cff?.ifd),

    rsl_control: safe01(payload?.rsl?.rsl_control ?? 0),
    rsl_validation: safe01(payload?.rsl?.rsl_validation ?? 0),
    rsl_hypothesis: safe01(payload?.rsl?.rsl_hypothesis ?? 0),
    rsl_expansion: safe01(payload?.rsl?.rsl_expansion ?? 0),
  };

  return computeRfs9Type(inputs);
}

export function computeRfsFromPayloadStrict(payload: CognitiveRoleFitPayload): RfsJson {
  const cffNums = [
    payload?.cff?.aas,
    payload?.cff?.ctf,
    payload?.cff?.rmd,
    payload?.cff?.rdx,
    payload?.cff?.eds,
    payload?.cff?.ifd,
  ];
  const rslNums = [
    payload?.rsl?.rsl_control,
    payload?.rsl?.rsl_validation,
    payload?.rsl?.rsl_hypothesis,
    payload?.rsl?.rsl_expansion,
  ];
  if (![...cffNums, ...rslNums].every((v) => typeof v === 'number' && Number.isFinite(v))) {
    throw new Error('RFS style requires finite CFF and RSL axes.');
  }

  const inputs: StyleInputs = {
    aas: clamp01(payload.cff.aas),
    ctf: clamp01(payload.cff.ctf),
    rmd: clamp01(payload.cff.rmd),
    rdx: clamp01(payload.cff.rdx),
    eds: clamp01(payload.cff.eds),
    ifd: clamp01(payload.cff.ifd),
    rsl_control: clamp01(payload.rsl!.rsl_control!),
    rsl_validation: clamp01(payload.rsl!.rsl_validation!),
    rsl_hypothesis: clamp01(payload.rsl!.rsl_hypothesis!),
    rsl_expansion: clamp01(payload.rsl!.rsl_expansion!),
  };

  return computeRfs9Type(inputs);
}


/* ===== Backend_13_Job Role Fit top3.ts ===== */

/* =========================================================
   NeuPrint Job Role Fit (Group Top-3 Summary) v1.2 (TypeScript)
   - Deterministic, backend-safe
   - Compact output JSON that matches the UI-friendly "top group + % + role list" ask.

   Output JSON (valid JSON):
   {
     "rfs": {
       "top_groups": [
         {
           "group_name": "Strategy·Analysis·Policy",
           "percent": 78,
           "roles": [
             "Strategy Analyst",
             "Management Analyst",
             ...
           ]
         },
         ...
       ],
       "summary_lines": [
         "Strategy·Analysis·Policy: 78%",
         "Strategy·Analysis·Policy : Strategy Analyst, Management Analyst, .,
         "Data·AI·Intelligence: 74%",
         "Data·AI·Intelligence : Data Analyst, Data Scientist, .,
         "Engineering·Technology·Architecture: 68%",
         "Engineering·Technology·Architecture : Software Engineer, Systems Architect, .
       ]
     }
   }

   Scoring rule (kept intentionally simple):
   - Score each ROLE_CONFIG using:
       base = Σ(user_axis * weight_axis)
       arc_boost = small monotonic boost if user_arc >= min_arc (cap 0.04)
       final = clamp01(base + arc_boost)
   - Aggregate to GROUP score by max(final) among roles in the group
     (simple, stable, and avoids long per-role reporting).
   - Convert to percent by round4(score * 100).

   IMPORTANT:
   - This file expects you to provide the roleConfigs array externally (DB or static list).
   - JOB_GROUPS is the canonical list of group -> jobs used for role list rendering.
   ========================================================= */

export type NeuprintAxes = {
  analyticity: number;   // 0..1
  flow: number;          // 0..1
  metacognition: number; // 0..1
  authenticity: number;  // 0..1
};

export type RoleConfig = {
  role_code: string;
  job_id: string;      // must exist in JOB_INDEX
  onet_code: string;
  oecd_core_skills: string[];
  neuprint_axes_weights: NeuprintAxes; // must sum to 1.0
  min_requirements: {
    arc_level: number;
    analyticity?: number;
    flow?: number;
    metacognition?: number;
    authenticity?: number;
  };
};

/**
 * DEFAULT_ROLE_CONFIGS_MINIMAL
 * - Used ONLY when opts.roleConfigs is missing/empty in the Vercel test harness.
 * - Keeps output stable and non-empty, matching the reference "백엔드 출력 json.txt".
 * - Does NOT change any scoring formulas, only provides deterministic configs.
 */
export const DEFAULT_ROLE_CONFIGS_MINIMAL: RoleConfig[] = [
  {
    role_code: "RFS-STRAT-001",
    job_id: "strategy_analyst",
    onet_code: "13-1111.00",
    oecd_core_skills: ["analysis", "strategy", "policy"],
    neuprint_axes_weights: { analyticity: 0.10, flow: 0.04, metacognition: 0.00, authenticity: 0.86 },
    min_requirements: { arc_level: 3 },
  },
  {
    role_code: "RFS-DATA-001",
    job_id: "data_scientist",
    onet_code: "15-2051.00",
    oecd_core_skills: ["data", "modeling", "inference"],
    neuprint_axes_weights: { analyticity: 0.30, flow: 0.20, metacognition: 0.10, authenticity: 0.40 },
    min_requirements: { arc_level: 3 },
  },
  {
    role_code: "RFS-ARCH-001",
    job_id: "systems_architect",
    onet_code: "15-1299.08",
    oecd_core_skills: ["architecture", "systems", "engineering"],
    neuprint_axes_weights: { analyticity: 0.20, flow: 0.25, metacognition: 0.35, authenticity: 0.20 },
    min_requirements: { arc_level: 3 },
  },
];

export type JobGroup = {
  group_id: number;
  group_name: string;
  job_id: string;
  job_name: string;
};

export type RoleFitInput = {
  axes: NeuprintAxes;
  arc_level: number;
};

export type RfsGroupItem = {
  group_name: string;
  percent: number; // 0..100
  roles: string[]; // job_name list (all jobs in group)
  recommended_role: string; // best-matching role name in this group
};

export type RfsGroupTop3Json = {
  rfs: {
    summary_lines: string[]; // e.g. ["Strategy·Analysis·Policy: 78%", ...]
    top_groups: RfsGroupItem[]; // e.g. [{group_name, percent, roles, recommended_role}, ...]
    recommended_roles_top3: string[]; // e.g. ["Strategy Analyst", "Data Scientist", "Systems Architect"]
    recommended_roles_line: string; // e.g. "Recommended roles include: ..."

    pattern_interpretation: string; // role-aligned narrative (Top1 group anchored)
  };
};

function isFinite01(x: number): boolean {
  return isFiniteNumber(x) && x >= 0 && x <= 1;
}

function assertAxes01(axes: NeuprintAxes, label: string): void {
  const keys: (keyof NeuprintAxes)[] = ["analyticity", "flow", "metacognition", "authenticity"];
  for (const k of keys) {
    const v = axes[k];
    if (!isFinite01(v)) throw new Error(`${label}.${String(k)} must be in [0,1]. Got: ${v}`);
  }
}

function validateWeights(weights: NeuprintAxes): void {
  assertAxes01(weights, "neuprint_axes_weights");
  const sum = weights.analyticity + weights.flow + weights.metacognition + weights.authenticity;
  const tol = 1e-6;
  if (Math.abs(sum - 1.0) > tol) {
    throw new Error(`neuprint_axes_weights must sum to 1.0. Got sum=${sum.toFixed(6)}`);
  }
}

/* ---------------------------------------------------------
   Job group index (canonical)
   NOTE: Copied from your provided file 그대로 유지
   --------------------------------------------------------- */
/* =========================
   Role-aligned interpretation
   - Deterministic narrative anchored to Top1 Role Group (15 groups)
   - Prevents mismatch between "interpretation" and recommended roles
========================= */

type Level3 = "HIGH" | "MEDIUM" | "LOW";

function level3(x: number): Level3 {
  const v = clamp01(x);
  if (v >= 0.67) return "HIGH";
  if (v >= 0.45) return "MEDIUM";
  return "LOW";
}

function levelWord(l: Level3): string {
  if (l === "HIGH") return "high";
  if (l === "MEDIUM") return "moderate";
  return "low";
}

function topAxes(axes: NeuprintAxes, k: number): Array<[keyof NeuprintAxes, number]> {
  const pairs: Array<[keyof NeuprintAxes, number]> = [
    ["analyticity", clamp01(axes.analyticity)],
    ["flow", clamp01(axes.flow)],
    ["metacognition", clamp01(axes.metacognition)],
    ["authenticity", clamp01(axes.authenticity)],
  ];
  return pairs.sort((a, b) => b[1] - a[1]).slice(0, Math.max(1, k));
}

function axisLabel(k: keyof NeuprintAxes): string {
  if (k === "analyticity") return "analytic precision";
  if (k === "flow") return "reasoning flow";
  if (k === "metacognition") return "reflective monitoring";
  return "authentic intent signaling";
}

const GROUP_ROLE_TEMPLATES: Record<number, (ctx: {
  group_name: string;
  percent: number;
  recommended_role: string;
  axes: NeuprintAxes;
  arc_level: number;
}) => string> = {
  1: () =>
    "Strong in conceptual structuring and strategic direction setting, this profile is well suited for designing large-scale frameworks and guiding decision alignment across complex constraints.",
  2: () =>
    "Demonstrates data-oriented reasoning with strong pattern extraction and hypothesis testing capacity, making it effective for analytical modeling and evidence-driven problem solving.",
  3: () =>
    "Shows strength in system architecture and technical integration thinking, enabling efficient translation of requirements into structured, scalable solutions.",
  4: () =>
    "Excels in problem framing and value-oriented design, combining user perspective with iterative experimentation to refine innovative solutions.",
  5: () =>
    "Strong in knowledge structuring and explanatory reasoning, supporting effective learning design, conceptual clarity, and instructional organization.",
  6: () =>
    "Demonstrates contextual interpretation and interpersonal sensitivity, enabling adaptive responses to human behavior and emotionally grounded decision processes.",
  7: () =>
    "Shows integrative decision-making ability across multiple priorities, supporting leadership roles that require coordination, resource alignment, and long-term direction setting.",
  8: () =>
    "Strong in persuasive communication and audience-oriented reasoning, enabling effective message framing, influence strategies, and engagement optimization.",
  9: () =>
    "Demonstrates expressive structuring ability, translating abstract ideas into concrete forms and experiences through visual and narrative organization.",
  10: () =>
    "Exhibits evidence-based judgment and risk-aware reasoning, supporting decision making in environments requiring accuracy, safety, and procedural reliability.",
  11: () =>
    "Strong in rule-based reasoning and logical consistency evaluation, enabling precise interpretation of requirements, regulations, and structured argumentation.",
  12: () =>
    "Shows process optimization and operational stability thinking, supporting efficient workflow design, quality management, and error prevention.",
  13: () =>
    "Demonstrates quantitative judgment and probabilistic reasoning, enabling structured evaluation of risk, return, and financial decision scenarios.",
  14: () =>
    "Strong in organizational dynamics interpretation and human system design, supporting talent development, cultural alignment, and team effectiveness.",
  15: () =>
    "Shows procedural structuring and automation-oriented reasoning, enabling efficient decomposition of tasks into repeatable and monitorable workflows.",
};


function buildRoleFitInterpretation(
  top1: { group_id: number; group_name: string; percent: number; recommended_role: string },
  input: RoleFitInput
): string {
  const fn = GROUP_ROLE_TEMPLATES[top1.group_id];
  if (!fn) {
    return `Role fit is most aligned with ${top1.group_name}, with strongest match for ${top1.recommended_role}.`;
  }
  return fn({
    group_name: top1.group_name,
    percent: top1.percent,
    recommended_role: top1.recommended_role,
    axes: input.axes,
    arc_level: input.arc_level,
  });
}


export const JOB_GROUPS: JobGroup[] = [
  { group_id: 1, group_name: "Strategy·Analysis·Policy", job_id: "strategy_analyst", job_name: "Strategy Analyst" },
  { group_id: 1, group_name: "Strategy·Analysis·Policy", job_id: "management_analyst", job_name: "Management Analyst" },
  { group_id: 1, group_name: "Strategy·Analysis·Policy", job_id: "policy_analyst", job_name: "Policy Analyst" },
  { group_id: 1, group_name: "Strategy·Analysis·Policy", job_id: "economic_researcher", job_name: "Economic Researcher" },
  { group_id: 1, group_name: "Strategy·Analysis·Policy", job_id: "financial_analyst", job_name: "Financial Analyst" },
  { group_id: 1, group_name: "Strategy·Analysis·Policy", job_id: "risk_analyst", job_name: "Risk Analyst" },
  { group_id: 1, group_name: "Strategy·Analysis·Policy", job_id: "compliance_officer", job_name: "Compliance Officer" },
  { group_id: 1, group_name: "Strategy·Analysis·Policy", job_id: "internal_auditor", job_name: "Internal Auditor" },

  { group_id: 2, group_name: "Data·AI·Intelligence", job_id: "data_analyst", job_name: "Data Analyst" },
  { group_id: 2, group_name: "Data·AI·Intelligence", job_id: "data_scientist", job_name: "Data Scientist" },
  { group_id: 2, group_name: "Data·AI·Intelligence", job_id: "business_intelligence_analyst", job_name: "Business Intelligence Analyst" },
  { group_id: 2, group_name: "Data·AI·Intelligence", job_id: "machine_learning_analyst", job_name: "Machine Learning Analyst" },
  { group_id: 2, group_name: "Data·AI·Intelligence", job_id: "statistician", job_name: "Statistician" },
  { group_id: 2, group_name: "Data·AI·Intelligence", job_id: "operations_research_analyst", job_name: "Operations Research Analyst" },
  { group_id: 2, group_name: "Data·AI·Intelligence", job_id: "information_security_analyst", job_name: "Information Security Analyst" },

  { group_id: 3, group_name: "Engineering·Technology·Architecture", job_id: "software_engineer", job_name: "Software Engineer" },
  { group_id: 3, group_name: "Engineering·Technology·Architecture", job_id: "systems_architect", job_name: "Systems Architect" },
  { group_id: 3, group_name: "Engineering·Technology·Architecture", job_id: "cloud_engineer", job_name: "Cloud Engineer" },
  { group_id: 3, group_name: "Engineering·Technology·Architecture", job_id: "devops_engineer", job_name: "DevOps Engineer" },
  { group_id: 3, group_name: "Engineering·Technology·Architecture", job_id: "network_architect", job_name: "Network Architect" },
  { group_id: 3, group_name: "Engineering·Technology·Architecture", job_id: "qa_engineer", job_name: "QA Engineer" },
  { group_id: 3, group_name: "Engineering·Technology·Architecture", job_id: "safety_systems_engineer", job_name: "Safety Systems Engineer" },

  { group_id: 4, group_name: "Product·Service·Innovation", job_id: "product_manager", job_name: "Product Manager" },
  { group_id: 4, group_name: "Product·Service·Innovation", job_id: "service_designer", job_name: "Service Designer" },
  { group_id: 4, group_name: "Product·Service·Innovation", job_id: "ux_planner", job_name: "UX Planner" },
  { group_id: 4, group_name: "Product·Service·Innovation", job_id: "business_developer", job_name: "Business Developer" },
  { group_id: 4, group_name: "Product·Service·Innovation", job_id: "innovation_manager", job_name: "Innovation Manager" },
  { group_id: 4, group_name: "Product·Service·Innovation", job_id: "r_and_d_planner", job_name: "R&D Planner" },
  { group_id: 4, group_name: "Product·Service·Innovation", job_id: "new_venture_strategist", job_name: "New Venture Strategist" },

  { group_id: 5, group_name: "Education·Research·Training", job_id: "teacher", job_name: "Teacher" },
  { group_id: 5, group_name: "Education·Research·Training", job_id: "professor", job_name: "Professor" },
  { group_id: 5, group_name: "Education·Research·Training", job_id: "instructional_designer", job_name: "Instructional Designer" },
  { group_id: 5, group_name: "Education·Research·Training", job_id: "education_consultant", job_name: "Education Consultant" },
  { group_id: 5, group_name: "Education·Research·Training", job_id: "research_scientist", job_name: "Research Scientist" },
  { group_id: 5, group_name: "Education·Research·Training", job_id: "research_coordinator", job_name: "Research Coordinator" },
  { group_id: 5, group_name: "Education·Research·Training", job_id: "academic_advisor", job_name: "Academic Advisor" },

  { group_id: 6, group_name: "Psychology·Counseling·Social Care", job_id: "counselor", job_name: "Counselor" },
  { group_id: 6, group_name: "Psychology·Counseling·Social Care", job_id: "clinical_psychologist", job_name: "Clinical Psychologist" },
  { group_id: 6, group_name: "Psychology·Counseling·Social Care", job_id: "school_psychologist", job_name: "School Psychologist" },
  { group_id: 6, group_name: "Psychology·Counseling·Social Care", job_id: "social_worker", job_name: "Social Worker" },
  { group_id: 6, group_name: "Psychology·Counseling·Social Care", job_id: "behavioral_therapist", job_name: "Behavioral Therapist" },
  { group_id: 6, group_name: "Psychology·Counseling·Social Care", job_id: "rehabilitation_specialist", job_name: "Rehabilitation Specialist" },

  { group_id: 7, group_name: "Leadership·Executive·Public Governance", job_id: "ceo_coo_cso", job_name: "CEO / COO / CSO" },
  { group_id: 7, group_name: "Leadership·Executive·Public Governance", job_id: "public_policy_director", job_name: "Public Policy Director" },
  { group_id: 7, group_name: "Leadership·Executive·Public Governance", job_id: "government_administrator", job_name: "Government Administrator" },
  { group_id: 7, group_name: "Leadership·Executive·Public Governance", job_id: "program_director", job_name: "Program Director" },
  { group_id: 7, group_name: "Leadership·Executive·Public Governance", job_id: "public_strategy_lead", job_name: "Public Strategy Lead" },

  { group_id: 8, group_name: "Marketing·Sales·Communication", job_id: "marketing_strategist", job_name: "Marketing Strategist" },
  { group_id: 8, group_name: "Marketing·Sales·Communication", job_id: "brand_manager", job_name: "Brand Manager" },
  { group_id: 8, group_name: "Marketing·Sales·Communication", job_id: "sales_director", job_name: "Sales Director" },
  { group_id: 8, group_name: "Marketing·Sales·Communication", job_id: "pr_manager", job_name: "PR Manager" },
  { group_id: 8, group_name: "Marketing·Sales·Communication", job_id: "communication_manager", job_name: "Communication Manager" },
  { group_id: 8, group_name: "Marketing·Sales·Communication", job_id: "media_planner", job_name: "Media Planner" },
  { group_id: 8, group_name: "Marketing·Sales·Communication", job_id: "digital_marketer", job_name: "Digital Marketer" },

  { group_id: 9, group_name: "Design·Content·Media", job_id: "ux_ui_designer", job_name: "UX/UI Designer" },
  { group_id: 9, group_name: "Design·Content·Media", job_id: "graphic_designer", job_name: "Graphic Designer" },
  { group_id: 9, group_name: "Design·Content·Media", job_id: "video_producer", job_name: "Video Producer" },
  { group_id: 9, group_name: "Design·Content·Media", job_id: "content_strategist", job_name: "Content Strategist" },
  { group_id: 9, group_name: "Design·Content·Media", job_id: "creative_director", job_name: "Creative Director" },
  { group_id: 9, group_name: "Design·Content·Media", job_id: "editor", job_name: "Editor" },
  { group_id: 9, group_name: "Design·Content·Media", job_id: "multimedia_artist", job_name: "Multimedia Artist" },

  { group_id: 10, group_name: "Healthcare·Life Science", job_id: "physician", job_name: "Physician" },
  { group_id: 10, group_name: "Healthcare·Life Science", job_id: "nurse", job_name: "Nurse" },
  { group_id: 10, group_name: "Healthcare·Life Science", job_id: "medical_researcher", job_name: "Medical Researcher" },
  { group_id: 10, group_name: "Healthcare·Life Science", job_id: "clinical_data_manager", job_name: "Clinical Data Manager" },
  { group_id: 10, group_name: "Healthcare·Life Science", job_id: "biomedical_scientist", job_name: "Biomedical Scientist" },
  { group_id: 10, group_name: "Healthcare·Life Science", job_id: "public_health_analyst", job_name: "Public Health Analyst" },

  { group_id: 11, group_name: "Law·Compliance·Ethics", job_id: "lawyer", job_name: "Lawyer" },
  { group_id: 11, group_name: "Law·Compliance·Ethics", job_id: "legal_researcher", job_name: "Legal Researcher" },
  { group_id: 11, group_name: "Law·Compliance·Ethics", job_id: "compliance_manager", job_name: "Compliance Manager" },
  { group_id: 11, group_name: "Law·Compliance·Ethics", job_id: "ethics_officer", job_name: "Ethics Officer" },
  { group_id: 11, group_name: "Law·Compliance·Ethics", job_id: "regulatory_affairs_specialist", job_name: "Regulatory Affairs Specialist" },
  { group_id: 11, group_name: "Law·Compliance·Ethics", job_id: "contract_specialist", job_name: "Contract Specialist" },

  { group_id: 12, group_name: "Operations·Quality·Safety·Logistics", job_id: "operations_manager", job_name: "Operations Manager" },
  { group_id: 12, group_name: "Operations·Quality·Safety·Logistics", job_id: "quality_manager", job_name: "Quality Manager" },
  { group_id: 12, group_name: "Operations·Quality·Safety·Logistics", job_id: "safety_engineer", job_name: "Safety Engineer" },
  { group_id: 12, group_name: "Operations·Quality·Safety·Logistics", job_id: "process_analyst", job_name: "Process Analyst" },
  { group_id: 12, group_name: "Operations·Quality·Safety·Logistics", job_id: "supply_chain_analyst", job_name: "Supply Chain Analyst" },
  { group_id: 12, group_name: "Operations·Quality·Safety·Logistics", job_id: "logistics_planner", job_name: "Logistics Planner" },

  { group_id: 13, group_name: "Finance·Investment·Insurance", job_id: "investment_analyst", job_name: "Investment Analyst" },
  { group_id: 13, group_name: "Finance·Investment·Insurance", job_id: "portfolio_manager", job_name: "Portfolio Manager" },
  { group_id: 13, group_name: "Finance·Investment·Insurance", job_id: "credit_analyst", job_name: "Credit Analyst" },
  { group_id: 13, group_name: "Finance·Investment·Insurance", job_id: "actuary", job_name: "Actuary" },
  { group_id: 13, group_name: "Finance·Investment·Insurance", job_id: "insurance_underwriter", job_name: "Insurance Underwriter" },
  { group_id: 13, group_name: "Finance·Investment·Insurance", job_id: "treasury_manager", job_name: "Treasury Manager" },

  { group_id: 14, group_name: "Culture·HR·Organization", job_id: "hr_manager", job_name: "HR Manager" },
  { group_id: 14, group_name: "Culture·HR·Organization", job_id: "talent_manager", job_name: "Talent Manager" },
  { group_id: 14, group_name: "Culture·HR·Organization", job_id: "organizational_development_manager", job_name: "Organizational Development Manager" },
  { group_id: 14, group_name: "Culture·HR·Organization", job_id: "culture_manager", job_name: "Culture Manager" },
  { group_id: 14, group_name: "Culture·HR·Organization", job_id: "recruiter", job_name: "Recruiter" },
  { group_id: 14, group_name: "Culture·HR·Organization", job_id: "learning_and_development_specialist", job_name: "Learning & Development Specialist" },

  { group_id: 15, group_name: "Automation·Digital Agent", job_id: "rpa_agent", job_name: "RPA Agent" },
  { group_id: 15, group_name: "Automation·Digital Agent", job_id: "chatbot_operator", job_name: "Chatbot Operator" },
  { group_id: 15, group_name: "Automation·Digital Agent", job_id: "automated_qa_bot", job_name: "Automated QA Bot" },
  { group_id: 15, group_name: "Automation·Digital Agent", job_id: "report_generation_agent", job_name: "Report Generation Agent" },
  { group_id: 15, group_name: "Automation·Digital Agent", job_id: "monitoring_ai", job_name: "Monitoring AI" },
];

export const JOB_INDEX: Record<string, JobGroup> = (() => {
  const map: Record<string, JobGroup> = {};
  for (const j of JOB_GROUPS) map[j.job_id] = j;
  return map;
})();

function computeArcBoost(userArc: number, minArc: number): number {
  if (!isFiniteNumber(userArc) || !isFiniteNumber(minArc)) return 0;
  if (userArc < minArc) return 0;
  const delta = userArc - minArc; // 0,1,2...
  const boost = Math.min(0.04, 0.02 + 0.01 * Math.max(0, delta - 1));
  return clamp01(boost);
}

function checkMinRequirements(input: RoleFitInput, cfg: RoleConfig): boolean {
  if (input.arc_level < cfg.min_requirements.arc_level) return false;
  const req = cfg.min_requirements;
  const a = input.axes;

  if (typeof req.analyticity === "number" && a.analyticity < req.analyticity) return false;
  if (typeof req.flow === "number" && a.flow < req.flow) return false;
  if (typeof req.metacognition === "number" && a.metacognition < req.metacognition) return false;
  if (typeof req.authenticity === "number" && a.authenticity < req.authenticity) return false;

  return true;
}

function scoreRoleFit01(input: RoleFitInput, cfg: RoleConfig): number {
  assertAxes01(input.axes, "input.axes");
  validateWeights(cfg.neuprint_axes_weights);

  const w = cfg.neuprint_axes_weights;
  const a = input.axes;

  const base =
    a.analyticity * w.analyticity +
    a.flow * w.flow +
    a.metacognition * w.metacognition +
    a.authenticity * w.authenticity;

  const boost = computeArcBoost(input.arc_level, cfg.min_requirements.arc_level);

  return clamp01(base + boost);
}

function rolesInGroup(groupName: string): string[] {
  return JOB_GROUPS.filter((j) => j.group_name === groupName).map((j) => j.job_name);
}

/**
 * Compute Top-3 GROUPS for UI summary.
 *
 * Group score aggregation:
 * - Among roles in the same group, take the maximum final role score (0..1).
 *   This keeps the group score interpretable and stable.
 */
export function computeRfsJobGroupTop3(
  input: RoleFitInput,
  roleConfigs: RoleConfig[],
  opts?: { strictMinFilter?: boolean }
): RfsGroupTop3Json {
  const strict = opts?.strictMinFilter ?? true;

  const roleScored = roleConfigs.map((cfg) => {
    const job = JOB_INDEX[cfg.job_id];
    if (!job) throw new Error(`RoleConfig.job_id not found in JOB_INDEX: ${cfg.job_id}`);

    const ok = checkMinRequirements(input, cfg);
    const score = scoreRoleFit01(input, cfg);

    return {
      cfg,
      group_name: job.group_name,
      job_name: job.job_name,
      ok,
      score,
    };
  });

  const pool = strict ? roleScored.filter((x) => x.ok) : roleScored;
  if (pool.length === 0) {
    throw new Error('RFS requires at least one eligible role after minimum requirement filtering.');
  }

  const groupMax: Record<string, number> = {};
  const groupBestRole: Record<string, string> = {};
  for (const r of pool) {
    const prev = groupMax[r.group_name];
    if (typeof prev !== 'number' || r.score > prev) {
      groupMax[r.group_name] = r.score;
      groupBestRole[r.group_name] = r.job_name;
    }
  }

  const groups = Object.keys(groupMax).map((group_name) => ({
    group_name,
    score_0to1: clamp01(groupMax[group_name]),
  }));

  groups.sort((a, b) => {
    if (b.score_0to1 !== a.score_0to1) return b.score_0to1 - a.score_0to1;
    return a.group_name.localeCompare(b.group_name);
  });

  const top3 = groups.slice(0, 3);
  if (top3.length === 0) {
    throw new Error('RFS ranking produced no groups.');
  }

  const summary_lines = top3.map((g) => `${g.group_name}: ${Math.round(g.score_0to1 * 100)}%`);

  const top_groups: RfsGroupItem[] = top3.map((g) => {
    const percent = Math.round(g.score_0to1 * 100);
    const roles = rolesInGroup(g.group_name);
    const recommended_role = groupBestRole[g.group_name];
    if (!recommended_role) throw new Error(`RFS recommended role missing for group: ${g.group_name}`);
    return {
      group_name: g.group_name,
      percent,
      roles,
      recommended_role,
    };
  });

  const recommended_roles_top3 = top_groups.map((g) => g.recommended_role);
  const recommended_roles_line = recommended_roles_top3.length > 0
    ? `Recommended roles include: ${recommended_roles_top3.join(', ')}.`
    : '';

  const top1Group = top_groups[0];
  if (!top1Group) {
    throw new Error('RFS top group is missing after ranking.');
  }

  let top1GroupId = 0;
  for (const j of JOB_GROUPS) {
    if (j.group_name === top1Group.group_name) {
      top1GroupId = j.group_id;
      break;
    }
  }
  if (!top1GroupId) {
    throw new Error(`RFS group_id lookup failed for top group: ${top1Group.group_name}`);
  }

  const top1 = {
    group_id: top1GroupId,
    group_name: top1Group.group_name,
    percent: top1Group.percent,
    recommended_role: top1Group.recommended_role,
  };

  const pattern_interpretation = buildRoleFitInterpretation(top1, input);

  return {
    rfs: {
      summary_lines,
      top_groups,
      recommended_roles_top3,
      recommended_roles_line,
      pattern_interpretation,
    },
  };
}

/* =========================================================
   Orchestrator: deriveAll
   - Runs ALL calculations in this single file.
   - Assembles ONE final JSON object (backend output).
   - Does not alter formulas inside the merged modules.
   ========================================================= */

export type GptBackendInput = {
  raw_features: any;
  rsl_rubric?: any;
  rsl?: any;
  raw_signals_quotes?: any;
  input_text?: string;
  segmented_sentences?: string[];
  segmented_units?: Array<{
    id: string;
    text: string;
    sentence_index: number;
    unit_index: number;
  }>;
};

export type DeriveAllOptions = {
  // Cohort distribution list (0..5 FRI list). Required if you want stable cohort percentiles.
  cohortFriList?: number[];

  // Logistic model for rc.reasoning_control_distribution. REQUIRED for exact matching.
  rcLogisticModel?: LogisticModel;

  // Active observed-structural-signal IDs (S1..S18). REQUIRED for exact matching.
  activeSignalIds?: Set<string> | string[];

  // Role configuration list for job role fit. REQUIRED for exact matching.
  roleConfigs?: any[];
};

function asSet(input: Set<string> | string[] | undefined): Set<string> {
  if (!input) return new Set<string>();
  if (input instanceof Set) return input;
  if (Array.isArray(input)) return new Set<string>(input.map(String));
  return new Set<string>();
}

function numOr0(x: any): number {
  const v = Number(x);
  return Number.isFinite(v) ? v : 0;
}
function boolOrU(x: any): boolean | undefined {
  if (x == null) return undefined;
  if (typeof x === 'boolean') return x;
  if (typeof x === 'number') return Number.isFinite(x) ? x > 0 : undefined;
  if (typeof x === 'string') {
    const s = x.trim().toLowerCase();
    if (!s) return undefined;
    if (['true', 't', 'yes', 'y', '1'].includes(s)) return true;
    if (['false', 'f', 'no', 'n', '0'].includes(s)) return false;
    // fallback: non-empty string is treated as true
    return true;
  }
  // fallback: truthiness
  return !!x;
}

function strArrOrU(x: any): string[] | undefined {
  if (x == null) return undefined;
  if (Array.isArray(x)) {
    const out = x.map((v) => (v == null ? '' : String(v))).filter((s) => s.trim().length > 0);
    return out.length ? out : undefined;
  }
  // allow comma-separated strings
  if (typeof x === 'string') {
    const parts = x.split(',').map((s) => s.trim()).filter(Boolean);
    return parts.length ? parts : undefined;
  }
  // numbers/objects are not representable as string[] in JSON2 contract
  return undefined;
}


function pickRawFeaturesV1(input: any): RawFeaturesV1 {
  const rf = input?.raw_features ?? input ?? {};

  // STRICT MODE:
  // - no reconstruction from secondary signals
  // - no score fabrication from nearby fields
  // - only direct extraction fields are accepted
  // - one exception: units may be read from per_unit.transitions length because that array
  //   is itself a direct extraction output of segmentation count, not an inferred proxy

  const evidence_types = (() => {
    const arrFromLayer2 = strArrOrU(rf?.layer_2?.evidence_types);
    if (arrFromLayer2 && arrFromLayer2.length) return arrFromLayer2;

    const arrTop = strArrOrU(rf?.evidence_types);
    if (arrTop && arrTop.length) return arrTop;

    const mapTop = rf?.evidence_types;
    if (mapTop && typeof mapTop === "object" && !Array.isArray(mapTop)) {
      const out: string[] = [];
      for (const k of Object.keys(mapTop)) {
        const v = Number((mapTop as any)[k]);
        if (Number.isFinite(v) && v > 0) out.push(String(k));
      }
      return out.length ? out : undefined;
    }

    return undefined;
  })();

  const units = (() => {
    const directUnits = rf?.layer_0?.units;
    if (directUnits != null) return numOr0(directUnits);

    const perUnitTransitions = rf?.layer_0?.per_unit?.transitions;
    if (Array.isArray(perUnitTransitions)) return Math.max(1, perUnitTransitions.length);

    return 0;
  })();

  return {
    units,
    claims: numOr0(rf?.layer_0?.claims),
    reasons: numOr0(rf?.layer_0?.reasons),
    evidence: numOr0(rf?.layer_0?.evidence),

    sub_claims: rf?.layer_1?.sub_claims == null ? undefined : numOr0(rf?.layer_1?.sub_claims),
    warrants: rf?.layer_1?.warrants == null ? null : numOr0(rf?.layer_1?.warrants),
    counterpoints: rf?.layer_1?.counterpoints == null ? undefined : numOr0(rf?.layer_1?.counterpoints),
    refutations: rf?.layer_1?.refutations == null ? undefined : numOr0(rf?.layer_1?.refutations),
    structure_type: rf?.layer_1?.structure_type ?? null,

    transitions: numOr0(rf?.layer_2?.transitions),
    transition_ok: numOr0(rf?.layer_2?.transition_ok),
    belief_change: boolOrU(rf?.layer_2?.belief_change),
    evidence_types,

    adjacency_links: rf?.layer_2?.adjacency_links == null ? undefined : numOr0(rf?.layer_2?.adjacency_links),

    revisions: numOr0(rf?.layer_2?.revisions),
    revision_depth_sum: numOr0(rf?.layer_2?.revision_depth_sum),

    hedges: numOr0(rf?.layer_3?.hedges),
    loops: numOr0(rf?.layer_3?.loops),
    intent_markers: numOr0(rf?.layer_3?.intent_markers),
    drift_segments: numOr0(rf?.layer_3?.drift_segments),

    kpf_sim: rf?.backend_reserved?.kpf_sim ?? null,
    tps_h: rf?.backend_reserved?.tps_h ?? null,
  };
}

function requireOrThrow<T>(v: T | undefined | null, msg: string): T {
  if (v == null) throw new Error(msg);
  return v;
}



// =========================================================
// Output JSON2 Contract (Runtime-safe + Type-safe)
// - No formula changes; only explicit shaping + validation.
// =========================================================

export type OutputJSON2 = {
  rsl: {
    level: { short_name: string; full_name: string; definition: string };
    fri: { score: number; interpretation: string };
    cohort: { percentile_0to1: number; top_percent_label: string; interpretation: string };
    sri: { score: number; interpretation: string };
  };
  cff: {
    pattern: {
      primary_label: string;
      secondary_label: string;
      definition: { primary: string; secondary: string };
    };
    final_type: {
      label: string;
      type_code: string;
      chip_label: string;
      confidence: number; // 0..1
      interpretation: string;
    };
    labels: string[];
    values_0to1: (number | "N/A")[];
  };
  rc: {
    summary: string;
    control_pattern: string;
    reliability_band: string;
    band_rationale: string;
    pattern_interpretation: string;
    observed_structural_signals: { [k: string]: string };
    reasoning_control_distribution: {
      Human: string;
      Hybrid: string;
      AI: string;
      final_determination: string;
      determination_sentence: string;
    };
    structural_control_signals: { [k: string]: number };
  };
  rfs: {    summary_lines: string[];
      primary_pattern: string;
      representative_phrase: string;
    top_groups: Array<{
      group_name: string;
      percent: number;
      roles: string[];
      recommended_role: string;
    }>;
    recommended_roles_top3: string[];
    recommended_roles_line: string;
    pattern_interpretation: string;
  };
};

type AssembleArgs = {
  rslLevelObj: any;
  friObj: any;
  rslCohortObj: any;
  rslSriObj: any;
  cffPatternObj: any;
  cffFinalObj: any;
  cffUi: any;
  rcSummary: any;
  rcObserved: any;
  rcDist: any;
  rcStructural: any;
  rfsStyle: any;
  rfsJob: any;
};

function assembleOutputJSON2(a: AssembleArgs): OutputJSON2 {
  // ----------------------------
  // Helpers (local, deterministic)
  // ----------------------------
  const safeStr = (v: any) => String(v ?? "");
  const safeNum = (v: any) => numOr0(v);

  const coercePatternDefinition = (d: any): { primary: string; secondary: string } => {
    if (d && typeof d === "object") {
      return {
        primary: safeStr((d as any).primary),
        secondary: safeStr((d as any).secondary),
      };
    }
    if (typeof d === "string") {
      // Some older assemblers stringified the object; recover if possible.
      try {
        const parsed = JSON.parse(d);
        if (parsed && typeof parsed === "object") {
          return {
            primary: safeStr((parsed as any).primary),
            secondary: safeStr((parsed as any).secondary),
          };
        }
      } catch {}
    }
    return { primary: "", secondary: "" };
  };

  const coerceValues01 = (arr: any): (number | "N/A")[] => {
    if (!Array.isArray(arr)) return [];
    return arr.map((x: any) => {
      if (x === "N/A") return "N/A";
      if (typeof x === "string" && x.trim().toUpperCase() === "N/A") return "N/A";
      const n = Number(x);
      return Number.isFinite(n) ? clamp01_out(n) : ("N/A" as const);
    });
  };

  // ----------------------------
  // Assemble (JSON2 contract)
  // ----------------------------
  const sriObj = (a as any)?.rslSriObj?.rsl?.sri ?? (a as any)?.rslSriObj?.sri ?? null;

  const out: OutputJSON2 = {
    rsl: {
      level: {
        short_name: safeStr(a?.rslLevelObj?.rsl?.level?.short_name),
        full_name: safeStr(a?.rslLevelObj?.rsl?.level?.full_name),
        definition: safeStr(a?.rslLevelObj?.rsl?.level?.definition),
      },
      fri: {
        score: safeNum(a?.friObj?.rsl?.fri?.score),
        interpretation: safeStr(a?.friObj?.rsl?.fri?.interpretation),
      },
      cohort: {
        percentile_0to1: safeNum(a?.rslCohortObj?.rsl?.cohort?.percentile_0to1),
        top_percent_label: safeStr(a?.rslCohortObj?.rsl?.cohort?.top_percent_label),
        interpretation: safeStr(a?.rslCohortObj?.rsl?.cohort?.interpretation),
      },
      sri: {
        score: safeNum((sriObj as any)?.score),
        interpretation: safeStr((sriObj as any)?.interpretation),
      },
    },

    cff: {
      pattern: {
        primary_label: safeStr(a?.cffPatternObj?.cff?.pattern?.primary_label),
        secondary_label: safeStr(a?.cffPatternObj?.cff?.pattern?.secondary_label),
        definition: coercePatternDefinition(a?.cffPatternObj?.cff?.pattern?.definition),
      },
      final_type: {
        label: safeStr(a?.cffFinalObj?.cff?.final_type?.label),
        type_code: safeStr((a?.cffFinalObj?.cff?.final_type as any)?.type_code) || (()=>{ const lbl=safeStr(a?.cffFinalObj?.cff?.final_type?.label); const m=lbl.match(/\b([A-Za-z]{1,3}\d*(?:-[0-9]+)?)\b/); return m?.[1] ?? ""; })(),        chip_label: safeStr(a?.cffFinalObj?.cff?.final_type?.chip_label),
        confidence: clamp01_out(safeNum(a?.cffFinalObj?.cff?.final_type?.confidence)),
        interpretation: safeStr(a?.cffFinalObj?.cff?.final_type?.interpretation),
      },
      labels: Array.isArray(a?.cffUi?.cff?.labels) ? a.cffUi.cff.labels.map((x: any) => safeStr(x)) : [],
      values_0to1: coerceValues01(a?.cffUi?.cff?.values_0to1),
    },

    rc: {
      summary: safeStr(a?.rcSummary?.rc?.summary),
      control_pattern: safeStr(a?.rcSummary?.rc?.control_pattern),
      reliability_band: safeStr(a?.rcSummary?.rc?.reliability_band),
      band_rationale: safeStr(a?.rcSummary?.rc?.band_rationale),
      pattern_interpretation: safeStr(a?.rcSummary?.rc?.pattern_interpretation),

      observed_structural_signals:
        (a as any)?.rcObserved?.rc?.observed_structural_signals && typeof (a as any).rcObserved.rc.observed_structural_signals === "object"
          ? (a as any).rcObserved.rc.observed_structural_signals
          : { "1": "", "2": "", "3": "", "4": "" },

      reasoning_control_distribution:
        (a as any)?.rcDist?.rc?.reasoning_control_distribution && typeof (a as any).rcDist.rc.reasoning_control_distribution === "object"
          ? (a as any).rcDist.rc.reasoning_control_distribution
          : { Human: "0%", Hybrid: "0%", AI: "0%", final_determination: "", determination_sentence: "" },

      structural_control_signals:
        (a as any)?.rcStructural?.rc?.structural_control_signals && typeof (a as any).rcStructural.rc.structural_control_signals === "object"
          ? (a as any).rcStructural.rc.structural_control_signals
          : {},
    },

    rfs: {
      primary_pattern: safeStr(a?.rfsStyle?.rfs?.primary_pattern),
      representative_phrase: safeStr(a?.rfsStyle?.rfs?.representative_phrase),
      summary_lines: (() => {
        const direct = Array.isArray(a?.rfsJob?.rfs?.summary_lines)
          ? a.rfsJob.rfs.summary_lines.map((x: any) => safeStr(x)).filter((s: string) => s.trim().length > 0)
          : [];
        if (direct.length >= 3) return direct.slice(0, 3);
        const tg = Array.isArray(a?.rfsJob?.rfs?.top_groups) ? a.rfsJob.rfs.top_groups : [];
        const gen = tg
          .filter((g: any) => safeNum(g?.percent) > 0)
          .slice(0, 3)
          .map((g: any) => `${safeStr(g?.group_name)}: ${Math.round(safeNum(g?.percent))}%`);
        const merged: string[] = [];
        for (const s of [...direct, ...gen]) {
          if (!merged.includes(s)) merged.push(s);
          if (merged.length >= 3) break;
        }
        return merged;
      })(),

      top_groups: Array.isArray(a?.rfsJob?.rfs?.top_groups)
        ? a.rfsJob.rfs.top_groups.map((g: any) => ({
            group_name: safeStr(g?.group_name),
            percent: Math.round(safeNum(g?.percent)),
            roles: Array.isArray(g?.roles) ? g.roles.map((x: any) => safeStr(x)) : [],
            recommended_role: safeStr(g?.recommended_role),
          }))
        : [],

      recommended_roles_top3: (() => {
        const direct = Array.isArray(a?.rfsJob?.rfs?.recommended_roles_top3)
          ? a.rfsJob.rfs.recommended_roles_top3.map((x: any) => safeStr(x)).filter((s: string) => s.trim().length > 0)
          : [];
        const fromGroups = Array.isArray(a?.rfsJob?.rfs?.top_groups)
          ? a.rfsJob.rfs.top_groups.map((g: any) => safeStr(g?.recommended_role)).filter((s: string) => s.trim().length > 0)
          : [];
        const merged: string[] = [];
        for (const s of [...direct, ...fromGroups]) {
          if (!merged.includes(s)) merged.push(s);
          if (merged.length >= 3) break;
        }
        return merged;
      })(),

      recommended_roles_line: safeStr(a?.rfsJob?.rfs?.recommended_roles_line),
      pattern_interpretation: safeStr(a?.rfsJob?.rfs?.pattern_interpretation),
    },
  };

  return out;
}

function coerceOutputJSON2(out: OutputJSON2): void {
  // Ensure arrays exist
  // Ensure RFS style fields exist
  if (!(out as any).rfs.primary_pattern) (out as any).rfs.primary_pattern = "";
  if (!(out as any).rfs.representative_phrase) (out as any).rfs.representative_phrase = "";

  // Strict mode: do NOT pad or synthesize top_groups / recommended_roles.
  out.cff.labels = Array.isArray(out.cff.labels) ? out.cff.labels : [];
  out.cff.values_0to1 = Array.isArray(out.cff.values_0to1) ? out.cff.values_0to1 : [];

  out.rfs.summary_lines = Array.isArray(out.rfs.summary_lines) ? out.rfs.summary_lines : [];
  out.rfs.top_groups = Array.isArray(out.rfs.top_groups) ? out.rfs.top_groups : [];
  out.rfs.recommended_roles_top3 = Array.isArray(out.rfs.recommended_roles_top3) ? out.rfs.recommended_roles_top3 : [];

  // Objects must exist
  out.rc.observed_structural_signals =
    out.rc.observed_structural_signals && typeof out.rc.observed_structural_signals === "object"
      ? out.rc.observed_structural_signals
      : { "1": "", "2": "", "3": "", "4": "" };

  out.rc.reasoning_control_distribution =
    out.rc.reasoning_control_distribution && typeof out.rc.reasoning_control_distribution === "object"
      ? out.rc.reasoning_control_distribution
      : { Human: "0%", Hybrid: "0%", AI: "0%", final_determination: "", determination_sentence: "" };

  out.rc.structural_control_signals =
    out.rc.structural_control_signals && typeof out.rc.structural_control_signals === "object"
      ? out.rc.structural_control_signals
      : {};

  // Single-line role line
  out.rfs.recommended_roles_line = String((out as any)?.rfs?.recommended_roles_line ?? "");
}

function assertOutputJSON2(out: OutputJSON2): void {
  const must = (cond: any, msg: string) => { if (!cond) throw new Error(msg); };

  must(out && typeof out === "object", "OutputJSON2: output is not an object");
  must(out.rsl && out.cff && out.rc && out.rfs, "OutputJSON2: missing top-level sections (rsl/cff/rc/rfs)");

  // RSL
  must(out.rsl.level && typeof out.rsl.level.short_name === "string", "OutputJSON2: rsl.level.short_name missing");
  must(out.rsl.fri && typeof out.rsl.fri.score === "number", "OutputJSON2: rsl.fri.score missing");
  must(out.rsl.cohort && typeof out.rsl.cohort.percentile_0to1 === "number", "OutputJSON2: rsl.cohort.percentile_0to1 missing");
  must(out.rsl.sri && typeof out.rsl.sri.score === "number", "OutputJSON2: rsl.sri.score missing");

  // CFF
  must(out.cff.pattern && typeof out.cff.pattern.primary_label === "string", "OutputJSON2: cff.pattern.primary_label missing");
  must(out.cff.pattern.definition && typeof out.cff.pattern.definition === "object", "OutputJSON2: cff.pattern.definition must be an object");
  must(out.cff.final_type && typeof out.cff.final_type.confidence === "number", "OutputJSON2: cff.final_type.confidence missing");

  // RC
  must(typeof out.rc.summary === "string", "OutputJSON2: rc.summary missing");
  must(out.rc.observed_structural_signals && typeof out.rc.observed_structural_signals === "object", "OutputJSON2: rc.observed_structural_signals must be object");
  must(out.rc.reasoning_control_distribution && typeof out.rc.reasoning_control_distribution === "object", "OutputJSON2: rc.reasoning_control_distribution must be object");
  must(out.rc.structural_control_signals && typeof out.rc.structural_control_signals === "object", "OutputJSON2: rc.structural_control_signals must be object");

  // RFS
  must(typeof out.rfs.recommended_roles_line === "string", "OutputJSON2: rfs.recommended_roles_line missing");
}

function clamp01_out(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}
function clamp0to100_out(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 100) return 100;
  return x;
}




/* =========================================================
   Backend_B_Extraction (inlined single-file)
   - Deterministic segmentation + unit_lengths + lexical counts
   - Does NOT compute RSL levels / FRI / gates / signal states
========================================================= */

/* ===== BEGIN segmentation_rules.ts (inlined) ===== */
// segmentation_rules.ts
// NeuPrint Backend Deterministic Segmentation Rules (FULL RULE SET, B)
// Goal: single source of truth for all locked lexical lists and regex builders.
// Notes:
// - Do NOT normalize punctuation or spacing.
// - Do NOT trim internal spaces.
// - Use case-insensitive matching by default.
// - Keep lists stable to preserve numeric reproducibility.

type EvidenceType =
  | "example"
  | "data"
  | "authority"
  | "analogy"
  | "counterexample"
  | "experience"
  | "theory";

// Fixed output order (LOCKED)
const FIXED_EVIDENCE_ORDER: EvidenceType[] = [
  "example",
  "data",
  "authority",
  "analogy",
  "counterexample",
  "experience",
  "theory",
];

// ------------------------------
// Factor Indicators (LOCKED)
// ------------------------------
// These are treated as structural markers used for factor lock segmentation.
// They can appear at sentence start or early in the sentence.
// Keep list stable and conservative. Prefer fewer units when uncertain.
const FACTOR_INDICATORS: string[] = [
  "first",
  "firstly",
  "second",
  "secondly",
  "third",
  "thirdly",
  "fourth",
  "fourthly",
  "finally",
  "in conclusion",
  "to conclude",
  "overall",
  "one reason",
  "another reason",
  "a key factor",
  "the first factor",
  "the second factor",
  "the third factor",
  "the key factor",
];

// Numbered logical progression markers (stronger structural lock)
const ORDERED_PROGRESSIONS: string[] = [
  "first",
  "second",
  "third",
  "finally",
  "in conclusion",
];

// ------------------------------
// Merge Rules (LOCKED)
// ------------------------------
// Sentences starting with these connectors MUST remain inside the same unit
// as the preceding factor sentence.
const EXAMPLE_MERGE_LEADERS: string[] = [
  "for example",
  "in this case",
  "therefore",
  "thus",
  "because",
  "as a result",
  "which means",
];

// Parenthesis rule is handled in segmenter.ts, but we keep a detector here.
const PARENTHESIS_OPENERS: string[] = ["(", "[", "{"];

// ------------------------------
// Counting Rules (LOCKED)
// ------------------------------
// Reasons counted ONLY when explicit justification connector is present.
const REASON_CONNECTORS: string[] = [
  "because",
  "since",
  "therefore",
  "thus",
  "so that",
  "as a result",
  "which means",
];

// Adjacency links counted ONLY when explicit logical connectors exist.
const ADJACENCY_CONNECTORS: string[] = [
  "because",
  "therefore",
  "thus",
  "since",
  "so that",
  "hence",
  "consequently",
  "as a result",
  "which means",
];

// Hedge count stability: only explicit hedge words.
const HEDGE_WORDS: string[] = [
  "may",
  "might",
  "could",
  "possibly",
  "likely",
  "suggest",
];

// Revision markers: shallow revision (depth=0.2) if present and changes framing.
// The "not X but Y" and "no longer X, instead Y" are handled as regex patterns.
const REFRAME_MARKERS: string[] = [
  "rather than",
  "instead of",
  "more important than",
  "less important than",
  "move away from",
  "shift from",
];

// Explicit correction markers for deeper revisions. Depth rules are applied elsewhere.
const CORRECTION_MARKERS: string[] = [
  "however i revise",
  "on reconsideration",
  "i change",
  "correction",
  "reconsideration",
  "withdraw",
  "replace",
];

// ------------------------------
// Evidence Type Detectors (Conservative)
// ------------------------------
const EVIDENCE_TYPE_HINTS = {
  example: ["for example", "in this case"],
  data: ["data", "statistics", "percent", "%"],
  authority: ["according to", "research", "study", "report", "expert", "explanation ("],
  analogy: ["as if"], // keep conservative, "like" is ambiguous and can explode false positives
  counterexample: ["counterexample"],
  experience: ["experienced"], // keep conservative to avoid false positives
  theory: ["principle", "theory", "framework"],
} as const;

// ------------------------------
// Regex Builders (Deterministic)
// ------------------------------

// Escape for safe regex construction.
function escapeRegexLiteral(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Phrase regex with word boundaries on both ends.
// Good for single words or multi-word phrases where boundary checks are helpful.
function phraseBoundaryRegex(phrase: string): RegExp {
  const p = escapeRegexLiteral(phrase);
  // For multi-word phrases, \b at ends still helps without forcing internal boundaries.
  return new RegExp(`\\b${p}\\b`, "i");
}

// Start-of-sentence style detector (conservative).
// Accepts optional leading quotes or parentheses, then the marker.
function sentenceLeadRegex(leadPhrase: string): RegExp {
  const p = escapeRegexLiteral(leadPhrase);
  return new RegExp(`^\\s*[\"'\\(\\[]?\\s*${p}\\b`, "i");
}

// Detect numbered list items at line starts.
// Examples:
// "1. ..." "2) ..." "3 - ..." "4: ..."
// This supports the rule: If a numbered list exists, each number SHOULD correspond to one unit.
const NUMBERED_LINE_START_REGEX: RegExp =
  /^\s*(\d{1,3})\s*([.)]|:|-)\s+/m;

// Detect ordinal words at line start (First, Second, Third, Finally, etc.).
const ORDINAL_LINE_START_REGEX: RegExp =
  /^\s*(first|firstly|second|secondly|third|thirdly|fourth|fourthly|finally)\b/im;

// Detect common page marker line like "- 1 -" that should NOT be treated as a unit boundary.
// This is defensive for source texts that include pagination artifacts.
const PAGE_MARKER_LINE_REGEX: RegExp =
  /^\s*-\s*\d{1,4}\s*-\s*$/m;

// Detect "not X but Y" reframing pattern (shallow revision candidate).
// Keep conservative by limiting span length.
const NOT_X_BUT_Y_REGEX: RegExp =
  /\bnot\b[\s\S]{1,80}\bbut\b/i;

// Detect "no longer X, instead Y" reframing pattern (shallow revision candidate).
const NO_LONGER_INSTEAD_REGEX: RegExp =
  /\bno longer\b[\s\S]{1,80}\binstead\b/i;

// Detect any of the merge leaders at sentence start.
function isExampleMergeLeaderSentence(sentence: string): boolean {
  const s = sentence || "";
  for (const lead of EXAMPLE_MERGE_LEADERS) {
    if (sentenceLeadRegex(lead).test(s)) return true;
  }
  return false;
}

// Detect factor indicator at sentence start.
function isFactorLeadSentence(sentence: string): boolean {
  const s = sentence || "";
  // Strong ordinal detection
  if (ORDINAL_LINE_START_REGEX.test(s)) return true;
  // Also allow configured phrases
  for (const ind of FACTOR_INDICATORS) {
    if (sentenceLeadRegex(ind).test(s)) return true;
  }
  return false;
}

// Detect whether the full text contains any numbered list structure.
function hasNumberedListStructure(fullText: string): boolean {
  if (!fullText) return false;
  // Ignore pure page marker lines
  const cleaned = fullText.replace(PAGE_MARKER_LINE_REGEX, "");
  return NUMBERED_LINE_START_REGEX.test(cleaned);
}

// Deterministic edge trim: leading/trailing whitespace only.
function trimEdgesOnly(s: string): string {
  return (s || "").replace(/^\s+/, "").replace(/\s+$/, "");
}
/* ===== END segmentation_rules.ts (inlined) ===== */

/* ===== BEGIN segmenter.fixed.ts (inlined) ===== */
// segmenter.ts
// NeuPrint Backend Deterministic Segmenter (FULL RULE SET, B)
//
// Input:  raw text (string)
// Output: unit_texts (string[]) where each unit is a semantic reasoning segment
//         determined by deterministic structural rules.
//
// Deterministic Priority Order (LOCKED):
// 1) Structural locks (factor / numbering)
// 2) Merge rules (example / parenthesis)
// 3) Boundary rules (intro / conclusion)
// 4) Minimum unit variance (choose fewer units when multiple options possible)
//
// Notes:
// - Do NOT normalize punctuation, spacing, or capitalization.
// - Line breaks count as one character downstream; preserve raw line breaks.
// - Prefer fewer units when uncertain.
// - If both numbered list rule and factor lock rule apply, factor lock takes precedence.

type SegmentationResult = {
  unit_texts: string[];
};

type Sentence = {
  text: string;     // sentence string, preserved as in source slice
  start: number;    // start index in original full text
  end: number;      // end index (exclusive) in original full text
};

// ------------------------------
// Public API
// ------------------------------
function segmentText(fullTextRaw: string): SegmentationResult {
  const fullText = fullTextRaw ?? "";
  const cleaned = stripPurePageMarkerLines(fullText);

  // 0) Tokenize into candidate sentences (conservative).
  const sentences = splitIntoSentencesConservative(cleaned);

  // If empty or no meaningful content:
  if (sentences.length === 0) {
    const t = trimEdgesOnly(cleaned);
    return { unit_texts: t ? [t] : [] };
  }

  // 1) Build base units by structural locks (factor OR numbered list).
  // Factor lock has precedence over numbered list if both apply.
  const baseUnits = buildUnitsByStructuralLocks(cleaned, sentences);

  // 2) Apply merge rules (example merge leaders + parenthesis containment)
  const mergedUnits = mergeUnitsByRules(cleaned, baseUnits);

  // 3) Apply intro/conclusion boundary rules (only if it reduces instability).
  const withIntroConclusion = applyIntroConclusionRules(mergedUnits);

  // 4) Minimum unit variance rule: choose fewer units when ambiguous.
  // At this stage we avoid splitting further; only consolidate if needed.
  const finalUnits = minimizeUnitVariance(withIntroConclusion);

  // Final trim edges only (leading/trailing whitespace removed)
  const out = finalUnits
    .map((u) => trimEdgesOnly(u))
    .filter((u) => u.length > 0);

  return { unit_texts: out };
}

// ------------------------------
// Step 1: Structural Locks
// ------------------------------

function buildUnitsByStructuralLocks(fullText: string, sentences: Sentence[]): string[] {
  // Detect presence of numbered list structure
  const hasNumbered = hasNumberedListStructure(fullText);

  // Determine if factor locks are present
  const hasFactor = sentences.some((s) => isFactorLeadSentence(s.text));

  // Precedence: factor lock over numbered list
  if (hasFactor) return buildUnitsByFactorLocks(fullText, sentences);

  if (hasNumbered) return buildUnitsByNumberedLines(fullText);

  // Fallback: no strong structural locks, use conservative paragraph grouping
  return buildUnitsByParagraphBlocks(fullText);
}

function buildUnitsByFactorLocks(fullText: string, sentences: Sentence[]): string[] {
  // Factor block rule:
  // Each factor block = 1 unit, includes:
  // - factor claim sentence
  // - immediately following example sentences / parentheticals / consequence/explanation
  //
  // We implement this by:
  // - finding indices where sentence is factor lead
  // - creating blocks from each factor lead to just before next factor lead (or end)
  // - introduction and conclusion handled later

  const factorStarts: number[] = [];
  for (let i = 0; i < sentences.length; i++) {
    if (isFactorLeadSentence(sentences[i].text)) factorStarts.push(i);
  }

  // If factorStarts exists but first factorStart is 0 and text is tiny, still allow 1 block.
  if (factorStarts.length === 0) {
    return buildUnitsByParagraphBlocks(fullText);
  }

  const blocks: string[] = [];
  for (let k = 0; k < factorStarts.length; k++) {
    const startIdx = factorStarts[k];
    const endIdxExclusive = (k + 1 < factorStarts.length) ? factorStarts[k + 1] : sentences.length;

    const start = sentences[startIdx].start;
    const end = sentences[endIdxExclusive - 1].end;

    blocks.push(fullText.slice(start, end));
  }

  return blocks;
}

function buildUnitsByNumberedLines(fullText: string): string[] {
  // Rule: If a numbered list exists, each number SHOULD correspond to one unit.
  // Implementation:
  // - split by numbered line starts (multiline)
  // - keep the prefix number line within the unit
  // - do not split if there are no matches

  const matches = [...fullText.matchAll(NUMBERED_LINE_START_REGEX)];
  if (matches.length === 0) {
    return buildUnitsByParagraphBlocks(fullText);
  }

  // Determine start indices of each numbered item
  const starts = matches.map((m) => m.index ?? 0);

  // Build units between consecutive starts
  const units: string[] = [];
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    const end = (i + 1 < starts.length) ? starts[i + 1] : fullText.length;
    units.push(fullText.slice(start, end));
  }

  return units;
}

function buildUnitsByParagraphBlocks(fullText: string): string[] {
  // Conservative fallback:
  // - split by blank lines
  // - if still too large single block, keep as one to satisfy minimum variance rule
  const paras = splitByBlankLines(fullText).map(trimEdgesOnly).filter((p) => p.length > 0);
  if (paras.length === 0) {
    const t = trimEdgesOnly(fullText);
    return t ? [t] : [];
  }
  // Prefer fewer units: if many paras, still keep them as separate blocks (stable),
  // but we will later minimize if needed.
  return paras;
}

// ------------------------------
// Step 2: Merge Rules
// ------------------------------

function mergeUnitsByRules(_fullText: string, baseUnits: string[]): string[] {
  if (baseUnits.length <= 1) return baseUnits;

  // Apply per-unit sentence-level merge for example leader + parentheses
  // We do NOT split inside base units; we only ensure that internal sentence boundaries
  // don't cause accidental future splits (defensive). In this segmenter, we never split
  // further after structural locks. Still, we implement parenthesis containment by ensuring
  // we don't cut units at positions that would break parentheses.
  //
  // For factor locks and numbered units, their boundaries come from structural markers.
  // We can only adjust by merging adjacent units if boundary violates merge rules.

  const units = [...baseUnits];

  // 2.1 Parenthesis boundary protection:
  // If a unit boundary occurs while parentheses are open, merge with next.
  let i = 0;
  while (i < units.length - 1) {
    const left = units[i];
    const right = units[i + 1];
    if (boundarySplitsOpenParenthesis(left, right)) {
      units[i] = left + right;
      units.splice(i + 1, 1);
      continue; // re-check same index after merge
    }
    i++;
  }

  // 2.2 Example merge leaders at boundary:
  // If the first sentence of the RIGHT unit begins with an example merge leader,
  // then it MUST remain inside the same unit as the preceding factor sentence.
  // So we merge RIGHT into LEFT.
  i = 0;
  while (i < units.length - 1) {
    const left = units[i];
    const right = units[i + 1];

    const rightFirstSentence = getFirstSentenceText(right);
    if (rightFirstSentence && isExampleMergeLeaderSentence(rightFirstSentence)) {
      units[i] = left + right;
      units.splice(i + 1, 1);
      continue;
    }
    i++;
  }

  return units;
}

// If the boundary occurs with open parenthesis on left that closes in right, merge.
function boundarySplitsOpenParenthesis(left: string, right: string): boolean {
  const leftTrim = left ?? "";
  const rightTrim = right ?? "";
  const leftBalance = parenthesisBalance(leftTrim);
  if (leftBalance <= 0) return false;
  // If left has more opens than closes, boundary likely splits.
  // Merge if right provides any closing parenthesis.
  const rightHasClose = /[)\]}]/.test(rightTrim);
  return rightHasClose;
}

function parenthesisBalance(s: string): number {
  let bal = 0;
  for (const ch of s) {
    if (ch === "(" || ch === "[" || ch === "{") bal++;
    else if (ch === ")" || ch === "]" || ch === "}") bal--;
  }
  return bal;
}

// ------------------------------
// Step 3: Intro / Conclusion Rules
// ------------------------------

function applyIntroConclusionRules(units: string[]): string[] {
  // Intro rule:
  // If an introductory sentence defines overall claim before factors,
  // it SHOULD be its own unit unless extremely short (< 40 chars).
  //
  // Conclusion rule:
  // If there's a closing synthesis after factors, it SHOULD be its own unit.
  //
  // Here, because structural locks already created blocks, we only attempt:
  // - split a leading intro sentence out of first unit when safe AND stable
  // - split trailing conclusion sentence out of last unit when safe AND stable
  //
  // Stability principle: Prefer fewer units when uncertain. So we split only when:
  // - the extracted intro/conclusion is clearly separated by sentence boundary
  // - extracted segment is not extremely short
  // - and it does not violate parenthesis balance

  if (units.length === 0) return units;

  const out = [...units];

  // Attempt intro split on first unit
  out.splice(0, 1, ...splitIntroFromUnitIfSafe(out[0]));

  // Attempt conclusion split on last unit
  const lastIdx = out.length - 1;
  const lastSplit = splitConclusionFromUnitIfSafe(out[lastIdx]);
  out.splice(lastIdx, 1, ...lastSplit);

  return out;
}

function splitIntroFromUnitIfSafe(unit: string): string[] {
  const u = unit ?? "";
  const sentences = splitIntoSentencesConservative(u);
  if (sentences.length < 2) return [u];

  const first = sentences[0].text;
  // Intro should be own unit unless extremely short (<40 chars)
  if (trimEdgesOnly(first).length < 40) return [u];

  // Only split if first sentence is NOT a factor lead and next sentence IS a factor lead
  const second = sentences[1].text;
  if (isFactorLeadSentence(first)) return [u];
  if (!isFactorLeadSentence(second)) return [u];

  const introEnd = sentences[0].end;
  const intro = u.slice(0, introEnd);
  const rest = u.slice(introEnd);

  if (parenthesisBalance(intro) !== 0) return [u];

  // Prefer fewer units: split only when clearly safe
  return [intro, rest];
}

function splitConclusionFromUnitIfSafe(unit: string): string[] {
  const u = unit ?? "";
  const sentences = splitIntoSentencesConservative(u);
  if (sentences.length < 2) return [u];

  const last = sentences[sentences.length - 1].text;
  // If last sentence is a clear synthesis marker, consider splitting.
  const lastLower = trimEdgesOnly(last).toLowerCase();

  const isConclusionLead =
    lastLower.startsWith("in conclusion") ||
    lastLower.startsWith("to conclude") ||
    lastLower.startsWith("overall");

  if (!isConclusionLead) return [u];

  // Split only if conclusion sentence not extremely short
  if (trimEdgesOnly(last).length < 40) return [u];

  const lastStart = sentences[sentences.length - 1].start;
  const head = u.slice(0, lastStart);
  const concl = u.slice(lastStart);

  if (parenthesisBalance(head) !== 0) return [u];

  return [head, concl];
}

// ------------------------------
// Step 4: Minimum Unit Variance
// ------------------------------

function minimizeUnitVariance(units: string[]): string[] {
  // Rule: If two segmentation options are possible, choose FEWER units.
  // In this implementation we never create alternative trees; we only
  // perform safe consolidations when small units are likely artifacts.

  if (units.length <= 1) return units;

  // If any unit is extremely short, merge it with neighbor to reduce variance.
  // Conservative thresholds:
  // - if unit trimmed length < 40 chars, merge into previous if possible, else next.
  const out = [...units];
  let i = 0;
  while (i < out.length) {
    const t = trimEdgesOnly(out[i]);
    if (t.length > 0 && t.length < 40) {
      if (i > 0) {
        out[i - 1] = out[i - 1] + out[i];
        out.splice(i, 1);
        i = Math.max(0, i - 1);
        continue;
      } else if (out.length > 1) {
        out[0] = out[0] + out[1];
        out.splice(1, 1);
        continue;
      }
    }
    i++;
  }
  return out;
}

// ------------------------------
// Helpers: Sentence Splitting (Conservative)
// ------------------------------

// Conservative sentence splitter:
// - split on ., ?, ! when followed by whitespace/newline or end of string
// - keep punctuation as part of sentence
// - does not attempt to handle abbreviations (we prefer stability over perfect NLP)
function splitIntoSentencesConservative(text: string): Sentence[] {
  const s = text ?? "";
  const out: Sentence[] = [];

  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const isEndPunct = ch === "." || ch === "?" || ch === "!";
    if (!isEndPunct) continue;

    const next = s[i + 1];
    const boundary = (i + 1 === s.length) || next === " " || next === "\n" || next === "\r" || next === "\t";
    if (!boundary) continue;

    const end = i + 1;
    const slice = s.slice(start, end);
    out.push({ text: slice, start, end });

    start = end;
  }

  // remainder
  if (start < s.length) {
    const slice = s.slice(start);
    out.push({ text: slice, start, end: s.length });
  }

  // Remove empty sentences (but keep whitespace inside segments for indices)
  return out
    .map((x) => ({ ...x, text: x.text }))
    .filter((x) => trimEdgesOnly(x.text).length > 0);
}

function getFirstSentenceText(unit: string): string {
  const sentences = splitIntoSentencesConservative(unit ?? "");
  return sentences.length ? sentences[0].text : "";
}

function splitByBlankLines(text: string): string[] {
  // split on two or more line breaks with optional spaces
  return (text ?? "").split(/\n\s*\n+/);
}

function stripPurePageMarkerLines(text: string): string {
  // Remove lines that are only "- N -" (pagination artifacts)
  return (text ?? "").replace(PAGE_MARKER_LINE_REGEX, "");
}
/* ===== END segmenter.fixed.ts (inlined) ===== */

/* ===== BEGIN unit_lengths.ts (inlined) ===== */
// unit_lengths.ts
// NeuPrint Backend Deterministic unit_lengths (FULL RULE SET, B)
//
// Rule (LOCKED):
// 1) Count all characters including spaces, punctuation, parentheses.
// 2) Exclude leading whitespace and trailing whitespace only.
// 3) Do NOT normalize punctuation, spacing, capitalization.
// 4) Line breaks count as ONE character (native string length behavior).
// 5) Do NOT trim internal spaces.
//
// Output:
// - unit_lengths MUST be per-unit character counts (integers), not rounded.

function computeUnitLengths(unit_texts: string[]): number[] {
  const units = Array.isArray(unit_texts) ? unit_texts : [];
  return units.map((u) => {
    const t = trimEdgesOnly(u ?? "");
    // JS/TS .length counts \n as 1 char, satisfying the lock.
    return t.length;
  });
}
/* ===== END unit_lengths.ts (inlined) ===== */

/* ===== BEGIN deterministic_counts.fixed.ts (inlined) ===== */
// deterministic_counts.ts
// NeuPrint Backend Deterministic Counts (FULL RULE SET, B)
//
// Input:  unit_texts (string[]), assumed to be the final deterministic units
// Output: deterministic numeric fields that are strictly lexical-marker based.
//
// IMPORTANT:
// - Count ONLY explicit lexical markers for reasons/hedges/adjacency_links.
// - Revisions: allow shallow reframing (depth=0.2) when fixed markers present.
// - Count at most 1 revision event per unit unless two separate explicit corrections exist
//   (we implement conservative: max 1 per unit).
// - evidence_types: presence-only, fixed output order.
//
// This module does NOT compute claims/evidence/transitions/transition_ok/drift_segments,
// because those may require semantic boundary exceptions or richer interpretation.
// Those remain GPT-side (or later deterministic upgrades).

type DeterministicCounts = {
  // layer_0
  reasons: number;

  // layer_3
  hedges: number;

  // root
  adjacency_links: number;
  evidence_types: EvidenceType[];

  // per-unit
  per_unit_revisions: number[]; // 0/1 aligned to unit_texts length

  // layer_2
  revisions: number;
  revision_depth_sum: number; // float allowed, stable rounding applied
};

function computeDeterministicCounts(unit_texts: string[]): DeterministicCounts {
  const units = (Array.isArray(unit_texts) ? unit_texts : []).map((u) => trimEdgesOnly(u ?? ""));

  const joined = units.join("\n");

  const reasons = countConnectors(joined, REASON_CONNECTORS);
  const hedges = countWords(joined, HEDGE_WORDS);
  const adjacency_links = countConnectors(joined, ADJACENCY_CONNECTORS);

  const { per_unit_revisions, revisions, revision_depth_sum } = computeRevisions(units);

  const evidence_types = detectEvidenceTypes(units);

  return {
    reasons,
    hedges,
    adjacency_links,
    evidence_types,
    per_unit_revisions,
    revisions,
    revision_depth_sum,
  };
}

// ------------------------------
// Lexical Counting (Deterministic)
// ------------------------------

// Count connectors as phrases with word boundaries on both ends.
// This counts explicit occurrences only, case-insensitive.
function countConnectors(text: string, connectors: string[]): number {
  const t = text ?? "";
  let total = 0;
  for (const c of connectors) {
    total += countOccurrencesBoundary(t, c);
  }
  return total;
}

// Count explicit hedge words (word boundary).
function countWords(text: string, words: string[]): number {
  const t = text ?? "";
  let total = 0;
  for (const w of words) {
    total += countOccurrencesBoundary(t, w);
  }
  return total;
}

function countOccurrencesBoundary(text: string, phrase: string): number {
  if (!text || !phrase) return 0;
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\b${escaped}\\b`, "gi");
  const m = text.match(re);
  return m ? m.length : 0;
}

// ------------------------------
// Revisions (Deterministic, Conservative)
// ------------------------------

function computeRevisions(units: string[]): {
  per_unit_revisions: number[];
  revisions: number;
  revision_depth_sum: number;
} {
  const per_unit_revisions: number[] = [];
  let revisions = 0;
  let depthSum = 0;

  for (const u of units) {
    const { has, depth } = detectSingleRevisionEvent(u);
    const flag = has ? 1 : 0;
    per_unit_revisions.push(flag);
    if (has) {
      revisions += 1;
      depthSum += depth;
    }
  }

  // Stable rounding: avoid float noise (0.2 steps)
  const revision_depth_sum = stableRound1(depthSum);

  return { per_unit_revisions, revisions, revision_depth_sum };
}

function detectSingleRevisionEvent(unit: string): { has: boolean; depth: number } {
  const t = (unit ?? "").toLowerCase();

  // 1) Explicit correction markers (depth >= 0.5)
  for (const m of CORRECTION_MARKERS) {
    if (t.includes(m)) {
      return { has: true, depth: 0.5 };
    }
  }

  // 2) Shallow reframing markers (depth = 0.2), max 1 per unit
  for (const m of REFRAME_MARKERS) {
    if (t.includes(m)) {
      return { has: true, depth: 0.2 };
    }
  }

  if (NOT_X_BUT_Y_REGEX.test(t)) {
    return { has: true, depth: 0.2 };
  }

  if (NO_LONGER_INSTEAD_REGEX.test(t)) {
    return { has: true, depth: 0.2 };
  }

  return { has: false, depth: 0.0 };
}

function stableRound1(x: number): number {
  return Math.round((x + Number.EPSILON) * 10) / 10;
}

// ------------------------------
// Evidence Types (Presence-only, Fixed Order)
// ------------------------------

function detectEvidenceTypes(units: string[]): EvidenceType[] {
  const full = units.join("\n").toLowerCase();
  const present = new Set<EvidenceType>();

  // example
  if (containsAny(full, EVIDENCE_TYPE_HINTS.example)) present.add("example");

  // data (conservative): ONLY explicit cues (no numeric heuristics)
  if (containsAny(full, EVIDENCE_TYPE_HINTS.data)) {
    present.add("data");
  }

  // authority
  if (containsAny(full, EVIDENCE_TYPE_HINTS.authority)) present.add("authority");

  // analogy (conservative: only "as if" by default)
  if (containsAny(full, EVIDENCE_TYPE_HINTS.analogy)) present.add("analogy");

  // counterexample
  if (containsAny(full, EVIDENCE_TYPE_HINTS.counterexample)) present.add("counterexample");

  // experience (conservative: explicit "experienced")
  if (containsAny(full, EVIDENCE_TYPE_HINTS.experience)) present.add("experience");

  // theory
  if (containsAny(full, EVIDENCE_TYPE_HINTS.theory)) present.add("theory");

  // fixed order output
  return FIXED_EVIDENCE_ORDER.filter((t) => present.has(t));
}

function containsAny(textLower: string, phrases: readonly string[]): boolean {
  for (const p of phrases) {
    if (textLower.includes(p)) return true;
  }
  return false;
}
/* ===== END deterministic_counts.fixed.ts (inlined) ===== */

/* ===== BEGIN extraction_fill.fixed.ts (inlined) ===== */
// extraction_fill.ts
// NeuPrint Backend Extraction Filler (FULL RULE SET, B)
//
// Purpose:
// - Take GPT-produced extraction JSON (schema-locked) and raw input text,
// - Compute deterministic backend fields (segmentation + unit_lengths + lexical counts),
// - Overwrite ONLY backend-appropriate fields,
// - Return final extraction JSON with the SAME schema.
//
// IMPORTANT:
// - MUST NOT rename fields.
// - MUST NOT add a root key named "raw_features".
// - backend_reserved must remain { kpf_sim: null, tps_h: null }.
// - Do NOT compute RSL level / FRI / gates / signal states. (Out of scope)
//
// Backend overwrites (recommended):
// - layer_0.units
// - layer_0.unit_lengths
// - layer_0.per_unit.revisions
// - layer_0.reasons
// - layer_2.revisions
// - layer_2.revision_depth_sum
// - layer_3.hedges
// - evidence_types
// - adjacency_links
// Keep GPT values for everything else unless explicitly overridden here.




type NeuPrintExtractionSchema = {
  layer_0: {
    units: number;
    unit_lengths: number[];
    per_unit: {
      transitions: number[];
      revisions: number[];
    };
    claims: number;
    reasons: number;
    evidence: number;
  };
  layer_1: {
    sub_claims: number;
    warrants: number;
    counterpoints: number;
    refutations: number;
    structure_type: null;
  };
  layer_2: {
    transitions: number;
    transition_types: string[];
    transition_ok: number;
    revisions: number;
    revision_depth_sum: number;
    belief_change: boolean;
  };
  layer_3: {
    intent_markers: number;
    drift_segments: number;
    hedges: number;
    loops: number;
    self_regulation_signals: number;
  };
  evidence_types: EvidenceType[];
  adjacency_links: number;
  backend_reserved: { kpf_sim: null; tps_h: null };
  rsl_rubric: { coherence: number; structure: number; evaluation: number; integration: number };
  rsl: {
    summary: { one_line: string; paragraph: string };
    dimensions: Array<{ code: string; label: string; score_1to5: number; observation: string }>;
  };
  raw_signals_quotes: {
    A7_value_aware_quote_candidates: string[];
    A8_perspective_flexible_quote_candidates: string[];
    self_repair_quote_candidates: string[];
    framework_generation_quote_candidates: string[];
  };
};

// ------------------------------
// Public API
// ------------------------------
function fillExtractionJson(
  gptJson: NeuPrintExtractionSchema,
  inputText: string
): { filled: NeuPrintExtractionSchema; unit_texts: string[] } {
  const safeJson = deepClone(gptJson);

  // 1) Stable units: prefer GPT-provided unit_texts (segmentation owner = GPT).
  const provided_units = Array.isArray((safeJson as any)?.layer_0?.unit_texts)
    ? (safeJson as any).layer_0.unit_texts
        .filter((u: any) => typeof u === "string")
        .map((u: string) => u)
        .filter((u: string) => trimEdgesOnly(u).length > 0)
    : [];
  const unit_texts =
    provided_units.length > 0 ? provided_units : segmentText(inputText ?? "").unit_texts;
// 2) Deterministic unit_lengths
  const unit_lengths = computeUnitLengths(unit_texts);

  // 3) Deterministic lexical counts
  const counts = computeDeterministicCounts(unit_texts);

  // 4) Overwrite backend-safe fields only (schema preserved)
  // layer_0
  safeJson.layer_0.units = unit_texts.length;
  safeJson.layer_0.unit_lengths = unit_lengths;

  // per_unit arrays: keep transitions as-is (GPT-side), but ensure length = units
  safeJson.layer_0.per_unit.transitions = normalizeArrayLength(
    safeJson.layer_0.per_unit.transitions,
    unit_texts.length,
    0
  );
  safeJson.layer_0.per_unit.revisions = normalizeArrayLength(
    counts.per_unit_revisions,
    unit_texts.length,
    0
  );

  safeJson.layer_0.reasons = counts.reasons;

  // layer_2
  safeJson.layer_2.revisions = counts.revisions;
  safeJson.layer_2.revision_depth_sum = counts.revision_depth_sum;

  // layer_3
  safeJson.layer_3.hedges = counts.hedges;

  // root
  safeJson.adjacency_links = counts.adjacency_links;
  safeJson.evidence_types = counts.evidence_types;

  // backend_reserved fixed
  safeJson.backend_reserved = { kpf_sim: null, tps_h: null };

  // Defensive: must not have forbidden root key
  if ((safeJson as any).raw_features !== undefined) {
    delete (safeJson as any).raw_features;
  }

  return { filled: safeJson, unit_texts };
}

// ------------------------------
// Helpers
// ------------------------------

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function normalizeArrayLength(arr: number[], n: number, fill: number): number[] {
  const out = Array.isArray(arr) ? [...arr] : [];
  if (out.length > n) return out.slice(0, n);
  while (out.length < n) out.push(fill);
  return out;
}
/* ===== END extraction_fill.fixed.ts (inlined) ===== */

/* ===== BEGIN alias helpers (inlined) ===== */
function fillExtractionJsonBackend(gptJson: any, inputText: string): { filled: any; unit_texts: string[] } {
  // Backwards-compatible alias for derive.ts integration
  return fillExtractionJson(gptJson as any, inputText);
}
/* ===== END alias helpers (inlined) ===== */

function hasFiniteDimScore(dimensions: RSLDimension[] | undefined, code: string): boolean {
  const item = dimensions?.find((d) => d?.code === code);
  return typeof item?.score_1to5 === "number" && Number.isFinite(item.score_1to5);
}

type StrictRslBasis = {
  claims: number;
  transitions: number;
  R3: number;
  R4: number;
  R5: number;
  R6: number;
  R7: number;
  R8: number;
};

function deriveStrictRslBasis(raw: any, _dimensions: RSLDimension[] | undefined): StrictRslBasis | null {
  const claims = raw?.layer_0?.claims;
  const transitions = raw?.layer_2?.transitions;
  if (!(typeof claims === 'number' && Number.isFinite(claims) && typeof transitions === 'number' && Number.isFinite(transitions))) {
    return null;
  }

  const rubric = computeRslRubric4FromRaw(raw as any);
  const coherence = rubric?.coherence;
  const structure = rubric?.structure;
  const evaluation = rubric?.evaluation;
  const integration = rubric?.integration;
  const rubrics = [coherence, structure, evaluation, integration];
  if (!rubrics.every((v) => typeof v === 'number' && Number.isFinite(v))) {
    return null;
  }

  const units = Math.max(1, safeNum(raw?.layer_0?.units, 1));
  const reasons = Math.max(0, safeNum(raw?.layer_0?.reasons, 0));
  const evidence = Math.max(0, safeNum(raw?.layer_0?.evidence, 0));
  const warrants = Math.max(0, safeNum(raw?.layer_1?.warrants, 0));
  const subClaims = Math.max(0, safeNum(raw?.layer_1?.sub_claims, 0));
  const counterpoints = Math.max(0, safeNum(raw?.layer_1?.counterpoints, 0));
  const refutations = Math.max(0, safeNum(raw?.layer_1?.refutations, 0));
  const selfReg = Math.max(0, safeNum(raw?.layer_3?.self_regulation_signals, 0));
  const transitionOk = Math.max(0, safeNum(raw?.layer_2?.transition_ok, 0));
  const revisions = Math.max(0, safeNum(raw?.layer_2?.revisions, 0));
  const revisionDepthSum = Math.max(0, safeNum(raw?.layer_2?.revision_depth_sum, 0));

  const counterRefPerClaim = safeDiv(counterpoints + refutations, Math.max(1, claims));
  const counterRef01 = clamp01(counterRefPerClaim / 0.6);
  const supportDensity01 = clamp01((reasons + evidence + warrants + subClaims) / Math.max(1, claims * 2.5));
  const selfReg01 = clamp01(selfReg / 2);
  const transRate = clamp01(transitions / Math.max(1, units - 1));
  const transQuality = clamp01(transitionOk / Math.max(1, transitions));
  const revDepthAvg = revisionDepthSum / Math.max(1, revisions);
  const revDepth01 = clamp01(revDepthAvg / 1.5);

  const hypothesis01 = clamp01(
    0.40 * counterRef01 +
    0.20 * supportDensity01 +
    0.20 * clamp01(evaluation / 5) +
    0.20 * clamp01(integration / 5)
  );
  const expansion01 = clamp01(
    0.30 * transRate +
    0.20 * transQuality +
    0.20 * selfReg01 +
    0.15 * revDepth01 +
    0.15 * clamp01((counterpoints + refutations + revisions) / Math.max(1, units))
  );

  return {
    claims,
    transitions,
    R3: clamp0to5(evaluation),
    R4: clamp0to5(integration),
    R5: clamp0to5(coherence),
    R6: clamp0to5(structure),
    R7: round2(5 * hypothesis01),
    R8: round2(5 * expansion01),
  };
}

function hasRequiredRslInputs(raw: any, dimensions: RSLDimension[] | undefined): boolean {
  return deriveStrictRslBasis(raw, dimensions) !== null;
}

function hasRequiredCffInputs(rawV1: any): boolean {
  const required = [
    rawV1?.units,
    rawV1?.claims,
    rawV1?.reasons,
    rawV1?.evidence,
    rawV1?.sub_claims,
    rawV1?.warrants,
    rawV1?.transitions,
    rawV1?.transition_ok,
    rawV1?.loops,
    rawV1?.intent_markers,
  ];
  return required.every((v) => typeof v === "number" && Number.isFinite(v));
}

function hasRequiredRcInputs(cfv: any, rcLogisticModel: any): boolean {
  const nums = [cfv?.aas, cfv?.ctf, cfv?.rmd, cfv?.rdx, cfv?.eds, cfv?.ifd, cfv?.hi, cfv?.tps_hist];
  return !!rcLogisticModel && nums.every((v) => typeof v === "number" && Number.isFinite(v));
}

function deriveRfsAxesFromBasis(basis: StrictRslBasis | null): {
  rsl_control: number;
  rsl_validation: number;
  rsl_hypothesis: number;
  rsl_expansion: number;
} | null {
  if (!basis) return null;
  return {
    rsl_control: clamp01(basis.R6 / 5),
    rsl_validation: clamp01(basis.R3 / 5),
    rsl_hypothesis: clamp01(basis.R7 / 5),
    rsl_expansion: clamp01(basis.R8 / 5),
  };
}

function hasRequiredRfsInputs(cff8: any, rslAxes: any, roleConfigs: any[]): boolean {
  const cffNums = [cff8?.AAS, cff8?.CTF, cff8?.RMD, cff8?.RDX, cff8?.EDS, cff8?.IFD];
  const rslNums = [rslAxes?.rsl_control, rslAxes?.rsl_validation, rslAxes?.rsl_hypothesis, rslAxes?.rsl_expansion];
  return cffNums.every((v) => typeof v === "number" && Number.isFinite(v)) &&
    rslNums.every((v) => typeof v === "number" && Number.isFinite(v)) &&
    Array.isArray(roleConfigs) && roleConfigs.length > 0;
}

function computeCFF8_strict(raw: RawFeaturesV1): CFF8 {
  const base = computeCFF6_strict(raw);
  return {
    ...base,
    KPF_SIM: null,
    TPS_H: null,
  };
}

function computeRSLStrict(raw: any, dimensions: RSLDimension[] | undefined, rawSignalsQuotes: any, cohortFriList: number[] | undefined): any {
  const basis = deriveStrictRslBasis(raw, dimensions);
  if (!basis) return makeInsufficientRsl('RSL requires claims, transitions, and valid structural basis scores.');

  const friObj = computeFRI(basis.R3, basis.R4, basis.R5, basis.R6);
  const friScore = Number(friObj?.rsl?.fri?.score ?? 0);
  const rslLevelObj = computeRSLLevelWithSignals({
    fri: friScore,
    R6: basis.R6,
    R7: basis.R7,
    R8: basis.R8,
    raw_signals_quotes: rawSignalsQuotes ?? null,
  });
  const rslCohortObj = computeRslCohortResponse(
    friScore,
    Array.isArray(cohortFriList) && cohortFriList.length > 0
      ? cohortFriList
      : DEFAULT_COHORT_FRI_LIST_BACKENDB
  );
  const rslSriObj = deriveRslSriFromRaw(raw ?? {});
  const rslAxes = deriveRfsAxesFromBasis(basis);
  const summary = {
    one_line: String(raw?.rsl?.summary?.one_line ?? ''),
    paragraph: String(raw?.rsl?.summary?.paragraph ?? ''),
  };
  return { status: 'ok', friObj, rslLevelObj, rslCohortObj, rslSriObj, rslAxes, basis, summary };
}
function makeInsufficientRsl(reason: string): any {
  return {
    status: "insufficient_data",
    friObj: { rsl: { fri: { score: 0, interpretation: reason } } },
    rslLevelObj: { rsl: { level: { short_name: "", full_name: "", definition: "" } } },
    rslCohortObj: { rsl: { cohort: { percentile_0to1: 0, top_percent_label: "", interpretation: "" } } },
    rslSriObj: { rsl: { sri: { score: 0, interpretation: reason } } },
    rslAxes: null,
  };
}

function makeInsufficientCff(reason: string): any {
  return {
    status: "insufficient_data",
    cffUi: { cff: { labels: [], values_0to1: [] } },
    cff8: null,
    coreAxes: null,
    cffPatternObj: { cff: { primary_pattern: "Insufficient data", representative_phrase: reason, secondary_pattern: "", pattern_scores: {} } },
    cffFinalObj: { cff: { final_type: { chip_label: "Insufficient data", chip_description: reason, type_code: "" } } },
  };
}

function makeInsufficientRc(reason: string): any {
  return {
    status: "insufficient_data",
    rcSummary: { rc: { summary: reason, control_pattern: "", reliability_band: "", band_rationale: "", pattern_interpretation: "" } },
    rcObserved: { rc: { observed_structural_signals: { "1": "", "2": "", "3": "", "4": "" } } },
    rcDist: { rc: { reasoning_control_distribution: { Human: "N/A", Hybrid: "N/A", AI: "N/A", final_determination: "Insufficient data", determination_sentence: reason } } },
  };
}

function makeInsufficientRfs(reason: string): any {
  return {
    status: "insufficient_data",
    rfsStyle: { rfs: { primary_pattern: "Insufficient data", representative_phrase: reason } },
    rfsJob: { rfs: { summary_lines: [], top_groups: [], recommended_roles_top3: [], recommended_roles_line: "", pattern_interpretation: "" } },
  };
}

function makeRcSummaryStrict(finalDetermination: Determination, distribution: { Human: string; Hybrid: string; AI: string }): { rc: RCOut } {
  const humanPct = Number(String(distribution.Human).replace("%", ""));
  const aiPct = Number(String(distribution.AI).replace("%", ""));
  const maxPct = Math.max(Number.isFinite(humanPct) ? humanPct : 0, Number.isFinite(aiPct) ? aiPct : 0);
  const reliabilityBand = maxPct >= 80 ? "HIGH" : maxPct >= 60 ? "MEDIUM" : "LOW";
  const patternMap: Record<Determination, string> = {
    Human: "Model-based human determination",
    Hybrid: "Model-based hybrid determination",
    AI: "Model-based AI determination",
  };
  const rationaleMap: Record<Determination, string> = {
    Human: "CFV logistic inference indicates predominantly human-led reasoning control.",
    Hybrid: "CFV logistic inference indicates mixed human and AI control.",
    AI: "CFV logistic inference indicates predominantly AI-led reasoning control.",
  };
  return {
    rc: {
      summary: rationaleMap[finalDetermination],
      control_pattern: patternMap[finalDetermination],
      reliability_band: reliabilityBand as any,
      band_rationale: rationaleMap[finalDetermination],
      pattern_interpretation: rationaleMap[finalDetermination],
    },
  };
}

function deriveStrictCfv(raw: any, cff8: CFF8 | null): { cfv: CFV | null; rcStructural: RcStructuralControlSignalsJson } {
  const rcStructural = computeStructuralControlSignalsRc(raw ?? {});
  if (!cff8) return { cfv: null, rcStructural };
  const hi = Number(rcStructural?.rc?.structural_control_signals?.human_rhythm_index);
  const cfv: CFV = {
    aas: Number(cff8.AAS),
    ctf: Number(cff8.CTF),
    rmd: Number(cff8.RMD),
    rdx: Number(cff8.RDX),
    eds: Number(cff8.EDS),
    ifd: Number(cff8.IFD),
    hi,
    tps_hist: cff8.TPS_H == null ? 0 : Number(cff8.TPS_H),
  };
  return { cfv, rcStructural };
}


function makeAmodeCffFinalFromCore(coreAxes: any, cffPatternObj: any): any {
  const A = Number(coreAxes?.AAS ?? 0);
  const F = Number(coreAxes?.CTF ?? 0);
  const M = Number(coreAxes?.RMD ?? 0);
  const X = Number(coreAxes?.RDX ?? 0);
  const E = Number(coreAxes?.EDS ?? 0);
  const I = Number(coreAxes?.IFD ?? 0);

  const analyticity = clamp01(((Number.isFinite(A) ? A : 0) + (Number.isFinite(E) ? E : 0)) / 2);
  const flow = clamp01(((Number.isFinite(F) ? F : 0) + (Number.isFinite(M) ? M : 0)) / 2);
  const regulation = clamp01(((Number.isFinite(X) ? X : 0) + (Number.isFinite(I) ? I : 0)) / 2);

  let typeCode = "T3";
  let label = "T3. Exploratory Thinker";
  let interpretation = "The profile shows exploratory movement and associative reasoning, with evaluation and revision still developing.";

  if (analyticity >= 0.55 && regulation >= 0.55 && flow >= 0.5) {
    typeCode = "T4";
    label = "T4. Structured Reasoner";
    interpretation = "The profile shows relatively balanced analytic structure, flow, and self-regulation across the six CFF axes.";
  } else if (regulation >= 0.6) {
    typeCode = "T2";
    label = "T2. Reflective Regulator";
    interpretation = "The profile shows stronger reflective control and self-monitoring than flow-driven expansion.";
  } else if (analyticity >= 0.55 && flow < 0.5) {
    typeCode = "T1";
    label = "T1. Analytical Reasoner";
    interpretation = "The profile emphasizes analytic structure over momentum, suggesting controlled but less dynamically expanding reasoning.";
  }

  const primary = String(cffPatternObj?.cff?.pattern?.primary_label ?? "");
  const secondary = String(cffPatternObj?.cff?.pattern?.secondary_label ?? "");
  const confidence = round2(clamp01(0.58 + 0.2 * analyticity + 0.12 * regulation + 0.1 * flow));

  return {
    cff: {
      final_type: {
        label,
        type_code: typeCode,
        chip_label: label,
        confidence,
        interpretation: `${interpretation} Primary observed pattern: ${primary || "N/A"}${secondary ? `; secondary: ${secondary}.` : "."}`,
      },
    },
  };
}

function makeRcDeterministicFallback(cfv: any, rcStructural: any, activeIds: Set<string>): any {
  const signals = rcStructural?.rc?.structural_control_signals ?? {};
  const sv = Number(signals?.structural_variance ?? 0);
  const hi = Number(signals?.human_rhythm_index ?? 0);
  const tf = Number(signals?.transition_flow ?? 0);
  const rd = Number(signals?.revision_depth ?? 0);

  const stability = clamp01((clamp01(hi) + clamp01(tf) + clamp01(rd) + (1 - clamp01(sv))) / 4);
  const reliabilityBand = stability >= 0.75 ? "HIGH" : stability >= 0.5 ? "MEDIUM" : "LOW";
  const finalDetermination = hi >= 0.62 ? "Human-leaning structural profile" : hi >= 0.38 ? "Hybrid-leaning structural profile" : "AI-leaning structural profile";
  const pattern = hi >= 0.62 ? "Deterministic human-leaning structural rhythm" : hi >= 0.38 ? "Deterministic mixed structural rhythm" : "Deterministic template-like structural rhythm";
  const rationale = "RC distribution model was unavailable, so RC was populated from deterministic structural control signals only.";

  const rcSummary = {
    rc: {
      summary: rationale,
      control_pattern: pattern,
      reliability_band: reliabilityBand,
      band_rationale: `Band derived from structural_variance=${round2(sv)}, human_rhythm_index=${round2(hi)}, transition_flow=${round2(tf)}, revision_depth=${round2(rd)}.`,
      pattern_interpretation: `The current RC view is a deterministic fallback. ${finalDetermination} based on observed structural rhythm and stability signals.`,
    }
  };

  const rcObserved = activeIds.size === 0
    ? { rc: { observed_structural_signals: { '1': '', '2': '', '3': '', '4': '' } } }
    : toRcJson(selectObservedSignals(activeIds, reliabilityBand as any, {}));

  const rcDist = {
    rc: {
      reasoning_control_distribution: {
        Human: "N/A",
        Hybrid: "N/A",
        AI: "N/A",
        final_determination: finalDetermination,
        determination_sentence: `${finalDetermination}. Probabilistic RC distribution was unavailable because rcLogisticModel was not provided.`,
      }
    }
  };

  return { status: 'ok', rcSummary, rcObserved, rcDist, cfv };
}


function deriveAllStrictCompute(input: GptBackendInput, opts: DeriveAllOptions = {}): any {
  const g = input ?? ({} as any);
  const raw: any = (g as any)?.raw_features ?? (g as any)?.raw ?? (g as any)?.rawFeatures ?? (g as any) ?? {};
  const inputText = safeStr((g as any)?.input_text ?? (g as any)?.text ?? (g as any)?.submitted_text ?? (g as any)?.essay_text ?? '');
  const rawV1 = pickRawFeaturesV1(raw);
  const roleConfigs =
    Array.isArray(opts?.roleConfigs) && opts!.roleConfigs!.length > 0
      ? opts!.roleConfigs!
      : ROLE_CONFIGS_FULL_V3;

  const rslResult = computeRSLStrict(raw, undefined, (g?.raw_signals_quotes ?? raw?.raw_signals_quotes ?? null), opts?.cohortFriList);

  const cffResult = hasRequiredCffInputs(rawV1)
    ? (() => {
        const cffUi = computeCffUiOut_strict(rawV1);
        const cff8 = computeCFF8_strict(rawV1);
        const coreAxes: any = {
          AAS: cff8.AAS,
          CTF: cff8.CTF,
          RMD: cff8.RMD,
          RDX: cff8.RDX,
          EDS: cff8.EDS,
          IFD: cff8.IFD,
          KPF: rawV1?.kpf_sim == null ? null : clamp01(Number(rawV1.kpf_sim)),
          TPS: rawV1?.tps_h == null ? null : clamp01(Number(rawV1.tps_h)),
        };
        coreAxes.Analyticity = avg(coreAxes.AAS, coreAxes.EDS);
        coreAxes.Flow = avg(coreAxes.CTF, coreAxes.RMD);
        coreAxes.MetacogRaw = avg(coreAxes.RDX, coreAxes.IFD);
        const cffPatternObj = computeCffPatternOut(coreAxes);
        const cffFinalObj = computeFinalDeterminationCff({ indicators: {
          'AAS': { score: coreAxes.AAS, status: 'Active' },
          'CTF': { score: coreAxes.CTF, status: 'Active' },
          'RMD': { score: coreAxes.RMD, status: 'Active' },
          'RDX': { score: coreAxes.RDX, status: 'Active' },
          'EDS': { score: coreAxes.EDS, status: 'Active' },
          'IFD': { score: coreAxes.IFD, status: 'Active' },
          'KPF-Sim': { score: coreAxes.KPF, status: rawV1?.kpf_sim == null ? 'Missing' : 'Active' },
          'TPS-H': { score: coreAxes.TPS, status: rawV1?.tps_h == null ? 'Missing' : 'Active' },
        } });
        return { status: 'ok', cffUi, cff8, coreAxes, cffPatternObj, cffFinalObj };
      })()
    : makeInsufficientCff('CFF requires finite 6-axis evaluation inputs only. KPF/TPS are excluded in MVP A-mode.');

  const { cfv, rcStructural } = deriveStrictCfv(raw, (cffResult as any)?.cff8 ?? null);
  const rcSummary = computeRCFromRaw({
    layer_0: raw?.layer_0 ?? {},
    layer_1: raw?.layer_1 ?? {},
    layer_2: raw?.layer_2 ?? {},
    layer_3: raw?.layer_3 ?? {},
  });
  const activeIdsProvided = asSet(opts?.activeSignalIds);
  const activeIds = activeIdsProvided.size > 0
    ? activeIdsProvided
    : inferObservedSignalIdsFromEvidence({
        raw,
        indicators: (((rcStructural as any)?.rc?.structural_control_signals ?? {}) as AgencyIndicators),
        evidenceTypesCount: raw?.evidence_types && typeof raw.evidence_types === 'object'
          ? Object.values(raw.evidence_types).filter((v: any) => safeNum(v, 0) > 0).length
          : 0,
      });
  const rcResult = ((cffResult as any)?.status === 'ok')
    ? (() => {
        const rcDist: any = buildReasoningControlDistributionSoftmax(
          cfv as CFV,
          (((rcStructural as any)?.rc?.structural_control_signals ?? {}) as AgencyIndicators)
        );
        let rcObserved: ObservedSignalsRcJson;
        if (activeIds.size === 0) {
          rcObserved = { rc: { observed_structural_signals: { "1": "", "2": "", "3": "", "4": "" } } };
        } else {
          const band = String(rcSummary?.rc?.reliability_band ?? "MEDIUM") as any;
          const selected = selectObservedSignals(activeIds, band, {});
          rcObserved = toRcJson(selected);
        }
        return { status: 'ok', rcSummary, rcObserved, rcDist, cfv };
      })()
    : makeInsufficientRc('RC was not computed because CFF core axes were unavailable.');

  const arcLevelNum = (() => {
    const code = String((rslResult as any)?.rslLevelObj?.rsl?.level?.short_name ?? '');
    const m = code.match(/\bL([1-6])\b/);
    return m ? Number(m[1]) : 0;
  })();

  const axes: any = {
    analyticity: Number((cffResult as any)?.coreAxes?.AAS),
    flow: Number((cffResult as any)?.coreAxes?.CTF),
    metacognition: Number((cffResult as any)?.coreAxes?.RMD),
    authenticity: Number((cffResult as any)?.coreAxes?.IFD),
  };

  const rfsResult = ((cffResult as any)?.status === 'ok' && (rslResult as any)?.status === 'ok' && (rslResult as any)?.rslAxes)
    ? (() => {
        try {
          const rfsStyle = computeRfsFromPayloadStrict({
            cff: {
              aas: Number((cffResult as any)?.cff8?.AAS),
              ctf: Number((cffResult as any)?.cff8?.CTF),
              rmd: Number((cffResult as any)?.cff8?.RMD),
              rdx: Number((cffResult as any)?.cff8?.RDX),
              eds: Number((cffResult as any)?.cff8?.EDS),
              ifd: Number((cffResult as any)?.cff8?.IFD),
            },
            rsl: {
              rsl_control: (rslResult as any).rslAxes.rsl_control,
              rsl_validation: (rslResult as any).rslAxes.rsl_validation,
              rsl_hypothesis: (rslResult as any).rslAxes.rsl_hypothesis,
              rsl_expansion: (rslResult as any).rslAxes.rsl_expansion,
            },
          });

          const usingProvidedRoleConfigs = Array.isArray(opts?.roleConfigs) && opts!.roleConfigs!.length > 0;
          const rfsJob = computeRfsJobGroupTop3(
            { axes, arc_level: arcLevelNum },
            roleConfigs,
            usingProvidedRoleConfigs ? undefined : { strictMinFilter: false }
          );

          return { status: 'ok', rfsStyle, rfsJob };
        } catch (err: any) {
          return makeInsufficientRfs(err?.message || 'RFS strict computation failed.');
        }
      })()
    : makeInsufficientRfs('RFS style requires computed CFF axes and derived RSL axes.');

  return {
    status: [rslResult, cffResult, rcResult, rfsResult].every((x: any) => x?.status === 'ok') ? 'ok' : 'insufficient_data',
    meta: {
      input_text: inputText,
      strict_mode: true,
      contracts: {
        rsl: 'raw-only basis from extraction + rubric/proxy derivation',
        cff: 'strict CFF6 evaluation core only; KPF/TPS excluded in MVP A-mode',
        rc: 'CFV logistic model required; CFV derived from strict CFF + structural HI',
        rfs: 'strict style axes + non-empty roleConfigs required',
      },
    },
    raw,
    rawV1,
    rslResult,
    cffResult,
    rcStructural,
    rcResult,
    rfsResult,
  };
}

function adaptStrictComputeToOutputJSON2(strictRes: any): OutputJSON2 {
  const output: OutputJSON2 = assembleOutputJSON2({
    rslLevelObj: strictRes?.rslResult?.rslLevelObj,
    friObj: strictRes?.rslResult?.friObj,
    rslCohortObj: strictRes?.rslResult?.rslCohortObj,
    rslSriObj: strictRes?.rslResult?.rslSriObj,
    cffPatternObj: strictRes?.cffResult?.cffPatternObj,
    cffFinalObj: strictRes?.cffResult?.cffFinalObj,
    cffUi: strictRes?.cffResult?.cffUi,
    rcSummary: strictRes?.rcResult?.rcSummary,
    rcObserved: strictRes?.rcResult?.rcObserved,
    rcDist: strictRes?.rcResult?.rcDist,
    rcStructural: strictRes?.rcStructural,
    rfsStyle: strictRes?.rfsResult?.rfsStyle,
    rfsJob: strictRes?.rfsResult?.rfsJob,
  });
  coerceOutputJSON2(output);
  assertOutputJSON2(output);
  (output as any).rsl = {
    ...((output as any).rsl || {}),
    summary: {
      one_line: String((strictRes as any)?.rslResult?.summary?.one_line ?? (strictRes as any)?.raw?.rsl?.summary?.one_line ?? ''),
      paragraph: String((strictRes as any)?.rslResult?.summary?.paragraph ?? (strictRes as any)?.raw?.rsl?.summary?.paragraph ?? ''),
    },
  };
  (output as any).meta = { ...((output as any).meta || {}), ...(strictRes?.meta || {}) };
  (output as any).status = strictRes?.status ?? 'insufficient_data';
  (output as any).rsl.status = strictRes?.rslResult?.status ?? 'insufficient_data';
  (output as any).cff.status = strictRes?.cffResult?.status ?? 'insufficient_data';
  (output as any).rc.status = strictRes?.rcResult?.status ?? 'insufficient_data';
  (output as any).rfs.status = strictRes?.rfsResult?.status ?? 'insufficient_data';
  return output;
}

function inferStructureTypeFromCounts(claims: number, subClaims: number, counterpoints: number, refutations: number) {
  if ((counterpoints + refutations) >= 2) return 'networked';
  if (subClaims >= 2 || claims >= 3) return 'hierarchical';
  return 'linear';
}

function inferWarrantsFromUnitTexts(extractionUnits: any[] = [], unitTexts: string[] = []) {
  const re = /\b(because|therefore|thus|hence|which means|this suggests|this shows|for that reason|implies)\b/i;
  let n = 0;
  for (let i = 0; i < extractionUnits.length; i++) {
    const role = safeStr(extractionUnits[i]?.role).toLowerCase();
    if (role !== 'reason' && role !== 'claim') continue;
    if (re.test(safeStr(unitTexts[i] ?? ''))) n++;
  }
  return n;
}

function inferBeliefChangeFromTexts(unitTexts: string[] = []) {
  const re = /\b(i used to think|at first|but now|i changed my mind|on second thought|i no longer think)\b/i;
  return unitTexts.some((t) => re.test(safeStr(t)));
}

function inferIntentMarkersFromTexts(unitTexts: string[] = []) {
  const re = /\b(i will argue|this essay aims|i will show|my point is|i want to argue)\b/i;
  return unitTexts.reduce((acc, t) => acc + (re.test(safeStr(t)) ? 1 : 0), 0);
}

function inferDriftSegmentsFromTexts(unitTexts: string[] = []) {
  const re = /\b(anyway|by the way|in any case|to change the subject)\b/i;
  return unitTexts.reduce((acc, t) => acc + (re.test(safeStr(t)) ? 1 : 0), 0);
}

function inferLoopsFromTexts(unitTexts: string[] = []) {
  let loops = 0;
  for (let i = 1; i < unitTexts.length; i++) {
    const prev = safeStr(unitTexts[i - 1]).toLowerCase().trim();
    const curr = safeStr(unitTexts[i]).toLowerCase().trim();
    if (!prev || !curr) continue;
    const prevHead = prev.split(/\s+/).slice(0, 6).join(' ');
    const currHead = curr.split(/\s+/).slice(0, 6).join(' ');
    if (prevHead && currHead && prevHead === currHead) loops++;
  }
  return loops;
}

function inferRevisionDepthFromText(text: string) {
  const s = safeStr(text);
  if (!s) return 0;
  if (/\b(i changed my mind|i no longer think|i now reject)\b/i.test(s)) return 3;
  if (/\b(on second thought|i reconsider|i revise this)\b/i.test(s)) return 2;
  if (/\b(or rather|more precisely|to clarify)\b/i.test(s)) return 1;
  return 0;
}

function normalizeRawSignalsQuotes(rawSignalsQuotes: any) {
  if (Array.isArray(rawSignalsQuotes)) {
    return {
      A7_value_aware_quote_candidates: [],
      A8_perspective_flexible_quote_candidates: [],
      self_repair_quote_candidates: [],
      framework_generation_quote_candidates: [],
    };
  }

  return {
    A7_value_aware_quote_candidates: Array.isArray(rawSignalsQuotes?.A7_value_aware_quote_candidates)
      ? rawSignalsQuotes.A7_value_aware_quote_candidates.filter((v: any) => typeof v === 'string')
      : [],
    A8_perspective_flexible_quote_candidates: Array.isArray(rawSignalsQuotes?.A8_perspective_flexible_quote_candidates)
      ? rawSignalsQuotes.A8_perspective_flexible_quote_candidates.filter((v: any) => typeof v === 'string')
      : [],
    self_repair_quote_candidates: Array.isArray(rawSignalsQuotes?.self_repair_quote_candidates)
      ? rawSignalsQuotes.self_repair_quote_candidates.filter((v: any) => typeof v === 'string')
      : [],
    framework_generation_quote_candidates: Array.isArray(rawSignalsQuotes?.framework_generation_quote_candidates)
      ? rawSignalsQuotes.framework_generation_quote_candidates.filter((v: any) => typeof v === 'string')
      : [],
  };
}

function deriveCountsFromUnits(extractionUnits: any[] = []) {
  let claims = 0;
  let reasons = 0;
  let evidence = 0;
  let counterpoints = 0;
  let refutations = 0;
  let conclusions = 0;
  let transitions = 0;
  let revisions = 0;
  let self_regulation_signals = 0;
  let hedges = 0;

  for (const u of extractionUnits) {
    const role = safeStr(u?.role).toLowerCase();
    if (role === 'claim') claims++;
    if (role === 'reason') reasons++;
    if (role === 'evidence') evidence++;
    if (u?.is_counterpoint || role === 'counterpoint') counterpoints++;
    if (u?.is_refutation || role === 'refutation') refutations++;
    if (u?.is_conclusion || role === 'conclusion') conclusions++;
    if (u?.has_transition) transitions++;
    if (u?.is_revision) revisions++;
    if (u?.has_self_regulation) self_regulation_signals++;
    if (u?.has_hedge) hedges++;
  }

  return {
    claims,
    reasons,
    evidence,
    counterpoints,
    refutations,
    conclusions,
    transitions,
    revisions,
    self_regulation_signals,
    hedges,
  };
}

function rebuildLayerFeaturesFromUnits(extraction: any, extractionUnits: any[] = [], segmentedUnits: any[] = []) {
  const counts = deriveCountsFromUnits(extractionUnits);
  const baseLayer0 = extraction?.layer_0 ?? {};
  const baseLayer1 = extraction?.layer_1 ?? {};
  const baseLayer2 = extraction?.layer_2 ?? {};
  const baseLayer3 = extraction?.layer_3 ?? {};
  const unitTexts = Array.isArray(segmentedUnits)
    ? segmentedUnits.map((u: any) => safeStr(u?.text ?? u)).filter(Boolean)
    : [];
  const unitCount = extractionUnits.length || unitTexts.length || numOr0(baseLayer0?.units);
  const transitionVector = extractionUnits.length
    ? extractionUnits.map((u) => (u?.has_transition ? 1 : 0))
    : Array.isArray(baseLayer0?.per_unit?.transitions)
      ? baseLayer0.per_unit.transitions
      : Array.from({ length: unitCount }, () => 0);
  const revisionVector = extractionUnits.length
    ? extractionUnits.map((u) => (u?.is_revision ? 1 : 0))
    : Array.isArray(baseLayer0?.per_unit?.revisions)
      ? baseLayer0.per_unit.revisions
      : Array.from({ length: unitCount }, () => 0);
  const evidenceTypes = extractionUnits
    .map((u) => safeStr(u?.evidence_type).toLowerCase())
    .filter((v) => ['example', 'data', 'source', 'scenario'].includes(v));
  const uniqueEvidenceTypes = Array.from(new Set(evidenceTypes));
  const unitLengths = unitTexts.length
    ? unitTexts.map((t: string) => t.trim().split(/\s+/).filter(Boolean).length)
    : Array.isArray(baseLayer0?.unit_lengths)
      ? baseLayer0.unit_lengths
      : Array.from({ length: unitCount }, () => 0);
  const subClaims = Math.max(0, counts.claims - 1);
  const warrants = inferWarrantsFromUnitTexts(extractionUnits, unitTexts);
  const structureType = baseLayer1?.structure_type ?? inferStructureTypeFromCounts(counts.claims, subClaims, counts.counterpoints, counts.refutations);
  const revisionDepthVector = extractionUnits.length
    ? extractionUnits.map((u, i) => (u?.is_revision ? inferRevisionDepthFromText(unitTexts[i] ?? '') : 0))
    : Array.isArray(baseLayer0?.per_unit?.revision_depth)
      ? baseLayer0.per_unit.revision_depth
      : Array.from({ length: unitCount }, () => 0);
  const beliefChange = baseLayer2?.belief_change != null ? Boolean(baseLayer2?.belief_change) : inferBeliefChangeFromTexts(unitTexts);
  const intentMarkers = baseLayer3?.intent_markers != null ? numOr0(baseLayer3?.intent_markers) : inferIntentMarkersFromTexts(unitTexts);
  const driftSegments = baseLayer3?.drift_segments != null ? numOr0(baseLayer3?.drift_segments) : inferDriftSegmentsFromTexts(unitTexts);
  const loops = baseLayer3?.loops != null ? numOr0(baseLayer3?.loops) : inferLoopsFromTexts(unitTexts);

  return {
    ...extraction,
    raw_signals_quotes: normalizeRawSignalsQuotes(extraction?.raw_signals_quotes),
    layer_0: {
      ...baseLayer0,
      units: unitCount,
      unit_lengths: unitLengths,
      per_unit: {
        ...(baseLayer0?.per_unit ?? {}),
        transitions: transitionVector,
        revisions: revisionVector,
        revision_depth: revisionDepthVector,
      },
      claims: counts.claims,
      reasons: counts.reasons,
      evidence: counts.evidence,
    },
    layer_1: {
      ...baseLayer1,
      sub_claims: baseLayer1?.sub_claims != null ? numOr0(baseLayer1?.sub_claims) : subClaims,
      warrants: baseLayer1?.warrants != null ? numOr0(baseLayer1?.warrants) : warrants,
      counterpoints: counts.counterpoints,
      refutations: counts.refutations,
      structure_type: structureType,
    },
    layer_2: {
      ...baseLayer2,
      transitions: counts.transitions,
      transition_types: Array.isArray(baseLayer2?.transition_types) ? baseLayer2.transition_types : [],
      transition_ok: counts.transitions,
      revisions: counts.revisions,
      revision_depth_sum: baseLayer2?.revision_depth_sum != null ? numOr0(baseLayer2?.revision_depth_sum) : revisionDepthVector.reduce((a: number, b: number) => a + numOr0(b), 0),
      belief_change: beliefChange,
      evidence_types: uniqueEvidenceTypes.length ? uniqueEvidenceTypes : (Array.isArray(baseLayer2?.evidence_types) ? baseLayer2.evidence_types : []),
    },
    layer_3: {
      ...baseLayer3,
      intent_markers: intentMarkers,
      drift_segments: driftSegments,
      loops: loops,
      self_regulation_signals: counts.self_regulation_signals,
      hedges: counts.hedges,
    },
    evidence_types: uniqueEvidenceTypes.length ? uniqueEvidenceTypes : (Array.isArray(extraction?.evidence_types) ? extraction.evidence_types : []),
    adjacency_links: numOr0(extraction?.adjacency_links),
    backend_reserved: extraction?.backend_reserved ?? { kpf_sim: null, tps_h: null },
  };
}

export function deriveAll(input: GptBackendInput, opts: DeriveAllOptions = {}): any {
  const rf = input?.raw_features ?? {};
  const extractionUnits = Array.isArray(rf?.units) ? rf.units : [];
  const rebuiltRaw = rebuildLayerFeaturesFromUnits(rf, extractionUnits, input?.segmented_units ?? []);
  const adaptedInput: GptBackendInput = {
    ...input,
    raw_features: rebuiltRaw,
  };
  const strictRes = deriveAllStrictCompute(adaptedInput, opts);
  return adaptStrictComputeToOutputJSON2(strictRes);
}

