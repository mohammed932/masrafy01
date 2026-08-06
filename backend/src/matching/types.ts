/**
 * Pure type definitions for the matching engine.
 * Constitution Principle V: ZERO imports from HTTP, DB, or side-effecting layers.
 * Decimal is imported from the runtime library type only (not Prisma namespace).
 */

import type { Decimal } from '@prisma/client/runtime/library';
import type {
  RateBandValue,
  DerivationChain,
  CascadeTraceStep,
  PricingCascadeLevel,
  LoanLimitCascadeLevel,
  TenorCascadeLevel,
} from '../bank-programs/cascade/cascade.types';

// ---------------------------------------------------------------------------
// Applicant Profile
// ---------------------------------------------------------------------------

export interface EmploymentProfile {
  employmentType: string;
  monthlyNetSalaryEGP: Decimal;
  monthsInJob: number;
  yearsInPractice?: number;
  professorRank?: string;
  militaryGrade?: string;
  salaryTransferType: string;
  companyName: string;
  companyType: string;
  bankCategory?: 'public' | 'commercial';
}

export interface ObligationsProfile {
  existingMonthlyObligationsEGP: Decimal;
  hasCurrentLoan: boolean;
  currentLoanRatePercent?: Decimal;
  monthsOnBookCurrentLoan?: number;
  bkt1HitWithinMonths?: number;
  bkt2HitWithinMonths?: number;
  hasPreviousRejection: boolean;
}

export interface AssetsProfile {
  cdAtABKValueEGP?: Decimal;
  totalDepositsAtABKValueEGP?: Decimal;
  bankStatementBalanceEGP?: Decimal;
  declaredAssetsValueEGP?: Decimal;
  creditCardLimitEGP?: Decimal;
  autoLoanAtOtherBankEGP?: Decimal;
  autoLoanAtABKEGP?: Decimal;
  carInstallmentEGP?: Decimal;
  ownsCompoundProperty?: boolean;
  clubMembership?: boolean;
}

export interface MortgageDetails {
  propertyValueEGP: Decimal;
  downPaymentEGP: Decimal;
  propertyType: string;
  isCompound: boolean;
  constructionStage: string;
}

export interface CarDetails {
  carValueEGP: Decimal;
  downPaymentEGP: Decimal;
}

export interface ApplicantProfile {
  age: number;
  loanPurpose: string;
  requestedAmountEGP: Decimal;
  requestedCurrency: string;
  preferredTenorMonths: number;
  priority: ApplicationPriority;
  nationalId?: string;
  employment: EmploymentProfile;
  obligations: ObligationsProfile;
  assets: AssetsProfile;
  mortgageDetails?: MortgageDetails;
  carDetails?: CarDetails;
}

// ---------------------------------------------------------------------------
// Bank Program snapshot (read-only input from feature 002 JSONB)
// ---------------------------------------------------------------------------

export type RateBandMap = Record<string, RateBandValue>;

export interface PricingConfig {
  isVariableRate: boolean;
  baseRatePercent?: string;
  currentEffectiveRatePercent?: string;
  rateByEmploymentType?: RateBandMap;
  rateBySeniority?: RateBandMap;
  rateByTransferType?: RateBandMap;
  rateByTenor?: RateBandMap;
  rateByDownPaymentPercent?: RateBandMap;
  rateByAssetValueBand?: RateBandMap;
  rateByLoanAmountBand?: RateBandMap;
}

export interface LoanLimitsConfig {
  perCurrency: Record<string, { minAmount: string; maxAmount: string }>;
  amountStepEGP?: string;
  maxByCDTier?: Array<{ minCDValueEGP: string; maxAmountEGP: string }>;
  maxByPropertyType?: Record<string, string>;
  maxByTransferType?: Record<string, string>;
  maxByEmploymentType?: Record<string, string>;
  qualitativeReviewMaxEGP?: string;
}

export interface TenorConfig {
  minMonths: number;
  maxMonths: number;
  maxMonthsByEmploymentType?: Record<string, number>;
}

