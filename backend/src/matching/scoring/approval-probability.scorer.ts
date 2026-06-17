/**
 * Approval-probability scorer (Constitution V — code part).
 *
 * Pure + dependency-free. The FORMULA and TIER thresholds live here (code,
 * PR-reviewed); the POINTS (per bank program, per answer option) are admin DATA
 * passed in. There is no eligibility gating (dropped for MVP).
 *
 *   probability = Σ ( points[questionCode][selectedOptionCode] ) / maxAchievablePoints
 *
 * Points are nested by questionCode → optionCode (option codes are only unique
 * WITHIN a question, so the question code disambiguates). `maxAchievablePoints`
 * = for each question, the highest option points the program assigned, summed —
 * the most a single applicant could earn. Best answer to every question → 1.
 */

export type ApprovalTier = 'excellent' | 'good' | 'moderate' | 'low' | 'very_low';

/** Per-answer points assigned by a bank program: questionCode → optionCode → points. */
export type OptionPoints = Record<string, Record<string, number>>;

/** A submitted answer: which option was picked for which question. */
export interface SelectedAnswer {
  questionCode: string;
  optionCode: string;
}

/**
 * probability in 0..1 = earned points / max achievable points. `maxPoints <= 0`
 * (program assigned nothing) → 0, so a program with no weight set stays unscored.
 */
export function computeProbability(
  points: OptionPoints,
  answers: readonly SelectedAnswer[],
  maxPoints: number,
): number {
  if (maxPoints <= 0) return 0;
  let earned = 0;
  for (const a of answers) {
    earned += points[a.questionCode]?.[a.optionCode] ?? 0;
  }
  return clamp01(earned / maxPoints);
}

/**
 * Max achievable points for a program: per question, the largest points it
 * assigned to any of that question's options; summed. Questions with no scored
 * option contribute 0.
 */
export function maxAchievablePoints(
  points: OptionPoints,
  questions: ReadonlyArray<{ code: string; optionCodes: readonly string[] }>,
): number {
  let total = 0;
  for (const q of questions) {
    const byOption = points[q.code];
    if (!byOption) continue;
    let best = 0;
    for (const optionCode of q.optionCodes) {
      const p = byOption[optionCode];
      if (p !== undefined && p > best) best = p;
    }
    total += best;
  }
  return total;
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
