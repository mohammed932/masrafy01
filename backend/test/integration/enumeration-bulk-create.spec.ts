/**
 * Loading many values of one list from a pasted sheet.
 *
 * The reason this is an endpoint at all is arithmetic. Four hundred single creates are four
 * hundred requests against a 100-per-15-minutes throttle, four hundred audit round trips, and
 * — for a MIRRORED list — four hundred questionnaire versions, each embedding every option of
 * every question, so the JSON written grows as the square of the list. The three assertions
 * that matter most below are therefore counts: ONE insert, ONE `writeMany`, ONE publish.
 *
 * The second thing under test is IDEMPOTENCY. Keys are slugged from `labelEn` server-side, so
 * re-pasting the same sheet must find every key already there and write nothing. That is why
 * `slugify` is used and not `uniqueSlug`: `uniqueSlug` appends `_2` on collision, which on a
 * list of place names mints two rows no picker and no bank table can tell apart, and turns a
 * re-paste into a second full set of duplicates.
 */
import { describe, expect, it, vi } from 'vitest';
import { PlatformEnumerationsAdminService } from '@/platform-enumerations/platform-enumerations-admin.service';
import { ERROR_CODES } from '@/common/errors/error-codes';
import { DomainException } from '@/common/errors/domain.exceptions';
import { fakeTypeDefinitions, operatorTypeDefinition } from '../helpers/enumeration-type-defs';

const ACTOR = { staffId: 'staff_1', sourceIp: null };

function codeOf(e: unknown): string | undefined {
  return e instanceof DomainException ? e.code : undefined;
}

interface FakeRow {
  id: string;
  type: string;
  key: string;
  sortOrder: number;
  active: boolean;
  deprecatedAt: Date | null;
}

/**
 * Two classes and one district already filed, so a re-paste has something to collide with.
 * `district` declares `district_class` as its axis; `governorate` declares none.
 */
function fixture(): FakeRow[] {
  const r = (id: string, type: string, key: string, sortOrder = 0): FakeRow => ({
    id,
    type,
    key,
    sortOrder,
    active: true,
    deprecatedAt: null,
  });
  return [
    r('cls_a', 'district_class', 'district_class_a', 1),
    r('cls_b', 'district_class', 'district_class_b', 2),
    r('d1', 'district', 'maadi', 7),
  ];
}

function makeService(rows: FakeRow[], opts: { mirrored?: boolean } = {}) {
  const defs = fakeTypeDefinitions([
    operatorTypeDefinition('district_class'),
    operatorTypeDefinition('district', {
      parentTypeKey: 'district_class',
      ...(opts.mirrored === true ? { mirrorQuestionId: 'q_district' } : {}),
    }),
  ]);
  const repo = {
    rows,
    typeDefinitions: vi.fn(async () => defs),
    getActiveMembers: vi.fn(async (type: string) =>
      rows.filter((r) => r.type === type && r.active && r.deprecatedAt === null).map((r) => ({ key: r.key })),
    ),
    findAllOrdered: vi.fn(async (filter?: { type?: string }) =>
      rows.filter((r) => filter?.type === undefined || r.type === filter.type),
    ),
    maxSortOrder: vi.fn(async (type: string) => {
      const mine = rows.filter((r) => r.type === type);
      return mine.length === 0 ? null : Math.max(...mine.map((r) => r.sortOrder));
    }),
    insertMany: vi.fn(
      async (type: string, incoming: ReadonlyArray<{ key: string; sortOrder: number }>) =>
        incoming.map((r, i) => {
          rows.push({
            id: `new_${i}`,
            type,
            key: r.key,
            sortOrder: r.sortOrder,
            active: true,
            deprecatedAt: null,
          });
          return { id: `new_${i}`, key: r.key };
        }),
    ),
    invalidateCache: vi.fn((type?: string) => type),
  };
  const audit = { write: vi.fn(async () => undefined), writeMany: vi.fn(async () => undefined) };
  const questionnaire = { syncMirroredOptions: vi.fn(async () => true) };
  const service = new PlatformEnumerationsAdminService(
    audit as never,
    repo as never,
    questionnaire as never,
  );
  return { service, repo, audit, questionnaire };
}

/** N rows that all name a live class — the happy shape. */
function sheet(n: number, prefix = 'town'): Array<{ labelEn: string; labelAr: string; parentKey: string }> {
  return Array.from({ length: n }, (_, i) => ({
    labelEn: `${prefix} ${i}`,
    labelAr: `${prefix} ${i}`,
    parentKey: i % 2 === 0 ? 'district_class_a' : 'district_class_b',
  }));
}

