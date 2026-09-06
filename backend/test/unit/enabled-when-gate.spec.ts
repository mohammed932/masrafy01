import { describe, expect, it } from 'vitest';

import { enabledWhenGate, isQuestionVisible } from '@/questionnaire/validation/question-visibility';

/**
 * The gate reader carried onto `BoundQuestion`, so an operator screen can tell what KIND of
 * fact a question answers. The bar it has to clear is agreement with `isQuestionVisible`:
 * both read the same stored blob, and a caller asking "what is this gated on" must never get
 * a different answer from the one asking "is this shown".
 */
describe('enabledWhenGate', () => {
  it('reads a complete rule', () => {
    expect(
      enabledWhenGate({ enabledWhen: { questionCode: 'additional_income', optionCode: 'yes' } }),
    ).toEqual({
      questionCode: 'additional_income',
      optionCode: 'yes',
    });
  });

  it('answers null for a question asked of everyone', () => {
    expect(enabledWhenGate({ enabledWhen: null })).toBeNull();
    expect(enabledWhenGate({ enabledWhen: undefined })).toBeNull();
  });

  it('carries the operator, or rather ignores it — the GATE is the pair, not the comparison', () => {
    // `not_equals` still means "asked behind this question". What flips is which answer
    // shows it, and that is `isQuestionVisible`'s business, not this one's.
    expect(
      enabledWhenGate({
        enabledWhen: {
          questionCode: 'additional_income',
          operator: 'not_equals',
          optionCode: 'yes',
        },
      }),
    ).toEqual({ questionCode: 'additional_income', optionCode: 'yes' });
  });

  describe('a HALF rule reads as no gate, exactly as it reads as visible', () => {
    const halves = [
      { enabledWhen: { questionCode: 'additional_income' } },
      { enabledWhen: { optionCode: 'yes' } },
      { enabledWhen: {} },
    ];

    for (const [i, q] of halves.entries()) {
      it(`half ${i}: no gate, and still shown`, () => {
        expect(enabledWhenGate(q)).toBeNull();
        // The agreement that matters: a question this reports as ungated is one the
        // questionnaire puts in front of everybody.
        expect(isQuestionVisible(q, new Map(), new Map())).toBe(true);
      });
    }
  });

  it('is not fooled by a non-object blob', () => {
    expect(enabledWhenGate({ enabledWhen: 'additional_income' })).toBeNull();
    expect(enabledWhenGate({ enabledWhen: 42 })).toBeNull();
  });
});
