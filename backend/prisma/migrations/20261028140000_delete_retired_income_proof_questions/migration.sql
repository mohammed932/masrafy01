-- The switched-off INCOME-PROOF questions are deleted (v31.7.0, 2026-10-28, the operator's call:
-- "delete income proof questions only, keep surrogate, and keep only the 25 questions in the
-- questionnaire"). The Questions tab lists 25 — the 23 fixed questions and the two ordinary
-- ones no surrogate product asks — and those stay, as do the 36 live questions the no-payslip
-- products ask. What goes is the 39 questions earlier cleanups switched off and nothing reads:
--
--   - retired by `20261014090000_remove_unread_questions`, `20261026120000_retire_total_
--     commitments_question`, `20261026140000_retire_job_question` and
--     `20261027100000_retire_unread_app_questions` (age, purpose, salary bank, the job's
--     follow-ups, the stated total, preferences, the old home / car / business steps);
--   - the superseded buckets the seed drops (`financing_amount`, `monthly_revenue`).
--
-- KEPT although switched off: the five bound to a surrogate fact (`employment_status`,
-- `car_insurance`, `governorate`, `vehicle_condition`, `unit_approved_compound`) — they are the
-- surrogate side, and a product may ask the fact again.
--
-- The answers given to them go with them (`application_answer` restricts the delete): on the
-- database this was written against, 1,475 answers on 56 test applications. Every other answer,
-- offer and decision stays. Options, loan-type rows and per-name skips / additions cascade.
--
-- Refused if any of the 39 turns out to be live, fixed, bound to a fact, mirrored by a lookup
-- list, the show-when source of a live question, named by a bank programme, or in the served
-- questionnaire snapshot. A code absent on this database is skipped (a fresh database never
-- had them — the seed leaves them out). No republish: none is in the served snapshot.
DO $$
DECLARE
  gone text[] := ARRAY[
    'your_age', 'loan_purpose', 'years_as_doctor', 'commercial_register_18m', 'has_tax_card',
    'can_provide_payroll', 'job_tenure', 'salary_transfer', 'salary_bank', 'salary_bank_name',
    'employer_approved', 'active_account', 'current_installments', 'has_credit_card',
    'card_usage', 'existing_bank_relationships', 'i_score', 'priority_factor', 'prior_rejection',
    'needs_consultant', 'needs_consultation', 'needs_assistance', 'wants_insurance',
    'property_type', 'in_compound', 'registration_status', 'property_value', 'down_payment',
    'vehicle_price', 'model_year', 'financing_amount', 'activity_type', 'business_age',
    'financing_purpose', 'business_account', 'registered', 'tax_registration',
    'monthly_revenue', 'current_facilities'];
  n       integer;
  answers integer;
BEGIN
  SELECT count(*) INTO n FROM "question" WHERE "code" = ANY(gone);
  IF n = 0 THEN
    RAISE NOTICE 'delete_retired_income_proof_questions: none of them exists — nothing to do';
    RETURN;
  END IF;

  SELECT count(*) INTO n FROM "question"
   WHERE "code" = ANY(gone) AND ("isActive" OR "fixedServedOn" IS NOT NULL);
  IF n > 0 THEN
    RAISE EXCEPTION 'delete_retired_income_proof_questions: % of them are live or fixed — refusing', n;
  END IF;
  SELECT count(*) INTO n
    FROM "platform_enumeration" f JOIN "question" q ON q."id" = f."boundQuestionId"
   WHERE q."code" = ANY(gone);
  IF n > 0 THEN
    RAISE EXCEPTION 'delete_retired_income_proof_questions: % of them are bound to a fact — refusing', n;
  END IF;
  SELECT count(*) INTO n
    FROM "enumeration_type_def" t JOIN "question" q ON q."id" = t."mirrorQuestionId"
   WHERE q."code" = ANY(gone);
  IF n > 0 THEN
    RAISE EXCEPTION 'delete_retired_income_proof_questions: % of them are mirrored by a lookup list — refusing', n;
  END IF;
  SELECT count(*) INTO n FROM "question"
   WHERE "isActive" AND "enabledWhen"->>'questionCode' = ANY(gone);
  IF n > 0 THEN
    RAISE EXCEPTION 'delete_retired_income_proof_questions: % live question(s) are gated on one of them — refusing', n;
  END IF;
  SELECT count(*) INTO n FROM "bank_program" p, unnest(gone) AS s(code)
   WHERE (coalesce(p."incomeAssumption"::text, '') || coalesce(p."loanLimits"::text, '') ||
          coalesce(p."pricing"::text, '') || coalesce(p."tenor"::text, '') ||
          coalesce(p."fees"::text, '') || coalesce(p."conditions"::text, '') ||
          coalesce(p."eligibility"::text, ''))
         LIKE '%"' || s.code || '"%';
  IF n > 0 THEN
    RAISE EXCEPTION 'delete_retired_income_proof_questions: a bank programme names one of them — refusing';
  END IF;
  SELECT count(*) INTO n FROM "questionnaire_version" v, unnest(gone) AS s(code)
   WHERE v."isActive" AND v."snapshot"::text LIKE '%"code": "' || s.code || '"%';
  IF n > 0 THEN
    RAISE EXCEPTION 'delete_retired_income_proof_questions: the served questionnaire still asks one of them — refusing';
  END IF;

  DELETE FROM "application_answer" a USING "question" q
   WHERE a."questionId" = q."id" AND q."code" = ANY(gone);
  GET DIAGNOSTICS answers = ROW_COUNT;
  DELETE FROM "question" WHERE "code" = ANY(gone);
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'delete_retired_income_proof_questions: % question(s) and % answer(s) deleted', n, answers;
END $$;
