/**
 * T017 — scoreability guard (R9 / A33).
 *
 * Two guarantees:
 *   1. A weight set that names a MULTI_SELECT / TEXT / NUMERIC question is
 *      REJECTED with `QUESTION_TYPE_NOT_SCOREABLE`, and such questions never
 *      appear in the assignable list the admin editor renders.
 *   2. Existing single-choice scoring is byte-identical after feature 010 — the
 *      formula `Σ(questionWeight ÷ 100 × pickedAnswerScore ÷ 100)` is untouched.
 *
 * (2) is the load-bearing half: the whole reason multi-pick is excluded is that
 * any aggregate over several picked scores would be a NEW formula, which A33
 * makes a constitution amendment rather than an implementation choice.
 */
import { describe, expect, it } from 'vitest';
import type { QuestionType } from '@prisma/client';
import { ERROR_CODES } from '@/common/errors/error-codes';
import { DomainException } from '@/common/errors/domain.exceptions';
import { ScoringService } from '@/scoring/scoring.service';
import {
  computeProbability,
  equalWeights,
  normalizeWeights,
  type ProgramScoring,
} from '@/matching/scoring/approval-probability.scorer';

// ---------------------------------------------------------------------------
// A global pool holding one question of each type.
// ---------------------------------------------------------------------------

const POOL: ReadonlyArray<{
  code: string;
  type: QuestionType;
  questionAr: string;
  questionEn: string;
  options: { code: string; labelAr: string; labelEn: string }[];
}> = [
  {
    code: 'employment_status',
    type: 'SINGLE_SELECT',
    questionAr: 'الحالة الوظيفية',
    questionEn: 'Employment status',
    options: [
      { code: 'government', labelAr: 'حكومي', labelEn: 'Government' },
      { code: 'private', labelAr: 'خاص', labelEn: 'Private' },
    ],
  },
  {
    code: 'preferred_banks',
    type: 'MULTI_SELECT',
    questionAr: 'البنوك المفضلة',
    questionEn: 'Preferred banks',
    options: [
      { code: 'abk', labelAr: 'الكويتي', labelEn: 'ABK' },
      { code: 'cib', labelAr: 'التجاري', labelEn: 'CIB' },
    ],
  },
  {
    code: 'employer_name',
    type: 'TEXT',
    questionAr: 'جهة العمل',
    questionEn: 'Employer name',
    options: [],
  },
  {
    code: 'monthly_income',
    type: 'NUMERIC',
    questionAr: 'الدخل الشهري',
    questionEn: 'Monthly income',
    options: [],
  },
];

/**
 * Minimal fakes. `ScoringService` reaches Prisma only through repositories
 * (Principle X), so the guard is testable without a database.
 */
function makeService(): ScoringService {
  const questionnaire = { questionsWithOptions: async () => POOL.map((q) => ({ ...q })) };
  const programs = {
    findById: async () => ({
      programCode: 'ABK-PL-PAYROLL',
      friendlyName: 'Payroll Loan',
      friendlyNameAr: null,
      bankName: 'ABK Egypt',
      productCategory: 'personal',
    }),
  };
  const repo = { activeSet: async () => null, listByProgram: async () => [] };
  const audit = { write: async () => undefined };
  return new ScoringService(
    repo as never,
    audit as never,
    programs as never,
    questionnaire as never,
  );
}

/** Reach the private validator the save path runs, without a live save. */
function assertKnownStructure(
  service: ScoringService,
  weights: { questionWeights: Record<string, number>; answerScores: Record<string, Record<string, number>> },
): Promise<void> {
  return (
    service as unknown as {
      assertKnownStructure(w: typeof weights): Promise<void>;
    }
  ).assertKnownStructure(weights);
}

describe('assignable list excludes non-scoreable types', () => {
  it('offers only the SINGLE_SELECT question to the admin editor', async () => {
    const listed = await makeService().listWeightableOptions();
    expect(listed.map((q) => q.code)).toEqual(['employment_status']);
  });

  it('still carries the bilingual labels and options for the one it does offer', async () => {
    const [only] = await makeService().listWeightableOptions();
    expect(only).toMatchObject({
      code: 'employment_status',
      labelAr: 'الحالة الوظيفية',
      labelEn: 'Employment status',
    });
    expect(only?.options.map((o) => o.code)).toEqual(['government', 'private']);
  });
});

