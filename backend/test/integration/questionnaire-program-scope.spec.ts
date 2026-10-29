/**
 * Which questions an applicant is put in front of: the ones the PROGRAM they picked asks
 * (Principle V, v35.0.0 — a question carries no loan type).
 *
 * The pool stays GLOBAL — one list, one published version — and the picked program narrows it.
 * Two surfaces depend on that and are covered here end to end against in-memory repositories:
 *
 *  - `activeSnapshot(category, programNameKey)` — what the mobile wizard renders.
 *  - `resolveAnswers(answers, category, programNameKey)` — what apply validates, INCLUDING the
 *    required-question rule, which is why the narrowing is a correctness matter and not a
 *    cosmetic one.
 */
import { describe, expect, it } from 'vitest';
import { QuestionnaireService } from '@/questionnaire/questionnaire.service';
import { ERROR_CODES } from '@/common/errors/error-codes';

/** Two groups so we can assert that a group emptied by narrowing is dropped. */
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
          options: [
            { code: 'under_2y', labelAr: 'أقل من سنتين', labelEn: 'Under 2 years', displayOrder: 1 },
            { code: 'over_2y', labelAr: 'أكثر من سنتين', labelEn: 'Over 2 years', displayOrder: 2 },
          ],
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
}

/**
 * `monthly_income` is a money question, asked on every program; `property_type` is asked only
 * where a programme behind the picked name reads it.
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
  },
  {
    id: 'q_property',
    code: 'property_type',
    type: 'SINGLE_SELECT',
    isRequired: true,
    isActive: true,
    displayOrder: 2,
    enabledWhen: null,
  },
];

/**
 * The service, plus a COUNTED stand-in for the enumerations repository.
 *
 * The count is an assertion: with no program name the serve and apply paths must not read the
 * scope at all — they serve the baseline (the fixed questions and the money core).
 */
function makeScopedService(
  scope: unknown,
  snapshot: unknown = SNAPSHOT,
  questions: LiveQuestion[] = LIVE,
) {
  const calls: string[] = [];
  const repo = {
    activeVersion: async () => ({ id: 'ver', versionNumber: 11, snapshot }),
    versionById: async () => ({ id: 'ver', versionNumber: 11, snapshot }),
    questions: async () => questions.map((q) => ({ ...q, ...NO_RULES })),
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
  const enums = {
    narrowingScopeFor: async (key: string) => {
      calls.push(key);
      return scope;
    },
  };
  return { service: new QuestionnaireService(repo as never, enums as never), calls };
}

interface ProjectedSnapshot {
  versionNumber: number;
  groups: { code: string; questions: { code: string }[] }[];
}

const codesIn = (snap: ProjectedSnapshot): string[] =>
  snap.groups.flatMap((g) => g.questions.map((q) => q.code));

/**
 * `monthly_income` is the core anchor throughout — a money binding can never be narrowed away,
 * which is what stops a narrowed snapshot from emptying out.
 */
describe('the customer snapshot narrows again to the program the applicant picked', () => {
  /** `property_type` is bound to a fact one product asks; nothing else here is. */
  const SCOPE_WITHOUT_PROPERTY = {
    programNameKey: 'a_name',
    factBoundQuestionCodes: ['property_type'],
    platformQuestionCodes: [],
    neededQuestionCodes: [],
  };
  const SCOPE_WITH_PROPERTY = {
    ...SCOPE_WITHOUT_PROPERTY,
    neededQuestionCodes: ['property_type'],
  };

  it('drops a question no program behind the name reads', async () => {
    const { service } = makeScopedService(SCOPE_WITHOUT_PROPERTY);
    const snap = (await service.activeSnapshot(
      'mortgage' as never,
      'a_name',
    )) as ProjectedSnapshot;
    expect(codesIn(snap)).toEqual(['monthly_income']);
  });

  it('keeps it, and REQUIRES it, when a program behind the name does read it', async () => {
    const { service } = makeScopedService(SCOPE_WITH_PROPERTY);
    const snap = (await service.activeSnapshot(
      'mortgage' as never,
      'a_name',
    )) as ProjectedSnapshot;
    expect(codesIn(snap)).toEqual(['monthly_income', 'property_type']);
  });

  it('serves the baseline, and reads no scope, when no program name is asked for', async () => {
    const { service, calls } = makeScopedService(SCOPE_WITHOUT_PROPERTY);
    const snap = (await service.activeSnapshot('mortgage' as never)) as ProjectedSnapshot;
    expect(codesIn(snap)).toEqual(['monthly_income']);
    expect(calls).toEqual([]);
  });

  it('serves the baseline for a name the repository does not know', async () => {
    // `null` is what the repository answers for an unknown or retired name: there is no
    // program to scope by, so the applicant gets the fixed questions and the money core.
    const { service } = makeScopedService(null);
    const snap = (await service.activeSnapshot(
      'mortgage' as never,
      'a_name',
    )) as ProjectedSnapshot;
    expect(codesIn(snap)).toEqual(['monthly_income']);
  });

  it('drops a group left with nothing to ask rather than shipping a blank wizard step', async () => {
    const { service } = makeScopedService(SCOPE_WITH_PROPERTY);
    const snap = (await service.activeSnapshot(
      'mortgage' as never,
      'a_name',
    )) as ProjectedSnapshot;
    expect(snap.groups.map((g) => g.code)).toEqual(['financing_info']);
  });
});

describe('apply enforces the same narrowed set the snapshot served', () => {
  const answer = (questionCode: string, numericValue: string) => ({
    questionCode,
    numericValue,
  });

  it('does not require a question the picked program does not read', async () => {
    // `property_type` is required. Narrowed away, it must not be demanded — the failure this
    // narrowing exists to prevent.
    const { service } = makeScopedService({
      programNameKey: 'a_name',
      factBoundQuestionCodes: ['property_type'],
        platformQuestionCodes: [],
      neededQuestionCodes: [],
    });
    const result = await service.resolveAnswers(
      [answer('monthly_income', '40000')] as never,
      'mortgage' as never,
      'a_name',
    );
    expect(result.askedQuestionCodes).toEqual(['monthly_income']);
  });

  it('ACCEPTS an answer to a narrowed-away question rather than rejecting it', async () => {
    // A backend deploy is not atomic with an app release: an installed build posts what it was
    // served. Narrowing what may be ANSWERED would answer it with UNKNOWN_QUESTION_CODE, so only
    // what is asked and required narrows.
    const { service } = makeScopedService({
      programNameKey: 'a_name',
      factBoundQuestionCodes: ['property_type'],
        platformQuestionCodes: [],
      neededQuestionCodes: [],
    });
    const result = await service.resolveAnswers(
      [answer('monthly_income', '40000'), answer('property_type', '1')] as never,
      'mortgage' as never,
      'a_name',
    );
    expect(result.askedQuestionCodes).toEqual(['monthly_income']);
  });

  it('asks the baseline, and reads no scope, when no program name is asked for', async () => {
    const { service, calls } = makeScopedService(null);
    const result = await service.resolveAnswers(
      [
        answer('monthly_income', '40000'),
        { questionCode: 'property_type', optionCode: 'apartment' },
      ] as never,
      'mortgage' as never,
    );
    // The baseline, without touching the scope read — and the extra answer is accepted.
    expect(result.askedQuestionCodes).toEqual(['monthly_income']);
    expect(calls).toEqual([]);
  });
});
