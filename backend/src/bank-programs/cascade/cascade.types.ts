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
// TYPE-ONLY, and the direction is worth a note: `matching/types.ts` imports `RateBandValue`
// from this file, so this is a back-reference. Both edges are `import type` and are erased
// entirely at compile time, so there is no runtime cycle — and the alternative, restating
// the fact-value union structurally here, is a second definition of a discriminated union
// carrying a Decimal, which is precisely the drift this whole change is closing elsewhere.
import type { SurrogateFactValue } from '../../matching/types';

export type Decimal = Prisma.Decimal;

// --- Frozen cascade orders -------------------------------------------------

export const PRICING_CASCADE_ORDER = [
  /**
   * FR-008b.1 — the N-axis grid, and it sits at the HEAD.
   *
   * This is an ADDITION to the enumerated list, not an FR-008e reorder: it moves no existing
   * level relative to any other, and it is a provable no-op for every stored program, because
   * none declares `rateByFact` — `evaluatePricing` pushes one `not configured` trace row and
   * returns the identical rate at the identical `matchedLevel`.
   *
   * The head, because the grid SUBSUMES the dimensions below it. A down-payment x tenor grid
   * placed at the tail could be pre-empted for ever by a loan-amount band an operator added
   * on an unrelated screen, and a program that states a grid means "this grid is my price
   * book" — anything outranking it is a surprise.
   */
  'rateByFact',
  'rateByTenor',
  'rateByTransferType',
  'rateByDownPaymentPercent',
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
  'maxByTransferType',
  'maxByEmploymentType',
] as const;

export type LoanLimitCascadeLevel = (typeof LOAN_LIMIT_CASCADE_ORDER)[number] | 'maxEGP';

export const TENOR_CASCADE_ORDER = ['maxMonthsByEmploymentType'] as const;

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
  propertyType?: string;
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
  /**
   * Every surrogate fact this applicant answered, for the program being quoted.
   *
   * The cascade's fixed field list is the platform's own vocabulary — employment, transfer
   * type, seniority. A fact is the OPERATOR's, and a grid axis can name any of them, so a
   * fixed field per axis would make "the bank states its own table" a release (Principle II
   * / A1). Built by `factsForProgram`, which is per program because a derived axis like
   * `bank_relationship` is a different answer at every bank.
   */
  facts?: Readonly<Record<string, SurrogateFactValue>>;
  /** The class each list value is filed under. Only read by an axis saying `parentClass`. */
  parentKeyByValue?: Readonly<Record<string, string>>;
}

// --- Cascade trace + result -------------------------------------------------

export interface CascadeTraceStep {
  level: string;
  matched: boolean;
  value?: string;
  reason?: string;
  /**
   * Per axis, the key that matched — only a grid sets it.
   *
   * Frozen onto `bank_offer.cascadeTrace`, which is why it is here rather than derived: the
   * level NAME says nothing about which of thirty-two cells was read, the grid is edited in
   * place, and an offer has to stay explainable after the table moves (Principle I / A6).
   */
  keys?: Readonly<Record<string, string>>;
}

export interface PricingResult {
  effectiveRatePercent: string;
  matchedLevel: PricingCascadeLevel;
  derivationChain?: DerivationChain;
  trace: CascadeTraceStep[];
  /**
   * Set ONLY when a declared grid matched nothing and the bank chose `reject`.
   *
   * A rate has no safe fallback direction — see `fact-grid.ts`. Falling through to
   * `baseRatePercent` quotes a number no bank stated; over-quoting frightens the customer;
   * under-quoting is worse still, because the DBR, the affordability ceiling and the whole
   * shrink loop are measured against that instalment and every one of them is then wrong,
   * and frozen. So the refusal travels instead of a figure, and `quote.ts` turns it into a
   * stated 200-body reason with the program still listed and still ranked (Principle V/A33).
   */
  refusal?: {
    reason: 'fact_not_answered' | 'no_matching_row';
    missingFactKeys: readonly string[];
  };
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
