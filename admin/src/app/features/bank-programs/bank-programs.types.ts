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
  /**
   * The program's maximum loan keyed by an answer — the second table nine bank sheets print
   * under "Loan Amount — Maximum". The general form of the three fixed `maxBy…` axes above,
   * which cannot reach a city, a school type, a branch or a company coding.
   *
   * Shape mirrors the backend `MaxLoanByFactConfig`; the editor owns the type
   * (`shared/ui/max-loan-by-fact-editor.component.ts`) and this is the wire echo of it.
   */
  maxLoanByFact?: {
    factKey: string;
    columnFactKey?: string;
    rows: Array<{
      rowKey?: string;
      fromInclusive?: string;
      toExclusive?: string | null;
      columnKey?: string;
      maxAmountEGP: string;
    }>;
    onNoMatch: 'useProgramMax' | 'reject';
  };
  /**
   * Adjustments that act on the CAP rather than on the income — "+10% for a second
   * residential unit", "50% of the loan amount on a jointly owned one".
   *
   * Carried here with NO editor behind it, deliberately and for one reason: a save is a
   * full-replacement PUT built from this form, so a field the form does not read is a field
   * the next save DELETES. The wizard therefore reads this and sends it back unchanged, which
   * keeps a seeded or API-authored adjustment alive through an edit of something else. The
   * scope (`income` vs `maxLoan`) is what makes an adjustment worth 300,000 on one applicant,
   * so losing one silently is not a cosmetic bug.
   */
  maxLoanAdjustments?: Array<{
    kind: 'upliftPercent' | 'sharePercent';
    percent: string;
    whenFactKey: string;
    whenOptionCode: string;
  }>;
}

/**
 * How a rate is charged. `reducing` charges interest on what is still owed; `flat` charges
 * it on the original amount for the whole tenor, which buys the customer 22-29% less loan
 * from the same instalment. Absent reads as `reducing` on the server, which is what every
 * program configured before the field existed was priced by.
 */
export type RateBasis = 'reducing' | 'flat';

