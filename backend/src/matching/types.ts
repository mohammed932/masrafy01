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
import type {
  GateParams,
  ProductRuleOutput,
  RuleGate,
  RuleStep,
  StepParams,
} from './pipeline/product-rule';

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
  preferredTenorMonths: number;
  priority: ApplicationPriority;
  nationalId?: string;
  employment: EmploymentProfile;
  obligations: ObligationsProfile;
  assets: AssetsProfile;
  mortgageDetails?: MortgageDetails;
  carDetails?: CarDetails;
  /**
   * The applicant's answer to every REGISTRY surrogate fact, by fact key.
   *
   * The generic half of what `employment.militaryGrade` / `assets.creditCardLimitEGP`
   * do for the four facts that were code constants. Those stay — they have other
   * readers (the card limit also feeds the obligation discount) and the four legacy
   * strategies still read them — but a fact an operator ADDS on Manage values has no
   * typed field to land in, and inventing one per fact is the release this map exists
   * to avoid.
   *
   * Absent key = not answered. Never defaulted, never zero: the resolver reports
   * `fact_not_answered` and the customer gets a stated reason rather than a price
   * derived from a number nobody gave us (FR-020).
   */
  surrogateFacts?: Readonly<Record<string, SurrogateFactValue>>;
  /**
   * The banks the applicant says they already use, as bank slugs (`bankSlug()`).
   *
   * Not a surrogate fact, because a fact is one value and this is the input to a value
   * that differs per program: the engine derives `bank_relationship` from this list and
   * the bank of the program it is quoting. Absent or empty reads as "new to every bank",
   * which is the standard column — never a refusal (see `bank-relationship.ts`).
   */
  bankRelationshipSlugs?: readonly string[];
}

/**
 * One answered fact — a picked option code, or a number. Never both.
 *
 * Mirrors the two bindable question types: a SINGLE_SELECT answer is a key into the
 * bank's key table, a NUMERIC answer is a value the bank's bands are searched with.
 * A union rather than two optional fields, so "answered as a choice" and "answered as
 * a number" cannot both be true and leave the resolver picking one.
 */
export type SurrogateFactValue =
  | { kind: 'choice'; optionCode: string }
  | { kind: 'numeric'; value: Decimal };

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
  minAmountEGP: string;
  maxAmountEGP: string;
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
  /**
   * The debt-burden cap per COARSE employment bucket, when a bank varies it that way.
   *
   * A real product does: one bank allows 50% of a salary and 40% of a self-employed
   * income, on the same program. `dbrBands` cannot say it — a band is keyed by income —
   * and expressing it as a haircut on the income would misreport the cap itself, which
   * every transparency surface shows.
   *
   * Keyed by the bucket `coarseEmploymentType()` produces (`salaried`, `self_employed`,
   * `retired`), so it reads the same vocabulary a program's `acceptedEmploymentTypes`
   * does. A bucket with no row falls through to the bands, then to the scalar — a
   * partial map narrows nothing.
   */
  dbrCapPercentByEmploymentType?: Record<string, string>;
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
  dbrCapPercentByEmploymentType?: Record<string, string>;
}

export interface PerformanceCriteriaConfig {
  requiredMOBMonths?: number;
  bkt1NoHitWithinMonths?: number;
  bkt2NoHitWithinMonths?: number;
  requireCurrentLoanStatus?: string;
}

/**
 * The BUILT-IN methods — the ones whose arithmetic lives in `resolveSurrogateIncome`
 * because it is more than a table lookup (a percent of a deposit, a multiple of an
 * instalment) or because it reads a profile field no question fills.
 *
 * Closed, and staying closed. A method that reads AN ANSWER and looks it up in the
 * bank's table needs no branch here — it is a registry fact, `fact:<key>`, and an
 * operator adds one on Manage values. The four legacy fact methods below are kept
 * verbatim because live programs' `strategy` tokens name them and an offer is
 * immutable (Principle I); they are not the pattern for the next one.
 */
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

export type BuiltinIncomeAssumptionStrategy = (typeof INCOME_ASSUMPTION_STRATEGIES)[number];

/**
 * The prefix that makes a strategy token name a REGISTRY FACT rather than a built-in
 * method: `fact:taxi_licence_class` reads the fact keyed `taxi_licence_class`.
 *
 * A namespaced token, not a `factKey` field beside the strategy, for one reason: every
 * existing reader — the offer's frozen `strategy`, the admin's method picker, the audit
 * payload, `stripForeignMethodConfig` — already switches on this one string. A parallel
 * field would leave each of them able to disagree about which method a rule is.
 */
