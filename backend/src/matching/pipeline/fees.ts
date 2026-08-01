/**
 * Fees calculator — pure function.
 * Computes admin fee, stamp duty, life insurance, and applies waiver-penalty rates
 * onto the effective interest rate (FR-027c, edge case "fee-waiver stacking").
 */

import { Decimal } from '@prisma/client/runtime/library';
import type { FeesBreakdown, FeesConfig } from '../types';

const ROUND_BANKERS = Decimal.ROUND_HALF_EVEN;

export interface FeesInput {
  requestedAmountEGP: Decimal;
  effectiveLoanAmountEGP: Decimal;
  annualRatePercent: Decimal;
  tenorMonths: number;
  loanPurpose: string;
  collateralized: boolean;
}

export interface FeesOutput {
  breakdown: FeesBreakdown;
  totalFinancedFeesEGP: Decimal;
  effectiveRateAfterPenaltiesPercent: Decimal;
}

export function calculateFees(config: FeesConfig, input: FeesInput): FeesOutput {
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
  };

  let totalFinanced = adminFee.plus(stampDuty).plus(lifeInsuranceEGP);
  if (collateralFeeEGP) totalFinanced = totalFinanced.plus(collateralFeeEGP);

  return {
    breakdown,
    totalFinancedFeesEGP: totalFinanced.toDecimalPlaces(2, ROUND_BANKERS),
    effectiveRateAfterPenaltiesPercent: effectiveRate,
  };
}
