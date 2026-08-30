/**
 * Creating a question AND its answers in one shot (`POST admin/questionnaire/questions/with-options`).
 *
 * The catalog's "New question" dialog authors a whole question before it commits
 * anything, and the pre-existing way to write that was `POST questions` followed
 * by one `POST questions/:id/options` per answer. Every one of those ends in
 * `publish()`, so a four-answer question froze FIVE versions — and the middle
 * three are not merely noise: `GET /v1/questionnaire` serves the ACTIVE version,
 * so each one is a live questionnaire asking a choice question that has one
 * answer. That is what this endpoint exists to prevent, so the publish COUNT is
 * the assertion, not an implementation detail.
 *
 * The second thing pinned here: `createQuestion` cannot know how many options are
 * coming and passes a placeholder count to `assertQuestionTypeRules`. This path
 * knows, so the "at least two answers" rule finally bites BEFORE anything is
 * written rather than after a version is published.
 */
import { describe, expect, it, vi } from 'vitest';
import { QuestionnaireService } from '@/questionnaire/questionnaire.service';
import { ERROR_CODES } from '@/common/errors/error-codes';
import type { CreateQuestionWithOptionsDto } from '@/questionnaire/dto/questionnaire.dto';

interface Written {
  question: Record<string, unknown>;
  options: { code: string; labelAr: string; labelEn: string }[];
  categories: string[];
}

function makeService() {
  const written: Written[] = [];
  const publishVersion = vi.fn(async (data: { versionNumber: number }) => ({
    id: `ver_${data.versionNumber}`,
    versionNumber: data.versionNumber,
    isActive: true,
    publishedAt: new Date(),
    publishedBy: 'staff_1',
    snapshot: {},
  }));
  const createQuestionWithOptions = vi.fn(
    async (
      question: Record<string, unknown>,
      options: { code: string; labelAr: string; labelEn: string }[],
      categories: string[],
    ) => {
      written.push({ question, options: [...options], categories: [...categories] });
      return { id: 'q_new', ...question };
    },
  );

  const repo = {
    // ---- create path
    firstActiveGroup: async () => ({ id: 'g_1', code: 'financing_info', isActive: true }),
    findGroup: async (id: string) => (id === 'g_1' ? { id: 'g_1', isActive: true } : null),
    maxQuestionOrder: async () => 7,
    questionCodes: async () => [{ code: 'monthly_income' }, { code: 'company_age' }],
    createQuestionWithOptions,
    // ---- publish path. The pool is read back AFTER the write, so it stays empty
    // here: publish only has to run, and what it freezes is covered elsewhere.
    groups: async () => [
      { id: 'g_1', code: 'financing_info', titleAr: 'ا', titleEn: 'F', displayOrder: 1, isActive: true },
    ],
    questions: async () => [],
    categoryAssignments: async () => new Map<string, string[]>(),
    optionsByQuestion: async () => [],
    // `publish()` reads every question's options in ONE query now, not one per question.
    optionsByQuestions: async () => new Map(),
    nextVersionNumber: async () => 12,
    publishVersion,
  };
  const enums = { getActiveMembers: async () => [] };

  const service = new QuestionnaireService(repo as never, enums as never);
  return { service, written, publishVersion, createQuestionWithOptions };
}

const CHOICE: CreateQuestionWithOptionsDto = {
  questionEn: 'How old is the company?',
  questionAr: 'عمر الشركة',
  type: 'SINGLE_SELECT',
  categories: ['business'],
  options: [
    { labelEn: 'Under 2 years', labelAr: 'أقل من سنتين' },
    { labelEn: 'Over 2 years', labelAr: 'أكثر من سنتين' },
  ],
} as CreateQuestionWithOptionsDto;