export interface PricingConfig {
  isVariableRate: boolean;
  rateBasis?: RateBasis;
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
  /**
   * A cap per underwriting bucket — `{ salaried: '50', self_employed: '40' }`.
   *
   * Beats the income bands when set: a bank stating both means "40% for the self-employed,
   * whatever they earn". Keys are the COARSE buckets the engine folds a detailed employment
   * answer into, never the questionnaire's own vocabulary.
   */
  dbrCapPercentByEmploymentType?: Record<string, string>;
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

export type IncomeAssumptionStrategy =
  | BuiltinIncomeStrategy
  | `${typeof FACT_STRATEGY_PREFIX}${string}`
  // A step pipeline. Not a twelfth METHOD — it is the shape a whole product is expressed in
  // (see `PRODUCT_RULE_STRATEGY`), and it earns a token so no reader mistakes it for one.
  | 'steps';

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
  /**
   * The surrogate product that authored this fact, or `null` for one the platform shipped or
   * an operator made on the values rail. Provenance, never a constraint — any product's rule
   * may read any fact, and the picker offers all of them.
   */
  ownedBy: string | null;
  /** Absent when the fact points at no question — it cannot be offered as a method. */
  question: {
    code: string;
    label: string;
    type: AskQuestionType;
    active: boolean;
    options: Array<{ code: string; labelAr: string; labelEn: string }>;
    /**
     * The list those options are filed under — what a `factParentTable` step is keyed by.
     * Empty when they are filed under nothing, which is a parent table with no key list.
     */
    parentOptions: Array<{ code: string; labelAr: string; labelEn: string }>;
    /**
     * The operator-managed LIST these options came from, and the list those are filed
     * under. Derived server-side by coverage, never stored.
     *
     * `undefined` means the question is not backed by a registry list — a yes/no, a
     * numeric, or a hand-authored option set. That is a real answer, not a gap: a screen
     * offering lists to curate must show nothing rather than an empty one.
     */
    optionsEnumerationType?: string;
    parentEnumerationType?: string;
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
        ownedBy: m.surrogateProductKey ?? null,
        question: {
          code: q.code,
          label: isAr ? q.labelAr : q.labelEn,
          type: q.type,
          active: q.active,
          options: q.options,
          parentOptions: q.parentOptions ?? [],
          // Spread conditionally: `undefined` and "absent" mean the same thing here, and
          // writing the key with an undefined value makes `in` checks lie.
          ...(q.optionsEnumerationType !== undefined
            ? { optionsEnumerationType: q.optionsEnumerationType }
            : {}),
          ...(q.parentEnumerationType !== undefined
            ? { parentEnumerationType: q.parentEnumerationType }
            : {}),
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
  // A step pipeline is not one of the eleven methods, and `methodLabel`'s switch has no case
  // for it — so this function returned `undefined` for every collateral program. Three call
  // sites patched around that individually and a fourth did not: `catalogProof()` on the
  // wizard treated the empty label as "this name states no income proof", which put the
  // whole income step behind a "nobody has said what this name reads" notice and left the
  // product-rule editor unreachable for all seven collateral programs. Answered once, here.
  if (strategy === PRODUCT_RULE_STRATEGY) {
    return $localize`:@@bank_programs.strategy.steps:Worked out step by step from what the customer owns`;
  }
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
 *
 * FACT keys, not question codes — see `BUILTIN_FACT_QUESTION_CODES` in
 * `core/surrogate-facts.ts`, which is the same four in the other namespace. The one entry
 * that differs (`credit_card_limit` here, `credit_card_total_limit` there) is the pair as
 * seeded, not a typo in either.
 */
const BUILTIN_FACT_KEYS = new Set([
  'military_grade',
  'academic_rank',
  'years_in_practice',
  'credit_card_limit',
]);

/** Which editor a method needs. Drives the type-driven rendering in step 3. */
export type IncomeMethodShape = 'none' | 'keyTable' | 'bands' | 'scalar' | 'steps';

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
    // Only a NUMBER is banded. Every other answer is looked up by a KEY — one option code,
    // several (a multi-pick, read by the bank's own row order), or the reserved presence key
    // a text answer offers. Mirrors `resolveRegistryFact`, so the two sides cannot disagree.
    return question.type === 'NUMERIC' ? 'bands' : 'keyTable';
  }
  if (strategy === PRODUCT_RULE_STRATEGY) return 'steps';
  return INCOME_METHOD_SHAPE[strategy as BuiltinIncomeStrategy] ?? 'none';
}

// ---------------------------------------------------------------------------
// Product rules — a step pipeline (`strategy: 'steps'`)
// ---------------------------------------------------------------------------

/**
 * The token that says a rule is a step pipeline. Mirrors `PRODUCT_RULE_STRATEGY` in
 * `backend/src/matching/types.ts`.
 *
 * A collateral product — the compound-ownership guarantee, the club-membership loan — reads
 * several answers and derives a borrowing CEILING rather than an income, so it cannot be
 * said as one of the eleven methods. Its structure is the catalog name's and its figures are
 * the bank's, which is the same split the eleven already follow for `amounts`.
 */
export const PRODUCT_RULE_STRATEGY = 'steps';

/** The ops a step may run. Mirrors `STEP_OPS` on the backend. */
export const STEP_OPS = [
  'constant',
  'factNumber',
  'factChoiceTable',
  'factParentTable',
  'bandTable',
  'percentOf',
  'upliftPercent',
  'multiply',
  'sum',
  'subtract',
  'minOf',
  'maxOf',
  'coalesce',
  'pickByFact',
] as const;

export type StepOp = (typeof STEP_OPS)[number];

export type ValueRef = { step: string } | { fact: string } | { const: string };

export interface RuleStep {
  id: string;
  op: StepOp;
  fact?: string;
  of?: ValueRef | ValueRef[];
  /** `pickByFact`: which answer each entry of `of` belongs to, positionally. */
  branches?: string[];
  /**
   * `pickByFact`: whether `branches` name the ANSWER's own option codes (absent, the default)
   * or the CLASS each answer is filed under.
   *
   * Read here for one reason — a column heading. The branches of a class-keyed column are
   * keys of the list the answers are filed under, so the answer list cannot name them, and
   * the heading renders as a raw slug unless the class list is consulted instead.
   */
  branchOn?: 'answer' | 'parentClass';
}

export interface ProductRuleOutput {
  kind: 'monthlyIncome' | 'maxAmount';
  from: string;
  baselineDbrPercent?: string;
}

export const GATE_REASON_CODES = [
  'DOWN_PAYMENT_BELOW_MIN',
  'UNIT_PRICE_BELOW_MIN',
  'CONTRACT_TOO_NEW',
  'CONTRACT_TOO_OLD',
  'OWNERSHIP_NOT_CONFIRMED',
  'MULTI_UNIT_NOT_CONFIRMED',
  'SELF_EMPLOYED_DOCS_MISSING',
  'BUSINESS_TOO_NEW',
  'GATE_NOT_MET',
] as const;

export type GateReasonCode = (typeof GATE_REASON_CODES)[number];

export type RuleGate =
  | {
      id: string;
      kind: 'number';
      op: 'gte' | 'lte' | 'gt' | 'lt' | 'between';
      left: ValueRef;
      right?: ValueRef;
      reasonCode: GateReasonCode;
    }
  | {
      id: string;
      kind: 'numberByKey';
      op: 'gte' | 'lte';
      left: ValueRef;
      keyedBy: string;
      reasonCode: GateReasonCode;
    }
  | {
      id: string;
      kind: 'choice';
      op: 'eq' | 'neq' | 'in';
      fact: string;
      expect: string[];
      reasonCode: GateReasonCode;
    };

/** One step's or gate's figures — the only half a bank program stores. */
export interface StepFigures {
  valueEGP?: string;
  keyTable?: IncomeKeyTableRow[];
  bands?: IncomeBand[];
  scalar?: { value: string; unit: 'percent' | 'multiplier' };

