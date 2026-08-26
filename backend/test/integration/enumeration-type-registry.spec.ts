/**
 * A KIND of list is a row, so inventing one is an operator action rather than a release.
 *
 * What this pins is the boundary between the two halves of that sentence — what an operator
 * may now decide, and what stays the codebase's to decide:
 *
 *  - the PARENT AXIS is data. `parentTypeOf` / `childTypesOf` read `enumeration_type_def`,
 *    which is what lets a brand-new pair of lists be created and filed. Before this,
 *    `resolveParentKey` refused any type outside a one-entry constant, so `parentKey` for a
 *    new pair was reachable only by raw SQL.
 *  - the DELETE GATE is data (`deletable`), seeded from the old `DELETABLE_TYPES` verbatim.
 *  - `systemOnly` is NOT. A kind the code names by string may be relabelled and reordered,
 *    never re-parented, retired or deleted: renaming it strands every value carrying the
 *    string AND leaves a code path asking for a key nothing answers to, so both halves
 *    break and neither says so.
 *
 * The refusals are the interesting half. Each guards a state that saves 200 and fails later:
 * a kind filed under a kind that does not exist makes every future value of it uncreatable,
 * because `resolveParentKey` would demand a parent from a list nothing can populate.
 */
import { describe, expect, it, vi } from 'vitest';
import { PlatformEnumerationsAdminService } from '@/platform-enumerations/platform-enumerations-admin.service';
import {
  childTypesOf,
  isDeletableType,
  parentTypeOf,
  type EnumerationTypeDefinition,
} from '@/platform-enumerations/platform-enumerations.repository';
import { ERROR_CODES } from '@/common/errors/error-codes';
import { DomainException } from '@/common/errors/domain.exceptions';
import { fakeTypeDefinitions, operatorTypeDefinition } from '../helpers/enumeration-type-defs';

const ACTOR = { staffId: 'staff_1', sourceIp: null };

function codeOf(e: unknown): string | null {
  return e instanceof DomainException ? e.code : null;
}

/**
 * `extra` seeds kinds an operator invented; `values` is how many rows carry each type, which
 * is the delete gate's only input.
 */
function makeRepo(
  extra: readonly EnumerationTypeDefinition[] = [],
  values: Readonly<Record<string, number>> = {},
) {
  const defs = new Map(fakeTypeDefinitions(extra));
  return {
    defs,
    typeDefinitions: vi.fn(async () => defs),
    insertTypeDefinition: vi.fn(async (input: EnumerationTypeDefinition) => {
      const created = { ...input, active: true };
      defs.set(created.key, created);
      return created;
    }),
    updateTypeDefinition: vi.fn(async (key: string, patch: Partial<EnumerationTypeDefinition>) => {
      const existing = defs.get(key);
      if (!existing) return null;
      const next = { ...existing, ...patch };
      defs.set(key, next);
      return next;
    }),
    deleteTypeDefinition: vi.fn(async (key: string) => {
      defs.delete(key);
    }),
    countRowsOfType: vi.fn(async (type: string) => values[type] ?? 0),
  };
}

function makeService(repo: ReturnType<typeof makeRepo>) {
  // `AuditEventWriter.write`, not the bank-programs repository's `create` — two different
  // collaborators, and a fake with the wrong method name passes tsc and fails at run time.
  const audit = { write: vi.fn(async () => undefined) };
  const service = new PlatformEnumerationsAdminService(
    audit as never,
    repo as never,
  );
  return { service, audit, repo };
}

