/**
 * Feature 010 — the questionnaire is one GLOBAL pool holding all four question
 * types, so the matching preview (mobile) and the admin simulator that shares it
 * must accept number / text / multi-pick answers, not just single picks.
 *
 * Before this, `resolveSelectedOptions` looked for an `optionCode` on every
 * answer and rejected everything else with `UNKNOWN_OPTION_CODE`, which made the
 * admin simulator unusable — its first two questions are NUMERIC.
 *
 * Only SINGLE_SELECT carries an answer score (R9), so the other types are
 * validated and then dropped from the scoring input rather than rejected.
 */
import { describe, expect, it, vi } from 'vitest';
import { MatchingPreviewService } from '@/matching-preview/matching-preview.service';
import { ERROR_CODES } from '@/common/errors/error-codes';
import type { SubmittedAnswerDto } from '@/questionnaire/dto/questionnaire.dto';

const SNAPSHOT = {
  versionNumber: 3,
  groups: [
    {
      code: 'financing_info',
      questions: [
        {
          code: 'amount_requested',
          type: 'NUMERIC',
          isRequired: true,
          numeric: { minValue: '1000.00', maxValue: '20000000.00', step: '1000.00' },
          options: [],
        },
        {
          code: 'loan_purpose',
          type: 'SINGLE_SELECT',
          isRequired: true,
          options: [{ code: 'marriage' }, { code: 'education' }],
        },
        {
          code: 'current_loans',
          type: 'MULTI_SELECT',
          isRequired: true,
          options: [{ code: 'none' }, { code: 'personal_loan' }],
        },
        {
          code: 'notes',
          type: 'TEXT',
          isRequired: false,
          text: { maxLength: 10 },
          options: [],
        },
      ],
    },
  ],
};

const PROGRAM = {
  id: 'prog_1',
  programCode: 'CIB-PRIME-PERSONAL',
  bankName: 'CIB',
  bank: { isFeatured: false },
  isShariaCompliant: false,
  friendlyName: 'Prime Personal Loan',
  productCategory: 'PERSONAL',
  requiredDocuments: ['national_id'],
};

function makeService() {
  const scoreProgram = vi.fn(async () => ({ probability: 0.42, tier: 'moderate', usedDefault: false }));
  const questionnaire = { activeVersion: async () => ({ id: 'ver_3', snapshot: SNAPSHOT }) };
  const programs = { findAllActive: async () => [PROGRAM] };
  const service = new MatchingPreviewService(
    questionnaire as never,
    { scoreProgram } as never,
    programs as never,
    // Feature 011 added a 4th and 5th dependency (the catalog name scope and the
    // enumeration registry); this spec predates both. `assertOfferedUnder` is a no-op
    // because these cases pass no `programNameKey`, and the registry reads return empty:
    // no rule here reads a fact or a registry parent, so an empty registry is the honest
    // answer rather than a convenient one.
    { assertOfferedUnder: async () => undefined } as never,
    {
      programNameIncomeRules: async () => new Map(),
      surrogateFactRegistry: async () => [],
      enumerationParentKeys: async () => ({}),
    } as never,
  );
  return { service, scoreProgram };
}

function preview(answers: SubmittedAnswerDto[]) {
  const { service, scoreProgram } = makeService();
  // Age is derived from the caller's birthday in production, never submitted.
  return {
    result: service.preview({ category: 'personal' as never, answers, age: 34 }),
    scoreProgram,
  };
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return (error as { code: string }).code;
  }
  throw new Error('expected the preview to reject');
}

describe('the preview accepts every answer type in the global pool', () => {
  it('scores a run whose answers mix numbers, multi-pick and single pick', async () => {
    const { result, scoreProgram } = preview([
      { questionCode: 'amount_requested', numericValue: '150000' },
      { questionCode: 'current_loans', optionCodes: ['none'] },
      { questionCode: 'loan_purpose', optionCode: 'marriage' },
      { questionCode: 'notes', textValue: 'ok' },
    ]);
    const matches = (await result).matches;

    expect(matches).toHaveLength(1);
    expect(matches[0]?.approvalProbability).toBe(0.42);
    // Every type reaches the scorer since v14.0.0, each as its own variant —
    // before, only the single pick was forwarded and the rest were dropped after
    // validation, so a numeric or multi-pick answer could never move the score.
    expect(scoreProgram).toHaveBeenCalledWith(
      expect.objectContaining({
        answers: [
          { questionCode: 'amount_requested', kind: 'numeric', value: '150000.00' },
          { questionCode: 'current_loans', kind: 'options', optionCodes: ['none'] },
          { questionCode: 'loan_purpose', kind: 'option', optionCode: 'marriage' },
          { questionCode: 'notes', kind: 'text', hasValue: true },
        ],
      }),
    );
  });

  it('accepts a partial answer set — required questions are enforced at apply, not here', async () => {
    const { result } = preview([{ questionCode: 'loan_purpose', optionCode: 'education' }]);
    await expect(result).resolves.toMatchObject({ category: 'personal' });
  });
});

describe('typed answers are validated with the same rules as apply', () => {
  it('rejects a number below the published minimum', async () => {
    const { result } = preview([{ questionCode: 'amount_requested', numericValue: '100' }]);
    expect(await codeOf(result)).toBe(ERROR_CODES.ANSWER_OUT_OF_RANGE);
  });

  it('rejects a number off the published step', async () => {
    const { result } = preview([{ questionCode: 'amount_requested', numericValue: '1500' }]);
    expect(await codeOf(result)).toBe(ERROR_CODES.ANSWER_OUT_OF_RANGE);
  });

  it('rejects an option code sent for a NUMERIC question', async () => {
    const { result } = preview([{ questionCode: 'amount_requested', optionCode: 'under_50k' }]);
    expect(await codeOf(result)).toBe(ERROR_CODES.ANSWER_TYPE_MISMATCH);
  });

  it('rejects text longer than the published maximum', async () => {
    const { result } = preview([{ questionCode: 'notes', textValue: 'far too long to fit' }]);
    expect(await codeOf(result)).toBe(ERROR_CODES.ANSWER_TOO_LONG);
  });

  it('rejects an option code that is not on the question', async () => {
    const { result } = preview([{ questionCode: 'loan_purpose', optionCode: 'not_an_option' }]);
    expect(await codeOf(result)).toBe(ERROR_CODES.UNKNOWN_OPTION_CODE);
  });

  it('rejects a question code that is not in the snapshot', async () => {
    const { result } = preview([{ questionCode: 'ghost', optionCode: 'x' }]);
    expect(await codeOf(result)).toBe(ERROR_CODES.UNKNOWN_QUESTION_CODE);
  });
});
