/**
 * Mobile apply-endpoint response envelope (Constitution Principle XIV).
 * Mirrors the OpenAPI contract under specs/004-approval-probability-display/contracts/openapi.yaml.
 *
 * Feature 004: per-offer `approvalProbabilityPercent: number` is replaced by the structured
 * `approvalProbability: ApprovalProbabilityResponseDto`. Mobile + admin both read this shape.
 */

export type ApprovalTierLiteral = 'excellent' | 'good' | 'moderate' | 'low' | 'very_low';

export interface FactorImpactDto {
  code: string;
  impact: number;
}

export interface ApprovalProbabilityResponseDto {
  score: number;
  tier: ApprovalTierLiteral;
  tierLabelCode: string;
  factors: {
    positive: FactorImpactDto[];
    negative: FactorImpactDto[];
    legacy?: boolean;
  };
  /**
   * The program had no ACTIVE weight set when this offer was matched, so the 0
   * score means "not rated", not "poor fit". Clients render the two
   * differently; without this they cannot tell them apart.
   */
  usedDefault: boolean;
  engineVersion: string;
}

/**
 * A program the engine checked but could not quote — listed, never hidden.
 *
 * `quoteProgram` failing is not covered by `skipEligibility`, so before this
 * existed an applicant whose obligations used up a bank's whole allowed debt
 * burden simply never saw that bank, with no reason given. The engine already
 * carried everything needed on `MatchResult.unavailable` for exactly this
 * purpose (`engine.service.ts` — "callers can list the program with its reason
 * instead of dropping it"); apply just never read it.
 *
 * Deliberately NOT a `BankOffer`: an offer-less program is not an offer, and
 * `BankOffer` is immutable post-creation (Principle I / A6). It rides on the
 * response and is persisted in `Application.summary` so an idempotent replay
 * returns the identical payload.
 */
export interface UnavailableProgramDto {
  programCode: string;
  bankName: string;
  programFriendlyName: string;
  /** A `FIGURES_UNAVAILABLE_REASONS` code — localized client-side (Principle III). */
  reason: string;
  /**
   * The applicant's ceiling at this program, when he is priceable and simply has
   * no room left. Lets the surface say "you could borrow up to X here" rather
   * than showing an unexplained absence.
   */
  maxAffordableAmountEGP?: string;
  dbrCapPercent?: string;
  /**
   * When `reason` is `PRODUCT_RULE_GATE_FAILED`: WHICH condition refused, as one of the closed
   * `GATE_REASON_CODES`. Localized client-side like every other code (Principle III).
   *
   * Carried because "a condition was not met" is not actionable and "the amount you have paid
   * is below this bank's minimum" is. The gate's ID is deliberately not sent: it is
   * operator-authored and has no translation.
   */
  gateReasonCode?: string;
  /**
   * When a product rule read an answer the applicant never gave: WHICH answers are missing, by
   * fact key. What lets the surface say "answer these six questions about your unit" instead of
   * a blank card the customer can do nothing with.
   */
  missingFactKeys?: string[];
}

export interface ApplyMatchedResponse {
  success: true;
  data: {
    applicationId: string;
    correlationId: string;
    summary: {
      totalProgramsChecked: number;
      eligiblePrograms: number;
      bestInstallmentEGP: string;
      bestRatePercent: string;
    };
    /** Empty when every checked program produced an offer. */
    unavailablePrograms: UnavailableProgramDto[];
    matchedOffers: Array<{
      /** Persisted BankOffer id — the select-offer key the client sends back. */
      bankOfferId: string;
      programCode: string;
      programVersion: number;
      bankName: string;
      /** Phase-1 partner-bank flag. Mobile renders a FEATURED chip when true. */
      bankIsFeatured: boolean;
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
      /**
       * The applicant's borrowing ceiling at this program — income × cap ÷ 100
       * minus obligations, present-valued over the tenor. Present on every
       * offer: compare with `effectiveLoanAmountEGP` to tell "this is your
       * limit" from "you asked for less than you could have had".
       */
      maxLoanAvailableEGP?: string;
      /** The ratio this offer lands at, and the cap it was measured against. */
      dbrPercent?: string;
      dbrCapPercent?: string;
    }>;
  };
}

export interface ApplyNoMatchResponse {
  success: false;
  code: 'NO_MATCHING_PROGRAMS';
  meta: {
    applicationId: string;
    correlationId: string;
    primaryReason?: string;
    details: Array<{ programCode: string; failedChecks: string[] }>;
    suggestions: Array<{
      code: string;
      magnitude: number;
      programsUnlocked: number;
      suggestedValue?: string;
    }>;
  };
}

export type ApplyResponse = ApplyMatchedResponse | ApplyNoMatchResponse;
