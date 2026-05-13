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
  isGuest: boolean;
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
  rateByCustomerProgramTier?: RateBandMap;
  rateByAssetValueBand?: RateBandMap;
  rateByLoanAmountBand?: RateBandMap;
  buyoutRateDeltaPercent?: string;
  buyoutRateMinFloorPercent?: string;
}

export interface LoanLimitsConfig {
  perCurrency: Record<string, { minAmount: string; maxAmount: string }>;
  amountStepEGP?: string;
  maxByCDTier?: Array<{ minCDValueEGP: string; maxAmountEGP: string }>;
  maxByPropertyType?: Record<string, string>;
  maxByCityTier?: Record<string, string>;
  maxByTransferType?: Record<string, string>;
  maxBySalaryCategory?: Record<string, string>;
  maxByEmploymentType?: Record<string, string>;
  qualitativeReviewMaxEGP?: string;
}

export interface TenorConfig {
  minMonths: number;
  maxMonths: number;
  maxMonthsBySalaryCategory?: Record<string, number>;
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
  acceptedLoanPurposes: string[];
  acceptedSalaryTransferTypes: string[];
  dbrCapPercent: number;
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
  stampDutyEGP: string;
  lifeInsurancePercent?: string;
  lifeInsuranceMinLoanEGP?: string;
  latePaymentFeePercent?: string;
  earlyPayoffFeePercent?: string;
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
  friendlyName: string;
  programType: string;
  productCategory: string;
  currencies: string[];
  active: boolean;
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
  maxLoanAvailableEGP?: Decimal;
}

export interface MatchResult {
  programCode: string;
  programVersion: number;
  eligible: boolean;
  passedChecks: string[];
  failedChecks: string[];
  offer?: Offer;
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
