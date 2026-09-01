/**
 * The friendly form, and the calculation it compiles to.
 *
 * Pure module: no Nest, no Prisma, no clock, no randomness (Constitution Principle V).
 *
 * ─── Why this exists ──────────────────────────────────────────────────────────
 *
 * `product-rule.ts` made a no-payslip product DATA — fourteen arithmetic ops, and a new
 * product is a row rather than a release. That was the right foundation and it left one
 * problem: the only door into it is a graph editor that asks a bank-operations person to
 * pick "operations", wire `ValueRef{step|fact|const}` between steps, and know that step 3
 * must point back at steps 1 and 2. That is programming, not data entry.
 *
 * Meanwhile the real products do not need that expressiveness. Nine banks across five
 * products all fit ONE frame with three switches: how the figure is worked out, what else
 * applies, and what the numbers are. This module is that frame, and `compileTemplate` turns
 * it into exactly the steps the engine already runs.
 *
 * NO NEW OP. Every row of the mapping below is an op that shipped with v18.0.0.
 *
 * ─── The one thing that can silently destroy data ─────────────────────────────
 *
 * A bank's figures live in `stepParams`, keyed by STEP ID, and so do the `valueSources`
 * estimate markers. If a recompile renames a step, that bank's number is orphaned — the
 * program still looks configured and now quotes nothing, or worse, quotes something else.
 *
 * Three rules, all enforced here or by the caller:
 *
 *   1. Ids are SLOT NAMES derived from the shape, never indices and never generated.
 *      `primary`, `alt`, `alt__<fact>`, `basis`, `uplift`, `iscore_*`, `src__<fact>`,
 *      `cond__<id>`. The first two ways keep the bare ids, so a THIRD way can be added to a
 *      live product without moving a figure — which also means the ways may be added to and
 *      removed from, never reordered.
 *   2. Turning a one-column table into two must not move the first column's figures, so
 *      the FIRST branch keeps the bare id (`primary`) and only the second and later take a
 *      suffix (`primary__<branch>`). Adding a column adds an id; it never renames one.
 *   3. A recompile that would orphan a figure some bank has already typed is REFUSED by
 *      the caller, naming those programs (`PRODUCT_TEMPLATE_ORPHANS_FIGURES`). This module
 *      stays pure and simply reports which keys a template owns (`templateParamKeys`).
 *
 * ─── The mapping ──────────────────────────────────────────────────────────────
 *
 *   table by grade / rank              factChoiceTable
 *   table by asset class               factParentTable
 *   table by years / amount bracket    factNumber -> bandTable
 *   share of a stated figure           factNumber -> percentOf
 *   multiple of a stated figure        factNumber -> multiply
 *   a figure the bank states outright  constant
 *   second column                      one step per column + pickByFact
 *   another way, bank fills one        coalesce
 *   take the lower / higher of two     minOf / maxOf, wrapped (see `emitBasis`)
 *   bonus % when true, on the income   upliftPercent + pickByFact
 *   bonus % when true, on the cap      NOTHING here — `loanLimits.maxLoanAdjustments`
 *   adjust by I-Score                  factNumber(optional) -> bandTable -> coalesce -> percentOf
 *   worked out at a DBR of X%          output.baselineDbrPercent
 *   condition: at least / at most      gate number gte / lte
 *   condition: between                 gate number between
 *   condition: share at least X%       percentOf + gate number gte (against that step)
 *   condition: answer must be one of   gate choice in
 *   condition: limit per answer        gate numberByKey
 */

import { PRODUCT_RULE_STRATEGY } from '../types';
import type { GateReasonCode, ProductRule, RuleGate, RuleStep, ValueRef } from './product-rule';
import { isGateReasonCode, paramKeysOf } from './product-rule';

/**
 * Pinned into every stored template.
 *
 * A version rather than duck-typing: the compiled `incomeRule` is what quotes, so a shape
 * change here must be a deliberate migration that recompiles, never a reader that guesses
 * which shape it is holding and produces a different calculation from the same answers.
 */
export const TEMPLATE_VERSION = 1;

// ---------------------------------------------------------------------------
// The form
// ---------------------------------------------------------------------------

