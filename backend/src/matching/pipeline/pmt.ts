/**
 * PMT (Payment) calculator — pure function.
 * EMI = P × r × (1+r)^n / ((1+r)^n − 1) where r = monthly rate, n = months.
 *
 * Constitution Principle I: Decimal end-to-end; banker's rounding (ROUND_HALF_EVEN)
 * matches the Egyptian Central Bank statement convention (research R2) so cumulative
 * penny drift over long tenors converges to zero.
 *
 * ─── Two bases, one place ─────────────────────────────────────────────────────
 *
 * The annuity above charges interest on the REDUCING balance. A FLAT program charges it on
 * the original principal for the whole tenor:
 *
 *   instalment = P × (1 + rate × months ÷ 12) ÷ months
 *
 * Both directions of both bases live in this file, because the forward and the inverse must
 * invert each other exactly — `ceilingToIncome` turns a ceiling into an instalment and
 * `calculateMaxLoanFromDbr` turns an instalment back into a principal, and a bank's table
 * says 2 000 000, not 1 999 999.83. A second copy of either formula elsewhere is how the two
 * would eventually disagree about a number an offer freezes.
 *
 * `basis` is optional on every function and defaults to `reducing`: every stored program
 * predates the field and was priced by the annuity (see `rate-basis.ts`).
 */

import { Decimal } from '@prisma/client/runtime/library';

import { DEFAULT_RATE_BASIS, type RateBasis } from './rate-basis';

const ROUND_BANKERS = Decimal.ROUND_HALF_EVEN;

export function calculateMonthlyInstallment(
  principalEGP: Decimal,
  annualRatePercent: Decimal,
  tenorMonths: number,
  basis: RateBasis = DEFAULT_RATE_BASIS,
): Decimal {
  return monthlyInstallmentRaw(principalEGP, annualRatePercent, tenorMonths, basis).toDecimalPlaces(
    2,
    ROUND_BANKERS,
  );
}

/**
 * The same instalment, UNROUNDED.
 *
 * Exists for one caller: `ceilingToIncome`, which turns a collateral ceiling into the
 * income that ceiling implies and then hands it to `calculateMaxLoanFromDbr`, which
 * inverts the very same formula. Rounding the instalment to piastres mid-way makes the
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
  basis: RateBasis = DEFAULT_RATE_BASIS,
): Decimal {
  const one = new Decimal(1);

  if (basis === 'flat') {
    // Interest on the ORIGINAL principal for the whole tenor, spread evenly.
    const totalRate = annualRatePercent.div(100).mul(tenorMonths).div(12);
    return principalEGP.mul(one.plus(totalRate)).div(tenorMonths);
  }

  const monthlyRate = annualRatePercent.div(100).div(12);

  if (monthlyRate.isZero()) return principalEGP.div(tenorMonths);

  const factor = one.plus(monthlyRate).pow(tenorMonths);
  const numerator = principalEGP.mul(monthlyRate).mul(factor);
  const denominator = factor.minus(one);
  return numerator.div(denominator);
}

/**
 * The inverse: the largest principal an instalment carries, UNROUNDED.
 *
 * The one home for both inverses, so `calculateMaxLoanFromDbr` cannot invert a formula the
 * forward direction no longer uses. A non-positive instalment carries nothing — zero, not a
 * negative principal, because the callers subtract obligations before they get here and a
 * customer whose obligations already exceed the cap can borrow no amount at all.
 */
export function maxPrincipalRaw(
  monthlyInstallmentEGP: Decimal,
  annualRatePercent: Decimal,
  tenorMonths: number,
  basis: RateBasis = DEFAULT_RATE_BASIS,
): Decimal {
  const zero = new Decimal(0);
  if (!monthlyInstallmentEGP.isFinite() || monthlyInstallmentEGP.lessThanOrEqualTo(0)) return zero;
  if (!Number.isFinite(tenorMonths) || tenorMonths < 1) return zero;

  const one = new Decimal(1);

  if (basis === 'flat') {
    const totalRate = annualRatePercent.div(100).mul(tenorMonths).div(12);
    return monthlyInstallmentEGP.mul(tenorMonths).div(one.plus(totalRate));
  }

  const monthlyRate = annualRatePercent.div(100).div(12);
  if (monthlyRate.isZero()) return monthlyInstallmentEGP.mul(tenorMonths);

  const factor = one.plus(monthlyRate).pow(tenorMonths);
  return monthlyInstallmentEGP.mul(factor.minus(one)).div(monthlyRate.mul(factor));
}

export function calculateEffectiveLoanAmount(
  requestedAmountEGP: Decimal,
  feesFinancedEGP: Decimal,
): Decimal {
  return requestedAmountEGP.plus(feesFinancedEGP).toDecimalPlaces(2, ROUND_BANKERS);
}
