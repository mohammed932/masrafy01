/**
 * WHICH PROGRAMS THE CUSTOMER IS SHOWN (operator decision, 2026-11-07; constitution v36.0.0).
 *
 * The customer is shown only what they match. Two halves, both decided here so the preview,
 * the admin simulator and apply decide them the same way (A33):
 *
 *   1. THE RULES A BANK STATES ON THE PROGRAM, as far as the questionnaire asks about them —
 *      age, minimum income, months in the job, and (payslip programs) whether the salary can
 *      be transferred. A rule whose answer the customer has not given is NOT held against
 *      them: "not answered yet" is not "does not match".
 *
 *      Deliberately NOT enforced, though stored on every program:
 *        - the job type — nobody is asked it any more (v30.18.0): the program the customer
 *          picked answers it, so enforcing it hid every self-employed / retired program;
 *        - the loan amount and the term — the quote already cuts both to the program's limits;
 *        - the "requires a deposit / compound / club / car loan / card / existing loan" flags —
 *          those answers reach the engine through the product's own facts, and the product's
 *          calculation and conditions already refuse a customer who lacks them.
 *
 *   2. AN OFFER. A program the engine could not price for a reason that is a VERDICT about this
 *      customer (the bank does not finance that car, a condition failed, the amount is below
 *      the program's floor, the debts leave no room…) is not shown. One it could not price only
 *      because an answer is still to come stays listed until it arrives.
 */

import { Decimal } from '@prisma/client/runtime/library';
import type { ApplicantProfile, BankProgramSnapshot, FiguresUnavailableReason } from '../types';
import { checkEligibility } from './eligibility-checker';
import { groupsFor } from './product-groups';
import { applyCompanyTypeAdjustment, resolveAssumedIncome } from './income-resolver';
import { shouldConsultIncomeRule } from './quote';
import type { IncomeResolution } from '../types';

/** The eligibility codes that hide a program (see the header for what is left out, and why). */
export const ENFORCED_ELIGIBILITY_CHECKS = [
  'age',
  'monthly_income',
  'months_in_job',
  'salary_transfer',
] as const;
export type EnforcedEligibilityCheck = (typeof ENFORCED_ELIGIBILITY_CHECKS)[number];

/** Could-not-price reasons that mean "an answer is still to come", not "does not match". */
export const PENDING_REASONS: ReadonlySet<string> = new Set<
  FiguresUnavailableReason | 'MONEY_FIGURE_MISSING'
>(['MONEY_FIGURE_MISSING', 'SURROGATE_FACT_MISSING']);

/** True when a could-not-price reason hides the program (anything but "an answer is still to come"). */
export function hidesProgram(reason: string): boolean {
  return !PENDING_REASONS.has(reason);
}

/** A transfer the bank counts — any of these on the program's list is met by a "yes". */
const TRANSFER_KINDS = ['payroll', 'salary_transfer_letter', 'income_transfer_letter'];

/**
 * The income the bank's minimum is measured against — exactly what the quote will price on:
 * the product's figure for a no-payslip program, the declared salary otherwise (after the
 * bank's own recognition percentage for the employer's sector). Resolved ONCE and handed to
 * `quoteProgram` too, so the gate and the quote can never read two different incomes.
 */
export function resolveGateIncome(args: {
  profile: ApplicantProfile;
  program: BankProgramSnapshot;
  parentKeyByValue?: Readonly<Record<string, string>>;
}): { incomeResolution: IncomeResolution | null; assumedIncome: Decimal } {
  const { profile, program } = args;
  const parentKeyByValue = groupsFor(program, args.parentKeyByValue);
  const incomeResolution = shouldConsultIncomeRule(profile, program)
    ? resolveAssumedIncome({
        profile,
        income: program.incomeAssumption,
        eligibility: program.eligibility,
        programBankName: program.bankName,
        ...(parentKeyByValue !== undefined ? { parentKeyByValue } : {}),
      })
    : null;
  const rawIncome =
    incomeResolution?.incomeEGP ?? profile.employment?.monthlyNetSalaryEGP ?? new Decimal(0);
  const declaredOrigin =
    incomeResolution === null ||
    incomeResolution.origin === 'declared' ||
    incomeResolution.origin === 'declared_over_surrogate';
  const assumedIncome = declaredOrigin
    ? applyCompanyTypeAdjustment(rawIncome, profile, program.eligibility)
    : rawIncome;
  return { incomeResolution, assumedIncome };
}

/** The enforced rules this customer fails on this program — empty means it may be shown. */
export function failedMatchRules(
  profile: ApplicantProfile,
  program: BankProgramSnapshot,
  assumedIncome: Decimal,
): EnforcedEligibilityCheck[] {
  const failed: EnforcedEligibilityCheck[] = [];
  const all = checkEligibility(profile, program, assumedIncome).failedChecks;
  if (all.includes('age')) failed.push('age');
  // A no-payslip income that is not yet worked out (its facts still to come) is not "too low".
  if (all.includes('monthly_income') && assumedIncome.greaterThan(0)) failed.push('monthly_income');
  if (profile.answered?.monthsInJob === true && all.includes('months_in_job'))
    failed.push('months_in_job');
  if (profile.answered?.salaryTransfer === true && program.programType !== 'income_surrogate') {
    const accepted = program.eligibility.acceptedSalaryTransferTypes ?? [];
    const canTransfer = profile.employment.salaryTransferType !== 'none';
    const met =
      accepted.length === 0 ||
      (canTransfer ? accepted.some((t) => TRANSFER_KINDS.includes(t)) : accepted.includes('none'));
    if (!met) failed.push('salary_transfer');
  }
  return failed;
}
