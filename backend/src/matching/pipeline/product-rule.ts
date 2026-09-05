/**
 * Product rules — a multi-step, multi-fact rule evaluated by a registry of pure ops.
 *
 * Pure module: no Nest, no Prisma, no clock, no randomness (Constitution Principle V).
 * `Decimal` end to end, every figure a decimal STRING in the config (Principle I / A3).
 *
 * ─── Why this exists ──────────────────────────────────────────────────────────
 *
 * Every income method that predates this one reads ONE fact and looks it up in ONE
 * table ("military grade Major → 20 000"). A whole family of real products cannot be
 * said that way. The Compound Ownership Guarantee reads the unit's price, the share
 * already paid, the unit type, the compound, the contract year, how long ago the
 * contract was signed and whether the unit is jointly owned — and what it produces is
 * not an income at all but a BORROWING CEILING, which the bank then turns into an
 * instalment and reduces by the applicant's existing debts.
 *
 * Writing that per product is a branch per product, and a branch per bank behind it
 * (Principle II / A1). So the arithmetic becomes data: a list of STEPS, each naming a
 * generic op, and the ops live here.
 *
 * ─── The two things that make it safe ─────────────────────────────────────────
 *
 * 1. **The ops are arithmetic only.** No op knows what a loan is. The MEANING of the
 *    last step is declared once, in `output.kind`, and the conversion from a ceiling
 *    to money is done by the engine (`product-rule-ceiling.ts` + `quote.ts`) — never
 *    assembled by an operator. Nobody can build a pipeline that prices a loan wrongly
 *    because nobody can build a pipeline that prices a loan at all.
 *
 * 2. **Structure is the catalog name's, figures are the bank's.** A rule's `steps` /
 *    `gates` / `output` live on `platform_enumeration.incomeRule` and are merged onto
 *    every bank program under that name; the bank stores only `stepParams`. A fifth
 *    bank is a map of numbers, exactly as the source design demanded.
 *
 * ─── Deliberate reuse ─────────────────────────────────────────────────────────
 *
 * A step's table is `IncomeKeyTableRow[]` / `IncomeBand[]` — the SAME shapes the
 * single-fact rules use, with the same `incomeEGP` field name even when the figure is
 * an amount rather than an income. That is not sloppiness: it buys `bandFor`'s
 * half-open lookup, `validateKeyTable` / `validateBands`, the two existing admin
 * editors, and `markablePaths`' `keyTable`-by-key recursion for the estimated-value
 * markers. A parallel shape would have forked all five, and the field name is the
 * cheapest half of that trade.
 */

import { Decimal } from '@prisma/client/runtime/library';
import { PRODUCT_RULE_STRATEGY } from '../types';
import type { IncomeBand, IncomeKeyTableRow, SurrogateFactValue } from '../types';
import { bandFor } from './income-rule-bands';
import { factLookupKeys } from './fact-value';

/**
 * The token lives in `matching/types.ts` — re-exported here so a reader of this module
 * does not have to know that, and so the pair stays acyclic at runtime (that file
 * imports nothing).
 *
 * A token rather than a flag beside the strategy, for the reason `fact:` is a token:
 * every existing reader — the frozen `strategy` on an immutable offer, the admin's
 * method picker, `stripForeignMethodConfig`, the audit payload — already switches on
 * this one string, and a parallel field would leave each of them able to disagree about
 * which kind of rule it is holding.
 */
export { PRODUCT_RULE_STRATEGY };

/** True when a rule blob is a step pipeline rather than a single-fact method. */
export function isProductRule(strategy: string): boolean {
  return strategy === PRODUCT_RULE_STRATEGY;
}

// ---------------------------------------------------------------------------
// Ops
// ---------------------------------------------------------------------------

/**
 * The op set. Closed by intent, and small on purpose: a new PRODUCT must be data,
 * but a new OP is a code change with a test, because an op is arithmetic the whole
 * platform then trusts.
 *
 *   constant         a figure the bank states outright (its own amount ceiling)
 *   factNumber       a numeric answer, passed through exactly (never bucketed)
 *   factChoiceTable  a picked option → the bank's row for it
 *   factParentTable  a picked option → its registry PARENT → the bank's row for that
 *   bandTable        a number → the half-open band it falls in
 *   percentOf        value × pct ÷ 100
 *   upliftPercent    value × (1 + pct ÷ 100)
 *   multiply         value × multiplier
 *
 * ─── `coalesce`, and why a product needs it ───────────────────────────────────
 *
 * The four banks selling the compound product derive their ceiling from four different
 * things: one from the unit TYPE, one from the compound's CLASS, one from a band over the
 * amount already PAID, one as a PERCENTAGE of that amount. Those are four functions, not
 * four sets of numbers, so "the catalog states the steps and the bank states the figures"
 * cannot be met by a single fixed chain.
 *
 * So the catalog states all four derivations and closes with
 * `coalesce [byType, byClass, byBand, byPercent]`. Each bank fills in exactly the one it
 * uses; the others are left with no figures and are SKIPPED.
 *
 * Skipping is bounded, deliberately and narrowly:
 *
 *   - Only `rule_unconfigured` is skippable — "this bank stated nothing here". A fact the
 *     applicant did not answer, a key the table has no row for, a value outside every
 *     band: all of those still stop the rule and report their own reason. Otherwise an
 *     unanswered unit type would quietly fall through to another bank's derivation.
 *   - Every op checks ITS OWN configuration before it reads any fact, so an unconfigured
 *     step never demands an answer it has no use for.
 *   - A step outside every `coalesce` must be configured, enforced at SAVE
 *     (`unconfigured_step`), so this is not a licence to leave a rule half-written.
 *
 * ─── Factors ──────────────────────────────────────────────────────────────────
 *
 * The three scaling ops take their factor from the bank's `scalar` figure OR from a SECOND
 * input, and that is not a convenience. The compound product's down payment is the
 * CUSTOMER'S percentage of the CUSTOMER'S unit price — two answers, no bank figure
 * anywhere — and a params-only factor could not express it at all: the bank would have had
 * to state a down-payment percentage on behalf of every applicant.
 *   sum / subtract   value arithmetic across earlier steps
 *   minOf / maxOf    the binding one of several earlier steps
 *   coalesce         the first earlier step THIS BANK configured — see below
 */
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

export function isStepOp(op: string): op is StepOp {
  return (STEP_OPS as readonly string[]).includes(op);
}

/**
 * Where a value comes from.
 *
 * `step` may name only an EARLIER step — enforced at save time, and failed CLOSED at
 * run time (`rule_unconfigured`), so a hand-edited blob cannot read a value that does
 * not exist yet and quote on an accidental zero.
 *
 * `const` is a CATALOG literal (a platform constant such as the number of months in a
 * year), never a bank figure. Every bank figure is the params of some step, so that
 * "what did this bank state?" has exactly one answer and one set of markable paths.
 */
