-- Feature 010 — typed questions and typed answers.
--
-- Additive only. Existing single-choice questions and their stored answers are
-- untouched: `type` already defaults to SINGLE_SELECT, and single-choice answers
-- keep writing `selected_option_id` / `selected_option_code` (FR-045).

-- AlterTable: per-type CONTENT rules on question (bounds, unit, length).
-- NOT scoring/eligibility fields (A33) — the money-field binding stays a code constant.
ALTER TABLE "question"
  ADD COLUMN "numericMinValue" DECIMAL(18,2),
  ADD COLUMN "numericMaxValue" DECIMAL(18,2),
  ADD COLUMN "numericStep"     DECIMAL(18,2),
  ADD COLUMN "numericUnitAr"   VARCHAR(24),
  ADD COLUMN "numericUnitEn"   VARCHAR(24),
  ADD COLUMN "textMaxLength"   INTEGER;

-- AlterTable: canonical pick list for both choice types. The pre-existing
-- uniq_application_answer_app_question constraint (one row per question) is what
-- makes an array column necessary rather than one row per pick.
ALTER TABLE "application_answer"
  ADD COLUMN "selectedOptionCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Backfill: every existing single-choice answer becomes a one-element list, so
-- `selectedOptionCodes` is the canonical read path from day one.
UPDATE "application_answer"
   SET "selectedOptionCodes" = ARRAY["selectedOptionCode"]
 WHERE "selectedOptionCode" IS NOT NULL
   AND cardinality("selectedOptionCodes") = 0;
