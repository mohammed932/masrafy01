/**
 * Offer ranking by applicant priority (FR-042).
 *
 * Tiebreak order (Phase-1 spec):
 *   1. primary sort key chosen by the applicant's `priority`
 *   2. featured-bank boost — partner banks (`bankIsFeatured`) win ties
 *   3. programCode lexical — last resort, deterministic across runs
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
    case 'fastest_approval':
      sorted.sort(
        (a, b) =>
          b.approvalProbabilityPercent - a.approvalProbabilityPercent ||
          featuredTiebreak(a, b) ||
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
