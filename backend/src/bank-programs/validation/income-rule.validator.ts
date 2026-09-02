import { Prisma } from '@prisma/client';
import {
  BAND_STRATEGIES,
  KEY_TABLE_REGISTRY,
  KEY_TABLE_STRATEGIES,
  SCALAR_STRATEGIES,
  factKeyOf,
  isProductRuleStrategy,
  type IncomeAssumptionConfig,
  type IncomeAssumptionStrategy,
} from '@/matching/types';
import {
  derivedFactOptionCodes,
  isDerivedFactKey,
  type SurrogateFactBinding,
} from '@/matching/pipeline/surrogate-fact-registry';
import {
  GATE_REASON_CODES,
  optionalStepIds,
  isGateConfigured,
  isStepConfigured,
  factsReadBy,
  isStepOp,
  paramKeysOf,
  type ProductRule,
  type RuleGate,
  type RuleStep,
  type ValueRef,
} from '@/matching/pipeline/product-rule';
import { legacyScalarKeysFor } from '@/matching/pipeline/income-rule-normalize';
import type { IncomeRuleBandsInvalidReason } from '@/common/errors/domain.exceptions';

/**
 * Feature 011 — income-rule validation (FR-006 … FR-012).
 *
 * Placed beside `dbr-bands.validator.ts` and shaped like it: a pure function
 * returning the FIRST violation as a discriminated union, so the service maps each
 * kind to its typed exception and the validator itself imports no Nest and throws
 * nothing. That is what lets the admin rule-CHECK endpoint (US3) validate a draft
 * with the same code path the save uses, without a transaction or a request.
 *
 * Every violation names the offending ROW — an index for a band, the key for a key
 * table. A bank's grade table runs 10–15 rows, and "the table is invalid" makes the
 * admin re-read all of them.
 *
 * Registry membership is resolved through an injected lookup rather than a repo
 * import, for the same reason `cross-config.validators.ts` takes a
 * `ValidationContext`: the validator stays pure and unit-testable, and the service
 * decides where "active member" comes from.
 */

export type IncomeRuleViolation =
  | { kind: 'empty'; strategy: IncomeAssumptionStrategy; stepId?: string }
  | { kind: 'incomeInvalid'; index?: number; key?: string; incomeEGP: string; stepId?: string }
  | { kind: 'duplicateKey'; key: string; stepId?: string }
  | { kind: 'unknownKey'; key: string; registry: string; activeKeys: string[]; stepId?: string }
  | {
      kind: 'bandsInvalid';
      index: number | null;
      reason: IncomeRuleBandsInvalidReason;
      stepId?: string;
    }
  | { kind: 'dbrOverrideInvalid'; value: string }
  /** The additional-income policy names an unreadable source or an unusable percentage. */
  | {
      kind: 'additionalIncomeInvalid';
      reason: AdditionalIncomeInvalidReason;
      factKey?: string;
      value?: string;
    }
  /** The rule reads a registry fact the registry cannot serve (see the error code). */
  | { kind: 'factUnavailable'; factKey: string; availableFacts: string[] }
  /**
   * A step pipeline that is not assemblable. ONE kind with a `reason`, not eleven kinds:
   * every one of these is "the pipeline itself is wrong" and points the operator at the
   * same editor, and eleven codes would need eleven sentences in every locale
   * dictionary to say so (Principle III). The per-ROW problems inside a step — a
   * duplicate key, a non-positive figure, unordered bands — keep reporting through the
   * existing kinds above, with `stepId` added, because those messages are already right.
   */
  | {
      kind: 'productRuleInvalid';
      reason: ProductRuleInvalidReason;
      stepId?: string;
      gateId?: string;
      detail?: string;
    };

/**
 * Why an additional-income policy is refused.
 *
 * Every one of these makes the policy contribute NOTHING at quote time while reading as
 * configured on the screen, which is the failure the refusal exists to prevent — a bank's
 * sheet says rent counts at 50% and the offer counts none of it.
 */
export const ADDITIONAL_INCOME_INVALID_REASONS = [
  'no_sources',
  'unknown_fact',
  'not_numeric',
  'duplicate_source',
  'percent_out_of_range',
  'cap_out_of_range',
] as const;

export type AdditionalIncomeInvalidReason = (typeof ADDITIONAL_INCOME_INVALID_REASONS)[number];

export const PRODUCT_RULE_INVALID_REASONS = [
  'no_steps',
  'no_output',
  'unknown_output_step',
  'duplicate_step_id',
  'unknown_op',
  'forward_reference',
  'unknown_step_reference',
  'bad_constant',
  'missing_fact',
  'wrong_ref_count',
  'unknown_param_key',
  'bad_scalar',
  'unconfigured_step',
  'coalesce_empty',
  'unknown_gate_reason',
  'gate_bounds_missing',
  'gate_expect_empty',
  'bad_baseline_dbr',
  'bad_output_kind',
  'branches_empty',
  'branches_mismatch',
  'optional_step_not_skippable',
  'skip_unset_not_applicable',
] as const;

export type ProductRuleInvalidReason = (typeof PRODUCT_RULE_INVALID_REASONS)[number];

/** The pipeline-shape half of the union, so a helper can add `gateId` without widening. */
export type ProductRuleViolation = Extract<IncomeRuleViolation, { kind: 'productRuleInvalid' }>;

/** Non-blocking findings. Reported in `data.warnings`, never a rejection. */
export type IncomeRuleWarning =
  | {
      kind: 'ruleIgnoredForProgramType';
      programType: string;
      productCategory: string;
      strategy: IncomeAssumptionStrategy;
    }
  | { kind: 'requiredDocumentsMissing'; missing: string[] };

/**
 * Who is being validated, which decides how complete the rule has to be.
 *
 * The DEFAULT is the strict one, so a caller that forgets to say is held to the bank's
 * standard rather than the catalog's.
 */
export interface IncomeRuleValidationOptions {
  /** `false` for a CATALOG name's rule: its figures are the banks' to fill in. */
  figuresRequired?: boolean;
}

export interface IncomeRuleValidationContext {
  /** Whether `key` is an ACTIVE member of `enumerationType`. */
  isActiveMember(enumerationType: string, key: string): Promise<boolean>;
  /** The active members of `enumerationType`, for the rejection's `meta`. */
  activeMembers(enumerationType: string): Promise<readonly string[]>;
  /**
   * The operator-managed FACT registry — every fact the engine can currently read.
   *
   * Injected like the two above, and for the same reason: the validator stays pure, and
   * the admin rule-CHECK endpoint validates a draft through the identical code path the
   * save uses. Passed as the whole list rather than a per-key probe because a rejection
   * has to name the alternatives, and asking twice invites the two answers to differ.
   */
  surrogateFacts(): Promise<readonly SurrogateFactBinding[]>;
  /**
   * The option codes a SINGLE_SELECT question offers — the keys a fact's key table may
   * use. Empty for a question with no options, which makes any row unknown.
   */
  questionOptionCodes(questionCode: string): Promise<readonly string[]>;
}

