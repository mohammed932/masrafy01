/**
 * A bank program may only instantiate a catalog name the catalog sells on the
 * program's own INCOME BASIS, under the loan category it is being saved with
 * (Program catalog → the name's page → "How banks prove the income").
 *
 * Sibling of `bank-program-name-category-enforcement.spec.ts`, and deliberately a
 * separate file: the two halves refuse for different reasons, in a fixed order,
 * and send the operator to two different controls. Exercised directly on the
 * private guard for the same reason as that suite — the branch under test does not
 * depend on the other 40 fields of the DTO.
 *
 * The rule this replaces was client-side only: the wizard blocked the step while
 * the API accepted anything, so a script, a stale tab or a second client could
 * still write a program whose type and whose catalog entry said different things
 * about how the income is proved.
 */
import { describe, expect, it } from 'vitest';
import { LoanCategory } from '@prisma/client';
import { BankProgramsService } from '@/bank-programs/bank-programs.service';
import type { IncomeBasis } from '@/common/income-basis.util';
import { ERROR_CODES } from '@/common/errors/error-codes';

interface CatalogState {
  active: string[];
  deprecated: string[];
  categories: Record<string, LoanCategory[]>;
  bases: Record<string, Partial<Record<LoanCategory, IncomeBasis[]>>>;
}

type AssertOpts = {
  programType?: 'income_proof' | 'income_surrogate';
  skipProgramNameCategoryCheck?: boolean;
  skipProgramNameBasisCheck?: boolean;
};

function makeService(state: CatalogState) {
  const enums = {
    isAvailable: async () => true,
    isActiveMember: async (_type: string, key: string) => state.active.includes(key),
    isDeprecatedMember: async (_type: string, key: string) => state.deprecated.includes(key),
    getActiveMembers: async () => state.active.map((key) => ({ key })),
    memberCategories: async (_type: string, key: string) => state.categories[key] ?? [],
    memberIncomeBases: async (_type: string, key: string, category: LoanCategory) =>
      state.bases[key]?.[category] ?? [],
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
  active: ['doctor', 'home_purchase', 'armed_forces', 'legacy_pair'],
  deprecated: [],
  categories: {
    doctor: ['personal', 'car'],
    home_purchase: ['mortgage'],
    armed_forces: ['personal'],
    legacy_pair: ['personal'],
  },
  bases: {
    // Sold BOTH ways as a personal loan — one bank reads the payslip, another works
    // the income out — and payslip-only as a car loan.
    doctor: { personal: ['payslip', 'no_payslip'], car: ['payslip'] },
    home_purchase: { mortgage: ['payslip'] },
    armed_forces: { personal: ['no_payslip'] },
    // A pair that predates the column: no basis recorded at all.
    legacy_pair: {},
  },
};

describe('bank program → catalog name income-basis enforcement', () => {
  it('accepts a no-payslip program on a name sold that way here', async () => {
    const assert = makeService(CATALOG);
    await expect(
      assert('doctor', 'personal', { programType: 'income_surrogate' }),
    ).resolves.toBeUndefined();
  });

  it('accepts a payslip program on the same name — one name, both bases', async () => {
    const assert = makeService(CATALOG);
    await expect(
      assert('doctor', 'personal', { programType: 'income_proof' }),
    ).resolves.toBeUndefined();
  });

  it('refuses a no-payslip program on a payslip-only name, and says what is allowed', async () => {
    const assert = makeService(CATALOG);
    await expect(
      assert('home_purchase', 'mortgage', { programType: 'income_surrogate' }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.PROGRAM_NAME_KEY_BASIS_MISMATCH,
      meta: {
        programNameKey: 'home_purchase',
        productCategory: 'mortgage',
        basis: 'no_payslip',
        allowedBases: ['payslip'],
      },
    });
  });

  /**
   * The direction that did not exist before: the picker only ever narrowed the
   * no-payslip side, so a name sold exclusively without a payslip was still
   * offered — and saved — under "Reads a payslip".
   */
  it('refuses a payslip program on a no-payslip-only name', async () => {
    const assert = makeService(CATALOG);
    await expect(
      assert('armed_forces', 'personal', { programType: 'income_proof' }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.PROGRAM_NAME_KEY_BASIS_MISMATCH,
      meta: { basis: 'payslip', allowedBases: ['no_payslip'] },
    });
  });

  /**
   * Order matters, and the category error wins: "not offered under Mortgage" and
   * "not sold that way here" are fixed with two different controls, and the first
   * has to be fixed first — there is no basis to set on a pair that does not exist.
   */
  it('reports a category miss as a category miss, not as a basis mismatch', async () => {
    const assert = makeService(CATALOG);
    await expect(
      assert('home_purchase', 'personal', { programType: 'income_surrogate' }),
    ).rejects.toMatchObject({ code: ERROR_CODES.PROGRAM_NAME_KEY_NOT_IN_CATEGORY });
  });

  it('lets a pair with no recorded basis through — unknown is not "no"', async () => {
    const assert = makeService(CATALOG);
    await expect(
      assert('legacy_pair', 'personal', { programType: 'income_surrogate' }),
    ).resolves.toBeUndefined();
  });

  it('skips the check when the caller passes no program type', async () => {
    const assert = makeService(CATALOG);
    await expect(assert('home_purchase', 'mortgage')).resolves.toBeUndefined();
  });

  describe('grandfathering', () => {
    /**
     * The load-bearing half, same as on the category axis: an operator who unticks
     * a basis in the catalog must not freeze every program already saved against
     * it — `update()` is a full-replacement write that re-runs every check, so a
     * rate edit would otherwise become unsaveable.
     */
    it('lets an unchanged (name, basis) pair through', async () => {
      const assert = makeService(CATALOG);
      await expect(
        assert('home_purchase', 'mortgage', {
          programType: 'income_surrogate',
          skipProgramNameBasisCheck: true,
        }),
      ).resolves.toBeUndefined();
    });

    it('still refuses a category miss — the basis escape is not a category escape', async () => {
      const assert = makeService(CATALOG);
      await expect(
        assert('home_purchase', 'personal', {
          programType: 'income_surrogate',
          skipProgramNameBasisCheck: true,
        }),
      ).rejects.toMatchObject({ code: ERROR_CODES.PROGRAM_NAME_KEY_NOT_IN_CATEGORY });
    });
  });
});
