-- Which questions are FIXED becomes data the admin owns (v31.0.0, operator decision 2026-10-26),
-- not a list in code. Until today the fixed set was `BASE_QUESTIONS` in
-- `src/matching/pipeline/base-question-set.ts`, and every change to it took a developer and a
-- release (v30.18.0, which retired the job question, was the latest). From here the admin marks
-- a question fixed when it is created, or once, later, and the server holds a fixed question to
-- the fixed rules (`src/questionnaire/validation/fixed-questions.ts`): required; asked on every
-- program of its loan types (`every_name`) or on every income-proof program of them
-- (`income_proof`); never opt-in, never skipped or added per program name; never out of one of
-- its loan types; gated only on another fixed question; never un-fixed. What each ANSWER means
-- to the engine (the I-Score ranges, the transfer rate keys, the money and debt codes) stays in
-- code.
--
-- This marks today's fixed questions — the 17 the registry held, with the same rows, answers
-- and offers — and the five car questions, fixed for car loans only (operator decision, same
-- day). 22 in all: 16 `every_name`, and 6 `income_proof` — the salary transfer, the requested
-- amount, the declared income, the other-income yes/no and its amount, and the bank statement,
-- the part a no-payslip product works out or does without.
--
-- Every fixed question is REQUIRED. That changes three rows: the car's model year, its fuel
-- type and its dealer become required for every car applicant. They were optional so a solar or
-- e-bike applicant under `car` could skip them; the operator chose to ask them of every car
-- applicant. The other 19 are required already.
--
-- Refused, so nothing is marked half-way: one of the 22 missing or switched off, a car question
-- asked outside `car`, an opt-in row on any of them, or a show-when rule on one that hangs on a
-- question outside the 22. Their per-name skips and additions go (there are none today): a fixed
-- question is asked on every name of its loan types, whatever a board says.
--
-- A FRESH database has no questions when this runs (`migrate deploy` comes before every seed):
-- it adds the column and stops, and `seed:questionnaire` inserts the 22 with their marks as
-- first-run defaults.
--
-- The questionnaire snapshot is frozen: republish after this runs
-- (`npx tsx scripts/publish-questionnaire.ts`).
CREATE TYPE "FixedQuestionServedOn" AS ENUM ('every_name', 'income_proof');

ALTER TABLE "question" ADD COLUMN "fixedServedOn" "FixedQuestionServedOn";

DO $$
DECLARE
  every_name text[] := ARRAY[
    'months_in_current_job', 'residence_governorate', 'residence_area', 'i_score_band',
    'repayment_period_months', 'current_loans', 'obligation_car_loan', 'credit_card_total_limit',
    'obligation_personal_loan', 'obligation_mortgage', 'obligation_other',
    'car_price', 'car_origin', 'car_model_year', 'car_fuel_type', 'car_dealer'
  ];
  income_proof text[] := ARRAY[
    'can_transfer_salary', 'amount_requested', 'monthly_income', 'additional_income',
    'other_income_monthly', 'has_bank_statement'
  ];
  car text[] := ARRAY['car_price', 'car_origin', 'car_model_year', 'car_fuel_type', 'car_dealer'];
  fixed text[] := every_name || income_proof;
  missing text;
  n integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "question") THEN
    RAISE NOTICE 'fixed_questions_are_data: no questions — fresh database, seed:questionnaire inserts the fixed ones with their marks';
    RETURN;
  END IF;

  SELECT string_agg(s.code, ', ' ORDER BY s.code) INTO missing
    FROM unnest(fixed) AS s(code)
   WHERE NOT EXISTS (SELECT 1 FROM "question" q WHERE q."code" = s.code AND q."isActive");
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'fixed_questions_are_data: missing or switched off: % — refusing', missing;
  END IF;

  -- Fixed for car loans only: a car question asked anywhere else would become a fixed question
  -- of that loan type too.
  SELECT count(*) INTO n
    FROM "question_loan_category" l
    JOIN "question" q ON q."id" = l."questionId"
   WHERE q."code" = ANY(car) AND l."category" <> 'car';
  IF n > 0 THEN
    RAISE EXCEPTION 'fixed_questions_are_data: % row(s) ask a car question outside car — refusing', n;
  END IF;

  -- A fixed question is asked of every name in its loan types, so it is never opt-in.
  SELECT count(*) INTO n
    FROM "question_loan_category" l
    JOIN "question" q ON q."id" = l."questionId"
   WHERE q."code" = ANY(fixed) AND l."optIn";
  IF n > 0 THEN
    RAISE EXCEPTION 'fixed_questions_are_data: % opt-in row(s) on a fixed question — refusing', n;
  END IF;

  -- Its show-when source must be fixed too, or the source could be skipped by a name and leave
  -- the fixed question behind it unreachable.
  SELECT count(*) INTO n FROM "question"
   WHERE "code" = ANY(fixed)
     AND "enabledWhen" IS NOT NULL
     AND NOT (("enabledWhen"->>'questionCode') = ANY(fixed));
  IF n > 0 THEN
    RAISE EXCEPTION 'fixed_questions_are_data: % fixed question(s) gated on a question outside the 22 — refusing', n;
  END IF;

  DELETE FROM "program_name_question_exclusion" x USING "question" q
   WHERE x."questionId" = q."id" AND q."code" = ANY(fixed);
  DELETE FROM "program_name_question_addition" a USING "question" q
   WHERE a."questionId" = q."id" AND q."code" = ANY(fixed);

  UPDATE "question" SET "isRequired" = true, "updatedAt" = now()
   WHERE "code" = ANY(fixed) AND NOT "isRequired";

  UPDATE "question" SET "fixedServedOn" = 'every_name', "updatedAt" = now()
   WHERE "code" = ANY(every_name);
  UPDATE "question" SET "fixedServedOn" = 'income_proof', "updatedAt" = now()
   WHERE "code" = ANY(income_proof);
END $$;
