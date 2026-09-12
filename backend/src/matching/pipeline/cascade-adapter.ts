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
import { withGridFacts } from './car-details';
import type { SurrogateFactValue } from '../types';

/**
 * What a grid needs on top of the cascade's own fixed fields.
 *
 * `facts` is per PROGRAM (a derived axis like `bank_relationship` is a different answer at
 * every bank), which is why the caller supplies it rather than this module deriving it.
 */
export interface CascadeExtras {
  /** The term the loan is REPAID over, when it is not the one that was asked for (FR-008o.3). */
  tenorMonths?: number;
  facts?: Readonly<Record<string, SurrogateFactValue>>;
  parentKeyByValue?: Readonly<Record<string, string>>;
}

export function buildApplicantContext(
  profile: ApplicantProfile,
  extras: CascadeExtras = {},
): ApplicantContext {
  const downPaymentPercent = computeDownPaymentPercent(profile);
  const tenorMonths = extras.tenorMonths ?? profile.preferredTenorMonths;
  return {
    employmentType: coarseEmploymentType(profile.employment.employmentType),
    transferType: profile.employment.salaryTransferType,
    propertyType: profile.mortgageDetails?.propertyType,
    seniorityYears: Math.floor(profile.employment.monthsInJob / 12),
    tenorMonths,
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
    // The two derived axes are added HERE, beside the single Decimal division that produces
    // the down-payment share, so the figure a grid bands on and the figure
    // `rateByDownPaymentPercent` bands on are the same number and cannot drift (Principle I).
    facts: withGridFacts(extras.facts ?? {}, { downPaymentPercent, tenorMonths }),
    ...(extras.parentKeyByValue !== undefined ? { parentKeyByValue: extras.parentKeyByValue } : {}),
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
  /**
   * The context the three evaluators were given.
   *
   * Returned so a caller that needs the DERIVED grid facts — the down-payment share and the
   * term — reads the ones that actually priced the loan instead of computing a second set.
   * `quote.ts` needs them for the vehicle term ceiling, which is resolved between the two
   * cascade passes.
   */
  ctx: ApplicantContext;
}

/**
 * @param extras.tenorMonths the term to evaluate against, when it is not the one the
 *   applicant asked for. `rateByTenor` and a grid's tenor axis are both keyed by the term,
 *   and the term a loan is REPAID over is not always the term that was requested — the
 *   program's ceiling, its floor and the applicant's age at maturity can all move it.
 *   Pricing the requested term and repaying a clamped one quotes one loan and writes
 *   another (FR-008o.3), so `quoteProgram` resolves the term first and calls this with it.
 *
 *   `evaluateTenor` and `evaluateLoanLimit` read no term, so passing it changes only the
 *   pricing half; both are still computed here rather than split out, because the caller
 *   needs one bundle and the two are pure map lookups.
 *
 * @param extras.facts / extras.parentKeyByValue what a `rateByFact` grid reads. Omitted by a
 *   caller with no grid to serve, which is every caller of a program that states none.
 */
export function runCascade(
  snapshot: BankProgramSnapshot,
  profile: ApplicantProfile,
  extras: CascadeExtras = {},
): CascadeBundle {
  const config = toCascadeConfig(snapshot);
  const ctx = buildApplicantContext(profile, extras);

  const pricing = evaluatePricing(config, ctx);
  const tenor = evaluateTenor(config, ctx);
  const loanLimit = evaluateLoanLimit(config, ctx);

  return {
    pricing,
    tenor,
    loanLimit,
    steps: [...pricing.trace, ...tenor.trace, ...loanLimit.trace],
    ctx,
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