/**
 * How the figure is worked out — the one question every product answers.
 *
 * Named by MECHANISM, never by bank and never by product: one product is sold by many
 * banks, and a bank name baked in here would be a hardcoded bank (Principle II / A1).
 */
export const TEMPLATE_MECHANISMS = [
  'choiceTable',
  'classTable',
  'numberBand',
  'shareOf',
  'multipleOf',
  'flatAmount',
] as const;

export type TemplateMechanismKind = (typeof TEMPLATE_MECHANISMS)[number];

export type TemplateMechanism =
  /** A table keyed by what the applicant picked — a grade, a rank, a unit type. */
  | { kind: 'choiceTable'; fact: string }
  /** A table keyed by the CLASS the picked value is filed under, not the value itself. */
  | { kind: 'classTable'; fact: string }
  /** A table of ranges over a number the applicant states — years, an amount bracket. */
  | { kind: 'numberBand'; fact: string }
  /** A percentage of a number the applicant states. */
  | { kind: 'shareOf'; fact: string }
  /** A multiple of a number the applicant states. */
  | { kind: 'multipleOf'; fact: string }
  /** One figure the bank states outright, the same for every applicant. */
  | { kind: 'flatAmount' };

/**
 * What an adjustment acts on.
 *
 * There is no third value and no default the platform picks. Two ABK lines read literally as
 * lifting the CAP — "Program loan amounts can be increased by 10%…", "…will be eligible for
 * Villas maximum loan amount" — and one FABMISR line lifts both sides at once. Whether an
 * adjustment lifts the income, the cap, or both changes the answer whenever the other side
 * binds; see `max-loan-adjustments.ts` for the worked figures.
 */
export const ADJUSTMENT_SCOPES = ['income', 'maxLoan'] as const;

export type AdjustmentScope = (typeof ADJUSTMENT_SCOPES)[number];

/** What a condition measures. */
export type ConditionMeasure =
  /** A number the applicant stated. */
  | { of: 'fact'; fact: string }
  /** The figure the calculation arrived at. */
  | { of: 'answer' };

/** How a condition tests it. Each maps to exactly one gate kind. */
export type ConditionTest =
  | { op: 'atLeast' }
  | { op: 'atMost' }
  | { op: 'between' }
  | { op: 'oneOf'; expect: string[] }
  /** At least a percentage — of another figure the applicant stated. The bank states the %. */
  | { op: 'atLeastShareOf'; fact: string }
  | { op: 'atLeastPerAnswer'; keyedBy: string }
  | { op: 'atMostPerAnswer'; keyedBy: string };

export interface TemplateCondition {
  /**
   * Operator-authored and STABLE — it becomes the gate id, which is a `stepParams` key.
   * Renaming one orphans the bank's bound, so the caller refuses it like any other orphan.
   */
  id: string;
  measure: ConditionMeasure;
  test: ConditionTest;
  /**
   * From the closed platform list, because a gate id can never have a translation and a
   * reason code can (Principle III / A2).
   */
  reasonCode: GateReasonCode;
}

