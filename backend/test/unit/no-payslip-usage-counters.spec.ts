/**
 * The catalog's no-payslip counters (v16.0.0; re-based v16.3.0).
 *
 * These two numbers drive the only warning on the program-catalog board an operator can
 * act on: a program sold WITHOUT a payslip whose bank never entered an income table
 * produces no figure for anyone, silently, and says nothing to the customer.
 *
 * They are pinned here because the gate has moved twice. Until v16.0.0 the counters were
 * keyed off the loan CATEGORY — membership of a hardcoded no-payslip category list.
 * Deleting that category (a product decision made on a different day, in a different
 * file) would have left the gate matching nothing: every name would report zero, the badge
 * and the stat would quietly vanish, and the three live `personal` + `income_surrogate`
 * ABK programs would have stayed unconfigured with nothing on screen saying so. Nothing
 * would have failed. That is exactly the class of defect a test has to hold shut.
 *
 * The `noPayslipPrograms` gate is the PROGRAM's own `programType`, which is also what the
 * matching engine branches on (`quote.ts#shouldConsultIncomeRule`) — so the number an
 * operator is asked to act on and the runtime behaviour it describes cannot disagree.
 *
 * "No table" is now a contradiction INSIDE one program: its rule says the income is worked
 * out from a fact about the applicant, and the table that does the working out is empty.
 * It used to ALSO require the catalog NAME to be ticked for a fact — a second claim an
 * operator maintained by hand on the program-name screen, which no quote, publish check or
 * save validation ever read. That tick-list is gone (v16.3.0) and the counter reads the
 * program alone.
 *
 * `strategy: 'declared'` is deliberately not counted: on a surrogate program it is a
 * legitimate, live configuration (seven business and professional programs carry exactly
 * that pair; the type marks the lane and the stated salary is the figure). Flagging those
 * would put correctly-configured programs on a warning list nobody can clear.
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

function repoWith(programs: FakeProgram[]): PostgresPlatformEnumerationsRepository {
  const prisma = {
    bankProgram: { findMany: async () => programs },
  } as unknown as PrismaService;
  return new PostgresPlatformEnumerationsRepository(prisma);
}

/** A built-in fact method WITH the table it needs — configured, nothing to warn about. */
const GRADE_TABLE = {
  strategy: 'byMilitaryGrade',
  keyTable: [{ key: 'officer', incomeEGP: '15000' }],
};
/** The same method with nothing behind it — reads a fact, quotes nothing. */
const GRADE_NO_TABLE = { strategy: 'byMilitaryGrade' };
/** A registry fact, same gap, via the other token family. */
const REGISTRY_NO_TABLE = { strategy: 'fact:taxi_licence', keyTable: [] };
/** No method at all. Legitimate on a surrogate program; see the header. */
const DECLARED = { strategy: 'declared' };

describe('program-name usage — no-payslip counters', () => {
  it('counts an income_surrogate program under ANY loan category', async () => {
    // The regression. These three are the live ABK shape: `personal` programs that assume
    // an income. The old category gate counted none of them once the no-payslip category
    // was removed.
    const usage = await repoWith([
      { programNameKey: 'armed_forces', bankId: 'b1', programType: BankProgramType.income_surrogate, productCategory: 'personal', incomeAssumption: GRADE_TABLE },
      { programNameKey: 'armed_forces', bankId: 'b2', programType: BankProgramType.income_surrogate, productCategory: 'personal', incomeAssumption: GRADE_NO_TABLE },
      { programNameKey: 'armed_forces', bankId: 'b3', programType: BankProgramType.income_proof, productCategory: 'personal', incomeAssumption: GRADE_NO_TABLE },
    ]).countProgramNameUsage();

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
      { programNameKey: 'doctor', bankId: 'b1', programType: BankProgramType.income_proof, productCategory: 'personal', incomeAssumption: GRADE_NO_TABLE },
    ]).countProgramNameUsage();

    expect(usage.get('doctor')).toMatchObject({
      programs: 2,
      banks: 1,
      noPayslipPrograms: 0,
      noPayslipProgramsWithoutTable: 0,
    });
  });

  it('flags a registry `fact:` rule with an empty table, like a built-in one', async () => {
    // Both token families read an answer the applicant gives, so both need a table. The
    // counter must not be keyed to the four frozen methods, or a fact an operator adds
    // stops being counted the day it is used.
    const usage = await repoWith([
      { programNameKey: 'taxi', bankId: 'b1', programType: BankProgramType.income_surrogate, productCategory: 'personal', incomeAssumption: REGISTRY_NO_TABLE },
    ]).countProgramNameUsage();

    expect(usage.get('taxi')?.noPayslipProgramsWithoutTable).toBe(1);
  });

  it('does NOT flag a fact rule that HAS bands rather than a key table', async () => {
    // A numeric fact's table is `bands`, not `keyTable`. Reading only one of the two would
    // report every correctly-configured numeric rule as unconfigured.
    const usage = await repoWith([
      {
        programNameKey: 'pharmacy',
        bankId: 'b1',
        programType: BankProgramType.income_surrogate,
        productCategory: 'personal',
        incomeAssumption: {
          strategy: 'byYearsInPractice',
          bands: [{ fromInclusive: '0', toExclusive: null, incomeEGP: '9000' }],
        },
      },
    ]).countProgramNameUsage();

    expect(usage.get('pharmacy')?.noPayslipProgramsWithoutTable).toBe(0);
  });

  it('does NOT flag a declared-only surrogate program', async () => {
    // The false alarm this rule exists to prevent, in its real shape: seven live business
    // programs are `income_surrogate` + `declared` on purpose. Nothing reads a fact, so
    // there is no missing table and nothing for an operator to do.
    const usage = await repoWith([
      { programNameKey: 'working_capital', bankId: 'b1', programType: BankProgramType.income_surrogate, productCategory: 'business', incomeAssumption: DECLARED },
      { programNameKey: 'working_capital', bankId: 'b2', programType: BankProgramType.income_surrogate, productCategory: 'business', incomeAssumption: DECLARED },
    ]).countProgramNameUsage();

    expect(usage.get('working_capital')).toMatchObject({
      noPayslipPrograms: 2,
      noPayslipProgramsWithoutTable: 0,
    });
  });

  it('does not flag an unreadable rule blob, and does not throw on a list read', async () => {
    // The column is `Json`, so anything can be in it, and this backs a board GET. A blob
    // nobody can parse names no method, so nothing says it reads a fact — the counter
    // stays quiet rather than inventing a gap an operator cannot find.
    for (const blob of [null, 'nonsense', 42, {}, { strategy: 7 }]) {
      const usage = await repoWith([
        { programNameKey: 'police', bankId: 'b1', programType: BankProgramType.income_surrogate, productCategory: 'personal', incomeAssumption: blob },
      ]).countProgramNameUsage();
      expect(usage.get('police')?.noPayslipProgramsWithoutTable, JSON.stringify(blob)).toBe(0);
    }
  });

  it('ignores a program with no catalog name — it cannot be counted against one', async () => {
    const usage = await repoWith([
      { programNameKey: null, bankId: 'b1', programType: BankProgramType.income_surrogate, productCategory: 'personal', incomeAssumption: DECLARED },
    ]).countProgramNameUsage();
    expect(usage.size).toBe(0);
  });
});