const ZERO = new Prisma.Decimal(0);
const HUNDRED = new Prisma.Decimal(100);

const KEY_STRATEGY_SET = new Set<string>(KEY_TABLE_STRATEGIES);
const BAND_STRATEGY_SET = new Set<string>(BAND_STRATEGIES);
const SCALAR_STRATEGY_SET = new Set<string>(SCALAR_STRATEGIES);

/**
 * `byCDValue` and `byTotalDeposits` are in BAND_STRATEGIES but legally configured
 * either way — bands where an admin authored them, else the legacy percent scalar
 * whose output must not move (FR-015). So "no bands" is only `INCOME_RULE_EMPTY`
 * for the two YEARS methods, which have no scalar form.
 */
const BANDS_REQUIRED_STRATEGIES = new Set<string>(['byYearsInJob', 'byYearsInPractice']);

function toDecimalOrNull(value: string | null | undefined): Prisma.Decimal | null {
  if (value === null || value === undefined) return null;
  try {
    const parsed = new Prisma.Decimal(value);
    return parsed.isFinite() ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Validate the canonical rule. Returns the first violation, or `undefined`.
 *
 * Only the SELECTED method's configuration is validated: configuration belonging
 * to another method is stripped before persistence (FR-011), so rejecting on it
 * would refuse a save the server is about to discard anyway.
 */
export async function validateIncomeRule(
  config: IncomeAssumptionConfig | null | undefined,
  ctx: IncomeRuleValidationContext,
  opts: IncomeRuleValidationOptions = {},
): Promise<IncomeRuleViolation | undefined> {
  if (!config) return undefined;
  const strategy = config.strategy;

  // Checked before the method's own shape: an out-of-range override is a policy
  // error independent of which table is configured, and reporting the table first
  // would send the admin to the wrong control.
  const overrideViolation = validateDbrOverride(config.dbrCapPercentOverride);
  if (overrideViolation) return overrideViolation;

  // Checked before the method's own shape, for the reason the override is: the policy is a
  // statement about the applicant's other income and is wrong or right independently of
  // which table the basic figure comes from.
  const additionalViolation = await validateAdditionalIncome(config.additionalIncome, ctx);
  if (additionalViolation) return additionalViolation;

  // A registry fact, checked before the built-in sets: `fact:` names the registry
  // whatever else the key spells, and the table's SHAPE follows the bound question
  // rather than a hardcoded per-method set.
  const factKey = factKeyOf(strategy);
  if (factKey !== null) return validateFactRule(config, factKey, ctx);

  // A step pipeline, checked before the built-in sets for the same reason `fact:` is:
  // the token names the SHAPE of the rule, and a pipeline carries no top-level table for
  // the per-method checks below to look at.
  if (isProductRuleStrategy(strategy)) return validateProductRule(config, ctx, opts);

  if (KEY_STRATEGY_SET.has(strategy)) {
    return validateKeyTable(config, strategy, ctx);
  }
  if (BAND_STRATEGY_SET.has(strategy)) {
    return validateBands(config, strategy);
  }
  if (SCALAR_STRATEGY_SET.has(strategy)) {
    return validateScalar(config, strategy);
  }
  // `declared` carries no configuration and nothing to check.
  return undefined;
}

/**
 * A `fact:<key>` rule — the generic form of the four hand-written fact methods.
 *
 * Two checks, in this order:
 *
 *   1. CAN THE REGISTRY SERVE THE FACT? An unserveable fact is refused rather than
 *      warned about, because the alternative is a program that saves clean and then
 *      quotes every applicant off their declared salary as though the bank's table did
 *      not exist — the exact silent failure this feature was built to end.
 *   2. IS THE TABLE VALID FOR THE FACT'S SHAPE? A choice fact is a key table whose keys
 *      are the QUESTION'S OPTION CODES — not an enumeration's members. That is the
 *      whole point of binding a question: the two lists are one list by construction,
 *      so a renamed option cannot leave a table pointing at a key nobody can answer.
 */
async function validateFactRule(
  config: IncomeAssumptionConfig,
  factKey: string,
  ctx: IncomeRuleValidationContext,
): Promise<IncomeRuleViolation | undefined> {
  const registry = await ctx.surrogateFacts();
  const fact = registry.find((f) => f.key === factKey);
  if (!fact) {
    return { kind: 'factUnavailable', factKey, availableFacts: registry.map((f) => f.key) };
  }

  if (fact.type === 'NUMERIC') {
    // No scalar escape hatch, unlike `byCDValue`: a fact method has no legacy percent
    // form to preserve (FR-015 protects figures that already exist, and no stored rule
    // predates the registry). Nothing configured is `INCOME_RULE_EMPTY`.
    return validateBands(config, config.strategy, { bandsRequired: true });
  }

  const table = config.keyTable;
  if (!table || table.length === 0) return { kind: 'empty', strategy: config.strategy };

  const optionCodes = new Set(await ctx.questionOptionCodes(fact.questionCode));
  const seen = new Set<string>();
  for (const row of table) {
    if (seen.has(row.key)) return { kind: 'duplicateKey', key: row.key };
    seen.add(row.key);

    const income = toDecimalOrNull(row.incomeEGP);
    if (income === null || income.lessThanOrEqualTo(ZERO)) {
      return { kind: 'incomeInvalid', key: row.key, incomeEGP: row.incomeEGP };
    }

    if (!optionCodes.has(row.key)) {
      // Reported through `unknownKey` with the QUESTION as the registry: the admin's
      // fix is identical ("this key is not offered — pick a current one"), and a second
      // code for the same sentence would need its own entry in every locale dictionary
      // to say the same thing.
      return {
        kind: 'unknownKey',
        key: row.key,
        registry: fact.questionCode,
        activeKeys: [...optionCodes],
      };
    }
  }

  return undefined;
}

/**
 * A STEP PIPELINE (`strategy: 'steps'`).
 *
 * Two halves, and they belong to different people:
 *
 *   STRUCTURE — `steps`, `gates`, `output` — is the catalog program NAME's. Checked here
 *   because this is where both writes converge: `PUT program-names/:key/income-rule` and
 *   every bank-program save run the same `validateIncomeRule`, so the catalog can never
 *   accept a pipeline a program is then refused for.
 *
 *   FIGURES — `stepParams` — are the bank's. Checked per step against the op that step
 *   runs, delegating to the SAME `validateBands` / row checks the single-fact methods
 *   use, so a duplicate key or an unordered band reports the message it already has.
 *
 * Fails on the FIRST problem, like every other validator here. A pipeline with four
 * broken steps is not four fixes, it is an unfinished pipeline, and reporting all four
 * would bury the one the operator is mid-way through typing.
 */
async function validateProductRule(
  config: IncomeAssumptionConfig,
  ctx: IncomeRuleValidationContext,
  opts: IncomeRuleValidationOptions,
): Promise<IncomeRuleViolation | undefined> {
  // A CATALOG rule is the structure and, at most, a set of starting figures. Requiring it to
  // be complete would refuse the very thing it exists to be: the four banks under one
  // compound frame disagree about every number in it, so the catalog states none of them and
  // each bank fills its own. A BANK's rule is held to completeness, which is where an
  // unfinished pipeline actually costs an applicant a quote.
  const figuresRequired = opts.figuresRequired ?? true;
  const rule = config as ProductRule;
  const steps = rule.steps ?? [];

  if (steps.length === 0) return { kind: 'productRuleInvalid', reason: 'no_steps' };
  if (!rule.output?.from) return { kind: 'productRuleInvalid', reason: 'no_output' };
  if (rule.output.kind !== 'monthlyIncome' && rule.output.kind !== 'maxAmount') {
    return {
      kind: 'productRuleInvalid',
      reason: 'bad_output_kind',
      detail: String(rule.output.kind),
    };
  }

  const baseline = rule.output.baselineDbrPercent;
  if (baseline !== undefined) {
    const parsed = toDecimalOrNull(baseline);
    if (parsed === null || parsed.lessThanOrEqualTo(ZERO) || parsed.greaterThan(HUNDRED)) {
      return { kind: 'productRuleInvalid', reason: 'bad_baseline_dbr', detail: baseline };
    }
  }

  // The registry is read ONCE. A per-step probe would ask the same question ten times
  // and let the ten answers differ mid-save.
  const registry = await ctx.surrogateFacts();
  const factByKey = new Map(registry.map((f) => [f.key, f]));
  // A DERIVED fact has no registry row to find: the platform computes it per quote (which
  // bank the applicant already uses is a different answer for every program), so demanding
  // one would refuse every rule that reads a segment.
  const missingFact = factsReadBy(rule).find(
    (key) => !factByKey.has(key) && !isDerivedFactKey(key),
  );
  if (missingFact !== undefined) {
    return {
      kind: 'factUnavailable',
      factKey: missingFact,
      availableFacts: registry.map((f) => f.key),
    };
  }

  const params = rule.stepParams ?? {};

  // Steps a `coalesce` chooses between, and steps a gate compares against, are OPTIONAL:
  // leaving one blank is how a bank declines a derivation or a condition the catalog offers.
  // Every other step must be configured, or the rule would quote nothing and say only that
  // something, somewhere, was unset.
  const optional = optionalStepIds(rule);

  const seenIds = new Set<string>();
  for (const step of steps) {
    if (seenIds.has(step.id)) {
      return { kind: 'productRuleInvalid', reason: 'duplicate_step_id', stepId: step.id };
    }
    if (!isStepOp(step.op)) {
      return {
        kind: 'productRuleInvalid',
        reason: 'unknown_op',
        stepId: step.id,
        detail: String(step.op),
      };
    }

    const refProblem = validateRefs(refsOf(step.of), seenIds, step.id);
    if (refProblem) return refProblem;

    const arity = validateArity(step);
    if (arity) return arity;

    // Every step id is in scope for LATER steps only, so a self- or forward reference is
    // caught above rather than resolving to nothing at quote time.
    seenIds.add(step.id);

    const figures = params[step.id] ?? {};
    if (!isStepConfigured(step, figures)) {
      if (figuresRequired && !optional.has(step.id)) {
        return { kind: 'productRuleInvalid', reason: 'unconfigured_step', stepId: step.id };
      }
      // Declined, and legitimately blank. Nothing to check inside it.
      continue;
    }
    const problem = await validateStepFigures(step, figures, factByKey, ctx);
    if (problem) return problem;
  }

  // Every `coalesce` needs at least ONE configured candidate. Without this a bank could
  // save a rule that declines all four derivations and reports `rule_unconfigured` to every
  // applicant — the definition of a program that looks live and quotes nothing.
  for (const step of steps) {
    if (!figuresRequired) break;
    if (step.op !== 'coalesce') continue;
    const refs = refsOf(step.of);
    const candidates = refs.flatMap((ref) => ('step' in ref ? [ref.step] : []));
    // A coalesce over facts or literals has nothing to leave blank, so it is always fine.
    //
    // Which is true of a MIXED list too, and testing `candidates.length > 0` missed it:
    // the compound rule's `multiUnitPct` and `jointPct` are `coalesce [{step:…}, {const:'100'}]`,
    // where the literal IS the "this bank states no policy" answer. One unconfigured step ref
    // beside a constant that always resolves was being reported as a rule that produces
    // nothing — and it refused all four live compound programs on their own save path, on
    // rules that were quoting correctly the whole time. `coalesce` in `product-rule.ts` has
    // always agreed with the comment rather than the code: it skips unset STEP refs and takes
    // a literal as given.
    if (candidates.length !== refs.length) continue;
    // Recursive, because a candidate can be a step that needs no figures of its OWN and
    // still be empty: `pickByFact` is arithmetic over two columns, so `isStepConfigured`
    // answers `true` for it unconditionally — and the compound rule's FIRST candidate is a
    // pick, which made this whole guard unreachable. A pick counts as configured only when
    // one of its columns is.
    const reaches = (id: string, depth = 0): boolean => {
      if (depth > 8) return true;
      const candidate = steps.find((s2) => s2.id === id);
      if (candidate === undefined) return false;
      if (candidate.op === 'pickByFact' || candidate.op === 'coalesce') {
        const inner = refsOf(candidate.of);
        // A literal member always resolves, so such a list is never empty.
        if (inner.some((ref) => !('step' in ref))) return true;
        return inner.some((ref) => 'step' in ref && reaches(ref.step, depth + 1));
      }
      return isStepConfigured(candidate, params[id] ?? {});
    };
    const anyConfigured = candidates.some((id) => reaches(id));
    if (candidates.length > 0 && !anyConfigured) {
      return { kind: 'productRuleInvalid', reason: 'coalesce_empty', stepId: step.id };
    }
  }

  if (!seenIds.has(rule.output.from)) {
    return { kind: 'productRuleInvalid', reason: 'unknown_output_step', stepId: rule.output.from };
  }

  // A step marked `optional` reads an ABSENT answer as "this bank stated nothing" instead of
  // stopping the rule. That is exactly right for an adjustment the applicant may decline —
  // the bureau score — and exactly wrong anywhere else: on a step the answer depends on it
  // turns a required question into one whose omission silently changes the figure.
  //
  // So it is legal only where the skip can actually be absorbed: every path from the step to
  // the answer must pass through a `coalesce` that offers something else. `pickByFact` does
  // NOT count — it falls back to the first CONFIGURED column, which is a statement about the
  // bank rather than a substitute for a missing answer.
  // `skipUnset` changes what a comparison does with a blank member, so it means something
  // only on a comparison. Anywhere else it is a flag that does nothing, which is worse than
  // absent — the next operator reads it and believes it.
  const straySkipUnset = steps.find(
    (step) => step.skipUnset === true && step.op !== 'minOf' && step.op !== 'maxOf',
  );
  if (straySkipUnset) {
    return {
      kind: 'productRuleInvalid',
      reason: 'skip_unset_not_applicable',
      stepId: straySkipUnset.id,
      detail: straySkipUnset.op,
    };
  }

  const optionalProblem = validateOptionalSteps(steps, rule.output.from);
  if (optionalProblem) return optionalProblem;

  for (const gate of rule.gates ?? []) {
    const figures = params[gate.id] ?? {};
    // A gate the bank did not turn on carries nothing to check. Its reason code is still
    // checked below, because that belongs to the CATALOG and is wrong for every bank.
    if (!isGateConfigured(gate, figures, seenIds)) {
      const reasonProblem = validateGateReasonCode(gate);
      if (reasonProblem) return reasonProblem;
      continue;
    }
    const problem = await validateGate(gate, figures, seenIds, factByKey, ctx);
    if (problem) return problem;
  }

  // LAST, deliberately. Figures for a step the pipeline does not have are almost always
  // the trace of a step the catalog renamed or removed — a CONSEQUENCE of something wrong
  // above, not the cause — so reporting it first would send the operator to fix the
  // symptom. Refused rather than ignored, though: silently dropping the numbers would
  // lose figures the bank still believes it states.
  const declaredIds = new Set(paramKeysOf(rule));
  const strayParam = Object.keys(params).find((key) => !declaredIds.has(key));
  if (strayParam !== undefined) {
    return { kind: 'productRuleInvalid', reason: 'unknown_param_key', stepId: strayParam };
  }

  return undefined;
}

function refsOf(of: RuleStep['of']): ValueRef[] {
  if (of === undefined) return [];
  return Array.isArray(of) ? of : [of];
}

/** A reference may name an EARLIER step, a registry fact, or a parseable literal. */
function validateRefs(
  refs: readonly ValueRef[],
  earlierIds: ReadonlySet<string>,
  stepId: string,
): ProductRuleViolation | undefined {
  for (const ref of refs) {
    if ('step' in ref) {
      if (ref.step === stepId) {
        return {
          kind: 'productRuleInvalid',
          reason: 'forward_reference',
          stepId,
          detail: ref.step,
        };
      }
      if (!earlierIds.has(ref.step)) {
        // Either it does not exist or it comes later. Both are one mistake to the
        // operator — "this step reads a value that is not available here" — and the
        // reason names which of the two it is.
        return {
          kind: 'productRuleInvalid',
          reason: 'unknown_step_reference',
          stepId,
          detail: ref.step,
        };
      }
      continue;
    }
    if ('const' in ref && toDecimalOrNull(ref.const) === null) {
      return { kind: 'productRuleInvalid', reason: 'bad_constant', stepId, detail: ref.const };
    }
  }
  return undefined;
}

/** How many inputs each op needs. `subtract` is ordered, so exactly two. */
function validateArity(step: RuleStep): ProductRuleViolation | undefined {
  const count = refsOf(step.of).length;
  const needsFact =
    step.op === 'factNumber' || step.op === 'factChoiceTable' || step.op === 'factParentTable';

  // `pickByFact` reads a fact AND operates on inputs, and its `branches` are positional:
  // a list of a different length than `of` would silently leave one column unreachable,
  // which is exactly the tier fall-through this shape exists to make impossible.
  if (step.op === 'pickByFact') {
    if (!step.fact) {
      return { kind: 'productRuleInvalid', reason: 'missing_fact', stepId: step.id };
    }
    const branches = step.branches ?? [];
    if (branches.length === 0) {
      return { kind: 'productRuleInvalid', reason: 'branches_empty', stepId: step.id };
    }
    if (branches.length !== count) {
      return {
        kind: 'productRuleInvalid',
        reason: 'branches_mismatch',
        stepId: step.id,
        detail: `${branches.length}/${count}`,
      };
    }
    return undefined;
  }

  if (needsFact) {
    return step.fact
      ? undefined
      : { kind: 'productRuleInvalid', reason: 'missing_fact', stepId: step.id };
  }
  if (step.op === 'constant') return undefined;
  if (step.op === 'subtract' && count !== 2) {
    return { kind: 'productRuleInvalid', reason: 'wrong_ref_count', stepId: step.id, detail: '2' };
  }
  if (step.op !== 'subtract' && count < 1) {
    return { kind: 'productRuleInvalid', reason: 'wrong_ref_count', stepId: step.id, detail: '1+' };
  }
  return undefined;
}

/** The bank's figures for one step, checked against the op that will spend them. */
async function validateStepFigures(
  step: RuleStep,
  figures: NonNullable<IncomeAssumptionConfig['stepParams']>[string],
  factByKey: ReadonlyMap<string, SurrogateFactBinding>,
  ctx: IncomeRuleValidationContext,
): Promise<IncomeRuleViolation | undefined> {
  switch (step.op) {
    case 'constant': {
      const value = toDecimalOrNull(figures.valueEGP);
      // Zero IS legal here and negative is not: a `constant` of 0 is the idiom for
      // clamping a subtraction with `maxOf`, which the ops test pins down.
      if (value === null || value.lessThan(ZERO)) {
        return { kind: 'incomeInvalid', stepId: step.id, incomeEGP: figures.valueEGP ?? '' };
      }
      return undefined;
    }

    case 'factChoiceTable':
    case 'factParentTable': {
      const table = figures.keyTable;
      if (!table || table.length === 0) {
        return { kind: 'empty', strategy: 'steps', stepId: step.id };
      }
      // A choice step's keys ARE the bound question's option codes, exactly as for a
      // `fact:` rule — one list by construction, so a renamed option cannot leave a table
      // pointing at a key nobody can answer.
      //
      // A PARENT step's keys are not checked: they are the `parentKey` of the registry
      // rows behind those options, which is data this validator has no view of, and
      // refusing on a stale one would refuse a save that a lookup fix elsewhere makes
      // valid — the v16.4.1 lesson about a catalog tick blocking a legitimate program.
      const questionCode =
        step.op === 'factChoiceTable' && step.fact
          ? factByKey.get(step.fact)?.questionCode
          : undefined;
      const optionCodes = questionCode
        ? new Set(await ctx.questionOptionCodes(questionCode))
        : null;

      const seen = new Set<string>();
      for (const row of table) {
        if (seen.has(row.key)) return { kind: 'duplicateKey', key: row.key, stepId: step.id };
        seen.add(row.key);
        const value = toDecimalOrNull(row.incomeEGP);
        if (value === null || value.lessThanOrEqualTo(ZERO)) {
          return { kind: 'incomeInvalid', key: row.key, incomeEGP: row.incomeEGP, stepId: step.id };
        }
        if (optionCodes && !optionCodes.has(row.key)) {
          return {
            kind: 'unknownKey',
            key: row.key,
            registry: questionCode as string,
            activeKeys: [...optionCodes],
            stepId: step.id,
          };
        }
      }
      return undefined;
    }

    case 'bandTable': {
      // The SAME band checks the single-fact methods run — ordering, gaps, overlaps, the
      // open-ended-last rule, positive figures. Passed a synthetic config rather than
      // refactored into a row-level helper: the function is already exactly right, and a
      // second entry point is a second thing to keep in step.
      const violation = validateBands({ strategy: 'steps', bands: figures.bands }, 'steps', {
        bandsRequired: true,
      });
      if (!violation) return undefined;
      switch (violation.kind) {
        case 'empty':
        case 'bandsInvalid':
        case 'incomeInvalid':
          return { ...violation, stepId: step.id };
        default:
          return violation;
      }
    }

    case 'percentOf':
    case 'upliftPercent':
    case 'multiply': {
      // A step that takes its factor from a SECOND input states no figure — the compound
      // product's down payment is the customer's percentage of the customer's price, and
      // there is no bank number in it. Requiring a scalar anyway would force the operator
      // to type one the engine then ignores.
      if (refsOf(step.of).length >= 2) return undefined;
      const value = toDecimalOrNull(figures.scalar?.value);
      if (value === null || value.lessThanOrEqualTo(ZERO)) {
        return {
          kind: 'productRuleInvalid',
          reason: 'bad_scalar',
          stepId: step.id,
          detail: figures.scalar?.value ?? '',
        };
      }
      return undefined;
    }

    case 'pickByFact': {
      // No figures of its own — the two columns are steps, and each states its own. What is
      // checked here is that every BRANCH names an option the applicant can actually pick,
      // for the same reason a choice table's keys are: a branch nobody can answer is a
      // column nobody can reach, and it would look configured on the screen.
      //
      // A DERIVED fact has no bound question (the platform computes it, so there are no
      // option rows to read); its branch codes are the engine's own, checked by its type.
      const derived = step.fact ? derivedFactOptionCodes(step.fact) : null;
      const questionCode = step.fact ? factByKey.get(step.fact)?.questionCode : undefined;
      if (derived === null && !questionCode) return undefined;
      const optionCodes = new Set(
        derived ?? (await ctx.questionOptionCodes(questionCode as string)),
      );
      for (const branch of step.branches ?? []) {
        if (!optionCodes.has(branch)) {
          return {
            kind: 'unknownKey',
            key: branch,
            registry: questionCode ?? (step.fact as string),
            activeKeys: [...optionCodes],
            stepId: step.id,
          };
        }
      }
      return undefined;
    }

    default:
      // `factNumber`, `sum`, `subtract`, `minOf`, `maxOf` — pure arithmetic over values
      // the steps above produced. No figures to state, so nothing to check.
      return undefined;
  }
}

/**
 * The gate's reason code, checked whether or not any bank turned the gate on.
 *
 * It is the CATALOG's field: a code with no sentence in the locale dictionaries would render
 * as a raw id the day the first bank turns it on (Principle III / A2), and by then the
 * catalog edit that introduced it is long saved.
 */
function validateGateReasonCode(gate: RuleGate): ProductRuleViolation | undefined {
  if ((GATE_REASON_CODES as readonly string[]).includes(gate.reasonCode)) return undefined;
  return {
    kind: 'productRuleInvalid',
    reason: 'unknown_gate_reason',
    gateId: gate.id,
    detail: String(gate.reasonCode),
  };
}

async function validateGate(
  gate: RuleGate,
  figures: NonNullable<IncomeAssumptionConfig['stepParams']>[string],
  stepIds: ReadonlySet<string>,
  factByKey: ReadonlyMap<string, { questionCode?: string }>,
  ctx: IncomeRuleValidationContext,
): Promise<IncomeRuleViolation | undefined> {
  const reasonProblem = validateGateReasonCode(gate);
  if (reasonProblem) return reasonProblem;

  if (gate.kind === 'choice') {
    return gate.expect?.length
      ? undefined
      : { kind: 'productRuleInvalid', reason: 'gate_expect_empty', gateId: gate.id };
  }

  const refProblem = validateRefs([gate.left], stepIds, gate.id);
  if (refProblem) return { ...refProblem, gateId: gate.id };

  if (gate.kind === 'numberByKey') {
    const table = figures.keyTable;
    if (!table || table.length === 0) return { kind: 'empty', strategy: 'steps', stepId: gate.id };
    // The keys are the answers to the fact this gate is keyed BY, so they are checked against
    // that question's option codes — the same check a `factChoiceTable` step's table gets,
    // and for the same reason. Left out, a typo saved 200 and then answered `no_matching_row`
    // at the gate for every applicant who picked that option: the one place in this product
    // where a wrong key was discovered on a customer rather than at save.
    const questionCode = factByKey.get(gate.keyedBy)?.questionCode;
    const optionCodes = questionCode ? new Set(await ctx.questionOptionCodes(questionCode)) : null;
    const seen = new Set<string>();
    for (const row of table) {
      if (seen.has(row.key)) return { kind: 'duplicateKey', key: row.key, stepId: gate.id };
      seen.add(row.key);
      // A bound of 0 is legal — "no minimum for this key" is a real bank policy, and CAE
      // states exactly that for its salaried segment.
      const value = toDecimalOrNull(row.incomeEGP);
      if (value === null || value.lessThan(ZERO)) {
        return { kind: 'incomeInvalid', key: row.key, incomeEGP: row.incomeEGP, stepId: gate.id };
      }
      if (optionCodes && !optionCodes.has(row.key)) {
        return {
          kind: 'unknownKey',
          key: row.key,
          registry: questionCode as string,
          activeKeys: [...optionCodes],
          stepId: gate.id,
        };
      }
    }
    return undefined;
  }

  // A gate comparing against another STEP states no bound of its own — the requirement is
  // derived (one bank's required down-payment percentage is a band over the unit price).
  if (gate.right !== undefined) {
    const rightProblem = validateRefs([gate.right], stepIds, gate.id);
    return rightProblem ? { ...rightProblem, gateId: gate.id } : undefined;
  }

  const min = toDecimalOrNull(figures.minValue);
  const max = toDecimalOrNull(figures.maxValue);
  const needsMin = gate.op === 'gte' || gate.op === 'gt' || gate.op === 'between';
  const needsMax = gate.op === 'lte' || gate.op === 'lt' || gate.op === 'between';
  if ((needsMin && min === null) || (needsMax && max === null)) {
    // Refused rather than treated as "no bound": a gate the bank has not filled in would
    // otherwise report `rule_unconfigured` to every applicant at quote time, which reads
    // as a broken product rather than an unfinished one.
    return { kind: 'productRuleInvalid', reason: 'gate_bounds_missing', gateId: gate.id };
  }
  if (min !== null && max !== null && min.greaterThan(max)) {
    return {
      kind: 'productRuleInvalid',
      reason: 'gate_bounds_missing',
      gateId: gate.id,
      detail: 'min>max',
    };
  }
  return undefined;
}

function validateDbrOverride(raw: string | undefined): IncomeRuleViolation | undefined {
  if (raw === undefined) return undefined;
  const value = toDecimalOrNull(raw);
  // (0, 100]: zero would cap every applicant at no affordability at all, which is
  // never a policy anyone means to express, and 100 is the legal ceiling.
  if (value === null || value.lessThanOrEqualTo(ZERO) || value.greaterThan(HUNDRED)) {
    return { kind: 'dbrOverrideInvalid', value: raw };
  }
  return undefined;
}

/**
 * The additional-income policy (spec §10.11).
 *
 * Every check here answers the same question: would this row contribute the figure the bank
 * wrote on its sheet? A source the registry cannot serve, one bound to a question that is not
 * a NUMBER, a weight of zero or above a hundred — each of those contributes nothing while the
 * screen shows a configured policy, which is exactly the silent failure
 * `INCOME_RULE_FACT_UNAVAILABLE` was introduced for.
 *
 * The cap is (0, 100] like every other percentage the platform stores. A cap of zero is
 * refused rather than read as "count nothing": a bank that counts nothing lists no sources,
 * and a zero cap makes every weighted row on the screen a lie.
 */
async function validateAdditionalIncome(
  config: IncomeAssumptionConfig['additionalIncome'],
  ctx: IncomeRuleValidationContext,
): Promise<IncomeRuleViolation | undefined> {
  if (config === undefined) return undefined;

  const sources = config.sources ?? [];
  // An empty policy is refused rather than ignored: it is reached only by a screen that
  // wrote the object, and silently dropping it would tell the operator it saved.
  if (sources.length === 0) return { kind: 'additionalIncomeInvalid', reason: 'no_sources' };

  const registry = await ctx.surrogateFacts();
  const byKey = new Map(registry.map((fact) => [fact.key, fact]));
  const seen = new Set<string>();

  for (const source of sources) {
    if (seen.has(source.factKey)) {
      return {
        kind: 'additionalIncomeInvalid',
        reason: 'duplicate_source',
        factKey: source.factKey,
      };
    }
    seen.add(source.factKey);

    const fact = byKey.get(source.factKey);
    if (fact === undefined) {
      return { kind: 'additionalIncomeInvalid', reason: 'unknown_fact', factKey: source.factKey };
    }
    // An AMOUNT, never an option code: `resolveAdditionalIncome` reads a numeric answer and
    // ignores a choice, so a source bound to a select would count nothing forever.
    if (fact.type !== 'NUMERIC') {
      return { kind: 'additionalIncomeInvalid', reason: 'not_numeric', factKey: source.factKey };
    }

    const percent = toDecimalOrNull(source.percent);
    if (percent === null || percent.lessThanOrEqualTo(ZERO) || percent.greaterThan(HUNDRED)) {
      return {
        kind: 'additionalIncomeInvalid',
        reason: 'percent_out_of_range',
        factKey: source.factKey,
        value: source.percent,
      };
    }
  }

  if (config.capPercentOfBasic !== undefined) {
    const cap = toDecimalOrNull(config.capPercentOfBasic);
    if (cap === null || cap.lessThanOrEqualTo(ZERO) || cap.greaterThan(HUNDRED)) {
      return {
        kind: 'additionalIncomeInvalid',
        reason: 'cap_out_of_range',
        value: config.capPercentOfBasic,
      };
    }
  }

  return undefined;
}

async function validateKeyTable(
  config: IncomeAssumptionConfig,
  strategy: IncomeAssumptionStrategy,
  ctx: IncomeRuleValidationContext,
): Promise<IncomeRuleViolation | undefined> {
  const table = config.keyTable;
  if (!table || table.length === 0) return { kind: 'empty', strategy };

  const registry = KEY_TABLE_REGISTRY[strategy as (typeof KEY_TABLE_STRATEGIES)[number]];
  const seen = new Set<string>();

  for (const row of table) {
    if (seen.has(row.key)) return { kind: 'duplicateKey', key: row.key };
    seen.add(row.key);

    const income = toDecimalOrNull(row.incomeEGP);
    if (income === null || income.lessThanOrEqualTo(ZERO)) {
      return { kind: 'incomeInvalid', key: row.key, incomeEGP: row.incomeEGP };
    }

    // Fails CLOSED (AS-1.9). The engine looks up by key, so a dead key resolves to
    // nothing for every applicant, forever, with nothing on screen to say so.
    if (!(await ctx.isActiveMember(registry, row.key))) {
      const activeKeys = await ctx.activeMembers(registry);
      return { kind: 'unknownKey', key: row.key, registry, activeKeys: [...activeKeys] };
    }
  }

  return undefined;
}

function validateBands(
  config: IncomeAssumptionConfig,
  strategy: IncomeAssumptionStrategy,
  opts: { bandsRequired?: boolean } = {},
): IncomeRuleViolation | undefined {
  const bands = config.bands;
  if (!bands || bands.length === 0) {
    if (opts.bandsRequired || BANDS_REQUIRED_STRATEGIES.has(strategy)) {
      return { kind: 'empty', strategy };
    }
    // A value method may legitimately carry the legacy percent scalar INSTEAD of a
    // band table — but only if it actually carries one. The escape hatch used to be
    // unconditional, so a brand-new `byCDValue` program with no bands and no percent
    // saved clean and the resolver then priced every applicant on its hardcoded
    // `?? '3'` — a figure no admin authored, which is the substituted default FR-020
    // exists to forbid. Nothing configured is `INCOME_RULE_EMPTY`, same as any other
    // method with nothing configured.
    return validateScalar(config, strategy, { optional: hasLegacyScalar(config) });
  }

  let previousTo: Prisma.Decimal | null = null;

  for (const [index, band] of bands.entries()) {
    const from = toDecimalOrNull(band.fromInclusive);
    if (from === null) return { kind: 'bandsInvalid', index, reason: 'edge_not_decimal' };

    const income = toDecimalOrNull(band.incomeEGP);
    if (income === null || income.lessThanOrEqualTo(ZERO)) {
      return { kind: 'incomeInvalid', index, incomeEGP: band.incomeEGP };
    }

    const isLast = index === bands.length - 1;
    const to =
      band.toExclusive === null || band.toExclusive === undefined
        ? null
        : toDecimalOrNull(band.toExclusive);

    if (band.toExclusive !== null && band.toExclusive !== undefined && to === null) {
      return { kind: 'bandsInvalid', index, reason: 'edge_not_decimal' };
    }

    // Only the LAST band may be open-ended: a bounded band after an open one can
    // never be reached, and the open one would swallow its range silently.
    if (to === null && !isLast) {
      return { kind: 'bandsInvalid', index, reason: 'open_band_not_last' };
    }
    // A CLOSED last band is legal. It says "above this, the rule yields nothing",
    // which `bandFor` reports as `no_matching_band` — a stated reason, not a zero.
    // Demanding an open top band made every legacy years table unsaveable: the read
    // path closes them at `maxYears + 1` precisely because opening them would start
    // handing an income to applicants who resolve to nothing today (FR-015), so the
    // admin had no edit that satisfied both rules.

    // An empty or inverted band covers nothing, so every value in it falls through
    // to a later band the admin did not intend.
    if (to !== null && to.lessThanOrEqualTo(from)) {
      return { kind: 'bandsInvalid', index, reason: 'unordered' };
    }

    if (previousTo !== null) {
      // Gapless BETWEEN the edges: a band must start exactly where the previous one
      // ended. Anything less is a gap (values resolve to nothing), anything more is
      // an overlap (two rows claim the same value, and first-match silently wins).
      if (from.greaterThan(previousTo)) {
        return { kind: 'bandsInvalid', index, reason: 'gap' };
      }
      if (from.lessThan(previousTo)) {
        return { kind: 'bandsInvalid', index, reason: 'overlap' };
      }
    }
    previousTo = to;
  }

  return undefined;
}

/** Does this blob still carry the strategy's own pre-canonical percentage? */
function hasLegacyScalar(config: IncomeAssumptionConfig): boolean {
  return legacyScalarKeysFor(config.strategy).some((key) => {
    const raw = config[key];
    return typeof raw === 'string' && raw.trim() !== '';
  });
}

function validateScalar(
  config: IncomeAssumptionConfig,
  strategy: IncomeAssumptionStrategy,
  opts: { optional?: boolean } = {},
): IncomeRuleViolation | undefined {
  const scalar = config.scalar;
  if (!scalar) {
    // Optional for the two value methods, which may carry the legacy percent
    // instead; and a legacy scalar reaching the validator has already been
    // normalized into `scalar` by the read path, so its absence here means the
    // admin genuinely configured nothing.
    if (opts.optional) return undefined;
    return { kind: 'empty', strategy };
  }
  const value = toDecimalOrNull(scalar.value);
  if (value === null || value.lessThanOrEqualTo(ZERO)) {
    // Reported as an income problem rather than a band problem: the number IS the
    // rule for a scalar method, and the admin sees one field.
    return { kind: 'incomeInvalid', incomeEGP: scalar.value };
  }
  return undefined;
}

/**
 * Non-blocking findings (FR-001 edge case, FR-013).
 *
 * **A rule on a program whose type hides it is IGNORED and REPORTED, never
 * deleted.** Three seeded programs carry a table while typed `income_proof`
 * (`abk-egypt-2026.ts` against `catalogs/base.ts`), so a strip-on-save rule would
 * have destroyed those tables the first time an admin pressed Save on an unrelated
 * field. The correct fix for a mis-typed program is to change its type, not to
 * lose its configuration — so the warning names the type, and the data stands.
 */
export function collectIncomeRuleWarnings(args: {
  config: IncomeAssumptionConfig | null | undefined;
  programType: string;
  productCategory: string;
  /** The program's own document list, which the method's demands are checked against. */
  programRequiredDocuments: readonly string[];
}): IncomeRuleWarning[] {
  const { config, programType, productCategory, programRequiredDocuments } = args;
  if (!config) return [];
  const warnings: IncomeRuleWarning[] = [];

  const configured = hasMethodConfiguration(config);
  // `programType` ALONE, matching the engine's own gate
  // (`quote.ts#shouldConsultIncomeRule`). This warning answers one question — "is the
  // table I just typed ever read?" — and the type is the whole answer.
  //
  // v15.1.0 also narrowed on a hardcoded surrogate-CAPABLE category list, which made
  // this report a rule as ignored on a category outside that list even though the engine
  // WOULD price off it — a warning that contradicted the runtime. v16.0.0 dropped the
  // list (capability is derived from which categories ask the facts, and is configurable),
  // so the term goes with it. `meta.productCategory` is still reported, because "a grade
  // table on a mortgage" is context the admin wants even when the type is correct.
  const ruleIsRead = programType === 'income_surrogate';
  if (configured && !ruleIsRead) {
    warnings.push({
      kind: 'ruleIgnoredForProgramType',
      programType,
      productCategory,
      strategy: config.strategy,
    });
  }

  // FR-013 — the method declares the documents it demands; the admin sees a
  // non-blocking warning when the program's own list lacks them. Non-blocking on
  // purpose: the document list and the income rule are edited on different screens,
  // and refusing the save would make the second edit impossible until the first.
  const demanded = config.requiredDocuments ?? [];
  if (demanded.length > 0) {
    const have = new Set(programRequiredDocuments);
    const missing = demanded.filter((doc) => !have.has(doc));
    if (missing.length > 0) warnings.push({ kind: 'requiredDocumentsMissing', missing });
  }

  return warnings;
}

/** Whether the rule carries any method configuration at all. */
function hasMethodConfiguration(config: IncomeAssumptionConfig): boolean {
  return Boolean(
    config.keyTable?.length ||
    config.bands?.length ||
    config.scalar ||
    // Legacy shapes count: a mis-typed program carrying one is exactly the case
    // the "ignored, never deleted" rule exists for.
    config.rankIncomeMap ||
    config.gradeIncomeMap ||
    config.incomeTable?.length ||
    // A legacy SCALAR is configuration too. Omitting it let a blob whose only rule
    // was `cdIncomePercent` read as "nothing configured", so the strip returned a
    // bare `{ strategy }` and the bank's percentage was gone.
    legacyScalarKeysFor(config.strategy).some((key) => {
      const raw = config[key];
      return typeof raw === 'string' && raw.trim() !== '';
    }),
  );
}

/**
 * Drop configuration belonging to a method other than the selected one (FR-011).
 *
 * The admin is warned client-side BEFORE the switch clears the old table, so this
 * is the server making the persisted blob honest rather than a surprise: a stored
 * `keyTable` under `strategy: 'byYearsInPractice'` would be invisible in the form
 * and unread by the engine, and would resurface the day someone switched the method
 * back.
 *
 * Legacy fields are dropped alongside, but ONLY when the save carries a canonical
 * shape for the selected method — otherwise a program whose rule has not been
 * re-saved through the new form yet would lose its table to an unrelated edit,
 * which is precisely the FR-001 edge case.
 */
export function stripForeignMethodConfig(
  config: IncomeAssumptionConfig | null | undefined,
): IncomeAssumptionConfig | null | undefined {
  if (!config) return config;
  const strategy = config.strategy;

  const keep: IncomeAssumptionConfig = {
    strategy,
    // `amounts` is NOT method configuration — it says whose figures apply, and it must
    // survive this pass or the whole catalog link dies here. Without it a program saved
    // on `amounts: 'catalog'` reached persistence as a bare `{ strategy }`: no table,
    // because the operator typed none, and no link either, because the flag naming the
    // catalog's table had been dropped. `stripInheritedAmounts` two calls later then read
    // `undefined` as "own amounts" and left the empty rule alone, so the resolver reported
    // `rule_unconfigured` for a program that was in fact configured — on the catalog.
    // The catalog write path is unaffected: it deletes `amounts` itself and says why.
    ...(config.amounts !== undefined ? { amounts: config.amounts } : {}),
    ...(config.dbrCapPercentOverride !== undefined
      ? { dbrCapPercentOverride: config.dbrCapPercentOverride }
      : {}),
    ...(config.requiredDocuments !== undefined
      ? { requiredDocuments: config.requiredDocuments }
      : {}),
    ...(config.combinationRule !== undefined ? { combinationRule: config.combinationRule } : {}),
    // NOT method configuration either, and it must survive for the same reason `amounts`
    // does: what other money a bank counts is a policy, not a table belonging to whichever
    // method is selected. Dropped here it was silently discarded on every save — the request
    // succeeded, the screen showed the weights the operator had typed, and the stored program
    // counted none of them. Found by saving one, not by reading this.
    ...(config.additionalIncome !== undefined ? { additionalIncome: config.additionalIncome } : {}),
  };

  // A STEP PIPELINE keeps BOTH halves here, and the split is made one step later.
  //
  // This function has two callers with opposite needs: the CATALOG write, whose rule IS
  // the structure plus the starting figures, and the bank-program save, which must keep
  // only the figures. Dropping the structure here would serve the second and silently
  // destroy the first — the catalog's own steps would be stripped by its own save. So
  // both survive this pass, and `stripCatalogStructure` (called only on the program path,
  // in `persistableIncomeAssumption`) is what removes the catalog's half from a bank row.
  if (isProductRuleStrategy(strategy)) {
    if (config.steps !== undefined) keep.steps = config.steps;
    if (config.gates !== undefined) keep.gates = config.gates;
    if (config.output !== undefined) keep.output = config.output;
    if (config.stepParams !== undefined) keep.stepParams = config.stepParams;
    return keep;
  }

  if (factKeyOf(strategy) !== null) {
    // A REGISTRY fact keeps whichever canonical shape the save carries — this function
    // is synchronous and has no registry, so it cannot know whether the bound question
    // is a choice or a number. Keeping both is safe in the only direction that matters:
    // `validateIncomeRule` runs first and REJECTS the wrong shape for the fact, so a
    // blob reaching persistence has already been judged against the binding. Guessing
    // here instead would silently delete the bank's table on a rule the validator was
    // about to accept.
    if (config.keyTable) keep.keyTable = config.keyTable;
    if (config.bands) keep.bands = config.bands;
  } else if (KEY_STRATEGY_SET.has(strategy) && config.keyTable) {
    keep.keyTable = config.keyTable;
  } else if (BAND_STRATEGY_SET.has(strategy) && config.bands) {
    keep.bands = config.bands;
  }

  // The two value methods keep a scalar alongside bands as their legacy form.
  //
  // `!keep.bands?.length`, NOT `!keep.bands`: the admin form always emits `bands` for
  // a band shape, so a legacy `byCDValue` program with no bands authored posts
  // `bands: []` — which is truthy. Testing the reference dropped the configured
  // percentage on every unrelated save and handed the program to the resolver's
  // hardcoded default (3% instead of the bank's own figure), silently re-quoting
  // every applicant on it.
  if (
    SCALAR_STRATEGY_SET.has(strategy) ||
    (BAND_STRATEGY_SET.has(strategy) && !keep.bands?.length)
  ) {
    if (config.scalar) keep.scalar = config.scalar;
    // The strategy's OWN legacy key travels with it — never another method's, which
    // is what `legacyScalarKeysFor` exists to bound. Dropping it here was the second
    // half of the same defect: a blob carrying only `cdIncomePercent` lost its
    // percentage entirely and fell back to the resolver's default.
    for (const legacyKey of legacyScalarKeysFor(strategy)) {
      const raw = config[legacyKey];
      if (typeof raw === 'string' && raw.trim() !== '') {
        (keep as unknown as Record<string, unknown>)[legacyKey] = raw;
      }
    }
  }

  // Nothing canonical for this method: carry the whole blob through untouched
  // rather than emit a rule with no configuration. This is the mis-typed-seed case
  // — the data survives, `collectIncomeRuleWarnings` reports it, and the engine
  // reads it through the normalizer.
  const gotCanonical = Boolean(keep.keyTable || keep.bands || keep.scalar);
  if (!gotCanonical && hasMethodConfiguration(config)) return config;

  return keep;
}

/**
 * Can a step's `optional` skip be absorbed?
 *
 * Yes exactly when every route from it to the answer runs through a `coalesce` that has
 * another candidate to fall back on. `coalesce` is the ONLY absorber: it is the one op whose
 * documented job is "the first input this bank configured", and the one the evaluator feeds
 * from `unset`.
 *
 * Walks CONSUMERS rather than inputs, because the question is what happens downstream of the
 * skip. Depth-capped like `neededStepIds`, for the same reason — a hand-edited blob must not
 * be able to spin the validator.
 */
function validateOptionalSteps(
  steps: readonly RuleStep[],
  outputFrom: string,
): IncomeRuleViolation | undefined {
  const flagged = steps.filter((step) => step.optional === true);
  if (flagged.length === 0) return undefined;

  const consumers = new Map<string, RuleStep[]>();
  for (const step of steps) {
    for (const ref of refsOf(step.of)) {
      if (!('step' in ref)) continue;
      const list = consumers.get(ref.step);
      if (list) list.push(step);
      else consumers.set(ref.step, [step]);
    }
  }

  for (const step of flagged) {
    // Only the fact ops read an answer, so only they have an absence to downgrade. Anywhere
    // else the flag does nothing at all, and a flag that does nothing is one the next
    // operator will believe.
    if (
      step.op !== 'factNumber' &&
      step.op !== 'factChoiceTable' &&
      step.op !== 'factParentTable'
    ) {
      return {
        kind: 'productRuleInvalid',
        reason: 'optional_step_not_skippable',
        stepId: step.id,
        detail: step.op,
      };
    }
    if (!absorbedByCoalesce(step.id, consumers, outputFrom, new Set())) {
      return { kind: 'productRuleInvalid', reason: 'optional_step_not_skippable', stepId: step.id };
    }
  }
  return undefined;
}

/** True when every consumer chain from `id` reaches a `coalesce` with an alternative. */
function absorbedByCoalesce(
  id: string,
  consumers: ReadonlyMap<string, RuleStep[]>,
  outputFrom: string,
  seen: Set<string>,
): boolean {
  // A cycle is unreachable (refs may name earlier steps only) and the cap is a backstop.
  if (seen.has(id) || seen.size > 32) return false;
  seen.add(id);

  // The answer itself, or a step nothing reads: the skip has nowhere to go, so declining the
  // question would end the rule as `rule_unconfigured` rather than fall back to anything.
  if (id === outputFrom) return false;
  const readers = consumers.get(id) ?? [];
  if (readers.length === 0) return false;

  return readers.every((reader) => {
    if (reader.op === 'coalesce') {
      // The alternative has to be something the same absence cannot also take out. Another
      // step reading the same answer would be unset too, so a literal or a fact is what
      // makes the fallback unconditional.
      return refsOf(reader.of).some((ref) => !('step' in ref));
    }
    return absorbedByCoalesce(reader.id, consumers, outputFrom, seen);
  });
}
