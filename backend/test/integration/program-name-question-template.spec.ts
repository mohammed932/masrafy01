/**
 * Question TEMPLATE on the program-name catalog, PER LOAN CATEGORY.
 *
 * The archetype suggests which questions a bank should score its product on; the
 * bank program's scoring wizard sets the weights. The suggestion is a fact about
 * the (name, category) PAIR — "Doctor Loans" scores on different things as a
 * personal loan than as a business one — so every write here is scoped to one
 * category.
 *
 * That makes four behaviours correctness matters rather than cosmetics, and they
 * are what this spec pins:
 *
 *  - the submitted array REPLACES that category's set (an empty one clears it),
 *  - and touches NO other category's set,
 *  - a code OUTSIDE the category's asked set is ACCEPTED, because pruning it
 *    would destroy configuration the admin never asked to lose,
 *  - a pick on a soft-deleted question SURVIVES a re-save, for the same reason.
 *
 * The last two look like missing validation and are not. Deleting either
 * assertion re-introduces a silent prune.
 */
import { describe, expect, it, vi } from 'vitest';
import type { LoanCategory } from '@prisma/client';
import { PlatformEnumerationsAdminService } from '@/platform-enumerations/platform-enumerations-admin.service';
import { ERROR_CODES } from '@/common/errors/error-codes';
import { DomainException } from '@/common/errors/domain.exceptions';

