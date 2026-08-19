/**
 * Constitution V (v13.0.0) — preview and apply MUST derive the same asked set.
 *
 * The asked set is the scoring denominator, so any disagreement between the two
 * paths shows up as the SAME answers scoring differently before and after the
 * customer applies. Preview reads the frozen snapshot; apply reads live rows.
 * That is two implementations of one rule, which is precisely why it needs a
 * test rather than a comment.
 *
 * The specific trap this file pins down: a question's frozen `categories` being
 * ABSENT and being EMPTY mean opposite things.
 *
 *   absent  → snapshot published before v12.0.0, which had no assignment
 *             concept at all. Reads as "asked for every category", or every
 *             legacy snapshot would abruptly ask nothing.
 *   []      → v12.0.0+, written deliberately by `publish()` as
 *             `sortCategories(assignments.get(q.id) ?? [])`. The question is
 *             PARKED: assigned to nothing, therefore asked by nobody.
 *
 * Testing `categories.length > 0` collapses the two, which put a parked
 * question into preview's denominator while apply's `resolveAnswers` and the
 * customer questionnaire read both left it out.
 */
import { describe, expect, it, vi } from 'vitest';
import { MatchingPreviewService } from '@/matching-preview/matching-preview.service';
import type { SubmittedAnswerDto } from '@/questionnaire/dto/questionnaire.dto';
import { toSelectedAnswers } from '@/matching/scoring/answer-to-selected';
import {
  computeProbability,
  type ProgramScoring,
  type SelectedAnswer,
} from '@/matching/scoring/approval-probability.scorer';
import { validateAnswer } from '@/questionnaire/validation/answer-validation';

/** One group holding the three assignment states a snapshot can carry. */
const SNAPSHOT = {
  versionNumber: 7,
  groups: [
    {
      code: 'general',
      questions: [
        {
          code: 'employment_status',
          type: 'SINGLE_SELECT',
          isRequired: true,
          categories: ['personal', 'car'],
          options: [{ code: 'government' }, { code: 'private' }],
        },
        {
          code: 'property_type',
          type: 'SINGLE_SELECT',
          isRequired: false,
          // Assigned, but not to `personal`.
          categories: ['mortgage'],
          options: [{ code: 'villa' }, { code: 'apartment' }],
        },
        {
          code: 'retired_question',
          type: 'SINGLE_SELECT',
          isRequired: false,
          // PARKED — explicitly frozen as assigned to nothing.
          categories: [],
          options: [{ code: 'yes' }, { code: 'no' }],
        },
      ],
    },
  ],
};

