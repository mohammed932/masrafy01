/**
 * Adapter between the matching engine's ApplicantProfile and the feat-002
 * cascade evaluator's ApplicantContext.
 *
 * The cascade evaluator is the SINGLE source of truth for the frozen pricing,
 * loan-limit, and tenor cascade orders (FR-008b/c/d). The engine MUST consume it
 * directly — do not re-derive cascade order anywhere else.
 */

import { Decimal } from '@prisma/client/runtime/library';

import type { ApplicantProfile, BankProgramSnapshot } from '../types';
import type {
  ApplicantContext,
  CascadeTraceStep,
  PricingResult,
  TenorResult,
  LoanLimitResult,
} from '../../bank-programs/cascade/cascade.types';
import {
  evaluatePricing,
  evaluateLoanLimit,
  evaluateTenor,
  type BankProgramConfig,
} from '../../bank-programs/cascade/cascade.evaluator';
import { coarseEmploymentType } from './employment-type';

export function buildApplicantContext(profile: ApplicantProfile): ApplicantContext {
  const downPaymentPercent = computeDownPaymentPercent(profile);
  return {
    employmentType: coarseEmploymentType(profile.employment.employmentType),
    transferType: profile.employment.salaryTransferType,
    propertyType: profile.mortgageDetails?.propertyType,
    seniorityYears: Math.floor(profile.employment.monthsInJob / 12),
    tenorMonths: profile.preferredTenorMonths,
    downPaymentPercent,
    assetValueEGP: profile.assets.declaredAssetsValueEGP
      ? Number(profile.assets.declaredAssetsValueEGP.toString())
      : undefined,
    loanAmountEGP: Number(profile.requestedAmountEGP.toString()),
    ageYears: profile.age,
    monthlyIncomeEGP: Number(profile.employment.monthlyNetSalaryEGP.toString()),
    monthsInJob: profile.employment.monthsInJob,
    bankStatementBalanceEGP: profile.assets.bankStatementBalanceEGP
      ? Number(profile.assets.bankStatementBalanceEGP.toString())
      : undefined,
    assetsValueEGP: profile.assets.declaredAssetsValueEGP
      ? Number(profile.assets.declaredAssetsValueEGP.toString())
      : undefined,
  };
}

export function toCascadeConfig(snapshot: BankProgramSnapshot): BankProgramConfig {
  return {
    pricing: snapshot.pricing,
    loanLimits: snapshot.loanLimits,
    tenor: snapshot.tenor,
    eligibility: {
      requiresQualitativeReview: snapshot.eligibility.requiresQualitativeReview,
      requiresNoDocuments: snapshot.eligibility.requiresNoDocuments,
      minBankStatementBalanceEGP: snapshot.eligibility.minBankStatementBalanceEGP,
      minAssetsValueEGP: snapshot.eligibility.minAssetsValueEGP,
    },
  };
}

export interface CascadeBundle {
  pricing: PricingResult;
  tenor: TenorResult;
  loanLimit: LoanLimitResult;
  steps: CascadeTraceStep[];
}

export function runCascade(
  snapshot: BankProgramSnapshot,
  profile: ApplicantProfile,
): CascadeBundle {
  const config = toCascadeConfig(snapshot);
  const ctx = buildApplicantContext(profile);

  const pricing = evaluatePricing(config, ctx);
  const tenor = evaluateTenor(config, ctx);
  const loanLimit = evaluateLoanLimit(config, ctx);

  return {
    pricing,
    tenor,
    loanLimit,
    steps: [...pricing.trace, ...tenor.trace, ...loanLimit.trace],
  };
}

/**
 * The applicant's down payment as a percentage of what they are buying.
 *
 * Computed in `Decimal` and converted ONCE at the boundary: `ApplicantContext` is a
 * `number`-typed structure by design (the cascade compares band edges), but the ratio itself
 * is money divided by money and was the only float arithmetic left in the pipeline
 * (Principle I / A3). Four decimals is finer than any band edge a sheet prints.
 */
function computeDownPaymentPercent(profile: ApplicantProfile): number | undefined {
  const m = profile.mortgageDetails;
  if (m && m.propertyValueEGP.greaterThan(0)) {
    return ratioPercent(m.downPaymentEGP, m.propertyValueEGP);
  }
  const c = profile.carDetails;
  if (c && c.carValueEGP.greaterThan(0)) {
    return ratioPercent(c.downPaymentEGP, c.carValueEGP);
  }
  return undefined;
}

function ratioPercent(part: Decimal, whole: Decimal): number {
  return part.div(whole).mul(100).toDecimalPlaces(4, Decimal.ROUND_HALF_EVEN).toNumber();
}