export const FACT_STRATEGY_PREFIX = 'fact:';

export type FactIncomeAssumptionStrategy = `${typeof FACT_STRATEGY_PREFIX}${string}`;

/**
 * The token that says "this rule is a STEP PIPELINE" — many facts, a few generic
 * arithmetic ops, and an answer that may be a monthly income OR a borrowing ceiling.
 *
 * Not a member of `INCOME_ASSUMPTION_STRATEGIES`: that set is the closed list of
 * built-in METHODS, each with its own hand-written arithmetic in the resolver, and its
 * own comment says a new method that merely reads an answer must be a registry fact
 * instead. A step pipeline is neither — it is the shape a whole PRODUCT is expressed
 * in, and it earns a token of its own precisely so no reader can mistake it for a
 * twelfth method with a table.
 *
 * Defined here rather than in `matching/pipeline/product-rule.ts` so that module can
 * import it as a VALUE while this one imports only its types — this file imports
 * nothing at runtime (Principle V), which is what keeps the pair acyclic.
 */
export const PRODUCT_RULE_STRATEGY = 'steps';

export type ProductRuleStrategy = typeof PRODUCT_RULE_STRATEGY;

export type IncomeAssumptionStrategy =
  | BuiltinIncomeAssumptionStrategy
  | FactIncomeAssumptionStrategy
  | ProductRuleStrategy;

/** True when a rule is a step pipeline rather than a single-fact method. */
export function isProductRuleStrategy(strategy: string): strategy is ProductRuleStrategy {
  return strategy === PRODUCT_RULE_STRATEGY;
}

/** The `fact:<key>` token for a registry fact key. */
export function factStrategy(factKey: string): FactIncomeAssumptionStrategy {
  return `${FACT_STRATEGY_PREFIX}${factKey}`;
}

/**
 * The fact key a strategy token names, or `null` for a built-in method.
 *
 * `fact:` with nothing after it is `null`, not `''`: an empty key matches no registry
 * row, and returning it would have the resolver look one up and report "your fact is
 * missing" for a rule that is simply malformed.
 */
export function factKeyOf(strategy: string): string | null {
  if (!strategy.startsWith(FACT_STRATEGY_PREFIX)) return null;
  const key = strategy.slice(FACT_STRATEGY_PREFIX.length);
  return key.length > 0 ? key : null;
}

/** True for the built-in tokens — i.e. every method that predates the fact registry. */
export function isBuiltinIncomeStrategy(strategy: string): strategy is BuiltinIncomeAssumptionStrategy {
  return (INCOME_ASSUMPTION_STRATEGIES as readonly string[]).includes(strategy);
}

/** The two methods whose configuration is a table keyed by a registry member. */
export const KEY_TABLE_STRATEGIES = ['byProfessorRank', 'byMilitaryGrade'] as const;

/** The registry enumeration each key method draws its keys from (FR-006). */
export const KEY_TABLE_REGISTRY: Readonly<Record<(typeof KEY_TABLE_STRATEGIES)[number], string>> =
  Object.freeze({
    byProfessorRank: 'professor_rank',
    byMilitaryGrade: 'military_grade',
  });

/**
 * The four methods whose configuration is a band table. Two read years, two read
 * an EGP value — the band shape is identical, only the unit differs.
 *
 * `byCDValue` / `byTotalDeposits` accept EITHER a band table or the legacy
 * percent-of-value scalar; the resolver branches on which is present, so a legacy
 * row keeps its exact current output (FR-015).
 */
export const BAND_STRATEGIES = [
  'byYearsInJob',
  'byYearsInPractice',
  'byCDValue',
  'byTotalDeposits',
] as const;

/** The four methods configured by one number plus the unit it is applied in. */
export const SCALAR_STRATEGIES = [
  'byCarInstallment',
  'byCarLoanAmount',
  'byCreditCardLimit',
  'byBankStatementPercent',
] as const;

/** One row of a key table: a registry member and the income the bank assigns it. */
export interface IncomeKeyTableRow {
  key: string;
  /** Decimal string, > 0. Arrives from JSONB as a string — never a float (Principle I). */
  incomeEGP: string;
}

/**
 * One income band, half-open `[fromInclusive, toExclusive)`. `toExclusive: null`
 * marks the open-ended last band.
 *
 * Edges only, exactly the v14.0.0 numeric-scoring-band idiom, so a gap or an
 * overlap is unrepresentable rather than merely validated (research R6). Unlike
 * the scoring bands these need NOT cover −∞…+∞: a bank's value table may
 * legitimately start above zero, and a value below the first edge resolves to
 * `no_matching_band` — a stated reason, never a substituted zero (FR-020).
 */
