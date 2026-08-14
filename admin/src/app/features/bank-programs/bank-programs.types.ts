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
  maxMonthsByEmploymentType?: Record<string, number>;
}

export interface LoanLimitsConfig {
  perCurrency: Record<string, PerCurrencyBounds>;
  maxByCDTier?: Array<{ minCDValueEGP: string; maxAmountEGP: string }>;
  maxByPropertyType?: Record<string, string>;
  maxByTransferType?: Record<string, string>;
  maxByEmploymentType?: Record<string, string>;
  maxTopUpEGP?: string;
  ltvCeilingPercent?: string;
  minDownPaymentPercent?: string;
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
  rateByAssetValueBand?: RateBandMap;
  rateByLoanAmountBand?: RateBandMap;
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
  dbrCapPercent: string;
  /**
   * Feature 010 (FR-016) — optional income-band table that overrides the flat
   * cap. Ordered, inclusive upper bounds, final band open-ended (`null`).
   */
  dbrBands?: DbrBand[];
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

export const INCOME_ASSUMPTION_STRATEGIES = [
  'declared',
  'byYearsInJob',
  'byYearsInPractice',
  'byProfessorRank',
  'byMilitaryGrade',
  'byCDValue',
  'byTotalDeposits',
  'byCarInstallment',
  'byCarLoanAmount',
  'byCreditCardLimit',
  'byBankStatementPercent',
] as const;

export type IncomeAssumptionStrategy = (typeof INCOME_ASSUMPTION_STRATEGIES)[number];

/** One method as the picker and the review read-back render it. */
export interface IncomeMethodOption {
  value: IncomeAssumptionStrategy;
  label: string;
}

export interface IncomeMethodGroup {
  label: string;
  options: IncomeMethodOption[];
}

function methodLabel(strategy: IncomeAssumptionStrategy): string {
  switch (strategy) {
    case 'declared':
      return $localize`:@@bank_programs.strategy.declared:Declared (applicant-provided)`;
    case 'byYearsInJob':
      return $localize`:@@bank_programs.strategy.years_job:By years in job`;
    case 'byYearsInPractice':
      return $localize`:@@bank_programs.strategy.years_practice:By years in practice`;
    case 'byProfessorRank':
      return $localize`:@@bank_programs.strategy.professor_rank:By academic rank`;
    case 'byMilitaryGrade':
      return $localize`:@@bank_programs.strategy.military_grade:By military grade`;
    case 'byCDValue':
      return $localize`:@@bank_programs.strategy.cd_value:By certificate value`;
    case 'byTotalDeposits':
      return $localize`:@@bank_programs.strategy.total_deposits:By total deposits`;
    case 'byCarInstallment':
      return $localize`:@@bank_programs.strategy.car_installment:By car installment`;
    case 'byCarLoanAmount':
      return $localize`:@@bank_programs.strategy.car_loan_amount:By car loan amount`;
    case 'byCreditCardLimit':
      return $localize`:@@bank_programs.strategy.credit_card_limit:By credit card limit`;
    case 'byBankStatementPercent':
      return $localize`:@@bank_programs.strategy.bank_statement:By bank statement percent`;
  }
}

/** The label for one method — same words the picker shows, for the review read-back. */
export function incomeMethodLabel(strategy: IncomeAssumptionStrategy): string {
  return methodLabel(strategy);
}

/**
 * The eleven methods, grouped by what they actually READ.
 *
 * Eleven flat options was the weakest control in the wizard: nothing on screen separated
 * the four that read an answer the customer gave — the only ones whose fact can be missing,
 * and the only ones the binding line can check — from the six that read a figure off a
 * document, or from `declared`, which reads nothing and is not really a rule at all.
 *
 * Built here rather than typed into the template so this list and the review read-back
 * cannot disagree about a method's name.
 */
export function incomeMethodGroups(): IncomeMethodGroup[] {
  const opts = (values: readonly IncomeAssumptionStrategy[]): IncomeMethodOption[] =>
    values.map((value) => ({ value, label: methodLabel(value) }));
  return [
    {
      label: $localize`:@@bank_programs.strategy.group.asked:Reads an answer the customer gives`,
      options: opts([
        'byMilitaryGrade',
        'byProfessorRank',
        'byYearsInPractice',
        'byCreditCardLimit',
      ]),
    },
    {
      label: $localize`:@@bank_programs.strategy.group.documents:Reads a figure from documents`,
      options: opts([
        'byYearsInJob',
        'byCDValue',
        'byTotalDeposits',
        'byCarInstallment',
        'byCarLoanAmount',
        'byBankStatementPercent',
      ]),
    },
    {
      label: $localize`:@@bank_programs.strategy.group.none:No rule`,
      options: opts(['declared']),
    },
  ];
}

/** Which editor a method needs. Drives the type-driven rendering in step 3. */
export type IncomeMethodShape = 'none' | 'keyTable' | 'bands' | 'scalar';

/**
 * The shape each method is configured with, mirroring the backend's own grouping.
 *
 * `byCDValue` / `byTotalDeposits` are `bands` here even though the backend accepts a
 * legacy scalar for them: the editor offers the band table (the shape an admin should
 * author now), and a legacy scalar arrives already normalized into `scalar`, which the
 * section still renders so an untouched legacy program is readable and its value is
 * never silently dropped.
 */
export const INCOME_METHOD_SHAPE: Readonly<Record<IncomeAssumptionStrategy, IncomeMethodShape>> = {
  declared: 'none',
  byProfessorRank: 'keyTable',
  byMilitaryGrade: 'keyTable',
  byYearsInJob: 'bands',
  byYearsInPractice: 'bands',
  byCDValue: 'bands',
  byTotalDeposits: 'bands',
  byCarInstallment: 'scalar',
  byCarLoanAmount: 'scalar',
  byCreditCardLimit: 'scalar',
  byBankStatementPercent: 'scalar',
};

/** The platform enumeration a key method draws its row keys from (FR-006). */
export const INCOME_KEY_REGISTRY: Readonly<
  Partial<Record<IncomeAssumptionStrategy, 'professor_rank' | 'military_grade'>>
> = {
  byProfessorRank: 'professor_rank',
  byMilitaryGrade: 'military_grade',
};

/** The unit a band table's edges are expressed in — label only, never arithmetic. */
export const INCOME_BAND_UNIT: Readonly<Partial<Record<IncomeAssumptionStrategy, 'years' | 'EGP'>>> =
  {
    byYearsInJob: 'years',
    byYearsInPractice: 'years',
    byCDValue: 'EGP',
    byTotalDeposits: 'EGP',
  };

/** One row of a key table: a registry member and the income the bank assigns it. */
export interface IncomeKeyTableRow {
  key: string;
  /** Decimal string, > 0. */
  incomeEGP: string;
}

/**
 * One income band, half-open `[fromInclusive, toExclusive)`; `toExclusive: null`
 * is the open-ended last band.
 *
 * Unlike the numeric SCORE bands, the FIRST edge is real and editable: a bank's
 * value table may legitimately start above zero, and below that floor the rule
 * yields a stated reason rather than a zero.
 */
export interface IncomeBand {
  fromInclusive: string;
  toExclusive: string | null;
  incomeEGP: string;
}

/**
 * The CANONICAL income rule (FR-014). The backend normalizes on read, so the form
 * never sees a legacy blob — the legacy fields below are kept only so a
 * read-modify-write cycle on an un-migrated program cannot lose them.
 */
export interface IncomeAssumptionConfig {
  strategy: IncomeAssumptionStrategy;

