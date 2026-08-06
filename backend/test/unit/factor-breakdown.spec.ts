/**
 * The transparency breakdown behind an approval score (Constitution V).
 *
 * Two things are pinned here:
 *
 *  1. The impacts add up to the score they explain — they are shares of the
 *     score, over the SAME asked-weight denominator the formula used, not
 *     percentages of a flat 100.
 *  2. Every row names its QUESTION. `code` is the OPTION code for a single pick,
 *     and option codes are unique only within their question — `yes` occurs all
 *     over the pool. Without `questionCode`, two differently-weighted answers are
 *     indistinguishable, and a reader labelling rows by option code alone prints
 *     one question's wording on another question's row.
 */
import { describe, expect, it } from 'vitest';
import { WeightedApprovalScoringService } from '@/scoring/weighted-approval.service';
import type { SelectedAnswer } from '@/matching/scoring/approval-probability.scorer';

/** Three questions, two of which answer with the very same option code. */
const WEIGHTS = {
  questionWeights: { employment: 50, business_has_loans: 30, has_credit_card: 20 },
  answerScores: {
    employment: { government: 100 },
    business_has_loans: { yes: 100 },
    has_credit_card: { yes: 50 },
  },
};

const ANSWERS: SelectedAnswer[] = [
  { questionCode: 'employment', kind: 'option', optionCode: 'government' },
  { questionCode: 'business_has_loans', kind: 'option', optionCode: 'yes' },
  { questionCode: 'has_credit_card', kind: 'option', optionCode: 'yes' },
];

const ASKED = ['employment', 'business_has_loans', 'has_credit_card'];

function score(args: { answers?: SelectedAnswer[]; asked?: readonly string[] } = {}) {
  const service = new WeightedApprovalScoringService({
    activeSet: async () => ({ weights: WEIGHTS }),
  } as never);
  return service.scoreProgram({
    programId: 'prog_1',
    category: 'personal' as never,
    answers: args.answers ?? ANSWERS,
    askedQuestionCodes: args.asked ?? ASKED,
  });
}

describe('approval factor breakdown', () => {
  it('names the question behind every impact, even when the option code repeats', async () => {
    const { factors } = await score();

    expect(factors.positive).toEqual([
      { code: 'government', questionCode: 'employment', impact: 50 },
      { code: 'yes', questionCode: 'business_has_loans', impact: 30 },
      { code: 'yes', questionCode: 'has_credit_card', impact: 10 },
    ]);
    // The two `yes` rows are only separable by their question.
    const yesRows = factors.positive.filter((f) => f.code === 'yes');
    expect(new Set(yesRows.map((f) => f.questionCode)).size).toBe(2);
  });

  it('impacts sum to the score they explain', async () => {
    const { score: points, factors } = await score();

    // 50 + 30 + 20×50% = 90 of a 100-weight asked set.
    expect(points).toBe(90);
    expect(factors.positive.reduce((sum, f) => sum + f.impact, 0)).toBe(points);
  });

  it('divides by the ASKED weight, so a narrower ask raises each share', async () => {
    // Only two of the three questions were shown: the denominator is 80, not 100,
    // so the same two answers now account for the whole score.
    const { score: points, factors } = await score({
      answers: ANSWERS.filter((a) => a.questionCode !== 'has_credit_card'),
      asked: ['employment', 'business_has_loans'],
    });

    expect(points).toBe(100);
    expect(factors.positive.map((f) => f.impact)).toEqual([63, 38]);
  });

  it('omits an answer to a question that was never asked', async () => {
    const { factors } = await score({ asked: ['employment', 'business_has_loans'] });

    expect(factors.positive.map((f) => f.questionCode)).not.toContain('has_credit_card');
  });
});