export interface EligibilityConfig {
  acceptedEmploymentTypes: string[];
  minAge: number;
  maxAge: number;
  selfEmployedMinAge?: number;
  selfEmployedMaxAge?: number;
  minMonthlyIncomeEGP: string;
  selfEmployedMinMonthlyIncomeEGP?: string;
  minMonthsInJob: number;
  acceptedSalaryTransferTypes: string[];
  /** Decimal string (0…100). Arrives from JSONB as a string — never a float. */
  dbrCapPercent: string;
  skipDbrCheck: boolean;
  requiresCD: boolean;
  requiresAutoLoanAtABK: boolean;
  requiresAutoLoanAtOtherBank: boolean;
  requiresCreditCardAtOtherBank: boolean;
  requiresCompoundProperty: boolean;
  requiresCollateral: boolean;
  requiresClubMembership: boolean;
  requiresExistingLoan: boolean;
  requiresFRMUVerification: boolean;
  requiresQualitativeReview: boolean;
  requiresNoDocuments: boolean;
  minBankStatementBalanceEGP?: string;
  minAssetsValueEGP?: string;
  commercialBankIncomePercent?: string;
  publicBankIncomePercent?: string;
  companyType?: string[];
  minimumCreditCardHoldingMonths?: number;
  competitorCardMustBeUnsecured?: boolean;
  /** Feature 010 — optional income-band table, resolved against the same income
   *  figure every other quote figure uses (see `quoteProgram` step 3). */
  dbrBands?: DbrBand[];
}

/**
 * Feature 010 — banded debt-burden ratio.
 *
 * Sits beside the scalar `dbrCapPercent`, never replacing it: a program with no
 * `dbrBands` keeps behaving exactly as before (FR-020). Upper bounds are
 * INCLUSIVE and the final band carries `upToIncomeEGP: null` (open-ended).
 * Authored per bank program: `bank_program.eligibility` is the only source
 * matching reads.
 */
export interface DbrBand {
  /** Inclusive upper bound of the band; `null` marks the open-ended final band. */
  upToIncomeEGP: string | null;
  /** Decimal string, 1…100. */
  capPercent: string;
}

export interface DbrSetting {
  dbrCapPercent: string;
  dbrBands?: DbrBand[];
}

export interface PerformanceCriteriaConfig {
  requiredMOBMonths?: number;
  bkt1NoHitWithinMonths?: number;
  bkt2NoHitWithinMonths?: number;
  requireCurrentLoanStatus?: string;
}

export type IncomeAssumptionStrategy =
  | 'declared'
  | 'byYearsInJob'
  | 'byYearsInPractice'
  | 'byProfessorRank'
  | 'byMilitaryGrade'
  | 'byCDValue'
  | 'byTotalDeposits'
  | 'byCarInstallment'
  | 'byCarLoanAmount'
  | 'byCreditCardLimit'
  | 'byBankStatementPercent';

export interface IncomeAssumptionConfig {
  strategy: IncomeAssumptionStrategy;
  incomeTable?: Array<{ minYears: number; maxYears: number; incomeEGP: string }>;
  rankIncomeMap?: Record<string, string>;
  gradeIncomeMap?: Record<string, string>;
  cdIncomePercent?: string;
  cdIncomePercentOfDeposits?: string;
  cdIncomeMinEGP?: string;
  bankStatementPercent?: string;
  carInstallmentMultiplier?: string;
  carLoanAmountPercent?: string;
  creditCardLimitMultiplier?: string;
  combinationRule?: 'lesser_of' | 'greater_of';
}

export interface FeesConfig {
  adminFeePercent: string;
  adminFeeMinEGP?: string;
  adminFeeMaxEGP?: string;
  /**
   * Flat stamp duty in EGP. Optional because no writer has ever set it — the
   * admin DTO writes `stampDutyPercent`, which is why stamp duty read `0.00` on
   * every offer produced before feature 010. Both are now honoured; see
   * `calculateFees`.
   */
  stampDutyEGP?: string;
  /** Stamp duty as a percent of the REQUESTED principal (never the fee-inflated one). */
  stampDutyPercent?: string;
  lifeInsurancePercent?: string;
  lifeInsuranceMinLoanEGP?: string;
  latePaymentFeePercent?: string;
  collateralFeeEGP?: string;
  feeWaiverEnabledAtRatePercent?: string;
  feeWaiverMinTenorMonths?: number;
  feeWaiverPenaltyRatePercent?: string;
  feeWaiverPenaltyMinTenorMonths?: number;
  insuranceWaiverPenaltyRatePercent?: string;
  insuranceWaiverPenaltyMinTenorMonths?: number;
}

