/**
 * Per-type scoring rules on save (Constitution V, v14.0.0 — was T017 / R9).
 *
 * Until v14.0.0 this file asserted the opposite of what it asserts now: a weight
 * set naming a MULTI_SELECT / TEXT / NUMERIC question was rejected outright with
 * `QUESTION_TYPE_NOT_SCOREABLE`, and those questions never reached the admin
 * editor. That is what kept income, existing debts, requested amount and term out
 * of every match score. Every type is scoreable now; what the save path enforces
 * instead is that each weighted question carries the rule ITS OWN type is scored
 * by, and that no rule block lands on a question of the wrong type.
 *
 * Three guarantees:
 *   1. The assignable list offers all four types, with what each one's control needs.
 *   2. A weighted question with no rule for its type is rejected — it would eat
 *      its share of the denominator and never be able to earn any of it back.
 *   3. Existing single-choice scoring is byte-for-byte unchanged.
 */
import { describe, expect, it } from 'vitest';
import type { LoanCategory, QuestionType } from '@prisma/client';
import { ERROR_CODES } from '@/common/errors/error-codes';
import { ScoringService } from '@/scoring/scoring.service';
import type { SaveWeightsPayload } from '@/scoring/dto/scoring.dto';
import {
  computeProbability,
  equalWeights,
  normalizeWeights,
  type ProgramScoring,
  type SelectedAnswer,
} from '@/matching/scoring/approval-probability.scorer';

// ---------------------------------------------------------------------------
// A global pool holding one question of each type.
// ---------------------------------------------------------------------------

interface PoolQuestion {
  code: string;
  type: QuestionType;
  questionAr: string;
  questionEn: string;
  categories: LoanCategory[];
  numericMinValue: string | null;
  numericMaxValue: string | null;
  numericStep: string | null;
  numericUnitAr: string | null;
  numericUnitEn: string | null;
  textMaxLength: number | null;
  options: { code: string; labelAr: string; labelEn: string }[];
}

const NO_TYPE_RULES = {
  numericMinValue: null,
  numericMaxValue: null,
  numericStep: null,
  numericUnitAr: null,
  numericUnitEn: null,
  textMaxLength: null,
} as const;