  keyTable?: IncomeKeyTableRow[];
  bands?: IncomeBand[];
  scalar?: { value: string; unit: 'percent' | 'multiplier' };

  /** FR-012 — DBR cap used when the recognised income came FROM this rule. (0, 100]. */
  dbrCapPercentOverride?: string;
  /** FR-013 — `required_document` keys this method demands. Warning only. */
  requiredDocuments?: string[];
  /** How a surrogate figure combines with a declared salary. Absent = replace. */
  combinationRule?: 'lesser_of' | 'greater_of';

  // --- legacy, read-only ---
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
  /** Optional — server auto-generates when omitted (A33). */
  programCode?: string;
  bankName: string;
  bankId?: string;
  friendlyName: string;
  friendlyNameAr?: string;
  /** Predefined `program_name` catalog key — required; `friendlyName` derives from it. */
  programNameKey: string;
  programType: ProgramType;
  productCategory: string;
  currencies: string[];
  isShariaCompliant?: boolean;
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
  /**
   * Feature 011 / FR-032 — sparse dot-path → `'team_estimated'`.
   *
   * Sent on every save, including when empty: `{}` is the statement "nothing here is
   * a guess", and omitting it would leave a previously-flagged program flagged for
   * good.
   */
  valueSources?: ValueSourceMap;
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
  programNameKey?: string | null;
  bankName: string;
  bankId?: string | null;
  programType: ProgramType;
  productCategory: string;
  currencies: string[];
  active: boolean;
  isShariaCompliant: boolean;
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
  /** Feature 011 — sparse dot-path → `'team_estimated'`; absent path = bank-stated. */
  valueSources?: ValueSourceMap;
  deprecatedKeys: DeprecatedKeyDescriptor[];
  /** Feature 011 — non-blocking findings from the save. Resolved through i18n (A22). */
  warnings?: Array<{ code: string; meta?: Record<string, unknown> }>;
  /** Feature 011 / FR-035 — this save switched a live program off. */
  deactivatedByEstimate?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BankProgramListRow {
  id: string;
  programCode: string;
  friendlyName: string;
  programNameKey?: string | null;
  bankName: string;
  productCategory: string;
  /**
   * How this program establishes the income. Optional so the bundle still renders against
   * a backend that has not deployed the field — an absent value shows no basis tag rather
   * than defaulting to "reads a payslip", which would mislabel the riskier case.
   */
  programType?: ProgramType;
  active: boolean;
  isShariaCompliant: boolean;
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
  /** Filter to Islamic-finance programs, or explicitly to conventional ones. */
  isShariaCompliant?: boolean;
}

// --- Feature 010: banded DBR, duplicate ------------------------------------

/** One row of the income-banded DBR table (FR-016). */
export interface DbrBand {
  /** Inclusive upper bound on recognised monthly income; `null` = open-ended final band. */
  upToIncomeEGP: string | null;
  /** Decimal string, 1…100. */
  capPercent: string;
}

export interface DuplicateBankProgramPayload {
  programCode?: string;
  friendlyName: string;
  friendlyNameAr?: string;
}

// --- Feature 011: value-source markers + the rule check --------------------

/**
 * Sparse map of config dot-path → `'team_estimated'` (FR-032).
 *
 * Two states, and only the non-default one is stored: an ABSENT path means the
 * bank stated the number. That is what keeps every pre-existing program live
 * (FR-037) — `{}` marks nothing estimated, so nothing goes dark on deploy.
 */
export type ValueSourceMap = Record<string, 'team_estimated'>;

/** The sample applicant the rule-check panel runs (data-model § 7). */
export interface IncomeRuleCheckSample {
  /** Admin-side sample age. Permitted here, never on a customer body (A31). */
  age: number;
  militaryGrade?: string;
  professorRank?: string;
  yearsInPractice?: number;
  monthsInJob?: number;
  creditCardLimitEGP?: string;
  cdValueEGP?: string;
  totalDepositsEGP?: string;
  bankStatementBalanceEGP?: string;
  carInstallmentEGP?: string;
  carLoanAmountEGP?: string;
  declaredMonthlySalaryEGP?: string;
  existingMonthlyObligationsEGP: string;
  requestedAmountEGP: string;
  tenorMonths: number;
}

export interface IncomeRuleCheckPayload {
  /** The ON-SCREEN draft, including unsaved edits (FR-028). */
  incomeAssumption: IncomeAssumptionConfig;
  sample: IncomeRuleCheckSample;
}

export type IncomeOrigin =
  | 'declared'
  | 'surrogate'
  | 'declared_over_surrogate'
  | 'surrogate_over_declared'
  | 'none';

export interface IncomeRuleCheckResult {
  /** `null` ⇒ read `unresolvedReason`. NEVER rendered as a zero (FR-031). */
  resolvedIncomeEGP: string | null;
  origin: IncomeOrigin;
  unresolvedReason?: 'fact_not_answered' | 'no_matching_row' | 'no_matching_band' | 'rule_unconfigured';
  dbrCapPercent: string;
  dbrCapSource: 'program_default' | 'rule_override';
  affordableInstallmentEGP: string | null;
  estimatedLoanAmountEGP: string | null;
  /**
   * Derived from the quote's own figures only — no eligibility rule is consulted,
   * so gating cannot re-enter the platform through this panel (FR-027, A33).
   */
  qualifies: boolean;
  unavailableReason?: string;
  matchedRow?: { key: string } | { fromInclusive: string; toExclusive: string | null };
}