export interface DeprecatedKeyWarning {
  enumerationType: string;
  deprecatedKey: string;
}

export interface BankProgramSnapshot {
  id: string;
  programCode: string;
  bankName: string;
  /** Phase-1 spec: partner bank flag. Used by ranking as a final tiebreaker
   *  so identical primary-sort-key offers from featured banks rank first. */
  bankIsFeatured: boolean;
  friendlyName: string;
  programType: string;
  productCategory: string;
  currencies: string[];
  active: boolean;
  /** Islamic-finance program. Carried onto every offer so the badge cannot go stale. */
  isShariaCompliant: boolean;
  version: number;
  requiredDocuments: string[];
  createdAt: Date;

  tenor: TenorConfig;
  loanLimits: LoanLimitsConfig;
  pricing: PricingConfig;
  eligibility: EligibilityConfig;
  performanceCriteria?: PerformanceCriteriaConfig;
  incomeAssumption: IncomeAssumptionConfig;
  fees: FeesConfig;

  deprecatedKeys?: DeprecatedKeyWarning[];
}

// ---------------------------------------------------------------------------
// Match Result (engine output)
// ---------------------------------------------------------------------------

export interface CascadeTrace {
  matchedPricingLevel: PricingCascadeLevel;
  matchedTenorLevel: TenorCascadeLevel;
  matchedLoanLimitLevel: LoanLimitCascadeLevel;
  pricingDerivation?: DerivationChain;
  steps: CascadeTraceStep[];
}

export interface FeesBreakdown {
  adminFeeEGP: string;
  adminFeeWaived: boolean;
  stampDutyEGP: string;
  lifeInsuranceEGP: string;
  lifeInsuranceWaived?: boolean;
  collateralFeeEGP?: string;
  feeWaiverPenaltyRatePercent?: string;
  insuranceWaiverPenaltyRatePercent?: string;
  effectiveRateAfterPenaltiesPercent: string;
}

export interface Offer {
  bankName: string;
  /** Mirror of the snapshot's `bankIsFeatured` — surfaced on the offer DTO so
   *  the mobile app can render a "FEATURED" chip without a second lookup. */
  bankIsFeatured: boolean;
  /** Mirror of the snapshot's `isShariaCompliant`, frozen at match time so the
   *  Islamic-finance chip on an old offer reflects the program as it then was. */
  isShariaCompliant: boolean;
  programFriendlyName: string;
  programCode: string;
  programVersion: number;
  effectiveRatePercent: Decimal;
  monthlyInstallmentEGP: Decimal;
  requestedLoanAmountEGP: Decimal;
  effectiveLoanAmountEGP: Decimal;
  requestedTenorMonths: number;
  effectiveTenorMonths: number;
  feesBreakdown: FeesBreakdown;
  /** Legacy flat percentage kept in sync with `approvalProbability.score` for feature-003 readers. */
  approvalProbabilityPercent: number;
  /** Structured probability (feature 004). Engine version stamp added by the orchestrator. */
  approvalProbability: ApprovalProbabilityResult;
  requiredDocuments: string[];
  matchReasons: string[];
  cascadeTrace: CascadeTrace;
  currency: string;
  qualitativeReviewBadge: boolean;
  selfDeclared: boolean;
  /**
   * The applicant's borrowing ceiling at this program — see
   * `Quote.maxAffordableAmountEGP`. Present on every offer, not only DBR-reduced
   * ones. Compare against `effectiveLoanAmountEGP` to tell "this is all you can
   * get" apart from "you asked for less than you could have".
   */
  maxLoanAvailableEGP?: Decimal;
  /** Debt-burden ratio for this offer, percent (0..100). Surfaced so the
   *  per-bank weighted scorer can feed the COMPUTED `debt_burden` factor
   *  without re-deriving it (Principle V v4.1.0). */
  dbrPercent: Decimal;
  /** The cap `dbrPercent` was measured against — scalar or the matched band. */
  dbrCapPercent: Decimal;
  /** Which band resolved; `null` when the program uses the scalar cap. */
  dbrBandIndex: number | null;
}

