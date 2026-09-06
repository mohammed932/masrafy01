/**
 * Saved Offers DTOs (Saved Offers screen, Figma 4088-153).
 *
 * Constitution Principle III: validation errors map to typed codes.
 * Principle I / A3: money fields cross the boundary as STRINGS (never JSON
 * floats) — mirrors the apply-response projection.
 *
 * Root request DTO + the response shapes are co-located in one file on
 * purpose; do not split per type.
 */
import { IsString, Length } from 'class-validator';

/** POST /api/v1/saved-offers body. */
export class SaveOfferDto {
  @IsString()
  @Length(1, 30)
  bankOfferId!: string;
}

/**
 * One row of GET /api/v1/saved-offers — a flattened projection of the saved
 * `BankOffer` plus its parent `Application`'s loan category. Carries exactly
 * what the mobile Saved Offers card AND the reused Offer-Details screen render,
 * so the client maps it 1:1 onto its `MatchOffer`.
 */
export interface SavedOfferListItem {
  bankOfferId: string;
  /** `personal` | `car` | `mortgage` | `business` (falls back to `personal`). */
  loanTypeKey: string;
  effectiveTenorMonths: number;
  effectiveRatePercent: string;
  monthlyInstallmentEGP: string;
  effectiveLoanAmountEGP: string;
  /** monthly × tenor. */
  totalRepayableEGP: string;
  /** totalRepayable − principal. */
  totalInterestEGP: string;
  /** Compact label for the KPI cell, e.g. "170K". */
  totalLabel: string;
  bankName: string;
  programFriendlyName: string;
  savedAt: string;
}

export interface SavedOffersListResponse {
  success: true;
  data: { offers: SavedOfferListItem[] };
}
