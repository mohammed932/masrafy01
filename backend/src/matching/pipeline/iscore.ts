/**
 * The I-Score multiplier — a pure function over a tier table and the applicant's score.
 *
 * ONE reader for the whole platform, and that is the point of this file existing at all.
 * Until v30.3.0 the multiplier was FOUR COMPILED STEPS inside a surrogate product's
 * `incomeRule` (`iscore_src` → `iscore_band` → `coalesce [iscore_band, {const:'100'}]` →
 * `percentOf`), which had two consequences nobody chose:
 *
 *   · it was reachable only by a `strategy: 'steps'` program — 17 of 71 — so a payslip
 *     program could not state a bureau-score table at all, and neither could the twelve
 *     surrogate programs on a built-in method. `shouldConsultIncomeRule` never consults a
 *     rule for a payslip applicant who declared a salary, so no figure stored there could
 *     ever have fired;
 *   · the score is a property of the APPLICANT, not of a bank's product. Expressing it as
 *     part of one product's arithmetic put a platform fact inside nine separate rules that
 *     could each disagree about what 720 is worth.
 *
 * So it is program-level policy now, read once by `quoteProgram`. The tier table keeps the
 * exact `IncomeBand` shape it had in `stepParams.iscore_band`, misnamed `incomeEGP` and
 * all: every stored table was MOVED by migration rather than rewritten, and `bandFor` was
 * already its reader. Re-keying the field would have turned a move into a rewrite of nine
 * products' figures for no gain in meaning.
 *
 * THE FALLBACK IS 100%, not zero and not "unavailable", and the two ways of reaching it are
 * both load-bearing — they are the same two the deleted `coalesce` covered:
 *
 *   the applicant gave no score    the question has been REQUIRED since 2026-09-25, but an
 *                                  application stored before that, or sent by an older app
 *                                  build, still carries none — and the shared table prices
 *                                  that as its "No I-Score" class (`noScorePercent`)
 *   nobody stated a table          54 of 71 programs state none as of v30.3.0, and a blank
 *                                  has never meant "declined" — it means unstated
 *
 * Multiplying by one in both cases is what keeps a skipped optional question from killing
 * every quote, which is the bug `RuleStep.optional` existed to prevent inside the rule.
 *
 * Never throws (Principle V — the engine cannot fail a match on bad config). A malformed
 * table degrades to 100% for the scores it covered rather than taking the program's quote
 * down with it; `bandFor` skips an unparseable row for the same reason.
 */

import { Decimal } from '@prisma/client/runtime/library';
import type { ApplicantProfile, IncomeBand } from '../types';
import { bandFor } from './income-rule-bands';
import { I_SCORE_FACT_KEY } from './product-template';

/** 100%, i.e. "this applicant's score costs them nothing". */
const NEUTRAL_PERCENT = new Decimal(100);

/**
 * A tier table as it is stored, on a product's `iScoreDefaults` or a program's
 * `incomeAssumption.iScoreTiers`.
 *
 * `{ bands }` rather than a bare array, because that is the `StepParams` envelope the nine
 * migrated tables arrived in and the admin editors already read.
 */
export interface IScoreTiers {
  readonly bands?: readonly IncomeBand[];
  /**
   * The percentage counted when the applicant gave NO score — the bureau's "N/A" (no record,
   * or the optional question left blank). Stated on the shared table only (v30.4.0: the
   * I-Score class with no range). Absent = a blank score counts 100%, as it always has.
   */
  readonly noScorePercent?: string;
}

/** Whose table answered — reported, not derived, and frozen onto the offer. */
export type IScoreTiersSource = 'program' | 'product' | 'platform';

export interface IScoreResolution {
  /**
   * The multiplier as a PERCENTAGE: `50`, `100`, `110`. Never negative. ZERO is a stated
   * figure (v30.4.0): the bureau's Defaulted class counts no income, so the program offers
   * nothing — see `resolveIScoreFactor`.
   */
  readonly factorPercent: Decimal;
  /**
   * Whose table it came from, or `null` when none was in force and the neutral 100% was
   * used. `null` is what the offer records as "no table applied", which is not the same
   * fact as a table that happened to resolve to 100%.
   */
  readonly source: IScoreTiersSource | null;
  /** Index of the tier that matched; `null` when the neutral fallback was used. */
  readonly tierIndex: number | null;
}

const NEUTRAL: IScoreResolution = {
  factorPercent: NEUTRAL_PERCENT,
  source: null,
  tierIndex: null,
};

/**
 * Does this side state a table at all?
 *
 * An empty `bands` array counts as UNSTATED, exactly as `slotStatesNoBands` read it when
 * the table lived in `stepParams`: the admin's "back to the product's tiers" action deletes
 * the key, but a hand-edited or legacy row can carry `{ bands: [] }` and the two must mean
 * the same thing. Two spellings of one absence is how a table gets quoted that nobody wrote.
 */
export function statesOwnTiers(tiers: IScoreTiers | undefined | null): boolean {
  if (tiers === null || tiers === undefined) return false;
  return (tiers.bands?.length ?? 0) > 0;
}

/**
 * The tier table this program quotes against: its own when it states one, the product's
 * when it does not.
 *
 * The bank's own ALWAYS wins, and this is a DEFAULT rather than a ceiling on what a bank
 * may say — including a flat 100% table, which is the documented way for a bank to opt out
 * of a product's tiers (v26.2.0). Never a merge of the two sides: a tier from one table and
 * a tier from another is a curve neither of them stated.
 *
 * Returns `undefined` when neither side states one, which `resolveIScoreFactor` answers
 * with the neutral 100% — the same answer the deleted `coalesce` gave.
 */
