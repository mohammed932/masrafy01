/**
 * TypeScript types mirroring the backend bank-program contract.
 * Decimals transported as canonical strings (research.md R1).
 */

export type ProgramType = 'income_proof' | 'income_surrogate';

export interface DerivationChain {
  sourceRatePercent: string;
  deltaPercent: string;
  reason: string;
}

export interface RateBandValue {
  value: string;
  derivation?: DerivationChain;
}

export type RateBandMap = Record<string, RateBandValue>;

export interface PerCurrencyBounds {
  minAmount: string;
  maxAmount: string;
}

export interface TenorConfig {
  minMonths: number;
  maxMonths: number;
  maxMonthsBySalaryCategory?: Record<string, number>;
  maxMonthsByEmploymentType?: Record<string, number>;
}

export interface LoanLimitsConfig {
  perCurrency: Record<string, PerCurrencyBounds>;
  maxByCDTier?: Array<{ minCDValueEGP: string; maxAmountEGP: string }>;
  maxByPropertyType?: Record<string, string>;
  maxByCityTier?: Record<string, string>;
  maxByTransferType?: Record<string, string>;
  maxBySalaryCategory?: Record<string, string>;
  maxByEmploymentType?: Record<string, string>;
  maxByPerformanceTier?: Record<string, string>;
  maxTopUpEGP?: string;
  ltvCeilingPercent?: string;
  qualitativeReviewMaxEGP?: string;
  otherCitiesMaxEGP?: string;
}

export interface PricingConfig {
  isVariableRate: boolean;
  baseRatePercent?: string;
  currentEffectiveRatePercent?: string;
  variableRateNote?: string;
  spreadMinPercent?: string;
  spreadMaxPercent?: string;
  rateByEmploymentType?: RateBandMap;
  rateBySeniority?: RateBandMap;
  rateByTransferType?: RateBandMap;
  rateByTenor?: RateBandMap;
  rateByTenorAndCustomerType?: RateBandMap;
  rateByDownPaymentPercent?: RateBandMap;
  rateByCustomerProgramTier?: RateBandMap;
  rateByAssetValueBand?: RateBandMap;
  rateByLoanAmountBand?: RateBandMap;
  buyoutRateDeltaPercent?: string;
  buyoutRateMinFloorPercent?: string;
  feeWaiverEnabledAtRatePercent?: string;
  feeWaiverMinTenorMonths?: number;
  feeWaiverPenaltyRatePercent?: string;
  feeWaiverPenaltyMinTenorMonths?: number;
  insuranceWaiverPenaltyRatePercent?: string;
  insuranceWaiverPenaltyMinTenorMonths?: number;
}

export interface EligibilityConfig {
  acceptedEmploymentTypes: string[];
  ageMin: number;
  ageMax: number;
  ageMinSelfEmployed?: number;
  ageMaxSelfEmployed?: number;
  minMonthlyIncomeEGP: string;
  minMonthlyIncomeSelfEmployedEGP?: string;
  minMonthsInJob: number;
  minMonthsInJobBySalaryCategory?: Record<string, number>;
  acceptedLoanPurposes: string[];
  dbrCapPercent: string;
  skipDbrCheck: boolean;
  acceptedTransferTypes: string[];
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
  minimumCreditCardHoldingMonths?: number;
  competitorCardMustBeUnsecured?: boolean;
  eligibleCarPriceMinEGP?: string;
  eligibleDownPaymentPercent?: string;
  clubClass?: string;
  compoundClass?: string;
  companyType?: string[];
  commercialBankIncomePercent?: string;
  publicBankIncomePercent?: string;
  minBankStatementBalanceEGP?: string;
  minAssetsValueEGP?: string;
}

export interface PerformanceCriteriaConfig {
  requiredMOBMonths: number;
  iScoreMOBPerformanceCheck: boolean;
  bkt1NoHitWithinMonths?: number;
  bkt2NoHitWithinMonths?: number;
  requireCurrentLoanStatus: boolean;
}