export type ValueRef = { step: string } | { fact: string } | { const: string };

/** The structural half of one step — authored on the catalog name. */
export interface RuleStep {
  /** Stable within the rule; the key its figures are stored under. */
  id: string;
  op: StepOp;
  /** `factNumber` / `factChoiceTable` / `factParentTable`: the fact key read. */
  fact?: string;
  /** Every other op: the value(s) operated on. A single ref is accepted for the n-ary ops. */
  of?: ValueRef | ValueRef[];
  /**
   * `pickByFact`: the option code each entry of `of` answers to, positionally.
   *
   * Structure, not figures — which column of a two-column table a given answer reads is the
   * product's shape, the same as the step list itself, so it belongs to the catalog and not
   * to any bank. A bank states only the two columns' numbers.
   */
  branches?: string[];
  /**
   * `pickByFact`: whether `branches` name the ANSWER's own option codes (the default) or
   * the CLASS each answer is filed under.
   *
   * ─── Why this exists ──────────────────────────────────────────────────────────
   *
   * A column is picked by matching an option code, so a column per CLASS was inexpressible:
   * one bank tiers cities as Cairo & Alex against everything else, another tiers eight
   * governorates against everything else, and the platform's answer to that is one list of
   * 27 governorates filed under three tiers (`city_tier`). Keyed by the answer, that column
   * would need all 27 codes spelled into `branches` — and the next governorate added to the
   * list would silently read the standard column at every bank.
   *
   * `factParentTable` already walks a value up to its class, and this is the same walk for
   * the same reason, on the axis instead of the row.
   *
   * A FIELD, not a new op: the arithmetic is unchanged; what changes is which code the
   * branch list is compared against. Absent reads as `'answer'`, so every stored rule
   * compiles and evaluates exactly as before.
   *
   * A value filed under NO class falls back to the first configured input, like an
   * unanswered question — a column is not a requirement, and the standard column can price
   * that applicant. (`factParentTable` answers `no_matching_row` in the same situation,
   * correctly: there the class IS the row being read, and there is nothing to fall back to.)
   */
  branchOn?: 'answer' | 'parentClass';
  /**
   * The three fact ops only: an UNANSWERED fact reads as `rule_unconfigured` (skippable by
   * an enclosing `coalesce`) instead of `fact_not_answered` (which stops the rule).
   *
   * ─── Why this exists, and why it is not the default ───────────────────────────
   *
   * The default is deliberate and stays: an unanswered unit type must NOT quietly fall
   * through to another bank's derivation, so a missing answer stops the rule and reports
   * itself. That is the guarantee the whole `coalesce` design rests on.
   *
   * But one real shape needs the opposite, and cannot express it any other way. An
   * ADJUSTMENT the customer is asked about optionally — the bureau score, whose multiplier
   * falls back to 100% when they decline to give it — reads a fact that legitimately has no
   * answer. Written the obvious way (`factNumber → bandTable → coalesce [ band, {const} ]`)
   * the `factNumber` returns `fact_not_answered` and the evaluator returns before the
   * `coalesce` is ever reached: one skipped optional question, and every quote dies.
   *
   * `pickByFact` already solves exactly this for CHOICE facts — it reads the answer itself
   * and falls back to the first configured column, and its own doc says why ("an unanswered
   * segment is not a missing requirement"). This flag is that same reading, made available
   * to a NUMERIC fact, which `pickByFact` cannot serve because it matches an option code.
   *
   * A FIELD, not a new op: the arithmetic is unchanged: what changes is which of two
   * existing reasons an absent answer reports.
   *
   * Fenced at SAVE (`optional_step_not_skippable`): every path from an optional step to the
   * answer must pass through a `coalesce` that offers another candidate. Without that fence
   * the flag is a way to make a REQUIRED answer silently vanish, which is the exact damage
   * the default exists to prevent.
   */
  optional?: boolean;
  /**
   * `minOf` / `maxOf` only: a member this bank left blank is SKIPPED instead of stopping the
   * comparison.
   *
   * ─── Why this exists ──────────────────────────────────────────────────────────
   *
   * `reduceRefs` fails closed — the first member that cannot resolve is the answer — which is
   * correct for a hand-written `minOf` over figures the rule author knows are all present.
   * It is wrong for the one shape the template compiles: N ways of reaching the figure, of
   * which each bank fills the ones it sells and leaves the rest blank.
   *
   * At N=2 the wrapper `coalesce [ minOf, a, b ]` covered it — both filled, the comparison
   * wins; one filled, the comparison is unconfigured and the coalesce takes the one that is.
   * At N=3 that stops being true: a bank filling two of three leaves the comparison
   * unconfigured, and the coalesce falls through to the FIRST of the three alone — silently
   * dropping the clamp the bank's second table was there to apply.
   *
   * With this flag the comparison means "the lowest of the ways THIS BANK filled", which is
   * what the screen says it means, at any N.
   *
   * A FIELD, not a new op, and not the default: `rule_unconfigured` is the only reason it
   * absorbs. An unanswered fact, a key with no row, a value outside every band all still
   * stop the rule and report themselves — a bank that stated a table must not be quoted as
   * though it had not.
   */
  skipUnset?: boolean;
}

/** The figures half of one step — stated per bank (or inherited from the catalog). */
export interface StepParams {
  /** `constant`. */
  valueEGP?: string;
  /** `factChoiceTable` / `factParentTable`. Keys are option codes / parent keys. */
  keyTable?: IncomeKeyTableRow[];
  /** `bandTable`. Ordered, half-open, last band open-ended. */
  bands?: IncomeBand[];
  /** `percentOf` / `upliftPercent` / `multiply`. */
  scalar?: { value: string; unit: 'percent' | 'multiplier' };
}

// ---------------------------------------------------------------------------
// Gates
// ---------------------------------------------------------------------------

/**
 * Why a gate refused, from a CLOSED platform list.
 *
 * A gate id is operator-authored, so it can never have a translation. A reason code
 * can: every one of these has an entry in both locale dictionaries, and the engine returns
 * the code and no prose (Principle III / A2). `GATE_NOT_MET` is the honest fallback
 * for a gate whose meaning the platform has no word for yet.
 */
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

export function isGateReasonCode(code: string): code is GateReasonCode {
  return (GATE_REASON_CODES as readonly string[]).includes(code);
}

export const GATE_NUMBER_OPS = ['gte', 'lte', 'gt', 'lt', 'between'] as const;
export const GATE_CHOICE_OPS = ['eq', 'neq', 'in'] as const;

