/**
 * A question whose answers ARE a registry list.
 *
 * `question_option.code` === `platform_enumeration.key` is what the engine keys a bank's
 * table by (`factChoiceTable`, `factParentTable`) and what `attachOptionsEnumerationType`
 * recognises a question's list from. It was unreachable through the admin API — the ordinary
 * create mints a code by slugifying a label — so only the seed could ever produce one. That is
 * why a no-payslip product used to need a release.
 *
 * Two halves are pinned here, and the second is the one that decays silently:
 *   1. CREATE takes the codes from the registry and remembers the link.
 *   2. A value written LATER re-syncs into the options and republishes — otherwise the tenth
 *      compound an operator types is a row the customer can never pick.
 */
import { describe, expect, it, vi } from 'vitest';
import { QuestionnaireService } from '@/questionnaire/questionnaire.service';
import { ERROR_CODES } from '@/common/errors/error-codes';
import type { CreateQuestionWithOptionsDto } from '@/questionnaire/dto/questionnaire.dto';

const DISTRICTS = [
  { type: 'district', key: 'maadi', labelAr: 'المعادي', labelEn: 'Maadi' },
  { type: 'district', key: 'zamalek', labelAr: 'الزمالك', labelEn: 'Zamalek' },
];

function makeService(
  over: {
    members?: { key: string; labelAr: string; labelEn: string }[];
    mirrorQuestionId?: string | null;
    syncChanged?: boolean;
  } = {},
) {
  const written: Array<{
    question: Record<string, unknown>;
    options: { code: string; labelAr: string; labelEn: string }[];
  }> = [];
  const publishVersion = vi.fn(async (data: { versionNumber: number }) => ({
    id: `ver_${data.versionNumber}`,
    versionNumber: data.versionNumber,
    isActive: true,
    publishedAt: new Date(),
    publishedBy: 'staff_1',
    snapshot: {},
  }));
  const syncMirroredOptions = vi.fn(async () => over.syncChanged ?? true);

  const repo = {
    firstActiveGroup: async () => ({ id: 'g_1', code: 'about', isActive: true }),
    findGroup: async (id: string) => (id === 'g_1' ? { id: 'g_1', isActive: true } : null),
    maxQuestionOrder: async () => 3,
    questionCodes: async () => [],
    createQuestionWithOptions: vi.fn(
      async (
        question: Record<string, unknown>,
        options: { code: string; labelAr: string; labelEn: string }[],
      ) => {
        written.push({ question, options: [...options] });
        return { id: 'q_new', ...question };
      },
    ),
    syncMirroredOptions,
    groups: async () => [
      { id: 'g_1', code: 'about', titleAr: 'ع', titleEn: 'A', displayOrder: 1, isActive: true },
    ],
    questions: async () => [],
    categoryAssignments: async () => new Map<string, string[]>(),
    optionsByQuestion: async () => [],
    nextVersionNumber: async () => 4,
    publishVersion,
  };

  const updateTypeDefinition = vi.fn(async () => null);
  const enums = {
    getActiveMembers: vi.fn(async () => over.members ?? DISTRICTS),
    updateTypeDefinition,
    typeDefinitions: async () =>
      new Map([
        [
          'district',
          {
            key: 'district',
            mirrorQuestionId:
              over.mirrorQuestionId === undefined ? 'q_new' : over.mirrorQuestionId,
          },
        ],
      ]),
  };

  const service = new QuestionnaireService(repo as never, enums as never);
  return { service, written, publishVersion, updateTypeDefinition, syncMirroredOptions, enums };
}

const MIRRORED = {
  questionEn: 'Which district do you live in?',
  questionAr: 'في أي حي تسكن؟',
  type: 'SINGLE_SELECT',
  categories: ['personal'],
  optionsFromEnumerationType: 'district',
} as CreateQuestionWithOptionsDto;

describe('creating a question from a registry list', () => {
  it('takes the option CODES from the registry keys, never from the labels', async () => {
    // A slug of "Maadi" would be `maadi` by luck here and `mountain_view_icity` never — the
    // point is that no slugging happens at all.
    const { service, written } = makeService();
    await service.createQuestionWithOptions(MIRRORED, 'staff_1');
    expect(written[0]?.options).toEqual([
      { code: 'maadi', labelAr: 'المعادي', labelEn: 'Maadi' },
      { code: 'zamalek', labelAr: 'الزمالك', labelEn: 'Zamalek' },
    ]);
  });

  it('remembers the link, so a value added later has somewhere to sync to', async () => {
    const { service, updateTypeDefinition } = makeService();
    await service.createQuestionWithOptions(MIRRORED, 'staff_1');
    expect(updateTypeDefinition).toHaveBeenCalledWith('district', { mirrorQuestionId: 'q_new' });
  });

  it('still publishes exactly once', async () => {
    const { service, publishVersion } = makeService();
    await service.createQuestionWithOptions(MIRRORED, 'staff_1');
    expect(publishVersion).toHaveBeenCalledTimes(1);
  });

  it('counts the REGISTRY values against the two-answer rule, not the empty options array', async () => {
    const { service } = makeService({ members: [DISTRICTS[0]!] });
    await expect(service.createQuestionWithOptions(MIRRORED, 'staff_1')).rejects.toMatchObject({
      code: ERROR_CODES.QUESTION_TYPE_RULES_INVALID,
    });
  });

  it('refuses a request that also states its own answers', async () => {
    // Two authorities for one list is how they come to disagree, and a merge would put
    // slugged codes beside registry keys inside one question.
    const { service } = makeService();
    await expect(
      service.createQuestionWithOptions(
        { ...MIRRORED, options: [{ labelEn: 'Other', labelAr: 'أخرى' }] } as CreateQuestionWithOptionsDto,
        'staff_1',
      ),
    ).rejects.toMatchObject({ code: ERROR_CODES.VALIDATION_FAILED });
  });
});

describe('re-syncing after the list changes', () => {
  it('rewrites the options and republishes', async () => {
    const { service, syncMirroredOptions, publishVersion } = makeService();
    const changed = await service.syncMirroredOptions('district', 'staff_1');
    expect(changed).toBe(true);
    expect(syncMirroredOptions).toHaveBeenCalledWith('q_new', [
      { code: 'maadi', labelAr: 'المعادي', labelEn: 'Maadi' },
      { code: 'zamalek', labelAr: 'الزمالك', labelEn: 'Zamalek' },
    ]);
    expect(publishVersion).toHaveBeenCalledTimes(1);
  });

  it('does NOT publish when nothing moved', async () => {
    // A publish that changes nothing is still a new ACTIVE version, and version history is
    // how an operator reads what they did.
    const { service, publishVersion } = makeService({ syncChanged: false });
    expect(await service.syncMirroredOptions('district', 'staff_1')).toBe(false);
    expect(publishVersion).not.toHaveBeenCalled();
  });

  it('is a no-op for a list no question mirrors', async () => {
    const { service, syncMirroredOptions, publishVersion } = makeService({
      mirrorQuestionId: null,
    });
    expect(await service.syncMirroredOptions('district', 'staff_1')).toBe(false);
    expect(syncMirroredOptions).not.toHaveBeenCalled();
    expect(publishVersion).not.toHaveBeenCalled();
  });

  it('is a no-op for a list the registry has never heard of', async () => {
    const { service, publishVersion } = makeService();
    expect(await service.syncMirroredOptions('governorate', 'staff_1')).toBe(false);
    expect(publishVersion).not.toHaveBeenCalled();
  });
});
