/**
 * Approval-probability scorer (Constitution V — code part, v8.0.0).
 *
 * Pure + dependency-free. The FORMULA and TIER thresholds live here (code,
 * PR-reviewed); the WEIGHTS + SCORES (per bank program) are admin DATA passed
 * in. There is no eligibility gating (dropped for MVP).
 *
 * TWO-LEVEL weighted model:
 *   - each QUESTION has a weight; per program all question weights sum to 100
 *   - each ANSWER (option) has a score 0..100
 *   probability = Σ_question ( questionWeight/100 × pickedAnswerScore/100 )
 *
 * Best answer (score 100) to every question → 1.0 (max achievable = 100% by
 * construction). A program with no ACTIVE set scores 0 (`very_low`).
 */

export type ApprovalTier = 'excellent' | 'good' | 'moderate' | 'low' | 'very_low';

/**
 * A program's admin-set scoring: per-question importance weights (sum 100) and
 * per-answer scores (0..100), nested questionCode → optionCode → score.
 */
export interface ProgramScoring {
  questionWeights: Record<string, number>;
  answerScores: Record<string, Record<string, number>>;
}

/** A submitted answer: which option was picked for which question. */
export interface SelectedAnswer {
  questionCode: string;
  optionCode: string;
}

/**
 * Coerce a stored `ScoringWeightSet.weights` JSON into a `ProgramScoring`.
 * New shape (`{ questionWeights, answerScores }`) passes through. A legacy
 * single-level row (`{ questionCode: { optionCode: points } }`, v6/v7) is
 * upgraded on read: its map becomes `answerScores` and equal question weights
 * summing to 100 are synthesised so legacy programs keep scoring.
 */
export function normalizeWeights(raw: unknown): ProgramScoring {
  if (!raw || typeof raw !== 'object') {
    return { questionWeights: {}, answerScores: {} };
  }
  const obj = raw as Record<string, unknown>;
  if (obj['questionWeights'] && obj['answerScores']) {
    return {
      questionWeights: (obj['questionWeights'] as Record<string, number>) ?? {},
      answerScores: (obj['answerScores'] as Record<string, Record<string, number>>) ?? {},
    };
  }
  // Legacy: the whole object is answerScores (questionCode → optionCode → points).
  const answerScores = obj as Record<string, Record<string, number>>;
  return { questionWeights: equalWeights(Object.keys(answerScores)), answerScores };
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
 * probability in 0..1 = Σ_question ( questionWeight/100 × pickedAnswerScore/100 ).
 * Only the picked answers contribute; an unanswered or unscored question adds 0.
 */
export function computeProbability(
  scoring: ProgramScoring,
  answers: readonly SelectedAnswer[],
): number {
  let total = 0;
  for (const a of answers) {
    const weight = scoring.questionWeights[a.questionCode] ?? 0;
    const score = scoring.answerScores[a.questionCode]?.[a.optionCode] ?? 0;
    total += (weight / 100) * (score / 100);
  }
  return clamp01(total);
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