export interface ProductTemplate {
  version: typeof TEMPLATE_VERSION;
  /** Whether the answer is an assumed monthly income or a borrowing CEILING. */
  outputKind: 'monthlyIncome' | 'maxAmount';
  /**
   * Ceiling products only: the DBR the bank worked its ceiling out at, which is what lets
   * the engine turn the ceiling back into a monthly figure. Blank falls back to the
   * program's own cap, which is the right default.
   */
  baselineDbrPercent?: string;
  primary: TemplateMechanism;
  /**
   * A second way to reach the figure. Each bank fills in the one it uses.
   *
   * SUPERSEDED by `alternatives`, and still read: `alternative: X` and `alternatives: [X]`
   * compile to byte-identical steps under identical slot ids, so this is one shape with two
   * spellings rather than two shapes — which is why it needs no version bump and no
   * recompile. Everything reads both through `waysOf`; carrying BOTH is refused.
   */
  alternative?: TemplateMechanism;
  /**
   * Every other way to reach the figure, in order. Each bank fills in the ones it sells.
   *
   * More than one, because which figure a ceiling table is keyed by is a per-BANK choice:
   * one bank keys it by the kind of unit, another by the class the compound is filed under,
   * a third takes a share of what has been paid. One product, one frame, N ways — the
   * alternative is a second product per bank, which is the same product duplicated.
   */
  alternatives?: TemplateMechanism[];
  /**
   * What to do when a bank filled in MORE THAN ONE way. Absent means "there is no bank that
   * does" — the first configured one wins.
   */
  combine?: 'lower' | 'higher';
  /**
   * A second column — new customer vs existing, city, employment type. The FIRST branch is
   * the default one and keeps the bare step id, so turning this on never moves a figure
   * that is already there.
   */
  secondColumn?: { fact: string; branches: string[] };
  /**
   * A bonus percentage when one answer is given. `otherwiseOption` is required and is what
   * makes a third answer, or no answer, mean "no bonus" rather than "bonus for everyone".
   *
   * `scope` says WHAT it lifts, and it is the difference between two answers 300,000 apart
   * on one ABK applicant. `'income'` lifts the figure this rule produces and compiles to the
   * two steps below; `'maxLoan'` lifts the bank program's own ceiling and compiles to
   * NOTHING here — it is configured per bank on `loanLimits.maxLoanAdjustments`, because the
   * cap is a bank setting and two banks selling one product cap differently.
   *
   * Absent means `'income'`, and that default is not a guess: every template stored before
   * this field existed compiled to an in-rule uplift, so reading absence as `'income'` is
   * what makes those templates recompile to byte-identical steps under identical slot ids
   * (§5.4). A NEW template should always state it, and the admin form makes the operator
   * choose.
   */
  uplift?: {
    fact: string;
    whenOption: string;
    otherwiseOption: string;
    scope?: AdjustmentScope;
  };
  /** Multiply by the bank's bureau-score table. Unanswered or unstated both mean 100%. */
  iScore?: boolean;
  conditions: TemplateCondition[];
}

// ---------------------------------------------------------------------------
// Slot names
// ---------------------------------------------------------------------------

/**
 * Every id this module can emit, as a function of the shape and nothing else.
 *
 * Deliberately NOT generated, NOT indexed and NOT hashed: a bank's figures and its
 * estimate markers are keyed by these strings, so an id that moves when the shape is
 * edited is a number that disappears while the program still reads as configured.
 */
export const SLOT = {
  primary: 'primary',
  primaryPick: 'primary_pick',
  alt: 'alt',
  altPick: 'alt_pick',
  basis: 'basis',
  basisCombine: 'basis_combine',
  uplift: 'uplift',
  upliftOn: 'uplift_on',
  iScoreSrc: 'iscore_src',
  iScoreBand: 'iscore_band',
  iScoreFactor: 'iscore_factor',
  iScoreApplied: 'iscore_applied',
} as const;

/** The `factNumber` step that reads one fact. Shared when two mechanisms read the same one. */
export function sourceSlot(factKey: string): string {
  return `src__${factKey}`;
}

/** A column other than the first. The FIRST keeps the bare id — see `ProductTemplate`. */
export function columnSlot(head: string, branch: string): string {
  return `${head}__${branch}`;
}

export function conditionSlot(id: string): string {
  return `cond__${id}`;
}

/**
 * Every way this product offers, in order — the one accessor both spellings go through.
 *
 * One reader, so `alternative` and `alternatives` can never be understood differently by
 * two callers. A template carrying both is refused by `validateTemplate` rather than
 * merged here: merging would pick an order nobody wrote down, and the order decides slot
 * ids.
 */
export function waysOf(template: ProductTemplate): TemplateMechanism[] {
  const rest =
    template.alternatives ?? (template.alternative === undefined ? [] : [template.alternative]);
  return [template.primary, ...rest];
}

/**
 * What an uplift lifts. Absent reads as `'income'` — see `ProductTemplate.uplift`.
 *
 * One accessor, so the compiler, the key set and the admin can never disagree about what an
 * older stored template meant.
 */
export function upliftScopeOf(uplift: NonNullable<ProductTemplate['uplift']>): AdjustmentScope {
  return uplift.scope ?? 'income';
}

