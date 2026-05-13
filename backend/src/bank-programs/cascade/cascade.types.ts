/**
 * Cascade evaluator types + frozen-order constants.
 * Pure module — NO NestJS DI, NO Prisma, NO HTTP. The matching engine + the admin
 * what-if-preview both consume the SAME function; the frozen orders prevent drift.
 *
 * Spec anchors:
 *   FR-008a — single source per dimension (no compose / blend)
 *   FR-008b — pricing cascade order (FROZEN)
 *   FR-008c — loan-limit cascade order (FROZEN)
 *   FR-008d — tenor cascade order (FROZEN)
 *   FR-008e — order frozen at platform level — reorder = constitution amendment
 *   FR-008o.1 — down-payment band floor-to-≤
 *   FR-008p.1 — asset-value / loan-amount band floor-to-≤
 *   FR-005c.1 — wealth-gate AND combination
 *   FR-003a   — qualitativeReviewMaxEGP per-offer ceiling lift (NOT a cascade tier)
 *
 * Research:
 *   R2 — pure module, frozen order, deterministic, returns trace[]
 *   R15 — Vitest suite covers the floor-to-≤ + AND + uplift rules
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Prisma } from '@prisma/client';

export type Decimal = Prisma.Decimal;

// --- Frozen cascade orders -------------------------------------------------

export const PRICING_CASCADE_ORDER = [
  'rateByTenor',
  'rateByTransferType',
  'rateByDownPaymentPercent',
  'rateByCustomerProgramTier',
  'rateByAssetValueBand',
  'rateByLoanAmountBand',
  'rateBySeniority',
  'rateByEmploymentType',
] as const;

export type PricingCascadeLevel =
  | (typeof PRICING_CASCADE_ORDER)[number]
  | 'baseOrCurrentEffectiveRate';

export const LOAN_LIMIT_CASCADE_ORDER = [
  'maxByCDTier',
  'maxByPropertyType',
  'maxByCityTier',
  'maxByTransferType',
  'maxBySalaryCategory',
  'maxByEmploymentType',
] as const;

export type LoanLimitCascadeLevel = (typeof LOAN_LIMIT_CASCADE_ORDER)[number] | 'maxEGP';

export const TENOR_CASCADE_ORDER = [
  'maxMonthsBySalaryCategory',
  'maxMonthsByEmploymentType',
] as const;

export type TenorCascadeLevel = (typeof TENOR_CASCADE_ORDER)[number] | 'maxMonths';

// --- Band & derivation shapes ----------------------------------------------

export interface DerivationChain {
  sourceRatePercent: string;
  deltaPercent: string;
  reason: string;
}

export interface RateBandValue {
  value: string; // canonical decimal string
  derivation?: DerivationChain;
}

// --- Applicant context (per-application input to the cascade) --------------

export interface ApplicantContext {
  employmentType?: string;
  transferType?: string;
  salaryCategory?: string;
  loanPurpose?: string;
  propertyType?: string;
  cityTier?: string;
  customerProgramTier?: string;
  performanceTier?: string;
  seniorityYears?: number;
  tenorMonths?: number;
  downPaymentPercent?: number;
  assetValueEGP?: number;
  loanAmountEGP?: number;
  ageYears?: number;
  monthlyIncomeEGP?: number;
  monthsInJob?: number;
  bankStatementBalanceEGP?: number;
  assetsValueEGP?: number;
  /** Operator-approved qualitative-review badge on the offer; if true, uplift may apply. */
  qualitativeReviewApproved?: boolean;
  /** Whether the applicant uploaded income documents (FR-005d candidate-pool gate). */
  uploadedIncomeDocuments?: boolean;
  /** Currency the applicant requested (FR-008h). */
  requestedCurrency?: string;
}

// --- Cascade trace + result -------------------------------------------------

export interface CascadeTraceStep {
  level: string;
  matched: boolean;
  value?: string;
  reason?: string;
}

export interface PricingResult {
  effectiveRatePercent: string;
  matchedLevel: PricingCascadeLevel;
  derivationChain?: DerivationChain;
  trace: CascadeTraceStep[];
}

export interface LoanLimitResult {
  maxAmount: string;
  matchedLevel: LoanLimitCascadeLevel;
  upliftApplied: boolean;
  trace: CascadeTraceStep[];
}

export interface TenorResult {
  maxMonths: number;
  matchedLevel: TenorCascadeLevel;
  trace: CascadeTraceStep[];
}
