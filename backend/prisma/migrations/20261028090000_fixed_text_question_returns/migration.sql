-- "Which area do you live in?" (`residence_area`) is a FIXED question again (v31.3.0, operator
-- decision 2026-10-28: "return back text question in fixed questions but not tied it with loan
-- engine as it will for collect data purpose"). Reverses the un-fix in
-- `20261027140000_fixed_questions_number_choice`, which is left as applied (an applied migration
-- is never edited): a fixed question may be Text again — asked on every program of its loan
-- types and saved with the application, while changing NO offer. Offer effects sit only on a
-- choice question's answers and a number question's ranges, so a text answer has none.
--
-- Restored as it was before: `every_name`. A fixed question is never opt-in and never skipped
-- or added per program name, so any such row is refused here rather than silently dropped (none
-- exist on the databases this was written against). Skipped when the question is absent (a
-- fresh database — the seed inserts it fixed), switched off, not Text, or already fixed.
--
-- The fixed mark is frozen into the questionnaire snapshot: republish after this runs
-- (`npx tsx scripts/publish-questionnaire.ts`).
DO $$
DECLARE
  qid text;
BEGIN
  SELECT "id" INTO qid FROM "question"
   WHERE "code" = 'residence_area' AND "type" = 'TEXT' AND "isActive" AND "fixedServedOn" IS NULL;
  IF qid IS NULL THEN
    RAISE NOTICE 'fixed_text_question_returns: residence_area is absent, off, not text or already fixed — nothing to do';
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM "question_loan_category" WHERE "questionId" = qid AND "optIn") THEN
    RAISE EXCEPTION 'fixed_text_question_returns: residence_area sits in a loan type as an opt-in row; a fixed question cannot';
  END IF;
  IF EXISTS (SELECT 1 FROM "program_name_question_exclusion" WHERE "questionId" = qid)
     OR EXISTS (SELECT 1 FROM "program_name_question_addition" WHERE "questionId" = qid) THEN
    RAISE EXCEPTION 'fixed_text_question_returns: a program name skips or adds residence_area; a fixed question cannot be';
  END IF;
  UPDATE "question" SET "fixedServedOn" = 'every_name' WHERE "id" = qid;
  RAISE NOTICE 'fixed_text_question_returns: residence_area is fixed again (every_name)';
END $$;
