/**
 * Debt Burden Ratio — pure functions.
 * DBR = (existing obligations + new EMI) / monthly income × 100
 *
 * `calculateMaxLoanFromDbr` floors to ≤ applicant-requested amount (FR-008o.1)
 * and rounds DOWN to the program's amount-step multiple (FR-008p.1).
 */

import { Decimal } from '@prisma/client/runtime/library';

const ROUND_BANKERS = Decimal.ROUND_HALF_EVEN;

export interface DbrInput {
  monthlyIncomeEGP: Decimal;
  existingMonthlyObligationsEGP: Decimal;
  newMonthlyInstallmentEGP: Decimal;
}

export interface DbrResult {
  dbrPercent: Decimal;
  withinCap: boolean;
}

export function calculateDbr(input: DbrInput, dbrCapPercent: number): DbrResult {
  if (input.monthlyIncomeEGP.lessThanOrEqualTo(0)) {
    return { dbrPercent: new Decimal(999), withinCap: false };
  }
  const totalObligations = input.existingMonthlyObligationsEGP.plus(input.newMonthlyInstallmentEGP);
  const dbrPercent = totalObligations
    .mul(100)
    .div(input.monthlyIncomeEGP)
    .toDecimalPlaces(2, ROUND_BANKERS);
  return { dbrPercent, withinCap: dbrPercent.lessThanOrEqualTo(dbrCapPercent) };
}

export function calculateMaxLoanFromDbr(args: {
  monthlyIncomeEGP: Decimal;
  existingMonthlyObligationsEGP: Decimal;
  dbrCapPercent: number;
  annualRatePercent: Decimal;
  tenorMonths: number;
  applicantRequestedEGP: Decimal;
  amountStepEGP?: Decimal;
}): Decimal {
  const maxEmi = args.monthlyIncomeEGP
    .mul(args.dbrCapPercent)
    .div(100)
    .minus(args.existingMonthlyObligationsEGP);

  if (maxEmi.lessThanOrEqualTo(0)) return new Decimal(0);

  const monthlyRate = args.annualRatePercent.div(100).div(12);

  let maxPrincipal: Decimal;
  if (monthlyRate.isZero()) {
    maxPrincipal = maxEmi.mul(args.tenorMonths);
  } else {
    const one = new Decimal(1);
    const factor = one.plus(monthlyRate).pow(args.tenorMonths);
    maxPrincipal = maxEmi.mul(factor.minus(one)).div(monthlyRate.mul(factor));
  }

  // Floor to ≤ applicant-requested amount (FR-008o.1).
  if (maxPrincipal.greaterThan(args.applicantRequestedEGP)) {
    maxPrincipal = args.applicantRequestedEGP;
  }

  // Floor to amount-step multiple (FR-008p.1).
  if (args.amountStepEGP && args.amountStepEGP.greaterThan(0)) {
    const steps = maxPrincipal.div(args.amountStepEGP).floor();
    maxPrincipal = steps.mul(args.amountStepEGP);
  }

  return maxPrincipal.toDecimalPlaces(2, ROUND_BANKERS);
}
