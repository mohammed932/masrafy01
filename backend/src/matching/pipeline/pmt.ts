/**
 * PMT (Payment) calculator — pure function.
 * EMI = P × r × (1+r)^n / ((1+r)^n − 1) where r = monthly rate, n = months.
 *
 * Constitution Principle I: Decimal end-to-end; banker's rounding (ROUND_HALF_EVEN)
 * matches the Egyptian Central Bank statement convention (research R2) so cumulative
 * penny drift over long tenors converges to zero.
 */

import { Decimal } from '@prisma/client/runtime/library';

const ROUND_BANKERS = Decimal.ROUND_HALF_EVEN;

export function calculateMonthlyInstallment(
  principalEGP: Decimal,
  annualRatePercent: Decimal,
  tenorMonths: number,
): Decimal {
  return monthlyInstallmentRaw(principalEGP, annualRatePercent, tenorMonths).toDecimalPlaces(
    2,
    ROUND_BANKERS,
  );
}

/**
 * The same annuity, UNROUNDED.
 *
 * Exists for one caller: `ceilingToIncome`, which turns a collateral ceiling into the
 * income that ceiling implies and then hands it to `calculateMaxLoanFromDbr`, which
 * inverts the very same annuity. Rounding the instalment to piastres mid-way makes the
 * round trip lose up to a few piastres, and the customer is then shown a ceiling of
 * 1 999 999.83 against a bank table that plainly says 2 000 000.
 *
 * Two precisions, ONE formula — a second annuity written out beside this one is how the
 * two would eventually disagree about a number an offer freezes (Principle I).
 *
 * Never use this for a figure anyone is shown or anything is billed on: those are
 * money, and money is rounded here, once, with banker's rounding.
 */
export function monthlyInstallmentRaw(
  principalEGP: Decimal,
  annualRatePercent: Decimal,
  tenorMonths: number,
): Decimal {
  const one = new Decimal(1);
  const monthlyRate = annualRatePercent.div(100).div(12);

  if (monthlyRate.isZero()) return principalEGP.div(tenorMonths);

  const factor = one.plus(monthlyRate).pow(tenorMonths);
  const numerator = principalEGP.mul(monthlyRate).mul(factor);
  const denominator = factor.minus(one);
  return numerator.div(denominator);
}

export function calculateEffectiveLoanAmount(
  requestedAmountEGP: Decimal,
  feesFinancedEGP: Decimal,
): Decimal {
  return requestedAmountEGP.plus(feesFinancedEGP).toDecimalPlaces(2, ROUND_BANKERS);
}
