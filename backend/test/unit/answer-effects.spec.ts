/**
 * Answer offer effects — the pure module every path shares (v31.2.0, v31.3.0).
 *
 * Preview, apply and the loan calculator all select effects with `answerPicksFromMaps` →
 * `answerEffectsFromAnswers` and apply them inside `quoteProgram` through the three lever
 * functions below, so these cases pin the one implementation all three read.
 */

import { describe, expect, it } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import {
  answerEffectsForProgram,
  answerEffectsFromAnswers,
  answerEffectsTenorCap,
  answerPicksFromMaps,
  applyAnswerEffectsToCap,
  applyAnswerEffectsToRate,
  numberEffectRangesOf,
  numberEffectRangesProblem,
  rangeHolds,
  type AnswerEffect,
  type AnswerEffectSource,
} from '../../src/matching/pipeline/answer-effects';

/** "Do you have a bank statement?" No → −20% / +2 points / 48 months; Yes → nothing. */
const BANK_STATEMENT_NO: AnswerEffectSource = {
  kind: 'option',
  questionCode: 'has_bank_statement',
  optionCode: 'no',
  incomeProofOnly: true,
  levers: { maxLoanPercent: '-20', ratePoints: '2', maxTenorMonths: 48 },
};

/** "Which loans do you have?" (several choices): two answers that each move the offer. */
const CAR_LOAN: AnswerEffectSource = {
  kind: 'option',
  questionCode: 'current_loans',
  optionCode: 'car_loan',
  incomeProofOnly: false,
  levers: { ratePoints: '0.5' },
};
const CREDIT_CARDS: AnswerEffectSource = {
  kind: 'option',
  questionCode: 'current_loans',
  optionCode: 'credit_cards',
  incomeProofOnly: false,
  levers: { maxLoanPercent: '-5' },
};

/** "Months in your current job" (a number): under 12 → −10% and +1; 60 and above → −0.5. */
const UNDER_12: AnswerEffectSource = {
  kind: 'range',
  questionCode: 'months_in_current_job',
  range: { fromInclusive: null, toExclusive: '12' },
  incomeProofOnly: false,
  levers: { maxLoanPercent: '-10', ratePoints: '1' },
};
const FROM_60: AnswerEffectSource = {
  kind: 'range',
  questionCode: 'months_in_current_job',
  range: { fromInclusive: '60', toExclusive: null },
  incomeProofOnly: false,
  levers: { ratePoints: '-0.5' },
};

const SOURCES = [CAR_LOAN, CREDIT_CARDS, BANK_STATEMENT_NO, UNDER_12, FROM_60];

function picks(over: {
  single?: Record<string, string>;
  multi?: Record<string, string[]>;
  numbers?: Record<string, string>;
}) {
  return answerPicksFromMaps({
    optionByCode: new Map(Object.entries(over.single ?? {})),
    multiByCode: new Map(Object.entries(over.multi ?? {})),
    numericByCode: new Map(Object.entries(over.numbers ?? {})),
  });
}

describe('answerPicksFromMaps', () => {
  it('reads single picks, multi picks and numbers by question code', () => {
    const p = picks({
      single: { has_bank_statement: 'no' },
      multi: { current_loans: ['car_loan', 'credit_cards'] },
      numbers: { months_in_current_job: '6' },
    });
    expect(p.options['has_bank_statement']).toEqual(['no']);
    expect(p.options['current_loans']).toEqual(['car_loan', 'credit_cards']);
    expect(p.numbers['months_in_current_job']).toBe('6');
  });
});

