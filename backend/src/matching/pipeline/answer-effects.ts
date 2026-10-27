/**
 * What an applicant's ANSWERS do to an offer, as the admin set it on each answer.
 *
 * Pure module: no Nest, no Prisma, no clock, no randomness (Constitution Principle V).
 *
 * ─── What it is ───────────────────────────────────────────────────────────────
 *
 * An answer option may carry an OFFER EFFECT, typed by the admin on the question editor
 * (v31.2.0, constitution v32.0.0):
 *
 *   "Do you own a car?"  Yes → max loan −10%, rate +1 point, longest term 60 months
 *
 * Three levers, each optional, each applied to EVERY program the applicant is quoted:
 *
 *   maxLoanPercent  the program's cap after its own table and adjustments, scaled by
 *                   (1 + p/100). Signed: "-10" lowers it, "+10" raises it.
 *   ratePoints      added to the annual rate the program's cascade priced. Signed. The
 *                   result is floored at 0 — a negative rate is no loan.
 *   maxTenorMonths  a ceiling on the term, beside the program's own. It SHORTENS the
 *                   term, never refuses: the program's floor still wins, as it does over
 *                   every other ceiling in `resolveTenor`.
 *
 * Shapes the AMOUNT and the PRICE, never whether a program is listed (Principle V: no
 * eligibility gates). There is no "refuse" lever on purpose.
 *
 * Both directions are allowed (operator: "everything dynamic"). A raise above what the bank
 * stated is the admin's call; the editor says so in plain words before it saves.
 *
 * ─── Ordering ─────────────────────────────────────────────────────────────────
 *
 * Effects arrive in a FIXED order — question code, then option display order — decided
 * once by the repository that loads them (`answerEffectSources`). The cap is rounded to piastres
 * at every step exactly as `max-loan-adjustments.ts` does, so the order is part of the
 * figure and the same answers always produce the same offer to the piastre.
 */

import { Decimal } from '@prisma/client/runtime/library';

/** Bounds the admin API enforces, and the editor mirrors. */
export const ANSWER_EFFECT_LIMITS = {
  maxLoanPercent: { min: -90, max: 100 },
  ratePoints: { min: -20, max: 20 },
  maxTenorMonths: { min: 1, max: 480 },
} as const;

/** One answer's effect on the offer, as the admin set it. All three levers optional. */
export interface AnswerEffectLevers {
  /** Signed decimal string, percent of the cap: "-10" = 10% lower, "10" = 10% higher. */
  maxLoanPercent?: string;
  /** Signed decimal string, added to the annual rate in percentage points. */
  ratePoints?: string;
  /** Longest term this answer allows, in months. */
  maxTenorMonths?: number;
}

/**
 * One effect the applicant's answers switched on — which answer, and what it does.
 *
 * Frozen onto the offer's `cascadeTrace.answerEffects` (Principle I / A6): a cap that moved
 * without saying why is a figure nobody can reconcile later, and the admin can retype the
 * effect after the offer is written.
 */
export interface AnswerEffect extends AnswerEffectLevers {
  questionCode: string;
  optionCode: string;
  /**
   * The question is fixed and asked on income-proof programs only, so its effect is read
   * there only — a no-payslip program never asked it and must not be priced by it.
   */
  incomeProofOnly: boolean;
}

/** The effect table the caller loads: question code → option code → levers. */
export interface AnswerEffectSource {
  questionCode: string;
  optionCode: string;
  incomeProofOnly: boolean;
  levers: AnswerEffectLevers;
}

/** The picks an applicant made, by question code. Numbers and text carry no option. */
export type AnswerPicks = Readonly<Record<string, readonly string[]>>;

/**
 * The picks out of the answer maps preview and apply both already build — single picks by
 * question code, multi picks by question code. One reading for both paths (A33).
 */
