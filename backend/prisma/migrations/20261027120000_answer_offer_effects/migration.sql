-- An answer can change the offer (v31.2.0, constitution v32.0.0, operator decision 2026-10-27):
-- "when [the admin] creates a fixed question the answers should be tied to the loan engine — if
-- the answer will impact or not". Three optional levers per answer option, applied by the engine
-- to every program the applicant is quoted (`backend/src/matching/pipeline/answer-effects.ts`):
--
--   effect_max_loan_percent  signed % of the program's cap  (-90 … 100, never 0)
--   effect_rate_points       signed points on the annual rate (-20 … 20, never 0)
--   effect_max_tenor_months  longest term this answer allows (1 … 480)
--
-- All NULL = the answer changes nothing, which is every existing row: no quote moves.
-- Pricing, not content — never frozen into the questionnaire snapshot, so no republish.
ALTER TABLE "question_option"
  ADD COLUMN "effectMaxLoanPercent" DECIMAL(6,2),
  ADD COLUMN "effectRatePoints" DECIMAL(5,2),
  ADD COLUMN "effectMaxTenorMonths" INTEGER;

ALTER TABLE "question_option"
  ADD CONSTRAINT "chk_question_option_effect_max_loan_percent"
    CHECK ("effectMaxLoanPercent" IS NULL OR ("effectMaxLoanPercent" >= -90 AND "effectMaxLoanPercent" <= 100 AND "effectMaxLoanPercent" <> 0)),
  ADD CONSTRAINT "chk_question_option_effect_rate_points"
    CHECK ("effectRatePoints" IS NULL OR ("effectRatePoints" >= -20 AND "effectRatePoints" <= 20 AND "effectRatePoints" <> 0)),
  ADD CONSTRAINT "chk_question_option_effect_max_tenor_months"
    CHECK ("effectMaxTenorMonths" IS NULL OR ("effectMaxTenorMonths" >= 1 AND "effectMaxTenorMonths" <= 480));