describe('answerEffectsFromAnswers — choice answers', () => {
  it('a Yes/No answer switches its effect on only for the answer it is set on', () => {
    const no = answerEffectsFromAnswers(SOURCES, picks({ single: { has_bank_statement: 'no' } }));
    expect(no).toEqual([
      {
        questionCode: 'has_bank_statement',
        optionCode: 'no',
        incomeProofOnly: true,
        maxLoanPercent: '-20',
        ratePoints: '2',
        maxTenorMonths: 48,
      },
    ]);
    const yes = answerEffectsFromAnswers(SOURCES, picks({ single: { has_bank_statement: 'yes' } }));
    expect(yes).toEqual([]);
  });

  it('a several-choices answer switches on the effect of EVERY answer picked', () => {
    const both = answerEffectsFromAnswers(
      SOURCES,
      picks({ multi: { current_loans: ['car_loan', 'credit_cards'] } }),
    );
    expect(both.map((e) => e.optionCode)).toEqual(['car_loan', 'credit_cards']);
    const one = answerEffectsFromAnswers(SOURCES, picks({ multi: { current_loans: ['none'] } }));
    expect(one).toEqual([]);
  });

  it('an unanswered question changes nothing', () => {
    expect(answerEffectsFromAnswers(SOURCES, picks({}))).toEqual([]);
  });

  it('a source with no lever set is no effect', () => {
    const empty: AnswerEffectSource = { ...BANK_STATEMENT_NO, levers: {} };
    expect(
      answerEffectsFromAnswers([empty], picks({ single: { has_bank_statement: 'no' } })),
    ).toEqual([]);
  });
});

describe('answerEffectsFromAnswers — number ranges', () => {
  const at = (months: string) =>
    answerEffectsFromAnswers(SOURCES, picks({ numbers: { months_in_current_job: months } }));

  it('a number inside a range takes that range, with the number recorded', () => {
    expect(at('6')).toEqual([
      {
        questionCode: 'months_in_current_job',
        range: { fromInclusive: null, toExclusive: '12' },
        value: '6',
        incomeProofOnly: false,
        maxLoanPercent: '-10',
        ratePoints: '1',
      },
    ]);
  });

  it('ranges are half-open: From is included, the upper number is not', () => {
    expect(at('11.99').map((e) => e.ratePoints)).toEqual(['1']);
    expect(at('12')).toEqual([]);
    expect(at('60').map((e) => e.ratePoints)).toEqual(['-0.5']);
    expect(at('59')).toEqual([]);
  });

  it('a number in no range changes nothing', () => {
    expect(at('24')).toEqual([]);
  });

  it('takes ONE range per number — the first that holds it', () => {
    const overlapping: AnswerEffectSource = {
      ...UNDER_12,
      range: { fromInclusive: '0', toExclusive: '100' },
      levers: { ratePoints: '9' },
    };
    const taken = answerEffectsFromAnswers(
      [UNDER_12, overlapping],
      picks({ numbers: { months_in_current_job: '6' } }),
    );
    expect(taken.map((e) => e.ratePoints)).toEqual(['1']);
  });
});

describe('rangeHolds', () => {
  it('reads open edges as unbounded and refuses a malformed edge', () => {
    expect(rangeHolds({ fromInclusive: null, toExclusive: null }, new Decimal(5))).toBe(true);
    expect(rangeHolds({ fromInclusive: 'abc', toExclusive: null }, new Decimal(5))).toBe(false);
  });
});

describe('numberEffectRangesProblem', () => {
  const r = (from: string | null, to: string | null, lever = { maxLoanPercent: '-10' }) => ({
    fromInclusive: from,
    toExclusive: to,
    ...lever,
  });

  it('accepts touching, ordered, non-overlapping ranges', () => {
    expect(numberEffectRangesProblem([r(null, '12'), r('12', '60'), r('60', null)])).toBeNull();
  });

  it('refuses a range with no edge, an inverted one, an overlap and a range that changes nothing', () => {
    expect(numberEffectRangesProblem([r(null, null)])).toBe('no_bounds');
    expect(numberEffectRangesProblem([r('24', '12')])).toBe('order');
    expect(numberEffectRangesProblem([r('12', '12')])).toBe('order');
    expect(numberEffectRangesProblem([r(null, '12'), r('6', '24')])).toBe('overlap');
    expect(numberEffectRangesProblem([r('60', null), r('100', '200')])).toBe('overlap');
    expect(
      numberEffectRangesProblem([{ fromInclusive: null, toExclusive: '12' }]),
    ).toBe('no_lever');
    expect(numberEffectRangesProblem([r('x', null)])).toBe('bad_number');
  });

  it('caps the list at twenty ranges', () => {
    const many = Array.from({ length: 21 }, (_, i) => r(String(i), String(i + 1)));
    expect(numberEffectRangesProblem(many)).toBe('too_many');
  });
});

