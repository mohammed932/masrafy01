-- Drop the approval score from the offer.
--
-- The number was a weighted sum of figures an admin typed into a per-program table and was
-- never once compared against a real bank decision -- v13.0.0 had already had to reword the
-- customer copy from "Guarantee Approval" to "% match", which is the admission. It is
-- removed platform-wide rather than reworded again.
--
-- Ordering is NOT lost with it: `20260906090000_offer_rank_index` already froze the
-- engine's own rank -- by the applicant's stated priority -- onto every row, and every
-- read now orders by that. This migration MUST run after it: the backfill reads
-- `approvalScore`.
DROP INDEX "idx_bank_offer_approval_score";

ALTER TABLE "bank_offer"
  DROP COLUMN "approvalProbabilityPercent",
  DROP COLUMN "approvalScore",
  DROP COLUMN "approvalTier",
  DROP COLUMN "approvalFactors",
  DROP COLUMN "approvalUsedDefault";

-- The type's only column is gone. Enum VALUES are append-only where live rows carry them;
-- a whole unused enum TYPE is not, and leaving it would advertise a tier vocabulary
-- nothing produces.
DROP TYPE "ApprovalTier";
