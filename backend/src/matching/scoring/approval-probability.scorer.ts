import { Decimal } from '@prisma/client/runtime/library';

/**
 * Approval-probability scorer (Constitution V v4.1.0 — code part).
 *
 * Pure + dependency-free. The FORMULA and TIER thresholds live here (code,
 * PR-reviewed); the WEIGHTS (per bank) and DIRECT sub-scores (per option
 * `scoreValue`) are admin DATA passed in. COMPUTED factors (e.g. DBR comfort)
 * are calculated by the helpers here.
 *
 *   probability = Σ ( subScore[factor] × weight[factor] ) / 100      // 0..1
 */

export type ApprovalTier = 'excellent' | 'good' | 'moderate' | 'low' | 'very_low';

/** Per-factor sub-score, 0..1 (DIRECT: option scoreValue; COMPUTED: computed). */
export type SubScores = Record<string, number>;
/** Per-factor weight points; the active set's weights sum to 100. */
export type Weights = Record<string, number>;

/**
 * Code-defined fallback used when a program has no ACTIVE weight set, so nothing
 * is ever left unscored (Spec §5.5.4). Equal split across the supplied factor
 * codes; if none given, returns an empty map (probability 0).
 */
export function defaultWeights(factorCodes: readonly string[]): Weights {
  if (factorCodes.length === 0) return {};
  const each = Math.floor((100 / factorCodes.length) * 1000) / 1000;
  const w: Weights = {};
  factorCodes.forEach((c, i) => {
    // Put any rounding remainder on the first factor so the set still sums to 100.
    w[c] = i === 0 ? Number((100 - each * (factorCodes.length - 1)).toFixed(3)) : each;
  });
  return w;
}

/** probability in 0..1. Only factors present in BOTH maps contribute. */
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

/**
 * COMPUTED factor — debt-burden comfort. 1.0 when DBR is 0, 0.0 at/above the
 * program's DBR cap. Decimal in (Principle I), number 0..1 out (a sub-score).
 */
export function computeDbrComfort(
  salary: Decimal,
  totalInstallments: Decimal,
  dbrCap: Decimal,
): number {
  if (salary.lessThanOrEqualTo(0) || dbrCap.lessThanOrEqualTo(0)) return 0;
  const dbr = totalInstallments.dividedBy(salary);
  const comfort = dbrCap.minus(dbr).dividedBy(dbrCap);
  return clamp01(comfort.toNumber());
}

/**
 * Same COMPUTED debt-burden comfort, but from already-resolved percentages
 * (both expressed 0..100). Used when the engine has already produced the
 * offer's DBR % and the program's DBR cap %, so we avoid re-deriving from
 * Decimals. 1.0 at DBR 0, 0.0 at/above the cap.
 */
export function dbrComfortFromPercents(dbrPercent: number, dbrCapPercent: number): number {
  if (!Number.isFinite(dbrPercent) || !Number.isFinite(dbrCapPercent) || dbrCapPercent <= 0) {
    return 0;
  }
  return clamp01((dbrCapPercent - dbrPercent) / dbrCapPercent);
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