describe('numberEffectRangesOf', () => {
  it('reads stored ranges and drops what is not one', () => {
    expect(
      numberEffectRangesOf([
        { fromInclusive: null, toExclusive: '12', maxLoanPercent: '-10', ratePoints: 1 },
        'junk',
        { fromInclusive: 5 },
        { fromInclusive: '60', toExclusive: null, maxTenorMonths: 48 },
      ]),
    ).toEqual([
      // A non-string `ratePoints` is not a figure and is dropped, not coerced.
      { fromInclusive: null, toExclusive: '12', maxLoanPercent: '-10' },
      { fromInclusive: '60', toExclusive: null, maxTenorMonths: 48 },
    ]);
    expect(numberEffectRangesOf(null)).toEqual([]);
  });
});

describe('the three levers', () => {
  const effect = (over: Partial<AnswerEffect>): AnswerEffect => ({
    questionCode: 'q',
    incomeProofOnly: false,
    ...over,
  });

  it('max loan: a cut and a raise, each step rounded to piastres, compounding in order', () => {
    const cap = new Decimal('1000000');
    expect(applyAnswerEffectsToCap(cap, [effect({ maxLoanPercent: '-20' })]).cap.toFixed(2)).toBe(
      '800000.00',
    );
    expect(applyAnswerEffectsToCap(cap, [effect({ maxLoanPercent: '10' })]).cap.toFixed(2)).toBe(
      '1100000.00',
    );
    const both = applyAnswerEffectsToCap(cap, [
      effect({ maxLoanPercent: '-20' }),
      effect({ maxLoanPercent: '-10' }),
    ]);
    expect(both.cap.toFixed(2)).toBe('720000.00');
    expect(both.moved).toBe(true);
  });

  it('max loan: no effect, zero and −100% or lower leave the cap alone', () => {
    const cap = new Decimal('1000000');
    for (const e of [[], [effect({ maxLoanPercent: '0' })], [effect({ maxLoanPercent: '-100' })]]) {
      const out = applyAnswerEffectsToCap(cap, e);
      expect(out.cap.toFixed(2)).toBe('1000000.00');
      expect(out.moved).toBe(false);
    }
  });

  it('rate: points add up, and the rate never goes under zero', () => {
    expect(
      applyAnswerEffectsToRate(new Decimal('24'), [
        effect({ ratePoints: '2' }),
        effect({ ratePoints: '-0.5' }),
      ]).toFixed(4),
    ).toBe('25.5000');
    expect(applyAnswerEffectsToRate(new Decimal('3'), [effect({ ratePoints: '-5' })]).toFixed(4)).toBe(
      '0.0000',
    );
  });

  it('term: the shortest ceiling wins; none set is no ceiling', () => {
    expect(
      answerEffectsTenorCap([effect({ maxTenorMonths: 60 }), effect({ maxTenorMonths: 48 })]),
    ).toBe(48);
    expect(answerEffectsTenorCap([effect({ ratePoints: '1' })])).toBeNull();
  });
});

describe('answerEffectsForProgram', () => {
  const incomeProofOnly: AnswerEffect = {
    questionCode: 'has_bank_statement',
    optionCode: 'no',
    incomeProofOnly: true,
    ratePoints: '2',
  };
  const everyProgram: AnswerEffect = {
    questionCode: 'months_in_current_job',
    incomeProofOnly: false,
    ratePoints: '1',
  };

  it('an income-proof question changes income-proof programs only', () => {
    expect(answerEffectsForProgram([incomeProofOnly, everyProgram], 'income_proof')).toEqual([
      incomeProofOnly,
      everyProgram,
    ]);
    expect(answerEffectsForProgram([incomeProofOnly, everyProgram], 'income_surrogate')).toEqual([
      everyProgram,
    ]);
  });

  it('no effects is no effects', () => {
    expect(answerEffectsForProgram(undefined, 'income_proof')).toEqual([]);
    expect(answerEffectsForProgram([], 'income_surrogate')).toEqual([]);
  });
});
