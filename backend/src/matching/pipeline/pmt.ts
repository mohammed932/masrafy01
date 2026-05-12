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
  const one = new Decimal(1);
  const monthlyRate = annualRatePercent.div(100).div(12);

  if (monthlyRate.isZero()) {
    return principalEGP.div(tenorMonths).toDecimalPlaces(2, ROUND_BANKERS);
  }

  const factor = one.plus(monthlyRate).pow(tenorMonths);
  const numerator = principalEGP.mul(monthlyRate).mul(factor);
  const denominator = factor.minus(one);
  return numerator.div(denominator).toDecimalPlaces(2, ROUND_BANKERS);
}

export function calculateEffectiveLoanAmount(
  requestedAmountEGP: Decimal,
  feesFinancedEGP: Decimal,
): Decimal {
  return requestedAmountEGP.plus(feesFinancedEGP).toDecimalPlaces(2, ROUND_BANKERS);
}
