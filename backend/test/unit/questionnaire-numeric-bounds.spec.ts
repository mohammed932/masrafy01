/**
 * T015 — number-answer bounds: below min, above max, off step, and both bounds
 * INCLUSIVE. This is the test that keeps a customer's real figure real: the whole
 * point of feature 010 is that 500 000 stays 500 000 instead of becoming a bucket
 * midpoint, and that a figure outside what the bank will book is refused rather
 * than silently clamped.
 */
import { describe, expect, it } from 'vitest';
import { ERROR_CODES } from '@/common/errors/error-codes';
import { DomainException } from '@/common/errors/domain.exceptions';
import { validateAnswer, type AnswerableQuestion } from '@/questionnaire/validation/answer-validation';
import { MONEY_FIELD_BINDINGS } from '@/matching/pipeline/money-field-bindings';

/** The seeded `amount_requested` question: 1 000 … 20 000 000, step 1 000. */
const amount: AnswerableQuestion = {
  code: MONEY_FIELD_BINDINGS.requested_amount,
  type: 'NUMERIC',
  isRequired: true,
  optionCodes: [],
  numeric: { minValue: '1000', maxValue: '20000000', step: '1000' },
};

/** The seeded `repayment_period_months` question: 6 … 120, step 6. */
const tenor: AnswerableQuestion = {
  code: MONEY_FIELD_BINDINGS.tenor_months,
  type: 'NUMERIC',
  isRequired: true,
  optionCodes: [],
  numeric: { minValue: '6', maxValue: '120', step: '6' },
};

/** The seeded `current_installments` question: 0 … 5 000 000, no step. */
const obligations: AnswerableQuestion = {
  code: MONEY_FIELD_BINDINGS.existing_obligations,
  type: 'NUMERIC',
  isRequired: true,
  optionCodes: [],
  numeric: { minValue: '0', maxValue: '5000000' },
};

function submit(q: AnswerableQuestion, numericValue: string): string | null | undefined {
  return validateAnswer(q, { questionCode: q.code, numericValue })?.numericValue;
}

function expectOutOfRange(q: AnswerableQuestion, numericValue: string): DomainException {
  try {
    validateAnswer(q, { questionCode: q.code, numericValue });
  } catch (e) {
    expect(e).toBeInstanceOf(DomainException);
    expect((e as DomainException).code).toBe(ERROR_CODES.ANSWER_OUT_OF_RANGE);
    return e as DomainException;
  }
  throw new Error(`expected ${numericValue} to be out of range`);
}

describe('numeric bounds are inclusive', () => {
  it('accepts a value exactly at the minimum', () => {
    expect(submit(amount, '1000')).toBe('1000.00');
    expect(submit(tenor, '6')).toBe('6.00');
  });

  it('accepts a value exactly at the maximum', () => {
    expect(submit(amount, '20000000')).toBe('20000000.00');
    expect(submit(tenor, '120')).toBe('120.00');
  });

  it('accepts zero when the minimum is zero — no current obligations is a real answer', () => {
    expect(submit(obligations, '0')).toBe('0.00');
  });
});

describe('numeric bounds reject out-of-range values', () => {
  it('rejects below the minimum', () => {
    expectOutOfRange(amount, '999');
    expectOutOfRange(tenor, '5');
  });

  it('rejects above the maximum', () => {
    expectOutOfRange(amount, '20000001');
    expectOutOfRange(tenor, '126');
  });

  it('rejects a negative value even when the minimum is zero', () => {
    expectOutOfRange(obligations, '-1');
  });

  it('reports the bounds in meta so the client can say what is allowed', () => {
    const e = expectOutOfRange(amount, '999');
    expect(e.meta).toMatchObject({
      questionCode: MONEY_FIELD_BINDINGS.requested_amount,
      min: '1000.00',
      max: '20000000.00',
      step: '1000.00',
    });
  });
});

describe('step is measured from the minimum', () => {
  it('accepts values on the step grid', () => {
    expect(submit(amount, '2000')).toBe('2000.00');
    expect(submit(amount, '500000')).toBe('500000.00');
    // 6 + 9×6 = 60 months — the common 5-year term.
    expect(submit(tenor, '60')).toBe('60.00');
  });

  it('rejects values off the step grid', () => {
    expectOutOfRange(amount, '1500');
    expectOutOfRange(tenor, '61');
  });

  it('rejects a fractional tenor — months are whole (contracts/questionnaire.md)', () => {
    expectOutOfRange(tenor, '60.50');
  });

  it('applies no step constraint when the question declares none', () => {
    expect(submit(obligations, '2137.55')).toBe('2137.55');
  });

  it('measures the grid from minValue, not from zero', () => {
    const offsetGrid: AnswerableQuestion = {
      code: 'offset_grid',
      type: 'NUMERIC',
      isRequired: true,
      optionCodes: [],
      numeric: { minValue: '5', maxValue: '100', step: '10' },
    };
    // 5, 15, 25 … are on the grid; 10 and 20 are not.
    expect(submit(offsetGrid, '25')).toBe('25.00');
    expectOutOfRange(offsetGrid, '20');
  });
});

describe('numeric answers stay decimal strings (Principle I)', () => {
  it('normalises to exactly 2 decimal places', () => {
    expect(submit(obligations, '2000')).toBe('2000.00');
    expect(submit(obligations, '2000.5')).toBe('2000.50');
  });

  it('keeps large figures exact — no float rounding', () => {
    // 19 999 000 is on the 1 000 grid and near the ceiling; a float round-trip
    // through Number would be the classic place to lose a digit.
    expect(submit(amount, '19999000')).toBe('19999000.00');
  });

  it('accepts a value with no bounds declared at all', () => {
    const free: AnswerableQuestion = {
      code: 'free_number',
      type: 'NUMERIC',
      isRequired: true,
      optionCodes: [],
      numeric: null,
    };
    expect(submit(free, '12345.67')).toBe('12345.67');
  });
});
