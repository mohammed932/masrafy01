/**
 * ONE definition of "this stored row reads that fact".
 *
 * A fact key is named in four places, and until this file existed only one of them was
 * ever counted. `countReferences`'s `surrogate_fact` branch matched
 * `incomeAssumption.strategy === 'fact:<key>'` — but every one of the eleven predefined
 * products compiles to a PIPELINE, whose strategy is the constant `'steps'` and whose
 * fact keys live inside `steps[]` and `gates[]`. So for every product this platform
 * actually sells, the count was zero and the delete guard was decoration. CLAUDE.md has
 * carried that as "Found, not fixed" since v18.4.0; the surface count has since grown to
 * four.
 *
 * The four, and what each one is:
 *
 *   1. `bank_program.incomeAssumption.strategy = 'fact:<key>'` — a single-fact method.
 *   2. `bank_program.incomeAssumption.steps[]` / `gates[]` — a pipeline, via `factsReadBy`.
 *   3. `bank_program.incomeAssumption.additionalIncome.sources[].factKey` — the weighted
 *      other-income sources, which are per BANK and name facts of their own.
 *   4. `bank_program.loanLimits.maxLoanByFact.{factKey,columnFactKey}` and
 *      `maxLoanAdjustments[].whenFactKey` — the CAP side. This is the entire reader set of
 *      a cap-only product: `club_branch_cap` guesses no income at all, so its fact is
 *      named here and nowhere else.
 *
 * Plus the same two rule surfaces on `platform_enumeration.incomeRule`, which is where a
 * `surrogate_product`'s own calculation and a `program_name`'s grandfathered one live.
 *
 * WHY IT DELEGATES TO `factsReadBy` RATHER THAN WALKING THE STEPS ITSELF. That function is
 * the validator's own answer to the same question (`validateProductRule` refuses a rule
 * naming a fact the registry cannot serve), so sharing it means a new op that names a fact
 * cannot slip past the delete guard: the guard changes when the validator changes. A second
 * walk would be a second opinion, and the two would diverge exactly once — quietly, on the
 * op nobody remembered to add.
 *
 * `templateSpec` is deliberately NOT a surface. It is compiled into `incomeRule` in one
 * statement and the two cannot disagree, so scanning both would be two answers to one
 * question.
 *
 * `valueSources` is deliberately not one either, and the intuition that it is, is wrong:
 * its marker paths are keyed by STEP ID and OPTION CODE
 * (`incomeRule.stepParams.<stepId>.keyTable.<optionCode>.incomeEGP`), so detaching a fact
 * dangles no marker. Retiring an OPTION does, which is a different change.
 *
 * READS EVERY BLOB DEFENSIVELY. These are `Json` columns: anything could be in one, and an
 * unreadable blob must count as NO reader rather than throw on a list read — the posture
 * `readsAFactWithNoTable` already takes in the repository.
 */
import { additionalIncomeFactKeys } from './additional-income';
import { factsReadBy } from './product-rule';
import type { ProductRule } from './product-rule';
import { SURROGATE_FACTS_BY_STRATEGY } from './surrogate-fact-bindings';
import { factKeyOf } from '../types';

/** Where a fact key was found, and what an operator would have to open to remove it. */
export type FactReaderSource =
  | 'bank_program'
  | 'bank_program_cap'
  | 'surrogate_product'
  | 'program_name';

export interface FactReader {
  source: FactReaderSource;
  /** `programCode` for a bank program, `platform_enumeration.key` for a stored rule. */
  ref: string;
}

/** One row of either scan, in the shape the repository selects it. */
export interface FactReaderProgramRow {
  programCode: string;
  incomeAssumption: unknown;
  loanLimits: unknown;
}