export function answerPicksFromMaps(maps: {
  readonly optionByCode: ReadonlyMap<string, string>;
  readonly multiByCode: ReadonlyMap<string, readonly string[]>;
}): AnswerPicks {
  const picks: Record<string, readonly string[]> = {};
  for (const [code, option] of maps.optionByCode) picks[code] = [option];
  for (const [code, options] of maps.multiByCode) {
    picks[code] = [...(picks[code] ?? []), ...options.filter((o) => !picks[code]?.includes(o))];
  }
  return picks;
}

/** True when at least one lever is set — an all-empty effect is "no effect". */
export function hasAnyLever(levers: AnswerEffectLevers): boolean {
  return (
    levers.maxLoanPercent !== undefined ||
    levers.ratePoints !== undefined ||
    levers.maxTenorMonths !== undefined
  );
}

/**
 * The effects this applicant's picks switch on, in the source's order.
 *
 * ONE function for preview and apply (A33: the two must not derive an engine input two
 * ways). `sources` is already in its fixed order; picks only select.
 */
export function answerEffectsFromAnswers(
  sources: readonly AnswerEffectSource[],
  picks: AnswerPicks,
): AnswerEffect[] {
  const effects: AnswerEffect[] = [];
  for (const source of sources) {
    if (!hasAnyLever(source.levers)) continue;
    const picked = picks[source.questionCode];
    if (picked === undefined || !picked.includes(source.optionCode)) continue;
    effects.push({
      questionCode: source.questionCode,
      optionCode: source.optionCode,
      incomeProofOnly: source.incomeProofOnly,
      ...source.levers,
    });
  }
  return effects;
}

/** The effects that apply to a program of this income basis. */
export function answerEffectsForProgram(
  effects: readonly AnswerEffect[] | undefined,
  programType: string,
): AnswerEffect[] {
  if (effects === undefined || effects.length === 0) return [];
  return effects.filter((e) => !e.incomeProofOnly || programType === 'income_proof');
}

function toDecimal(raw: string | undefined): Decimal | null {
  if (raw === undefined) return null;
  try {
    const value = new Decimal(raw);
    return value.isFinite() ? value : null;
  } catch {
    return null;
  }
}

/** Rounded to piastres at every step, exactly as `max-loan-adjustments.ts` does. */
function round2(value: Decimal): Decimal {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/**
 * The program's cap after every max-loan effect, in order.
 *
 * A percentage at or under −100 would zero the cap — a blank card with no stated reason —
 * so it is skipped as NOT CONFIGURED; the API refuses it at save time and this is the belt
 * to that brace (the same reading `applyMaxLoanAdjustments` gives a non-positive share).
 */
export function applyAnswerEffectsToCap(
  cap: Decimal,
  effects: readonly AnswerEffect[],
): { cap: Decimal; moved: boolean } {
  let next = cap;
  let moved = false;
  for (const effect of effects) {
    const percent = toDecimal(effect.maxLoanPercent);
    if (percent === null || percent.isZero() || percent.lessThanOrEqualTo(-100)) continue;
    next = round2(next.mul(percent.div(100).plus(1)));
    moved = true;
  }
  return { cap: next, moved };
}

/** The annual rate after every rate effect, floored at zero. */
export function applyAnswerEffectsToRate(rate: Decimal, effects: readonly AnswerEffect[]): Decimal {
  let next = rate;
  for (const effect of effects) {
    const points = toDecimal(effect.ratePoints);
    if (points === null || points.isZero()) continue;
    next = next.plus(points);
  }
  return Decimal.max(new Decimal(0), next);
}

/** The shortest term ceiling any effect states, or null when none does. */
export function answerEffectsTenorCap(effects: readonly AnswerEffect[]): number | null {
  let cap: number | null = null;
  for (const effect of effects) {
    const months = effect.maxTenorMonths;
    if (typeof months !== 'number' || !Number.isInteger(months) || months < 1) continue;
    cap = cap === null ? months : Math.min(cap, months);
  }
  return cap;
}