describe('the parent axis is read from data, not from a constant', () => {
  it('ships no LIVE kind with a parent axis', () => {
    // Since `20260827090000` retired the compound pair there is none, and that is the point:
    // a filed-under axis is something a PRODUCT authors on its own screen. A builtin growing
    // one is a decision, not a detail, so it should fail here first.
    const defs = fakeTypeDefinitions();
    const live = [...defs.values()].filter((d) => d.active && d.parentTypeKey !== null);
    expect(live).toEqual([]);
  });

  it('keeps the parent axis on a RETIRED kind, because a value of it may survive', () => {
    // `active` says whether a kind is OFFERED. Stripping the axis with it would silently
    // disconnect an operator's own compound from the class table pricing it, and the only
    // symptom would be a quote of nothing.
    const defs = fakeTypeDefinitions();
    expect(defs.get('compound')?.active).toBe(false);
    expect(parentTypeOf(defs, 'compound')).toBe('compound_category');
  });

  it('has no axis for a kind that names no parent', () => {
    const defs = fakeTypeDefinitions();
    expect(parentTypeOf(defs, 'governorate')).toBeNull();
    expect(childTypesOf(defs, 'governorate')).toEqual([]);
  });

  it('resolves an axis between two kinds an operator invented', () => {
    const defs = fakeTypeDefinitions([
      operatorTypeDefinition('brand_tier'),
      operatorTypeDefinition('car_brand', { parentTypeKey: 'brand_tier' }),
    ]);
    expect(parentTypeOf(defs, 'car_brand')).toBe('brand_tier');
    expect(childTypesOf(defs, 'brand_tier')).toEqual(['car_brand']);
  });

  it('reads an INACTIVE kind, because active governs offering and not behaviour', () => {
    // Retiring a kind must not silently strip the parent axis from values that already
    // carry a `parentKey` — `factParentTable` goes on walking it, and the only visible
    // symptom of losing it would be a quote of nothing.
    const defs = fakeTypeDefinitions([
      operatorTypeDefinition('brand_tier', { active: false }),
      operatorTypeDefinition('car_brand', { parentTypeKey: 'brand_tier', active: false }),
    ]);
    expect(parentTypeOf(defs, 'car_brand')).toBe('brand_tier');
  });

  it('answers false for the deletability of a kind it has never heard of', () => {
    // The safe direction: `countReferences` returns null for it and the delete is refused
    // in words, rather than performed against a type nothing can count the references of.
    expect(isDeletableType(fakeTypeDefinitions(), 'ghost')).toBe(false);
  });

  it('reproduces the old DELETABLE_TYPES exactly', () => {
    const defs = fakeTypeDefinitions();
    const deletable = [...defs.values()].filter((d) => d.deletable).map((d) => d.key).sort();
    expect(deletable).toEqual([
      'employment_type',
      'governorate',
      'product_category',
      'program_name',
      'required_document',
      'surrogate_fact',
      'transfer_type',
    ]);
  });
});

describe('creating a KIND', () => {
  it('creates one, defaulting it to deletable', async () => {
    // A kind an operator invented IS deletable: nothing reads it by name, so the only thing
    // that can point at one of its values is a child value. Defaulting to false would
    // recreate the trap this feature removes — a list you can make and never unmake.
    const { service, repo } = makeService(makeRepo());
    const created = await service.createType(
      { key: 'brand_tier', labelAr: 'x', labelEn: 'Brand tiers' } as never,
      ACTOR,
    );
    expect(created.deletable).toBe(true);
    expect(created.systemOnly).toBe(false);
    expect(repo.insertTypeDefinition).toHaveBeenCalledOnce();
  });

  it('never lets a request claim systemOnly', async () => {
    // It means "a code path reads this type by name" — a fact about the codebase, not a
    // property an operator may assert. Claiming it would only buy them a delete refusal.
    const { service } = makeService(makeRepo());
    const created = await service.createType(
      { key: 'brand_tier', labelAr: 'x', labelEn: 'x', systemOnly: true } as never,
      ACTOR,
    );
    expect(created.systemOnly).toBe(false);
  });

  it('refuses a key another kind already holds', async () => {
    const { service, repo } = makeService(makeRepo());
    await expect(
      service.createType({ key: 'governorate', labelAr: 'x', labelEn: 'x' } as never, ACTOR),
    ).rejects.toSatisfy((e: unknown) => codeOf(e) === ERROR_CODES.ENUMERATION_TYPE_DUPLICATE);
    expect(repo.insertTypeDefinition).not.toHaveBeenCalled();
  });

  it('refuses a parent kind that does not exist', async () => {
    const { service, repo } = makeService(makeRepo());
    await expect(
      service.createType(
        { key: 'car_brand', labelAr: 'x', labelEn: 'x', parentTypeKey: 'ghost' } as never,
        ACTOR,
      ),
    ).rejects.toSatisfy(
      (e: unknown) =>
        codeOf(e) === ERROR_CODES.ENUMERATION_TYPE_PARENT_INVALID &&
        (e as DomainException).meta?.reason === 'missing',
    );
    expect(repo.insertTypeDefinition).not.toHaveBeenCalled();
  });

  it('refuses a kind filed under itself', async () => {
    const { service } = makeService(makeRepo());
    await expect(
      service.createType(
        { key: 'car_brand', labelAr: 'x', labelEn: 'x', parentTypeKey: 'car_brand' } as never,
        ACTOR,
      ),
    ).rejects.toSatisfy(
      (e: unknown) =>
        codeOf(e) === ERROR_CODES.ENUMERATION_TYPE_PARENT_INVALID &&
        (e as DomainException).meta?.reason === 'self',
    );
  });
});

