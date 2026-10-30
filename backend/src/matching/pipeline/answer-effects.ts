/**
 * What an applicant's ANSWERS do to an offer, as the admin set it on each answer.
 *
 * Pure module: no Nest, no Prisma, no clock, no randomness (Constitution Principle V).
 *
 * ─── What it is ───────────────────────────────────────────────────────────────
 *
 * An answer to a FIXED question may carry an OFFER EFFECT, typed by the admin on the question
 * editor (v31.2.0, constitution v32.0.0; fixed questions only since v31.3.0 / v33.0.0):
 *
 *   "Do you own a car?"           Yes → max loan −10%, rate +1 point, longest term 60 months
 *   "Months in your current job"  under 12 → max loan −10%           (a NUMBER range)
 *
 * A choice question carries it on each answer option; a number question on RANGES of the
 * number, half-open `[fromInclusive, toExclusive)` exactly as `income-rule-bands.ts` reads a
 * band, a null edge open, the first range that holds the number winning.
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
 * Effects arrive in a FIXED order — question code, then option display order or range order —
 * decided once by the repository that loads them (`answerEffectSources`). The cap is rounded to piastres
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
  /** The answer picked, on a choice question. */
  optionCode?: string;
  /** The range the number fell in, on a number question — with the number itself. */
  range?: AnswerEffectRange;
  value?: string;
  /**
   * The question is fixed and asked on income-proof programs only, so its effect is read
   * there only — a no-payslip program never asked it and must not be priced by it.
   */
  incomeProofOnly: boolean;
  /**
   * The mirror (v32.1.0): fixed and asked on surrogate (no-payslip) programs only, so its
   * effect is read there only. Present only when true — an effect frozen on an offer before
   * v32.1.0 has no such key, and one written since keeps that shape unless it is one-sided.
   */
  incomeSurrogateOnly?: boolean;
}

/** A range of a number answer: `[fromInclusive, toExclusive)`, decimal strings, null = open. */
export interface AnswerEffectRange {
  fromInclusive: string | null;
  toExclusive: string | null;
}

/** One range and what it does — the shape `question.numberEffects` stores, in order. */
export type NumberEffectRange = AnswerEffectRange & AnswerEffectLevers;

/** The effect table the caller loads: an answer option's, or a number range's. */
export type AnswerEffectSource =
  | {
      kind: 'option';
      questionCode: string;
      optionCode: string;
      incomeProofOnly: boolean;
      incomeSurrogateOnly?: boolean;
      levers: AnswerEffectLevers;
    }
  | {
      kind: 'range';
      questionCode: string;
      range: AnswerEffectRange;
      incomeProofOnly: boolean;
      incomeSurrogateOnly?: boolean;
      levers: AnswerEffectLevers;
    };

/** What the applicant answered: the options picked and the numbers typed, by question code. */
export interface AnswerPicks {
  readonly options: Readonly<Record<string, readonly string[]>>;
  /** Validated decimal strings. */
  readonly numbers: Readonly<Record<string, string>>;
}

/**
 * The picks out of the answer maps preview and apply both already build — single picks,
 * multi picks and numbers, by question code. One reading for both paths (A33).
 */
export function answerPicksFromMaps(maps: {
  readonly optionByCode: ReadonlyMap<string, string>;
  readonly multiByCode: ReadonlyMap<string, readonly string[]>;
  readonly numericByCode: ReadonlyMap<string, string>;
}): AnswerPicks {
  const options: Record<string, readonly string[]> = {};
  for (const [code, option] of maps.optionByCode) options[code] = [option];
  for (const [code, picked] of maps.multiByCode) {
    options[code] = [
      ...(options[code] ?? []),
      ...picked.filter((o) => !options[code]?.includes(o)),
    ];
  }
  return { options, numbers: Object.fromEntries(maps.numericByCode) };
}

/** Only the levers that are set — what a range or an option row hands the engine. */
export function leversOf(x: AnswerEffectLevers): AnswerEffectLevers {
  return {
    ...(x.maxLoanPercent !== undefined ? { maxLoanPercent: x.maxLoanPercent } : {}),
    ...(x.ratePoints !== undefined ? { ratePoints: x.ratePoints } : {}),
    ...(x.maxTenorMonths !== undefined ? { maxTenorMonths: x.maxTenorMonths } : {}),
  };
}

/**
 * `question.numberEffects` as stored → its ranges, in order. Tolerant, like every JSONB read
 * the engine makes: an entry that is not a range is dropped rather than thrown on.
 */
