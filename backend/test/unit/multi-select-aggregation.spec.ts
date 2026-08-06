/**
 * MULTI_SELECT scoring (Constitution V, v14.0.0).
 *
 * A multi-pick answer has several option scores where the formula needs one, so
 * before v14.0.0 it was simply excluded. The program now says HOW its picks
 * combine, because no single rule is right for every question:
 *
 *   AVERAGE     "how good is your mix" — the default, and the only mode that
 *               cannot change a one-pick answer's meaning.
 *   SUM_CAPPED  "how much do you have" — more sources is better (capped at 100).
 *   MAX         "best of" — extra picks never hurt.
 *   MIN         "worst of" — one bad pick drags the answer down. Right for
 *               "which of these debts do you hold".
 *
 * Locking a single mode would push admins to distort per-option scores to fake
 * the semantics, which is exactly the kind of hidden judgement the weights screen
 * exists to make visible.
 */
import { describe, expect, it } from 'vitest';
import {
  answerScoreFor,
  computeProbability,
  DEFAULT_MULTI_SELECT_AGGREGATION,
  isMultiSelectAggregation,
  MULTI_SELECT_AGGREGATIONS,
  type MultiSelectAggregation,
  type ProgramScoring,
} from '@/matching/scoring/approval-probability.scorer';

const OPTION_SCORES = { salary: 100, rental: 60, freelance: 20, gift: 0 };

function scoring(aggregation?: MultiSelectAggregation): ProgramScoring {
  return {
    questionWeights: { income_sources: 100 },
    answerScores: { income_sources: OPTION_SCORES },
    ...(aggregation ? { multiSelectRules: { income_sources: { aggregation } } } : {}),
  };
}

const picks = (...optionCodes: string[]) =>
  ({ questionCode: 'income_sources', kind: 'options', optionCodes }) as const;

describe('each aggregation combines the same picks differently', () => {
  const cases: ReadonlyArray<[MultiSelectAggregation, number]> = [
    ['AVERAGE', 60], // (100 + 20) / 2
    ['SUM_CAPPED', 100], // 100 + 20, capped
    ['MAX', 100],
    ['MIN', 20],
  ];

  for (const [aggregation, expected] of cases) {
    it(`${aggregation} scores salary + freelance as ${expected}`, () => {
      expect(answerScoreFor(scoring(aggregation), picks('salary', 'freelance'))).toBe(expected);
    });
  }

  it('SUM_CAPPED rewards breadth up to the cap', () => {
    const sum = scoring('SUM_CAPPED');
    expect(answerScoreFor(sum, picks('freelance'))).toBe(20);
    expect(answerScoreFor(sum, picks('freelance', 'rental'))).toBe(80);
    expect(answerScoreFor(sum, picks('freelance', 'rental', 'salary'))).toBe(100);
  });

  it('MIN punishes the worst pick however many good ones came with it', () => {
    const min = scoring('MIN');
    expect(answerScoreFor(min, picks('salary', 'rental'))).toBe(60);
    expect(answerScoreFor(min, picks('salary', 'rental', 'gift'))).toBe(0);
  });

  it('every mode agrees when exactly one option is picked', () => {
    for (const aggregation of MULTI_SELECT_AGGREGATIONS) {
      expect(answerScoreFor(scoring(aggregation), picks('rental'))).toBe(60);
    }
  });
});

describe('the default and the guard', () => {
  it('falls back to AVERAGE when the program stored no aggregation', () => {
    expect(DEFAULT_MULTI_SELECT_AGGREGATION).toBe('AVERAGE');
    // A legacy row has option scores but no rule block, and must keep scoring.
    expect(answerScoreFor(scoring(), picks('salary', 'freelance'))).toBe(60);
  });

  it('recognises only the four modes', () => {
    for (const aggregation of MULTI_SELECT_AGGREGATIONS) {
      expect(isMultiSelectAggregation(aggregation)).toBe(true);
    }
    for (const bogus of ['MEDIAN', 'average', '', null, undefined, 3]) {
      expect(isMultiSelectAggregation(bogus)).toBe(false);
    }
  });
});

describe('picks the program did not score', () => {
  it('counts an unscored option as 0 — it was offered and chosen, not missing', () => {
    // AVERAGE over salary(100) and an option with no score(0).
    expect(answerScoreFor(scoring('AVERAGE'), picks('salary', 'unscored_option'))).toBe(50);
    expect(answerScoreFor(scoring('MIN'), picks('salary', 'unscored_option'))).toBe(0);
  });

  it('returns null when the program scored no option of this question at all', () => {
    const unscored: ProgramScoring = { questionWeights: { income_sources: 100 }, answerScores: {} };
    expect(answerScoreFor(unscored, picks('salary'))).toBeNull();
    expect(computeProbability(unscored, [picks('salary')], ['income_sources'])).toBe(0);
  });

  it('returns null for an empty pick list', () => {
    // `validateAnswer` rejects this upstream; the scorer must not divide by zero.
    expect(answerScoreFor(scoring('AVERAGE'), picks())).toBeNull();
  });
});

describe('a multi-select question scores through the formula like any other', () => {
  it('weights the aggregated score against the asked-weight denominator', () => {
    const mixed: ProgramScoring = {
      questionWeights: { income_sources: 40, own_property: 60 },
      answerScores: { income_sources: OPTION_SCORES, own_property: { yes: 100, no: 0 } },
      multiSelectRules: { income_sources: { aggregation: 'AVERAGE' } },
    };
    // 40 × 0.60 + 60 × 1.00 = 84 over 100.
    expect(
      computeProbability(
        mixed,
        [
          picks('salary', 'freelance'),
          { questionCode: 'own_property', kind: 'option', optionCode: 'yes' },
        ],
        ['income_sources', 'own_property'],
      ),
    ).toBeCloseTo(0.84, 10);
  });
});
