/**
 * The parent axis: which LIST a registry value is filed under.
 *
 * One entry uses it today — a district is filed under a district CLASS — and the whole
 * collateral product hangs off it: the bank keys its cap table by three classes while the
 * customer picks one of hundreds of districts by name, and `factParentTable` walks one to the
 * other. Three properties are correctness rather than cosmetics, and they are what this pins:
 *
 *  - a value of a filed-under type MUST name a live parent on CREATE, and a patch can never
 *    unfile one (an unfiled value is offered to the customer and prices nothing —
 *    `no_matching_row` stops the rule),
 *  - the bulk endpoint, and only it, accepts an explicit `null` — the class board's uncheck.
 *    `''` and an absent field stay refused everywhere: a stored empty string passes the
 *    engine's `parentKey IS NOT NULL` filter, so the value looks filed and prices nothing
 *    anyway, which is the same damage with none of the intent,
 *  - a bulk re-file validates every id and every target BEFORE it writes anything, and
 *    audits one event per value that actually MOVED,
 *  - a parent may not be retired while values are still filed under it, because the engine's
 *    parent walk filters the CHILD's active flag and never the parent's.
 */
import { describe, expect, it, vi } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PlatformEnumerationsAdminService } from '@/platform-enumerations/platform-enumerations-admin.service';
import {
  CreateEnumerationDto,
  EnumerationParentAssignmentDto,
  UpdateEnumerationDto,
} from '@/platform-enumerations/dto/enumeration.dto';
import { ERROR_CODES } from '@/common/errors/error-codes';
import { DomainException } from '@/common/errors/domain.exceptions';
import { fakeTypeDefinitions, operatorAxisDefinitions } from '../helpers/enumeration-type-defs';

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

/** The three classes and three districts the cases below re-file. */
function fixture(): FakeRow[] {
  return [
    row({ id: 'cls_a', type: 'district_class', key: 'district_class_a' }),
    row({ id: 'cls_b', type: 'district_class', key: 'district_class_b' }),
    row({ id: 'cls_c', type: 'district_class', key: 'district_class_c', active: false }),
    row({ id: 'c1', type: 'district', key: 'maadi', parentKey: 'district_class_a' }),
    row({ id: 'c2', type: 'district', key: 'nasr_city', parentKey: 'district_class_a' }),
    row({ id: 'g1', type: 'governorate', key: 'cairo' }),
  ];
}

function makeRepo(rows: FakeRow[]) {
  return {
    rows,
    invalidated: [] as (string | undefined)[],
    findById: vi.fn(async (id: string) => rows.find((r) => r.id === id) ?? null),
    findByTypeAndKey: vi.fn(
      async (type: string, key: string) => rows.find((r) => r.type === type && r.key === key) ?? null,
    ),
    getActiveMembers: vi.fn(async (type: string) =>
      rows.filter((r) => r.type === type && r.active && r.deprecatedAt === null).map((r) => ({ key: r.key })),
    ),
    typeDefinitions: vi.fn(async () => fakeTypeDefinitions(operatorAxisDefinitions())),
    countChildren: vi.fn(async (childType: string, parentKey: string) =>
      rows.filter((r) => r.type === childType && r.parentKey === parentKey && r.deprecatedAt === null).length,
    ),
    // Mirrors the real transaction: skips a row whose parent has not moved, and reports the
    // moves so the caller can audit one event per real change.
    setParentKeysBulk: vi.fn(async (list: ReadonlyArray<{ id: string; parentKey: string | null }>) => {
      const moves = [];
      for (const a of list) {
        const target = rows.find((r) => r.id === a.id);
        if (!target || target.parentKey === a.parentKey) continue;
        moves.push({ id: target.id, type: target.type, key: target.key, from: target.parentKey, to: a.parentKey });
        target.parentKey = a.parentKey;
      }
      return moves;
    }),
    insert: vi.fn(async (input: { type: string; key: string; parentKey: string | null }) => {
      const created = row({ id: 'new', type: input.type, key: input.key, parentKey: input.parentKey });
      rows.push(created);
      return created;
    }),
    updateById: vi.fn(async (id: string, patch: Record<string, unknown>) => {
      const target = rows.find((r) => r.id === id);
      if (target && patch.parentKey !== undefined) target.parentKey = patch.parentKey as string | null;
      return target as FakeRow;
    }),
    invalidateCache: vi.fn(function (this: void, type?: string) {
      return type;
    }),
  };
}