describe('a question and its answers are written once and published once', () => {
  it('publishes exactly one version for a question carrying three answers', async () => {
    const { service, publishVersion } = makeService();
    await service.createQuestionWithOptions(
      {
        ...CHOICE,
        options: [
          { labelEn: 'Under 2 years', labelAr: 'أقل من سنتين' },
          { labelEn: '2 to 5 years', labelAr: 'من سنتين لخمس' },
          { labelEn: 'Over 5 years', labelAr: 'أكثر من خمس' },
        ],
      },
      'staff_1',
    );
    // The whole point of the endpoint: 1, not 4.
    expect(publishVersion).toHaveBeenCalledTimes(1);
  });

  it('writes the question, its answers and its assignment in ONE repository call', async () => {
    const { service, written, createQuestionWithOptions } = makeService();
    await service.createQuestionWithOptions(CHOICE, 'staff_1');
    expect(createQuestionWithOptions).toHaveBeenCalledTimes(1);
    expect(written[0]?.options.map((o) => o.labelEn)).toEqual([
      'Under 2 years',
      'Over 2 years',
    ]);
    expect(written[0]?.categories).toEqual(['business']);
  });

  it('auto-slugs the question code and every answer code', async () => {
    const { service, written } = makeService();
    await service.createQuestionWithOptions(CHOICE, 'staff_1');
    expect(written[0]?.question.code).toBe('how_old_is_the_company');
    expect(written[0]?.options.map((o) => o.code)).toEqual(['under_2_years', 'over_2_years']);
  });

  it('suffixes two answers that slug to the same code, scoped to their own question', async () => {
    const { service, written } = makeService();
    await service.createQuestionWithOptions(
      {
        ...CHOICE,
        options: [
          { labelEn: 'Yes', labelAr: 'نعم' },
          { labelEn: 'Yes!', labelAr: 'نعم!' },
        ],
      },
      'staff_1',
    );
    expect(written[0]?.options.map((o) => o.code)).toEqual(['yes', 'yes_2']);
  });

  it('appends the question to the end of the flat pool', async () => {
    const { service, written } = makeService();
    await service.createQuestionWithOptions(CHOICE, 'staff_1');
    expect(written[0]?.question.displayOrder).toBe(8);
  });

  it('defaults an omitted category set to all four rather than to none', async () => {
    const { service, written } = makeService();
    const { categories: _dropped, ...noCategories } = CHOICE;
    await service.createQuestionWithOptions(noCategories as CreateQuestionWithOptionsDto, 'staff_1');
    expect(written[0]?.categories).toEqual(['personal', 'car', 'mortgage', 'business']);
  });
});

describe('the real answer count is enforced before anything is written', () => {
  it('refuses a choice question with one answer, and publishes nothing', async () => {
    const { service, publishVersion, createQuestionWithOptions } = makeService();
    await expect(
      service.createQuestionWithOptions(
        { ...CHOICE, options: [{ labelEn: 'Only one', labelAr: 'واحد' }] },
        'staff_1',
      ),
    ).rejects.toMatchObject({
      code: ERROR_CODES.QUESTION_TYPE_RULES_INVALID,
      meta: { field: 'options' },
    });
    // `createQuestion` would have accepted this and published it — that is the
    // regression this endpoint closes.
    expect(createQuestionWithOptions).not.toHaveBeenCalled();
    expect(publishVersion).not.toHaveBeenCalled();
  });

  it('refuses a NUMERIC question that arrives carrying answers', async () => {
    const { service, publishVersion } = makeService();
    await expect(
      service.createQuestionWithOptions(
        {
          ...CHOICE,
          type: 'NUMERIC',
          options: [{ labelEn: 'Under 2 years', labelAr: 'أقل من سنتين' }],
        },
        'staff_1',
      ),
    ).rejects.toMatchObject({ code: ERROR_CODES.QUESTION_TYPE_RULES_INVALID });
    expect(publishVersion).not.toHaveBeenCalled();
  });

  it('accepts a NUMERIC question with no answers and its bounds', async () => {
    const { service, written } = makeService();
    await service.createQuestionWithOptions(
      {
        questionEn: 'Monthly rent',
        questionAr: 'الإيجار الشهري',
        type: 'NUMERIC',
        categories: ['personal'],
        numeric: { minValue: '0.00', maxValue: '100000.00', unitEn: 'EGP', unitAr: 'جنيه' },
      } as CreateQuestionWithOptionsDto,
      'staff_1',
    );
    expect(written[0]?.options).toEqual([]);
    expect(written[0]?.question.numericMaxValue).toBe('100000.00');
  });

  it('rejects a numeric maximum below its minimum', async () => {
    const { service, publishVersion } = makeService();
    await expect(
      service.createQuestionWithOptions(
        {
          questionEn: 'Monthly rent',
          questionAr: 'الإيجار الشهري',
          type: 'NUMERIC',
          numeric: { minValue: '5000.00', maxValue: '1000.00' },
        } as CreateQuestionWithOptionsDto,
        'staff_1',
      ),
    ).rejects.toMatchObject({ meta: { field: 'numeric.maxValue' } });
    expect(publishVersion).not.toHaveBeenCalled();
  });
});
