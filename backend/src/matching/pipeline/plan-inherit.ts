/**
 * The PLAN tables a surrogate product hands down, and the one field that decides whose apply.
 *
 * Pure module: no Nest, no Prisma, no clock (Constitution Principle V).
 *
 * ─── What a plan is ───────────────────────────────────────────────────────────
 *
 * One row of a bank's auto card: "20% down → 10% a year, 6–60 months, we finance 80%, and
 * not under a million." Four figures against one axis — the share the customer puts down —
 * and every one of them is a `FactGridConfig` the engine already prices from. Nothing here
 * invents a shape; it decides which copy of those four a programme reads.
 *
 * ─── Why an explicit selector and NOT "blank inherits" ────────────────────────
 *
 * `tenor-inherit.ts` inherits the two months when a programme states neither, and that is
 * safe there for a reason that does NOT transfer: `minMonths`/`maxMonths` were both REQUIRED
 * until v29.1.0, so "states neither" was an unreachable state and could be given a new
 * meaning for free.
 *
 * The grids are not in that position. `tenor.maxMonthsByFact` is optional today and a blank
 * one already means something — its own docstring says so: *"a blank grid there is a stated
 * 'this bank does not cap by that', not 'nobody has said yet'"*. Overloading it would mean
 * that the day an operator first types a table on a product, every programme under it
 * silently starts reading a ceiling it never had, and no screen would have said so.
 *
 * So the programme says which it means. `plansSource` does not describe the grids — it
 * selects whose apply — which puts it in the same category as `incomeAssumption.amounts`,
 * and it is read the same way: **ABSENT reads as `'own'`**, because every row written before
 * this field existed carries its own figures and the absent case must change nothing.
 *
 * It is also what makes the product column safe to exist at all. `down_payment_income` is
 * sold under TWO catalog names — the down-payment programmes and Green Finance, which
 * finances a solar install and an e-bike. A car-price financed-share table that reached
 * every programme by default would reach those two. Under a selector they never opt in.
 */

import type { FactGridConfig } from './fact-grid';
import type { LoanLimitsConfig, PricingConfig, TenorConfig } from '../types';

/**
 * The five tables a product can state, each independently optional.
 *
 * Independently, and not both-or-neither like `TenorDefaults`: those two months are ONE
 * range and a half-stated pair is a range nobody set, where these five are five separate
 * statements. A product that states a rate table and no floor has said one thing and
 * declined to say another.
 */
export interface PlanDefaults {
  readonly rateByFact?: FactGridConfig;
  readonly minMonthsByFact?: FactGridConfig;
  readonly maxMonthsByFact?: FactGridConfig;
  readonly ltvCeilingByFact?: FactGridConfig;
  readonly minAmountByFact?: FactGridConfig;
}

export const PLANS_SOURCES = ['product', 'own'] as const;
export type PlansSource = (typeof PLANS_SOURCES)[number];

/** The slot names, derived once so no caller hand-types the list. */
const PLAN_SLOTS = [
  'rateByFact',
  'minMonthsByFact',
  'maxMonthsByFact',
  'ltvCeilingByFact',
  'minAmountByFact',
] as const satisfies ReadonlyArray<keyof PlanDefaults>;

/**
 * Which copy this programme reads. ABSENT IS `'own'` — see the header.
 *
 * An unknown string is also `'own'`, and deliberately: a value this build does not recognise
 * must not be read as "take somebody else's figures".
 */
export function plansSourceOf(raw: unknown): PlansSource {
  return raw === 'product' ? 'product' : 'own';
}

export function inheritsProductPlans(raw: unknown): boolean {
  return plansSourceOf(raw) === 'product';
}

/**
 * Read a product's stored `planDefaults` blob, or `undefined` when it states none.
 *
 * The ONE place the blob is given a shape. A slot that is not grid-shaped is DROPPED rather
 * than throwing, and a blob with no usable slot reads as absent — the `asTenorDefaults`
 * posture, for the same reason: this runs inside the map every quote is built from, and
 * refusing to build the book because one product's column is malformed would take down every
 * other bank with it.
 *
 * Validation of what is INSIDE a grid is the save path's (`validateFactGrid`). This only
 * decides whether there is a grid here at all.
 */
export function asPlanDefaults(raw: unknown): PlanDefaults | undefined {
  if (raw === null || typeof raw !== 'object') return undefined;
  const source = raw as Record<string, unknown>;
  const out: Record<string, FactGridConfig> = {};
  for (const slot of PLAN_SLOTS) {
    const grid = source[slot];
    if (!isGridShaped(grid)) continue;
    out[slot] = grid;
  }
  return Object.keys(out).length === 0 ? undefined : (out as PlanDefaults);
}

function isGridShaped(raw: unknown): raw is FactGridConfig {
  if (raw === null || typeof raw !== 'object') return false;
  const grid = raw as { axes?: unknown; cells?: unknown };
  return Array.isArray(grid.axes) && grid.axes.length > 0 && Array.isArray(grid.cells);
}

/**
 * The three merges, one per blob the plan tables live in.
 *
 * Each returns the SAME object when nothing is inherited — the convention this module's
 * sibling follows throughout, and what keeps the common path allocation-free for the 262
 * programmes that state their own.
 *
 * A stated grid on the programme ALWAYS wins, even under `plansSource: 'product'`. The two
 * are not in conflict: a programme that took the product's plans and then typed its own rate
 * has stated the rate and inherited the rest, which is the per-column three-state the admin
 * renders. `'own'` with no grid is the explicit opt-out.
 */
export function effectivePlanPricing(
  pricing: PricingConfig,
  source: unknown,
  defaults: PlanDefaults | undefined,
): PricingConfig {
  if (!inheritsProductPlans(source) || defaults?.rateByFact === undefined) return pricing;
  if (pricing.rateByFact !== undefined) return pricing;
  return { ...pricing, rateByFact: defaults.rateByFact };
}

export function effectivePlanTenor(
  tenor: TenorConfig,
  source: unknown,
  defaults: PlanDefaults | undefined,
): TenorConfig {
  if (!inheritsProductPlans(source) || defaults === undefined) return tenor;
  const max = tenor.maxMonthsByFact ?? defaults.maxMonthsByFact;
  const min = tenor.minMonthsByFact ?? defaults.minMonthsByFact;
  if (max === tenor.maxMonthsByFact && min === tenor.minMonthsByFact) return tenor;
  return {
    ...tenor,
    ...(max !== undefined ? { maxMonthsByFact: max } : {}),
    ...(min !== undefined ? { minMonthsByFact: min } : {}),
  };
}

export function effectivePlanLoanLimits(
  loanLimits: LoanLimitsConfig,
  source: unknown,
  defaults: PlanDefaults | undefined,
): LoanLimitsConfig {
  if (!inheritsProductPlans(source) || defaults === undefined) return loanLimits;
  const ltv = loanLimits.ltvCeilingByFact ?? defaults.ltvCeilingByFact;
  const floor = loanLimits.minAmountByFact ?? defaults.minAmountByFact;
  if (ltv === loanLimits.ltvCeilingByFact && floor === loanLimits.minAmountByFact) {
    return loanLimits;
  }
  return {
    ...loanLimits,
    ...(ltv !== undefined ? { ltvCeilingByFact: ltv } : {}),
    ...(floor !== undefined ? { minAmountByFact: floor } : {}),
  };
}