export interface MatchResult {
  programCode: string;
  programVersion: number;
  eligible: boolean;
  passedChecks: string[];
  failedChecks: string[];
  offer?: Offer;
  /**
   * The quote the offer was built from (feature 010). Carried so the apply path
   * can persist the resolved DBR band + cap without recomputing them, and so
   * preview can serialise figures without a second engine pass.
   */
  quote?: Quote;
  /**
   * Set instead of `quote` when the program could not be priced. Carried so the
   * surface can LIST the program with an explanation rather than dropping it —
   * dropping it would make DBR a hard filter, which A33 forbids.
   */
  unavailable?: QuoteUnavailable;
}

export interface Suggestion {
  code: string;
  magnitude: number;
  programsUnlocked: number;
  suggestedValue?: string;
}

export interface NoMatchDetail {
  programCode: string;
  failedChecks: string[];
}

// ---------------------------------------------------------------------------
// Feature 010 — Quote (one program + one applicant → the figures a customer sees)
// ---------------------------------------------------------------------------

/**
 * Why the offered amount / tenor is what it is (FR-023). `requested_amount`
 * means nothing reduced the ask.
 */
export const BINDING_CONSTRAINTS = [
  'requested_amount',
  'program_max',
  'dbr_affordability',
  'tenor_max',
  'age_at_maturity',
] as const;

export type BindingConstraint = (typeof BINDING_CONSTRAINTS)[number];

/**
 * Why a listed program carries no figures (FR-024). Returned inside a 200
 * response — the program is still listed and still scored. Mirrors the reason
 * codes in `common/errors/error-codes.ts`.
 */
export const FIGURES_UNAVAILABLE_REASONS = [
  'NO_RECOGNISED_INCOME',
  'OBLIGATIONS_EXCEED_ALLOWANCE',
  'BELOW_PROGRAM_MIN_AMOUNT',
  'AGE_AT_MATURITY',
  'CURRENCY_NOT_OFFERED',
  'PROGRAM_MISCONFIGURED',
] as const;

export type FiguresUnavailableReason = (typeof FIGURES_UNAVAILABLE_REASONS)[number];

/**
 * Pure return value of `quoteProgram()`. Never persisted as-is: the apply path
 * copies it onto an immutable `BankOffer` (Principle I), preview and the
 * calculator serialise it as decimal strings at the API boundary.
 */
export interface Quote {
  /** After program max + DBR affordability. */
  offeredAmountEGP: Decimal;
  /** Offered amount − financed fees: what the customer actually receives. */
  cashToCustomerEGP: Decimal;
  /** Admin + insurance + stamp duty (+ collateral). */
  totalFeesEGP: Decimal;
  /** Computed on offered amount PLUS financed fees (FR-022a). */
  monthlyInstallmentEGP: Decimal;
  /** After the program tenor cap and age-at-maturity shortening. */
  effectiveTenorMonths: number;
  /** After fee / insurance waiver penalties. */
  effectiveRatePercent: Decimal;
  /** installment × effectiveTenorMonths. */
  totalPayableEGP: Decimal;
  /** totalPayable − cashToCustomer. */
  totalCostOfCreditEGP: Decimal;
  /** (installment + existing obligations) ÷ recognised income × 100. */
  dbrPercent: Decimal;
  /** Resolved cap — scalar or the band that matched. */
  dbrCapPercent: Decimal;
  /** Which band resolved; `null` when the program uses the scalar cap. */
  dbrBandIndex: number | null;
  /**
   * The largest principal this applicant could borrow from this program at the
   * effective tenor and rate, INDEPENDENT of what they asked for:
   *
   *   maxEMI = income × dbrCap ÷ 100 − existing obligations
   *   max    = maxEMI × ((1+r)^n − 1) ÷ (r × (1+r)^n)      (r = 0 → maxEMI × n)
   *
   * Still clamped by the program ceiling and floored to the amount step. This is
   * a headroom figure, not an offer: `offeredAmountEGP` never exceeds the ask.
   * Zero means the existing obligations already consume the whole allowance.
   */
  maxAffordableAmountEGP: Decimal;
  bindingConstraint: BindingConstraint;
  /** The income every figure above keys off (see `quoteProgram` step 3). */
  recognisedIncomeEGP: Decimal;
  /** Itemised, always — fees are never folded in silently (FR-031). */
  feesBreakdown: FeesBreakdown;
  currency: string;
  cascadeTrace: CascadeTrace;
}

