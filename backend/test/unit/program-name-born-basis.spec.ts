/**
 * What income basis a (name, loan category) pair is BORN with.
 *
 * This only became load-bearing when `create` stopped assigning any loan category:
 * before, every pair a name would ever have was written by the create, carrying the
 * basis the Add dialog asked for. Now the FIRST pair is written by `setCategories`,
 * when the operator turns a loan type on in step 2 of the name's own page — and that
 * write knows nothing about what the operator answered at create time except through
 * the row's own `surrogateProductKey`.
 *
 * A literal `['payslip']` there would put a name the operator just linked to a
 * surrogate product on the catalog under "Reads a payslip", which is the opposite of
 * what they said. The three answers are pinned here in order.
 *
 * Run through the real repository — the interesting half is the delete-then-insert
 * transaction, not the pure function inside it.
 */
import { describe, expect, it, vi } from 'vitest';
import { LoanCategory } from '@prisma/client';
import { PostgresPlatformEnumerationsRepository } from '@/platform-enumerations/postgres-platform-enumerations.repository';

type Flags = { payslip: boolean; noPayslip: boolean };
type Pair = { category: LoanCategory } & Flags;

/**
 * Enough Prisma to run the assignment transaction: the join table's read / delete /
 * createMany, the row read the born-basis fallback makes, and a `$transaction` that
 * simply hands the same client to the callback.
 */
function makeRepo(before: Pair[], surrogateProductKey: string | null) {
  const created: Array<{ enumerationId: string; category: LoanCategory } & Flags> = [];
  const client = {
    $executeRaw: vi.fn(async () => 1),
    platformEnumerationLoanCategory: {
      findMany: vi.fn(async () => before),
      deleteMany: vi.fn(async () => ({ count: before.length })),
      createMany: vi.fn(async (args: { data: typeof created }) => {
        created.push(...args.data);
        return { count: args.data.length };
      }),
    },
    platformEnumeration: {
      findUnique: vi.fn(async () => ({ surrogateProductKey })),
      findMany: vi.fn(async () => [{ id: 'pn_1', surrogateProductKey }]),
    },
  };
  const prisma = {
    ...client,
    $transaction: vi.fn(async (fn: (tx: typeof client) => Promise<unknown>) => fn(client)),
  };
  return { repo: new PostgresPlatformEnumerationsRepository(prisma as never), created, client };
}

const flagsFor = (
  rows: ReadonlyArray<{ category: LoanCategory } & Flags>,
  category: LoanCategory,
): Flags | undefined => {
  const hit = rows.find((r) => r.category === category);
  return hit && { payslip: hit.payslip, noPayslip: hit.noPayslip };
};

describe('the basis a newly offered loan type is born with', () => {
  it('derives no-payslip from the surrogate-product link when there is nothing to inherit', async () => {
    // The path a brand-new name takes: created with no category and a product link,
    // then offered under one loan type on step 2.
    const { repo, created } = makeRepo([], 'compound_owner');

    await repo.setCategories('pn_1', ['personal']);

    expect(flagsFor(created, LoanCategory.personal)).toEqual({ payslip: false, noPayslip: true });
  });

  it('derives payslip when the name links to no product', async () => {
    const { repo, created } = makeRepo([], null);

    await repo.setCategories('pn_1', ['personal']);

    expect(flagsFor(created, LoanCategory.personal)).toEqual({ payslip: true, noPayslip: false });
  });

  it('inherits a sibling pair rather than the derived default', async () => {
    // The name is already sold without a payslip under Personal. Turning Car on must
    // not describe the same product two ways — and must not consult the link, which
    // may be absent on a name whose rule predates the archetypes.
    const { repo, created } = makeRepo(
      [{ category: LoanCategory.personal, payslip: false, noPayslip: true }],
      null,
    );

    await repo.setCategories('pn_1', ['personal', 'car']);

    expect(flagsFor(created, LoanCategory.car)).toEqual({ payslip: false, noPayslip: true });
  });

  it('keeps a surviving pair exactly as it was', async () => {
    // The regression the carry-across was written for: dropping one loan type must not
    // re-set the basis of the ones kept.
    const { repo, created } = makeRepo(
      [
        { category: LoanCategory.personal, payslip: false, noPayslip: true },
        { category: LoanCategory.car, payslip: true, noPayslip: false },
      ],
      null,
    );

    await repo.setCategories('pn_1', ['personal']);

    expect(created).toHaveLength(1);
    expect(flagsFor(created, LoanCategory.personal)).toEqual({ payslip: false, noPayslip: true });
  });

  it('writes nothing — and reads no row — when the set is emptied', async () => {
    const { repo, created, client } = makeRepo(
      [{ category: LoanCategory.personal, payslip: true, noPayslip: false }],
      'compound_owner',
    );

    await repo.setCategories('pn_1', []);

    expect(created).toEqual([]);
    expect(client.platformEnumerationLoanCategory.deleteMany).toHaveBeenCalledTimes(1);
    expect(client.platformEnumeration.findUnique).not.toHaveBeenCalled();
  });

  it('applies the same three answers to the bulk board action', async () => {
    const { repo, created } = makeRepo([], 'compound_owner');

    await repo.setCategoriesBulk([{ enumerationId: 'pn_1', categories: ['mortgage'] }]);

    expect(flagsFor(created, LoanCategory.mortgage)).toEqual({ payslip: false, noPayslip: true });
  });
});
