/**
 * `matchesRequestedScope` — the income-basis axis.
 *
 * The scope filter is the ONE place a request is turned into a program set, and
 * apply and matching-preview both call it (A25): two copies of this rule is two
 * chances for a previewed shortlist to disappear at apply. So the third axis is
 * pinned here rather than inside either caller.
 *
 * The property that has to hold for every existing client is the LAST case: a
 * request that names no income basis must still be matched against both. Every
 * app build before the income-type step sends none, and a filter that read a
 * missing value as "match nothing" would return an empty shortlist to every one
 * of them — indistinguishable, on the results screen, from "no bank offers this".
 */
import { describe, expect, it } from 'vitest';
import { BankProgramType } from '@prisma/client';
import { matchesRequestedScope, type ProgramScopeRow } from '@/bank-programs/program-scope';

const payslip: ProgramScopeRow = {
  productCategory: 'personal',
  programNameKey: 'personal_loan',
  programType: BankProgramType.income_proof,
};

const noPayslip: ProgramScopeRow = {
  productCategory: 'personal',
  programNameKey: 'personal_loan',
  programType: BankProgramType.income_surrogate,
};

describe('matchesRequestedScope — programType axis', () => {
  it('keeps only programs of the requested basis', () => {
    expect(matchesRequestedScope(payslip, 'personal', null, BankProgramType.income_proof)).toBe(
      true,
    );
    expect(matchesRequestedScope(noPayslip, 'personal', null, BankProgramType.income_proof)).toBe(
      false,
    );
    expect(
      matchesRequestedScope(noPayslip, 'personal', null, BankProgramType.income_surrogate),
    ).toBe(true);
    expect(matchesRequestedScope(payslip, 'personal', null, BankProgramType.income_surrogate)).toBe(
      false,
    );
  });

  it('narrows independently of the other two axes', () => {
    // Right basis, wrong category.
    expect(matchesRequestedScope(payslip, 'car', null, BankProgramType.income_proof)).toBe(false);
    // Right basis, wrong catalog name.
    expect(
      matchesRequestedScope(payslip, 'personal', 'doctor_loan', BankProgramType.income_proof),
    ).toBe(false);
    // All three right.
    expect(
      matchesRequestedScope(payslip, 'personal', 'personal_loan', BankProgramType.income_proof),
    ).toBe(true);
  });

  it('still compares the category case-insensitively with the new axis in play', () => {
    const stored: ProgramScopeRow = { ...payslip, productCategory: 'Personal' };
    expect(matchesRequestedScope(stored, 'personal', null, BankProgramType.income_proof)).toBe(
      true,
    );
  });

  it('treats a null basis as "both", not as "match nothing"', () => {
    for (const program of [payslip, noPayslip]) {
      expect(matchesRequestedScope(program, 'personal', null, null)).toBe(true);
      // The pre-income-type call shape — three arguments — must behave identically.
      expect(matchesRequestedScope(program, 'personal', null)).toBe(true);
    }
  });
});
