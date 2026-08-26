/**
 * Loan-category assignment on the program-name catalog.
 *
 * The catalog is a `platform_enumeration` type, and the assignment is an
 * AUTHORITATIVE many-to-many: the bank-program builder filters its picker on it
 * and the API rejects an unassigned pair. That makes three things correctness
 * matters rather than cosmetics, and they are what this spec pins:
 *
 *  - the submitted array REPLACES the set (an empty one parks the entry),
 *  - a bulk action validates every id BEFORE it writes anything,
 *  - only categorisable types have the axis at all.
 */
import { describe, expect, it, vi } from 'vitest';
import { LoanCategory } from '@prisma/client';
import { ALL_LOAN_CATEGORIES } from '@/common/loan-category.util';
import { PlatformEnumerationsAdminService } from '@/platform-enumerations/platform-enumerations-admin.service';
import { ERROR_CODES } from '@/common/errors/error-codes';
import { DomainException } from '@/common/errors/domain.exceptions';
import { fakeTypeDefinitions } from '../helpers/enumeration-type-defs';

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

// Read from the shared list rather than re-typed, so a category added or removed by
// amendment cannot leave this test asserting yesterday's product scope — v15.0.0 added a
// fifth (`fast`) and v16.0.0 took it away again, and this line needed no edit either time.
const ALL: LoanCategory[] = [...ALL_LOAN_CATEGORIES];

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

/**
 * Stands in for `PostgresPlatformEnumerationsRepository`. `assignments` is the
 * join table; `setCategories` mirrors the repo's delete-then-insert so a test
 * cannot pass on a merge the real code never performs.
 */
function makeRepo(rows: FakeRow[], seed: Record<string, LoanCategory[]> = {}) {
  const assignments = new Map<string, LoanCategory[]>(
    Object.entries(seed).map(([id, cats]) => [id, [...cats]]),
  );
  return {
    assignments,
    invalidated: [] as (string | undefined)[],
    inserted: [] as Array<{ type: string; categories?: readonly LoanCategory[] }>,
    typeDefinitions: vi.fn(async () => fakeTypeDefinitions()),
    findById: vi.fn(async (id: string) => rows.find((r) => r.id === id) ?? null),
    findByTypeAndKey: vi.fn(async (type: string, key: string) =>
      rows.find((r) => r.type === type && r.key === key) ?? null,
    ),
    findAllOrdered: vi.fn(async (filter?: { type?: string }) =>
      filter?.type ? rows.filter((r) => r.type === filter.type) : rows,
    ),
    categoriesOf: vi.fn(async (id: string) => [...(assignments.get(id) ?? [])]),
    categoryAssignments: vi.fn(async () => new Map(assignments)),
    setCategories: vi.fn(async (id: string, cats: readonly LoanCategory[]) => {
      assignments.delete(id);
      if (cats.length > 0) assignments.set(id, [...cats]);
    }),
    setCategoriesBulk: vi.fn(
      async (list: ReadonlyArray<{ enumerationId: string; categories: readonly LoanCategory[] }>) => {
        for (const a of list) {
          assignments.delete(a.enumerationId);
          if (a.categories.length > 0) assignments.set(a.enumerationId, [...a.categories]);
        }
      },
    ),
    insert: vi.fn(async (input: { type: string; categories?: readonly LoanCategory[] }) => {
      const created = row({ id: 'new', type: input.type, key: 'new' });
      rows.push(created);
      if (input.categories?.length) assignments.set(created.id, [...input.categories]);
      return created;
    }),
    invalidateCache: vi.fn(function (this: void, type?: string) {
      return type;
    }),
  };
}

function makeService(repo: ReturnType<typeof makeRepo>) {
  const audit = { write: vi.fn(async () => undefined) };
  const service = new PlatformEnumerationsAdminService(
    audit as never,
    repo as never,
  );
  return { service, audit };
}

const ACTOR = { staffId: 'stf_1', sourceIp: '127.0.0.1' };

