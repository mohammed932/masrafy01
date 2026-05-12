/**
 * Adapter between the matching engine's ApplicantProfile and the feat-002
 * cascade evaluator's ApplicantContext.
 *
 * The cascade evaluator is the SINGLE source of truth for the frozen pricing,
 * loan-limit, and tenor cascade orders (FR-008b/c/d). The engine MUST consume it
 * directly — do not re-derive cascade order anywhere else.
 */

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

export function buildApplicantContext(profile: ApplicantProfile): ApplicantContext {
  const downPaymentPercent = computeDownPaymentPercent(profile);
  return {
    employmentType: profile.employment.employmentType,
    transferType: profile.employment.salaryTransferType,
    salaryCategory: profile.employment.companyType,
    loanPurpose: profile.loanPurpose,
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
    requestedCurrency: profile.requestedCurrency,
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
  const loanLimit = evaluateLoanLimit(config, ctx, profile.requestedCurrency);

  return {
    pricing,
    tenor,
    loanLimit,
    steps: [...pricing.trace, ...tenor.trace, ...loanLimit.trace],
  };
}

function computeDownPaymentPercent(profile: ApplicantProfile): number | undefined {
  const m = profile.mortgageDetails;
  if (m && Number(m.propertyValueEGP.toString()) > 0) {
    return (Number(m.downPaymentEGP.toString()) / Number(m.propertyValueEGP.toString())) * 100;
  }
  const c = profile.carDetails;
  if (c && Number(c.carValueEGP.toString()) > 0) {
    return (Number(c.downPaymentEGP.toString()) / Number(c.carValueEGP.toString())) * 100;
  }
  return undefined;
}
