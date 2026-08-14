/**
 * The catalog's no-payslip counters (v16.0.0).
 *
 * These two numbers drive the only warning on the program-catalog board an operator can
 * act on: a program sold WITHOUT a payslip whose bank never entered an income table
 * produces no figure for anyone, silently, and says nothing to the customer.
 *
 * They are pinned here because the gate moved. Until v16.0.0 the counters were keyed off
 * the loan CATEGORY — membership of a hardcoded no-payslip category list. Deleting that
 * category (a product decision made on a different day, in a different file) would have
 * left the gate matching nothing: every name would report zero, the badge and the stat
 * would quietly vanish, and the three live `personal` + `income_surrogate` ABK programs
 * would have stayed unconfigured with nothing on screen saying so. Nothing would have
 * failed. That is exactly the class of defect a test has to hold shut.
 *
 * The gate is now the PROGRAM's own `programType`, which is also what the matching engine
 * branches on (`quote.ts#shouldConsultIncomeRule`) — so the number an operator is asked to
 * act on and the runtime behaviour it describes cannot disagree.
 *
 * "No table" then needs BOTH halves of a contradiction: the program assumes no income AND
 * its catalog name promises, for that category, that banks work the income out from a fact.
 * An empty rule alone is not a fault — `strategy: 'declared'` on a surrogate program is a
 * legitimate, live configuration (business and professional programs carry exactly that
 * pair; the type marks the lane and the stated salary is the figure). The old category gate
 * shielded those by accident, so re-gating on the type alone put seven correctly-configured
 * programs on the warning list — worse than the silence it replaced, because nobody can
 * clear them.
 */
import { describe, expect, it } from 'vitest';
import { BankProgramType } from '@prisma/client';
import { PostgresPlatformEnumerationsRepository } from '@/platform-enumerations/postgres-platform-enumerations.repository';
import type { PrismaService } from '@/infra/prisma/prisma.service';

interface FakeProgram {
  programNameKey: string | null;
  bankId: string | null;
  programType: BankProgramType;
  productCategory: string;
  incomeAssumption: unknown;
}

/**
 * `promises` is the set of `(name, category)` pairs whose CATALOG entry has a surrogate
 * fact ticked — the other half of the "no table" contradiction.
 */
function repoWith(
  programs: FakeProgram[],
  promises: Array<{ key: string; category: string }> = [],
): PostgresPlatformEnumerationsRepository {
  const prisma = {
    bankProgram: { findMany: async () => programs },
    platformEnumerationQuestion: {
      findMany: async () =>
        promises.map((p) => ({ category: p.category, enumeration: { key: p.key } })),
    },
  } as unknown as PrismaService;
  return new PostgresPlatformEnumerationsRepository(prisma);
}

const GRADE_TABLE = { strategy: 'byMilitaryGrade', keyTable: [{ key: 'officer', incomeEGP: '15000' }] };
const NO_TABLE = { strategy: 'declared' };