interface FakeRow {
  id: string;
  type: string;
  key: string;
  labelAr: string;
  labelEn: string;
  active: boolean;
  systemOnly: boolean;
  deprecatedAt: Date | null;
  parentKey: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

function row(over: Partial<FakeRow> & Pick<FakeRow, 'id' | 'type' | 'key'>): FakeRow {
  return {
    labelAr: over.key,
    labelEn: over.key,
    active: true,
    systemOnly: false,
    deprecatedAt: null,
    parentKey: null,
    sortOrder: 0,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...over,
  };
}

const PERSONAL: LoanCategory = 'personal';
const BUSINESS: LoanCategory = 'business';

/** One entry's template: category → codes, exactly the repository's shape. */
type Template = Partial<Record<LoanCategory, string[]>>;

/**
 * `allCodes` is every question row INCLUDING soft-deleted ones — which is what
 * the real `existingQuestionCodes` checks against, and the reason an inactive
 * pick can be re-saved.
 *
 * `setQuestions` deletes and re-inserts ONLY the submitted category, mirroring
 * the real `deleteMany({ enumerationId, category })`. A fake that cleared the
 * whole entry would pass every test below while the production write silently
 * wiped three tabs.
 */
function makeRepo(
  rows: FakeRow[],
  opts: { seed?: Record<string, Template>; allCodes?: string[] } = {},
) {
  const templates = new Map<string, Template>(
    Object.entries(opts.seed ?? {}).map(([id, byCategory]) => [
      id,
      Object.fromEntries(
        Object.entries(byCategory).map(([category, codes]) => [category, [...(codes ?? [])]]),
      ) as Template,
    ]),
  );
  const allCodes = new Set(opts.allCodes ?? ['monthly_income', 'business_age', 'retired_question']);
  return {
    templates,
    findById: vi.fn(async (id: string) => rows.find((r) => r.id === id) ?? null),
    findAllOrdered: vi.fn(async (filter?: { type?: string }) =>
      filter?.type ? rows.filter((r) => r.type === filter.type) : rows,
    ),
    questionsOf: vi.fn(async (id: string) => ({ ...(templates.get(id) ?? {}) })),
    questionsOfCategory: vi.fn(async (id: string, category: LoanCategory) => [
      ...(templates.get(id)?.[category] ?? []),
    ]),
    questionAssignments: vi.fn(async () => new Map(templates)),
    existingQuestionCodes: vi.fn(
      async (codes: readonly string[]) => new Set(codes.filter((c) => allCodes.has(c))),
    ),
    setQuestions: vi.fn(async (id: string, category: LoanCategory, codes: readonly string[]) => {
      const byCategory = templates.get(id) ?? {};
      delete byCategory[category];
      if (codes.length > 0) byCategory[category] = [...codes];
      if (Object.keys(byCategory).length > 0) templates.set(id, byCategory);
      else templates.delete(id);
    }),
    invalidateCache: vi.fn(),
  };
}

function codesFor(
  repo: ReturnType<typeof makeRepo>,
  id: string,
  category: LoanCategory,
): string[] | undefined {
  return repo.templates.get(id)?.[category];
}

function makeService(repo: ReturnType<typeof makeRepo>) {
  const audit = { write: vi.fn(async () => undefined) };
  const service = new PlatformEnumerationsAdminService(audit as never, repo as never);
  return { service, audit };
}

const ACTOR = { staffId: 'stf_1', sourceIp: '127.0.0.1' };

describe('catalog program-name question template', () => {
  it('replaces the category’s set rather than merging into it', async () => {
    const rows = [row({ id: 'pn_1', type: 'program_name', key: 'new_car' })];
    const repo = makeRepo(rows, {
      seed: { pn_1: { personal: ['monthly_income', 'business_age'] } },
    });
    const { service } = makeService(repo);

    await service.setQuestions('pn_1', PERSONAL, ['monthly_income'], ACTOR);

    expect(codesFor(repo, 'pn_1', PERSONAL)).toEqual(['monthly_income']);
  });

  /**
   * THE per-category assertion. The two tabs are set on the same screen minutes
   * apart, so a write that leaked across them would look like the app forgetting
   * what the admin just typed.
   */
  it('leaves every OTHER category’s set untouched', async () => {
    const rows = [row({ id: 'pn_1', type: 'program_name', key: 'pharmacy' })];
    const repo = makeRepo(rows, {
      seed: { pn_1: { personal: ['monthly_income'], business: ['business_age'] } },
    });
    const { service } = makeService(repo);

    await service.setQuestions('pn_1', PERSONAL, [], ACTOR);

    expect(codesFor(repo, 'pn_1', PERSONAL)).toBeUndefined();
    expect(codesFor(repo, 'pn_1', BUSINESS)).toEqual(['business_age']);
  });

  it('clears one category’s template when its set is empty', async () => {
    const rows = [row({ id: 'pn_1', type: 'program_name', key: 'new_car' })];
    const repo = makeRepo(rows, { seed: { pn_1: { personal: ['monthly_income'] } } });
    const { service } = makeService(repo);

    await service.setQuestions('pn_1', PERSONAL, [], ACTOR);

    // Cleared, not "unset to some default" — an empty set means the wizard seeds
    // nothing for that category, which is the day-one state and not a problem.
    expect(codesFor(repo, 'pn_1', PERSONAL)).toBeUndefined();
    expect(rows).toHaveLength(1);
  });

  it('dedupes a repeated code', async () => {
    const rows = [row({ id: 'pn_1', type: 'program_name', key: 'new_car' })];
    const repo = makeRepo(rows);
    const { service } = makeService(repo);

    await service.setQuestions('pn_1', PERSONAL, ['monthly_income', 'monthly_income'], ACTOR);

    expect(codesFor(repo, 'pn_1', PERSONAL)).toEqual(['monthly_income']);
  });

  /**
   * THE anti-prune assertion. `business_age` is asked only for business, so a
   * pick of it under PERSONAL is out of scope. The screen flags that and lets the
   * admin clear it — the service must not decide for them.
   */
  it('ACCEPTS a code the category never asks', async () => {
    const rows = [row({ id: 'pn_1', type: 'program_name', key: 'new_car' })];
    const repo = makeRepo(rows);
    const { service } = makeService(repo);

    await service.setQuestions('pn_1', PERSONAL, ['monthly_income', 'business_age'], ACTOR);

    expect(codesFor(repo, 'pn_1', PERSONAL)).toEqual(['monthly_income', 'business_age']);
  });

  /**
   * Same anti-prune posture on the other axis: a name that is not currently
   * OFFERED under a category can still be templated for it. The screen shows that
   * tab with its "offered under" switch off; rejecting the write would make an
   * existing set unsaveable the moment someone narrowed the assignment.
   */
  it('ACCEPTS a category the name is not assigned to', async () => {
    const rows = [row({ id: 'pn_1', type: 'program_name', key: 'new_car' })];
    const repo = makeRepo(rows);
    const { service } = makeService(repo);

    await service.setQuestions('pn_1', BUSINESS, ['business_age'], ACTOR);

    expect(codesFor(repo, 'pn_1', BUSINESS)).toEqual(['business_age']);
  });

  /**
   * Questions are soft-deleted, so a template can name one that has left the
   * active pool. Validation checks EVERY question, not the pool, or an admin
   * re-saving a drifted template would be blocked by the very row they came here
   * to remove.
   */
  it('lets a pick on a soft-deleted question survive a re-save', async () => {
    const rows = [row({ id: 'pn_1', type: 'program_name', key: 'new_car' })];
    // `retired_question` exists in the table but not in the active pool.
    const repo = makeRepo(rows, { seed: { pn_1: { personal: ['retired_question'] } } });
    const { service } = makeService(repo);

    await service.setQuestions('pn_1', PERSONAL, ['retired_question', 'monthly_income'], ACTOR);

    expect(codesFor(repo, 'pn_1', PERSONAL)).toEqual(['retired_question', 'monthly_income']);
  });

  it('refuses codes that match no question at all, naming every offender', async () => {
    const rows = [row({ id: 'pn_1', type: 'program_name', key: 'new_car' })];
    const repo = makeRepo(rows);
    const { service } = makeService(repo);

    await expect(
      service.setQuestions('pn_1', PERSONAL, ['monthly_income', 'ghost', 'phantom'], ACTOR),
    ).rejects.toMatchObject({
      code: ERROR_CODES.ENUMERATION_QUESTION_UNKNOWN,
      meta: { type: 'program_name', key: 'new_car', unknownCodes: ['ghost', 'phantom'] },
    });
    expect(repo.setQuestions).not.toHaveBeenCalled();
  });

  it('refuses an enumeration type that carries no template', async () => {
    const rows = [row({ id: 'cur_1', type: 'currency', key: 'EGP' })];
    const repo = makeRepo(rows);
    const { service } = makeService(repo);

    await expect(
      service.setQuestions('cur_1', PERSONAL, ['monthly_income'], ACTOR),
    ).rejects.toMatchObject({
      code: ERROR_CODES.ENUMERATION_QUESTIONS_NOT_APPLICABLE,
      meta: { type: 'currency' },
    });
    expect(repo.setQuestions).not.toHaveBeenCalled();
  });

  it('refuses an unknown id', async () => {
    const repo = makeRepo([]);
    const { service } = makeService(repo);
    await expect(service.setQuestions('nope', PERSONAL, [], ACTOR)).rejects.toBeInstanceOf(
      DomainException,
    );
  });

  /** Which questions a name suggests is operational, not a system invariant. */
  it('allows a template on a systemOnly row', async () => {
    const rows = [row({ id: 'pn_1', type: 'program_name', key: 'new_car', systemOnly: true })];
    const repo = makeRepo(rows);
    const { service } = makeService(repo);

    await service.setQuestions('pn_1', PERSONAL, ['monthly_income'], ACTOR);

    expect(codesFor(repo, 'pn_1', PERSONAL)).toEqual(['monthly_income']);
  });

  /**
   * The audit key names the CATEGORY. A bare `questions` diff would read as
   * though the whole template had been replaced, and the log is what an operator
   * reaches for when a bank asks why its wizard changed.
   */
  it('audits the diff per category, and stays silent on a no-op re-save', async () => {
    const rows = [row({ id: 'pn_1', type: 'program_name', key: 'new_car' })];
    const repo = makeRepo(rows, { seed: { pn_1: { personal: ['monthly_income'] } } });
    const { service, audit } = makeService(repo);

    await service.setQuestions('pn_1', PERSONAL, ['monthly_income', 'business_age'], ACTOR);
    expect(audit.write).toHaveBeenCalledTimes(1);
    expect(audit.write.mock.calls[0]?.[0]).toMatchObject({
      payload: {
        key: 'new_car',
        changes: {
          'questions.personal': {
            from: ['monthly_income'],
            to: ['business_age', 'monthly_income'],
          },
        },
      },
    });

    await service.setQuestions('pn_1', PERSONAL, ['monthly_income', 'business_age'], ACTOR);
    expect(audit.write).toHaveBeenCalledTimes(1);
  });

  /**
   * The no-op check reads the CATEGORY's set, not the entry's. Diffing against
   * the whole template would make an identical Business set look like a change
   * whenever Personal held something else — an audit log full of edits nobody
   * made.
   */
  it('stays silent when only another category holds a different set', async () => {
    const rows = [row({ id: 'pn_1', type: 'program_name', key: 'pharmacy' })];
    const repo = makeRepo(rows, {
      seed: { pn_1: { personal: ['monthly_income'], business: ['business_age'] } },
    });
    const { service, audit } = makeService(repo);

    await service.setQuestions('pn_1', BUSINESS, ['business_age'], ACTOR);

    expect(audit.write).not.toHaveBeenCalled();
  });

  /**
   * The audit diff compares SETS. Display order comes from the questionnaire's
   * `displayOrder`, and a reshuffle there must not read as a template edit.
   */
  it('treats a reordered but identical set as a no-op', async () => {
    const rows = [row({ id: 'pn_1', type: 'program_name', key: 'new_car' })];
    const repo = makeRepo(rows, {
      seed: { pn_1: { personal: ['monthly_income', 'business_age'] } },
    });
    const { service, audit } = makeService(repo);

    await service.setQuestions('pn_1', PERSONAL, ['business_age', 'monthly_income'], ACTOR);

    expect(audit.write).not.toHaveBeenCalled();
  });

  /**
   * Question codes are kept OFF the cached `EnumerationMember` precisely so the
   * 60s registry cache cannot serve the scoring wizard a stale suggestion.
   * Invalidating here would imply the cache holds them.
   */
  it('does not invalidate the member cache', async () => {
    const rows = [row({ id: 'pn_1', type: 'program_name', key: 'new_car' })];
    const repo = makeRepo(rows);
    const { service } = makeService(repo);

    await service.setQuestions('pn_1', PERSONAL, ['monthly_income'], ACTOR);

    expect(repo.invalidateCache).not.toHaveBeenCalled();
  });
});
