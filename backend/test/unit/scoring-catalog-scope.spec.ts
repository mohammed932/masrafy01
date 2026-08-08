/**
 * The scored question set belongs to the CATALOG NAME, not to the bank program.
 *
 * Every bank program sold under one `program_name` (e.g. "Government Employees")
 * asks its applicants the same questions — picked once at `/program-catalog/:key`
 * per loan category — and the bank's own configuration is the WEIGHTS and answer
 * scores. Before this guard the admin editor listed the whole global pool and any
 * program could weight any question, so two offers under the same name could be
 * scored on different questions and compared as if they were not.
 *
 * Four guarantees:
 *   1. `getProgramWeights` hands the admin the catalog set for the program's own
 *      (programNameKey, category) pair.
 *   2. A save inside that set goes through untouched.
 *   3. A save naming anything outside it is rejected, listing the offenders.
 *   4. Nothing to scope by — no `programNameKey`, an unknown one, or an empty
 *      catalog set — means nothing may be weighted at all.
 */
import { describe, expect, it } from 'vitest';
import type { LoanCategory } from '@prisma/client';
import { ERROR_CODES } from '@/common/errors/error-codes';
import { ScoringService } from '@/scoring/scoring.service';
import type { SaveWeightsPayload } from '@/scoring/dto/scoring.dto';

const POOL = [
  {
    code: 'employment_status',
    type: 'SINGLE_SELECT' as const,
    questionAr: 'الحالة الوظيفية',
    questionEn: 'Employment status',
    categories: ['personal'] as LoanCategory[],
    numericMinValue: null,
    numericMaxValue: null,
    numericStep: null,
    numericUnitAr: null,
    numericUnitEn: null,
    textMaxLength: null,
    options: [
      { code: 'government', labelAr: 'حكومي', labelEn: 'Government' },
      { code: 'private', labelAr: 'خاص', labelEn: 'Private' },
    ],
  },
  {
    code: 'salary_bank',
    type: 'SINGLE_SELECT' as const,
    questionAr: 'بنك الراتب',
    questionEn: 'Salary bank',
    categories: ['personal'] as LoanCategory[],
    numericMinValue: null,
    numericMaxValue: null,
    numericStep: null,
    numericUnitAr: null,
    numericUnitEn: null,
    textMaxLength: null,
    options: [
      { code: 'same', labelAr: 'نفس البنك', labelEn: 'Same bank' },
      { code: 'other', labelAr: 'بنك آخر', labelEn: 'Another bank' },
    ],
  },
  {
    code: 'prior_rejection',
    type: 'SINGLE_SELECT' as const,
    questionAr: 'رفض سابق',
    questionEn: 'Prior rejection',
    categories: ['personal'] as LoanCategory[],
    numericMinValue: null,
    numericMaxValue: null,
    numericStep: null,
    numericUnitAr: null,
    numericUnitEn: null,
    textMaxLength: null,
    options: [
      { code: 'yes', labelAr: 'نعم', labelEn: 'Yes' },
      { code: 'no', labelAr: 'لا', labelEn: 'No' },
    ],
  },
];

/** The catalog: "Government Employees" scores personal loans on two questions. */
const CATALOG: Record<string, Record<string, string[]>> = {
  govt_employee: {
    personal: ['employment_status', 'salary_bank'],
    // Offered under car too, but with a different set — the category half of the
    // key matters as much as the name half.
    car: ['employment_status'],
  },
  // A catalog name that exists but has nothing picked for any category yet.
  new_segment: {},
};

interface ProgramFixture {
  programNameKey: string | null;
  productCategory: string;
}

function makeService(program: ProgramFixture): ScoringService {
  const questionnaire = { questionsWithOptions: async () => POOL.map((q) => ({ ...q })) };
  const programs = {
    findById: async () => ({
      id: 'prog_1',
      programCode: 'ABK-PL-GOVT',
      friendlyName: 'Government Employees',
      friendlyNameAr: 'موظفو الحكومة',
      bankName: 'ABK Egypt',
      ...program,
    }),
  };
  const enums = {
    memberQuestionTemplate: async (type: string, key: string, category: LoanCategory) => {
      const byCategory = CATALOG[key];
      if (type !== 'program_name' || !byCategory) return null;
      return {
        key,
        labelAr: 'موظفو الحكومة',
        labelEn: 'Government Employees',
        category,
        questionCodes: byCategory[category] ?? [],
      };
    },
  };
  const repo = {
    activeSet: async () => null,
    nextVersionNumber: async () => 1,
    saveActiveTx: async (input: unknown) => input,
  };
  const audit = { write: async () => undefined };
  return new ScoringService(
    repo as never,
    audit as never,
    programs as never,
    questionnaire as never,
    enums as never,
  );
}

