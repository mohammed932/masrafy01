/**
 * Where a value goes when an operator says "not that class".
 *
 * Before this, unticking on the class board stored `null`. That is a real and costly answer —
 * the value stays a pickable customer answer, `factParentTable` then answers `no_matching_row`,
 * and that reason is FATAL rather than skippable, so every bank keying its table by the axis
 * quotes that applicant NOTHING. The kind can now declare where that lands instead.
 *
 * Two things the cases below pin, because getting either backwards is silent:
 *
 *   · the redirect fires ONLY under `allowUnfiled` — the flag `setParentKeysBulk` alone
 *     passes. A CREATE with a blank class still refuses. The fallback answers a decision the
 *     operator MADE; a blank column is a typo, and the platform answering a typo with a price
 *     tier is exactly what `ENUMERATION_PARENT_REQUIRED` exists to refuse.
 *   · with NO fallback declared, `null` is still reachable — v18.3.0 behaviour, unchanged.
 *     Otherwise an operator-made axis with nothing to offer instead becomes un-unfileable.
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
  labelAr: string;
  labelEn: string;
  active: boolean;
  systemOnly: boolean;
  deprecatedAt: Date | null;
  parentKey: string | null;
  sortOrder: number;
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
    ...over,
  };
}

function fixture(): FakeRow[] {
  return [
    row({ id: 'cls_a', type: 'district_class', key: 'district_class_a', sortOrder: 1 }),
    row({ id: 'cls_o', type: 'district_class', key: 'district_class_other', sortOrder: 9 }),
    row({ id: 'c1', type: 'district', key: 'maadi', parentKey: 'district_class_a' }),
  ];
}

/** `fallback` = what the `district` kind declares. `null` = it declares none. */
function makeService(rows: FakeRow[], fallback: string | null = 'district_class_other') {
  const defs = fakeTypeDefinitions([
    operatorTypeDefinition('district_class'),
    operatorTypeDefinition('district', {
      parentTypeKey: 'district_class',
      fallbackParentKey: fallback,
    }),
  ]);
  const repo = {
    rows,
    typeDefinitions: vi.fn(async () => defs),
    findById: vi.fn(async (id: string) => rows.find((r) => r.id === id) ?? null),
    findByTypeAndKey: vi.fn(
      async (type: string, key: string) => rows.find((r) => r.type === type && r.key === key) ?? null,
    ),
    getActiveMembers: vi.fn(async (type: string) =>
      rows
        .filter((r) => r.type === type && r.active && r.deprecatedAt === null)
        .map((r) => ({ key: r.key, labelAr: r.labelAr, labelEn: r.labelEn })),
    ),
    countChildren: vi.fn(
      async (childType: string, parentKey: string) =>
        rows.filter((r) => r.type === childType && r.parentKey === parentKey && r.deprecatedAt === null)
          .length,
    ),
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
      if (target && patch.active !== undefined) target.active = patch.active as boolean;
      return target as FakeRow;
    }),
    updateTypeDefinition: vi.fn(async (key: string) => defs.get(key) ?? null),
    programNamesLinkedTo: vi.fn(async () => []),
    invalidateCache: vi.fn((type?: string) => type),
  };
  const audit = { write: vi.fn(async () => undefined), writeMany: vi.fn(async () => undefined) };
  const questionnaire = {
    syncMirroredOptions: vi.fn(async () => false),
    assertMirroredListSurvives: vi.fn(async () => undefined),
  };
  const service = new PlatformEnumerationsAdminService(
    audit as never,
    repo as never,
    questionnaire as never,
  );
  return { service, repo, audit };
}

