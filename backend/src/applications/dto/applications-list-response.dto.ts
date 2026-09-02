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
  /** Islamic-finance program, frozen at match time. */
  isShariaCompliant: boolean;
  programFriendlyName: string;
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
  /** Borrowing ceiling at this program, frozen at match time. */
  maxLoanAvailableEGP?: string;
  /** The ratio this offer lands at, and the cap it was measured against. */
  dbrPercent?: string;
  dbrCapPercent?: string;
  /**
   * How the rate on this offer was charged: `reducing` (interest on the outstanding
   * balance) or `flat` (interest on the original principal for the whole tenor).
   *
   * `null` on an offer written before the column existed. Absent is NOT `flat`: those
   * offers were priced by the reducing annuity, and the reader should render the absence
   * rather than name a basis nobody recorded.
   */
  rateBasis?: string | null;
  /**
   * Feature 011 — which income this offer was priced on:
   * `declared` · `surrogate` · `declared_over_surrogate` · `surrogate_over_declared`,
   * and the surrogate method that produced it.
   *
   * `null` means "recorded before provenance existed", NOT `declared`. Readers must
   * render the absence rather than assume a value — an offer produced before this
   * column existed made no such claim (contracts/matching-provenance.md § 3).
   */
  incomeOrigin?: string | null;
  incomeSurrogateStrategy?: string | null;
  /**
   * What the applicant's COLLATERAL supported at this program, frozen at match time.
   *
   * Present only for a program that prices off collateral (`incomeOrigin: 'ceiling'`).
   * `null` on every other offer, and on any offer written before the column existed —
   * the same read-the-absence rule the two fields above carry.
   */
  collateralCeilingEGP?: string | null;
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

/**
 * `GET /v1/applications/:applicationId` — one row of the list above, read on
 * demand so the mobile Offer Details screen renders a freshly-fetched offer
 * instead of the copy the list handed it (bank decision, `isSaved`, and offer
 * existence all move independently of that cached row).
 */
export interface ApplicationDetailResponse {
  success: true;
  data: {
    application: ApplicationListItemDto;
  };
}