function makeService(repo: ReturnType<typeof makeRepo>) {
  const audit = { write: vi.fn(async () => undefined) };
  const service = new PlatformEnumerationsAdminService(audit as never, repo as never);
  return { service, audit };
}

const ACTOR = { staffId: 'staff_1', sourceIp: null };

function codeOf(error: unknown): string {
  return error instanceof DomainException ? error.code : String(error);
}

describe('a value of a filed-under type must name a live parent', () => {
  it('refuses a district created with no class', async () => {
    const { service } = makeService(makeRepo(fixture()));
    await expect(
      service.create({ type: 'district', key: 'zed', labelAr: 'زد', labelEn: 'Zed' } as never, ACTOR),
    ).rejects.toSatisfy((e: unknown) => codeOf(e) === ERROR_CODES.ENUMERATION_PARENT_REQUIRED);
  });

  it('refuses a class that is not a live member of the list', async () => {
    const { service } = makeService(makeRepo(fixture()));
    // Deactivated: filing under it would be a save that quotes nothing the moment the
    // operator believes the class is retired.
    await expect(
      service.create(
        { type: 'district', key: 'zed', labelAr: 'زد', labelEn: 'Zed', parentKey: 'district_class_c' } as never,
        ACTOR,
      ),
    ).rejects.toSatisfy((e: unknown) => codeOf(e) === ERROR_CODES.ENUMERATION_PARENT_UNKNOWN);

    await expect(
      service.create(
        { type: 'district', key: 'zed', labelAr: 'زد', labelEn: 'Zed', parentKey: 'ghost' } as never,
        ACTOR,
      ),
    ).rejects.toSatisfy((e: unknown) => codeOf(e) === ERROR_CODES.ENUMERATION_PARENT_UNKNOWN);
  });

  it('accepts a live class, and stores it', async () => {
    const repo = makeRepo(fixture());
    const { service } = makeService(repo);
    await service.create(
      { type: 'district', key: 'zed', labelAr: 'زد', labelEn: 'Zed', parentKey: 'district_class_b' } as never,
      ACTOR,
    );
    expect(repo.insert.mock.calls[0]?.[0]).toMatchObject({ parentKey: 'district_class_b' });
  });

  it('force-nulls the parent for a type that is filed under nothing', async () => {
    const repo = makeRepo(fixture());
    const { service } = makeService(repo);
    // `program_name` used to carry one, so old clients still send it — dropped, not refused.
    await service.create(
      { type: 'program_name', key: 'x', labelAr: 'س', labelEn: 'X', parentKey: 'anything' } as never,
      ACTOR,
    );
    expect(repo.insert.mock.calls[0]?.[0]).toMatchObject({ parentKey: null });
  });

  it('still saves a label-only edit on a row that is already unfiled', async () => {
    // The anti-trap case: demanding a parent on every patch would make an unfiled row
    // unfixable by the very edit that would fix it.
    const rows = fixture();
    rows.push(row({ id: 'orphan', type: 'district', key: 'orphan', parentKey: null }));
    const repo = makeRepo(rows);
    const { service } = makeService(repo);
    await expect(service.update('orphan', { labelEn: 'Renamed' } as never, ACTOR)).resolves.toBeDefined();
  });
});

describe('an explicit null outside the bulk endpoint', () => {
  // `null` used to slip past `@IsOptional()` (which skips validation for null as well as
  // undefined), reach `findByTypeAndKey(parentType, null)` and come back as an untyped 500.
  // It is now refused in words on both paths, and the DTO cases below stop it at the pipe.
  it('is a typed refusal on create, not a crash', async () => {
    const { service } = makeService(makeRepo(fixture()));
    await expect(
      service.create({ type: 'district', key: 'zed', labelAr: 'z', labelEn: 'z', parentKey: null } as never, ACTOR),
    ).rejects.toSatisfy((e: unknown) => codeOf(e) === ERROR_CODES.ENUMERATION_PARENT_REQUIRED);
  });

  it('is a typed refusal on patch, not a crash', async () => {
    const repo = makeRepo(fixture());
    const { service } = makeService(repo);
    await expect(
      service.update('c1', { parentKey: null } as never, ACTOR),
    ).rejects.toSatisfy((e: unknown) => codeOf(e) === ERROR_CODES.ENUMERATION_PARENT_REQUIRED);
    expect(repo.rows.find((r) => r.id === 'c1')?.parentKey).toBe('district_class_a');
  });
});

