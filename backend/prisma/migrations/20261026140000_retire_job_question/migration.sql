-- "What kind of work do you do?" (`employment_status`) is no longer asked, on any program
-- (operator, 2026-10-26: "remove this question as I already asked in mobile when select loan
-- category then program"). The applicant picks the loan type and then the program before the
-- questionnaire starts; the operator ruled that pick the answer on payslip names too, as it
-- already was on no-payslip ones (v30.17.0). Unasked, the job reads as the app's `salaried`
-- default and preview's own fallback — the programmes that price the job quote everyone on the
-- salaried row, the operator's call, made knowing that.
--
-- With it go four of the five follow-ups it opened, none of which anything reads: years as a
-- doctor, commercial register, tax card, payroll statement (operator's choice, same day). The
-- fifth, "Can you transfer your salary?", stays and loses its show-when rule: it moves the rate,
-- so every payslip applicant is asked it now, not only the employee jobs.
--
-- SWITCHED OFF, not deleted: answers already given stay on their applications. Out of every
-- loan type (`check:questionnaire` invariant 4 holds a switched-off question to no assignment),
-- with any per-name skip or addition of them. A surrogate fact bound to one (the job's own
-- `employment_status` fact, which nothing reads) is switched off with it — invariant 7 holds an
-- active fact to an active question.
--
-- Refused if anything still reads them: a product asking a bound fact, a bank programme or a
-- catalog name naming a code or a bound fact, a list mirroring one, or a question other than
-- these gated on one.
--
-- The questionnaire snapshot is frozen: republish after this runs
-- (`npx tsx scripts/publish-questionnaire.ts`).
DO $$
DECLARE
  retired text[] := ARRAY[
    'employment_status', 'years_as_doctor', 'commercial_register_18m', 'has_tax_card',
    'can_provide_payroll'
  ];
  n integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "question" WHERE "code" = ANY(retired)) THEN
    RAISE NOTICE 'retire_job_question: none of the questions exist — fresh database, the seed no longer makes them';
    RETURN;
  END IF;

  -- What stays has to be there: the salary transfer, switched on.
  IF NOT EXISTS (SELECT 1 FROM "question" WHERE "code" = 'can_transfer_salary' AND "isActive") THEN
    RAISE EXCEPTION 'retire_job_question: can_transfer_salary is missing or switched off — refusing';
  END IF;

  -- Nothing may read what is switched off.
  SELECT count(*) INTO n
    FROM "surrogate_product_ask" a
    JOIN "platform_enumeration" f ON f."id" = a."factId"
    JOIN "question" q ON q."id" = f."boundQuestionId"
   WHERE q."code" = ANY(retired) AND a."detachedAt" IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'retire_job_question: % product ask(s) read a fact bound to a retired question — refusing', n;
  END IF;
  -- The whole row as JSON, so the scan covers every column a programme stores today.
  SELECT count(*) INTO n FROM "bank_program" p, unnest(retired) AS s(code)
   WHERE to_jsonb(p)::text LIKE '%"' || s.code || '"%';
  IF n > 0 THEN
    RAISE EXCEPTION 'retire_job_question: % bank programme reference(s) to a retired question — refusing', n;
  END IF;
  SELECT count(*) INTO n
    FROM "platform_enumeration" f
    JOIN "question" q ON q."id" = f."boundQuestionId"
    JOIN "bank_program" p ON to_jsonb(p)::text LIKE '%"' || f."key" || '"%'
   WHERE f."type" = 'surrogate_fact' AND q."code" = ANY(retired);
  IF n > 0 THEN
    RAISE EXCEPTION 'retire_job_question: % bank programme reference(s) to a fact bound to a retired question — refusing', n;
  END IF;
  SELECT count(*) INTO n
    FROM "platform_enumeration" f
    JOIN "question" q ON q."id" = f."boundQuestionId"
    JOIN "platform_enumeration" e
      ON e."type" IN ('program_name', 'surrogate_product')
     AND to_jsonb(e)::text LIKE '%"' || f."key" || '"%'
   WHERE f."type" = 'surrogate_fact' AND q."code" = ANY(retired);
  IF n > 0 THEN
    RAISE EXCEPTION 'retire_job_question: % catalog name(s) or product(s) read a fact bound to a retired question — refusing', n;
  END IF;
  SELECT count(*) INTO n
    FROM "enumeration_type_def" t JOIN "question" q ON q."id" = t."mirrorQuestionId"
   WHERE q."code" = ANY(retired);
  IF n > 0 THEN
    RAISE EXCEPTION 'retire_job_question: % list(s) mirror a retired question — refusing', n;
  END IF;

  -- The salary transfer first: it is the one question gated on the job that stays.
  UPDATE "question" SET "enabledWhen" = NULL, "updatedAt" = now()
   WHERE "code" = 'can_transfer_salary' AND "enabledWhen" IS NOT NULL;

  SELECT count(*) INTO n FROM "question"
   WHERE "isActive" AND NOT ("code" = ANY(retired))
     AND "enabledWhen"->>'questionCode' = ANY(retired);
  IF n > 0 THEN
    RAISE EXCEPTION 'retire_job_question: % other question(s) are gated on a retired question — refusing', n;
  END IF;

  UPDATE "platform_enumeration" f
     SET "active" = false, "deprecatedAt" = coalesce(f."deprecatedAt", now()), "updatedAt" = now()
    FROM "question" q
   WHERE f."type" = 'surrogate_fact' AND f."boundQuestionId" = q."id"
     AND q."code" = ANY(retired) AND f."active";

  DELETE FROM "program_name_question_exclusion" x USING "question" q
   WHERE x."questionId" = q."id" AND q."code" = ANY(retired);
  DELETE FROM "program_name_question_addition" a USING "question" q
   WHERE a."questionId" = q."id" AND q."code" = ANY(retired);
  DELETE FROM "question_loan_category" l USING "question" q
   WHERE l."questionId" = q."id" AND q."code" = ANY(retired);
  UPDATE "question" SET "isActive" = false, "updatedAt" = now()
   WHERE "code" = ANY(retired) AND "isActive";
END $$;