describe('program-name loan-category assignment', () => {
  it('replaces the set rather than merging into it', async () => {
    const rows = [row({ id: 'pn_1', type: 'program_name', key: 'doctor' })];
    const repo = makeRepo(rows, { pn_1: [...ALL] });
    const { service } = makeService(repo);

    await service.setCategories('pn_1', ['car', 'personal'], ACTOR);

    // Canonical order, and the two dropped categories are gone — not merged back.
    expect(repo.assignments.get('pn_1')).toEqual(['personal', 'car']);
  });

  it('parks an entry when the submitted set is empty', async () => {
    const rows = [row({ id: 'pn_1', type: 'program_name', key: 'doctor' })];
    const repo = makeRepo(rows, { pn_1: ['personal'] });
    const { service } = makeService(repo);

    await service.setCategories('pn_1', [], ACTOR);

    // The row survives; only its assignment is gone. Parked, not deleted.
    expect(repo.assignments.has('pn_1')).toBe(false);
    expect(rows).toHaveLength(1);
  });

  it('dedupes and canonically orders a scrambled submission', async () => {
    const rows = [row({ id: 'pn_1', type: 'program_name', key: 'doctor' })];
    const repo = makeRepo(rows);
    const { service } = makeService(repo);

    await service.setCategories('pn_1', ['business', 'personal', 'business', 'car'], ACTOR);

    expect(repo.assignments.get('pn_1')).toEqual(['personal', 'car', 'business']);
  });

  it('refuses an enumeration type that has no category axis', async () => {
    const rows = [row({ id: 'gov_1', type: 'governorate', key: 'cairo' })];
    const repo = makeRepo(rows);
    const { service } = makeService(repo);

    await expect(service.setCategories('gov_1', ['personal'], ACTOR)).rejects.toMatchObject({
      code: ERROR_CODES.ENUMERATION_CATEGORIES_NOT_APPLICABLE,
      meta: { type: 'governorate' },
    });
    expect(repo.setCategories).not.toHaveBeenCalled();
  });

  it('refuses an unknown id', async () => {
    const repo = makeRepo([]);
    const { service } = makeService(repo);

    await expect(service.setCategories('nope', ['personal'], ACTOR)).rejects.toBeInstanceOf(
      DomainException,
    );
  });

  /**
   * A `systemOnly` row still has to be fileable: which loan types may offer a
   * name is an operational choice, not a system invariant. `update()` guards
   * `active`/`deprecate` on such rows and this deliberately does not.
   */
  it('allows assignment on a systemOnly row', async () => {
    const rows = [row({ id: 'pn_1', type: 'program_name', key: 'doctor', systemOnly: true })];
    const repo = makeRepo(rows);
    const { service } = makeService(repo);

    await service.setCategories('pn_1', ['mortgage'], ACTOR);

    expect(repo.assignments.get('pn_1')).toEqual(['mortgage']);
  });

  it('audits the diff, and stays silent on a no-op re-save', async () => {
    const rows = [row({ id: 'pn_1', type: 'program_name', key: 'doctor' })];
    const repo = makeRepo(rows, { pn_1: ['personal', 'car'] });
    const { service, audit } = makeService(repo);

    await service.setCategories('pn_1', ['personal'], ACTOR);
    expect(audit.write).toHaveBeenCalledTimes(1);
    expect(audit.write.mock.calls[0]?.[0]).toMatchObject({
      payload: { key: 'doctor', changes: { categories: { from: ['personal', 'car'], to: ['personal'] } } },
    });

    // The board autosaves on every tap; an unchanged set is a re-render, not a
    // decision, and must not fill the audit log with noise.
    await service.setCategories('pn_1', ['personal'], ACTOR);
    expect(audit.write).toHaveBeenCalledTimes(1);
  });

  it('invalidates the member cache so the picker cannot serve a stale list', async () => {
    const rows = [row({ id: 'pn_1', type: 'program_name', key: 'doctor' })];
    const repo = makeRepo(rows);
    const { service } = makeService(repo);

    await service.setCategories('pn_1', ['personal'], ACTOR);

    expect(repo.invalidateCache).toHaveBeenCalledWith('program_name');
  });

  describe('bulk', () => {
    it('validates every id before writing anything', async () => {
      const rows = [
        row({ id: 'pn_1', type: 'program_name', key: 'doctor' }),
        row({ id: 'pn_2', type: 'program_name', key: 'new_car' }),
      ];
      const repo = makeRepo(rows, { pn_1: ['personal'], pn_2: ['car'] });
      const { service } = makeService(repo);

      await expect(
        service.setCategoriesBulk(
          [
            { id: 'pn_1', categories: ['mortgage'] },
            { id: 'ghost', categories: ['mortgage'] },
            { id: 'pn_2', categories: ['mortgage'] },
          ],
          ACTOR,
        ),
      ).rejects.toBeInstanceOf(DomainException);

      // A half-applied bulk leaves the operator unable to tell which half landed.
      expect(repo.setCategoriesBulk).not.toHaveBeenCalled();
      expect(repo.assignments.get('pn_1')).toEqual(['personal']);
      expect(repo.assignments.get('pn_2')).toEqual(['car']);
    });

    it('writes one audit event per CHANGED row only', async () => {
      const rows = [
        row({ id: 'pn_1', type: 'program_name', key: 'doctor' }),
        row({ id: 'pn_2', type: 'program_name', key: 'new_car' }),
      ];
      const repo = makeRepo(rows, { pn_1: ['personal'], pn_2: ['car'] });
      const { service, audit } = makeService(repo);

      await service.setCategoriesBulk(
        [
          { id: 'pn_1', categories: ['personal'] }, // unchanged
          { id: 'pn_2', categories: ['car', 'personal'] }, // changed
        ],
        ACTOR,
      );

      expect(audit.write).toHaveBeenCalledTimes(1);
      expect(audit.write.mock.calls[0]?.[0]).toMatchObject({
        payload: { key: 'new_car' },
      });
    });
  });

  describe('create', () => {
    it('defaults a new catalog name to NO category', async () => {
      const repo = makeRepo([]);
      const { service } = makeService(repo);

      await service.create(
        { type: 'program_name', key: 'pharmacy', labelAr: 'ص', labelEn: 'Pharmacy' },
        ACTOR,
      );

      // Which loan types a name reaches is a decision. Defaulting to all four made
      // the platform take it, silently, on every create — the name's own step 2 is
      // where it is taken now, and it reports the unset state as `invalid`.
      expect(repo.insert.mock.calls[0]?.[0]).toMatchObject({ categories: [] });
    });

    it('still honours an explicit category list', async () => {
      const repo = makeRepo([]);
      const { service } = makeService(repo);

      await service.create(
        {
          type: 'program_name',
          key: 'pharmacy',
          labelAr: 'ص',
          labelEn: 'Pharmacy',
          categories: [...ALL],
        },
        ACTOR,
      );

      expect(repo.insert.mock.calls[0]?.[0]).toMatchObject({ categories: ALL });
    });

    it('assigns nothing on a type that has no category axis', async () => {
      const repo = makeRepo([]);
      const { service } = makeService(repo);

      await service.create(
        {
          type: 'governorate',
          key: 'USD',
          labelAr: 'دولار',
          labelEn: 'Dollar',
          categories: ['personal'],
        },
        ACTOR,
      );

      expect(repo.insert.mock.calls[0]?.[0]).toMatchObject({ categories: [] });
    });
  });
});
