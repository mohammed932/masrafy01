/**
 * Feature 013 — a bank program's ELIGIBILITY CONDITIONS on the applicant's answers.
 *
 * Pure module (Principle V): no Nest, no Prisma, no clock.
 *
 * WHAT A FAILURE IS. A stated refusal, never a hidden program. `quoteProgram` turns a failed
 * condition into the same `PRODUCT_RULE_GATE_FAILED` + `gateReasonCode` a product gate
 * yields (v28.0.0), so the program stays listed — in the same position — with a reason the
 * app already translates. Principle V forbids FILTERING programs by eligibility; it does not
 * forbid a bank saying "not for this applicant, and here is why" (operator decision,
 * 2026-10-04).
 *
 * WHAT IT MAY READ. Surrogate facts only — answers a question is bound to. Never an engine
 * input (amount, term, income, debts, employment type, age, I-Score): those shape the
 * AMOUNT, and a salary / age / DBR / amount gate is exactly what A33 keeps out. The save
 * path refuses them; this module never sees one.
 *
 * SEMANTICS.
 *   · every condition must pass (AND);
 *   · a condition passes when ANY of its criteria matches (OR) — which is how an exemption
 *     is written: "two years in business OR a guarantor";
 *   · a criterion is a `FactGridKey`, matched by `keyMatchesAnswer`, the one predicate every
 *     fact table on the platform uses — so a band means here what it means in a rate grid;
 *   · an UNANSWERED criterion does not match. A question a condition reads is made required
 *     wherever the program is quoted (`factsRefusingWhenUnanswered`), so this is reached only
 *     where no program name narrowed the questionnaire.
 */
import type { SurrogateFactValue } from '../types';
import { keyMatchesAnswer, type FactGridKey } from './fact-grid';
import { isGateReasonCode, type GateReasonCode } from './product-rule';

export interface ConditionCriterion {
  readonly factKey: string;
  /** No wildcard: a criterion that always matches would make its condition a no-op. */
  readonly key: Exclude<FactGridKey, null>;
}

export interface ProgramCondition {
  /** Stable within the program; reported as `gateId: 'condition:<id>'`. */
  readonly id: string;
  readonly anyOf: readonly ConditionCriterion[];
  readonly reasonCode: GateReasonCode;
}

export type ProgramConditionsOutcome =
  | { ok: true }
  | { ok: false; conditionId: string; reasonCode: GateReasonCode };

/** The `gateId` a failed condition is reported under — one spelling, here. */
export function conditionGateId(conditionId: string): string {
  return `condition:${conditionId}`;
}

/** All must pass; the first that fails, in stored order, is the one reported. */
export function evaluateProgramConditions(
  conditions: readonly ProgramCondition[] | undefined,
  facts: Readonly<Record<string, SurrogateFactValue>>,
): ProgramConditionsOutcome {
  for (const condition of conditions ?? []) {
    const passed = condition.anyOf.some((criterion) => {
      const answer = facts[criterion.factKey];
      return answer !== undefined && keyMatchesAnswer(criterion.key, answer);
    });
    if (!passed) return { ok: false, conditionId: condition.id, reasonCode: condition.reasonCode };
  }
  return { ok: true };
}

/** Every fact a program's conditions read — for the reader surfaces (`fact-readers.ts`). */
export function factsReadByConditions(
  conditions: readonly ProgramCondition[] | undefined,
): string[] {
  const out: string[] = [];
  for (const condition of conditions ?? []) {
    for (const criterion of condition.anyOf) {
      if (!out.includes(criterion.factKey)) out.push(criterion.factKey);
    }
  }
  return out;
}

/**
 * Read the stored column, or `[]`. A malformed CONDITION is dropped whole rather than
 * throwing — the `asPlanDefaults` posture, for the same reason: this runs inside the map
 * every quote is built from, and one bad row must not take down every other bank. The save
 * path validates, so only a hand edit to the database reaches this branch.
 */
export function asProgramConditions(raw: unknown): ProgramCondition[] {
  if (!Array.isArray(raw)) return [];
  const out: ProgramCondition[] = [];
  for (const item of raw) {
    if (item === null || typeof item !== 'object') continue;
    const c = item as Record<string, unknown>;
    if (typeof c.id !== 'string' || c.id === '') continue;
    if (typeof c.reasonCode !== 'string' || !isGateReasonCode(c.reasonCode)) continue;
    if (!Array.isArray(c.anyOf) || c.anyOf.length === 0) continue;
    const anyOf: ConditionCriterion[] = [];
    let malformed = false;
    for (const raw of c.anyOf) {
      const cr = raw as Record<string, unknown> | null;
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
      anyOf.push({ factKey: cr.factKey, key: cr.key as Exclude<FactGridKey, null> });
    }
    if (malformed) continue;
    out.push({ id: c.id, anyOf, reasonCode: c.reasonCode });
  }
  return out;
}
