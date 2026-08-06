/**
 * T016 — per-type question rules (contracts/questionnaire.md).
 *
 * These stop an admin from building a question the app cannot render: a choice
 * with one option, a number question with options, an inverted range, a
 * non-positive step, or bounds on the wrong type.
 *
 * They are also the A33 guard rail: the rules here are CONTENT only. If a future
 * change adds a scoring, eligibility, or profile-mapping field to `Question`,
 * this file is where the absence of one should be noticed.
 */
import { describe, expect, it } from 'vitest';
import { ERROR_CODES } from '@/common/errors/error-codes';
import { DomainException } from '@/common/errors/domain.exceptions';
import {
  assertBranchSourceIsChoice,
  assertQuestionTypeRules,
  isChoiceType,
  isScoreableType,
  type QuestionTypeRulesInput,
} from '@/questionnaire/validation/question-type-rules';

function expectInvalid(input: QuestionTypeRulesInput, field: string): DomainException {
  try {
    assertQuestionTypeRules(input);
  } catch (e) {
    expect(e).toBeInstanceOf(DomainException);
    expect((e as DomainException).code).toBe(ERROR_CODES.QUESTION_TYPE_RULES_INVALID);
    expect((e as DomainException).meta).toMatchObject({ field });
    return e as DomainException;
  }
  throw new Error(`expected QUESTION_TYPE_RULES_INVALID on ${field}`);
}

describe('option count', () => {
  it('accepts a choice question with two or more active options', () => {
    for (const type of ['SINGLE_SELECT', 'MULTI_SELECT'] as const) {
      expect(() => assertQuestionTypeRules({ type, activeOptionCount: 2 })).not.toThrow();
      expect(() => assertQuestionTypeRules({ type, activeOptionCount: 7 })).not.toThrow();
    }
  });

  it('rejects a choice question with fewer than two options', () => {
    for (const type of ['SINGLE_SELECT', 'MULTI_SELECT'] as const) {
      expectInvalid({ type, activeOptionCount: 1 }, 'options');
      expectInvalid({ type, activeOptionCount: 0 }, 'options');
    }
  });

  it('rejects options on a value type — a number field has nothing to pick', () => {
    expectInvalid({ type: 'NUMERIC', activeOptionCount: 3 }, 'options');
    expectInvalid({ type: 'TEXT', activeOptionCount: 2 }, 'options');
  });

  it('accepts a value type with no options', () => {
    expect(() => assertQuestionTypeRules({ type: 'NUMERIC', activeOptionCount: 0 })).not.toThrow();
    expect(() => assertQuestionTypeRules({ type: 'TEXT', activeOptionCount: 0 })).not.toThrow();
  });
});

describe('numeric rules', () => {
  const ok = (numeric: QuestionTypeRulesInput['numeric']): QuestionTypeRulesInput => ({
    type: 'NUMERIC',
    activeOptionCount: 0,
    numeric,
  });

  it('accepts an ordered range with a positive step', () => {
    expect(() =>
      assertQuestionTypeRules(
        ok({ minValue: '1000', maxValue: '20000000', step: '1000', unitEn: 'EGP', unitAr: 'جنيه' }),
      ),
    ).not.toThrow();
  });

  it('accepts a range with no step and a step with no range', () => {
    expect(() => assertQuestionTypeRules(ok({ minValue: '0', maxValue: '5000000' }))).not.toThrow();
    expect(() => assertQuestionTypeRules(ok({ step: '100' }))).not.toThrow();
  });

  it('rejects max below min', () => {
    expectInvalid(ok({ minValue: '5000', maxValue: '1000' }), 'numeric.maxValue');
  });

  it('accepts max equal to min — a single legal value is odd but not incoherent', () => {
    expect(() => assertQuestionTypeRules(ok({ minValue: '60', maxValue: '60' }))).not.toThrow();
  });

  it('rejects a zero or negative step', () => {
    expectInvalid(ok({ step: '0' }), 'numeric.step');
    expectInvalid(ok({ step: '-100' }), 'numeric.step');
  });

  it('rejects a step wider than the whole range — it would leave one legal value', () => {
    expectInvalid(ok({ minValue: '0', maxValue: '100', step: '500' }), 'numeric.step');
  });

  it('rejects numeric rules on a non-numeric question', () => {
    expectInvalid(
      { type: 'TEXT', activeOptionCount: 0, numeric: { minValue: '1' } },
      'numeric',
    );
    expectInvalid(
      { type: 'SINGLE_SELECT', activeOptionCount: 2, numeric: { unitEn: 'EGP' } },
      'numeric',
    );
  });
});

describe('text rules', () => {
  it('accepts a length inside 1…2000', () => {
    for (const maxLength of [1, 120, 2000]) {
      expect(() =>
        assertQuestionTypeRules({ type: 'TEXT', activeOptionCount: 0, text: { maxLength } }),
      ).not.toThrow();
    }
  });

  it('rejects a length outside 1…2000', () => {
    expectInvalid({ type: 'TEXT', activeOptionCount: 0, text: { maxLength: 0 } }, 'text.maxLength');
    expectInvalid(
      { type: 'TEXT', activeOptionCount: 0, text: { maxLength: 2001 } },
      'text.maxLength',
    );
  });

  it('rejects text rules on a non-text question', () => {
    expectInvalid(
      { type: 'NUMERIC', activeOptionCount: 0, text: { maxLength: 100 } },
      'text',
    );
  });
});

describe('branch sources', () => {
  it('allows a branch on either choice type — enabledWhen compares an option code', () => {
    expect(() => assertBranchSourceIsChoice('SINGLE_SELECT', 'employment_status')).not.toThrow();
    expect(() => assertBranchSourceIsChoice('MULTI_SELECT', 'preferred_banks')).not.toThrow();
  });

  it('rejects a branch on a value type — there is no option code to compare', () => {
    for (const type of ['TEXT', 'NUMERIC'] as const) {
      try {
        assertBranchSourceIsChoice(type, 'monthly_income');
        throw new Error('expected a throw');
      } catch (e) {
        expect((e as DomainException).code).toBe(ERROR_CODES.QUESTION_TYPE_RULES_INVALID);
        expect((e as DomainException).meta).toMatchObject({ field: 'enabledWhen.questionCode' });
      }
    }
  });
});

describe('scoreability (Constitution V, v14.0.0)', () => {
  it('treats every type as scoreable', () => {
    for (const type of ['SINGLE_SELECT', 'MULTI_SELECT', 'TEXT', 'NUMERIC'] as const) {
      expect(isScoreableType(type)).toBe(true);
    }
  });

  it('keeps "has options" and "is scoreable" as separate questions', () => {
    // A value type is scoreable without options — by band (NUMERIC) or by
    // presence (TEXT) — so the two predicates must not be conflated in either
    // direction. `assertQuestionTypeRules` still forbids options on value types.
    expect(isChoiceType('NUMERIC')).toBe(false);
    expect(isScoreableType('NUMERIC')).toBe(true);
    expect(isChoiceType('MULTI_SELECT')).toBe(true);
    expect(isScoreableType('MULTI_SELECT')).toBe(true);
  });
});
