import { stableJson } from '@/common/stable-json.util';
import { isGateConfigured, isStepConfigured } from '@/matching/pipeline/product-rule';
import type { GateParams, ProductRule, StepParams } from '@/matching/pipeline/product-rule';

/**
 * What `npm run seed:sheet-figures` will write — decided before anything is written.
 *
 * Pure, and for the reason `blueprint-seed-plan.ts` gives for its own purity: the dangerous
 * half of a seed is not the arithmetic, it is deciding what to LEAVE ALONE. An operator may
 * have typed a figure of their own, and a re-run that overwrote it would undo their work on
 * the next deploy. That decision belongs somewhere it can be tested without a database.
 */

/** A leaf that counts as "somebody has typed a figure here". */
function isFigureLeaf(value: unknown): boolean {
  if (typeof value === 'number') return true;
  // Money crosses every hop as a decimal STRING (Principle I), so the figures this seed
  // writes are strings and a number-only walk would report every one of them as absent.
  if (typeof value === 'string') return /^-?\d+(\.\d+)?$/.test(value) && value.length > 0;
  return false;
}

/**
 * How many figures a stored blob holds, anywhere inside it.
 *
 * A walk rather than a set of JSON paths: `stepParams` is keyed by slot id, a slot's figures
 * are a table, a band list or a scalar, and a path list would be a second statement of the
 * slot vocabulary that goes stale the first time a product gains a way.
 */
export function countFigureLeaves(value: unknown): number {
  if (Array.isArray(value)) {
    return value.reduce<number>((total, item) => total + countFigureLeaves(item), 0);
  }
  if (value !== null && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).reduce<number>(
      (total, item) => total + countFigureLeaves(item),
      0,
    );
  }
  return isFigureLeaf(value) ? 1 : 0;
}

export type CatalogAction =
  /** The product is there and holds no figures — or `--force` was passed. */
  | { kind: 'write'; productKey: string }
  /** Somebody has already typed figures here. Untouched. */
  | { kind: 'skip'; productKey: string; figures: number }
  /** No such product. `seed:blueprints` has not been run, or the key is wrong. */
  | { kind: 'absent'; productKey: string };

export function planCatalogFigures(args: {
  productKey: string;
  /** `null` when no `surrogate_product` row of that key exists. */
  stored: { stepParams: unknown } | null;
  force: boolean;
}): CatalogAction {
  const { productKey, stored, force } = args;
  if (stored === null) return { kind: 'absent', productKey };
  const figures = countFigureLeaves(stored.stepParams);
  if (figures > 0 && !force) return { kind: 'skip', productKey, figures };
  return { kind: 'write', productKey };
}

export type NameAction =
  | { kind: 'create'; key: string }
  /** The row is already there. Its link and basis are re-asserted, never its label. */
  | { kind: 'reuse'; key: string };

export function planProgramName(args: { key: string; exists: boolean }): NameAction {
  return args.exists ? { kind: 'reuse', key: args.key } : { kind: 'create', key: args.key };
}

export type ProgramAction =
  | { kind: 'create'; programCode: string }
  /** Matched by `programCode`, which is why a re-run can never mint a second row. */
  | { kind: 'update'; programCode: string; version: number }
  /** Byte-identical to what is stored. Left alone, so a re-run writes nothing. */
  | { kind: 'unchanged'; programCode: string };

/**
 * Create, update, or leave alone.
 *
 * `unchanged` is what makes a re-run honest rather than merely harmless: `update` is a
 * full-replacement PUT that bumps the optimistic-lock version and writes an audit event, so a
 * seed that re-posted the same body on every deploy would fill the audit log with diffs
 * nobody made. The comparison is over a key-order-stable rendering of the configs this seed
 * actually owns — a raw `JSON.stringify` of two differently-keyed blobs is never equal.
 */
export function planProgram(args: {
  programCode: string;
  stored: { version: number; fingerprint: string } | null;
  fingerprint: string;
  force: boolean;
}): ProgramAction {
  const { programCode, stored } = args;
  if (stored === null) return { kind: 'create', programCode };
  if (!args.force && stored.fingerprint === args.fingerprint) {
    return { kind: 'unchanged', programCode };
  }
  return { kind: 'update', programCode, version: stored.version };
}

/**
 * What this seed owns on a program, rendered so two of them can be compared.
 *
 * Only the fields it writes: an operator may have edited a note or switched the program off,
 * and a fingerprint over the whole row would call that a difference and overwrite it.
 */
export function programFingerprint(program: {
  tenor?: unknown;
  loanLimits?: unknown;
  pricing?: unknown;
  eligibility?: unknown;
  incomeAssumption?: unknown;
  fees?: unknown;
  valueSources?: unknown;
  requiredDocuments?: unknown;
}): string {
  return stableJson({
    tenor: program.tenor,
    loanLimits: program.loanLimits,
    pricing: program.pricing,
    eligibility: program.eligibility,
    incomeAssumption: program.incomeAssumption,
    fees: program.fees,
    valueSources: program.valueSources,
    requiredDocuments: program.requiredDocuments,
  });
}

/**
 * The slots a rule owns that still hold no figure — the report the demo needs.
 *
 * Asked of the ENGINE, never worked out from the slot names: `paramKeysOf` returns every step
 * and gate id, and most of them take no figure at all — a `factNumber` reading an answer, a
 * `pickByFact` choosing a column, the `coalesce` that joins the ways. Listing those as "empty"
 * would report a healthy product as nine-tenths unconfigured, which is worse than saying
 * nothing: it trains a reader to ignore the report.
 *
 * A slot EXPECTS a figure exactly when it is unconfigured with no params at all, which is
 * what `isStepConfigured` / `isGateConfigured` already answer. One authority, so this can
 * never disagree with the validator about which box is owed.
 *
 * `gatesExpectedBlank` is true for a catalog product: a gate applies only when its figures are
 * present, so a catalog default would be a refusal rule live for every bank that inherits the
 * amounts. Blank there is the decision, not an omission.
 */
export function blankSlots(args: {
  rule: ProductRule;
  stepParams: Record<string, unknown> | null | undefined;
  gatesExpectedBlank: boolean;
}): string[] {
  const params = (args.stepParams ?? {}) as Record<string, StepParams & GateParams>;
  const at = (id: string): StepParams & GateParams => params[id] ?? {};
  const steps = args.rule.steps ?? [];

  const configuredStepIds = new Set(
    steps.filter((step) => isStepConfigured(step, at(step.id))).map((step) => step.id),
  );

  const blanks = steps
    .filter((step) => !isStepConfigured(step, {}))
    .filter((step) => !isStepConfigured(step, at(step.id)))
    // A condition's own figure is a condition's own figure whether the engine keeps it as a
    // gate bound or as a STEP the gate compares against (`cond__paidenough__bound` is a
    // `percentOf`). Both turn the condition ON, so both are per-bank and both are blank on a
    // catalog product on purpose.
    .filter((step) => !(args.gatesExpectedBlank && step.id.startsWith('cond__')))
    .map((step) => step.id);

  if (args.gatesExpectedBlank) return blanks;

  return [
    ...blanks,
    ...(args.rule.gates ?? [])
      .filter((gate) => !isGateConfigured(gate, {}, configuredStepIds))
      .filter((gate) => !isGateConfigured(gate, at(gate.id), configuredStepIds))
      .map((gate) => gate.id),
  ];
}
