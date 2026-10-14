-- The MVP questionnaire cleanup (v30.10.0, the operator's call). Questions no programme,
-- product or engine step reads leave the pool, and test rows nobody ever answered are deleted.
--
--   1. SWITCHED OFF (isActive = false, and out of every loan type — `check:questionnaire`
--      invariant 4 holds a switched-off question to no assignment). Answers already given stay
--      on their applications; archived snapshots keep the questions by value.
--        - asked on the payslip names and read by nothing: `loan_purpose`, `needs_consultant`,
--          `salary_bank` + its follow-up `salary_bank_name`, `employer_approved`,
--          `active_account`;
--        - asked of nobody at all: `existing_bank_relationships` (its `bank_relationship` axis
--          has no reader), and mortgage's `in_compound`, `registration_status`,
--          `needs_assistance` (the two mortgage names already skip them, and no other name
--          offers mortgage).
--      KEPT on the operator's call: `job_tenure`, `salary_transfer`, `prior_rejection` (real
--      bank terms price on salary transfer; removing them now would quote a payroll customer
--      the default rate silently once they do) and every business question (no business bank
--      yet, so nobody sees them, and the first one needs them).
--      Their per-name skips and additions go with them.
--   2. DELETED: seven switched-off test rows with no answer anywhere — `test_question`,
--      `test_number_input`, `test_number_type_question`, `test_amir_finaince`,
--      `multi_choice_questions`, `owns_practice`, `obligation_credit_card`.
--
-- Refused if anything turns out to read one of the switched-off questions: a surrogate fact
-- bound to it, a programme table naming it, or a question that stays gated on it.
--
-- The questionnaire snapshot is frozen: republish after this runs.
DO $$
DECLARE
  retired text[] := ARRAY[
    'loan_purpose', 'needs_consultant', 'salary_bank', 'salary_bank_name', 'employer_approved',
    'active_account', 'existing_bank_relationships', 'in_compound', 'registration_status',
    'needs_assistance'];
  junk    text[] := ARRAY[
    'test_question', 'test_number_input', 'test_number_type_question', 'test_amir_finaince',
    'multi_choice_questions', 'owns_practice', 'obligation_credit_card'];
  n       integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "question" WHERE "code" = 'repayment_period_months') THEN
    RAISE NOTICE 'remove_unread_questions: no questionnaire yet — fresh database, the seed leaves these out';
    RETURN;
  END IF;

  -- Nothing may read what is switched off.
  SELECT count(*) INTO n
    FROM "platform_enumeration" f JOIN "question" q ON q."id" = f."boundQuestionId"
   WHERE f."type" = 'surrogate_fact' AND q."code" = ANY(retired);
  IF n > 0 THEN
    RAISE EXCEPTION 'remove_unread_questions: % retired question(s) are bound to a fact — refusing', n;
  END IF;
  SELECT count(*) INTO n FROM "bank_program" p, unnest(retired) AS s(code)
   WHERE (coalesce(p."incomeAssumption"::text, '') || coalesce(p."loanLimits"::text, '') ||
          coalesce(p."pricing"::text, '') || coalesce(p."tenor"::text, '') ||
          coalesce(p."fees"::text, '') || coalesce(p."conditions"::text, '') ||
          coalesce(p."eligibility"::text, ''))
         LIKE '%"' || s.code || '"%';
  IF n > 0 THEN
    RAISE EXCEPTION 'remove_unread_questions: a bank programme names a retired question — refusing';
  END IF;
  SELECT count(*) INTO n FROM "question"
   WHERE "isActive" AND NOT ("code" = ANY(retired))
     AND "enabledWhen"->>'questionCode' = ANY(retired);
  IF n > 0 THEN
    RAISE EXCEPTION 'remove_unread_questions: % kept question(s) are gated on a retired one — refusing', n;
  END IF;

  -- 1.
  DELETE FROM "program_name_question_exclusion" x USING "question" q
   WHERE x."questionId" = q."id" AND q."code" = ANY(retired);
  DELETE FROM "program_name_question_addition" a USING "question" q
   WHERE a."questionId" = q."id" AND q."code" = ANY(retired);
  DELETE FROM "question_loan_category" l USING "question" q
   WHERE l."questionId" = q."id" AND q."code" = ANY(retired);
  UPDATE "question" SET "isActive" = false, "updatedAt" = now()
   WHERE "code" = ANY(retired) AND "isActive";

  -- 2. Only rows already switched off and answered by nobody; anything else is left alone.
  DELETE FROM "question" q
   WHERE q."code" = ANY(junk) AND NOT q."isActive"
     AND NOT EXISTS (SELECT 1 FROM "application_answer" a WHERE a."questionId" = q."id");
END $$;
