-- Questions belong to PROGRAMS, not loan types (v32.0.0) — part 2 of 2.
--
-- Part 1 (`20261029100000_program_question_order`) moved what the loan-type assignment still
-- did onto the program: each program's own order, and the six car questions as ticks on every
-- car program. Nothing reads either table below any more:
--
--   - `question_loan_category` — which loan types asked each question, its opt-in rows and each
--     loan type's order. A question carries no loan type now; a program asks its fixed
--     questions, what its bank programs read and what the operator ticked for it.
--   - `program_name_question_exclusion` — a program's SKIPS of a question its loan type asked.
--     With no loan-type list there is nothing to skip from: a program's non-fixed questions are
--     exactly its ticks, and "remove" is an untick. (Three rows existed when this was written,
--     all on home_purchase / mortgage, none of them asked there any more.)
--
-- Republish after this runs (`npx tsx scripts/publish-questionnaire.ts`): the active snapshot
-- still carries the old loan-type keys until the next version is cut (the read path honours
-- them meanwhile, `fixed-questions.ts#frozenFixedServedOn`).
DO $$
DECLARE
  pairs int;
  ordered int;
  fixed text;
  skips text;
BEGIN
  SELECT count(*) INTO pairs
    FROM "platform_enumeration_loan_category" l
    JOIN "platform_enumeration" e ON e."id" = l."enumerationId" AND e."type" = 'program_name';
  SELECT count(*) INTO ordered FROM "program_name_question_order";
  IF pairs > 0 AND ordered = 0 AND EXISTS (SELECT 1 FROM "question_loan_category") THEN
    RAISE EXCEPTION 'drop_question_category_assignment: no program order was copied from the loan types — part 1 did not run as expected';
  END IF;

  SELECT string_agg("code", ', ') INTO fixed FROM "question"
   WHERE "fixedServedOn" IS NOT NULL
     AND "code" IN ('car_price', 'car_down_payment', 'car_model_year', 'car_origin',
                    'car_fuel_type', 'car_dealer');
  IF fixed IS NOT NULL THEN
    RAISE EXCEPTION 'drop_question_category_assignment: car questions still fixed, which with no loan type would ask them on every program: %', fixed;
  END IF;

  SELECT string_agg(e."key" || '/' || x."category" || '/' || q."code", ', ') INTO skips
    FROM "program_name_question_exclusion" x
    JOIN "platform_enumeration" e ON e."id" = x."enumerationId"
    JOIN "question" q ON q."id" = x."questionId";
  IF skips IS NOT NULL THEN
    RAISE NOTICE 'drop_question_category_assignment: dropping per-program skips (nothing is left to skip from): %', skips;
  END IF;
END $$;

DROP TABLE "program_name_question_exclusion";

DROP TABLE "question_loan_category";
