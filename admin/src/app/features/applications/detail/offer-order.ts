/**
 * Offer ordering for the application detail page. Pure so it can be tested
 * without an Angular runtime — the page only calls it from a template helper.
 *
 * The order the CUSTOMER was shown is frozen at apply time on
 * `bank_offer.rankIndex` (Int, 0-based, dense per application), and every read
 * of a persisted offer orders by it. An agent opening this page is looking at a
 * decision the applicant already made against that order, so reproducing it is
 * the whole job — a re-sort here would show the agent a different list from the
 * one the person actually chose from.
 *
 * The applicant's own pick is lifted to the top regardless: the page is opened
 * for the loan the person took, and hunting for it down a list of twelve is the
 * failure this ordering exists to prevent. Its rank position is still legible
 * from the cards below it.
 */

/** The fields ordering reads. Structural, so the spec need not build a whole offer. */
export interface OrderableOffer {
  isSelected: boolean;
  /**
   * The frozen rank the customer saw, 0-based. Optional because offers written
   * before the column existed carry none — see `compareOffers` for what happens
   * then, and do NOT delete that fallback as dead code.
   */
  rankIndex?: number;
  monthlyInstallmentEGP: string;
  bankIsFeatured: boolean;
  programCode: string;
}

/**
 * Numeric value of a Decimal string, or `Infinity` when it is unusable.
 *
 * `Infinity` and not 0: an unparseable installment is unknown, not free, and
 * sorting an unknown to the FRONT would put the least explicable card at the
 * top of the page.
 */
function installmentValue(raw: string): number {
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}

/** true sorts before false — the tiebreak `ranking.ts` calls `featuredTiebreak`. */
function featuredTiebreak(a: OrderableOffer, b: OrderableOffer): number {
  if (a.bankIsFeatured === b.bankIsFeatured) return 0;
  return a.bankIsFeatured ? -1 : 1;
}

/**
 * Comparator: selected first, then the frozen `rankIndex` ascending.
 *
 * When EITHER side carries no `rankIndex` the pair falls through to a
 * deterministic chain mirroring the engine's own tiebreaks in
 * `backend/src/matching/pipeline/ranking.ts` — installment ascending, featured
 * bank first, then `programCode` lexically. Array order is deliberately NOT the
 * fallback: an unordered read is Postgres's arbitrary order, so the same rows
 * would render in a different sequence between two reloads and read as data
 * churn on a page an agent is using to explain a decision.
 */
export function compareOffers(a: OrderableOffer, b: OrderableOffer): number {
  if (a.isSelected !== b.isSelected) return a.isSelected ? -1 : 1;

  const ar = a.rankIndex;
  const br = b.rankIndex;
  if (typeof ar === 'number' && typeof br === 'number' && ar !== br) return ar - br;
  if (typeof ar === 'number' && typeof br === 'number') return 0;

  return (
    installmentValue(a.monthlyInstallmentEGP) - installmentValue(b.monthlyInstallmentEGP) ||
    featuredTiebreak(a, b) ||
    a.programCode.localeCompare(b.programCode)
  );
}

/** Non-mutating sort — the caller's array is a signal's value, never ours to reorder. */
export function orderOffers<T extends OrderableOffer>(offers: readonly T[]): T[] {
  return [...offers].sort(compareOffers);
}