export function numberEffectRangesOf(raw: unknown): NumberEffectRange[] {
  if (!Array.isArray(raw)) return [];
  const edge = (v: unknown): string | null | undefined =>
    v === null || v === undefined ? null : typeof v === 'string' ? v : undefined;
  const out: NumberEffectRange[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue;
    const e = entry as Record<string, unknown>;
    const fromInclusive = edge(e['fromInclusive']);
    const toExclusive = edge(e['toExclusive']);
    if (fromInclusive === undefined || toExclusive === undefined) continue;
    const loan = e['maxLoanPercent'];
    const rate = e['ratePoints'];
    const term = e['maxTenorMonths'];
    out.push({
      fromInclusive,
      toExclusive,
      ...(typeof loan === 'string' ? { maxLoanPercent: loan } : {}),
      ...(typeof rate === 'string' ? { ratePoints: rate } : {}),
      ...(typeof term === 'number' && Number.isInteger(term) ? { maxTenorMonths: term } : {}),
    });
  }
  return out;
}

/** True when the number lies in `[fromInclusive, toExclusive)`. A malformed edge never holds. */
export function rangeHolds(range: AnswerEffectRange, value: Decimal): boolean {
  const from = range.fromInclusive === null ? null : toDecimal(range.fromInclusive);
  const to = range.toExclusive === null ? null : toDecimal(range.toExclusive);
  if (
    (range.fromInclusive !== null && from === null) ||
    (range.toExclusive !== null && to === null)
  ) {
    return false;
  }
  return (from === null || value.greaterThanOrEqualTo(from)) && (to === null || value.lessThan(to));
}

/** Why a list of ranges cannot be saved, or null when it can. */
export type NumberEffectRangesProblem =
  | 'no_bounds'
  | 'bad_number'
  | 'order'
  | 'overlap'
  | 'no_lever'
  | 'too_many';

export const NUMBER_EFFECT_RANGES_MAX = 20;

/**
 * The save-time check the API and `check:questionnaire` share: every range has an edge, its
 * From is under its To, at least one lever, and no two ranges share a number — so "the first
 * range that holds the number" is the ONLY range that holds it and the order never decides.
 */
export function numberEffectRangesProblem(
  ranges: readonly NumberEffectRange[],
): NumberEffectRangesProblem | null {
  if (ranges.length > NUMBER_EFFECT_RANGES_MAX) return 'too_many';
  const edges: { from: Decimal | null; to: Decimal | null }[] = [];
  for (const r of ranges) {
    if (r.fromInclusive === null && r.toExclusive === null) return 'no_bounds';
    const from = r.fromInclusive === null ? null : toDecimal(r.fromInclusive);
    const to = r.toExclusive === null ? null : toDecimal(r.toExclusive);
    if ((r.fromInclusive !== null && from === null) || (r.toExclusive !== null && to === null)) {
      return 'bad_number';
    }
    if (from !== null && to !== null && !from.lessThan(to)) return 'order';
    if (!hasAnyLever(r)) return 'no_lever';
    edges.push({ from, to });
  }
  // Sorted by From, an open From first: each range must end at or before the next begins.
  const sorted = [...edges].sort((a, b) =>
    a.from === null ? -1 : b.from === null ? 1 : a.from.comparedTo(b.from),
  );
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const next = sorted[i];
    if (prev === undefined || next === undefined) continue;
    if (prev.to === null || next.from === null || next.from.lessThan(prev.to)) return 'overlap';
  }
  return null;
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
  /** A number answer takes ONE range — the first that holds it, belt to the no-overlap rule. */
  const rangeTaken = new Set<string>();
  for (const source of sources) {
    if (!hasAnyLever(source.levers)) continue;
    if (source.kind === 'option') {
      const picked = picks.options[source.questionCode];
      if (picked === undefined || !picked.includes(source.optionCode)) continue;
      effects.push({
        questionCode: source.questionCode,
        optionCode: source.optionCode,
        incomeProofOnly: source.incomeProofOnly,
        ...surrogateOnlyOf(source),
        ...source.levers,
      });
      continue;
    }
    if (rangeTaken.has(source.questionCode)) continue;
    const raw = picks.numbers[source.questionCode];
    const value = raw === undefined ? null : toDecimal(raw);
    if (value === null || !rangeHolds(source.range, value)) continue;
    rangeTaken.add(source.questionCode);
    effects.push({
      questionCode: source.questionCode,
      range: source.range,
      value: value.toString(),
      incomeProofOnly: source.incomeProofOnly,
      ...surrogateOnlyOf(source),
      ...source.levers,
    });
  }
  return effects;
}

/** The surrogate-only mark, carried only when set — see `AnswerEffect.incomeSurrogateOnly`. */
function surrogateOnlyOf(source: AnswerEffectSource): { incomeSurrogateOnly?: true } {
  return source.incomeSurrogateOnly === true ? { incomeSurrogateOnly: true } : {};
}

/**
 * The effects that apply to a program of this income basis: a one-sided question's effect only
 * on its own side's programs.
 */
export function answerEffectsForProgram(
  effects: readonly AnswerEffect[] | undefined,
  programType: string,
): AnswerEffect[] {
  if (effects === undefined || effects.length === 0) return [];
  return effects.filter(
    (e) =>
      (!e.incomeProofOnly || programType === 'income_proof') &&
      (e.incomeSurrogateOnly !== true || programType === 'income_surrogate'),
  );
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
