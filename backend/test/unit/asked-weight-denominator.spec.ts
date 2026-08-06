/**
 * Constitution V (v13.0.0) — the score is normalised over the questions the
 * applicant was ASKED, not over a flat 100.
 *
 *     Σ_answered ( questionWeight × answerScore/100 )
 *     ───────────────────────────────────────────────
 *              Σ_asked ( questionWeight )
 *
 * Two properties this file exists to hold:
 *
 *   1. **Comparability.** Programs that score on different question sets are
 *      judged on what their own asked questions earned, so a program weighting
 *      six questions is not beaten by a program weighting three purely because
 *      three of its six were never put to the applicant.
 *
 *   2. **No silent cap.** Weight aimed at a question outside the asked set —
 *      the mis-assignment bug: a car program scoring on a mortgage-only
 *      question — leaves BOTH sides of the fraction. Before v13.0.0 it stayed
 *      in the implicit denominator of 100 and capped that program below 100%
 *      forever, with no error and nothing in the admin to reveal it.
 */
import { describe, expect, it } from 'vitest';
import {
  askedWeightSum,
  computeProbability,
  normalizeWeights,
  type ProgramScoring,
  type SelectedAnswer,
} from '@/matching/scoring/approval-probability.scorer';

/** Weights sum to 100, as `assertQuestionWeightsSumTo100` requires on save. */
const SCORING: ProgramScoring = {
  questionWeights: { income_band: 40, job_tenure: 35, own_property: 25 },
  answerScores: {
    income_band: { high: 100, low: 20 },
    job_tenure: { over_3y: 100, under_6m: 10 },
    own_property: { yes: 100, no: 0 },
  },
};

const pick = (questionCode: string, optionCode: string): SelectedAnswer => ({
  questionCode,
  kind: 'option',
  optionCode,
});

const PERFECT: SelectedAnswer[] = [
  pick('income_band', 'high'),
  pick('job_tenure', 'over_3y'),
  pick('own_property', 'yes'),
];

describe('a perfect applicant reaches 100% whatever the asked set', () => {
  it('scores 1.0 when every weighted question is asked', () => {
    expect(
      computeProbability(SCORING, PERFECT, ['income_band', 'job_tenure', 'own_property']),
    ).toBe(1);
  });

  it('still scores 1.0 when a weighted question is never asked', () => {
    // THE regression test. `own_property` carries 25 of this program's 100 but
    // is mortgage-only, so a car applicant never sees it. Pre-v13 this returned
    // 0.75 and the program could never rank first however good the applicant.
    expect(computeProbability(SCORING, PERFECT, ['income_band', 'job_tenure'])).toBe(1);
  });

  it('ignores an answer to a question that was not asked', () => {
    // The answer arrives (a stale client, or a shared draft) but the question
    // was not put to this applicant, so it must not earn — numerator and
    // denominator both exclude it.
    expect(computeProbability(SCORING, PERFECT, ['income_band'])).toBe(1);
    expect(
      computeProbability(SCORING, [pick('own_property', 'yes')], ['income_band', 'job_tenure']),
    ).toBe(0);
  });
});

describe('skipping an asked question costs exactly its weight', () => {
  it('drops the score by the skipped weight, not more', () => {
    // Asked all three, answered the first two perfectly, skipped own_property.
    // (40 + 35) ÷ 100 = 0.75.
    expect(
      computeProbability(SCORING, PERFECT.slice(0, 2), [
        'income_band',
        'job_tenure',
        'own_property',
      ]),
    ).toBeCloseTo(0.75, 10);
  });

  it('separates "skipped" from "never asked" — same answers, different scores', () => {
    const answers = PERFECT.slice(0, 2);
    const skipped = computeProbability(SCORING, answers, [
      'income_band',
      'job_tenure',
      'own_property',
    ]);
    const neverAsked = computeProbability(SCORING, answers, ['income_band', 'job_tenure']);
    expect(skipped).toBeCloseTo(0.75, 10);
    expect(neverAsked).toBe(1);
    expect(neverAsked).toBeGreaterThan(skipped);
  });

  it('scores a partial answer set on its merits, not on how much is left', () => {
    // Answered income_band badly (20), skipped the rest of an all-asked set:
    // 40 × 0.20 = 8, over a denominator of 100.
    expect(
      computeProbability(SCORING, [pick('income_band', 'low')], [
        'income_band',
        'job_tenure',
        'own_property',
      ]),
    ).toBeCloseTo(0.08, 10);
  });
});

describe('degenerate inputs return 0, never NaN', () => {
  it('returns 0 when nothing was asked', () => {
    expect(computeProbability(SCORING, PERFECT, [])).toBe(0);
  });

  it('returns 0 when the program weights none of the asked questions', () => {
    expect(computeProbability(SCORING, PERFECT, ['some_other_question'])).toBe(0);
  });

  it('returns 0 for a program with no ACTIVE weight set', () => {
    const empty: ProgramScoring = { questionWeights: {}, answerScores: {} };
    expect(computeProbability(empty, PERFECT, ['income_band'])).toBe(0);
  });

  it('never produces NaN for any of the above', () => {
    for (const asked of [[], ['unknown'], ['income_band']]) {
      expect(Number.isNaN(computeProbability(SCORING, PERFECT, asked))).toBe(false);
      expect(Number.isNaN(computeProbability(SCORING, [], asked))).toBe(false);
    }
  });

  it('stays clamped to 0..1 even if stored weights exceed the 100 budget', () => {
    // Defensive: save-time validation enforces the sum, but a hand-edited or
    // pre-validation row must not escape the range.
    const overBudget: ProgramScoring = {
      questionWeights: { a: 200 },
      answerScores: { a: { yes: 100 } },
    };
    expect(computeProbability(overBudget, [pick('a', 'yes')], ['a'])).toBe(1);
  });
});

