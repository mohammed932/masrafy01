/**
 * Mobile "Applications" screen response envelope (Constitution Principle XIV).
 * One row per application the customer has proceeded with (Feature 008
 * user-intent gate) — its `offer` is byte-for-byte the same shape as
 * `ApplyMatchedResponse['data']['matchedOffers'][number]` so the mobile
 * client reuses its existing offer parsing verbatim.
 */

import type { ApprovalProbabilityResponseDto } from './apply-response.dto';

export type ApplicationDecisionStatus = 'applied' | 'approved' | 'rejected';

export interface ApplicationOfferDto {
  bankOfferId: string;
  programCode: string;
  programVersion: number;
  bankName: string;
  bankIsFeatured: boolean;
  programFriendlyName: string;
  currency: string;
  effectiveRatePercent: string;
  monthlyInstallmentEGP: string;
  requestedLoanAmountEGP: string;
  effectiveLoanAmountEGP: string;
  requestedTenorMonths: number;
  effectiveTenorMonths: number;
  approvalProbability: ApprovalProbabilityResponseDto;
  requiredDocuments: string[];
  matchReasons: string[];
  feesBreakdown: unknown;
  cascadeTrace: unknown;
  qualitativeReviewBadge: boolean;
  selfDeclared: boolean;
  /** True when the authenticated customer has already saved this offer. */
  isSaved: boolean;
  maxLoanAvailableEGP?: string;
}

export interface ApplicationListItemDto {
  applicationId: string;
  category: string | null;
  requestedAmountEGP: string;
  status: ApplicationDecisionStatus;
  proceededAt: string;
  offer: ApplicationOfferDto;
}

export interface ApplicationsListResponse {
  success: true;
  data: {
    applications: ApplicationListItemDto[];
  };
}
