/**
 * Per-loan-category question assignment (Principle V, as amended).
 *
 * The pool stays GLOBAL — one list, one published version — and each question is
 * assigned to the loan categories that ask it. Two surfaces depend on that
 * assignment and are covered here end to end against in-memory repositories:
 *
 *  - `activeSnapshot(category)` — what the mobile wizard renders.
 *  - `resolveAnswers(answers, category)` — what apply validates, INCLUDING the
 *    required-question rule, which is why the filter is a correctness matter and
 *    not a cosmetic one.
 */
import { describe, expect, it } from 'vitest';
import { QuestionnaireService } from '@/questionnaire/questionnaire.service';
import { ERROR_CODES } from '@/common/errors/error-codes';

type Category = 'personal' | 'car' | 'mortgage' | 'business';

/** Two groups so we can assert that a group emptied by filtering is dropped. */
const SNAPSHOT = {
  versionNumber: 11,
  groups: [
    {
      code: 'financing_info',
      titleAr: 'معلومات التمويل',
      titleEn: 'Financing Information',
      displayOrder: 1,
      questions: [
        {
          code: 'monthly_income',
          type: 'NUMERIC',
          questionAr: 'ما هو صافي راتبك الشهري؟',
          questionEn: 'What is your monthly net income?',
          isRequired: true,
          displayOrder: 1,
          enabledWhen: null,
          categories: ['personal', 'car', 'mortgage', 'business'],
          options: [],
        },
        {
          code: 'property_type',
          type: 'SINGLE_SELECT',
          questionAr: 'نوع العقار',
          questionEn: 'Property type',
          isRequired: true,
          displayOrder: 2,
          enabledWhen: null,
          categories: ['mortgage'],
          options: [
            { code: 'apartment', labelAr: 'شقة', labelEn: 'Apartment', displayOrder: 1 },
            { code: 'villa', labelAr: 'فيلا', labelEn: 'Villa', displayOrder: 2 },
          ],
        },
      ],
    },
    {
      code: 'business_info',
      titleAr: 'معلومات النشاط',
      titleEn: 'Business Information',
      displayOrder: 2,
      questions: [
        {
          code: 'company_age',
          type: 'SINGLE_SELECT',
          questionAr: 'عمر الشركة',
          questionEn: 'How old is the company?',
          isRequired: true,
          displayOrder: 3,
          enabledWhen: null,
          categories: ['business'],
          options: [
            { code: 'under_2y', labelAr: 'أقل من سنتين', labelEn: 'Under 2 years', displayOrder: 1 },
            { code: 'over_2y', labelAr: 'أكثر من سنتين', labelEn: 'Over 2 years', displayOrder: 2 },
          ],
        },
      ],
    },
  ],
};

/** Same shape, published before assignment existed: no `categories` key at all. */
const PRE_ASSIGNMENT_SNAPSHOT = {
  versionNumber: 6,
  groups: [
    {
      code: 'financing_info',
      titleAr: 'معلومات التمويل',
      titleEn: 'Financing Information',
      displayOrder: 1,
      questions: [
        {
          code: 'property_type',
          type: 'SINGLE_SELECT',
          questionAr: 'نوع العقار',
          questionEn: 'Property type',
          isRequired: true,
          displayOrder: 1,
          enabledWhen: null,
          options: [{ code: 'villa', labelAr: 'فيلا', labelEn: 'Villa', displayOrder: 1 }],
        },
      ],
    },
  ],
};

const NO_RULES = {
  numericMinValue: null,
  numericMaxValue: null,
  numericStep: null,
  numericUnitAr: null,
  numericUnitEn: null,
  textMaxLength: null,
} as const;

interface LiveQuestion {
  id: string;
  code: string;
  type: 'SINGLE_SELECT' | 'MULTI_SELECT' | 'TEXT' | 'NUMERIC';
  isRequired: boolean;
  isActive: boolean;
  displayOrder: number;
  enabledWhen: unknown;
  categories: Category[];
}

/**
 * `property_type` is asked for mortgage only, `monthly_income` for everyone. The
 * live rows carry their assignment on the fake `categoryAssignments()` map, which
 * is exactly the shape the real repository returns.
 */
const LIVE: LiveQuestion[] = [
  {
    id: 'q_income',
    code: 'monthly_income',
    type: 'NUMERIC',
    isRequired: true,
    isActive: true,
    displayOrder: 1,
    enabledWhen: null,
    categories: ['personal', 'car', 'mortgage', 'business'],
  },
  {
    id: 'q_property',
    code: 'property_type',
    type: 'SINGLE_SELECT',
    isRequired: true,
    isActive: true,
    displayOrder: 2,
    enabledWhen: null,
    categories: ['mortgage'],
  },
];