export interface IncomeBand {
  fromInclusive: string;
  toExclusive: string | null;
  incomeEGP: string;
}

/**
 * Feature 011 — the CANONICAL self-describing income rule (FR-014).
 *
 * One object per program, written on every save. The legacy shapes below it are
 * upgraded on read by `normalizeIncomeAssumption()` — the `normalizeWeights`
 * precedent, which shipped without a migration (research R1). A new method needs
 * a new `strategy` token and nothing else: no column, no migration.
 *
 * Money is a Decimal STRING at every hop — admin form → DTO → JSONB → resolver,
 * which constructs the `Decimal` (Principle I / A3).
 */
export interface IncomeAssumptionConfig {
  strategy: IncomeAssumptionStrategy;

  /**
   * WHERE the figures below come from. Program rules only — a catalog name's own
   * rule is the source, so it never carries this.
   *
   *   'own'      the tables on this object are this bank's. The default, and what
   *              every row written before this field existed means: they all carry
   *              their own numbers, so ABSENT must read as `'own'` (see
   *              `normalizeIncomeAssumption`).
   *   'catalog'  the tables are the catalog program name's, merged in by
   *              `toBankProgramSnapshot`. `keyTable`/`bands`/`scalar` are STRIPPED
   *              before persist, so the program stores no copy and a catalog edit
   *              reaches it on the next quote.
   *
   * An explicit marker rather than "the table is empty", because those are two
   * different states: a program that inherits and a program whose operator has not
   * filled the table in yet must not save, resolve or read the same.
   *
   * The `strategy` is NOT inherited — it is copied from the name and enforced equal
   * to it (`PROGRAM_NAME_INCOME_PROOF_MISMATCH`), so every reader that switches on
   * a strategy keeps working against the program object alone.
   */
  amounts?: 'catalog' | 'own';

  // --- the step pipeline (`strategy: 'steps'`) ---------------------------------
  //
  // STRUCTURE (`steps` / `gates` / `output`) belongs to the catalog program NAME and is
  // merged onto every program under it by `effectiveIncomeRule` — always, not only when
  // the program takes catalog amounts. A bank cannot restate the shape of the product it
  // sells, so the two can never disagree about what it is.
  //
  // FIGURES live in `stepParams`, keyed by step id (and by gate id — a gate's floor is a
  // bank figure too). That is the whole of "a fifth bank is one config row".

  /** Catalog-owned. See `matching/pipeline/product-rule.ts`. */
  steps?: RuleStep[];
  /** Catalog-owned. A failed gate is a stated reason, never a filter. */
  gates?: RuleGate[];
  /** Catalog-owned. Says whether the last step is an income or a ceiling. */
  output?: ProductRuleOutput;
  /** Bank-owned figures by step id / gate id. Stripped when `amounts: 'catalog'`. */
  stepParams?: Record<string, StepParams & GateParams>;

  // --- canonical shapes (one per method family) ---

  /** Key methods only. Order follows registry display order. */
  keyTable?: IncomeKeyTableRow[];
  /** Range methods only. Ordered, gapless, last band open-ended. */
  bands?: IncomeBand[];
  /** Scalar methods only. `unit` documents the arithmetic the resolver applies. */
  scalar?: { value: string; unit: 'percent' | 'multiplier' };

  /**
   * FR-012 — the DBR cap to use when the recognised income CAME FROM this rule.
   * Applied only then: a surrogate figure is a bank's own estimate of capacity,
   * so a bank may cap it differently from a payslip it has seen.
   */
  dbrCapPercentOverride?: string;
  /** FR-013 — `required_document` registry keys this method demands. Warning only. */
  requiredDocuments?: string[];
  /** How a surrogate figure combines with a declared salary. Absent = replace. */
  combinationRule?: 'lesser_of' | 'greater_of';

  // --- LEGACY shapes, read-only ------------------------------------------------
  //
  // Still typed because three seeded programs carry them and the normalizer has to
  // accept them (`abk-egypt-2026.ts`). Nothing WRITES these any more: the save path
  // emits the canonical shape above. Do not add a reader for them outside
  // `income-rule-normalize.ts`, or the platform is back to two truths.

