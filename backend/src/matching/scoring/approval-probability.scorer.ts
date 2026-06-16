/**
 * Approval-probability scorer (Constitution V v5.0.0 — code part).
 *
 * Pure + dependency-free. The FORMULA and TIER thresholds live here (code,
 * PR-reviewed); the WEIGHTS (per bank program, per question) and sub-scores
 * (per-option `scoreValue`) are admin DATA passed in. DBR is NOT scored here —
 * it is an eligibility gate only.
 *
 *   probability = Σ ( subScore[questionCode] × weight[questionCode] ) / 100   // 0..1
 */

export type ApprovalTier = 'excellent' | 'good' | 'moderate' | 'low' | 'very_low';

/** Per-question sub-score, 0..1 (the selected option's `scoreValue`). */
export type SubScores = Record<string, number>;
/** Per-question weight points; the active set's weights sum to 100. */
export type Weights = Record<string, number>;

/**
 * Code-defined fallback used when a program has no ACTIVE weight set, so nothing
 * is ever left unscored. Equal split across the supplied question codes; if none
 * given, returns an empty map (probability 0).
 */
export function defaultWeights(questionCodes: readonly string[]): Weights {
  if (questionCodes.length === 0) return {};
  const each = Math.floor((100 / questionCodes.length) * 1000) / 1000;
  const w: Weights = {};
  questionCodes.forEach((c, i) => {
    // Put any rounding remainder on the first question so the set still sums to 100.
    w[c] = i === 0 ? Number((100 - each * (questionCodes.length - 1)).toFixed(3)) : each;
  });
  return w;
}

/** probability in 0..1. Only questions present in BOTH maps contribute. */
export function computeProbability(weights: Weights, subScores: SubScores): number {
  let points = 0;
  for (const [code, weight] of Object.entries(weights)) {
    const sub = subScores[code];
    if (sub === undefined) continue;
    points += clamp01(sub) * weight;
  }
  return clamp01(points / 100);
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
