/**
 * Offer ranking by applicant priority (FR-042).
 * Secondary tie-break on programCode ensures deterministic ordering across runs.
 */

import type { Offer, ApplicationPriority } from '../types';

export function rankOffers(offers: Offer[], priority: ApplicationPriority): Offer[] {
  const sorted = [...offers];
  const tiebreak = (a: Offer, b: Offer): number => a.programCode.localeCompare(b.programCode);

  switch (priority) {
    case 'lowest_installment':
      sorted.sort((a, b) => a.monthlyInstallmentEGP.cmp(b.monthlyInstallmentEGP) || tiebreak(a, b));
      break;
    case 'lowest_interest':
      sorted.sort((a, b) => a.effectiveRatePercent.cmp(b.effectiveRatePercent) || tiebreak(a, b));
      break;
    case 'fastest_approval':
      sorted.sort(
        (a, b) => b.approvalProbabilityPercent - a.approvalProbabilityPercent || tiebreak(a, b),
      );
      break;
    case 'least_paperwork':
      sorted.sort(
        (a, b) => a.requiredDocuments.length - b.requiredDocuments.length || tiebreak(a, b),
      );
      break;
  }

  return sorted;
}
