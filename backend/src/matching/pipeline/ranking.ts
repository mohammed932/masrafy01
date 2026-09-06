/**
 * Offer ranking by applicant priority (FR-042).
 *
 * Tiebreak order (Phase-1 spec):
 *   1. primary sort key chosen by the applicant's `priority`
 *   2. featured-bank boost — partner banks (`bankIsFeatured`) win ties
 *   3. programCode lexical — last resort, deterministic across runs
 *
 * This function is the ONE authority on offer order. The apply path freezes its
 * output as `bank_offer.rankIndex` and every read of a persisted offer orders by
 * that, so an arm with no sort key of its own does not degrade quietly — it
 * freezes an arbitrary order onto immutable offers (Principle I / A6).
 */

import type { Offer, ApplicationPriority } from '../types';

export function rankOffers(offers: Offer[], priority: ApplicationPriority): Offer[] {
  const sorted = [...offers];
  const featuredTiebreak = (a: Offer, b: Offer): number => {
    // true sorts before false
    if (a.bankIsFeatured === b.bankIsFeatured) return 0;
    return a.bankIsFeatured ? -1 : 1;
  };
  const codeTiebreak = (a: Offer, b: Offer): number =>
    a.programCode.localeCompare(b.programCode);

  switch (priority) {
    case 'lowest_installment':
      sorted.sort(
        (a, b) =>
          a.monthlyInstallmentEGP.cmp(b.monthlyInstallmentEGP) ||
          featuredTiebreak(a, b) ||
          codeTiebreak(a, b),
      );
      break;
    case 'lowest_interest':
      sorted.sort(
        (a, b) =>
          a.effectiveRatePercent.cmp(b.effectiveRatePercent) ||
          featuredTiebreak(a, b) ||
          codeTiebreak(a, b),
      );
      break;
    // "The fastest answer". The platform cannot estimate a bank's turnaround, and the
    // approval score it used to sort by is gone — it was never once compared against a
    // real decision. The two proxies that survive are both real: we have a live channel
    // with partner banks, and fewer documents is less to collect and verify.
    //
    // Partner-first rather than documents-first deliberately, so this stays
    // distinguishable from `least_paperwork` — the customer chose between them.
    //
    // This arm carries most applications, not a few: `priority_factor` is optional, and
    // all four mobile apply mappers default their unmapped answers to it.
    case 'fastest_approval':
      sorted.sort(
        (a, b) =>
          featuredTiebreak(a, b) ||
          a.requiredDocuments.length - b.requiredDocuments.length ||
          codeTiebreak(a, b),
      );
      break;
    case 'least_paperwork':
      sorted.sort(
        (a, b) =>
          a.requiredDocuments.length - b.requiredDocuments.length ||
          featuredTiebreak(a, b) ||
          codeTiebreak(a, b),
      );
      break;
  }

  return sorted;
}