/**
 * The slot one way's figures hang off.
 *
 * The first two keep the ids they have always had — `primary` and `alt` — so adding a THIRD
 * way to a live product cannot move a number a bank already typed. Every way after that is
 * named by the fact it reads, never by its index: an index would renumber the moment a way
 * in front of it is removed, and a renumbered slot is a bank's figure that silently becomes
 * some other bank's table.
 *
 * The direct consequence, and it is deliberate: the ways may be ADDED to and REMOVED from,
 * never reordered. Moving what is in `alt` renames `alt`.
 */
export function waySlot(mechanism: TemplateMechanism, index: number): string {
  if (index === 0) return SLOT.primary;
  if (index === 1) return SLOT.alt;
  return `${SLOT.alt}__${mechanism.kind === 'flatAmount' ? 'flat' : mechanism.fact}`;
}

/** The `pickByFact` that chooses between one way's columns. */
export function wayPickSlot(mechanism: TemplateMechanism, index: number): string {
  if (index === 0) return SLOT.primaryPick;
  if (index === 1) return SLOT.altPick;
  return `${waySlot(mechanism, index)}_pick`;
}

export function conditionBoundSlot(id: string): string {
  return `${conditionSlot(id)}__bound`;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export const TEMPLATE_INVALID_REASONS = [
  'bad_version',
  'bad_output_kind',
  'bad_baseline_dbr',
  'baseline_dbr_on_income',
  'unknown_mechanism',
  'mechanism_needs_fact',
  'ways_double_spelled',
  'duplicate_way',
  'too_many_ways',
  'second_column_too_few_branches',
  'second_column_duplicate_branch',
  'uplift_same_option',
  'unknown_adjustment_scope',
  'condition_id_invalid',
  'condition_duplicate_id',
  'unknown_condition_test',
  'unknown_gate_reason',
  'condition_measure_invalid',
] as const;

export type TemplateInvalidReason = (typeof TEMPLATE_INVALID_REASONS)[number];

export interface TemplateViolation {
  reason: TemplateInvalidReason;
  detail?: string;
}

/**
 * A bound on the ways list, so an unbounded array cannot arrive over the wire.
 *
 * Six rather than the four the compound frame needed when it was hand-written: a cap that
 * exactly fits today's biggest product is a cap the next bank hits.
 */
export const MAX_WAYS = 6;

/** Ids become `stepParams` keys and travel in dot-paths, so keep them boring. */
const CONDITION_ID = /^[a-z0-9][a-z0-9_]{0,40}$/;
const DECIMAL = /^-?\d+(\.\d+)?$/;

/**
 * Is this form one the compiler can turn into a rule?
 *
 * Shape only. Whether the FACTS it names exist, and whether the compiled rule is
 * internally consistent, are `validateIncomeRule`'s questions and are asked of the
 * compiled output — one authority per question, so the two can never disagree.
 */
export function validateTemplate(template: ProductTemplate): TemplateViolation | undefined {
  if (template.version !== TEMPLATE_VERSION) {
    return { reason: 'bad_version', detail: String(template.version) };
  }
  if (template.outputKind !== 'monthlyIncome' && template.outputKind !== 'maxAmount') {
    return { reason: 'bad_output_kind', detail: String(template.outputKind) };
  }

  const baseline = template.baselineDbrPercent;
  if (baseline !== undefined && baseline !== '') {
    // Refused rather than dropped: a baseline typed against a monthlyIncome product means
    // the operator believes it is doing something, and it is not.
    if (template.outputKind !== 'maxAmount') return { reason: 'baseline_dbr_on_income' };
    const value = Number(baseline);
    if (!DECIMAL.test(baseline) || !Number.isFinite(value) || value <= 0 || value > 100) {
      return { reason: 'bad_baseline_dbr', detail: baseline };
    }
  }

  // Two spellings of the same list, and no way to know which the operator meant. Refused
  // rather than merged: the order decides slot ids, and a guessed order is a bank's figure
  // landing in another bank's box.
  if (template.alternative !== undefined && template.alternatives !== undefined) {
    return { reason: 'ways_double_spelled' };
  }

  const ways = waysOf(template);
  if (ways.length > MAX_WAYS) {
    return { reason: 'too_many_ways', detail: String(ways.length) };
  }
  const slots = new Set<string>();
  const seenWays = new Set<string>();
  for (const [index, mechanism] of ways.entries()) {
    const bad = validateMechanism(mechanism);
    if (bad) return bad;
    // Two readings of one refusal, and both are needed. The same mechanism reading the same
    // fact twice is one way listed twice — two boxes for one table, and no bank can say
    // which it meant. A repeated SLOT is the same damage arriving by a different route (a
    // fact whose key happens to be `flat`), and it is the id that actually has to be unique.
    const identity = `${mechanism.kind}|${mechanism.kind === 'flatAmount' ? '' : mechanism.fact}`;
    if (seenWays.has(identity)) return { reason: 'duplicate_way', detail: identity };
    seenWays.add(identity);

    const slot = waySlot(mechanism, index);
    if (slots.has(slot)) return { reason: 'duplicate_way', detail: slot };
    slots.add(slot);
  }

  const column = template.secondColumn;
  if (column !== undefined) {
    // One column is not a second column: `pickByFact` would fall back to it for every
    // applicant, which is the same rule with an extra step nobody can read.
    if (column.branches.length < 2) {
      return { reason: 'second_column_too_few_branches', detail: String(column.branches.length) };
    }
    if (new Set(column.branches).size !== column.branches.length) {
      return { reason: 'second_column_duplicate_branch' };
    }
  }

  if (
    template.uplift !== undefined &&
    template.uplift.scope !== undefined &&
    !(ADJUSTMENT_SCOPES as readonly string[]).includes(template.uplift.scope)
  ) {
    return { reason: 'unknown_adjustment_scope', detail: String(template.uplift.scope) };
  }
  if (
    template.uplift !== undefined &&
    template.uplift.whenOption === template.uplift.otherwiseOption
  ) {
    return { reason: 'uplift_same_option', detail: template.uplift.whenOption };
  }

  const seen = new Set<string>();
  for (const condition of template.conditions ?? []) {
    if (!CONDITION_ID.test(condition.id)) {
      return { reason: 'condition_id_invalid', detail: condition.id };
    }
    if (seen.has(condition.id)) return { reason: 'condition_duplicate_id', detail: condition.id };
    seen.add(condition.id);
    if (!isGateReasonCode(condition.reasonCode)) {
      return { reason: 'unknown_gate_reason', detail: String(condition.reasonCode) };
    }
    const bad = validateCondition(condition);
    if (bad) return bad;
  }

  return undefined;
}

function validateMechanism(mechanism: TemplateMechanism): TemplateViolation | undefined {
  if (!(TEMPLATE_MECHANISMS as readonly string[]).includes(mechanism.kind)) {
    return { reason: 'unknown_mechanism', detail: String(mechanism.kind) };
  }
  if (mechanism.kind === 'flatAmount') return undefined;
  if (!mechanism.fact) return { reason: 'mechanism_needs_fact', detail: mechanism.kind };
  return undefined;
}

function validateCondition(condition: TemplateCondition): TemplateViolation | undefined {
  const { measure, test } = condition;
  if (measure.of !== 'fact' && measure.of !== 'answer') {
    return { reason: 'condition_measure_invalid', detail: condition.id };
  }
  if (measure.of === 'fact' && !measure.fact) {
    return { reason: 'condition_measure_invalid', detail: condition.id };
  }
  switch (test.op) {
    case 'atLeast':
    case 'atMost':
    case 'between':
      return undefined;
    case 'oneOf':
      // A choice gate compares a picked option CODE, so it can only ever read a fact.
      if (measure.of !== 'fact')
        return { reason: 'condition_measure_invalid', detail: condition.id };
      if (test.expect.length === 0)
        return { reason: 'condition_measure_invalid', detail: condition.id };
      return undefined;
    case 'atLeastShareOf':
      return test.fact ? undefined : { reason: 'condition_measure_invalid', detail: condition.id };
    case 'atLeastPerAnswer':
    case 'atMostPerAnswer':
      return test.keyedBy
        ? undefined
        : { reason: 'condition_measure_invalid', detail: condition.id };
    default:
      return { reason: 'unknown_condition_test', detail: String((test as { op: string }).op) };
  }
}

// ---------------------------------------------------------------------------
// The compiler
// ---------------------------------------------------------------------------

/** A step under construction, before the emission order is fixed. */
interface Emission {
  steps: RuleStep[];
  gates: RuleGate[];
}

/**
 * The form, as the rule the engine runs.
 *
 * EMISSION ORDER IS FIXED and it is load-bearing, not tidiness. `percentOf` rounds to two
 * decimals at every step, so multiplication commutes but the rounding does not: I-Score at
 * 110% and a joint-ownership 50% applied in the other order differ by piastres. One
 * declared order — sources, the ways of reaching the figure, how they combine, the
 * product's own adjustments, then I-SCORE LAST — is what makes the same form always
 * produce the same number.
 */
export function compileTemplate(template: ProductTemplate): ProductRule {
  const out: Emission = { steps: [], gates: [] };

  // 1. One `factNumber` per numeric fact, shared by everything that reads it. Sorted, so
  //    the step list is a function of the SET of facts and not of the order they were
  //    ticked in.
  const sources = new Set<string>();
  collectNumericFacts(template, sources);
  for (const fact of [...sources].sort()) {
    out.steps.push({ id: sourceSlot(fact), op: 'factNumber', fact });
  }

  // 2 + 3. Every way of reaching the figure, each optionally split into columns.
  const heads = waysOf(template).map((mechanism, index) =>
    emitMechanism(
      out,
      mechanism,
      waySlot(mechanism, index),
      wayPickSlot(mechanism, index),
      template,
    ),
  );

  // 4. How they combine.
  let head = emitBasis(out, heads, template.combine);

  // 5. The product's own adjustments.
  // A `maxLoan`-scoped uplift emits NOTHING: it lifts the bank program's ceiling, which is
  // bank configuration (`loanLimits.maxLoanAdjustments`) and not part of guessing an income.
  // Emitting it here as well would apply it twice on any bank that configured both.
  if (template.uplift !== undefined && upliftScopeOf(template.uplift) === 'income') {
    head = emitUplift(out, head, template.uplift);
  }

  // 6. I-Score LAST — see the note on emission order above.
  if (template.iScore === true) head = emitIScore(out, head);

  // 7. Conditions, plus any figure a condition needs to compare against.
  for (const condition of template.conditions ?? []) emitCondition(out, condition, head);

  const baseline = template.baselineDbrPercent;
  return {
    strategy: PRODUCT_RULE_STRATEGY,
    steps: out.steps,
    gates: out.gates,
    output: {
      kind: template.outputKind,
      from: head,
      ...(template.outputKind === 'maxAmount' && baseline !== undefined && baseline !== ''
        ? { baselineDbrPercent: baseline }
        : {}),
    },
  };
}

/** Every fact read through a `factNumber` step, from any corner of the form. */
function collectNumericFacts(template: ProductTemplate, into: Set<string>): void {
  for (const mechanism of waysOf(template)) {
    if (mechanism.kind === 'flatAmount') continue;
    if (
      mechanism.kind === 'numberBand' ||
      mechanism.kind === 'shareOf' ||
      mechanism.kind === 'multipleOf'
    ) {
      into.add(mechanism.fact);
    }
  }
  for (const condition of template.conditions ?? []) {
    if (condition.test.op === 'atLeastShareOf') into.add(condition.test.fact);
  }
}

/**
 * One way of reaching the figure, in as many columns as the form asked for.
 *
 * The FIRST branch keeps the bare id. That is the whole reason a second column can be
 * added to a live product without refusing the save: the figures a bank already typed stay
 * under the id they were typed against, and only the new column is a new key.
 */
function emitMechanism(
  out: Emission,
  mechanism: TemplateMechanism,
  head: string,
  pickId: string,
  template: ProductTemplate,
): string {
  const column = template.secondColumn;
  if (column === undefined) {
    out.steps.push(mechanismStep(mechanism, head));
    return head;
  }

  const ids: string[] = [];
  for (const [index, branch] of column.branches.entries()) {
    const id = index === 0 ? head : columnSlot(head, branch);
    ids.push(id);
    out.steps.push(mechanismStep(mechanism, id));
  }
  out.steps.push({
    id: pickId,
    op: 'pickByFact',
    fact: column.fact,
    of: ids.map((id) => ({ step: id })),
    branches: [...column.branches],
  });
  return pickId;
}

/** One mechanism as one step. The bank's figures hang off this id. */
function mechanismStep(mechanism: TemplateMechanism, id: string): RuleStep {
  switch (mechanism.kind) {
    case 'choiceTable':
      return { id, op: 'factChoiceTable', fact: mechanism.fact };
    case 'classTable':
      return { id, op: 'factParentTable', fact: mechanism.fact };
    case 'numberBand':
      return { id, op: 'bandTable', of: { step: sourceSlot(mechanism.fact) } };
    case 'shareOf':
      return { id, op: 'percentOf', of: { step: sourceSlot(mechanism.fact) } };
    case 'multipleOf':
      return { id, op: 'multiply', of: { step: sourceSlot(mechanism.fact) } };
    case 'flatAmount':
      return { id, op: 'constant' };
  }
}

/**
 * Every way, joined.
 *
 * `minOf` / `maxOf` alone cannot express "each bank fills the ways it sells, and a bank that
 * fills more than one takes the lower": `reduceRefs` fails closed on a member the bank left
 * blank, so a bank using one way would quote nothing. Two things close that —
 *
 *     basis_combine = minOf [ ...ways ]  skipUnset   the lowest of the ways THIS bank filled
 *     basis         = coalesce [ basis_combine, ...ways ]
 *
 * — and `skipUnset` is the half that has to be there at three ways or more. The wrapper
 * alone was enough at two, because "one of two filled" leaves exactly one candidate and the
 * `coalesce` finds it. At three it stops being true: a bank filling two of three leaves the
 * comparison unconfigured, and the `coalesce` falls through to the FIRST way ALONE — the
 * clamp the bank's other table was there to apply, silently gone.
 *
 * The `coalesce` still wraps it, for the case `skipUnset` deliberately does not absorb:
 * every way blank. That ends as `rule_unconfigured`, which is what a bank that configured
 * nothing should read as, and the save is already refused for it (`coalesce_empty`).
 */
function emitBasis(
  out: Emission,
  heads: readonly string[],
  combine: ProductTemplate['combine'],
): string {
  const [first] = heads;
  if (first === undefined) return SLOT.basis;
  if (heads.length === 1) return first;

  const members: ValueRef[] = heads.map((step) => ({ step }));
  if (combine === 'lower' || combine === 'higher') {
    out.steps.push({
      id: SLOT.basisCombine,
      op: combine === 'lower' ? 'minOf' : 'maxOf',
      of: members,
      skipUnset: true,
    });
    out.steps.push({
      id: SLOT.basis,
      op: 'coalesce',
      of: [{ step: SLOT.basisCombine }, ...members],
    });
    return SLOT.basis;
  }

  out.steps.push({ id: SLOT.basis, op: 'coalesce', of: members });
  return SLOT.basis;
}

/**
 * A bonus percentage when one answer is given.
 *
 * The NO-BONUS column is first, and that ordering is the correctness of the whole block:
 * `pickByFact` falls back to the first usable input when the answer matches no branch, when
 * the applicant did not answer at all, and when this bank stated no bonus. All three must
 * mean "no bonus" — put the uplifted column first and all three mean the opposite.
 */
function emitUplift(
  out: Emission,
  head: string,
  uplift: NonNullable<ProductTemplate['uplift']>,
): string {
  out.steps.push({ id: SLOT.upliftOn, op: 'upliftPercent', of: { step: head } });
  out.steps.push({
    id: SLOT.uplift,
    op: 'pickByFact',
    fact: uplift.fact,
    of: [{ step: head }, { step: SLOT.upliftOn }],
    branches: [uplift.otherwiseOption, uplift.whenOption],
  });
  return SLOT.uplift;
}

/**
 * Multiply by the bank's bureau-score table, falling back to 100%.
 *
 * TWO ways of ending up at 100%, and both are required:
 *
 *   the applicant did not give a score   `iscore_src` is `optional`, so an absent answer
 *                                        reads as unconfigured instead of stopping the rule
 *   this bank states no table            `iscore_band` is unconfigured on its own
 *
 * Either way the step is left unset, the `coalesce` skips it and takes the literal 100, and
 * `percentOf` multiplies by one. Without the `optional` flag the first case would kill
 * every quote for the product the moment one applicant skipped an optional question.
 */
function emitIScore(out: Emission, head: string): string {
  out.steps.push({ id: SLOT.iScoreSrc, op: 'factNumber', fact: I_SCORE_FACT_KEY, optional: true });
  out.steps.push({ id: SLOT.iScoreBand, op: 'bandTable', of: { step: SLOT.iScoreSrc } });
  out.steps.push({
    id: SLOT.iScoreFactor,
    op: 'coalesce',
    of: [{ step: SLOT.iScoreBand }, { const: '100' }],
  });
  out.steps.push({
    id: SLOT.iScoreApplied,
    op: 'percentOf',
    of: [{ step: head }, { step: SLOT.iScoreFactor }],
  });
  return SLOT.iScoreApplied;
}

/**
 * The bureau score, as the platform knows it.
 *
 * ONE key for the whole platform, not one per product: the score is a property of the
 * applicant, so a second key would be a second question asking the same thing and two
 * tables that could disagree about what 720 is worth.
 */
export const I_SCORE_FACT_KEY = 'i_score';

/** A condition, as a gate — plus the step it compares against, when it needs one. */
function emitCondition(out: Emission, condition: TemplateCondition, head: string): void {
  const id = conditionSlot(condition.id);
  const left: ValueRef =
    condition.measure.of === 'fact' ? { fact: condition.measure.fact } : { step: head };

  switch (condition.test.op) {
    case 'atLeast':
      out.gates.push({ id, kind: 'number', op: 'gte', left, reasonCode: condition.reasonCode });
      return;
    case 'atMost':
      out.gates.push({ id, kind: 'number', op: 'lte', left, reasonCode: condition.reasonCode });
      return;
    case 'between':
      out.gates.push({ id, kind: 'number', op: 'between', left, reasonCode: condition.reasonCode });
      return;
    case 'oneOf':
      out.gates.push({
        id,
        kind: 'choice',
        op: 'in',
        fact: condition.measure.of === 'fact' ? condition.measure.fact : '',
        expect: [...condition.test.expect],
        reasonCode: condition.reasonCode,
      });
      return;
    case 'atLeastShareOf': {
      // The requirement is itself a figure: X% of something the applicant stated. The bank
      // states the percentage; the gate compares two amounts rather than a share, because
      // no op divides.
      const bound = conditionBoundSlot(condition.id);
      out.steps.push({
        id: bound,
        op: 'percentOf',
        of: { step: sourceSlot(condition.test.fact) },
      });
      out.gates.push({
        id,
        kind: 'number',
        op: 'gte',
        left,
        right: { step: bound },
        reasonCode: condition.reasonCode,
      });
      return;
    }
    case 'atLeastPerAnswer':
    case 'atMostPerAnswer':
      out.gates.push({
        id,
        kind: 'numberByKey',
        op: condition.test.op === 'atLeastPerAnswer' ? 'gte' : 'lte',
        left,
        keyedBy: condition.test.keyedBy,
        reasonCode: condition.reasonCode,
      });
      return;
  }
}

// ---------------------------------------------------------------------------
// What a template owns
// ---------------------------------------------------------------------------

/**
 * The `stepParams` keys this form would own — the boxes a bank types numbers into.
 *
 * Derived by compiling, never by a second reading of the shape: a parallel enumeration is
 * exactly the thing that goes stale and lets a rename through as "no keys were lost".
 */
export function templateParamKeys(template: ProductTemplate): string[] {
  return paramKeysOf(compileTemplate(template));
}