  // --- a step pipeline (`strategy: 'steps'`) ---
  //
  // STRUCTURE belongs to the catalog name and is merged onto every program under it on every
  // read; a bank program never stores it, and the API strips it if one is sent. FIGURES are
  // the bank's, and are the only half a program save carries.

  /** Catalog rules only. Present on a program response solely because the type is shared. */
  steps?: RuleStep[];
  gates?: RuleGate[];
  output?: ProductRuleOutput;
  /** The bank's figures, by step id and gate id. */
  stepParams?: Record<string, StepFigures>;
  minValue?: string;
  maxValue?: string;
  applies?: boolean;
}

/**
 * Which editor a step's figures are typed into.
 *
 * The point of this map is that a new OP costs no new UI as long as it reuses a shape the
 * three existing editors already draw — the same trade `INCOME_METHOD_SHAPE` makes for the
 * eleven methods. `'none'` covers the arithmetic ops, which have nothing for a bank to state.
 */
export const STEP_OP_SHAPE: Readonly<Record<StepOp, IncomeMethodShape>> = {
  constant: 'scalar',
  factNumber: 'none',
  factChoiceTable: 'keyTable',
  factParentTable: 'keyTable',
  bandTable: 'bands',
  percentOf: 'scalar',
  upliftPercent: 'scalar',
  multiply: 'scalar',
  sum: 'none',
  subtract: 'none',
  minOf: 'none',
  maxOf: 'none',
  coalesce: 'none',
  // Two columns, and each is a step of its own with its own figures. Nothing to type here.
  pickByFact: 'none',
};

/** The refs a step operates on, normalised. */
export function stepRefs(step: RuleStep): ValueRef[] {
  if (step.of === undefined) return [];
  return Array.isArray(step.of) ? step.of : [step.of];
}

/**
 * A step whose factor comes from a SECOND input states no figure of its own.
 *
 * One bank's required down payment is the customer's percentage of the customer's price —
 * two answers and no bank number — so asking the operator for a percentage there would be
 * asking for one the engine then ignores.
 */
export function stepTakesFigures(step: RuleStep): boolean {
  const shape = STEP_OP_SHAPE[step.op];
  if (shape === 'none') return false;
  if (shape === 'scalar' && step.op !== 'constant' && stepRefs(step).length >= 2) return false;
  return true;
}

/**
 * Every fact key a rule reads — one walk, shared.
 *
 * The same derivation as the backend's `factsReadBy`, and it existed twice on this side (the
 * rule editor's chip row and the check panel's sample inputs) with the identical closure and
 * the identical comment saying it must not drift. A gate kind gaining a fact-bearing field
 * then had to be found in three places; missing one meant the editor listing a fact the quote
 * would refuse on, or a check panel offering a sample the rule never reads.
 */
export function factKeysReadBy(steps: readonly RuleStep[], gates: readonly RuleGate[]): string[] {
  const keys = new Set<string>();
  const addRefs = (of: RuleStep['of'] | undefined): void => {
    if (of === undefined) return;
    for (const ref of Array.isArray(of) ? of : [of]) if ('fact' in ref) keys.add(ref.fact);
  };
  for (const step of steps) {
    if (step.fact) keys.add(step.fact);
    addRefs(step.of);
  }
  for (const gate of gates) {
    if (gate.kind === 'choice') {
      keys.add(gate.fact);
      continue;
    }
    addRefs(gate.left);
    // The right-hand side too: a gate may compare one ANSWER against another, and a fact
    // reachable only from there is still a fact the rule reads.
    if (gate.kind === 'number') addRefs(gate.right);
    if (gate.kind === 'numberByKey') keys.add(gate.keyedBy);
  }
  return [...keys];
}

/**
 * The steps a `coalesce` chooses between, plus the steps a gate compares against — the
 * OPTIONAL ones, which a bank leaves blank to decline a derivation the catalog offers.
 *
 * Derived from the rule, never stored, exactly as on the backend: a stored "optional" flag
 * would be a second statement of the same fact, free to disagree with the list the coalesce
 * actually names.
 */
export function optionalStepIds(
  steps: readonly RuleStep[],
  gates: readonly RuleGate[],
): Set<string> {
  const ids = new Set<string>();
  for (const step of steps) {
    // `pickByFact` for the same reason as `coalesce`: a bank that sells only the standard
    // column leaves the other blank, and the step falls back to the one it configured.
    if (step.op !== 'coalesce' && step.op !== 'pickByFact') continue;
    for (const ref of stepRefs(step)) if ('step' in ref) ids.add(ref.step);
  }
  for (const gate of gates) {
    if (gate.kind === 'number' && gate.right !== undefined && 'step' in gate.right) {
      ids.add(gate.right.step);
    }
  }
  return ids;
}

/** Whether the bank has stated enough for this step to produce anything. */
export function stepIsConfigured(step: RuleStep, figures: StepFigures | undefined): boolean {
  if (!stepTakesFigures(step)) return true;
  const f = figures ?? {};
  switch (STEP_OP_SHAPE[step.op]) {
    case 'keyTable':
      return (f.keyTable?.length ?? 0) > 0;
    case 'bands':
      return (f.bands?.length ?? 0) > 0;
    case 'scalar':
      return step.op === 'constant'
        ? f.valueEGP !== undefined && f.valueEGP !== ''
        : f.scalar?.value !== undefined && f.scalar.value !== '';
    default:
      return true;
  }
}

/** Whether the bank turned this gate on. A gate with no figures does not apply. */
export function gateIsConfigured(
  gate: RuleGate,
  figures: StepFigures | undefined,
  configuredStepIds: ReadonlySet<string>,
): boolean {
  const f = figures ?? {};
  if (gate.kind === 'choice') return f.applies === true;
  if (gate.kind === 'numberByKey') return (f.keyTable?.length ?? 0) > 0;
  if (gate.right !== undefined) {
    return 'step' in gate.right ? configuredStepIds.has(gate.right.step) : true;
  }
  return (
    (f.minValue !== undefined && f.minValue !== '') ||
    (f.maxValue !== undefined && f.maxValue !== '')
  );
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
  if (!question) return [];
  // A TEXT answer is read for PRESENCE only, so the one row a bank can state a figure
  // against is the reserved key. Offered as a row rather than left empty: an empty list
  // reads as "this fact cannot be configured", and it can — with exactly one figure.
  if (question.type === 'TEXT') return [PRESENCE_FACT_OPTION];
  // SINGLE_SELECT and MULTI_SELECT share one list: a multi-pick is keyed by the SAME option
  // codes, several at a time, and the bank's row order decides which pick is read.
  return question.type === 'NUMERIC' ? [] : question.options;
}

/**
 * The key a TEXT-bound fact's table is keyed by, and its label.
 *
 * Mirrors `PRESENCE_FACT_LOOKUP_KEY` in `backend/src/matching/pipeline/fact-value.ts`. A
 * literal here rather than a fetched value because it is a CONTRACT, not data: the engine
 * looks this key up and the label is the operator's words for it.
 */
export const PRESENCE_FACT_LOOKUP_KEY = 'answered';

/**
 * Both label fields carry the SAME localized string on purpose: every consumer picks one
 * of the two by the running locale, and this row is not a registry value with a label per
 * language — it is the platform's own words for "the question was answered".
 */
const PRESENCE_FACT_OPTION = {
  code: PRESENCE_FACT_LOOKUP_KEY,
  get labelAr(): string {
    return presenceLabel();
  },
  get labelEn(): string {
    return presenceLabel();
  },
};

function presenceLabel(): string {
  return $localize`:@@income_rule.fact.presence_key:They answered the question`;
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
/**
 * A catalog program name's income rule, and who is reading it.
 *
 * `programs` is what lets the screen say "6 programs · 4 take these amounts · 2 set
 * their own" — and it is the same list the `INCOME_PROOF_IN_USE` refusal names, so the
 * operator sees who blocks a proof change before they attempt it rather than after.
 */
/**
 * One surrogate bank program filed under a catalog name.
 *
 * Declared once and used by both carriers, because they are the same list read from two
 * directions — a name's own programmes, and every programme reachable through a product.
 *
 * The NAMES matter as much as the code. One product is deliberately sold as several
 * programmes off one mechanism, so a list of bare codes cannot say which is which: ABK files
 * both `ABK-PER-DOCTORS_CLINIC` (30,000-300,000, capped by city tier) and
 * `ABK-PER-DOCTORS_PRACTICE` (half that, uncapped) under the one doctors name.
 */
export interface ProgramUnderName {
  programCode: string;
  friendlyName: string;
  /** Nullable on the column — fall back to `friendlyName`, never render an empty line. */
  friendlyNameAr: string | null;
  /** `null` when the programme is filed under no bank. */
  bankNameEn: string | null;
  bankNameAr: string | null;
  /** `false` when it takes the catalog's figures instead of typing its own. */
  ownAmounts: boolean;
}

export interface ProgramNameIncomeRule {
  programNameKey: string;
  labelAr: string;
  labelEn: string;
  /** `null` = nobody has decided. A surrogate program cannot be filed under it yet. */
  incomeRule: IncomeAssumptionConfig | null;
  valueSources: ValueSourceMap;
  programs: ProgramUnderName[];
  /**
   * The surrogate product this name takes its calculation from, or `null` when it states
   * its own rule.
   *
   * Carries the RULE, not just the key, and that is what the screen needs: `incomeRule`
   * above is NULL for a linked name, so without this the catalog page would have nothing
   * to render for the product it is selling. Shown read-only, with a link to the product.
   */
  surrogateProduct: {
    key: string;
    labelAr: string;
    labelEn: string;
    active: boolean;
    incomeRule: IncomeAssumptionConfig | null;
  } | null;
}

/** One surrogate product in the library list. */
export interface SurrogateProductSummary {
  key: string;
  labelAr: string;
  labelEn: string;
  active: boolean;
  /** The proof it reads. `null` = it states no calculation yet. */
  strategy: string | null;
  /** What the calculation arrives at: an assumed income, or a borrowing ceiling. */
  outputKind: 'monthlyIncome' | 'maxAmount' | null;
  /** How many ways of reaching that figure it offers. `null` = built by hand, so no form. */
  wayCount: number | null;
  /** Catalog names taking their calculation from it. Empty = nothing sells it yet. */
  usedBy: string[];
  /**
   * Programs capping their maximum by an answer this product asks for.
   *
   * The only measure of usage that finds a CAP-ONLY product: it works out no income, so no
   * catalog name may link to it and `usedBy` is empty however many banks quote a cap from it.
   *
   * Optional on the wire so this bundle still runs against a backend that predates it, and
   * absent reads as "none known" rather than as zero — the same posture `hasOwnIncomeRule`
   * takes, and for the same reason: a card must not invent a claim from a field nobody sent.
   */
  capPrograms?: string[];
}

// ---------------------------------------------------------------------------
// The friendly form
// ---------------------------------------------------------------------------
//
// Mirrors `backend/src/matching/pipeline/product-template.ts`. It is a MIRROR and not a
// second authority: the compile happens on the server, the screen sends these answers and
// renders the rule that comes back. Nothing here decides what a shape compiles to, so the
// two cannot disagree about it.

/** How the figure is worked out — the one question every product answers. */
export type TemplateMechanismKind =
  | 'choiceTable'
  | 'classTable'
  | 'numberBand'
  | 'shareOf'
  | 'multipleOf'
  | 'flatAmount';

export type TemplateMechanism =
  | { kind: 'choiceTable'; fact: string }
  | { kind: 'classTable'; fact: string }
  | { kind: 'numberBand'; fact: string }
  | { kind: 'shareOf'; fact: string }
  | { kind: 'multipleOf'; fact: string }
  | { kind: 'flatAmount' };

export type ConditionMeasure = { of: 'fact'; fact: string } | { of: 'answer' };

export type ConditionTest =
  | { op: 'atLeast' }
  | { op: 'atMost' }
  | { op: 'between' }
  | { op: 'oneOf'; expect: string[] }
  | { op: 'atLeastShareOf'; fact: string }
  | { op: 'atLeastPerAnswer'; keyedBy: string }
  | { op: 'atMostPerAnswer'; keyedBy: string };

export interface TemplateCondition {
  id: string;
  measure: ConditionMeasure;
  test: ConditionTest;
  reasonCode: GateReasonCode;
}

export interface ProductTemplate {
  version: 1;
  /**
   * The predefined product this form was started from, when it was.
   *
   * Provenance for the SCREEN — it is what lets the form reopen with this product's own rows,
   * worked examples and mechanism sentence instead of the generic three questions. The
   * compiler ignores it, so a product that predates the library reads exactly as it always
   * did.
   */
  blueprintKey?: string;
  outputKind: 'monthlyIncome' | 'maxAmount';
  baselineDbrPercent?: string;
  primary: TemplateMechanism;
  /** Superseded by `alternatives`; still read, so a row saved before it keeps working. */
  alternative?: TemplateMechanism;
  /** Every other way to reach the figure. Each bank fills in the ones it sells. */
  alternatives?: TemplateMechanism[];
  combine?: 'lower' | 'higher';
  secondColumn?: { fact: string; branches: string[]; branchOn?: 'answer' | 'parentClass' };
  uplift?: {
    fact: string;
    whenOption: string;
    otherwiseOption: string;
    /** What it lifts. `'income'` when unstated, which is what every stored form meant. */
    scope?: 'income' | 'maxLoan';
  };
  /**
   * The portion of the figure this applicant is lent against.
   *
   * Two shapes. `choice` is the bank's percentage switched on by one answer — the joint
   * ownership halving two sheets print. `statedPercent` is a percentage the APPLICANT states
   * as a number, and the figure is scaled by it; it carries no bank figure, so the editor
   * renders no box for it (`stepTakesFigures` — a scalar op with a second input).
   *
   * An absent `kind` reads as `'choice'`, which is what every form saved before the union
   * existed meant.
   */
  share?:
    | {
        kind?: 'choice';
        fact: string;
        whenOption: string;
        otherwiseOption: string;
        scope?: 'income' | 'maxLoan';
      }
    | { kind: 'statedPercent'; fact: string; scope?: 'income' | 'maxLoan' };
  iScore?: boolean;
  conditions: TemplateCondition[];
}

/** Which of the three shelves of the library a product sits on. */
export type BlueprintGroup = 'income' | 'ceiling' | 'cap';

/** One thing a predefined product asks, and whether the platform can already ask it. */
export interface ProductBlueprintAsk {
  factKey: string;
  kind: 'choice' | 'number' | 'bindQuestion' | 'platformFact' | 'derivedFact';
  questionCode?: string;
  listTypeKey?: string;
  factExists: boolean;
  questionExists: boolean;
  listExists: boolean;
  /**
   * Loan categories the question is not asked in yet.
   *
   * The half of "is this set up?" that is invisible on every other screen: a question can
   * exist and be assigned to no category, in which case it is asked of nobody and the product
   * reading it quotes its standard column for every applicant, silently.
   */
  missingCategories: LoanCategory[];
}

/** One predefined product. Structure and existence — the words are this bundle's. */
export interface ProductBlueprint {
  key: string;
  group: BlueprintGroup;
  /** The DEFAULT product name, which the operator may overwrite before saving. */
  labelEn: string;
  labelAr: string;
  outputKind: ProductTemplate['outputKind'] | null;
  wayCount: number;
  hasSecondColumn: boolean;
  conditionCount: number;
  hasCap: boolean;
  /** A question only a bank can answer, which changes every figure the product quotes. */
  openQuestion?: string;
  asks: ProductBlueprintAsk[];
  creates: { lists: number; values: number; questions: number; facts: number; widens: number };
  /** The brackets a published sheet prints, offered to the figures form. Edges, never amounts. */
  suggestedBands: Array<{
    wayIndex: number;
    /** The step id those brackets belong in, resolved by the server, which owns slot naming. */
    slotId: string;
    edges: Array<{ fromInclusive: string; toExclusive: string | null }>;
  }>;
}

/** What the form screen reads on open. */
export interface SurrogateProductTemplateResponse {
  key: string;
  labelAr: string;
  labelEn: string;
  template: ProductTemplate | null;
  /** What the stored form compiles to right now — rendered, never re-posted. */
  compiled: IncomeAssumptionConfig | null;
  /** True when the calculation was authored by hand, so there is no form to open. */
  advanced: boolean;
}

/** The bureau-score fact. One key for the whole platform — it is about the APPLICANT. */
export const I_SCORE_FACT_KEY = 'i_score';

/** A surrogate product's own workspace: the calculation, and everything reachable from it. */
export interface SurrogateProductDetail extends SurrogateProductSummary {
  incomeRule: IncomeAssumptionConfig | null;
  /** The form it was compiled from, or `null` when it was authored by hand. */
  template: ProductTemplate | null;
  valueSources: ValueSourceMap;
  names: Array<{
    key: string;
    /** What the name is called. A key that resolves to no row falls back to itself. */
    labelEn: string;
    labelAr: string;
    programs: ProgramUnderName[];
  }>;
}

/**
 * WHAT A PRODUCT ASKS THE APPLICANT — the wire shape of step ①'s board.
 *
 * Mirrors `backend/src/bank-programs/dto/product-asks.dto.ts`. One response for the read and
 * for both writes, so the screen absorbs a whole board per click rather than re-reading
 * three things that can disagree about what one tick did.
 */
/**
 * Why an untick is refused. No `blueprint_owned` — an ask that came with the product IS
 * removable; the server tombstones its row instead of deleting it so the seed cannot put it
 * back. Where the ask came from is `ProductAsk.source`, which is provenance, not a gate.
 */
export type ProductAskDetachReason = 'read_by_own_rule' | 'fact_still_read';

/**
 * The four question types, as the ask board's wire shape carries them.
 *
 * Declared here rather than imported from `features/lookups`: a feature bundle must not
 * reach into another feature's service for a type (the reach this repo has been undoing),
 * and the four values are the Prisma enum — they are the contract, not a copy of a decision
 * made somewhere else. Only two of them can ever be a FACT; the other two are listed on the
 * board precisely so the grid can say why they cannot.
 */
export type AskQuestionType = 'SINGLE_SELECT' | 'MULTI_SELECT' | 'NUMERIC' | 'TEXT';

/** One thing this product reads: a fact, the question behind it, and where it is asked. */
export interface ProductAsk {
  factKey: string;
  /** `blueprint` came with the predefined product. Rendered as provenance; still removable. */
  source: 'blueprint' | 'operator';
  /** `null` when the fact reads no question — broken, and rendered as broken. */
  questionCode: string | null;
  questionLabelAr: string;
  questionLabelEn: string;
  questionType: AskQuestionType | null;
  questionActive: boolean;
  /** The loan categories that ASK the question. Empty = asked of nobody. */
  askedIn: LoanCategory[];
  /** The registry list its options came from, when they came from one. Derived server-side. */
  listType: string | null;
  parentListType: string | null;
  /** Other products reading the same fact — what makes an untick's consequence visible. */
  alsoAskedBy: string[];
  detach: { ok: boolean; reason?: ProductAskDetachReason; meta?: Record<string, unknown> };
}

/**
 * Why a pool question cannot be a fact. Served, never derived here — one authority.
 *
 * One value left. Every question type is readable now (a key table over option codes, a
 * band table over a number, the presence of a text answer) and the six domain refusals —
 * the declared salary, the loan being asked for, one itemised debt, the derived bank axes —
 * are gone: what a fact MEANS is the operator's decision on this board. What remains can
 * only appear if the schema grows a type the platform has no reader for.
 */
export type AskIneligibleReason = 'unsupported_type';

/** One pool question as the grid renders it. EVERY active question is listed. */
export interface AskPoolQuestion {
  code: string;
  labelAr: string;
  labelEn: string;
  type: AskQuestionType;
  isRequired: boolean;
  categories: LoanCategory[];
  eligible: boolean;
  ineligibleReason?: AskIneligibleReason;
  /** The fact already reading this question — what a tick would JOIN rather than mint. */
  factKey: string | null;
  askedByThisProduct: boolean;
  askedByOtherProducts: string[];
}

export interface ProductAsksBoard {
  productKey: string;
  labelAr: string;
  labelEn: string;
  active: boolean;
  capOnly: boolean;
  asks: ProductAsk[];
  pool: AskPoolQuestion[];
  /**
   * Fact keys the product's own calculation reads.
   *
   * The half the ask set cannot answer: a rule may read a fact nobody filed, and an ask may
   * exist that the calculation does not read yet. Both are legitimate.
   */
  factsReadByRule: string[];
}

export interface AskWriteResult {
  changed: {
    factKey: string;
    factCreated: boolean;
    factBound: boolean;
    askAdded: boolean;
    askRemoved: boolean;
    factDeleted: boolean;
    /** Loan types this write STARTED asking the question in. Never a narrowing. */
    widened: LoanCategory[];
    /**
     * Whether a questionnaire version was cut.
     *
     * `false` with a non-empty `widened` is the one outcome a toast would lie about: the
     * assignment landed and no applicant is being served it yet.
     */
    published: boolean;
  };
  state: ProductAsksBoard;
}

/** Mirrors the server DTO — see `matching/pipeline/additional-income.ts`. */
export interface AdditionalIncomeConfig {
  sources: { factKey: string; percent: string }[];
  capPercentOfBasic?: string;
}

export interface IncomeAssumptionConfig {
  strategy: IncomeAssumptionStrategy;

  /**
   * Money the applicant earns beside the basic figure, counted at this bank's weight per
   * source and optionally capped as a share of the basic figure.
   *
   * A BANK policy, so it rides on both `amounts: 'own'` and `amounts: 'catalog'` — the
   * catalog states the calculation, not what a bank does with somebody's rent.
   */
  additionalIncome?: AdditionalIncomeConfig;

  /**
   * Whose figures the tables below are.
   *
   *   'own'      this bank typed them. The default, and what every saved program
   *              written before this field existed means — so ABSENT reads as `'own'`.
   *   'catalog'  they belong to the program NAME, and the server strips them before
   *              storing. Editing the catalog then moves this program's income.
   *
   * Only a bank program carries this. A catalog name's figures are its own by
   * definition, and the API drops the field from a catalog write.
   */
  amounts?: 'catalog' | 'own';

  keyTable?: IncomeKeyTableRow[];
  bands?: IncomeBand[];
  scalar?: { value: string; unit: 'percent' | 'multiplier' };

  // --- a step pipeline (`strategy: 'steps'`) ---
  //
  // Declared rather than cast at the point of use. Every reader of a catalog rule needs
  // these, `StepFigures` has always declared them, and the three computeds that reach for
  // them were each casting through a one-off structural type — four places agreeing by
  // hand about a shape the API has always sent.

  /**
   * STRUCTURE, and the catalog name's alone: which steps run, in what order, against
   * which facts. Merged onto every program under the name on every read; a bank program
   * never stores it, and the API strips it if one is sent.
   */
  steps?: RuleStep[];
  gates?: RuleGate[];
  /** Whether the last step yields an income or a borrowing ceiling. */
  output?: ProductRuleOutput;
  /**
   * Catalog-owned. `'exclusive'` when a bank program sells exactly ONE of the product's ways
   * of reaching the figure — see `@shared/income-rule/product-rule-ways.ts`. Absent reads as
   * combined, which is every product but the compound guarantee.
   */
  waysAre?: 'exclusive';
  /**
   * BANK-owned: which way this program sells, as that way's slot id (`primary` · `alt` ·
   * `alt__<fact>`). Absent on a product whose ways combine, and on every row written before
   * the field existed.
   */
  wayId?: string;
  /**
   * FIGURES, by step id and gate id. The bank's half — and on a CATALOG rule, the
   * defaults every bank under the name starts from.
   */
  stepParams?: Record<string, StepFigures>;

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

/**
 * The un-saved program a draft check runs against — the four blobs a quote reads.
 *
 * Not the whole create payload: a quote reads no program code, no bank name and no Arabic
 * friendly name, and a check that refused to run for want of one would be the disabled
 * button it replaces.
 */
export interface IncomeRuleDraftProgram {
  programNameKey?: string;
  productCategory: string;
  isShariaCompliant?: boolean;
  programType: ProgramType;
  tenor: TenorConfig;
  loanLimits: LoanLimitsConfig;
  pricing: PricingConfig;
  eligibility: EligibilityConfig;
  fees: FeesConfig;
}

export interface IncomeRuleDraftCheckPayload {
  program: IncomeRuleDraftProgram;
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
