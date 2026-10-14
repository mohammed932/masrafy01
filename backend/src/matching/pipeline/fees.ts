/**
 * Fees calculator — pure function.
 * Computes admin fee, stamp duty, life insurance, and applies waiver-penalty rates
 * onto the effective interest rate (FR-027c, edge case "fee-waiver stacking").
 */

import { Decimal } from '@prisma/client/runtime/library';
import type { FeesBreakdown, FeesConfig } from '../types';
import type { CarInsuranceOutcome } from './car-insurance';

const ROUND_BANKERS = Decimal.ROUND_HALF_EVEN;

export interface FeesInput {
  requestedAmountEGP: Decimal;
  effectiveLoanAmountEGP: Decimal;
  annualRatePercent: Decimal;
  tenorMonths: number;
  collateralized: boolean;
  /**
   * Comprehensive cover on the car, already resolved against the applicant's deposit by
   * `pipeline/car-insurance.ts`, or absent when the programme demands none.
   *
   * Resolved OUTSIDE and handed in, because the figure needs the fact grid and the car's
   * price and this module is the one place that knows nothing about either. Handed in at
   * all — rather than merged onto the breakdown by the caller — so `FeesBreakdown` keeps
   * ONE producer and a later reader cannot find a breakdown assembled two ways.
   *
   * It is a DISCLOSURE. See the assembly below: it reaches no total.
   */
  carInsurance?: CarInsuranceOutcome;
}

export interface FeesOutput {
  breakdown: FeesBreakdown;
  totalFinancedFeesEGP: Decimal;
  effectiveRateAfterPenaltiesPercent: Decimal;
}