describe('the wire contract for "no parent"', () => {
  const errors = (cls: new () => object, body: Record<string, unknown>): string[] =>
    validateSync(plainToInstance(cls, body) as object).map((e) => e.property);

  it('accepts null ONLY on the bulk assignment — the endpoint built for moves', () => {
    expect(errors(EnumerationParentAssignmentDto, { id: 'c1', parentKey: null })).toEqual([]);
    expect(errors(EnumerationParentAssignmentDto, { id: 'c1', parentKey: 'district_class_b' })).toEqual([]);
  });

  it('refuses an empty string and an absent field on the bulk assignment', () => {
    expect(errors(EnumerationParentAssignmentDto, { id: 'c1', parentKey: '' })).toContain('parentKey');
    expect(errors(EnumerationParentAssignmentDto, { id: 'c1' })).toContain('parentKey');
  });

  it('refuses null on create and on patch, while an absent field still means "not stated"', () => {
    expect(errors(CreateEnumerationDto, { type: 'district', key: 'z', labelAr: 'z', labelEn: 'z', parentKey: null }))
      .toContain('parentKey');
    expect(errors(UpdateEnumerationDto, { parentKey: null })).toContain('parentKey');
    expect(errors(UpdateEnumerationDto, { labelEn: 'Zed' })).toEqual([]);
  });
});

