-- "How much is your down payment?" (`car_down_payment`) becomes a FIXED question, asked on every
-- car program (v31.4.0, 2026-10-28). The operator: "for now the questions in the system are just
-- the fixed questions". Every car applicant was already asked it, as a platform-owned figure the
-- engine reads (the share of the car's price a bank finances, and the amount where it is car
-- price − down payment). So marking it fixed changes nothing an applicant sees and moves no
-- quote. It only says what was already true: it belongs to the fixed set beside the car's price.
--
-- `every_name`, like the five other car questions. A fixed question is never opt-in and never
-- skipped or added per program name, so any such row is refused here rather than silently
-- dropped (none exist on the databases this was written against). Skipped when the question is
-- absent (a fresh database — the seed inserts it fixed), switched off, or already fixed.
--
-- The fixed mark is frozen into the questionnaire snapshot: republish after this runs
-- (`npx tsx scripts/publish-questionnaire.ts`).
DO $$
DECLARE
  qid text;
BEGIN
  SELECT "id" INTO qid FROM "question"
   WHERE "code" = 'car_down_payment' AND "isActive" AND "fixedServedOn" IS NULL;
  IF qid IS NULL THEN
    RAISE NOTICE 'car_down_payment_fixed: car_down_payment is absent, off or already fixed — nothing to do';
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM "question_loan_category" WHERE "questionId" = qid AND "optIn") THEN
    RAISE EXCEPTION 'car_down_payment_fixed: car_down_payment sits in a loan type as an opt-in row; a fixed question cannot';
  END IF;
  IF EXISTS (SELECT 1 FROM "program_name_question_exclusion" WHERE "questionId" = qid)
     OR EXISTS (SELECT 1 FROM "program_name_question_addition" WHERE "questionId" = qid) THEN
    RAISE EXCEPTION 'car_down_payment_fixed: a program name skips or adds car_down_payment; a fixed question cannot be';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "question" WHERE "id" = qid AND "isRequired") THEN
    RAISE EXCEPTION 'car_down_payment_fixed: car_down_payment is optional; every car quote reads it, so it is fixed as required';
  END IF;
  UPDATE "question" SET "fixedServedOn" = 'every_name' WHERE "id" = qid;
  RAISE NOTICE 'car_down_payment_fixed: car_down_payment is fixed (every_name)';
END $$;
