/**
 * Approval-probability scorer (Constitution V — code part, v14.0.0).
 *
 * Pure (no Nest, no Prisma client — only `Decimal` for band comparison). The
 * FORMULA and TIER thresholds live here (code, PR-reviewed); the WEIGHTS +
 * SCORES + per-type rules (per bank program) are admin DATA passed in. There is
 * no eligibility gating (dropped for MVP).
 *
 * TWO-LEVEL weighted model:
 *   - each QUESTION has a weight; per program all question weights sum to 100
 *   - each ANSWER resolves to a single score 0..100
 *   probability = Σ_answered(questionWeight × answerScore/100) ÷ Σ_asked(questionWeight)
 *
 * EVERY question type can score (v14.0.0). Only the derivation of the 0..100
 * answer score is type-aware; the formula above is untouched:
 *   - SINGLE_SELECT → the picked option's score
 *   - MULTI_SELECT  → the picked options' scores combined by the program's
 *                     chosen aggregation (AVERAGE | SUM_CAPPED | MAX | MIN)
 *   - NUMERIC       → the score of the band the value falls in (half-open
 *                     `[from, to)`, Decimal comparison)
 *   - TEXT          → `answeredScore` when non-blank (presence only — there is
 *                     deliberately NO pattern/keyword matching on free text)
 *
 * The denominator is the weight the program placed on the questions this
 * applicant was ASKED, not a flat 100 (Constitution V, v13.0.0). Best answer
 * (score 100) to everything asked → 1.0. A program with no ACTIVE set scores 0
 * and is flagged `usedDefault` by the caller.
 */
import { Decimal } from '@prisma/client/runtime/library';

export type ApprovalTier = 'excellent' | 'good' | 'moderate' | 'low' | 'very_low';

/** How a MULTI_SELECT question combines the scores of the options that were picked. */
export type MultiSelectAggregation = 'AVERAGE' | 'SUM_CAPPED' | 'MAX' | 'MIN';

export const MULTI_SELECT_AGGREGATIONS: readonly MultiSelectAggregation[] = [
  'AVERAGE',
  'SUM_CAPPED',
  'MAX',
  'MIN',
];

/**
 * No aggregation stored → AVERAGE. It is the only mode that cannot change the
 * meaning of a legacy row: with one pick every mode agrees, and averaging keeps
 * the result inside 0..100 without rewarding or punishing extra picks.
 */
export const DEFAULT_MULTI_SELECT_AGGREGATION: MultiSelectAggregation = 'AVERAGE';

export function isMultiSelectAggregation(raw: unknown): raw is MultiSelectAggregation {
  return typeof raw === 'string' && MULTI_SELECT_AGGREGATIONS.includes(raw as MultiSelectAggregation);
}

/**
 * One NUMERIC scoring band: half-open `[from, to)` so two adjacent bands can
 * never both claim an edge value. `from: null` = −∞, `to: null` = +∞. Edges are
 * DECIMAL STRINGS — these are money/rate values (Principle I, no floats).
 */
export interface NumericBand {
  from: string | null;
  to: string | null;
  score: number;
}

/** How a MULTI_SELECT question's picked option scores are combined. */
export interface MultiSelectRule {
  aggregation: MultiSelectAggregation;
}

/** What a non-blank TEXT answer earns. Blank/skipped earns nothing, like any skip. */
export interface TextRule {
  answeredScore: number;
}

/**
 * A program's admin-set scoring: per-question importance weights (sum 100) plus
 * the per-type rules that turn one answer into a 0..100 score.
 *
 * The three rule maps are optional so a pre-v14 row (and every existing test
 * fixture) stays valid — `normalizeWeights` always materialises them.
 */
export interface ProgramScoring {
  questionWeights: Record<string, number>;
  /** questionCode → optionCode → score. Both choice types. */
  answerScores: Record<string, Record<string, number>>;
  /** questionCode → aggregation. MULTI_SELECT only. */
  multiSelectRules?: Record<string, MultiSelectRule>;
  /** questionCode → ordered bands. NUMERIC only. */
  numericBands?: Record<string, NumericBand[]>;
  /** questionCode → presence score. TEXT only. */
  textRules?: Record<string, TextRule>;
}