export type IncomeAssumptionStrategy =
  | 'declared'
  | 'byYearsInJob'
  | 'byYearsInPractice'
  | 'byProfessorRank'
  | 'byMilitaryGrade'
  | 'byCDValue'
  | 'byCarInstallment'
  | 'byCarLoanAmount'
  | 'byCreditCardLimit'
  | 'byBankStatementPercent';

export interface IncomeAssumptionConfig {
  strategy: IncomeAssumptionStrategy;
  incomeTable?: Array<{
    minYears?: number;
    maxYears?: number;
    minCDValueEGP?: string;
    assumedIncomeEGP?: string;
    incomeEGP?: string;
  }>;
  rankIncomeMap?: Record<string, string>;
  gradeIncomeMap?: Record<string, string>;
  cdIncomePercent?: string;
  cdIncomeMinEGP?: string;
  cdIncomePercentOfDeposits?: string;
  combinationRule?: 'lesser_of' | 'greater_of';
  carInstallmentMultiplier?: string;
  carLoanAmountPercent?: string;
  creditCardLimitMultiplier?: string;
  bankStatementPercent?: string;
}

export interface FeesConfig {
  adminFeePercent: string;
  adminFeeDisplay?: string;
  adminFeeRangeMin?: string;
  adminFeeRangeMax?: string;
  stampDutyPercent: string;
  lifeInsurancePercent: string;
  lifeInsuranceMandatory: boolean;
  lifeInsuranceMinLoanEGP?: string;
  latePaymentFeePercent: string;
  payoffCashPercent: string;
  payoffBuyoutPercent: string;
  collateralReplacementFeeEGP?: string;
  collateralDecreaseFeeEGP?: string;
}

export interface BankProgramCreatePayload {
  programCode: string;
  bankName: string;
  friendlyName: string;
  friendlyNameAr?: string;
  programType: ProgramType;
  productCategory: string;
  currencies: string[];
  operatorNotes?: string;
  operatorTips?: string[];
  requiredDocuments?: string[];
  tenor: TenorConfig;
  loanLimits: LoanLimitsConfig;
  pricing: PricingConfig;
  eligibility: EligibilityConfig;
  performanceCriteria?: PerformanceCriteriaConfig;
  incomeAssumption: IncomeAssumptionConfig;
  fees: FeesConfig;
}

export interface BankProgramUpdatePayload extends BankProgramCreatePayload {
  version: number;
}

export interface DeprecatedKeyDescriptor {
  fieldPath: string;
  key: string;
  enumerationType: string;
}

export interface BankProgramResponse {
  id: string;
  programCode: string;
  friendlyName: string;
  friendlyNameAr?: string | null;
  bankName: string;
  programType: ProgramType;
  productCategory: string;
  currencies: string[];
  active: boolean;
  version: number;
  operatorNotes?: string | null;
  operatorTips: string[];
  requiredDocuments: string[];
  tenor: TenorConfig;
  loanLimits: LoanLimitsConfig;
  pricing: PricingConfig;
  eligibility: EligibilityConfig;
  performanceCriteria?: PerformanceCriteriaConfig | null;
  incomeAssumption: IncomeAssumptionConfig;
  fees: FeesConfig;
  deprecatedKeys: DeprecatedKeyDescriptor[];
  createdAt: string;
  updatedAt: string;
}

export interface BankProgramListRow {
  id: string;
  programCode: string;
  friendlyName: string;
  bankName: string;
  productCategory: string;
  active: boolean;
  currencies: string[];
  baseRatePercent?: string | null;
  currentEffectiveRatePercent?: string | null;
  deprecatedKeyCount: number;
  version: number;
  updatedAt: string;
}

export interface ListBankProgramsQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  bankName?: string;
  active?: boolean;
  productCategory?: string;
  employmentType?: string;
}
