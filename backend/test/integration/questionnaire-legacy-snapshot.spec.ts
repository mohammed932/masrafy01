/**
 * T018 — FR-045 backward compatibility.
 *
 * A questionnaire snapshot published before feature 010 has no `type` key on its
 * questions, and applications already in flight hold answers against them. Both
 * must keep working: the snapshot reads as single choice, and previously stored
 * answers stay readable.
 *
 * Integration-level in the sense that it drives `QuestionnaireService` end to
 * end (snapshot projection + answer resolution) against in-memory repositories,
 * rather than isolated pure functions.
 */
import { describe, expect, it } from 'vitest';
import { QuestionnaireService } from '@/questionnaire/questionnaire.service';
import { ERROR_CODES } from '@/common/errors/error-codes';

// ---------------------------------------------------------------------------
// A snapshot exactly as v9 wrote it: no `type`, no `numeric`, no `text`.
// ---------------------------------------------------------------------------

const LEGACY_SNAPSHOT = {
  versionNumber: 6,
  groups: [
    {
      code: 'financing_info',
      titleAr: 'معلومات التمويل',
      titleEn: 'Financing Information',
      displayOrder: 1,
      questions: [
        {
          code: 'amount_requested',
          // no `type` — this is the whole point of the fixture
          questionAr: 'ما المبلغ التقريبي الذي تحتاجه؟',
          questionEn: 'What is the approximate amount you need?',
          helperTextAr: null,
          helperTextEn: null,
          isRequired: true,
          displayOrder: 1,
          enabledWhen: null,
          options: [
            { code: 'under_50k', labelAr: 'أقل من 50,000 جنيه', labelEn: 'Less than EGP 50,000', displayOrder: 1 },
            { code: 'egp_150_000_500_000', labelAr: '150,000 – 500,000 جنيه', labelEn: 'EGP 150,000 – 500,000', displayOrder: 2 },
          ],
        },
      ],
    },
  ],
};

interface FakeQuestion {
  id: string;
  code: string;
  type: 'SINGLE_SELECT' | 'MULTI_SELECT' | 'TEXT' | 'NUMERIC';
  isRequired: boolean;
  isActive: boolean;
  displayOrder: number;
  enabledWhen: unknown;
  numericMinValue: null;
  numericMaxValue: null;
  numericStep: null;
  numericUnitAr: null;
  numericUnitEn: null;
  textMaxLength: null;
}

const NO_RULES = {
  numericMinValue: null,
  numericMaxValue: null,
  numericStep: null,
  numericUnitAr: null,
  numericUnitEn: null,
  textMaxLength: null,
} as const;

function makeService(questions: FakeQuestion[], optionsByQuestionId: Record<string, string[]>) {
  const repo = {
    activeVersion: async () => ({ id: 'ver_6', versionNumber: 6, snapshot: LEGACY_SNAPSHOT }),
    versionById: async () => ({ id: 'ver_6', versionNumber: 6, snapshot: LEGACY_SNAPSHOT }),
    questions: async () => questions,
    optionsByQuestion: async (questionId: string) =>
      (optionsByQuestionId[questionId] ?? []).map((code, i) => ({
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

describe('a pre-feature-010 snapshot still serves the customer questionnaire', () => {
  it('projects a question with no stored type as SINGLE_SELECT', async () => {
    const service = makeService([], {});
    const snap = (await service.activeSnapshot()) as {
      versionNumber: number;
      groups: { questions: { code: string; type: string; options: unknown[] }[] }[];
    };
    const question = snap.groups[0]?.questions[0];
    expect(question?.code).toBe('amount_requested');
    expect(question?.type).toBe('SINGLE_SELECT');
    expect(question?.options).toHaveLength(2);
  });

  it('omits the numeric/text rule blocks rather than emitting empty ones', async () => {
    const snap = (await makeService([], {}).activeSnapshot()) as {
      groups: { questions: Record<string, unknown>[] }[];
    };
    const question = snap.groups[0]?.questions[0] ?? {};
    expect(question).not.toHaveProperty('numeric');
    expect(question).not.toHaveProperty('text');
  });

  it('preserves the version number so in-flight applications resolve the same snapshot', async () => {
    const snap = (await makeService([], {}).activeSnapshot()) as { versionNumber: number };
    expect(snap.versionNumber).toBe(6);
  });
});

describe('answers stored against a legacy question stay resolvable', () => {
  const legacyQuestion: FakeQuestion = {
    id: 'q_amount',
    code: 'amount_requested',
    // The live row defaults to SINGLE_SELECT until the seed converts it.
    type: 'SINGLE_SELECT',
    isRequired: true,
    isActive: true,
    displayOrder: 1,
    enabledWhen: null,
    ...NO_RULES,
  };

  it('accepts the bucket option code an old client still sends', async () => {
    const service = makeService([legacyQuestion], {
      q_amount: ['under_50k', 'egp_150_000_500_000'],
    });
    const { resolved } = await service.resolveAnswers([
      { questionCode: 'amount_requested', optionCode: 'egp_150_000_500_000' },
    ]);
    expect(resolved).toHaveLength(1);
    expect(resolved[0]).toMatchObject({
      questionCode: 'amount_requested',
      type: 'SINGLE_SELECT',
      selectedOptionCode: 'egp_150_000_500_000',
      // Canonical list is populated even for a legacy single-choice answer.
      selectedOptionCodes: ['egp_150_000_500_000'],
      selectedOptionId: 'q_amount_egp_150_000_500_000',
      textValue: null,
      numericValue: null,
    });
  });

  it('rejects a numeric payload for a question that is still a bucket', async () => {
    const service = makeService([legacyQuestion], { q_amount: ['under_50k'] });
    await expect(
      service.resolveAnswers([{ questionCode: 'amount_requested', numericValue: '500000' }]),
    ).rejects.toMatchObject({ code: ERROR_CODES.ANSWER_TYPE_MISMATCH });
  });

  it('accepts a numeric payload once the same code has been converted to NUMERIC', async () => {
    // This is the seed's in-place conversion: same code, now a real number.
    const converted: FakeQuestion = { ...legacyQuestion, type: 'NUMERIC' };
    const service = makeService([converted], { q_amount: [] });
    const { resolved } = await service.resolveAnswers([
      { questionCode: 'amount_requested', numericValue: '500000' },
    ]);
    // 500 000 stays 500 000 — the bug this feature exists to fix.
    expect(resolved[0]).toMatchObject({
      type: 'NUMERIC',
      numericValue: '500000.00',
      selectedOptionCode: null,
      selectedOptionCodes: [],
    });
  });
});