export type RuleGate =
  /**
   * Compare a value against a bound the bank states, or against ANOTHER value.
   *
   * `right` exists because a real requirement is sometimes itself derived: one bank asks for
   * 20% down on a unit over 15 million and 40% under 10, so the required percentage is a
   * band over the price, and the gate compares one computed step against another.
   */
  | {
      id: string;
      kind: 'number';
      op: (typeof GATE_NUMBER_OPS)[number];
      left: ValueRef;
      right?: ValueRef;
      reasonCode: GateReasonCode;
    }
  /**
   * Compare a value against the bank's row for ANOTHER answer — the unit-price floor
   * that differs per contract year. One gate, not five, and the years the bank cares
   * about are its own table's keys.
   */
  | {
      id: string;
      kind: 'numberByKey';
      op: 'gte' | 'lte';
      left: ValueRef;
      keyedBy: string;
      reasonCode: GateReasonCode;
    }
  /** Compare a picked option CODE against a list the catalog states. */
  | {
      id: string;
      kind: 'choice';
      op: (typeof GATE_CHOICE_OPS)[number];
      fact: string;
      expect: string[];
      reasonCode: GateReasonCode;
    };

/**
 * A gate's figures, stored per gate id in the same params map as steps.
 *
 * **A gate applies only when the bank has turned it on**, and "turned on" means it has
 * figures here: a bound for a `number` gate, a table for a `numberByKey` gate, an explicit
 * `applies: true` for a `choice` gate (which has no figure of its own to state).
 *
 * That is the same posture `checkEligibility` already takes with its allow-lists — a
 * missing list does not restrict rather than rejecting everyone — and it is what lets ONE
 * catalog frame offer four banks' different down-payment rules while each bank turns on the
 * one it actually applies. A partially filled gate is still refused at save (an inverted
 * window, a bad row), so this is not a licence to leave one half-written.
 */
export interface GateParams {
  minValue?: string;
  maxValue?: string;
  /** `numberByKey`: the floor/ceiling per key of the gate's `keyedBy` fact. */
  keyTable?: IncomeKeyTableRow[];
  /**
   * `choice` gates only: the bank applies this condition. Absent reads as "not applied" —
   * the catalog offers the condition, the bank opts in, and a bank that says nothing is not
   * silently given a refusal rule it never chose.
   */
  applies?: boolean;
}

// ---------------------------------------------------------------------------
// The rule
// ---------------------------------------------------------------------------

/**
 * What the last step MEANS.
 *
 *   monthlyIncome  the figure is an assumed monthly income — every rule that predates
 *                  this module, expressed in the new shape.
 *   maxAmount      the figure is a borrowing CEILING. The engine converts it into the
 *                  instalment it implies, and clamps the program maximum to it.
 *
 * `baselineDbrPercent` is the cap the ceiling was calibrated against. A bank that
 * varies its cap by employment (50% salaried / 40% self-employed) states the baseline
 * once here, and the ratio the source design calls `dbrRatio` falls out of the two
 * numbers with no third setting to keep in step.
 */
export interface ProductRuleOutput {
  kind: 'monthlyIncome' | 'maxAmount';
  /** The step id whose value is the answer. */
  from: string;
  baselineDbrPercent?: string;
}

export interface ProductRule {
  strategy: string;
  steps?: RuleStep[];
  gates?: RuleGate[];
  output?: ProductRuleOutput;
  /**
   * `'exclusive'` when a bank program sells exactly ONE of this product's ways of reaching
   * the figure. Absent reads as combined — see `ProductTemplate.waysAre` and
   * `product-rule-ways.ts`.
   *
   * STRUCTURE, so it belongs to the catalog exactly as `steps` does: it is a statement about
   * the product, not about one bank. The EVALUATOR ignores it entirely — `emitBasis` already
   * returns the one filled way's figure — and it is read only where a save is refused and
   * where the catalog's figures are inherited.
   */
  waysAre?: 'exclusive';
  /**
   * BANK-owned: which way this program sells, as that way's slot id. Read only where a save
   * is refused and where the catalog's figures are pruned; the evaluator never looks at it.
   */
  wayId?: string;
  /** Figures by step id AND gate id. Absent when the rule inherits catalog amounts. */
  stepParams?: Record<string, StepParams & GateParams>;
}

export interface StepTrace {
  id: string;
  op: StepOp;
  valueEGP: string;
  /** The row or band the figure came from, when a table produced it. */
  matchedRow?: { key: string } | { fromInclusive: string; toExclusive: string | null };
}

export interface GateTrace {
  id: string;
  reasonCode: GateReasonCode;
  passed: boolean;
}

/**
 * Why a rule produced nothing. The first four are the SAME four reasons the
 * single-fact resolver reports, on purpose: the surfaces that already explain them,
 * and the admin actions they point at, do not change because the rule got longer.
 */
export type ProductRuleMissReason =
  | 'fact_not_answered'
  | 'no_matching_row'
  | 'no_matching_band'
  | 'rule_unconfigured'
  | 'gate_failed';

export type ProductRuleOutcome =
  | {
      ok: true;
      kind: 'monthlyIncome' | 'maxAmount';
      valueEGP: Decimal;
      steps: StepTrace[];
      gates: GateTrace[];
      matchedRow?: StepTrace['matchedRow'];
    }
  | {
      ok: false;
      reason: ProductRuleMissReason;
      /** The fact that was not answered, when that is the reason. */
      factKey?: string;
      /** The step or gate that could not be resolved. */
      stepId?: string;
      gateId?: string;
      gateReasonCode?: GateReasonCode;
      steps: StepTrace[];
      gates: GateTrace[];
    };

