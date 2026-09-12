import type { ApplicationOfferDto } from './applications-list-response.dto';
/**
 * Mobile apply-endpoint response envelope (Constitution Principle XIV).
 *
 * Offers arrive in the order the engine ranked them — by the applicant's own
 * `priority` answer — and that order is frozen on each row as `bank_offer.rankIndex`,
 * so every later read returns the same sequence the applicant first saw.
 */

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
    /**
     * The SAME shape the list and detail endpoints return, and referenced rather than
     * re-declared.
     *
     * It used to be an inline literal here — a second declaration of one wire contract, free
     * to drift, and it had: `rateBasis`, `incomeOrigin`, `collateralCeilingEGP`,
     * `bindingConstraint` and `requiredDownPaymentEGP` were all being sent by `toOfferDto`
     * and all five were missing from this list, so the documented apply response and the real
     * one disagreed about five fields. One declaration cannot go stale (A25).
     */
    matchedOffers: ApplicationOfferDto[];
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
