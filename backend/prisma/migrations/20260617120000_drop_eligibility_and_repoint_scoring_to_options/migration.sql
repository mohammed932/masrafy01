-- MVP scoring simplification: questions/answers become pure content,
-- scoring moves to per-program per-answer points, eligibility dropped.

-- Question: drop eligibility/arithmetic mapping
ALTER TABLE "question" DROP COLUMN "systemRole";
ALTER TABLE "question" DROP COLUMN "isScored";
ALTER TABLE "question" DROP COLUMN "profileField";

-- QuestionOption: drop engine values
ALTER TABLE "question_option" DROP COLUMN "numericMin";
ALTER TABLE "question_option" DROP COLUMN "numericMax";
ALTER TABLE "question_option" DROP COLUMN "numericPoint";
ALTER TABLE "question_option" DROP COLUMN "scoreValue";
ALTER TABLE "question_option" DROP COLUMN "profileValue";

-- Drop the now-unreferenced arithmetic-role enum
DROP TYPE "QuestionSystemRole";

-- Existing weight sets are keyed by questionCode (old model) and would silently
-- mis-score under the new optionCode-keyed formula. Clear them.
UPDATE "scoring_weight_set" SET "weights" = '{}'::jsonb;
