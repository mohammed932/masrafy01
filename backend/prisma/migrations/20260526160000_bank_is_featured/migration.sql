-- Phase-1 partner-bank flag. Used by the matching engine ranking as a
-- final tiebreaker when two offers share the primary sort key. No
-- eligibility / pricing impact.

ALTER TABLE "bank"
  ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "idx_bank_featured_active"
  ON "bank" ("isFeatured", "isActive");

-- BankOffer snapshots the bank's `isFeatured` at match time so the chip
-- shown to mobile never drifts when the operator toggles the bank flag
-- afterwards (Constitution Principle I — BankOffer is immutable).
ALTER TABLE "bank_offer"
  ADD COLUMN "bankIsFeatured" BOOLEAN NOT NULL DEFAULT false;
