/**
 * A bank program may only instantiate a catalog name that is ASSIGNED to the
 * loan category it is being saved under (Program catalog → Loan categories).
 *
 * The assertion is exercised directly rather than through `create()`/`update()`,
 * which need a full 40-field DTO to reach it — the branch under test is the
 * three-way order of "unknown / deprecated / not in category" plus the
 * grandfather escape, and none of that depends on the rest of the payload.
 *
 * The grandfather rule is the load-bearing half: `update()` is a full-replacement
 * write that re-runs every check, so without it an operator narrowing a category
 * would freeze every existing program on that name — including edits to a rate
 * that have nothing to do with the assignment.
 */
import { describe, expect, it } from 'vitest';
import { LoanCategory } from '@prisma/client';
import { BankProgramsService } from '@/bank-programs/bank-programs.service';
import { ERROR_CODES } from '@/common/errors/error-codes';

interface CatalogState {
  active: string[];
  deprecated: string[];
  categories: Record<string, LoanCategory[]>;
}

function makeService(state: CatalogState) {
  const enums = {
    isAvailable: async () => true,
    isActiveMember: async (_type: string, key: string) => state.active.includes(key),
    isDeprecatedMember: async (_type: string, key: string) => state.deprecated.includes(key),
    getActiveMembers: async () => state.active.map((key) => ({ key })),
    memberCategories: async (_type: string, key: string) => state.categories[key] ?? [],
  };
  const service = new BankProgramsService(
    {} as never,
    {} as never,
    {} as never,
    enums as never,
  );
  // The guard is private by design — it is an invariant of the service, not an
  // API. Reached here through an explicit cast so the test exercises the real
  // implementation rather than a re-description of it.
  return (
    key: string,
    category: string,
    opts: { skipProgramNameCategoryCheck?: boolean } = {},
  ): Promise<void> =>
    (
      service as unknown as {
        assertProgramNameKey(
          k: string,
          c: string,
          o: { skipProgramNameCategoryCheck?: boolean },
        ): Promise<void>;
      }
    ).assertProgramNameKey(key, category, opts);
}

const CATALOG: CatalogState = {
  active: ['doctor', 'new_car', 'pharmacy'],
  deprecated: ['legacy_name'],
  categories: {
    doctor: ['personal', 'car'],
    new_car: ['car'],
    pharmacy: [], // parked
  },
};

describe('bank program → catalog name category enforcement', () => {
  it('accepts a name assigned to the category being saved', async () => {
    const assert = makeService(CATALOG);
    await expect(assert('doctor', 'car')).resolves.toBeUndefined();
  });

  it('refuses a name not assigned to that category, and names the alternatives', async () => {
    const assert = makeService(CATALOG);
    await expect(assert('doctor', 'mortgage')).rejects.toMatchObject({
      code: ERROR_CODES.PROGRAM_NAME_KEY_NOT_IN_CATEGORY,
      meta: {
        programNameKey: 'doctor',
        productCategory: 'mortgage',
        // The set it IS offered under — the only thing that makes the refusal
        // actionable instead of a dead end.
        assignedCategories: ['personal', 'car'],
      },
    });
  });

  it('refuses a parked name everywhere, reporting an empty assigned set', async () => {
    const assert = makeService(CATALOG);
    await expect(assert('pharmacy', 'personal')).rejects.toMatchObject({
      code: ERROR_CODES.PROGRAM_NAME_KEY_NOT_IN_CATEGORY,
      meta: { assignedCategories: [] },
    });
  });

  /**
   * Order matters: telling an operator a name "isn't offered under Mortgage"
   * when the name no longer exists at all sends them to the wrong screen.
   */
  it('reports an unknown key as unknown, not as a category mismatch', async () => {
    const assert = makeService(CATALOG);
    await expect(assert('ghost', 'personal')).rejects.toMatchObject({
      code: ERROR_CODES.PROGRAM_NAME_KEY_UNKNOWN,
    });
  });

  it('reports a deprecated key as deprecated, not as a category mismatch', async () => {
    const assert = makeService(CATALOG);
    await expect(assert('legacy_name', 'personal')).rejects.toMatchObject({
      code: ERROR_CODES.DEPRECATED_ENUMERATION_KEY,
    });
  });

  describe('grandfathering', () => {
    it('lets an unchanged pair through even when it is no longer assigned', async () => {
      const assert = makeService(CATALOG);
      // `new_car` is car-only, but this save is not MOVING the program — it is
      // editing a rate on one that already sits under `personal`.
      await expect(
        assert('new_car', 'personal', { skipProgramNameCategoryCheck: true }),
      ).resolves.toBeUndefined();
    });

    it('still refuses an unknown key — grandfathering is not a bypass', async () => {
      const assert = makeService(CATALOG);
      await expect(
        assert('ghost', 'personal', { skipProgramNameCategoryCheck: true }),
      ).rejects.toMatchObject({ code: ERROR_CODES.PROGRAM_NAME_KEY_UNKNOWN });
    });

    it('still refuses a deprecated key', async () => {
      const assert = makeService(CATALOG);
      await expect(
        assert('legacy_name', 'personal', { skipProgramNameCategoryCheck: true }),
      ).rejects.toMatchObject({ code: ERROR_CODES.DEPRECATED_ENUMERATION_KEY });
    });
  });
});
