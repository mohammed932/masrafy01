/**
 * The catalog question set is BINDING on `saveWeights`.
 *
 * This file used to assert the exact opposite, under a "do not delete" banner:
 * the catalog template was advisory, and teaching `saveWeights` about
 * `platform_enumeration_question` was called out as a natural-looking, breaking
 * change. That reversal is deliberate, so the reasoning is recorded here rather
 * than lost with the old assertions.
 *
 * What changed: the question set is no longer the bank program's to choose. Every
 * program sold under one `program_name` scores on the SAME questions — picked
 * once per loan category at `/program-catalog/:key` — and the per-bank
 * configuration is the weights and answer scores. Two programs under one name
 * scored on different questions are not comparable, which is the whole point of
 * the name.
 *
 * What the old spec feared still cannot happen: narrowing an archetype does NOT
 * invalidate a weight set a bank already saved. Saved sets are stored rows and
 * are never revalidated — matching keeps scoring on them untouched. The catalog
 * is consulted only on a NEW save, where the admin screen already shows the
 * dropped questions and asks for the freed weight to be redistributed.
 *
 * `ScoringService`'s dependency list containing something enumeration-shaped is
 * now part of the contract, and this file stops compiling if that changes.
 */
import { describe, expect, it, vi } from 'vitest';
import { ERROR_CODES } from '@/common/errors/error-codes';
import { ScoringService } from '@/scoring/scoring.service';

const PROGRAM = {
  id: 'bp_1',
  programCode: 'ABK-CAR-NEW_CAR',
  friendlyName: 'New Car',
  friendlyNameAr: 'سيارة جديدة',
  bankName: 'ABK Egypt',
  productCategory: 'car',
  programNameKey: 'new_car',
};

/** `new_car` scores car loans on these two, and on nothing else. */
const CATALOG_SET = ['monthly_income', 'model_year'];

const QUESTIONS = [
  { code: 'monthly_income', type: 'NUMERIC', categories: ['car'], options: [] },
  {
    code: 'business_age',
    type: 'SINGLE_SELECT',
    categories: ['business'],
    options: [{ code: 'over_2y' }],
  },
  { code: 'model_year', type: 'NUMERIC', categories: ['car'], options: [] },
];

const YEAR_BANDS = [
  { from: null, to: '2015', score: 20 },
  { from: '2015', to: null, score: 100 },
];

const INCOME_BANDS = [
  { from: null, to: '10000', score: 30 },
  { from: '10000', to: null, score: 100 },
];

function makeService(questionCodes: string[] = CATALOG_SET) {
  const saved: unknown[] = [];
  const repo = {
    nextVersionNumber: vi.fn(async () => 1),
    saveActiveTx: vi.fn(async (input: unknown) => {
      saved.push(input);
      return { id: 'ws_1', versionNumber: 1 };
    }),
    findActive: vi.fn(async () => null),
  };
  const enums = {
    memberQuestionTemplate: vi.fn(async (_type: string, key: string, category: string) => ({
      key,
      labelAr: 'سيارة جديدة',
      labelEn: 'New Car',
      category,
      questionCodes,
    })),
  };
  const service = new ScoringService(
    repo as never,
    { write: vi.fn(async () => undefined) } as never,
    { findById: vi.fn(async () => PROGRAM) } as never,
    { questionsWithOptions: vi.fn(async () => QUESTIONS) } as never,
    enums as never,
  );
  return { service, repo, saved, enums };
}

const CTX = { sourceIp: '127.0.0.1' };

describe('the catalog question set binds saveWeights', () => {
  it('accepts a weight set drawn from the catalog set, persisted exactly as sent', async () => {
    const { service, saved } = makeService();

    await service.saveWeights(
      'bp_1',
      {
        weights: {
          questionWeights: { model_year: 60, monthly_income: 40 },
          answerScores: {},
          numericBands: { model_year: YEAR_BANDS, monthly_income: INCOME_BANDS },
        },
      } as never,
      'stf_1',
      CTX,
    );

    expect(saved).toHaveLength(1);
    const written = (saved[0] as { weights: { questionWeights: Record<string, number> } }).weights;
    // Not augmented by the catalog either: a bank may leave one of its name's
    // questions unweighted, it just may not add one of its own.
    expect(Object.keys(written.questionWeights).sort()).toEqual(['model_year', 'monthly_income']);
  });

  it('accepts a subset of the catalog set', async () => {
    const { service, saved } = makeService();

    await service.saveWeights(
      'bp_1',
      {
        weights: {
          questionWeights: { model_year: 100 },
          answerScores: {},
          numericBands: { model_year: YEAR_BANDS },
        },
      } as never,
      'stf_1',
      CTX,
    );

    expect(saved).toHaveLength(1);
  });

  it('rejects a question the catalog set does not carry, naming it', async () => {
    const { service, saved } = makeService();

    await expect(
      service.saveWeights(
        'bp_1',
        {
          weights: {
            questionWeights: { model_year: 60, business_age: 40 },
            answerScores: { business_age: { over_2y: 100 } },
            numericBands: { model_year: YEAR_BANDS },
          },
        } as never,
        'stf_1',
        CTX,
      ),
    ).rejects.toMatchObject({
      code: ERROR_CODES.WEIGHTS_QUESTION_NOT_IN_CATALOG,
      meta: { questionCodes: ['business_age'], allowedQuestionCodes: CATALOG_SET },
    });
    expect(saved).toHaveLength(0);
  });

  it('scopes the lookup to the program’s own name and category', async () => {
    const { service, enums } = makeService();

    await service.saveWeights(
      'bp_1',
      {
        weights: {
          questionWeights: { model_year: 100 },
          answerScores: {},
          numericBands: { model_year: YEAR_BANDS },
        },
      } as never,
      'stf_1',
      CTX,
    );

    expect(enums.memberQuestionTemplate).toHaveBeenCalledWith('program_name', 'new_car', 'car');
  });

  /**
   * The scenario the previous contract existed to protect. It still cannot make a
   * SAVED set unusable — matching never revalidates — but a re-save must now
   * follow the narrowed catalog, which is what the editor's "dropped" notice and
   * the 100% budget walk the admin through.
   */
  it('rejects a re-save of a set the catalog has since narrowed away from', async () => {
    const { service } = makeService(['monthly_income']);

    await expect(
      service.saveWeights(
        'bp_1',
        {
          weights: {
            questionWeights: { model_year: 100 },
            answerScores: {},
            numericBands: { model_year: YEAR_BANDS },
          },
        } as never,
        'stf_1',
        CTX,
      ),
    ).rejects.toMatchObject({ code: ERROR_CODES.WEIGHTS_QUESTION_NOT_IN_CATALOG });
  });
});
