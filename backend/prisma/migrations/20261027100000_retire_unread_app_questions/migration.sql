-- Twelve questions nothing reads leave the questionnaire (v31.0.0, operator decision 2026-10-26):
-- what matters most to the applicant (`priority_factor`), a past rejection, the four home
-- questions (the property's type, its value, the down-payment band and the governorate it is
-- in) and the six business questions (activity, age, purpose, business account, registration,
-- tax card).
--
-- No programme, product, fact or engine step reads any of them. Six reached the server only
-- through the app's request body, mapped there from the answers: the priority, which orders the
-- offers — unasked, the app sends its `fastest_approval` default, so offers are ranked partner
-- bank first, then fewest documents (Principle V) — and a past rejection, the business age and
-- the mortgage's property (type, value, down-payment band), none of which any programme prices
-- (eligibility is skipped on apply). The rest were lead data the applicant typed for nothing.
-- The two program names that skipped `prior_rejection` lose those two skips with it.
--
-- SWITCHED OFF, not deleted: answers already given stay on their applications. Out of every
-- loan type (`check:questionnaire` invariant 4 holds a switched-off question to no assignment),
-- with any per-name skip or addition of them. The one fact bound to one — `property_governorate`,
-- system-only, on the home's governorate, read by nothing — is switched off with it (invariant 7
-- holds an active fact to an active question).
--
-- Refused if anything still reads them, exactly as `20261026140000_retire_job_question` refuses:
-- a product asking a bound fact, a bank programme or a catalog name naming a code or a bound
-- fact, a list mirroring one, or a question other than these gated on one. Refused too if any of
-- them is FIXED (`20261027090000_fixed_questions_are_data`): a fixed question leaves only through
-- the admin's confirmed delete.
--
-- The questionnaire snapshot is frozen: republish after this runs
-- (`npx tsx scripts/publish-questionnaire.ts`).
DO $$
DECLARE
  retired text[] := ARRAY[
    'priority_factor', 'prior_rejection', 'property_type', 'property_value', 'down_payment',
    'governorate', 'business_age', 'activity_type', 'financing_purpose', 'business_account',
    'registered', 'tax_registration'
  ];
  n integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "question" WHERE "code" = ANY(retired)) THEN
    RAISE NOTICE 'retire_unread_app_questions: none of the questions exist — fresh database, the seed no longer makes them';
    RETURN;
  END IF;

  SELECT count(*) INTO n FROM "question"
   WHERE "code" = ANY(retired) AND "fixedServedOn" IS NOT NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'retire_unread_app_questions: % of the questions are fixed — refusing', n;
  END IF;

  -- Nothing may read what is switched off.
  SELECT count(*) INTO n
    FROM "surrogate_product_ask" a
    JOIN "platform_enumeration" f ON f."id" = a."factId"
    JOIN "question" q ON q."id" = f."boundQuestionId"
   WHERE q."code" = ANY(retired) AND a."detachedAt" IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'retire_unread_app_questions: % product ask(s) read a fact bound to a retired question — refusing', n;
  END IF;
  -- The whole row as JSON, so the scan covers every column a programme stores today.
  SELECT count(*) INTO n FROM "bank_program" p, unnest(retired) AS s(code)
   WHERE to_jsonb(p)::text LIKE '%"' || s.code || '"%';
  IF n > 0 THEN
    RAISE EXCEPTION 'retire_unread_app_questions: % bank programme reference(s) to a retired question — refusing', n;
  END IF;
  SELECT count(*) INTO n
    FROM "platform_enumeration" f
    JOIN "question" q ON q."id" = f."boundQuestionId"
    JOIN "bank_program" p ON to_jsonb(p)::text LIKE '%"' || f."key" || '"%'
   WHERE f."type" = 'surrogate_fact' AND q."code" = ANY(retired);
  IF n > 0 THEN
    RAISE EXCEPTION 'retire_unread_app_questions: % bank programme reference(s) to a fact bound to a retired question — refusing', n;
  END IF;
  SELECT count(*) INTO n
    FROM "platform_enumeration" f
    JOIN "question" q ON q."id" = f."boundQuestionId"
    JOIN "platform_enumeration" e
      ON e."type" IN ('program_name', 'surrogate_product')
     AND to_jsonb(e)::text LIKE '%"' || f."key" || '"%'
   WHERE f."type" = 'surrogate_fact' AND q."code" = ANY(retired);
  IF n > 0 THEN
    RAISE EXCEPTION 'retire_unread_app_questions: % catalog name(s) or product(s) read a fact bound to a retired question — refusing', n;
  END IF;
  SELECT count(*) INTO n
    FROM "enumeration_type_def" t JOIN "question" q ON q."id" = t."mirrorQuestionId"
   WHERE q."code" = ANY(retired);
  IF n > 0 THEN
    RAISE EXCEPTION 'retire_unread_app_questions: % list(s) mirror a retired question — refusing', n;
  END IF;
  SELECT count(*) INTO n FROM "question"
   WHERE "isActive" AND NOT ("code" = ANY(retired))
     AND "enabledWhen"->>'questionCode' = ANY(retired);
  IF n > 0 THEN
    RAISE EXCEPTION 'retire_unread_app_questions: % other question(s) are gated on a retired question — refusing', n;
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
