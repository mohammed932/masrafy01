/**
 * A bank program's INCOME BASIS is its own business — the catalog name it instantiates
 * constrains only the loan CATEGORY (v16.4.0).
 *
 * The inverse of the suite this replaces (`bank-program-name-basis-enforcement`). The
 * catalog used to store, per (name, loan type), whether the name may be sold against a
 * payslip / without one, and refuse a program whose `programType` was not in that set.
 * That was a second record of a decision the bank makes in step 1 of its own program,
 * kept by hand on another screen — so a tick nobody updated could refuse a save the bank
 * was entitled to make, and the operator's only fix lived on a screen most of them
 * cannot open (`/program-catalog` is super-admin).
 *
 * Pinned as its own file because "we deleted a rule" is invisible in a diff of the code
 * that used to enforce it: nothing fails when a guard silently comes back. Both program
 * types must pass on the same name, under every loan type the name is offered under.
 *
 * The last case is the one that nearly shipped broken while the guard was being cut out:
 * the basis half ended in a `return`, so removing it dropped the success exit and every
 * VALID pair fell through to `PROGRAM_NAME_KEY_UNKNOWN` — a rejection with a message
 * pointing at a name that is right there in the catalog.
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

type AssertOpts = { skipProgramNameCategoryCheck?: boolean };

function makeService(state: CatalogState) {
  const enums = {
    isAvailable: async () => true,
    isActiveMember: async (_type: string, key: string) => state.active.includes(key),
    isDeprecatedMember: async (_type: string, key: string) => state.deprecated.includes(key),
    getActiveMembers: async () => state.active.map((key) => ({ key })),
    memberCategories: async (_type: string, key: string) => state.categories[key] ?? [],
  };
  const service = new BankProgramsService({} as never, {} as never, {} as never, enums as never);
  return (key: string, category: string, opts: AssertOpts = {}): Promise<void> =>
    (
      service as unknown as {
        assertProgramNameKey(k: string, c: string, o: AssertOpts): Promise<void>;
      }
    ).assertProgramNameKey(key, category, opts);
}

const CATALOG: CatalogState = {
  active: ['doctor', 'home_purchase'],
  deprecated: ['retired_name'],
  categories: {
    doctor: ['personal', 'car'],
    home_purchase: ['mortgage'],
  },
};

describe('bank program → catalog name: the income basis is not constrained', () => {
  it('accepts a live (name, loan type) pair — the success exit still exists', async () => {
    const assert = makeService(CATALOG);
    await expect(assert('doctor', 'personal')).resolves.toBeUndefined();
    await expect(assert('doctor', 'car')).resolves.toBeUndefined();
  });

  it('accepts the SAME name for a payslip and a no-payslip program alike', async () => {
    // One name, two banks, two ways of proving the income — the arrangement v16.0.0
    // refused to model as two products, and v16.1.0 then made refusable by a tick.
    // Nothing in the catalog can express a preference here any more, by design.
    const assert = makeService(CATALOG);
    await expect(assert('home_purchase', 'mortgage')).resolves.toBeUndefined();
    await expect(assert('home_purchase', 'mortgage')).resolves.toBeUndefined();
  });

  it('still refuses a name that is not offered under this loan type', async () => {
    // The half that survives: the assignment IS a catalog decision, made on the name's
    // own page, and it is what decides whether the name appears in the picker at all.
    const assert = makeService(CATALOG);
    await expect(assert('home_purchase', 'personal')).rejects.toMatchObject({
      code: ERROR_CODES.PROGRAM_NAME_KEY_NOT_IN_CATEGORY,
      meta: {
        programNameKey: 'home_purchase',
        productCategory: 'personal',
        assignedCategories: ['mortgage'],
      },
    });
  });

  it('grandfathers an unchanged pair without consulting the catalog at all', async () => {
    const assert = makeService(CATALOG);
    await expect(
      assert('home_purchase', 'personal', { skipProgramNameCategoryCheck: true }),
    ).resolves.toBeUndefined();
  });

  it('still refuses a deprecated name, and an unknown one', async () => {
    const assert = makeService(CATALOG);
    await expect(assert('retired_name', 'personal')).rejects.toMatchObject({
      code: ERROR_CODES.DEPRECATED_ENUMERATION_KEY,
    });
    await expect(assert('no_such_name', 'personal')).rejects.toMatchObject({
      code: ERROR_CODES.PROGRAM_NAME_KEY_UNKNOWN,
    });
  });
});