/**
 * A submitted answer, in the shape the scorer needs. One variant per question
 * type so a numeric / text / multi-select answer is representable — before
 * v14.0.0 this was `{ questionCode, optionCode }` and the other three types
 * could not reach the scorer at all.
 */
export type SelectedAnswer =
  | { questionCode: string; kind: 'option'; optionCode: string }
  | { questionCode: string; kind: 'options'; optionCodes: readonly string[] }
  /** Decimal string, as normalised by `validateAnswer`. */
  | { questionCode: string; kind: 'numeric'; value: string }
  | { questionCode: string; kind: 'text'; hasValue: boolean };

/** An empty scoring set — a program with no ACTIVE weight set scores 0. */
export function emptyScoring(): ProgramScoring {
  return {
    questionWeights: {},
    answerScores: {},
    multiSelectRules: {},
    numericBands: {},
    textRules: {},
  };
}

/**
 * Coerce a stored `ScoringWeightSet.weights` JSON into a `ProgramScoring`.
 * The v8+ shape passes through with the v14 rule maps defaulted to `{}`. A
 * legacy single-level row (`{ questionCode: { optionCode: points } }`, v6/v7) is
 * upgraded on read: its map becomes `answerScores` and equal question weights
 * summing to 100 are synthesised so legacy programs keep scoring.
 *
 * Detection tests for the PRESENCE of `questionWeights`, not its truthiness: a
 * v8 row saved with weights but no scores would otherwise fall into the legacy
 * branch and be read as if the literal key `"questionWeights"` were a question.
 */
export function normalizeWeights(raw: unknown): ProgramScoring {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return emptyScoring();
  }
  const obj = raw as Record<string, unknown>;
  if ('questionWeights' in obj || 'answerScores' in obj) {
    return {
      questionWeights: asRecord<number>(obj['questionWeights']),
      answerScores: asRecord<Record<string, number>>(obj['answerScores']),
      multiSelectRules: asRecord<MultiSelectRule>(obj['multiSelectRules']),
      numericBands: asRecord<NumericBand[]>(obj['numericBands']),
      textRules: asRecord<TextRule>(obj['textRules']),
    };
  }
  // Legacy: the whole object is answerScores (questionCode → optionCode → points).
  const answerScores = obj as Record<string, Record<string, number>>;
  return {
    ...emptyScoring(),
    questionWeights: equalWeights(Object.keys(answerScores)),
    answerScores,
  };
}

function asRecord<T>(raw: unknown): Record<string, T> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as Record<string, T>;
}

/** Equal question weights summing to exactly 100 (remainder spread over the first questions). */
export function equalWeights(questionCodes: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  const n = questionCodes.length;
  if (n === 0) return out;
  const base = Math.floor(100 / n);
  let remainder = 100 - base * n;
  for (const code of questionCodes) {
    out[code] = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
  }
  return out;
}

/**
 * The 0..100 score this program gives this one answer, or `null` when the
 * program configured nothing for it (no option score, no band covering the
 * value, no text rule). `null` earns zero but still leaves the question's weight
 * in the denominator — exactly like an unanswered question, because in both
 * cases the applicant has demonstrated nothing this program credits.
 *
 * Never throws: unparseable values and unknown option codes degrade to zero, so
 * a bad row can cost a program points but can never fail a match request.
 */
export function answerScoreFor(scoring: ProgramScoring, answer: SelectedAnswer): number | null {
  switch (answer.kind) {
    case 'option': {
      const score = scoring.answerScores[answer.questionCode]?.[answer.optionCode];
      return typeof score === 'number' ? clampScore(score) : null;
    }

    case 'options': {
      const byOption = scoring.answerScores[answer.questionCode];
      if (!byOption || answer.optionCodes.length === 0) return null;
      // An option the program never scored counts as 0 — it was offered and the
      // applicant picked it, so it is a real (worthless) choice, not a gap.
      const picked = answer.optionCodes.map((code) => clampScore(byOption[code] ?? 0));
      const aggregation =
        scoring.multiSelectRules?.[answer.questionCode]?.aggregation ??
        DEFAULT_MULTI_SELECT_AGGREGATION;
      return aggregatePicked(aggregation, picked);
    }

    case 'numeric': {
      const bands = scoring.numericBands?.[answer.questionCode];
      if (!bands || bands.length === 0) return null;
      const band = bandFor(bands, answer.value);
      return band ? clampScore(band.score) : null;
    }

    case 'text': {
      const rule = scoring.textRules?.[answer.questionCode];
      if (!rule) return null;
      return answer.hasValue ? clampScore(rule.answeredScore) : null;
    }
  }
}