/** A pre-v12 snapshot: the `categories` key was never frozen at all. */
const LEGACY_SNAPSHOT = {
  versionNumber: 2,
  groups: [
    {
      code: 'general',
      questions: [
        {
          code: 'employment_status',
          type: 'SINGLE_SELECT',
          isRequired: true,
          options: [{ code: 'government' }, { code: 'private' }],
        },
        {
          code: 'property_type',
          type: 'SINGLE_SELECT',
          isRequired: false,
          options: [{ code: 'villa' }, { code: 'apartment' }],
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
  requiredDocuments: [],
};

function makeService(snapshot: unknown = SNAPSHOT) {
  const scoreProgram = vi.fn(async () => ({
    probability: 0.42,
    tier: 'moderate',
    usedDefault: false,
  }));
  const service = new MatchingPreviewService(
    { activeVersion: async () => ({ id: 'ver', snapshot }) } as never,
    { scoreProgram } as never,
    { findAllActive: async () => [PROGRAM] } as never,
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

/** The asked set preview handed the scorer for this run. */
async function askedFor(
  answers: SubmittedAnswerDto[],
  snapshot: unknown = SNAPSHOT,
): Promise<string[]> {
  const { service, scoreProgram } = makeService(snapshot);
  await service.preview({ category: 'personal' as never, answers, age: 34 });
  const call = scoreProgram.mock.calls[0]?.[0] as unknown as { askedQuestionCodes: string[] };
  return [...call.askedQuestionCodes].sort();
}

const ANSWER: SubmittedAnswerDto[] = [
  { questionCode: 'employment_status', optionCode: 'government' } as SubmittedAnswerDto,
];

describe('preview narrows the asked set to the requested category', () => {
  it('asks a question assigned to this category', async () => {
    expect(await askedFor(ANSWER)).toContain('employment_status');
  });

  it('does not ask a question assigned only to another category', async () => {
    expect(await askedFor(ANSWER)).not.toContain('property_type');
  });

  it('does not ask a PARKED question (frozen categories: [])', async () => {
    // The regression. `categories.length > 0` used to let this through, so a
    // question nobody is ever shown still ate denominator weight in preview.
    expect(await askedFor(ANSWER)).not.toContain('retired_question');
  });

  it('asks exactly the in-category set and nothing else', async () => {
    expect(await askedFor(ANSWER)).toEqual(['employment_status']);
  });
});

describe('a pre-v12 snapshot still asks everything', () => {
  it('reads an ABSENT categories key as every category, not as none', async () => {
    // Distinct from `[]`: the key was never frozen, so there is no assignment
    // to honour. Excluding these would make every legacy snapshot ask nothing
    // and score every program 0.
    expect(await askedFor(ANSWER, LEGACY_SNAPSHOT)).toEqual([
      'employment_status',
      'property_type',
    ]);
  });
});

// ---------------------------------------------------------------------------
// v14.0.0 — the same parity requirement now covers the ANSWER SCORES too.
// ---------------------------------------------------------------------------

/** One question of every type, all asked for `personal`. */
const MIXED_SNAPSHOT = {
  versionNumber: 9,
  groups: [
    {
      code: 'general',
      questions: [
        {
          code: 'monthly_income',
          type: 'NUMERIC',
          isRequired: true,
          categories: ['personal'],
          options: [],
          numeric: { minValue: '0', maxValue: '500000' },
        },
        {
          code: 'income_sources',
          type: 'MULTI_SELECT',
          isRequired: false,
          categories: ['personal'],
          options: [{ code: 'salary' }, { code: 'rental' }, { code: 'freelance' }],
        },
        {
          code: 'employment_status',
          type: 'SINGLE_SELECT',
          isRequired: true,
          categories: ['personal'],
          options: [{ code: 'government' }, { code: 'private' }],
        },
        {
          code: 'employer_name',
          type: 'TEXT',
          isRequired: false,
          categories: ['personal'],
          options: [],
          text: { maxLength: 120 },
        },
      ],
    },
  ],
};

const MIXED_ANSWERS = [
  { questionCode: 'monthly_income', numericValue: '9000' },
  { questionCode: 'income_sources', optionCodes: ['salary', 'freelance'] },
  { questionCode: 'employment_status', optionCode: 'private' },
  { questionCode: 'employer_name', textValue: 'شركة النيل' },
] as unknown as SubmittedAnswerDto[];

const MIXED_SCORING: ProgramScoring = {
  questionWeights: {
    monthly_income: 40,
    income_sources: 25,
    employment_status: 20,
    employer_name: 15,
  },
  answerScores: {
    income_sources: { salary: 100, rental: 60, freelance: 20 },
    employment_status: { government: 100, private: 85 },
  },
  multiSelectRules: { income_sources: { aggregation: 'AVERAGE' } },
  numericBands: {
    monthly_income: [
      { from: null, to: '5000', score: 20 },
      { from: '5000', to: '15000', score: 60 },
      { from: '15000', to: null, score: 100 },
    ],
  },
  textRules: { employer_name: { answeredScore: 100 } },
};

/** What preview forwarded to the scorer for this run. */
async function previewCall(): Promise<{ answers: SelectedAnswer[]; asked: string[] }> {
  const { service, scoreProgram } = makeService(MIXED_SNAPSHOT);
  await service.preview({ category: 'personal' as never, answers: MIXED_ANSWERS, age: 34 });
  const call = scoreProgram.mock.calls[0]?.[0] as unknown as {
    answers: SelectedAnswer[];
    askedQuestionCodes: string[];
  };
  return { answers: call.answers, asked: call.askedQuestionCodes };
}

/**
 * What apply forwards: `resolveAnswers` validates each answer against the LIVE
 * question rows, then `applyPerBankScoring` maps the results with the same shared
 * mapper. The Prisma read is the only part not exercised here, so this stands in
 * for it with the same question definitions.
 */
function applyCall(): { answers: SelectedAnswer[]; asked: string[] } {
  const questions = MIXED_SNAPSHOT.groups[0]!.questions;
  const submitted = new Map(MIXED_ANSWERS.map((a) => [a.questionCode, a]));
  const normalised = questions.map((q) =>
    validateAnswer(
      {
        code: q.code,
        type: q.type,
        isRequired: q.isRequired,
        optionCodes: q.options.map((o) => o.code),
        numeric: q.numeric ?? null,
        text: q.text ?? null,
      },
      submitted.get(q.code),
    ),
  );
  return {
    answers: toSelectedAnswers(normalised.filter((a): a is NonNullable<typeof a> => a !== null)),
    asked: questions.map((q) => q.code),
  };
}

describe('preview and apply score a mixed-type answer set identically', () => {
  it('forwards the same asked set', async () => {
    const [preview, apply] = [await previewCall(), applyCall()];
    expect([...preview.asked].sort()).toEqual([...apply.asked].sort());
  });

  it('forwards the same typed answers, variant for variant', async () => {
    const [preview, apply] = [await previewCall(), applyCall()];
    const byCode = (list: SelectedAnswer[]) =>
      [...list].sort((a, b) => a.questionCode.localeCompare(b.questionCode));
    expect(byCode(preview.answers)).toEqual(byCode(apply.answers));
  });

  it('produces the same probability from the same weight set', async () => {
    const [preview, apply] = [await previewCall(), applyCall()];
    const score = (call: { answers: SelectedAnswer[]; asked: string[] }) =>
      computeProbability(MIXED_SCORING, call.answers, call.asked);
    // 40×0.60 + 25×0.60 + 20×0.85 + 15×1.00 = 24 + 15 + 17 + 15 = 71.
    expect(score(preview)).toBeCloseTo(0.71, 10);
    expect(score(apply)).toBeCloseTo(0.71, 10);
  });
});
