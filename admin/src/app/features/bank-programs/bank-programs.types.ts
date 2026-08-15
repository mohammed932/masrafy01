/**
 * TypeScript types mirroring the backend bank-program contract.
 * Decimals transported as canonical strings (research.md R1).
 */

import type { EnumerationMember } from '@core/platform-enumerations/platform-enumerations.types';
import type { LoanCategory } from '@core/loan-category';

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

export interface TenorConfig {
  minMonths: number;
  maxMonths: number;
  maxMonthsByEmploymentType?: Record<string, number>;
}

export interface LoanLimitsConfig {
  minAmountEGP: string;
  maxAmountEGP: string;
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

export type BuiltinIncomeStrategy = (typeof INCOME_ASSUMPTION_STRATEGIES)[number];

/**
 * The prefix that makes a strategy name a REGISTRY FACT rather than a built-in method.
 * Mirrors the backend `FACT_STRATEGY_PREFIX` (`matching/types.ts`).
 */
export const FACT_STRATEGY_PREFIX = 'fact:';

export type IncomeAssumptionStrategy = BuiltinIncomeStrategy | `${typeof FACT_STRATEGY_PREFIX}${string}`;

/** The `fact:<key>` token for a registry fact key. */
export function factStrategy(factKey: string): IncomeAssumptionStrategy {
  return `${FACT_STRATEGY_PREFIX}${factKey}`;
}

/** The fact key a strategy names, or `null` for a built-in method. */
export function factKeyOf(strategy: string): string | null {
  if (!strategy.startsWith(FACT_STRATEGY_PREFIX)) return null;
  const key = strategy.slice(FACT_STRATEGY_PREFIX.length);
  return key.length > 0 ? key : null;
}

/**
 * One operator-defined FACT, as the form needs it — the registry row plus enough of its
 * bound question to render the right editor and offer the right keys.
 *
 * Reduced from `EnumerationMember` by `registryFacts()` below rather than passed around
 * whole, so a component cannot start reading some other part of the member and quietly
 * grow a second idea of what a fact is.
 */
export interface RegistryFact {
  key: string;
  label: string;
  /** Absent when the fact points at no question — it cannot be offered as a method. */
  question: {
    code: string;
    label: string;
    type: 'SINGLE_SELECT' | 'NUMERIC';
    active: boolean;
    options: Array<{ code: string; labelAr: string; labelEn: string }>;
    /** Loan categories the questionnaire actually asks this question of. */
    askedIn: readonly LoanCategory[];
  } | null;
}

/**
 * The facts a program may actually be keyed by, from the loaded registry members.
 *
 * Unbound facts are dropped, matching the backend's own registry read: offering a method
 * whose fact reads no question would let an operator configure a whole table that
 * resolves to nothing for every applicant — the silent failure this feature closes.
 * A bound-but-INACTIVE question is kept, because the program form warns about it in
 * words the operator can act on; hiding it would make an existing rule's method vanish
 * from its own picker.
 */
export function registryFacts(
  members: readonly EnumerationMember[],
  isAr: boolean,
): RegistryFact[] {
  return members.flatMap((m) => {
    const q = m.boundQuestion;
    if (!q) return [];
    return [
      {
        key: m.key,
        label: isAr ? m.labelAr : m.labelEn,
        question: {
          code: q.code,
          label: isAr ? q.labelAr : q.labelEn,
          type: q.type,
          active: q.active,
          options: q.options,
          askedIn: q.askedIn ?? [],
        },
      },
    ];
  });
}

/** One method as the picker and the review read-back render it. */
export interface IncomeMethodOption {
  value: IncomeAssumptionStrategy;
  label: string;
}

export interface IncomeMethodGroup {
  label: string;
  options: IncomeMethodOption[];
}

function methodLabel(strategy: BuiltinIncomeStrategy): string {
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

/**
 * The label for one method — the same words the picker shows, for the review read-back
 * and the read-only detail page.
 *
 * `facts` is optional so a caller that has not loaded the registry still renders
 * something honest for a `fact:` rule: the key, not a blank and not a guess. A program
 * whose fact was retired reads the same way, which is correct — the key is all that is
 * left of it.
 */
export function incomeMethodLabel(
  strategy: IncomeAssumptionStrategy,
  facts: readonly RegistryFact[] = [],
): string {
  const factKey = factKeyOf(strategy);
  if (factKey !== null) {
    const fact = facts.find((f) => f.key === factKey);
    return fact
      ? $localize`:@@bank_programs.strategy.fact:By ${fact.label}:fact:`
      : $localize`:@@bank_programs.strategy.fact_unknown:By “${factKey}:fact:” (not in the registry)`;
  }
  return methodLabel(strategy as BuiltinIncomeStrategy);
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
export function incomeMethodGroups(facts: readonly RegistryFact[] = []): IncomeMethodGroup[] {
  const opts = (values: readonly BuiltinIncomeStrategy[]): IncomeMethodOption[] =>
    values.map((value) => ({ value, label: methodLabel(value) }));
  // The four built-in fact methods and the registry facts sit in ONE group, because to
  // the operator they are the same kind of thing: a table keyed by something the
  // customer answered. The four keep their own tokens only because live offers froze
  // them (Principle I) — that is a storage detail, and surfacing it as two groups would
  // ask the operator to care about it.
  const askedOptions: IncomeMethodOption[] = [
    ...opts(['byMilitaryGrade', 'byProfessorRank', 'byYearsInPractice', 'byCreditCardLimit']),
    ...facts
      // The four seeded facts ARE registry rows now, so without this they would appear
      // twice — once under their frozen token, once under `fact:`. The built-in wins:
      // it is what existing programs carry, and two ways to say one thing is how two
      // programs end up meaning the same rule by different names.
      .filter((f) => !BUILTIN_FACT_KEYS.has(f.key))
      .map((f) => ({
        value: factStrategy(f.key),
        label: $localize`:@@bank_programs.strategy.fact:By ${f.label}:fact:`,
      })),
  ];
  return [
    {
      label: $localize`:@@bank_programs.strategy.group.asked:Reads an answer the customer gives`,
      options: askedOptions,
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

/**
 * The registry keys the four built-in fact methods already cover.
 *
 * Mirrors the seeded `surrogate_fact` rows in migration
 * `20260815130000_surrogate_fact_registry`. Their tokens stay `byMilitaryGrade` &c. on
 * stored programs, so the picker must not offer the same fact a second time as
 * `fact:military_grade`.
 */
const BUILTIN_FACT_KEYS = new Set([
  'military_grade',
  'academic_rank',
  'years_in_practice',
  'credit_card_limit',
]);

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
export const INCOME_METHOD_SHAPE: Readonly<Record<BuiltinIncomeStrategy, IncomeMethodShape>> = {
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
  Partial<Record<BuiltinIncomeStrategy, 'professor_rank' | 'military_grade'>>
> = {
  byProfessorRank: 'professor_rank',
  byMilitaryGrade: 'military_grade',
};

/** The unit a band table's edges are expressed in — label only, never arithmetic. */
export const INCOME_BAND_UNIT: Readonly<Partial<Record<BuiltinIncomeStrategy, 'years' | 'EGP'>>> = {
  byYearsInJob: 'years',
  byYearsInPractice: 'years',
  byCDValue: 'EGP',
  byTotalDeposits: 'EGP',
};

/**
 * Which editor a method needs — built-in or registry fact.
 *
 * For a fact the shape follows the QUESTION, exactly as the backend resolves it: a
 * one-answer question keys a table, a number question bands one. Nothing is stored
 * saying which, so the two sides cannot disagree.
 *
 * An unknown fact (retired from the registry, or not loaded yet) is `none`: the form
 * shows no editor rather than an empty table the operator would fill in for a method
 * the server is about to reject with `INCOME_RULE_FACT_UNAVAILABLE`.
 */
export function incomeMethodShape(
  strategy: IncomeAssumptionStrategy,
  facts: readonly RegistryFact[] = [],
): IncomeMethodShape {
  const factKey = factKeyOf(strategy);
  if (factKey !== null) {
    const question = facts.find((f) => f.key === factKey)?.question;
    if (!question) return 'none';
    return question.type === 'SINGLE_SELECT' ? 'keyTable' : 'bands';
  }
  return INCOME_METHOD_SHAPE[strategy as BuiltinIncomeStrategy] ?? 'none';
}

/**
 * The rows a fact's key table may carry — the bound question's own options.
 *
 * NOT an enumeration, unlike the two built-in key methods. That is the whole point of
 * binding a question: the keys the bank picks from and the answers the customer picks
 * from are ONE list, so a renamed option cannot leave a table pointing at a key nobody
 * can answer. Empty for a built-in method (its keys come from `INCOME_KEY_REGISTRY`)
 * and for a numeric fact.
 */
export function factKeyOptions(
  strategy: IncomeAssumptionStrategy,
  facts: readonly RegistryFact[] = [],
): Array<{ code: string; labelAr: string; labelEn: string }> {
  const factKey = factKeyOf(strategy);
  if (factKey === null) return [];
  const question = facts.find((f) => f.key === factKey)?.question;
  return question?.type === 'SINGLE_SELECT' ? question.options : [];
}

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
  unresolvedReason?:
    | 'fact_not_answered'
    | 'no_matching_row'
    | 'no_matching_band'
    | 'rule_unconfigured';
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
