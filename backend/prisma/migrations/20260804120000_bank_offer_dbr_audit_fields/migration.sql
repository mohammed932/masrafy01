-- Feature 010 — freeze the DBR verdict onto the immutable offer.
--
-- `maxLoanAvailableEGP` already recorded the ceiling; the ratio it was measured
-- at and the cap it was measured against were recomputed on every read, so a
-- later change to a program's `dbrCapPercent` silently re-explained past offers.
-- Both are nullable: offers written before this migration genuinely have no
-- recorded verdict, and backfilling one would be inventing history.

ALTER TABLE "bank_offer" ADD COLUMN "dbrPercent" DECIMAL(6,2);
ALTER TABLE "bank_offer" ADD COLUMN "dbrCapPercent" DECIMAL(7,4);
