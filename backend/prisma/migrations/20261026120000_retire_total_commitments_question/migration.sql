-- "What are your total monthly commitments?" (`current_installments`) is no longer asked
-- (operator, 2026-10-26: "no need for this question anymore — it is already asked another way").
--
-- It asked nothing. Every flow asks the debts one by one — `current_loans` and an amount per
-- debt ticked — and the app only ever showed this total read-only, summed from them. The
-- engine already took the debts' own sum (`resolveObligations`); this answer was a cross-check
-- of that sum against itself. Its binding (`MONEY_FIELD_BINDINGS.existing_obligations`) stays
-- in code: an application stored before the itemised debts existed is still read through it.
--
-- SWITCHED OFF, not deleted: answers already given stay on their applications. Out of every
-- loan type (`check:questionnaire` invariant 4 holds a switched-off question to no
-- assignment), with any per-name skip or addition of it.
--
-- Refused if anything still reads it: a surrogate fact bound to it, a bank programme naming
-- it, or a question gated on it.
--
-- The questionnaire snapshot is frozen: republish after this runs
-- (`npx tsx scripts/publish-questionnaire.ts`).
DO $$
DECLARE
  n integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "question" WHERE "code" = 'current_installments') THEN
    RAISE NOTICE 'retire_total_commitments_question: no such question — fresh database, the seed no longer makes it';
    RETURN;
  END IF;

  SELECT count(*) INTO n
    FROM "platform_enumeration" f JOIN "question" q ON q."id" = f."boundQuestionId"
   WHERE f."type" = 'surrogate_fact' AND q."code" = 'current_installments';
  IF n > 0 THEN
    RAISE EXCEPTION 'retire_total_commitments_question: a surrogate fact is bound to it — refusing';
  END IF;
  SELECT count(*) INTO n FROM "bank_program" p
   WHERE (coalesce(p."incomeAssumption"::text, '') || coalesce(p."loanLimits"::text, '') ||
          coalesce(p."pricing"::text, '') || coalesce(p."tenor"::text, '') ||
          coalesce(p."fees"::text, '') || coalesce(p."conditions"::text, '') ||
          coalesce(p."eligibility"::text, ''))
         LIKE '%"current_installments"%';
  IF n > 0 THEN
    RAISE EXCEPTION 'retire_total_commitments_question: % bank programme(s) name it — refusing', n;
  END IF;
  SELECT count(*) INTO n FROM "question"
   WHERE "isActive" AND "code" <> 'current_installments'
     AND "enabledWhen"->>'questionCode' = 'current_installments';
  IF n > 0 THEN
    RAISE EXCEPTION 'retire_total_commitments_question: % question(s) are gated on it — refusing', n;
  END IF;
  -- What replaces it has to be there: the debt-type pick, asked and switched on.
  IF NOT EXISTS (
    SELECT 1 FROM "question" q JOIN "question_loan_category" l ON l."questionId" = q."id"
     WHERE q."code" = 'current_loans' AND q."isActive"
  ) THEN
    RAISE EXCEPTION 'retire_total_commitments_question: current_loans is not asked anywhere — the debts would go unasked; refusing';
  END IF;

  DELETE FROM "program_name_question_exclusion" x USING "question" q
   WHERE x."questionId" = q."id" AND q."code" = 'current_installments';
  DELETE FROM "program_name_question_addition" a USING "question" q
   WHERE a."questionId" = q."id" AND q."code" = 'current_installments';
  DELETE FROM "question_loan_category" l USING "question" q
   WHERE l."questionId" = q."id" AND q."code" = 'current_installments';
  UPDATE "question" SET "isActive" = false, "updatedAt" = now()
   WHERE "code" = 'current_installments' AND "isActive";
END $$;
