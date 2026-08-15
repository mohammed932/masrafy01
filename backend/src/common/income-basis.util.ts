import { BankProgramType } from '@prisma/client';

/**
 * How a program proves the applicant's income — the operator-facing axis behind
 * `bank_program.programType`.
 *
 * `income_proof` / `income_surrogate` are the ENGINE's words and are never shown
 * to anyone; the admin picks between "reads a payslip" and "no payslip", and the
 * program catalog records which of the two a name may be sold under. Mirrors
 * `admin/src/app/core/income-basis.ts` (Principle XXIX / A25 — both sides of one
 * vocabulary move together).
 *
 * NOT a loan category, and not derivable from one (Principle II scope-lock,
 * v16.0.0): every category may sell either basis, and which one a program uses is
 * its own `programType`.
 */
export type IncomeBasis = 'payslip' | 'no_payslip';

/** Both bases, in the order the admin sees them. */
export const ALL_INCOME_BASES: readonly IncomeBasis[] = ['payslip', 'no_payslip'];

const BASIS_ORDER = new Map(ALL_INCOME_BASES.map((b, i) => [b, i]));

export function isIncomeBasis(value: unknown): value is IncomeBasis {
  return typeof value === 'string' && (ALL_INCOME_BASES as readonly string[]).includes(value);
}

/** The basis a program of this type is sold on. */
export function basisOfProgramType(programType: BankProgramType | string): IncomeBasis {
  return programType === BankProgramType.income_surrogate ? 'no_payslip' : 'payslip';
}

/** Canonical order, so the same set always serialises the same way. */
export function sortBases(bases: readonly IncomeBasis[]): IncomeBasis[] {
  return [...bases].sort((a, b) => (BASIS_ORDER.get(a) ?? 0) - (BASIS_ORDER.get(b) ?? 0));
}

export function dedupeBases(bases: readonly IncomeBasis[]): IncomeBasis[] {
  return sortBases([...new Set(bases)]);
}

/** The two stored booleans → the set, for the boundary mappers. */
export function basesOfFlags(flags: { payslip: boolean; noPayslip: boolean }): IncomeBasis[] {
  const out: IncomeBasis[] = [];
  if (flags.payslip) out.push('payslip');
  if (flags.noPayslip) out.push('no_payslip');
  return out;
}

/** The set → the two stored booleans, for the writers. */
export function flagsOfBases(bases: readonly IncomeBasis[]): { payslip: boolean; noPayslip: boolean } {
  return { payslip: bases.includes('payslip'), noPayslip: bases.includes('no_payslip') };
}