describe('the fallback class', () => {
  it('redirects an unfile to the declared class, and audits a real move', async () => {
    const rows = fixture();
    const { service, repo, audit } = makeService(rows);
    const result = await service.setParentKeysBulk({ assignments: [{ id: 'c1', parentKey: null }] }, ACTOR);

    expect(result).toEqual({ moved: 1 });
    expect(repo.rows.find((r) => r.id === 'c1')?.parentKey).toBe('district_class_other');
    // The audit records what actually happened — a move between two classes, not a move to
    // nothing, because nothing is not where it went.
    expect((audit.writeMany.mock.calls[0]?.[0] as unknown[])[0]).toMatchObject({
      payload: { changes: { parentKey: { from: 'district_class_a', to: 'district_class_other' } } },
    });
  });

  it('still stores null when the kind declares no fallback', async () => {
    // v18.3.0, unchanged. Without this an operator-made axis with nothing to offer instead
    // becomes un-unfileable, and the destructive answer is one the endpoint exists to allow.
    const rows = fixture();
    const { service, repo } = makeService(rows, null);
    await service.setParentKeysBulk({ assignments: [{ id: 'c1', parentKey: null }] }, ACTOR);
    expect(repo.rows.find((r) => r.id === 'c1')?.parentKey).toBeNull();
  });

  it('does NOT rescue a blank class on a create', async () => {
    // The whole line between "the operator said not that class" and "the operator forgot".
    const { service } = makeService(fixture());
    await expect(
      service.create({ type: 'district', key: 'obour', labelAr: 'العبور', labelEn: 'Obour' } as never, ACTOR),
    ).rejects.toSatisfy((e: unknown) => codeOf(e) === ERROR_CODES.ENUMERATION_PARENT_REQUIRED);
  });

  it('still refuses an empty string, fallback or no fallback', async () => {
    // `''` stored passes the engine's `parentKey IS NOT NULL` filter, so the value LOOKS
    // filed and quotes nothing. "No class" has one spelling.
    const { service } = makeService(fixture());
    await expect(
      service.setParentKeysBulk({ assignments: [{ id: 'c1', parentKey: '' }] }, ACTOR),
    ).rejects.toSatisfy((e: unknown) => codeOf(e) === ERROR_CODES.ENUMERATION_PARENT_REQUIRED);
  });

  it('refuses a fallback on a kind that files its values under nothing', async () => {
    const { service } = makeService(fixture());
    await expect(
      service.updateType('governorate_flat', { fallbackParentKey: 'x' }, ACTOR),
    ).rejects.toSatisfy((e: unknown) => codeOf(e) === ERROR_CODES.ENUMERATION_TYPE_NOT_FOUND);
  });

  it('refuses a fallback naming a class that is not live', async () => {
    const rows = fixture();
    const dead = rows.find((r) => r.id === 'cls_o');
    if (dead) dead.active = false;
    const { service } = makeService(rows);
    await expect(
      service.updateType('district', { fallbackParentKey: 'district_class_other' }, ACTOR),
    ).rejects.toSatisfy((e: unknown) => {
      if (codeOf(e) !== ERROR_CODES.ENUMERATION_TYPE_FALLBACK_INVALID) return false;
      return ((e as DomainException).meta as { reason: string }).reason === 'inactive';
    });
  });

  it('refuses retiring the class the fallback points at, even when it holds nothing', async () => {
    // The case `ENUMERATION_HAS_CHILDREN` cannot see, and the dangerous one: an EMPTY
    // retired fallback is where the next untick lands, and the engine's parent walk never
    // checks the parent's own active flag.
    const { service } = makeService(fixture());
    await expect(service.update('cls_o', { active: false }, ACTOR)).rejects.toSatisfy(
      (e: unknown) => codeOf(e) === ERROR_CODES.ENUMERATION_FALLBACK_IN_USE,
    );
  });

  it('still lets an unrelated class be retired', async () => {
    // The guard must be about the fallback, not about classes in general.
    const rows = fixture();
    const orphan = rows.find((r) => r.id === 'c1');
    if (orphan) orphan.parentKey = 'district_class_other';
    const { service, repo } = makeService(rows);
    await service.update('cls_a', { active: false }, ACTOR);
    expect(repo.rows.find((r) => r.id === 'cls_a')?.active).toBe(false);
  });
});