/** The band whose half-open `[from, to)` contains `value`, or `null` if none does. */
export function bandFor(bands: readonly NumericBand[], value: string): NumericBand | null {
  const parsed = toDecimal(value);
  if (!parsed) return null;
  for (const band of bands) {
    const from = band.from != null ? toDecimal(band.from) : null;
    const to = band.to != null ? toDecimal(band.to) : null;
    if (band.from != null && !from) continue; // malformed edge — band cannot match
    if (band.to != null && !to) continue;
    if (from && parsed.lessThan(from)) continue;
    if (to && parsed.greaterThanOrEqualTo(to)) continue;
    return band;
  }
  return null;
}

function aggregatePicked(
  aggregation: MultiSelectAggregation,
  picked: readonly number[],
): number | null {
  if (picked.length === 0) return null;
  switch (aggregation) {
    case 'SUM_CAPPED':
      return Math.min(
        100,
        picked.reduce((sum, s) => sum + s, 0),
      );
    case 'MAX':
      return Math.max(...picked);
    case 'MIN':
      return Math.min(...picked);
    case 'AVERAGE':
      return picked.reduce((sum, s) => sum + s, 0) / picked.length;
  }
}

function toDecimal(raw: string): Decimal | null {
  try {
    const d = new Decimal(raw);
    return d.isFinite() ? d : null;
  } catch {
    return null;
  }
}

function clampScore(score: number): number {
  if (typeof score !== 'number' || Number.isNaN(score)) return 0;
  return Math.max(0, Math.min(100, score));
}

/**
 * probability in 0..1, normalised over the questions this applicant was ASKED:
 *
 *     Σ_answered ( questionWeight × answerScore/100 )
 *     ───────────────────────────────────────────────
 *              Σ_asked ( questionWeight )
 *
 * `askedQuestionCodes` is the set the applicant actually saw — active, assigned
 * to their loan category, and visible after branching. Since v14.0.0 there is no
 * type filter: every type can be scored, so every asked question is a candidate.
 * The asked set is what makes programs comparable: a program that weights six
 * questions where only three are asked is judged on those three, not punished
 * for the other three the applicant was never shown. Weight aimed at a question
 * outside the asked set leaves BOTH sides of the fraction, so a misconfigured
 * assignment can no longer cap a program below 100% forever.
 *
 * An asked-but-skipped question stays in the denominator and earns nothing, so
 * skipping costs the applicant points — answering more improves the match.
 * An answer to a question that was not asked is ignored outright.
 *
 * Nothing asked (or no weight on anything asked) → 0, never NaN.
 */
export function computeProbability(
  scoring: ProgramScoring,
  answers: readonly SelectedAnswer[],
  askedQuestionCodes: readonly string[],
): number {
  const asked = new Set(askedQuestionCodes);
  const denominator = askedWeightSum(scoring, asked);
  if (denominator <= 0) return 0;

  let earned = 0;
  for (const a of answers) {
    if (!asked.has(a.questionCode)) continue;
    const weight = scoring.questionWeights[a.questionCode] ?? 0;
    const score = answerScoreFor(scoring, a) ?? 0;
    earned += weight * (score / 100);
  }
  return clamp01(earned / denominator);
}

/**
 * The scoring budget actually in play: the program's weight on the questions
 * this applicant was asked. Exported because the factor breakdown has to divide
 * by the same number the score did, or the contributions stop adding up to it.
 */
export function askedWeightSum(
  scoring: ProgramScoring,
  askedQuestionCodes: ReadonlySet<string> | readonly string[],
): number {
  const asked =
    askedQuestionCodes instanceof Set ? askedQuestionCodes : new Set(askedQuestionCodes);
  let sum = 0;
  for (const [code, weight] of Object.entries(scoring.questionWeights)) {
    if (asked.has(code)) sum += weight;
  }
  return sum;
}

export function tierFor(probability: number): ApprovalTier {
  if (probability >= 0.8) return 'excellent';
  if (probability >= 0.6) return 'good';
  if (probability >= 0.4) return 'moderate';
  if (probability >= 0.2) return 'low';
  return 'very_low';
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