export function effectiveIScoreTiers(
  own: IScoreTiers | undefined,
  productDefault: IScoreTiers | undefined,
  platformDefault?: IScoreTiers,
): { readonly tiers: IScoreTiers; readonly source: IScoreTiersSource } | undefined {
  if (statesOwnTiers(own)) return { tiers: own as IScoreTiers, source: 'program' };
  if (statesOwnTiers(productDefault)) {
    return { tiers: productDefault as IScoreTiers, source: 'product' };
  }
  // THE SHARED TABLE (v30.4.0): the I-Score classes on Manage values, each with its income
  // percentage. Last, and only a default — a product or a bank that states a table of its
  // own is never overridden by it, and an edit to it reaches every program that states none.
  if (statesOwnTiers(platformDefault)) {
    return { tiers: platformDefault as IScoreTiers, source: 'platform' };
  }
  return undefined;
}

/**
 * The multiplier to apply to this program's worked-out figure.
 *
 * `score` is the applicant's `i_score` answer, or `undefined` when they left the optional
 * question blank. A score that falls in no tier resolves to 100% and NOT to
 * `no_matching_band`: on an ordinary income table a miss is a stated reason the customer is
 * told, but on a MULTIPLIER a miss would refuse the quote outright — which is exactly why
 * `validateBands` demands `coverAll` on a tier table, so an operator cannot type a gap in
 * the first place. Answering 100% here is the belt to that braces, for legacy and
 * hand-edited rows.
 *
 * A negative or non-finite factor is REFUSED back to 100%. ZERO is not: since v30.4.0 the
 * bureau's Defaulted class is stated at 0% on the shared table, meaning "counts no income",
 * and the quote then refuses as `NO_RECOGNISED_INCOME` rather than pricing a loan the
 * operator said this score must not get.
 */
export function resolveIScoreFactor(
  resolved: { readonly tiers: IScoreTiers; readonly source: IScoreTiersSource } | undefined,
  score: Decimal | undefined,
): IScoreResolution {
  if (resolved === undefined) return NEUTRAL;
  if (score === undefined) {
    // N/A: no score to place in a band. The table's own no-score figure when it states one
    // (the shared table's "No I-Score" class), else the neutral 100%.
    const stated = resolved.tiers.noScorePercent;
    if (stated === undefined) return NEUTRAL;
    const factor = new Decimal(stated);
    if (!factor.isFinite() || factor.lessThan(0)) return NEUTRAL;
    return { factorPercent: factor, source: resolved.source, tierIndex: null };
  }

  const lookup = bandFor(score, resolved.tiers.bands);
  if (!lookup.matched) return NEUTRAL;

  const factor = lookup.incomeEGP;
  if (!factor.isFinite() || factor.lessThan(0)) return NEUTRAL;

  return { factorPercent: factor, source: resolved.source, tierIndex: lookup.index };
}

/**
 * Read a stored `iScoreDefaults` / `iScoreTiers` blob, or `undefined` when it states none.
 *
 * The ONE place the blob is given a shape, so no caller has to decide what a half-written
 * one means — the contract `asTenorDefaults` follows, and for the same reason: this runs
 * inside the map every quote is built from, and refusing to build the book because one
 * product's column is malformed would take every other bank down with it. A blob that is
 * not `{ bands: [...] }` with at least one row reads as ABSENT, which resolves to 100%.
 *
 * The ROWS are not validated here. `bandFor` skips an unparseable edge and
 * `resolveIScoreFactor` refuses a non-positive factor, so a bad row costs that row's scores
 * their multiplier and nothing else; `validateBands` is what stops one being typed.
 */
export function asIScoreTiers(raw: unknown): IScoreTiers | undefined {
  if (raw === null || typeof raw !== 'object') return undefined;
  const { bands } = raw as { bands?: unknown };
  if (!Array.isArray(bands) || bands.length === 0) return undefined;
  return { bands: bands as readonly IncomeBand[] };
}

/**
 * The applicant's bureau score, or `undefined` when they did not give one.
 *
 * Reads the ONE platform fact key through the registry map every other fact is read
 * through, so the score arrives here by exactly the route `emitIScore`'s `factNumber` step
 * used to read it — `i_score` is a registry row with a bound question, and it is not a
 * DERIVED key, so `surrogate-facts-from-answers.ts` maps the answer into `byKey`.
 *
 * A non-numeric shape reads as ABSENT rather than throwing. The question is seeded NUMERIC
 * and `isReservedFactKey` stops an operator rebinding the key to a dropdown, so the wrong
 * shape is unreachable through any screen — but Principle V is not conditional on that.
 */
export function iScoreOf(profile: ApplicantProfile): Decimal | undefined {
  const fact = profile.surrogateFacts?.[I_SCORE_FACT_KEY];
  return fact !== undefined && fact.kind === 'numeric' ? fact.value : undefined;
}

/**
 * `amount × factorPercent ÷ 100`, at the program's own money scale.
 *
 * Here rather than at the call site so the income path and the CEILING path cannot round
 * differently. Both need it: `school_stage_ceiling` is the one seeded product whose output
 * is a `maxAmount`, and its tiers scaled that ceiling while the multiplier lived in the
 * rule — so applying this to income alone would quietly drop I-Score for it.
 *
 * `ROUND_HALF_EVEN` to 2 places, matching `calculateDbr` and `calculateMaxLoanFromDbr`.
 */
export function applyIScoreFactor(amount: Decimal, factorPercent: Decimal): Decimal {
  if (factorPercent.equals(NEUTRAL_PERCENT)) return amount;
  return amount.mul(factorPercent).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);
}