  /** Legacy years / value table: inclusive `[minYears, maxYears]`, or CD-value rows. */
  incomeTable?: Array<{
    minYears?: number;
    maxYears?: number;
    minCDValueEGP?: string;
    incomeEGP?: string;
    assumedIncomeEGP?: string;
  }>;
  /** Legacy `byProfessorRank` table. */
  rankIncomeMap?: Record<string, string>;
  /** Legacy `byMilitaryGrade` table. */
  gradeIncomeMap?: Record<string, string>;
  cdIncomePercent?: string;
  cdIncomePercentOfDeposits?: string;
  cdIncomeMinEGP?: string;
  bankStatementPercent?: string;
  carInstallmentMultiplier?: string;
  carLoanAmountPercent?: string;
  creditCardLimitMultiplier?: string;
}

/**
 * Where the income a quote ran on actually came from (research R5).
 *
 * Three requirements need this and none can derive it from a number: the offer
 * must record which side won (Principle I — frozen, not recomputed), the admin
 * check panel must say "no row matched" instead of showing a zero (FR-031), and
 * the per-rule DBR override applies ONLY when the income is surrogate-derived
 * (FR-012). Returning a bare `Decimal` forced every caller to re-derive it.
 */
export type IncomeOrigin =
  | 'declared'
  | 'surrogate'
  | 'declared_over_surrogate'
  | 'surrogate_over_declared'
  /**
   * The figure was derived from a collateral CEILING a product rule produced — the
   * unit, the membership, the vehicle. Frozen on the offer like every other origin
   * (Principle I): "2 000 000" alone does not say that the unit decided it, and a later
   * reader must not have to guess.
   *
   * Never combined with a declared salary. A collateral product does not read one, and
   * `greater_of` against a payslip would quote a ceiling the collateral never supported.
   */
  | 'ceiling'
  | 'none';

/** Why no income could be resolved. Never a substituted default (FR-020). */
export type IncomeUnresolvedReason =
  | 'fact_not_answered'
  | 'no_matching_row'
  | 'no_matching_band'
  | 'rule_unconfigured'
  /**
   * A product-rule gate refused — the down payment is under the floor, the contract is
   * too old, the applicant did not confirm which unit is theirs. Not priceable for this
   * product, which is a different fact from a broken table, and the gate's own
   * `reasonCode` says which gate (see `GATE_REASON_CODES`).
   */
  | 'gate_failed';