describe('program-name usage — no-payslip counters', () => {
  it('counts an income_surrogate program under ANY loan category', async () => {
    // The regression. These three are the live ABK shape: `personal` programs that assume
    // an income. The old category gate counted none of them once the no-payslip category
    // was removed.
    const usage = await repoWith([
      { programNameKey: 'armed_forces', bankId: 'b1', programType: BankProgramType.income_surrogate, productCategory: 'personal', incomeAssumption: GRADE_TABLE },
      { programNameKey: 'armed_forces', bankId: 'b2', programType: BankProgramType.income_surrogate, productCategory: 'personal', incomeAssumption: NO_TABLE },
      { programNameKey: 'armed_forces', bankId: 'b3', programType: BankProgramType.income_proof, productCategory: 'personal', incomeAssumption: NO_TABLE },
    ], [{ key: 'armed_forces', category: 'personal' }]).countProgramNameUsage();

    expect(usage.get('armed_forces')).toEqual({
      programs: 3,
      banks: 3,
      noPayslipPrograms: 2,
      noPayslipProgramsWithoutTable: 1,
    });
  });

  it('does not count a payslip program, however its rule is configured', async () => {
    // A leftover grade table on an `income_proof` program is reported by the income-rule
    // warning instead. Counting it here would put a name on the board's warning list that
    // no operator can clear, because the program is correctly typed.
    const usage = await repoWith([
      { programNameKey: 'doctor', bankId: 'b1', programType: BankProgramType.income_proof, productCategory: 'personal', incomeAssumption: GRADE_TABLE },
      { programNameKey: 'doctor', bankId: 'b1', programType: BankProgramType.income_proof, productCategory: 'personal', incomeAssumption: NO_TABLE },
    ]).countProgramNameUsage();

    expect(usage.get('doctor')).toMatchObject({
      programs: 2,
      banks: 1,
      noPayslipPrograms: 0,
      noPayslipProgramsWithoutTable: 0,
    });
  });

  it('treats an unreadable rule blob as "no table" rather than throwing on a list read', async () => {
    // The column is `Json`, so anything can be in it, and this backs a board GET. A
    // rule nobody can parse is a rule nobody entered.
    for (const blob of [null, 'nonsense', 42, {}, { strategy: 7 }]) {
      const usage = await repoWith([
        { programNameKey: 'police', bankId: 'b1', programType: BankProgramType.income_surrogate, productCategory: 'personal', incomeAssumption: blob },
      ], [{ key: 'police', category: 'personal' }]).countProgramNameUsage();
      expect(usage.get('police')?.noPayslipProgramsWithoutTable, JSON.stringify(blob)).toBe(1);
    }
  });

  it('does NOT flag a declared-only surrogate program whose name promises no fact', async () => {
    // The false alarm this rule exists to prevent, in its real shape: seven live business
    // programs are `income_surrogate` + `declared` on purpose. Their catalog names have no
    // fact ticked, so nothing is contradicted and there is nothing for an operator to do.
    const usage = await repoWith([
      { programNameKey: 'working_capital', bankId: 'b1', programType: BankProgramType.income_surrogate, productCategory: 'business', incomeAssumption: NO_TABLE },
      { programNameKey: 'working_capital', bankId: 'b2', programType: BankProgramType.income_surrogate, productCategory: 'business', incomeAssumption: NO_TABLE },
    ]).countProgramNameUsage();

    expect(usage.get('working_capital')).toMatchObject({
      noPayslipPrograms: 2,
      noPayslipProgramsWithoutTable: 0,
    });
  });

  it('flags the same shape when the name DOES promise a fact for that category', async () => {
    // `pharmacy / personal` in the seeded data: the catalog says banks here read years in
    // practice, this program reads the salary. One of the two is wrong — which is precisely
    // what the badge should send someone to look at. The same name under `business` promises
    // nothing, so its sibling program stays unflagged in the same count.
    const usage = await repoWith(
      [
        { programNameKey: 'pharmacy', bankId: 'b1', programType: BankProgramType.income_surrogate, productCategory: 'personal', incomeAssumption: NO_TABLE },
        { programNameKey: 'pharmacy', bankId: 'b1', programType: BankProgramType.income_surrogate, productCategory: 'business', incomeAssumption: NO_TABLE },
      ],
      [{ key: 'pharmacy', category: 'personal' }],
    ).countProgramNameUsage();

    expect(usage.get('pharmacy')).toMatchObject({
      noPayslipPrograms: 2,
      noPayslipProgramsWithoutTable: 1,
    });
  });

  it('matches the promise case-insensitively — productCategory is a free-form column', async () => {
    // A program filed as "Personal" must meet the `personal` tick rather than miss it and
    // read as correctly configured.
    const usage = await repoWith(
      [{ programNameKey: 'doctor', bankId: 'b1', programType: BankProgramType.income_surrogate, productCategory: 'Personal', incomeAssumption: NO_TABLE }],
      [{ key: 'doctor', category: 'personal' }],
    ).countProgramNameUsage();

    expect(usage.get('doctor')?.noPayslipProgramsWithoutTable).toBe(1);
  });

  it('ignores a program with no catalog name — it cannot be counted against one', async () => {
    const usage = await repoWith([
      { programNameKey: null, bankId: 'b1', programType: BankProgramType.income_surrogate, productCategory: 'personal', incomeAssumption: NO_TABLE },
    ]).countProgramNameUsage();
    expect(usage.size).toBe(0);
  });
});