/**
 * A program that could not be quoted, with the reason. The program is still
 * LISTED — this is a "no figures" outcome, never a filter (Principle V / A33).
 */
export interface QuoteUnavailable {
  reason: FiguresUnavailableReason;
  /** Populated when `reason` is `PROGRAM_MISCONFIGURED`: the missing setting paths. */
  missing?: string[];
  /**
   * Populated for the affordability reasons (`OBLIGATIONS_EXCEED_ALLOWANCE`,
   * `BELOW_PROGRAM_MIN_AMOUNT`), where the applicant IS priceable — there is
   * simply no room left. Lets the surface say "your ceiling here is X against a
   * cap of Y" instead of showing an unexplained blank.
   */
  maxAffordableAmountEGP?: Decimal;
  dbrCapPercent?: Decimal;
  dbrBandIndex?: number | null;
  recognisedIncomeEGP?: Decimal;
}

export type QuoteOutcome =
  | { ok: true; quote: Quote }
  | { ok: false; unavailable: QuoteUnavailable };

export const APPLICATION_PRIORITIES = [
  'lowest_installment',
  'lowest_interest',
  'fastest_approval',
  'least_paperwork',
] as const;

export type ApplicationPriority = (typeof APPLICATION_PRIORITIES)[number];

// ---------------------------------------------------------------------------
// Feature 004 — Structured approval probability + scoring config
// ---------------------------------------------------------------------------

export const APPROVAL_TIERS = ['excellent', 'good', 'moderate', 'low', 'very_low'] as const;
export type ApprovalTier = (typeof APPROVAL_TIERS)[number];

export interface FactorImpact {
  /** Stable factor code resolved against the offer's `engineVersion.weightsConfig.factorCatalog`. */
  code: string;
  /**
   * Which question this impact came from. `code` alone is ambiguous for a single
   * pick: it is the OPTION code, and option codes are unique only WITHIN their
   * question — half the pool has a `yes`. Without this, a reader cannot tell two
   * `yes` rows apart, and labelling them by option code alone silently prints one
   * question's wording on another question's row. Optional: absent on offers
   * persisted before it existed.
   */
  questionCode?: string;
  /** Signed integer. Positive entries strictly > 0; negative entries strictly < 0. */
  impact: number;
}

export interface ApprovalFactors {
  positive: FactorImpact[];
  negative: FactorImpact[];
  /** Set true only on backfilled offers (engineVersion='1.0.0-legacy'). */
  legacy?: boolean;
}

export interface ApprovalProbabilityResult {
  score: number;
  tier: ApprovalTier;
  factors: ApprovalFactors;
  /**
   * The program had no ACTIVE `ScoringWeightSet`, so this score is 0 for want of
   * configuration — not because the applicant fits badly. Surfaces as "Not
   * rated" rather than `very_low`; the two are otherwise indistinguishable.
   */
  usedDefault?: boolean;
}

export interface ScoringThresholds {
  excellent: number;
  good: number;
  moderate: number;
  low: number;
}

export interface FactorCatalogEntry {
  labelAr: string;
  labelEn: string;
}

export type FactorCatalog = Record<string, FactorCatalogEntry>;

/**
 * Pure value object passed into the engine by the orchestrator. The engine
 * MUST NOT import from `src/scoring-versions/` — the adapter in
 * `src/applications/adapters/` is the single bridge (Constitution Principle V).
 */
export interface ScoringConfig {
  version: string;
  weights: Record<string, number>;
  thresholds: ScoringThresholds;
  factorCatalog: FactorCatalog;
  legacy: boolean;
}