const POOL: readonly PoolQuestion[] = [
  {
    code: 'employment_status',
    type: 'SINGLE_SELECT',
    questionAr: 'الحالة الوظيفية',
    questionEn: 'Employment status',
    categories: ['personal', 'car', 'mortgage', 'business'] as LoanCategory[],
    ...NO_TYPE_RULES,
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
    categories: ['personal'] as LoanCategory[],
    ...NO_TYPE_RULES,
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
    categories: ['personal'] as LoanCategory[],
    ...NO_TYPE_RULES,
    textMaxLength: 120,
    options: [],
  },
  {
    code: 'monthly_income',
    type: 'NUMERIC',
    questionAr: 'الدخل الشهري',
    questionEn: 'Monthly income',
    categories: ['personal'] as LoanCategory[],
    ...NO_TYPE_RULES,
    numericMinValue: '0.00',
    numericMaxValue: '500000.00',
    numericUnitAr: 'جنيه',
    numericUnitEn: 'EGP',
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
  // The catalog scope is a separate guard with its own tests; this suite only
  // reaches the structure/type validators, which never read it.
  const enums = { memberQuestionTemplate: async () => null };
  return new ScoringService(
    repo as never,
    audit as never,
    programs as never,
    questionnaire as never,
    enums as never,
  );
}

/** Reach the private validator the save path runs, without a live save. */
function assertKnownStructure(service: ScoringService, weights: SaveWeightsPayload): Promise<void> {
  return (
    service as unknown as {
      assertKnownStructure(w: SaveWeightsPayload): Promise<void>;
    }
  ).assertKnownStructure(weights);
}

/** The three bands the editor seeds for a numeric question — gapless, ordered. */
const INCOME_BANDS = [
  { from: null, to: '5000', score: 20 },
  { from: '5000', to: '15000', score: 60 },
  { from: '15000', to: null, score: 100 },
];

describe('the assignable list offers every question type', () => {
  it('lists all four, not just the single-choice one', async () => {
    const listed = await makeService().listWeightableOptions();
    expect(listed.map((q) => q.code)).toEqual([
      'employment_status',
      'preferred_banks',
      'employer_name',
      'monthly_income',
    ]);
    expect(listed.map((q) => q.type)).toEqual(['SINGLE_SELECT', 'MULTI_SELECT', 'TEXT', 'NUMERIC']);
  });

  it('carries the bilingual labels and options of a choice question', async () => {
    const [single] = await makeService().listWeightableOptions();
    expect(single).toMatchObject({
      code: 'employment_status',
      labelAr: 'الحالة الوظيفية',
      labelEn: 'Employment status',
    });
    expect(single?.options.map((o) => o.code)).toEqual(['government', 'private']);
  });

  it('carries a numeric question its own bounds and unit so the editor can seed bands', async () => {
    const listed = await makeService().listWeightableOptions();
    expect(listed.find((q) => q.code === 'monthly_income')).toMatchObject({
      numericMinValue: '0.00',
      numericMaxValue: '500000.00',
      numericUnitAr: 'جنيه',
      numericUnitEn: 'EGP',
    });
  });

  it('carries the categories that ask each question, lowercased', async () => {
    // The editor needs these to warn when a program weights a question its own
    // category never asks — the two assignments live on different screens and
    // nothing else compares them.
    const [single] = await makeService().listWeightableOptions();
    expect(single?.categories).toEqual(['personal', 'car', 'mortgage', 'business']);
  });
});

describe('a weighted question must carry the rule its type is scored by', () => {
  const cases: ReadonlyArray<[QuestionType, string, string]> = [
    ['SINGLE_SELECT', 'employment_status', 'answerScores'],
    ['MULTI_SELECT', 'preferred_banks', 'answerScores'],
    ['TEXT', 'employer_name', 'textRules'],
    ['NUMERIC', 'monthly_income', 'numericBands'],
  ];

  for (const [type, questionCode, rule] of cases) {
    it(`rejects a weighted ${type} question with no ${rule}`, async () => {
      await expect(
        assertKnownStructure(makeService(), {
          questionWeights: { [questionCode]: 100 },
          answerScores: {},
        }),
      ).rejects.toMatchObject({
        code: ERROR_CODES.WEIGHTS_MISSING_RULE,
        meta: { questionCode, type, rule },
      });
    });
  }

  it('accepts one weighted question of every type, each with its own rule', async () => {
    await expect(
      assertKnownStructure(makeService(), {
        questionWeights: {
          employment_status: 25,
          preferred_banks: 25,
          employer_name: 25,
          monthly_income: 25,
        },
        answerScores: {
          employment_status: { government: 100, private: 85 },
          preferred_banks: { abk: 100, cib: 60 },
        },
        multiSelectRules: { preferred_banks: { aggregation: 'SUM_CAPPED' } },
        numericBands: { monthly_income: INCOME_BANDS },
        textRules: { employer_name: { answeredScore: 100 } },
      }),
    ).resolves.toBeUndefined();
  });

  it('rejects an option map on a value-type question', async () => {
    await expect(
      assertKnownStructure(makeService(), {
        questionWeights: { employment_status: 100 },
        answerScores: {
          employment_status: { government: 100 },
          monthly_income: { some_option: 50 },
        },
      }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.WEIGHTS_RULE_TYPE_MISMATCH,
      meta: { questionCode: 'monthly_income', rule: 'answerScores' },
    });
  });

  it('rejects bands on a question that is not NUMERIC', async () => {
    await expect(
      assertKnownStructure(makeService(), {
        questionWeights: { employment_status: 100 },
        answerScores: { employment_status: { government: 100 } },
        numericBands: { employment_status: INCOME_BANDS },
      }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.WEIGHTS_RULE_TYPE_MISMATCH,
      meta: { questionCode: 'employment_status', rule: 'numericBands' },
    });
  });

  it('rejects an aggregation outside the enum', async () => {
    await expect(
      assertKnownStructure(makeService(), {
        questionWeights: { preferred_banks: 100 },
        answerScores: { preferred_banks: { abk: 100 } },
        multiSelectRules: {
          preferred_banks: { aggregation: 'MEDIAN' as unknown as 'AVERAGE' },
        },
      }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.WEIGHTS_RULE_TYPE_MISMATCH,
      meta: { questionCode: 'preferred_banks', rule: 'multiSelectRules.aggregation' },
    });
  });

  it('still rejects an unknown question or option code', async () => {
    await expect(
      assertKnownStructure(makeService(), {
        questionWeights: { deleted_question: 100 },
        answerScores: {},
      }),
    ).rejects.toMatchObject({ code: ERROR_CODES.WEIGHTS_UNKNOWN_OPTION });

    await expect(
      assertKnownStructure(makeService(), {
        questionWeights: { employment_status: 100 },
        answerScores: { employment_status: { deleted_option: 100 } },
      }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.WEIGHTS_UNKNOWN_OPTION,
      meta: { questionCode: 'employment_status', optionCode: 'deleted_option' },
    });
  });
});

describe('existing single-choice scoring is unchanged when everything is asked', () => {
  // A realistic pre-feature-010 program: three single-choice questions.
  const scoring: ProgramScoring = {
    questionWeights: { employment_status: 40, job_tenure: 35, salary_transfer: 25 },
    answerScores: {
      employment_status: { government: 100, private: 85, freelancer: 45 },
      job_tenure: { under_6m: 15, over_3y: 100 },
      salary_transfer: { yes: 100, no: 20 },
    },
  };
  const ALL_ASKED = ['employment_status', 'job_tenure', 'salary_transfer'];
  const pick = (questionCode: string, optionCode: string): SelectedAnswer => ({
    questionCode,
    kind: 'option',
    optionCode,
  });

  it('reproduces the documented worked example exactly', () => {
    // 0.40×1.00 + 0.35×1.00 + 0.25×1.00 = 1.0 — best answer everywhere.
    expect(
      computeProbability(
        scoring,
        [
          pick('employment_status', 'government'),
          pick('job_tenure', 'over_3y'),
          pick('salary_transfer', 'yes'),
        ],
        ALL_ASKED,
      ),
    ).toBe(1);

    // 0.40×0.85 + 0.35×0.15 + 0.25×0.20 = 0.34 + 0.0525 + 0.05 = 0.4425
    expect(
      computeProbability(
        scoring,
        [
          pick('employment_status', 'private'),
          pick('job_tenure', 'under_6m'),
          pick('salary_transfer', 'no'),
        ],
        ALL_ASKED,
      ),
    ).toBeCloseTo(0.4425, 10);
  });

  it('contributes nothing for an unanswered or unscored question', () => {
    // Asked all three, answered only the 40-weight one → 40/100.
    expect(
      computeProbability(scoring, [pick('employment_status', 'government')], ALL_ASKED),
    ).toBeCloseTo(0.4, 10);
    // A question outside the weight set adds zero rather than throwing.
    expect(
      computeProbability(
        scoring,
        [pick('preferred_banks', 'abk')],
        [...ALL_ASKED, 'preferred_banks'],
      ),
    ).toBe(0);
  });

  it('still upgrades a legacy single-level row on read', () => {
    const legacy = normalizeWeights({
      employment_status: { government: 100, private: 85 },
      job_tenure: { over_3y: 100 },
    });
    expect(legacy.questionWeights).toEqual(equalWeights(['employment_status', 'job_tenure']));
    expect(legacy.answerScores['employment_status']).toEqual({ government: 100, private: 85 });
    // The v14 rule maps materialise empty, so a legacy row scores exactly as before.
    expect(legacy.numericBands).toEqual({});
    expect(legacy.multiSelectRules).toEqual({});
    expect(legacy.textRules).toEqual({});
  });

  it('keeps synthesised equal weights summing to exactly 100', () => {
    for (const n of [1, 3, 6, 7, 11]) {
      const codes = Array.from({ length: n }, (_, i) => `q${i}`);
      const weights = equalWeights(codes);
      expect(Object.values(weights).reduce((a, b) => a + b, 0)).toBe(100);
    }
  });
});
