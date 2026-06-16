-- Per-question approval weighting (Constitution v5.0.0).
-- Drops the ScoringFactor indirection + Question.scoringFactorCode; approval
-- probability is now Σ(option.scoreValue × questionWeight)/100 over scored
-- questions, with ScoringWeightSet.weights keyed by questionCode. Existing weight
-- sets used factorCode keys → cleared (pre-prod, reseeded by seed-questionnaire).

-- 1. Question: replace scoringFactorCode with an explicit isScored flag
ALTER TABLE "question" DROP COLUMN "scoringFactorCode";
ALTER TABLE "question" ADD COLUMN "isScored" BOOLEAN NOT NULL DEFAULT false;

-- 2. Drop the ScoringFactor table + its enum (no longer part of the probability)
DROP TABLE "scoring_factor";
DROP TYPE "ScoringFactorKind";

-- 3. Weight sets are re-keyed factorCode → questionCode; clear stale rows
DELETE FROM "scoring_weight_set";