export interface ProductRuleContext {
  /** Every fact the applicant answered, by fact key. Absent key = not answered. */
  facts: Readonly<Record<string, SurrogateFactValue>>;
  /**
   * For `factParentTable`: a lookup VALUE → the `parentKey` of its registry row.
   *
   * One flat map rather than one per fact, because that is the shape of the data: the
   * option codes of a lookup-backed question ARE the registry keys, and `parentKey` is a
   * column on the registry row, so the answer does not depend on which fact asked. Keys
   * are unique per (type, key) and a value is only looked up when a rule asks for its
   * parent, so a same-key collision across two lookup types cannot reach a rule that did
   * not name one of them.
   *
   * Passed in rather than looked up, so this module stays pure (Principle V). It is what
   * lets a customer pick a compound by NAME while the bank keys its table by the five
   * compound CATEGORIES — instead of the client-side substring match against a hardcoded
   * list of "high-end" compound names that the source prototype used, and got wrong.
   */
  parentKeyByValue?: Readonly<Record<string, string>>;
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

const ROUND_BANKERS = Decimal.ROUND_HALF_EVEN;
const ONE_HUNDRED = new Decimal(100);

/** One op's result: a figure, or the reason there is none. */
type OpMiss = { ok: false; reason: ProductRuleMissReason; factKey?: string };

type OpResult = { ok: true; value: Decimal; matchedRow?: StepTrace['matchedRow'] } | OpMiss;

interface OpEnv {
  step: RuleStep;
  params: StepParams;
  ctx: ProductRuleContext;
  values: Map<string, Decimal>;
  /**
   * Steps that produced no value because this bank stated no figures for them.
   *
   * Only `coalesce` may look here. Every other reference to such a step fails closed, so
   * "the bank left this blank" cannot leak into arithmetic as a zero.
   */
  unset: Set<string>;
}

/** Tolerant parse: a malformed figure yields null rather than throwing (Principle V). */
function toDecimalOrNull(value: string | null | undefined): Decimal | null {
  if (value === null || value === undefined || value === '') return null;
  try {
    const parsed = new Decimal(value);
    return parsed.isFinite() ? parsed : null;
  } catch {
    return null;
  }
}

function round2(value: Decimal): Decimal {
  return value.toDecimalPlaces(2, ROUND_BANKERS);
}

/** Resolve one reference. `undefined` means "not resolvable", never "zero". */
function refValue(ref: ValueRef, env: OpEnv): OpResult {
  if ('step' in ref) {
    const value = env.values.get(ref.step);
    // Unknown or forward reference: fail closed. Substituting 0 here would quote a
    // ceiling of nothing and report it as a real figure.
    if (value === undefined) return { ok: false, reason: 'rule_unconfigured' };
    return { ok: true, value };
  }
  if ('const' in ref) {
    const parsed = toDecimalOrNull(ref.const);
    if (parsed === null) return { ok: false, reason: 'rule_unconfigured' };
    return { ok: true, value: parsed };
  }
  return numericFact(ref.fact, env.ctx);
}

/** A numeric answer, exactly as given — no bucket-to-midpoint approximation (FR-018). */
function numericFact(factKey: string, ctx: ProductRuleContext): OpResult {
  const answered = ctx.facts[factKey];
  if (!answered) return { ok: false, reason: 'fact_not_answered', factKey };
  if (answered.kind !== 'numeric') return { ok: false, reason: 'rule_unconfigured' };
  return { ok: true, value: answered.value };
}

/** The refs an n-ary op operates on, normalised from `of`. */
function refList(step: RuleStep): ValueRef[] {
  if (step.of === undefined) return [];
  return Array.isArray(step.of) ? step.of : [step.of];
}

function firstRef(step: RuleStep, env: OpEnv): OpResult {
  const refs = refList(step);
  const ref = refs[0];
  if (ref === undefined) return { ok: false, reason: 'rule_unconfigured' };
  return refValue(ref, env);
}

/**
 * The keys a key-shaped fact can be looked up by — one for a single pick, several for a
 * multi-pick, one reserved key for the presence of a text answer.
 *
 * A NUMERIC answer offers none and reads as `rule_unconfigured`: a step keyed by a table
 * cannot read a number, and that is a mismatch between the rule and the question rather
 * than anything the applicant did.
 */
function choiceFact(
  factKey: string | undefined,
  ctx: ProductRuleContext,
):
  | { ok: true; keys: readonly string[] }
  | { ok: false; reason: ProductRuleMissReason; factKey?: string } {
  if (!factKey) return { ok: false, reason: 'rule_unconfigured' };
  const answered = ctx.facts[factKey];
  if (!answered) return { ok: false, reason: 'fact_not_answered', factKey };
  const keys = factLookupKeys(answered);
  if (keys.length === 0) return { ok: false, reason: 'rule_unconfigured' };
  return { ok: true, keys };
}

/**
 * "The applicant did not answer" read as "this bank stated nothing here", for a step the
 * catalog marked `optional`.
 *
 * ONLY that one reason is downgraded. A key the table has no row for, a value outside every
 * band, a fact answered in the wrong shape — all still stop the rule and report themselves,
 * because none of them is the customer declining an optional question.
 */
function skipIfOptional<T extends { ok: true }>(step: RuleStep, result: T | OpMiss): T | OpMiss {
  if (result.ok || result.reason !== 'fact_not_answered' || step.optional !== true) return result;
  return { ok: false, reason: 'rule_unconfigured' };
}

/**
 * A key table lookup. Fails CLOSED on a key the table has no row for (AS-1.9).
 *
 * Takes the CANDIDATE keys, not one key, and reads the first row the table itself lists
 * among them — so a multi-pick answer resolves by the bank's own row order, the rule
 * `fact-value.ts` states once for every reader.
 */
function lookupKeyTable(keys: readonly string[], table: IncomeKeyTableRow[] | undefined): OpResult {
  if (!table || table.length === 0) return { ok: false, reason: 'rule_unconfigured' };
  if (keys.length === 0) return { ok: false, reason: 'rule_unconfigured' };
  const row = table.find((r) => keys.includes(r.key));
  if (!row) return { ok: false, reason: 'no_matching_row' };
  const value = toDecimalOrNull(row.incomeEGP);
  if (value === null) return { ok: false, reason: 'rule_unconfigured' };
  return { ok: true, value, matchedRow: { key: row.key } };
}

/**
 * The op registry — name → pure function.
 *
 * The first of its kind in this codebase, and the reason is Principle II: every other
 * dispatch here is a `switch` over a closed set of METHODS, where adding one is
 * accepted to be a release. Adding a PRODUCT must not be, so the thing a product is
 * assembled from has to be addressable by name.
 */
const OPS: Readonly<Record<StepOp, (env: OpEnv) => OpResult>> = Object.freeze({
  constant: (env) => {
    const value = toDecimalOrNull(env.params.valueEGP);
    return value === null ? { ok: false, reason: 'rule_unconfigured' } : { ok: true, value };
  },

  factNumber: (env) =>
    env.step.fact === undefined
      ? { ok: false, reason: 'rule_unconfigured' }
      : skipIfOptional(env.step, numericFact(env.step.fact, env.ctx)),

  factChoiceTable: (env) => {
    // CONFIGURATION FIRST, answer second. An unconfigured step must not demand an answer
    // it has no use for: inside a `coalesce` this is the derivation this bank does not use,
    // and reading the fact would report "you did not answer" about a question that is
    // irrelevant to it.
    if (!env.params.keyTable?.length) return { ok: false, reason: 'rule_unconfigured' };
    const picked = skipIfOptional(env.step, choiceFact(env.step.fact, env.ctx));
    if (!picked.ok) return picked;
    return lookupKeyTable(picked.keys, env.params.keyTable);
  },

  factParentTable: (env) => {
    if (!env.params.keyTable?.length) return { ok: false, reason: 'rule_unconfigured' };
    const picked = skipIfOptional(env.step, choiceFact(env.step.fact, env.ctx));
    if (!picked.ok) return picked;
    // The first picked value that IS filed under a class. A single pick has one candidate,
    // so this is unchanged for every product that predates multi-pick facts.
    const parentKeys = picked.keys
      .map((key) => env.ctx.parentKeyByValue?.[key])
      .filter((key): key is string => key !== undefined);
    // The picked value carries no parent: the registry row was never filed under one.
    // `no_matching_row` rather than `rule_unconfigured` — the bank's table is fine, it
    // is this one value that cannot be placed, and the admin fix is on the value.
    if (parentKeys.length === 0) return { ok: false, reason: 'no_matching_row' };
    return lookupKeyTable(parentKeys, env.params.keyTable);
  },

  bandTable: (env) => {
    if (!env.params.bands?.length) return { ok: false, reason: 'rule_unconfigured' };
    const input = firstRef(env.step, env);
    if (!input.ok) return input;
    const found = bandFor(input.value, env.params.bands);
    if (!found.matched) {
      return {
        ok: false,
        reason: found.reason === 'no_bands' ? 'rule_unconfigured' : 'no_matching_band',
      };
    }
    return {
      ok: true,
      value: found.incomeEGP,
      matchedRow: {
        fromInclusive: found.band.fromInclusive,
        toExclusive: found.band.toExclusive ?? null,
      },
    };
  },

  percentOf: (env) => {
    // Same order as the table ops: a step whose factor this bank never stated is
    // unconfigured, and says so before asking the applicant for anything.
    if (!configuredFactor(env)) return { ok: false, reason: 'rule_unconfigured' };
    const input = firstRef(env.step, env);
    if (!input.ok) return input;
    const pct = scalingFactor(env);
    if (!pct.ok) return pct;
    return { ok: true, value: round2(input.value.mul(pct.value).div(ONE_HUNDRED)) };
  },

  upliftPercent: (env) => {
    // Same order as the table ops: a step whose factor this bank never stated is
    // unconfigured, and says so before asking the applicant for anything.
    if (!configuredFactor(env)) return { ok: false, reason: 'rule_unconfigured' };
    const input = firstRef(env.step, env);
    if (!input.ok) return input;
    const pct = scalingFactor(env);
    if (!pct.ok) return pct;
    return {
      ok: true,
      value: round2(input.value.mul(ONE_HUNDRED.plus(pct.value)).div(ONE_HUNDRED)),
    };
  },

  multiply: (env) => {
    // Same order as the table ops: a step whose factor this bank never stated is
    // unconfigured, and says so before asking the applicant for anything.
    if (!configuredFactor(env)) return { ok: false, reason: 'rule_unconfigured' };
    const input = firstRef(env.step, env);
    if (!input.ok) return input;
    const mult = scalingFactor(env);
    if (!mult.ok) return mult;
    return { ok: true, value: round2(input.value.mul(mult.value)) };
  },

  sum: (env) => {
    const refs = refList(env.step);
    if (refs.length === 0) return { ok: false, reason: 'rule_unconfigured' };
    let total = new Decimal(0);
    for (const ref of refs) {
      const part = refValue(ref, env);
      if (!part.ok) return part;
      total = total.plus(part.value);
    }
    return { ok: true, value: total };
  },

  subtract: (env) => {
    const refs = refList(env.step);
    // Exactly two, and ordered: `a − b`. A variadic subtract would make the operand
    // order load-bearing in a way a two-element list already states.
    if (refs.length !== 2) return { ok: false, reason: 'rule_unconfigured' };
    const [leftRef, rightRef] = refs as [ValueRef, ValueRef];
    const left = refValue(leftRef, env);
    if (!left.ok) return left;
    const right = refValue(rightRef, env);
    if (!right.ok) return right;
    // NOT floored at zero: a negative intermediate is a real answer, and clamping it
    // here would hide it from the `maxOf` the rule author is expected to write.
    return { ok: true, value: left.value.minus(right.value) };
  },

  minOf: (env) => reduceRefs(env, (a, b) => (a.lessThan(b) ? a : b)),
  maxOf: (env) => reduceRefs(env, (a, b) => (a.greaterThan(b) ? a : b)),

  /**
   * The first input this bank actually configured.
   *
   * Only STEP references can be skipped, and only because the step was left unconfigured —
   * a fact reference or a literal has nothing to leave blank, so it is taken as given.
   */
  coalesce: (env) => {
    const refs = refList(env.step);
    if (refs.length === 0) return { ok: false, reason: 'rule_unconfigured' };
    for (const ref of refs) {
      if ('step' in ref && env.unset.has(ref.step)) continue;
      const candidate = refValue(ref, env);
      // A CONFIGURED candidate that could not resolve stops the rule with its own reason.
      // Falling through to the next derivation would price the applicant off a rule this
      // bank does not sell.
      if (!candidate.ok) return candidate;
      return candidate;
    }
    // Every candidate was left blank. Refused at save (`unconfigured_step` /
    // `coalesce_empty`), so this is only reachable for a hand-edited row.
    return { ok: false, reason: 'rule_unconfigured' };
  },

  /**
   * The input whose BRANCH matches an answer — a table with two columns instead of one.
   *
   * `coalesce` picks the derivation THIS BANK configured; this picks the column THIS
   * APPLICANT falls in, and the two compose (a bank's cap basis is a `pickByFact` over its
   * two columns, and the `coalesce` above chooses between banks' bases). One bank lends
   * more to a customer it already has, and the uplift is not a single percentage — 2M→3M on
   * an apartment but 4M→4.5M on a villa — so it cannot be a `percentOf` over one column.
   *
   * Falls back to the FIRST configured input, deliberately, in two cases:
   *   · the applicant did not answer — the question behind a segment is optional, and a
   *     missing answer must not refuse a program the standard column can price;
   *   · this bank left the matching column blank — a bank that does not sell the second
   *     column quotes its standard one rather than nothing.
   * Neither is `fact_not_answered`: an unanswered segment is not a missing requirement.
   */
  pickByFact: (env) => {
    const refs = refList(env.step);
    if (refs.length === 0) return { ok: false, reason: 'rule_unconfigured' };
    const usable = (ref: ValueRef): boolean => !('step' in ref) || !env.unset.has(ref.step);

    const answered = env.step.fact === undefined ? undefined : env.ctx.facts[env.step.fact];
    if (answered !== undefined && answered.kind !== 'numeric') {
      // The codes the branches are compared against: the answers themselves, or the classes
      // they are filed under. An unfiled value contributes nothing and falls through to the
      // first configured input below, exactly as an unanswered question does.
      const codes = (
        env.step.branchOn === 'parentClass'
          ? factLookupKeys(answered).map((key) => env.ctx.parentKeyByValue?.[key])
          : factLookupKeys(answered)
      ).filter((code): code is string => code !== undefined);
      // BRANCH order decides, not pick order: `branches` is the catalog's positional list
      // against `of`, so the earliest branch the applicant matches is the column read.
      const branches = env.step.branches ?? [];
      const index = branches.findIndex((branch) => codes.includes(branch));
      const chosen = index === -1 ? undefined : refs[index];
      if (chosen !== undefined && usable(chosen)) return refValue(chosen, env);
    }

    for (const ref of refs) {
      if (usable(ref)) return refValue(ref, env);
    }
    return { ok: false, reason: 'rule_unconfigured' };
  },
});

/** Whether a scaling step has a factor at all — a second input, or a stated scalar. */
function configuredFactor(env: OpEnv): boolean {
  if (refList(env.step).length >= 2) return true;
  return toDecimalOrNull(env.params.scalar?.value) !== null;
}

/**
 * The factor a scaling op applies: a SECOND input when the step names one, else the bank's
 * own `scalar` figure.
 *
 * The second input wins when present, and the two are never combined. A step that reads a
 * percentage from an answer has no use for a bank figure as well, and multiplying by both
 * would be a rule nobody could read off the screen.
 */
function scalingFactor(env: OpEnv): OpResult {
  const refs = refList(env.step);
  const second = refs[1];
  if (second !== undefined) return refValue(second, env);

  const stated = toDecimalOrNull(env.params.scalar?.value);
  return stated === null ? { ok: false, reason: 'rule_unconfigured' } : { ok: true, value: stated };
}

function reduceRefs(env: OpEnv, pick: (a: Decimal, b: Decimal) => Decimal): OpResult {
  const refs = refList(env.step);
  if (refs.length === 0) return { ok: false, reason: 'rule_unconfigured' };
  const skipUnset = env.step.skipUnset === true;
  let acc: Decimal | null = null;
  for (const ref of refs) {
    // Same test the `coalesce` applies, and for the same reason: only a STEP the bank left
    // unconfigured may be skipped. A fact reference or a literal has nothing to leave blank.
    if (skipUnset && 'step' in ref && env.unset.has(ref.step)) continue;
    const part = refValue(ref, env);
    if (!part.ok) return part;
    acc = acc === null ? part.value : pick(acc, part.value);
  }
  // Every member skipped reads as "this bank stated none of them", which is skippable in
  // turn — the enclosing `coalesce` is what decides whether that is a legal outcome.
  return acc === null ? { ok: false, reason: 'rule_unconfigured' } : { ok: true, value: acc };
}

// ---------------------------------------------------------------------------
// Gates
// ---------------------------------------------------------------------------

type GateResult =
  | { ok: true; passed: boolean }
  | { ok: false; reason: ProductRuleMissReason; factKey?: string };

function evaluateGate(
  gate: RuleGate,
  env: Omit<OpEnv, 'step' | 'params'> & { params: GateParams },
): GateResult {
  if (gate.kind === 'choice') {
    const picked = choiceFact(gate.fact, env.ctx);
    if (!picked.ok) return picked;
    // Passes when ANY answer the applicant gave is listed. `expect` is an allow-list, so
    // one matching pick is the answer being present in it.
    const listed = picked.keys.some((key) => gate.expect.includes(key));
    return { ok: true, passed: gate.op === 'neq' ? !listed : listed };
  }

  if (gate.kind === 'number' && gate.right !== undefined) {
    const stepEnv = gateEnv(gate, env);
    const left = refValue(gate.left, stepEnv);
    if (!left.ok) return left;
    const right = refValue(gate.right, stepEnv);
    if (!right.ok) return right;
    return { ok: true, passed: compareNumbers(gate.op, left.value, right.value, right.value) };
  }

  const stepEnv = gateEnv(gate, env);
  const left = refValue(gate.left, stepEnv);
  if (!left.ok) return left;

  if (gate.kind === 'numberByKey') {
    const picked = choiceFact(gate.keyedBy, env.ctx);
    if (!picked.ok) return picked;
    const bound = lookupKeyTable(picked.keys, env.params.keyTable);
    if (!bound.ok) return bound;
    return {
      ok: true,
      passed:
        gate.op === 'gte'
          ? left.value.greaterThanOrEqualTo(bound.value)
          : left.value.lessThanOrEqualTo(bound.value),
    };
  }

  const min = toDecimalOrNull(env.params.minValue);
  const max = toDecimalOrNull(env.params.maxValue);
  if (min === null && max === null) return { ok: false, reason: 'rule_unconfigured' };
  return {
    ok: true,
    passed: compareNumbers(gate.op, left.value, min ?? left.value, max ?? left.value),
  };
}

/** A gate's left/right refs are resolved in the step world, minus a step of its own. */
function gateEnv(
  gate: RuleGate,
  env: Omit<OpEnv, 'step' | 'params'> & { params: GateParams },
): OpEnv {
  return {
    step: { id: gate.id, op: 'constant' },
    params: {},
    ctx: env.ctx,
    values: env.values,
    unset: env.unset,
  };
}

function compareNumbers(
  op: (typeof GATE_NUMBER_OPS)[number],
  left: Decimal,
  min: Decimal,
  max: Decimal,
): boolean {
  switch (op) {
    case 'gte':
      return left.greaterThanOrEqualTo(min);
    case 'gt':
      return left.greaterThan(min);
    case 'lte':
      return left.lessThanOrEqualTo(max);
    case 'lt':
      return left.lessThan(max);
    case 'between':
      return left.greaterThanOrEqualTo(min) && left.lessThanOrEqualTo(max);
    default:
      return false;
  }
}

/**
 * Whether the bank turned this gate on. See `GateParams`.
 *
 * A gate comparing against another STEP is on when that step produced a value: the
 * requirement is derived, so the bank turned it on by configuring the step it derives from.
 */
export function isGateConfigured(
  gate: RuleGate,
  figures: GateParams,
  setStepIds: ReadonlySet<string>,
): boolean {
  if (gate.kind === 'choice') return figures.applies === true;
  if (gate.kind === 'numberByKey') return (figures.keyTable?.length ?? 0) > 0;
  if (gate.right !== undefined) {
    return 'step' in gate.right ? setStepIds.has(gate.right.step) : true;
  }
  return (
    (figures.minValue !== undefined && figures.minValue !== '') ||
    (figures.maxValue !== undefined && figures.maxValue !== '')
  );
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Run a product rule. Never throws (Principle V) — a broken rule reports a reason the
 * surfaces already know how to explain, and the program stays listed and ranked.
 *
 * Order is load-bearing and matches the source design: STEPS first, GATES second. A
 * gate legitimately compares a computed step (the down-payment AMOUNT is a step; the
 * floor it must clear is the bank's figure), so gates cannot run first — and a gate
 * that fails still returns the step trace, which is what lets the admin check panel
 * show the operator the figures behind a refusal instead of an empty panel.
 */
export function evaluateProductRule(
  rule: ProductRule,
  ctx: ProductRuleContext,
): ProductRuleOutcome {
  const steps = rule.steps ?? [];
  const params = rule.stepParams ?? {};
  const trace: StepTrace[] = [];
  const gateTrace: GateTrace[] = [];

  if (steps.length === 0 || !rule.output?.from) {
    return { ok: false, reason: 'rule_unconfigured', steps: trace, gates: gateTrace };
  }

  const values = new Map<string, Decimal>();
  const unset = new Set<string>();
  const rows = new Map<string, StepTrace['matchedRow']>();

  // Only the steps this bank's own configuration reaches — see `neededStepIds`. A step no
  // gate of theirs compares and the answer never reads is not evaluated at all, so it
  // cannot demand a fact on their behalf.
  const needed = neededStepIds(rule);

  for (const step of steps) {
    if (!needed.has(step.id)) continue;
    const op = OPS[step.op];
    if (!op) {
      return {
        ok: false,
        reason: 'rule_unconfigured',
        stepId: step.id,
        steps: trace,
        gates: gateTrace,
      };
    }
    const result = op({ step, params: params[step.id] ?? {}, ctx, values, unset });
    if (!result.ok) {
      // "This bank stated nothing here" does NOT stop the rule: it is how a bank declines
      // one of the derivations the catalog offers, and only a `coalesce` may act on it.
      // Every other reason — an unanswered fact, a key with no row, a value outside every
      // band — stops it here and reports itself.
      //
      // A rule broken in this way is still caught: the step is left unset, so anything that
      // reads it fails closed, and if the OUTPUT step is unset the rule ends as
      // `rule_unconfigured`. Save-time validation refuses it long before that
      // (`unconfigured_step`).
      if (result.reason === 'rule_unconfigured') {
        unset.add(step.id);
        continue;
      }
      return {
        ok: false,
        reason: result.reason,
        stepId: step.id,
        ...(result.factKey ? { factKey: result.factKey } : {}),
        steps: trace,
        gates: gateTrace,
      };
    }
    values.set(step.id, result.value);
    if (result.matchedRow) rows.set(step.id, result.matchedRow);
    trace.push({
      id: step.id,
      op: step.op,
      valueEGP: result.value.toString(),
      ...(result.matchedRow ? { matchedRow: result.matchedRow } : {}),
    });
  }

  const setStepIds = new Set(values.keys());
  for (const gate of rule.gates ?? []) {
    const figures = params[gate.id] ?? {};
    // A gate the bank never turned on does not apply. Same posture as an eligibility
    // allow-list with no entries: a missing rule does not restrict, rather than refusing
    // everyone. It is what lets one catalog frame carry four banks' different conditions.
    if (!isGateConfigured(gate, figures, setStepIds)) continue;
    const result = evaluateGate(gate, { params: figures, ctx, values, unset });
    if (!result.ok) {
      return {
        ok: false,
        reason: result.reason,
        gateId: gate.id,
        ...(result.factKey ? { factKey: result.factKey } : {}),
        steps: trace,
        gates: gateTrace,
      };
    }
    gateTrace.push({ id: gate.id, reasonCode: gate.reasonCode, passed: result.passed });
    if (!result.passed) {
      return {
        ok: false,
        reason: 'gate_failed',
        gateId: gate.id,
        gateReasonCode: gate.reasonCode,
        steps: trace,
        gates: gateTrace,
      };
    }
  }

  const answer = values.get(rule.output.from);
  if (answer === undefined) {
    return {
      ok: false,
      reason: 'rule_unconfigured',
      stepId: rule.output.from,
      steps: trace,
      gates: gateTrace,
    };
  }

  const matchedRow = rows.get(rule.output.from);
  return {
    ok: true,
    kind: rule.output.kind === 'maxAmount' ? 'maxAmount' : 'monthlyIncome',
    valueEGP: round2(answer),
    steps: trace,
    gates: gateTrace,
    ...(matchedRow ? { matchedRow } : {}),
  };
}

/**
 * Every fact key the rule reads — steps, gates and all.
 *
 * DERIVED, never stored. The rule already names each fact it reads, so a second list
 * saying which questions the product needs could only ever drift out of step with it.
 * This is what the admin's "this figure is not asked in that category" warning reads,
 * and what tells a customer WHICH answers are still missing.
 */
export function factsReadBy(rule: ProductRule): string[] {
  const keys = new Set<string>();
  const addRef = (ref: ValueRef | ValueRef[] | undefined): void => {
    if (ref === undefined) return;
    for (const one of Array.isArray(ref) ? ref : [ref]) {
      if ('fact' in one) keys.add(one.fact);
    }
  };

  for (const step of rule.steps ?? []) {
    if (step.fact) keys.add(step.fact);
    addRef(step.of);
  }
  for (const gate of rule.gates ?? []) {
    if (gate.kind === 'choice') {
      keys.add(gate.fact);
      continue;
    }
    addRef(gate.left);
    // The right-hand side too: a bound is usually a step, but a gate comparing one ANSWER
    // against another is legal, and a fact reachable only from here would otherwise be
    // absent from `missingFactKeys` and pass the save-time availability check unseen.
    if (gate.kind === 'number') addRef(gate.right);
    if (gate.kind === 'numberByKey') keys.add(gate.keyedBy);
  }
  return [...keys];
}

/**
 * Whether a step has the figures its op needs to produce anything.
 *
 * Shared by the evaluator's own guards and by save-time validation, so "the bank left this
 * blank" means the same thing in both places. Anything else is how a rule saves clean and
 * then declines to quote.
 */
export function isStepConfigured(step: RuleStep, figures: StepParams): boolean {
  switch (step.op) {
    case 'constant':
      return figures.valueEGP !== undefined && figures.valueEGP !== '';
    case 'factChoiceTable':
    case 'factParentTable':
      return (figures.keyTable?.length ?? 0) > 0;
    case 'bandTable':
      return (figures.bands?.length ?? 0) > 0;
    case 'percentOf':
    case 'upliftPercent':
    case 'multiply': {
      const refs = step.of === undefined ? [] : Array.isArray(step.of) ? step.of : [step.of];
      // A factor read from a second input needs no figure at all.
      if (refs.length >= 2) return true;
      const stated = figures.scalar?.value;
      return stated !== undefined && stated !== '';
    }
    default:
      // `factNumber`, `sum`, `subtract`, `minOf`, `maxOf`, `coalesce`, `pickByFact` —
      // arithmetic over values other steps produced. There is nothing for a bank to state.
      return true;
  }
}

/**
 * The steps this rule actually NEEDS: the answer, plus whatever the gates this bank turned
 * on compare — and nothing else.
 *
 * Without this the evaluator ran every step in the list, so a step read only by a gate no
 * bank turned on still demanded its fact. On the compound frame that meant one skipped
 * OPTIONAL question ("how many months ago did you sign?") answered `fact_not_answered` for
 * all five programs, including the two that turn on neither ownership-duration gate and
 * never read the value — and the same for the unit price at a bank whose ceiling comes from
 * the unit TYPE. A bank that DOES read a figure still demands it: the narrowing is by what
 * the bank configured, never by what the applicant happened to answer.
 *
 * Statically derived, so it cannot depend on the very values it decides to compute. A gate
 * whose bound is another step counts as on when that step could produce a figure at all —
 * the same question `isStepConfigured` answers, asked through the refs.
 */
export function neededStepIds(rule: ProductRule): Set<string> {
  const steps = rule.steps ?? [];
  const params = rule.stepParams ?? {};
  const byId = new Map(steps.map((s) => [s.id, s]));
  const needed = new Set<string>();

  const visit = (id: string, depth = 0): void => {
    if (needed.has(id) || depth > 32) return;
    const step = byId.get(id);
    if (step === undefined) return;
    needed.add(id);
    for (const ref of reachableRefsOf(step, depth)) if ('step' in ref) visit(ref.step, depth + 1);
  };

  /**
   * The refs of one step that this bank's configuration can actually reach.
   *
   * For everything except a choice between derivations that is every ref it declares. For a
   * `coalesce`, a `pickByFact`, or a skip-blanks `minOf`/`maxOf` it is only the members that
   * could produce a figure — because the others are the ways OTHER banks sell this product,
   * and walking into one makes its fact a requirement of a bank that never reads it.
   *
   * That is not hypothetical: the compound frame's first way is `percentOf` over
   * `src__how_much_have_you_paid_for_the_unit_so_far`, a bare `factNumber`. A bank whose
   * ceiling comes from the compound CLASS states no percentage, so its way is unconfigured
   * and skipped at evaluation — but the source step was still walked, and a `factNumber`
   * checks nothing before reading, so an applicant who skipped that optional question
   * answered `fact_not_answered`, which is FATAL. The bank's quote died on a question the
   * bank does not ask.
   *
   * Falls back to every ref when NO member qualifies, so a rule that is broken rather than
   * merely undersold still evaluates and ends as `rule_unconfigured` instead of silently
   * skipping to an empty answer.
   */
  const reachableRefsOf = (step: RuleStep, depth: number): ReadonlyArray<ValueRef> => {
    const refs = stepRefsOf(step);
    if (!choosesBetweenWays(step) || refs.length === 0) return refs;
    const usable = refs.filter((ref) => !('step' in ref) || couldProduce(ref.step, depth + 1));
    return usable.length === 0 ? refs : usable;
  };

  const couldProduce = (id: string, depth = 0): boolean => {
    if (depth > 32) return true;
    const step = byId.get(id);
    if (step === undefined) return false;
    if (
      step.op === 'coalesce' ||
      step.op === 'pickByFact' ||
      ((step.op === 'minOf' || step.op === 'maxOf') && step.skipUnset === true)
    ) {
      // A skip-blanks comparison produces a figure exactly when one of its members does,
      // which is the same question a `coalesce` asks of its own members.
      const refs = stepRefsOf(step);
      if (refs.some((ref) => !('step' in ref))) return true;
      return refs.some((ref) => 'step' in ref && couldProduce(ref.step, depth + 1));
    }
    return isStepConfigured(step, params[id] ?? {});
  };

  if (rule.output?.from) visit(rule.output.from);

  for (const gate of rule.gates ?? []) {
    const figures = params[gate.id] ?? {};
    if (gate.kind === 'choice') continue;
    if (gate.kind === 'numberByKey') {
      if ((figures.keyTable?.length ?? 0) === 0) continue;
      if ('step' in gate.left) visit(gate.left.step);
      continue;
    }
    if (gate.right !== undefined) {
      // A gate whose bound is a step is on only when that step can produce one.
      if ('step' in gate.right && !couldProduce(gate.right.step)) continue;
      if ('step' in gate.right) visit(gate.right.step);
      if ('step' in gate.left) visit(gate.left.step);
      continue;
    }
    const stated =
      (figures.minValue !== undefined && figures.minValue !== '') ||
      (figures.maxValue !== undefined && figures.maxValue !== '');
    if (!stated) continue;
    if ('step' in gate.left) visit(gate.left.step);
  }

  // The declined ways themselves — marked needed, but never walked INTO.
  //
  // Both halves are required, and for opposite reasons. Not walking into one is what keeps
  // its fact from becoming a requirement of a bank that does not read it. Evaluating the
  // step ITSELF is what puts it in `unset`, which is the only thing a `coalesce` (or a
  // skip-blanks comparison) can act on: a step that is simply absent from `values` reads as
  // a broken reference and STOPS the rule, so pruning it away entirely would refuse every
  // bank that sells fewer than all the ways.
  //
  // Safe to evaluate with its inputs missing: every op that takes figures checks them
  // first, and a ref to a step that never ran resolves as `rule_unconfigured`.
  for (const id of [...needed]) {
    const step = byId.get(id);
    if (step === undefined || !choosesBetweenWays(step)) continue;
    for (const ref of stepRefsOf(step)) {
      if ('step' in ref && byId.has(ref.step)) needed.add(ref.step);
    }
  }

  return needed;
}

/**
 * Steps whose members are WAYS a bank chooses between, rather than inputs it must all have.
 *
 * One reading, shared by the walk that decides what to evaluate, by the walk that decides
 * what a bank may leave blank, and by the pruning between them — three places that must
 * agree about which members are optional or a bank's figures go missing in one of them.
 */
function choosesBetweenWays(step: RuleStep): boolean {
  if (step.op === 'coalesce' || step.op === 'pickByFact') return true;
  return (step.op === 'minOf' || step.op === 'maxOf') && step.skipUnset === true;
}

/** A step's value refs, as a list whether it declares one, many, or none. */
function stepRefsOf(step: RuleStep): ReadonlyArray<ValueRef> {
  if (step.of === undefined) return [];
  return Array.isArray(step.of) ? step.of : [step.of];
}

/** The step ids that some `coalesce` chooses between — the OPTIONAL steps.
 *
 * Derived from the rule, never stored: a stored "optional" flag beside a coalesce would be
 * a second statement of the same fact, free to disagree with the list the coalesce actually
 * names.
 */
export function optionalStepIds(rule: ProductRule): Set<string> {
  const ids = new Set<string>();
  for (const step of rule.steps ?? []) {
    // `pickByFact` for the same reason: a bank that sells only the standard column leaves
    // the other one blank, and the op falls back to the column it did configure. A
    // skip-blanks `minOf`/`maxOf` is the third: its members ARE the ways a bank chooses
    // between, and leaving one out is how a bank declines it.
    if (!choosesBetweenWays(step)) continue;
    const refs = step.of === undefined ? [] : Array.isArray(step.of) ? step.of : [step.of];
    for (const ref of refs) if ('step' in ref) ids.add(ref.step);
  }
  // A step a GATE compares against is optional for the same reason its gate is: the
  // requirement is one bank's, derived rather than stated (one bank's required down-payment
  // percentage is a band over the unit price, and the other three have no such rule). A step
  // like that carries figures only for the banks that turn the gate on.
  for (const gate of rule.gates ?? []) {
    if (gate.kind === 'number' && gate.right !== undefined && 'step' in gate.right) {
      ids.add(gate.right.step);
    }
  }
  return ids;
}

/** The step and gate ids a rule declares — the legal key set of `stepParams`. */
export function paramKeysOf(rule: ProductRule): string[] {
  return [...(rule.steps ?? []).map((s) => s.id), ...(rule.gates ?? []).map((g) => g.id)];
}