describe('saving a weight set that names a non-scoreable question is rejected', () => {
  const cases: ReadonlyArray<[string, QuestionType]> = [
    ['preferred_banks', 'MULTI_SELECT'],
    ['employer_name', 'TEXT'],
    ['monthly_income', 'NUMERIC'],
  ];

  for (const [questionCode, type] of cases) {
    it(`rejects a ${type} question referenced by questionWeights`, async () => {
      const service = makeService();
      await expect(
        assertKnownStructure(service, {
          questionWeights: { [questionCode]: 100 },
          answerScores: {},
        }),
      ).rejects.toMatchObject({
        code: ERROR_CODES.QUESTION_TYPE_NOT_SCOREABLE,
        meta: { questionCode, type },
      });
    });
  }

  it('rejects a MULTI_SELECT question referenced only by answerScores', async () => {
    const service = makeService();
    await expect(
      assertKnownStructure(service, {
        questionWeights: { employment_status: 100 },
        answerScores: { preferred_banks: { abk: 80 } },
      }),
    ).rejects.toBeInstanceOf(DomainException);
  });

  it('accepts a weight set that names only single-choice questions', async () => {
    const service = makeService();
    await expect(
      assertKnownStructure(service, {
        questionWeights: { employment_status: 100 },
        answerScores: { employment_status: { government: 100, private: 85 } },
      }),
    ).resolves.toBeUndefined();
  });
});

describe('existing single-choice scoring is byte-identical', () => {
  // A realistic pre-feature-010 program: three single-choice questions.
  const scoring: ProgramScoring = {
    questionWeights: { employment_status: 40, job_tenure: 35, salary_transfer: 25 },
    answerScores: {
      employment_status: { government: 100, private: 85, freelancer: 45 },
      job_tenure: { under_6m: 15, over_3y: 100 },
      salary_transfer: { yes: 100, no: 20 },
    },
  };

  it('reproduces the documented worked example exactly', () => {
    // 0.40×1.00 + 0.35×1.00 + 0.25×1.00 = 1.0 — best answer everywhere.
    expect(
      computeProbability(scoring, [
        { questionCode: 'employment_status', optionCode: 'government' },
        { questionCode: 'job_tenure', optionCode: 'over_3y' },
        { questionCode: 'salary_transfer', optionCode: 'yes' },
      ]),
    ).toBe(1);

    // 0.40×0.85 + 0.35×0.15 + 0.25×0.20 = 0.34 + 0.0525 + 0.05 = 0.4425
    expect(
      computeProbability(scoring, [
        { questionCode: 'employment_status', optionCode: 'private' },
        { questionCode: 'job_tenure', optionCode: 'under_6m' },
        { questionCode: 'salary_transfer', optionCode: 'no' },
      ]),
    ).toBeCloseTo(0.4425, 10);
  });

  it('contributes nothing for an unanswered or unscored question', () => {
    // Only the 40-weight question answered → 0.40 × 1.00.
    expect(
      computeProbability(scoring, [
        { questionCode: 'employment_status', optionCode: 'government' },
      ]),
    ).toBeCloseTo(0.4, 10);
    // A question outside the weight set adds zero rather than throwing.
    expect(
      computeProbability(scoring, [{ questionCode: 'preferred_banks', optionCode: 'abk' }]),
    ).toBe(0);
  });

  it('still upgrades a legacy single-level row on read', () => {
    const legacy = normalizeWeights({
      employment_status: { government: 100, private: 85 },
      job_tenure: { over_3y: 100 },
    });
    expect(legacy.questionWeights).toEqual(equalWeights(['employment_status', 'job_tenure']));
    expect(legacy.answerScores['employment_status']).toEqual({ government: 100, private: 85 });
  });

  it('keeps synthesised equal weights summing to exactly 100', () => {
    for (const n of [1, 3, 6, 7, 11]) {
      const codes = Array.from({ length: n }, (_, i) => `q${i}`);
      const weights = equalWeights(codes);
      expect(Object.values(weights).reduce((a, b) => a + b, 0)).toBe(100);
    }
  });
});