/** A valid two-level payload weighting exactly `codes`, split evenly. */
function weightsFor(codes: readonly string[]): SaveWeightsPayload {
  const each = Math.floor(100 / codes.length);
  const questionWeights: Record<string, number> = {};
  const answerScores: Record<string, Record<string, number>> = {};
  codes.forEach((code, i) => {
    questionWeights[code] = i === 0 ? 100 - each * (codes.length - 1) : each;
    const options = POOL.find((q) => q.code === code)?.options ?? [];
    answerScores[code] = Object.fromEntries(options.map((o, n) => [o.code, n === 0 ? 100 : 40]));
  });
  return { questionWeights, answerScores };
}

const save = (service: ScoringService, weights: SaveWeightsPayload): Promise<unknown> =>
  service.saveWeights('prog_1', { weights }, 'staff_1', { sourceIp: null });

describe('the admin is handed the catalog set, not the whole pool', () => {
  it('returns the codes picked for this program name + category', async () => {
    const service = makeService({ programNameKey: 'govt_employee', productCategory: 'personal' });
    const { program } = await service.getProgramWeights('prog_1');
    expect(program.programNameKey).toBe('govt_employee');
    expect(program.catalogQuestionCodes).toEqual(['employment_status', 'salary_bank']);
  });

  it('scopes by CATEGORY as well as by name', async () => {
    const service = makeService({ programNameKey: 'govt_employee', productCategory: 'car' });
    const { program } = await service.getProgramWeights('prog_1');
    expect(program.catalogQuestionCodes).toEqual(['employment_status']);
  });

  it('distinguishes "no catalog name" (null) from "nothing picked yet" ([])', async () => {
    const noKey = makeService({ programNameKey: null, productCategory: 'personal' });
    expect((await noKey.getProgramWeights('prog_1')).program.catalogQuestionCodes).toBeNull();

    const empty = makeService({ programNameKey: 'new_segment', productCategory: 'personal' });
    expect((await empty.getProgramWeights('prog_1')).program.catalogQuestionCodes).toEqual([]);
  });

  it('reads a category outside the locked four as nothing to scope by', async () => {
    const service = makeService({ programNameKey: 'govt_employee', productCategory: 'sme_lite' });
    expect((await service.getProgramWeights('prog_1')).program.catalogQuestionCodes).toBeNull();
  });
});

describe('a save may only weight questions in the catalog set', () => {
  const inScope = { programNameKey: 'govt_employee', productCategory: 'personal' };

  it('accepts the catalog set', async () => {
    const service = makeService(inScope);
    await expect(
      save(service, weightsFor(['employment_status', 'salary_bank'])),
    ).resolves.toBeDefined();
  });

  it('accepts a subset — a bank may leave one of its name’s questions at no weight', async () => {
    const service = makeService(inScope);
    await expect(save(service, weightsFor(['employment_status']))).resolves.toBeDefined();
  });

  it('rejects a question outside the set, naming it', async () => {
    const service = makeService(inScope);
    await expect(
      save(service, weightsFor(['employment_status', 'prior_rejection'])),
    ).rejects.toMatchObject({
      code: ERROR_CODES.WEIGHTS_QUESTION_NOT_IN_CATALOG,
      meta: {
        questionCodes: ['prior_rejection'],
        allowedQuestionCodes: ['employment_status', 'salary_bank'],
      },
    });
  });

  it('rejects a question the OTHER category of the same name asks', async () => {
    const service = makeService({ programNameKey: 'govt_employee', productCategory: 'car' });
    await expect(save(service, weightsFor(['salary_bank']))).rejects.toMatchObject({
      code: ERROR_CODES.WEIGHTS_QUESTION_NOT_IN_CATALOG,
    });
  });

  it('rejects everything when the program has no catalog name', async () => {
    const service = makeService({ programNameKey: null, productCategory: 'personal' });
    await expect(save(service, weightsFor(['employment_status']))).rejects.toMatchObject({
      code: ERROR_CODES.WEIGHTS_QUESTION_NOT_IN_CATALOG,
      meta: { programNameKey: null, allowedQuestionCodes: [] },
    });
  });

  it('rejects everything when the catalog set for this category is empty', async () => {
    const service = makeService({ programNameKey: 'new_segment', productCategory: 'personal' });
    await expect(save(service, weightsFor(['employment_status']))).rejects.toMatchObject({
      code: ERROR_CODES.WEIGHTS_QUESTION_NOT_IN_CATALOG,
    });
  });
});