function makeService(snapshot: unknown = SNAPSHOT, questions: LiveQuestion[] = LIVE) {
  const repo = {
    activeVersion: async () => ({ id: 'ver', versionNumber: 11, snapshot }),
    versionById: async () => ({ id: 'ver', versionNumber: 11, snapshot }),
    questions: async () => questions.map((q) => ({ ...q, ...NO_RULES })),
    categoryAssignments: async () =>
      new Map(questions.map((q) => [q.id, [...q.categories]])),
    optionsByQuestion: async (questionId: string) =>
      (questionId === 'q_property' ? ['apartment', 'villa'] : []).map((code, i) => ({
        id: `${questionId}_${code}`,
        questionId,
        code,
        labelAr: code,
        labelEn: code,
        displayOrder: i + 1,
        isActive: true,
      })),
  };
  return new QuestionnaireService(repo as never);
}

interface ProjectedSnapshot {
  versionNumber: number;
  groups: { code: string; questions: { code: string }[] }[];
}

const codesIn = (snap: ProjectedSnapshot): string[] =>
  snap.groups.flatMap((g) => g.questions.map((q) => q.code));

describe('the customer snapshot only carries the questions its category asks', () => {
  it('drops a question assigned to another category', async () => {
    const snap = (await makeService().activeSnapshot('personal' as never)) as ProjectedSnapshot;
    expect(codesIn(snap)).toEqual(['monthly_income']);
  });

  it('keeps a category-specific question for the category that asks it', async () => {
    const snap = (await makeService().activeSnapshot('mortgage' as never)) as ProjectedSnapshot;
    expect(codesIn(snap)).toEqual(['monthly_income', 'property_type']);
  });

  it('drops a group left with nothing to ask rather than shipping a blank wizard step', async () => {
    const snap = (await makeService().activeSnapshot('car' as never)) as ProjectedSnapshot;
    expect(snap.groups.map((g) => g.code)).toEqual(['financing_info']);
  });

  it('returns the whole pool when no category is asked for', async () => {
    const snap = (await makeService().activeSnapshot()) as ProjectedSnapshot;
    expect(codesIn(snap)).toEqual(['monthly_income', 'property_type', 'company_age']);
  });

  it('treats a snapshot published before assignment existed as asked for every category', async () => {
    const snap = (await makeService(PRE_ASSIGNMENT_SNAPSHOT).activeSnapshot(
      'personal' as never,
    )) as ProjectedSnapshot;
    expect(codesIn(snap)).toEqual(['property_type']);
  });
});

describe('apply validates answers against the questions its category asks', () => {
  it('does not require a question the applicant was never shown', async () => {
    // `property_type` is required, mortgage-only, and unanswered. A personal-loan
    // apply must still succeed — this is the failure the filter exists to prevent.
    const { resolved } = await makeService().resolveAnswers(
      [{ questionCode: 'monthly_income', numericValue: '25000' }],
      'personal' as never,
    );
    expect(resolved.map((r) => r.questionCode)).toEqual(['monthly_income']);
  });

  it('reports the asked set as the scoring denominator, scoped to the category', async () => {
    // `property_type` is mortgage-only, so a personal-loan applicant is never
    // asked it and a program weighting it must not be charged for it.
    const personal = await makeService().resolveAnswers(
      [{ questionCode: 'monthly_income', numericValue: '25000' }],
      'personal' as never,
    );
    expect(personal.askedQuestionCodes).toEqual(['monthly_income']);

    // Same pool, mortgage applicant: the question IS asked, so it belongs in
    // the denominator even though answering it is what avoids the throw.
    const mortgage = await makeService().resolveAnswers(
      [
        { questionCode: 'monthly_income', numericValue: '25000' },
        { questionCode: 'property_type', optionCode: 'villa' },
      ],
      'mortgage' as never,
    );
    expect(mortgage.askedQuestionCodes.sort()).toEqual(['monthly_income', 'property_type']);
  });

  it('still requires a question that category does ask', async () => {
    await expect(
      makeService().resolveAnswers(
        [{ questionCode: 'monthly_income', numericValue: '25000' }],
        'mortgage' as never,
      ),
    ).rejects.toMatchObject({ code: ERROR_CODES.ANSWER_REQUIRED });
  });

  it('rejects an answer to a question that category does not ask', async () => {
    await expect(
      makeService().resolveAnswers(
        [
          { questionCode: 'monthly_income', numericValue: '25000' },
          { questionCode: 'property_type', optionCode: 'villa' },
        ],
        'car' as never,
      ),
    ).rejects.toMatchObject({ code: ERROR_CODES.UNKNOWN_QUESTION_CODE });
  });

  it('validates against the whole pool when no category is given', async () => {
    const { resolved } = await makeService().resolveAnswers([
      { questionCode: 'monthly_income', numericValue: '25000' },
      { questionCode: 'property_type', optionCode: 'villa' },
    ]);
    expect(resolved.map((r) => r.questionCode).sort()).toEqual([
      'monthly_income',
      'property_type',
    ]);
  });
});