describe('bulk re-file', () => {
  it('validates every id before writing anything', async () => {
    const repo = makeRepo(fixture());
    const { service } = makeService(repo);
    await expect(
      service.setParentKeysBulk(
        { assignments: [{ id: 'c1', parentKey: 'district_class_b' }, { id: 'ghost', parentKey: 'district_class_b' }] },
        ACTOR,
      ),
    ).rejects.toBeDefined();
    expect(repo.setParentKeysBulk).not.toHaveBeenCalled();
    expect(repo.rows.find((r) => r.id === 'c1')?.parentKey).toBe('district_class_a');
  });

  it('refuses a target that is not a live class, before writing anything', async () => {
    const repo = makeRepo(fixture());
    const { service } = makeService(repo);
    await expect(
      service.setParentKeysBulk({ assignments: [{ id: 'c1', parentKey: 'district_class_c' }] }, ACTOR),
    ).rejects.toSatisfy((e: unknown) => codeOf(e) === ERROR_CODES.ENUMERATION_PARENT_UNKNOWN);
    expect(repo.setParentKeysBulk).not.toHaveBeenCalled();
  });

  it('refuses a type that is filed under nothing', async () => {
    const repo = makeRepo(fixture());
    const { service } = makeService(repo);
    await expect(
      service.setParentKeysBulk({ assignments: [{ id: 'g1', parentKey: 'district_class_a' }] }, ACTOR),
    ).rejects.toSatisfy((e: unknown) => codeOf(e) === ERROR_CODES.ENUMERATION_PARENT_NOT_APPLICABLE);
  });

  it('writes one audit event per value that MOVED, in the same shape a single patch writes', async () => {
    const repo = makeRepo(fixture());
    const { service, audit } = makeService(repo);
    const result = await service.setParentKeysBulk(
      {
        assignments: [
          { id: 'c1', parentKey: 'district_class_a' }, // no-op: already there
          { id: 'c2', parentKey: 'district_class_b' },
        ],
      },
      ACTOR,
    );
    expect(result).toEqual({ moved: 1 });
    expect(audit.write).toHaveBeenCalledTimes(1);
    expect(audit.write.mock.calls[0]?.[0]).toMatchObject({
      payload: { key: 'nasr_city', changes: { parentKey: { from: 'district_class_a', to: 'district_class_b' } } },
    });
  });

  it('unfiles a value on an explicit null, and audits the move to nothing', async () => {
    const repo = makeRepo(fixture());
    const { service, audit } = makeService(repo);
    const result = await service.setParentKeysBulk({ assignments: [{ id: 'c1', parentKey: null }] }, ACTOR);
    expect(result).toEqual({ moved: 1 });
    expect(repo.rows.find((r) => r.id === 'c1')?.parentKey).toBeNull();
    expect(audit.write.mock.calls[0]?.[0]).toMatchObject({
      payload: { key: 'maadi', changes: { parentKey: { from: 'district_class_a', to: null } } },
    });
  });

  it('re-files an already-unfiled value, and audits it as coming from nothing', async () => {
    const rows = fixture();
    const target = rows.find((r) => r.id === 'c1');
    if (target) target.parentKey = null;
    const repo = makeRepo(rows);
    const { service, audit } = makeService(repo);
    await service.setParentKeysBulk({ assignments: [{ id: 'c1', parentKey: 'district_class_b' }] }, ACTOR);
    expect(repo.rows.find((r) => r.id === 'c1')?.parentKey).toBe('district_class_b');
    expect(audit.write.mock.calls[0]?.[0]).toMatchObject({
      payload: { changes: { parentKey: { from: null, to: 'district_class_b' } } },
    });
  });

  it('treats unfiling an already-unfiled value as the no-op it is', async () => {
    const rows = fixture();
    const target = rows.find((r) => r.id === 'c1');
    if (target) target.parentKey = null;
    const repo = makeRepo(rows);
    const { service, audit } = makeService(repo);
    const result = await service.setParentKeysBulk({ assignments: [{ id: 'c1', parentKey: null }] }, ACTOR);
    expect(result).toEqual({ moved: 0 });
    expect(audit.write).not.toHaveBeenCalled();
  });

  it('still refuses an empty-string target — "no class" has one spelling', async () => {
    // `''` is what the DTO and the service both reject: stored, it passes the engine's
    // `parentKey IS NOT NULL` filter, so the value LOOKS filed and then prices nothing.
    const repo = makeRepo(fixture());
    const { service } = makeService(repo);
    await expect(
      service.setParentKeysBulk({ assignments: [{ id: 'c1', parentKey: '' }] }, ACTOR),
    ).rejects.toSatisfy((e: unknown) => codeOf(e) === ERROR_CODES.ENUMERATION_PARENT_REQUIRED);
    expect(repo.setParentKeysBulk).not.toHaveBeenCalled();
  });

  it('refuses unfiling a type that is filed under nothing', async () => {
    // Unfiling a type with no parent axis is the same category error as filing one.
    const repo = makeRepo(fixture());
    const { service } = makeService(repo);
    await expect(
      service.setParentKeysBulk({ assignments: [{ id: 'g1', parentKey: null }] }, ACTOR),
    ).rejects.toSatisfy((e: unknown) => codeOf(e) === ERROR_CODES.ENUMERATION_PARENT_NOT_APPLICABLE);
  });

  it('clears every cached type, not just the value’s own', async () => {
    // A parentKey move is felt by the row's own list AND by `surrogate_fact`, whose members
    // carry the derived parent list the bank's key-table editor is filled from.
    const repo = makeRepo(fixture());
    const { service } = makeService(repo);
    await service.setParentKeysBulk({ assignments: [{ id: 'c2', parentKey: 'district_class_b' }] }, ACTOR);
    expect(repo.invalidateCache).toHaveBeenCalledWith();
  });
});

describe('retiring a parent', () => {
  it('is refused while values are still filed under it', async () => {
    const repo = makeRepo(fixture());
    const { service } = makeService(repo);
    for (const patch of [{ active: false }, { deprecate: true }]) {
      await expect(service.update('cls_a', patch as never, ACTOR)).rejects.toSatisfy(
        (e: unknown) => codeOf(e) === ERROR_CODES.ENUMERATION_HAS_CHILDREN,
      );
    }
  });

  it('is allowed once nothing points at it', async () => {
    const repo = makeRepo(fixture());
    const { service } = makeService(repo);
    await expect(service.update('cls_b', { active: false } as never, ACTOR)).resolves.toBeDefined();
  });

  it('does not restrict the CHILD type', async () => {
    const repo = makeRepo(fixture());
    const { service } = makeService(repo);
    await expect(service.update('c1', { active: false } as never, ACTOR)).resolves.toBeDefined();
  });
});