export function calculateFees(config: FeesConfig, input: FeesInput): FeesOutput {
  const carInsurance = input.carInsurance;
  // Admin fee — % of requested amount, clamped to min/max.
  const adminFeePercent = new Decimal(config.adminFeePercent ?? 0);
  let adminFee = input.requestedAmountEGP.mul(adminFeePercent).div(100);
  if (config.adminFeeMinEGP) {
    const minFee = new Decimal(config.adminFeeMinEGP);
    if (adminFee.lessThan(minFee)) adminFee = minFee;
  }
  if (config.adminFeeMaxEGP) {
    const maxFee = new Decimal(config.adminFeeMaxEGP);
    if (adminFee.greaterThan(maxFee)) adminFee = maxFee;
  }
  adminFee = adminFee.toDecimalPlaces(2, ROUND_BANKERS);

  const adminFeeWaived =
    config.feeWaiverEnabledAtRatePercent != null &&
    config.feeWaiverMinTenorMonths != null &&
    input.annualRatePercent.greaterThanOrEqualTo(config.feeWaiverEnabledAtRatePercent) &&
    input.tenorMonths >= config.feeWaiverMinTenorMonths;
  if (adminFeeWaived) adminFee = new Decimal(0);

  // Stamp duty = flat EGP + a percent of the REQUESTED principal.
  //
  // Before feature 010 only `stampDutyEGP` was read while every writer set
  // `stampDutyPercent`, so stamp duty was 0.00 on every offer ever produced.
  // Both keys are honoured now. The percent applies to the requested amount and
  // never to the fee-inflated principal, so the fee cannot feed back on itself.
  const stampDutyFlat = new Decimal(config.stampDutyEGP ?? 0);
  const stampDutyFromPercent = config.stampDutyPercent
    ? input.requestedAmountEGP.mul(config.stampDutyPercent).div(100)
    : new Decimal(0);
  const stampDuty = stampDutyFlat.plus(stampDutyFromPercent).toDecimalPlaces(2, ROUND_BANKERS);

  // Life insurance — % of effective loan, with optional minimum-base floor.
  let lifeInsuranceEGP = new Decimal(0);
  if (config.lifeInsurancePercent != null) {
    const insurancePct = new Decimal(config.lifeInsurancePercent);
    const minLoan = config.lifeInsuranceMinLoanEGP
      ? new Decimal(config.lifeInsuranceMinLoanEGP)
      : null;
    const base =
      minLoan && input.effectiveLoanAmountEGP.lessThan(minLoan)
        ? minLoan
        : input.effectiveLoanAmountEGP;
    lifeInsuranceEGP = base.mul(insurancePct).div(100).toDecimalPlaces(2, ROUND_BANKERS);
  }

  const lifeInsuranceWaived =
    config.insuranceWaiverPenaltyMinTenorMonths != null &&
    config.insuranceWaiverPenaltyRatePercent != null &&
    input.tenorMonths >= config.insuranceWaiverPenaltyMinTenorMonths;
  if (lifeInsuranceWaived) lifeInsuranceEGP = new Decimal(0);

  const collateralFeeEGP =
    input.collateralized && config.collateralFeeEGP
      ? new Decimal(config.collateralFeeEGP).toDecimalPlaces(2, ROUND_BANKERS)
      : undefined;

  // Stack penalty rates onto effective rate.
  let effectiveRate = input.annualRatePercent;
  if (adminFeeWaived && config.feeWaiverPenaltyRatePercent != null) {
    effectiveRate = effectiveRate.plus(config.feeWaiverPenaltyRatePercent);
  }
  if (lifeInsuranceWaived && config.insuranceWaiverPenaltyRatePercent != null) {
    effectiveRate = effectiveRate.plus(config.insuranceWaiverPenaltyRatePercent);
  }
  effectiveRate = effectiveRate.toDecimalPlaces(4, ROUND_BANKERS);

  const breakdown: FeesBreakdown = {
    adminFeeEGP: adminFee.toFixed(2),
    adminFeeWaived,
    stampDutyEGP: stampDuty.toFixed(2),
    lifeInsuranceEGP: lifeInsuranceEGP.toFixed(2),
    lifeInsuranceWaived,
    collateralFeeEGP: collateralFeeEGP?.toFixed(2),
    feeWaiverPenaltyRatePercent: config.feeWaiverPenaltyRatePercent,
    insuranceWaiverPenaltyRatePercent: config.insuranceWaiverPenaltyRatePercent,
    effectiveRateAfterPenaltiesPercent: effectiveRate.toFixed(4),
    // Comprehensive cover on the CAR — reported, never charged. Four keys or none, so a
    // reader never has to decide what a premium with no rate beside it meant. Every
    // programme that states no table lands in the `else` and its breakdown is byte-identical
    // to the one it produced before this field existed.
    ...(carInsurance?.kind === 'required'
      ? {
          carInsuranceRatePercent: carInsurance.ratePercent.toFixed(4),
          carInsuranceAnnualEGP: carInsurance.annualPremiumEGP.toFixed(2),
          carInsuranceYears: carInsurance.years,
          carInsuranceTotalEGP: carInsurance.totalOverTenorEGP.toFixed(2),
        }
      : {}),
  };

  // The car's cover is DELIBERATELY absent from this sum. Everything in it is folded into
  // the booked principal by `calculateEffectiveLoanAmount` and amortised by the annuity, and
  // an annual out-of-pocket premium is neither: adding it here would raise the instalment
  // and lower the ceiling of every applicant below the deposit edge, which is the behaviour
  // this feature was specified NOT to have.
  let totalFinanced = adminFee.plus(stampDuty).plus(lifeInsuranceEGP);
  if (collateralFeeEGP) totalFinanced = totalFinanced.plus(collateralFeeEGP);

  return {
    breakdown,
    totalFinancedFeesEGP: totalFinanced.toDecimalPlaces(2, ROUND_BANKERS),
    effectiveRateAfterPenaltiesPercent: effectiveRate,
  };
}

/**
 * The car-cover lines of a breakdown, ready to spread onto a wire shape.
 *
 * ONE definition, spread by the preview and the calculator, because those two project a
 * hand-written SUBSET of the breakdown rather than passing it whole — and a disclosure that
 * an applicant sees before they apply and not after (or the other way round) is exactly the
 * preview/apply drift A33 names in terms.
 *
 * All four keys or none: a premium with no rate beside it is a figure a reader cannot check.
 */
export function carInsuranceDisclosureOf(breakdown: FeesBreakdown): {
  carInsuranceRatePercent?: string;
  carInsuranceAnnualEGP?: string;
  carInsuranceYears?: number;
  carInsuranceTotalEGP?: string;
} {
  if (
    breakdown.carInsuranceRatePercent === undefined ||
    breakdown.carInsuranceAnnualEGP === undefined ||
    breakdown.carInsuranceYears === undefined ||
    breakdown.carInsuranceTotalEGP === undefined
  ) {
    return {};
  }
  return {
    carInsuranceRatePercent: breakdown.carInsuranceRatePercent,
    carInsuranceAnnualEGP: breakdown.carInsuranceAnnualEGP,
    carInsuranceYears: breakdown.carInsuranceYears,
    carInsuranceTotalEGP: breakdown.carInsuranceTotalEGP,
  };
}