export interface FactReaderRuleRow {
  /** `surrogate_product` or `program_name`. */
  type: string;
  key: string;
  incomeRule: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * A raw blob narrowed to the shape `factsReadBy` can walk, or `null`.
 *
 * `factsReadBy` iterates `rule.steps ?? []` with `for…of`, which THROWS on a non-array —
 * and a hand-edited or half-migrated blob is exactly where a non-array turns up. The
 * arrays are checked here so the walk itself stays the pure, total function it is.
 */
function asWalkableRule(raw: unknown): ProductRule | null {
  if (!isRecord(raw)) return null;
  if (raw.steps !== undefined && !Array.isArray(raw.steps)) return null;
  if (raw.gates !== undefined && !Array.isArray(raw.gates)) return null;
  return raw as unknown as ProductRule;
}

/**
 * Every fact key an income rule reads — a bank program's or a stored catalog/product one.
 *
 * Covers all three rule-side surfaces: the strategy token (both token families, so the four
 * frozen built-in methods are counted too), the pipeline's steps and gates, and the
 * per-bank additional-income sources.
 */
export function factsReadByIncomeRule(raw: unknown): Set<string> {
  const keys = new Set<string>();
  if (!isRecord(raw)) return keys;

  if (typeof raw.strategy === 'string') {
    const named = factKeyOf(raw.strategy);
    if (named !== null) keys.add(named);
    // A built-in method names its fact through the frozen spec table rather than through
    // the token. `byMilitaryGrade` reads `military_grade`, and live offers still carry it.
    for (const fact of SURROGATE_FACTS_BY_STRATEGY[raw.strategy] ?? []) keys.add(fact);
  }

  const rule = asWalkableRule(raw);
  if (rule !== null) for (const key of factsReadBy(rule)) keys.add(key);

  if (isRecord(raw.additionalIncome)) {
    const sources = (raw.additionalIncome as { sources?: unknown }).sources;
    if (Array.isArray(sources)) {
      for (const key of additionalIncomeFactKeys(
        raw.additionalIncome as unknown as Parameters<typeof additionalIncomeFactKeys>[0],
      )) {
        keys.add(key);
      }
    }
  }

  return keys;
}

/**
 * Every fact key the CAP side of a bank program reads.
 *
 * Separate from the rule because it is a separate column and, for a cap-only product,
 * the only one: nothing about `loanLimits` passes through an income rule.
 */
export function factsReadByLoanLimits(raw: unknown): Set<string> {
  const keys = new Set<string>();
  if (!isRecord(raw)) return keys;

  const table = raw.maxLoanByFact;
  if (isRecord(table)) {
    if (typeof table.factKey === 'string' && table.factKey !== '') keys.add(table.factKey);
    if (typeof table.columnFactKey === 'string' && table.columnFactKey !== '') {
      keys.add(table.columnFactKey);
    }
  }

  if (Array.isArray(raw.maxLoanAdjustments)) {
    for (const adjustment of raw.maxLoanAdjustments) {
      if (!isRecord(adjustment)) continue;
      if (typeof adjustment.whenFactKey === 'string' && adjustment.whenFactKey !== '') {
        keys.add(adjustment.whenFactKey);
      }
    }
  }

  return keys;
}

/** Both of a bank program's surfaces, as one set. */
export function factsReadByProgram(row: {
  incomeAssumption: unknown;
  loanLimits: unknown;
}): Set<string> {
  const keys = factsReadByIncomeRule(row.incomeAssumption);
  for (const key of factsReadByLoanLimits(row.loanLimits)) keys.add(key);
  return keys;
}

/**
 * Everything that reads one fact key, across every surface.
 *
 * Reported as a LIST of references rather than a count, because a refusal has to name what
 * an operator must go and change — "in use by 3" sends them hunting. The two program
 * surfaces are reported apart for the same reason: the income rule is edited in the
 * program's income step, the cap table in its limits step.
 */
export function factReaders(
  factKey: string,
  rows: {
    programs: readonly FactReaderProgramRow[];
    rules: readonly FactReaderRuleRow[];
  },
): FactReader[] {
  const readers: FactReader[] = [];

  for (const program of rows.programs) {
    if (factsReadByIncomeRule(program.incomeAssumption).has(factKey)) {
      readers.push({ source: 'bank_program', ref: program.programCode });
    }
    if (factsReadByLoanLimits(program.loanLimits).has(factKey)) {
      readers.push({ source: 'bank_program_cap', ref: program.programCode });
    }
  }

  for (const rule of rows.rules) {
    if (!factsReadByIncomeRule(rule.incomeRule).has(factKey)) continue;
    readers.push({
      source: rule.type === 'surrogate_product' ? 'surrogate_product' : 'program_name',
      ref: rule.key,
    });
  }

  return readers;
}