export interface IncomeResolution {
  /**
   * 0 when unresolved — callers MUST check `origin` rather than testing the
   * figure. A zero income and an unresolvable one produce the same number and
   * mean entirely different things to the admin who has to fix it.
   */
  incomeEGP: Decimal;
  origin: IncomeOrigin;
  strategy: IncomeAssumptionStrategy;
  /** Set only when `origin === 'none'`. */
  unresolvedReason?: IncomeUnresolvedReason;
  /** The DBR cap actually applied, and where it came from (FR-012, FR-027). */
  dbrCapPercent: Decimal;
  dbrCapSource: 'program_default' | 'rule_override';
  /**
   * The band the cap came from, or `null` for a scalar cap / a rule override.
   *
   * Carried so `quoteProgram` can take the whole cap resolution from here instead of
   * running `resolveDbrCap` a second time over the same income — the second run is
   * both waste inside the per-program match loop and a second chance to disagree
   * about a number the offer is about to freeze (Principle I).
   */
  dbrBandIndex: number | null;
  /**
   * Which row or band produced the figure, for the check panel's "traced to
   * exactly one configured value" claim (FR-030). Absent when the income is
   * declared or unresolved.
   */
  matchedRow?: { key: string } | { fromInclusive: string; toExclusive: string | null };
  /**
   * Set only when `origin === 'ceiling'`: the borrowing ceiling the product rule derived
   * from the applicant's collateral.
   *
   * Carried BESIDE `incomeEGP` rather than in it, because they are different quantities —
   * one is an amount, the other a monthly figure — and `quoteProgram` needs both: the
   * ceiling clamps the program maximum, and the income it implies (computed there, where
   * the rate and the final tenor are known) is what the DBR machinery spends.
   *
   * `incomeEGP` is 0 on a ceiling resolution for exactly the reason it is 0 on a miss:
   * this resolver cannot know the tenor. Callers MUST read `origin`.
   */
  ceilingAmountEGP?: Decimal;
  /** `output.baselineDbrPercent`, or the program's own cap when the rule states none. */
  ceilingBaselineDbrPercent?: Decimal;
  /** Set when `unresolvedReason === 'gate_failed'` — which gate, and its reason code. */
  gateId?: string;
  gateReasonCode?: string;
  /** Set when a product rule could not read a fact: the keys still missing. */
  missingFactKeys?: string[];
  /** The step-by-step figures, for the admin check panel. Never persisted. */
  productRuleSteps?: ReadonlyArray<{ id: string; op: string; valueEGP: string }>;
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
  /**
   * Feature 011 — WHICH income this offer was priced on, and by which surrogate
   * method when one produced it. Carried onto the offer so the apply path can FREEZE
   * both (Principle I / A6): editing the program's table later must not rewrite what
   * an immutable offer meant.
   *
   * `null` when the income rule was never consulted — an `income_proof` program with
   * a declared salary. Saying `declared` there would claim a decision the engine did
   * not make, and a reader must render the absence rather than assume a value.
   */
  incomeOrigin: IncomeOrigin | null;
  incomeSurrogateStrategy: IncomeAssumptionStrategy | null;
  /**
   * The collateral ceiling this offer was priced against, when a product rule derived one.
   * `null` for every income-based program — absent, not zero, because a zero would say the
   * collateral supports nothing.
   */
  collateralCeilingEGP: Decimal | null;
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
  /** The asked-for term was below the program floor and was stretched up to it. */
  'tenor_min',
  'age_at_maturity',
  /**
   * The amount was capped by the ceiling a product rule derived from the applicant's
   * collateral, below the program's own maximum. Ranked above `program_max`: that is the
   * more specific statement — the program would lend more, this unit will not carry more.
   */
  'collateral_ceiling',
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
  'PROGRAM_MISCONFIGURED',
  /**
   * Feature 011 — the program's income rule reads a fact the applicant was never
   * asked, or skipped (FR-020). Distinct from `NO_RECOGNISED_INCOME`, which keeps
   * its meaning for every other cause: the two lead to DIFFERENT admin actions —
   * assign the question to the category vs. add the missing table row (research
   * R9). The program stays listed and stays ranked (FR-022, FR-024).
   */
  'SURROGATE_FACT_MISSING',
  /** The fact was answered, but no key matched / the value fell in no band. */
  'SURROGATE_NO_MATCHING_ROW',
  /**
   * A product-rule GATE refused this applicant for this product — the down payment is
   * below the bank's floor, the ownership contract is outside its window, the multi-unit
   * declaration was not confirmed.
   *
   * A "no figures" outcome, NOT a filter: the program stays listed and stays ranked, and
   * `QuoteUnavailable.gateReasonCode` names which of the closed platform reasons applied
   * so the surface can say WHY in the customer's own language. Reintroducing this as an
   * eligibility filter is forbidden (A33) — and would not fire anyway, since every
   * production path runs with `skipEligibility`.
   */
  'PRODUCT_RULE_GATE_FAILED',
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
  /**
   * Set only for a product rule whose answer is a CEILING: the amount the applicant's
   * collateral supports, before obligations.
   *
   * Reported so the apply path can FREEZE it on the immutable offer and every surface can
   * say "your unit supports 2 000 000, your existing payments leave 1 662 677" — two
   * numbers that explain each other, where the second alone reads as an unexplained cut.
   */
  collateralCeilingEGP?: Decimal;
  /** The income every figure above keys off (see `quoteProgram` step 3). */
  recognisedIncomeEGP: Decimal;
  /**
   * Feature 011 — where that income came from, when the income rule was consulted.
   *
   * `null` on an `income_proof` program whose applicant declared a salary: the rule
   * was never read, and reporting `declared` there would claim a decision the
   * engine did not make. The apply path FREEZES `origin` + `strategy` on the offer
   * (Principle I / A6) and the admin check panel reads `matchedRow` — neither
   * re-runs the resolver, so neither can reach a different answer.
   */
  incomeResolution: IncomeResolution | null;
  /** Whether `dbrCapPercent` above came from the program or the rule (FR-012). */
  dbrCapSource: 'program_default' | 'rule_override';
  /** Itemised, always — fees are never folded in silently (FR-031). */
  feesBreakdown: FeesBreakdown;
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
  /**
   * Populated when `reason` is `PRODUCT_RULE_GATE_FAILED`: which gate, and the closed
   * platform reason code it carries. The id is for the admin (it names the row to fix);
   * the code is what every locale dictionary has a sentence for (Principle III).
   */
  gateId?: string;
  gateReasonCode?: string;
  /**
   * Populated when a product rule read a fact the applicant never answered — the keys of
   * the answers still missing. Lets the surface say "answer these" instead of "something
   * is missing", which is the whole point of decision 3.
   */
  missingFactKeys?: string[];
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
