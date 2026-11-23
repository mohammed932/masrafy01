/**
 * A bank program's CASES (v36.4.0) — "this combination of answers changes my offer".
 *
 * Pure module (Principle V): no Nest, no Prisma, no clock.
 *
 * A case is one line an operator reads like a sentence: "China + Used + made before 2020 →
 * finance 50%, at most 48 months". Every answer it names must match (AND); the cases are
 * read top to bottom and the FIRST that matches is the one applied — so a narrow case sits
 * above a broad one, the way a bank's own card is written.
 *
 * WHAT A MATCH DOES. Each figure the case states REPLACES that figure on the program for
 * this applicant — the table or band map behind it included — so the case is the price,
 * the share, the term or the amount, not a nudge on top of one. A figure the case leaves
 * blank is left to the program as it was. A case may instead REFUSE: a stated refusal on
 * the same reason a condition gives (`PRODUCT_RULE_GATE_FAILED`), never a filter.
 *
 * WHAT IT MAY READ. Answers a question is bound to (facts), matched by `keyMatchesAnswer`,
 * the one predicate every fact table uses. An UNANSWERED answer does not match, and a case
 * never makes its questions required: an applicant who skips one is priced by the program.
 */
import type { BankProgramSnapshot, SurrogateFactValue } from '../types';
import { keyMatchesAnswer, type FactGridKey } from './fact-grid';

export interface CaseCriterion {
  readonly factKey: string;
  readonly key: Exclude<FactGridKey, null>;
}

/** The figures a case may state. Money and percentages as decimal strings (Principle I). */
export interface CaseEffects {
  readonly ratePercent?: string;
  readonly ltvCeilingPercent?: string;
  readonly minAmountEGP?: string;
  readonly maxAmountEGP?: string;
  readonly minMonths?: number;
  readonly maxMonths?: number;
}

export interface ProgramCase {
  /** Stable within the program; reported as `case:<id>`. */
  readonly id: string;
  readonly allOf: readonly CaseCriterion[];
  readonly effects: CaseEffects;
  /** The bank does not lend in this case. The effects are then ignored. */
  readonly refuse?: boolean;
}

export const CASE_EFFECT_KEYS = [
  'ratePercent',
  'ltvCeilingPercent',
  'minAmountEGP',
  'maxAmountEGP',
  'minMonths',
  'maxMonths',
] as const satisfies ReadonlyArray<keyof CaseEffects>;

/** The `gateId` a refusing case is reported under — one spelling, here. */
export function caseGateId(caseId: string): string {
  return `case:${caseId}`;
}

/** The first case whose every answer matches, in stored order; `null` when none does. */
export function matchProgramCase(
  cases: readonly ProgramCase[] | undefined,
  facts: Readonly<Record<string, SurrogateFactValue>>,
): ProgramCase | null {
  for (const c of cases ?? []) {
    const all = c.allOf.every((criterion) => {
      const answer = facts[criterion.factKey];
      return answer !== undefined && keyMatchesAnswer(criterion.key, answer);
    });
    if (all) return c;
  }
  return null;
}

/** Drop every key of `obj` that starts with `prefix` — the tables behind one figure. */
function without<T extends object>(obj: T, prefix: string, keep: readonly string[] = []): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith(prefix) && !keep.includes(k)) continue;
    out[k] = v;
  }
  return out as T;
}

/**
 * The program as this applicant is priced under the case: each stated figure replaces the
 * program's own, and the tables that would have outranked it go with it. `cases` is removed,
 * so the result is quoted exactly once.
 */
export function applyCaseToProgram(
  program: BankProgramSnapshot,
  matched: ProgramCase,
): BankProgramSnapshot {
  const e = matched.effects;
  let pricing = program.pricing;
  if (e.ratePercent !== undefined) {
    pricing = {
      ...without(pricing, 'rateBy'),
      isVariableRate: false,
      baseRatePercent: e.ratePercent,
    };
    delete (pricing as { currentEffectiveRatePercent?: string }).currentEffectiveRatePercent;
  }
  let loanLimits = program.loanLimits;
  if (e.ltvCeilingPercent !== undefined) {
    loanLimits = { ...without(loanLimits, 'ltvCeilingBy'), ltvCeilingPercent: e.ltvCeilingPercent };
  }
  if (e.minAmountEGP !== undefined) {
    loanLimits = { ...without(loanLimits, 'minAmountBy'), minAmountEGP: e.minAmountEGP };
  }
  if (e.maxAmountEGP !== undefined) loanLimits = { ...loanLimits, maxAmountEGP: e.maxAmountEGP };
  let tenor = program.tenor;
  if (e.maxMonths !== undefined) {
    tenor = { ...without(tenor, 'maxMonthsBy'), maxMonths: e.maxMonths };
  }
  if (e.minMonths !== undefined) {
    tenor = { ...without(tenor, 'minMonthsBy'), minMonths: e.minMonths };
  }
  const out: BankProgramSnapshot = { ...program, pricing, loanLimits, tenor };
  delete out.cases;
  return out;
}

/** Every fact a program's cases read — asked wherever the program is quoted, never required. */
export function factsReadByCases(cases: readonly ProgramCase[] | undefined): string[] {
  const out: string[] = [];
  for (const c of cases ?? []) {
    for (const criterion of c.allOf) {
      if (!out.includes(criterion.factKey)) out.push(criterion.factKey);
    }
  }
  return out;
}

const DECIMAL = /^\d+(\.\d+)?$/;

/**
 * Read the stored column, or `[]`. A malformed case is dropped whole rather than throwing —
 * the `asProgramConditions` posture: this runs inside the map every quote is built from, and
 * the save path validates, so only a hand edit reaches this branch.
 */
export function asProgramCases(raw: unknown): ProgramCase[] {
  if (!Array.isArray(raw)) return [];
  const out: ProgramCase[] = [];
  for (const item of raw) {
    if (item === null || typeof item !== 'object') continue;
    const c = item as Record<string, unknown>;
    if (typeof c.id !== 'string' || c.id === '') continue;
    if (!Array.isArray(c.allOf) || c.allOf.length === 0) continue;
    const allOf: CaseCriterion[] = [];
    let malformed = false;
    for (const rawCriterion of c.allOf) {
      const cr = rawCriterion as Record<string, unknown> | null;
      if (
        cr === null ||
        typeof cr !== 'object' ||
        typeof cr.factKey !== 'string' ||
        cr.factKey === '' ||
        cr.key === null ||
        typeof cr.key !== 'object'
      ) {
        malformed = true;
        break;
      }
      allOf.push({ factKey: cr.factKey, key: cr.key as Exclude<FactGridKey, null> });
    }
    if (malformed) continue;
    const rawEffects = (c.effects ?? {}) as Record<string, unknown>;
    const effects: Record<string, string | number> = {};
    for (const k of CASE_EFFECT_KEYS) {
      const v = rawEffects[k];
      if (k === 'minMonths' || k === 'maxMonths') {
        if (typeof v === 'number' && Number.isInteger(v) && v > 0) effects[k] = v;
      } else if (typeof v === 'string' && DECIMAL.test(v)) {
        effects[k] = v;
      }
    }
    const refuse = c.refuse === true;
    if (!refuse && Object.keys(effects).length === 0) continue;
    out.push({
      id: c.id,
      allOf,
      effects: refuse ? {} : (effects as CaseEffects),
      ...(refuse ? { refuse: true } : {}),
    });
  }
  return out;
}
