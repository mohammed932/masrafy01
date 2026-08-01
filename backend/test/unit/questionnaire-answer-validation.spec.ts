/**
 * T014 — the answer-validation matrix: four question types × correct/incorrect
 * payload → the expected typed error code (contracts/questionnaire.md, R8).
 *
 * Guards the contract that makes SC-004 possible: a figure only reaches the
 * engine if it arrived in the shape its question declared.
 */
import { describe, expect, it } from 'vitest';
import { ERROR_CODES } from '@/common/errors/error-codes';
import { DomainException } from '@/common/errors/domain.exceptions';
import {
  resolveQuestionType,
  validateAnswer,
  type AnswerableQuestion,
} from '@/questionnaire/validation/answer-validation';

const single: AnswerableQuestion = {
  code: 'employment_status',
  type: 'SINGLE_SELECT',
  isRequired: true,
  optionCodes: ['salaried', 'self_employed'],
};

const multi: AnswerableQuestion = {
  code: 'preferred_banks',
  type: 'MULTI_SELECT',
  isRequired: true,
  optionCodes: ['abk', 'cib', 'nbe'],
};

const text: AnswerableQuestion = {
  code: 'employer_name',
  type: 'TEXT',
  isRequired: true,
  optionCodes: [],
  text: { maxLength: 20 },
};

const numeric: AnswerableQuestion = {
  code: 'amount_requested',
  type: 'NUMERIC',
  isRequired: true,
  optionCodes: [],
  numeric: { minValue: '1000', maxValue: '20000', step: '1000' },
};

/** Assert a specific typed error code, not just "it threw". */
function expectCode(fn: () => unknown, code: string): void {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(DomainException);
    expect((e as DomainException).code).toBe(code);
    return;
  }
  throw new Error(`expected ${code} to be thrown`);
}

describe('validateAnswer — correct payload per type', () => {
  it('SINGLE_SELECT stores one code in both the canonical list and the legacy column', () => {
    const out = validateAnswer(single, { questionCode: single.code, optionCode: 'salaried' });
    expect(out).toEqual({
      questionCode: 'employment_status',
      type: 'SINGLE_SELECT',
      selectedOptionCodes: ['salaried'],
      // Kept populated so the scorer and the admin answer views are untouched (FR-045).
      selectedOptionCode: 'salaried',
      textValue: null,
      numericValue: null,
    });
  });

  it('MULTI_SELECT stores every pick and leaves the single-choice column null', () => {
    const out = validateAnswer(multi, { questionCode: multi.code, optionCodes: ['cib', 'abk'] });
    expect(out?.selectedOptionCodes).toEqual(['cib', 'abk']);
    expect(out?.selectedOptionCode).toBeNull();
  });

  it('MULTI_SELECT de-duplicates picks but keeps the submitted order', () => {
    const out = validateAnswer(multi, {
      questionCode: multi.code,
      optionCodes: ['nbe', 'abk', 'nbe'],
    });
    expect(out?.selectedOptionCodes).toEqual(['nbe', 'abk']);
  });

  it('TEXT trims and stores the string', () => {
    const out = validateAnswer(text, { questionCode: text.code, textValue: '  Acme Egypt  ' });
    expect(out?.textValue).toBe('Acme Egypt');
    expect(out?.selectedOptionCodes).toEqual([]);
  });

  it('NUMERIC normalises to a 2-dp decimal STRING, never a JS number', () => {
    const out = validateAnswer(numeric, { questionCode: numeric.code, numericValue: '5000' });
    expect(out?.numericValue).toBe('5000.00');
    expect(typeof out?.numericValue).toBe('string');
  });
});

describe('validateAnswer — wrong value key for the type → ANSWER_TYPE_MISMATCH', () => {
  const wrongPayloads: ReadonlyArray<[string, AnswerableQuestion, Record<string, unknown>]> = [
    ['single given a list', single, { optionCodes: ['salaried'] }],
    ['single given text', single, { textValue: 'salaried' }],
    ['single given a number', single, { numericValue: '1' }],
    ['multi given one code', multi, { optionCode: 'abk' }],
    ['multi given text', multi, { textValue: 'abk' }],
    ['text given a code', text, { optionCode: 'salaried' }],
    ['text given a number', text, { numericValue: '5000' }],
    ['numeric given a code', numeric, { optionCode: 'salaried' }],
    ['numeric given text', numeric, { textValue: '5000' }],
  ];

  for (const [label, question, payload] of wrongPayloads) {
    it(label, () => {
      expectCode(
        () => validateAnswer(question, { questionCode: question.code, ...payload }),
        ERROR_CODES.ANSWER_TYPE_MISMATCH,
      );
    });
  }

  it('a non-numeric string on a NUMERIC question is a mismatch, not a range error', () => {
    expectCode(
      () => validateAnswer(numeric, { questionCode: numeric.code, numericValue: 'abc' }),
      ERROR_CODES.ANSWER_TYPE_MISMATCH,
    );
  });
});