describe('bulk value create', () => {
  it('writes 400 rows in ONE insert, ONE audit batch and ONE publish', async () => {
    const { service, repo, audit, questionnaire } = makeService(fixture(), { mirrored: true });
    const result = await service.createValuesBulk(
      { type: 'district', rows: sheet(400) },
      ACTOR,
    );

    expect(result.created).toBe(400);
    expect(result.skipped).toBe(0);
    expect(result.republished).toBe(true);
    // The three counts this endpoint exists for.
    expect(repo.insertMany).toHaveBeenCalledTimes(1);
    expect(audit.writeMany).toHaveBeenCalledTimes(1);
    expect((audit.writeMany.mock.calls[0]?.[0] as unknown[]).length).toBe(400);
    expect(questionnaire.syncMirroredOptions).toHaveBeenCalledTimes(1);
  });

  it('is idempotent: the same sheet pasted twice writes nothing and publishes nothing', async () => {
    const rows = fixture();
    const first = makeService(rows, { mirrored: true });
    await first.service.createValuesBulk({ type: 'district', rows: sheet(20) }, ACTOR);

    const second = makeService(rows, { mirrored: true });
    const result = await second.service.createValuesBulk({ type: 'district', rows: sheet(20) }, ACTOR);

    expect(result.created).toBe(0);
    expect(result.skipped).toBe(20);
    expect(second.repo.insertMany).not.toHaveBeenCalled();
    // The one that matters. The sync would report no change and publish nothing anyway, but
    // an operator who re-submits by habit should not reach it at all.
    expect(second.questionnaire.syncMirroredOptions).not.toHaveBeenCalled();
    expect(result.republished).toBe(false);
  });

  it('mints the key from labelEn, never a _2 suffix', async () => {
    // `uniqueSlug` would give `maadi_2` — a row indistinguishable from `maadi` in every
    // picker and in every bank table, minted by the platform without anyone being told.
    const { service } = makeService(fixture());
    const result = await service.createValuesBulk(
      { type: 'district', rows: [{ labelEn: 'Maadi', labelAr: 'المعادي', parentKey: 'district_class_a' }] },
      ACTOR,
    );
    expect(result.created).toBe(0);
    expect(result.skippedRows).toEqual([{ index: 0, key: 'maadi' }]);
  });

  it('reports the row index of an unknown class, zero-based, and writes NOTHING', async () => {
    const { service, repo } = makeService(fixture());
    const rows = sheet(200);
    rows[136] = { labelEn: 'Somewhere', labelAr: 'مكان', parentKey: 'district_class_zz' };
    await expect(
      service.createValuesBulk({ type: 'district', rows }, ACTOR),
    ).rejects.toSatisfy((e: unknown) => {
      if (codeOf(e) !== ERROR_CODES.ENUMERATION_BULK_INVALID) return false;
      const meta = (e as DomainException).meta as { problems: Array<{ index: number; reason: string }> };
      return meta.problems[0]?.index === 136 && meta.problems[0]?.reason === 'parent_unknown';
    });
    expect(repo.insertMany).not.toHaveBeenCalled();
  });

  it('reports EVERY bad row at once, in row order', async () => {
    // One at a time would make a 400-line paste a 400-attempt conversation.
    const { service } = makeService(fixture());
    const rows = sheet(400);
    rows[136] = { labelEn: 'A', labelAr: 'A', parentKey: 'nope' };
    rows[204] = { labelEn: 'B', labelAr: 'B', parentKey: 'nope' };
    rows[301] = { labelEn: 'C', labelAr: 'C', parentKey: 'nope' };
    await expect(service.createValuesBulk({ type: 'district', rows }, ACTOR)).rejects.toSatisfy(
      (e: unknown) => {
        const meta = (e as DomainException).meta as {
          problemsTotal: number;
          problems: Array<{ index: number }>;
        };
        return (
          meta.problemsTotal === 3 && meta.problems.map((p) => p.index).join(',') === '136,204,301'
        );
      },
    );
  });

  it('names the earlier row two identical names collide with', async () => {
    const { service } = makeService(fixture());
    const rows = [
      { labelEn: 'Rehab', labelAr: 'الرحاب', parentKey: 'district_class_a' },
      { labelEn: 'Obour', labelAr: 'العبور', parentKey: 'district_class_a' },
      { labelEn: 'rehab', labelAr: 'الرحاب', parentKey: 'district_class_b' },
    ];
    await expect(service.createValuesBulk({ type: 'district', rows }, ACTOR)).rejects.toSatisfy(
      (e: unknown) => {
        const meta = (e as DomainException).meta as {
          problems: Array<{ index: number; reason: string; firstIndex?: number }>;
        };
        return (
          meta.problems[0]?.index === 2 &&
          meta.problems[0]?.reason === 'duplicate_in_batch' &&
          meta.problems[0]?.firstIndex === 0
        );
      },
    );
  });

  it('refuses a blank class rather than filing it under the fallback', async () => {
    // The fallback answers an operator's UNFILE — a decision they made. A blank column is a
    // typo, and answering a typo with a price tier is what PARENT_REQUIRED exists to refuse.
    const rows = fixture();
    const { service } = makeService(rows);
    await expect(
      service.createValuesBulk(
        { type: 'district', rows: [{ labelEn: 'Nowhere', labelAr: 'لا مكان' }] },
        ACTOR,
      ),
    ).rejects.toSatisfy((e: unknown) => {
      const meta = (e as DomainException).meta as { problems: Array<{ reason: string }> };
      return meta.problems[0]?.reason === 'parent_required';
    });
  });

  it('refuses a class named on a list that is filed under nothing', async () => {
    const { service } = makeService(fixture());
    await expect(
      service.createValuesBulk(
        { type: 'governorate', rows: [{ labelEn: 'Giza', labelAr: 'الجيزة', parentKey: 'x' }] },
        ACTOR,
      ),
    ).rejects.toSatisfy((e: unknown) => {
      const meta = (e as DomainException).meta as { problems: Array<{ reason: string }> };
      return meta.problems[0]?.reason === 'parent_not_applicable';
    });
  });

  it('shuts the door on kinds whose values a three-column paste cannot express', async () => {
    const { service } = makeService(fixture());
    for (const type of ['program_name', 'surrogate_product', 'surrogate_fact']) {
      await expect(
        service.createValuesBulk({ type, rows: [{ labelEn: 'X', labelAr: 'X' }] }, ACTOR),
      ).rejects.toSatisfy(
        (e: unknown) => codeOf(e) === ERROR_CODES.ENUMERATION_BULK_CREATE_NOT_APPLICABLE,
      );
    }
  });

  it('dryRun reports the same numbers and writes nothing at all', async () => {
    const { service, repo, audit, questionnaire } = makeService(fixture(), { mirrored: true });
    const result = await service.createValuesBulk(
      { type: 'district', rows: sheet(10), dryRun: true },
      ACTOR,
    );
    expect(result.created).toBe(10);
    expect(result.republished).toBe(false);
    expect(repo.insertMany).not.toHaveBeenCalled();
    expect(audit.writeMany).not.toHaveBeenCalled();
    expect(questionnaire.syncMirroredOptions).not.toHaveBeenCalled();
  });

  it('turns a duplicate into a refusal when the operator says onDuplicate: fail', async () => {
    // A re-paste and a paste-into-the-wrong-list are different intentions.
    const { service } = makeService(fixture());
    await expect(
      service.createValuesBulk(
        {
          type: 'district',
          rows: [{ labelEn: 'Maadi', labelAr: 'المعادي', parentKey: 'district_class_a' }],
          onDuplicate: 'fail',
        },
        ACTOR,
      ),
    ).rejects.toSatisfy((e: unknown) => {
      const meta = (e as DomainException).meta as { problems: Array<{ reason: string }> };
      return meta.problems[0]?.reason === 'duplicate_existing';
    });
  });

  it('appends after the list’s current maximum, so a second paste renumbers nothing', async () => {
    // Load-bearing for the mirrored sync: `displayOrder` is a DENSE index over
    // `[sortOrder asc, key asc]`, so rows that sort LAST leave every existing option's index
    // untouched and the sync's update set empty.
    const { service, repo } = makeService(fixture());
    await service.createValuesBulk({ type: 'district', rows: sheet(3) }, ACTOR);
    const written = repo.insertMany.mock.calls[0]?.[1] as ReadonlyArray<{ sortOrder: number }>;
    expect(written.map((r) => r.sortOrder)).toEqual([8, 9, 10]);
  });

  it('clears EVERY cached type, not just the one written', async () => {
    // New children of a class list change what `surrogate_fact`'s derived `parentOptions`
    // answers — the reasoning `update()` already writes out and single-row `create()` gets wrong.
    const { service, repo } = makeService(fixture());
    await service.createValuesBulk({ type: 'district', rows: sheet(2) }, ACTOR);
    expect(repo.invalidateCache).toHaveBeenCalledWith();
  });
});