describe('patching a KIND', () => {
  it('relabels a builtin — the label is what an operator reads', async () => {
    const { service } = makeService(makeRepo());
    const updated = await service.updateType('governorate', { labelEn: 'Governorates of Egypt' }, ACTOR);
    expect(updated.labelEn).toBe('Governorates of Egypt');
  });

  it('refuses to re-parent a builtin', async () => {
    const { service, repo } = makeService(makeRepo());
    await expect(
      service.updateType('governorate', { parentTypeKey: 'product_category' }, ACTOR),
    ).rejects.toSatisfy(
      (e: unknown) =>
        codeOf(e) === ERROR_CODES.ENUMERATION_TYPE_SYSTEM_ONLY &&
        (e as DomainException).meta?.attempted === 'rename',
    );
    expect(repo.updateTypeDefinition).not.toHaveBeenCalled();
  });

  it('re-parents a kind an operator invented', async () => {
    const { service } = makeService(
      makeRepo([operatorTypeDefinition('brand_tier'), operatorTypeDefinition('car_brand')]),
    );
    const updated = await service.updateType('car_brand', { parentTypeKey: 'brand_tier' }, ACTOR);
    expect(updated.parentTypeKey).toBe('brand_tier');
  });

  it('refuses a patch to a kind that does not exist', async () => {
    const { service } = makeService(makeRepo());
    await expect(service.updateType('ghost', { labelEn: 'x' }, ACTOR)).rejects.toSatisfy(
      (e: unknown) => codeOf(e) === ERROR_CODES.ENUMERATION_TYPE_NOT_FOUND,
    );
  });
});

describe('deleting a KIND', () => {
  it('deletes an empty kind nothing is filed under', async () => {
    const { service, repo } = makeService(makeRepo([operatorTypeDefinition('brand_tier')]));
    await service.deleteType('brand_tier', ACTOR);
    expect(repo.deleteTypeDefinition).toHaveBeenCalledWith('brand_tier');
  });

  it('refuses while values still carry the type', async () => {
    // `platform_enumeration.type` carries NO foreign key, so nothing in the database would
    // stop this. The rows left behind would belong to a kind with no label, no parent axis
    // and no delete gate — the orphan state the registry exists to remove.
    const { service, repo } = makeService(
      makeRepo([operatorTypeDefinition('brand_tier')], { brand_tier: 3 }),
    );
    await expect(service.deleteType('brand_tier', ACTOR)).rejects.toSatisfy(
      (e: unknown) =>
        codeOf(e) === ERROR_CODES.ENUMERATION_TYPE_IN_USE &&
        (e as DomainException).meta?.values === 3,
    );
    expect(repo.deleteTypeDefinition).not.toHaveBeenCalled();
  });

  it('refuses while it is still another kind’s parent axis', async () => {
    // Leaving the axis dangling is the same damage as a missing parent on create: every
    // value of the CHILD kind becomes uncreatable.
    const { service, repo } = makeService(
      makeRepo([
        operatorTypeDefinition('brand_tier'),
        operatorTypeDefinition('car_brand', { parentTypeKey: 'brand_tier' }),
      ]),
    );
    await expect(service.deleteType('brand_tier', ACTOR)).rejects.toSatisfy(
      (e: unknown) => codeOf(e) === ERROR_CODES.ENUMERATION_TYPE_IN_USE,
    );
    expect(repo.deleteTypeDefinition).not.toHaveBeenCalled();
  });

  it('refuses to delete a builtin', async () => {
    const { service, repo } = makeService(makeRepo());
    await expect(service.deleteType('governorate', ACTOR)).rejects.toSatisfy(
      (e: unknown) =>
        codeOf(e) === ERROR_CODES.ENUMERATION_TYPE_SYSTEM_ONLY &&
        (e as DomainException).meta?.attempted === 'delete',
    );
    expect(repo.deleteTypeDefinition).not.toHaveBeenCalled();
  });

  it('refuses a delete of a kind that does not exist', async () => {
    const { service } = makeService(makeRepo());
    await expect(service.deleteType('ghost', ACTOR)).rejects.toSatisfy(
      (e: unknown) => codeOf(e) === ERROR_CODES.ENUMERATION_TYPE_NOT_FOUND,
    );
  });
});