describe('validateAnswer — unknown option codes', () => {
  it('rejects a single-choice code that is not an option of this question', () => {
    expectCode(
      () => validateAnswer(single, { questionCode: single.code, optionCode: 'astronaut' }),
      ERROR_CODES.UNKNOWN_OPTION_CODE,
    );
  });

  it('rejects a multi-choice list containing one foreign code', () => {
    expectCode(
      () => validateAnswer(multi, { questionCode: multi.code, optionCodes: ['abk', 'nope'] }),
      ERROR_CODES.UNKNOWN_OPTION_CODE,
    );
  });
});

describe('validateAnswer — text length', () => {
  it('accepts text at exactly maxLength', () => {
    const out = validateAnswer(text, { questionCode: text.code, textValue: 'x'.repeat(20) });
    expect(out?.textValue).toHaveLength(20);
  });

  it('rejects text one character over maxLength with ANSWER_TOO_LONG', () => {
    expectCode(
      () => validateAnswer(text, { questionCode: text.code, textValue: 'x'.repeat(21) }),
      ERROR_CODES.ANSWER_TOO_LONG,
    );
  });

  it('falls back to the 500-character default when the question declares no maxLength', () => {
    const noRule: AnswerableQuestion = { ...text, text: null };
    expect(
      validateAnswer(noRule, { questionCode: noRule.code, textValue: 'x'.repeat(500) })?.textValue,
    ).toHaveLength(500);
    expectCode(
      () => validateAnswer(noRule, { questionCode: noRule.code, textValue: 'x'.repeat(501) }),
      ERROR_CODES.ANSWER_TOO_LONG,
    );
  });

  it('treats whitespace-only text as no answer at all', () => {
    expectCode(
      () => validateAnswer(text, { questionCode: text.code, textValue: '   ' }),
      ERROR_CODES.ANSWER_REQUIRED,
    );
  });
});

describe('validateAnswer — required vs optional', () => {
  it('raises ANSWER_REQUIRED for every type when a required answer is absent', () => {
    for (const q of [single, multi, text, numeric]) {
      expectCode(() => validateAnswer(q, undefined), ERROR_CODES.ANSWER_REQUIRED);
    }
  });

  it('returns null — not an error — when an optional answer is absent', () => {
    for (const q of [single, multi, text, numeric]) {
      expect(validateAnswer({ ...q, isRequired: false }, undefined)).toBeNull();
    }
  });

  it('treats an empty multi-select list as no answer', () => {
    expectCode(
      () => validateAnswer(multi, { questionCode: multi.code, optionCodes: [] }),
      ERROR_CODES.ANSWER_REQUIRED,
    );
  });
});

describe('resolveQuestionType — legacy snapshots (FR-045)', () => {
  it('reads a missing, null or unrecognised type as SINGLE_SELECT', () => {
    expect(resolveQuestionType(undefined)).toBe('SINGLE_SELECT');
    expect(resolveQuestionType(null)).toBe('SINGLE_SELECT');
    expect(resolveQuestionType('DROPDOWN_FROM_THE_FUTURE')).toBe('SINGLE_SELECT');
  });

  it('preserves every known type', () => {
    for (const t of ['SINGLE_SELECT', 'MULTI_SELECT', 'TEXT', 'NUMERIC'] as const) {
      expect(resolveQuestionType(t)).toBe(t);
    }
  });

  it('validates a type-less snapshot question as single choice', () => {
    const legacy: AnswerableQuestion = {
      code: 'legacy_q',
      isRequired: true,
      optionCodes: ['a', 'b'],
    };
    expect(validateAnswer(legacy, { questionCode: 'legacy_q', optionCode: 'a' })?.type).toBe(
      'SINGLE_SELECT',
    );
  });
});