describe('legacy single-level rows still score after upgrading on read', () => {
  it('normalises then scores against the asked set', () => {
    const legacy = normalizeWeights({
      employment_status: { government: 100, private: 85 },
      job_tenure: { over_3y: 100 },
    });
    // equalWeights over two codes → 50/50.
    expect(
      computeProbability(
        legacy,
        [pick('employment_status', 'government'), pick('job_tenure', 'over_3y')],
        ['employment_status', 'job_tenure'],
      ),
    ).toBe(1);
    // Only one of the two asked → judged on that one alone.
    expect(
      computeProbability(legacy, [pick('employment_status', 'private')], ['employment_status']),
    ).toBeCloseTo(0.85, 10);
  });

  it('reads a v8 row that saved weights but no scores as weights, not as one bogus question', () => {
    // `{ questionWeights: {...} }` with the `answerScores` key absent used to fall
    // into the legacy branch, where the literal string "questionWeights" became a
    // question code carrying all 100 — so the real weights vanished and the row
    // scored 0 for everyone.
    const partial = normalizeWeights({ questionWeights: { income_band: 100 } });
    expect(partial.questionWeights).toEqual({ income_band: 100 });
    expect(partial.answerScores).toEqual({});
    expect(askedWeightSum(partial, ['income_band'])).toBe(100);
    // Weighted but unscored: it consumes the denominator and earns nothing, which
    // is why `saveWeights` now rejects that shape with WEIGHTS_MISSING_RULE.
    expect(computeProbability(partial, [pick('income_band', 'high')], ['income_band'])).toBe(0);
  });
});

describe('a mixed-type program scores every answer type over the same denominator', () => {
  /**
   * The v14.0.0 shape: one weighted question of each type. Weights sum to 100, so
   * a perfect applicant who is asked everything still lands on exactly 1.0 — the
   * formula is untouched, only the per-type derivation of the answer score is new.
   */
  const MIXED: ProgramScoring = {
    questionWeights: {
      income_monthly: 40,
      income_sources: 25,
      own_property: 20,
      employer_name: 15,
    },
    answerScores: {
      income_sources: { salary: 100, rental: 60, freelance: 20 },
      own_property: { yes: 100, no: 0 },
    },
    multiSelectRules: { income_sources: { aggregation: 'AVERAGE' } },
    numericBands: {
      income_monthly: [
        { from: null, to: '5000', score: 20 },
        { from: '5000', to: '15000', score: 60 },
        { from: '15000', to: null, score: 100 },
      ],
    },
    textRules: { employer_name: { answeredScore: 100 } },
  };

  const ASKED = ['income_monthly', 'income_sources', 'own_property', 'employer_name'];

  it('reaches 1.0 on the best answer of every type', () => {
    const answers: SelectedAnswer[] = [
      { questionCode: 'income_monthly', kind: 'numeric', value: '20000.00' },
      { questionCode: 'income_sources', kind: 'options', optionCodes: ['salary'] },
      pick('own_property', 'yes'),
      { questionCode: 'employer_name', kind: 'text', hasValue: true },
    ];
    expect(computeProbability(MIXED, answers, ASKED)).toBe(1);
  });

  it('grades a mixed answer set by weight × per-type score', () => {
    const answers: SelectedAnswer[] = [
      // 9,000 lands in the middle band → 60. 40 × 0.60 = 24.
      { questionCode: 'income_monthly', kind: 'numeric', value: '9000.00' },
      // AVERAGE of salary(100) + freelance(20) = 60. 25 × 0.60 = 15.
      { questionCode: 'income_sources', kind: 'options', optionCodes: ['salary', 'freelance'] },
      // no → 0. Costs its full 20.
      pick('own_property', 'no'),
      // provided → 100. 15 × 1.00 = 15.
      { questionCode: 'employer_name', kind: 'text', hasValue: true },
    ];
    expect(computeProbability(MIXED, answers, ASKED)).toBeCloseTo(0.54, 10);
  });

  it('leaves an unasked numeric question out of both halves', () => {
    // Only the two questions this applicant saw count: 25 + 20 = 45 denominator.
    const answers: SelectedAnswer[] = [
      { questionCode: 'income_sources', kind: 'options', optionCodes: ['salary'] },
      pick('own_property', 'yes'),
    ];
    expect(computeProbability(MIXED, answers, ['income_sources', 'own_property'])).toBe(1);
  });

  it('charges an asked-but-skipped numeric question its full weight', () => {
    const answers: SelectedAnswer[] = [
      { questionCode: 'income_sources', kind: 'options', optionCodes: ['salary'] },
      pick('own_property', 'yes'),
      { questionCode: 'employer_name', kind: 'text', hasValue: true },
    ];
    // 25 + 20 + 15 earned over the full 100 asked.
    expect(computeProbability(MIXED, answers, ASKED)).toBeCloseTo(0.6, 10);
  });
});

describe('askedWeightSum is the denominator the score actually used', () => {
  it('sums only the weights of asked questions', () => {
    expect(askedWeightSum(SCORING, ['income_band', 'job_tenure'])).toBe(75);
    expect(askedWeightSum(SCORING, ['income_band', 'job_tenure', 'own_property'])).toBe(100);
    expect(askedWeightSum(SCORING, ['not_weighted'])).toBe(0);
    expect(askedWeightSum(SCORING, [])).toBe(0);
  });

  it('accepts a Set as well as an array', () => {
    expect(askedWeightSum(SCORING, new Set(['income_band']))).toBe(40);
  });
});
