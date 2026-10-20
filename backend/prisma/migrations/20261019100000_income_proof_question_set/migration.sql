-- The FIXED QUESTION SET (v30.11.0, the operator's call, 2026-10-15): the client's income-proof
-- questions ("أسئلة إثبات الدخل"), owned in code by `src/matching/pipeline/base-question-set.ts`
-- and asked on every name that sells a payslip programme. This writes the rows that registry
-- describes onto a database that already has a questionnaire; a fresh one gets them from the
-- seed (`seed-questionnaire.ts`).
--
--   1. NEW QUESTIONS, all required where shown:
--        months_in_current_job   number of months (replaces the four `job_tenure` buckets)
--        years_as_doctor         years, shown when the job is "Doctor"
--        commercial_register_18m yes/no, shown for the employer group
--        has_tax_card            yes/no, shown for the employer group
--        can_transfer_salary     yes/no, shown for the employee group (replaces the four-way
--                                `salary_transfer`; yes reads as a salary-transfer letter)
--        can_provide_payroll     yes/no, shown for the employee group
--        residence_governorate   one of the 27 governorates (the registry's keys and labels)
--        residence_area          free text, up to 120 characters
--        i_score_band            N/A / below 521 / 521-625 / above 625, in all four loan types
--                                (replaces the typed `i_score`; the `i_score` FACT moves onto it)
--        other_income_monthly    amount, shown when `additional_income` is yes — bound to a new
--                                system-only fact so a bank can count it later
--        has_bank_statement      yes/no
--   2. THE JOB QUESTION (`employment_status`) offers the client's sixteen jobs: the five answers
--      it had stay (three relabelled where their seeded wording is unchanged), eleven are added.
--      The lawyer's "nature of work" is three job answers, because a show-when rule watches one
--      question. Each job's DBR/term bucket and follow-up group live in the registry.
--   3. `additional_income` becomes required and is asked in car too.
--   4. RETIRED (switched off, never deleted — answers stay on their applications):
--      `job_tenure`, `salary_transfer`, `i_score`. Their loan-type rows, per-name skips and
--      additions go with them.
--   5. Every per-name skip of a fixed-set question is deleted: the set cannot be skipped.
--   6. ORDER: the pool and each loan type are renumbered densely with the new questions placed
--      after the job question (the job follow-ups, then the region), after `additional_income`
--      (the amount, then the bank statement) and where `i_score` stood (the band). Everything
--      else keeps its relative place, operator reorders included.
--
-- Refused unless the database is in the state this was written against. No money moves: the
-- band edges sit on the shared I-Score table's class edges, every live transfer table is one
-- `none` row, and nothing prices on months in the job.
--
-- The questionnaire snapshot is frozen: republish after this runs.
DO $$
DECLARE
  new_codes  text[] := ARRAY[
    'months_in_current_job', 'years_as_doctor', 'commercial_register_18m', 'has_tax_card',
    'can_transfer_salary', 'can_provide_payroll', 'residence_governorate', 'residence_area',
    'i_score_band', 'other_income_monthly', 'has_bank_statement'];
  retired    text[] := ARRAY['job_tenure', 'salary_transfer', 'i_score'];
  job_block  text[] := ARRAY[
    'months_in_current_job', 'years_as_doctor', 'commercial_register_18m', 'has_tax_card',
    'can_transfer_salary', 'can_provide_payroll', 'residence_governorate', 'residence_area'];
  payslip    "LoanCategory"[] := ARRAY['personal', 'car', 'mortgage']::"LoanCategory"[];
  employee   text[] := ARRAY[
    'military_officer', 'teacher', 'university_professor', 'banker', 'lawyer_employee',
    'private_sector_employee', 'government_employee'];
  employer   text[] := ARRAY[
    'engineer', 'accountant', 'lawyer_with_business', 'business_owner_company_owner'];
  governorates text[] := ARRAY[
    'cairo', 'giza', 'alexandria', 'qalyubia', 'port_said', 'suez', 'dakahlia', 'sharqia',
    'gharbia', 'menofia', 'beheira', 'kafr_el_sheikh', 'damietta', 'ismailia', 'fayoum',
    'beni_suef', 'minya', 'assiut', 'sohag', 'qena', 'luxor', 'aswan', 'red_sea', 'new_valley',
    'matrouh', 'north_sinai', 'south_sinai'];
  job_group  text;
  income_group text;
  score_group text;
  emp_id     text;
  addl_id    text;
  n          integer;
  r          record;
  cat        "LoanCategory";
  ordered    text[];
  i          integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "question" WHERE "code" = 'repayment_period_months') THEN
    RAISE NOTICE 'income_proof_question_set: no questionnaire yet — fresh database, the seed writes the set';
    RETURN;
  END IF;

  -- ---- The before-state -----------------------------------------------------------------
  SELECT count(*) INTO n FROM "question" WHERE "code" = ANY(new_codes);
  IF n > 0 THEN
    RAISE EXCEPTION 'income_proof_question_set: % of the new question code(s) already exist — refusing', n;
  END IF;
  SELECT "id", "groupId" INTO emp_id, job_group FROM "question"
   WHERE "code" = 'employment_status' AND "isActive" AND "type" = 'SINGLE_SELECT';
  IF emp_id IS NULL THEN
    RAISE EXCEPTION 'income_proof_question_set: no active single-choice employment_status — refusing';
  END IF;
  SELECT count(*) INTO n FROM "question_option" WHERE "questionId" = emp_id AND "isActive";
  IF n <> 5 OR EXISTS (
    SELECT 1 FROM "question_option" WHERE "questionId" = emp_id AND "isActive"
       AND NOT ("code" = ANY(ARRAY['government_employee', 'private_sector_employee',
                                  'business_owner_company_owner', 'freelancer', 'retired'])))
  THEN
    RAISE EXCEPTION 'income_proof_question_set: employment_status does not offer exactly its five seeded answers — refusing';
  END IF;
  SELECT "id", "groupId" INTO addl_id, income_group FROM "question"
   WHERE "code" = 'additional_income' AND "isActive" AND "type" = 'SINGLE_SELECT';
  IF addl_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM "question_option" WHERE "questionId" = addl_id AND "code" = 'yes' AND "isActive")
  THEN
    RAISE EXCEPTION 'income_proof_question_set: no active additional_income yes/no — refusing';
  END IF;
  SELECT q."groupId" INTO score_group FROM "question" q
    JOIN "platform_enumeration" f ON f."boundQuestionId" = q."id"
   WHERE q."code" = 'i_score' AND f."type" = 'surrogate_fact' AND f."key" = 'i_score';
  IF score_group IS NULL THEN
    RAISE EXCEPTION 'income_proof_question_set: the i_score fact is not bound to the i_score question — refusing';
  END IF;
  IF EXISTS (SELECT 1 FROM "platform_enumeration" WHERE "type" = 'surrogate_fact' AND "key" = 'other_income_monthly') THEN
    RAISE EXCEPTION 'income_proof_question_set: an other_income_monthly fact already exists — refusing';
  END IF;
  SELECT count(*) INTO n FROM "platform_enumeration"
   WHERE "type" = 'governorate' AND "key" = ANY(governorates);
  IF n <> 27 THEN
    RAISE EXCEPTION 'income_proof_question_set: % of the 27 governorates are in the registry — refusing', n;
  END IF;
  -- Nothing may read what is switched off: a fact bound to a retired question (the i_score fact
  -- is moved below), a programme or product naming one, a question still gated on one.
  SELECT count(*) INTO n
    FROM "platform_enumeration" f JOIN "question" q ON q."id" = f."boundQuestionId"
   WHERE f."type" = 'surrogate_fact' AND q."code" = ANY(retired) AND f."key" <> 'i_score';
  IF n > 0 THEN
    RAISE EXCEPTION 'income_proof_question_set: % retired question(s) are bound to a fact — refusing', n;
  END IF;
  -- The whole row as JSON, so the scan covers every column a programme stores today without
  -- naming one this database might not have.
  SELECT count(*) INTO n FROM "bank_program" p, unnest(retired) AS s(code)
   WHERE to_jsonb(p)::text LIKE '%"' || s.code || '"%';
  IF n > 0 THEN
    RAISE EXCEPTION 'income_proof_question_set: a bank programme names a retired question — refusing';
  END IF;
  SELECT count(*) INTO n FROM "surrogate_product_ask" a
    JOIN "platform_enumeration" f ON f."id" = a."factId"
   WHERE f."key" = 'i_score' AND a."detachedAt" IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'income_proof_question_set: a product asks the i_score fact by itself — refusing';
  END IF;
  SELECT count(*) INTO n FROM "question"
   WHERE "isActive" AND NOT ("code" = ANY(retired))
     AND "enabledWhen"->>'questionCode' = ANY(retired);
  IF n > 0 THEN
    RAISE EXCEPTION 'income_proof_question_set: % question(s) are gated on a retired one — refusing', n;
  END IF;

  -- ---- 1. The new questions --------------------------------------------------------------
  INSERT INTO "question"
    ("id", "groupId", "code", "type", "questionEn", "questionAr", "helperTextEn", "helperTextAr",
     "isRequired", "displayOrder", "isActive", "enabledWhen",
     "numericMinValue", "numericMaxValue", "numericStep", "numericUnitEn", "numericUnitAr",
     "textMaxLength", "updatedAt")
  SELECT 'q_' || substr(md5(t.code), 1, 28), t.grp, t.code, t.qtype::"QuestionType", t.en, t.ar,
         t.hen, t.har, true, 0, true, t.gate, t.mn, t.mx, t.st, t.uen, t.uar, t.maxlen, now()
    FROM (VALUES
      ('months_in_current_job', job_group, 'NUMERIC',
       'How long have you been in your current job?', 'ما مدة بقائك في عملك الحالي؟',
       'In months.', 'بالشهور.', NULL::jsonb,
       0::numeric, 600::numeric, 1::numeric, 'months', 'شهر', NULL::integer),
      ('years_as_doctor', job_group, 'NUMERIC',
       'How many years have you worked as a doctor?', 'كم سنة لك في العمل كطبيب؟',
       NULL, NULL,
       jsonb_build_object('questionCode', 'employment_status', 'operator', 'equals', 'optionCode', 'doctor'),
       0, 60, 1, 'years', 'سنة', NULL),
      ('commercial_register_18m', job_group, 'SINGLE_SELECT',
       'Was your commercial register issued more than 18 months ago?',
       'هل لديك سجل تجاري مر على إصداره أكثر من 18 شهرًا؟',
       NULL, NULL,
       jsonb_build_object('questionCode', 'employment_status', 'operator', 'in', 'optionCodes', to_jsonb(employer)),
       NULL, NULL, NULL, NULL, NULL, NULL),
      ('has_tax_card', job_group, 'SINGLE_SELECT',
       'Do you have a tax card?', 'هل لديك بطاقة ضريبية؟',
       NULL, NULL,
       jsonb_build_object('questionCode', 'employment_status', 'operator', 'in', 'optionCodes', to_jsonb(employer)),
       NULL, NULL, NULL, NULL, NULL, NULL),
      ('can_transfer_salary', job_group, 'SINGLE_SELECT',
       'Can you transfer your salary to the bank if your loan is approved?',
       'هل يمكنك تحويل راتبك على البنك في حالة الموافقة؟',
       NULL, NULL,
       jsonb_build_object('questionCode', 'employment_status', 'operator', 'in', 'optionCodes', to_jsonb(employee)),
       NULL, NULL, NULL, NULL, NULL, NULL),
      ('can_provide_payroll', job_group, 'SINGLE_SELECT',
       'Can you provide a salary breakdown and a payroll account statement?',
       'هل يمكنك تقديم مفردات مرتب وكشف حساب Payroll؟',
       NULL, NULL,
       jsonb_build_object('questionCode', 'employment_status', 'operator', 'in', 'optionCodes', to_jsonb(employee)),
       NULL, NULL, NULL, NULL, NULL, NULL),
      ('residence_governorate', job_group, 'SINGLE_SELECT',
       'Which governorate do you live in?', 'في أي محافظة تسكن؟',
       NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
      ('residence_area', job_group, 'TEXT',
       'Which area do you live in?', 'ما هي منطقة سكنك؟',
       'Your district and street.', 'الحي والشارع.', NULL, NULL, NULL, NULL, NULL, NULL, 120),
      ('i_score_band', score_group, 'SINGLE_SELECT',
       'What is your I-Score rating?', 'ما هو تصنيفك في الآي سكور؟',
       'From your I-Score credit report. Pick "Not available" if you have none.',
       'من تقرير الآي سكور الائتماني. اختر «غير متاح» إن لم يكن لديك تقرير.',
       NULL, NULL, NULL, NULL, NULL, NULL, NULL),
      ('other_income_monthly', income_group, 'NUMERIC',
       'How much is your other income each month?', 'كم دخلك الإضافي شهريًا؟',
       'All your other income together. It is added to your monthly income.',
       'إجمالي دخلك من المصادر الأخرى، ويُضاف إلى دخلك الشهري.',
       jsonb_build_object('questionCode', 'additional_income', 'operator', 'equals', 'optionCode', 'yes'),
       1, 5000000, NULL, 'EGP', 'جنيه', NULL),
      ('has_bank_statement', income_group, 'SINGLE_SELECT',
       'Do you have a bank account statement?', 'هل لديك كشف حساب بنكي؟',
       NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
    ) AS t(code, grp, qtype, en, ar, hen, har, gate, mn, mx, st, uen, uar, maxlen);

  -- Their answers.
  INSERT INTO "question_option" ("id", "questionId", "code", "labelEn", "labelAr", "displayOrder", "isActive", "updatedAt")
  SELECT 'qo_' || substr(md5(q."code" || ':' || o.code), 1, 27), q."id", o.code, o.en, o.ar, o.ord, true, now()
    FROM "question" q
    JOIN (VALUES
      ('commercial_register_18m', 'yes', 'Yes', 'نعم', 1), ('commercial_register_18m', 'no', 'No', 'لا', 2),
      ('has_tax_card', 'yes', 'Yes', 'نعم', 1), ('has_tax_card', 'no', 'No', 'لا', 2),
      ('can_transfer_salary', 'yes', 'Yes', 'نعم', 1), ('can_transfer_salary', 'no', 'No', 'لا', 2),
      ('can_provide_payroll', 'yes', 'Yes', 'نعم', 1), ('can_provide_payroll', 'no', 'No', 'لا', 2),
      ('has_bank_statement', 'yes', 'Yes', 'نعم', 1), ('has_bank_statement', 'no', 'No', 'لا', 2),
      ('i_score_band', 'no_score', 'Not available (N/A)', 'غير متاح (N/A)', 1),
      ('i_score_band', 'below_521', 'Below 521', 'أقل من 521', 2),
      ('i_score_band', 'from_521_to_625', '521 to 625', 'من 521 إلى 625', 3),
      ('i_score_band', 'above_625', 'Above 625', 'أكبر من 625', 4)
    ) AS o(qcode, code, en, ar, ord) ON o.qcode = q."code";

  -- The 27 governorates, with the registry's own labels, in the client's list order.
  INSERT INTO "question_option" ("id", "questionId", "code", "labelEn", "labelAr", "displayOrder", "isActive", "updatedAt")
  SELECT 'qo_' || substr(md5('residence_governorate:' || g.key), 1, 27), q."id", g.key,
         e."labelEn", e."labelAr", g.ord, true, now()
    FROM "question" q
    CROSS JOIN unnest(governorates) WITH ORDINALITY AS g(key, ord)
    JOIN "platform_enumeration" e ON e."type" = 'governorate' AND e."key" = g.key
   WHERE q."code" = 'residence_governorate';

  -- ---- 2. The job list --------------------------------------------------------------------
  INSERT INTO "question_option" ("id", "questionId", "code", "labelEn", "labelAr", "displayOrder", "isActive", "updatedAt")
  SELECT 'qo_' || substr(md5('employment_status:' || o.code), 1, 27), emp_id, o.code, o.en, o.ar, 0, true, now()
    FROM (VALUES
      ('military_officer', 'Military officer', 'ضابط بالقوات المسلحة'),
      ('teacher', 'Teacher', 'مدرس'),
      ('university_professor', 'University professor', 'أستاذ جامعي'),
      ('doctor', 'Doctor', 'طبيب'),
      ('banker', 'Banker', 'موظف بنك'),
      ('engineer', 'Engineer', 'مهندس'),
      ('accountant', 'Accountant', 'محاسب'),
      ('lawyer_employee', 'Lawyer — employed at a company', 'محامٍ — موظف في شركة'),
      ('lawyer_with_business', 'Lawyer — with another business besides law', 'محامٍ — لدي نشاط تجاري آخر غير المحاماة'),
      ('lawyer_private_office', 'Lawyer — private office', 'محامٍ — مكتب خاص'),
      ('other', 'Other', 'أخرى')
    ) AS o(code, en, ar);
  UPDATE "question_option" SET "labelEn" = 'Pensioner', "labelAr" = 'صاحب معاش', "updatedAt" = now()
   WHERE "questionId" = emp_id AND "code" = 'retired' AND "labelEn" = 'Retired' AND "labelAr" = 'متقاعد';
  UPDATE "question_option" SET "labelEn" = 'Self employed', "labelAr" = 'صاحب نشاط تجاري', "updatedAt" = now()
   WHERE "questionId" = emp_id AND "code" = 'business_owner_company_owner'
     AND "labelEn" = 'I own a business or company' AND "labelAr" = 'صاحب عمل / شركة';
  UPDATE "question_option" SET "labelEn" = 'Freelancer / footballer', "labelAr" = 'عمل حر / لاعب كرة قدم', "updatedAt" = now()
   WHERE "questionId" = emp_id AND "code" = 'freelancer' AND "labelEn" = 'I work for myself' AND "labelAr" = 'عمل حر';
  -- The client's order.
  UPDATE "question_option" o SET "displayOrder" = x.ord
    FROM unnest(ARRAY[
      'military_officer', 'teacher', 'university_professor', 'doctor', 'banker', 'engineer',
      'accountant', 'lawyer_employee', 'lawyer_with_business', 'lawyer_private_office',
      'private_sector_employee', 'government_employee', 'retired', 'business_owner_company_owner',
      'freelancer', 'other']) WITH ORDINALITY AS x(code, ord)
   WHERE o."questionId" = emp_id AND o."code" = x.code;

  -- ---- 3. additional_income: required, and asked in car --------------------------------------
  UPDATE "question" SET "isRequired" = true, "updatedAt" = now() WHERE "id" = addl_id AND NOT "isRequired";

  -- ---- Loan types ------------------------------------------------------------------------
  INSERT INTO "question_loan_category" ("questionId", "category", "displayOrder")
  SELECT q."id", c.cat, 0 FROM "question" q CROSS JOIN unnest(payslip) AS c(cat)
   WHERE q."code" = ANY(new_codes) AND q."code" <> 'i_score_band';
  INSERT INTO "question_loan_category" ("questionId", "category", "displayOrder")
  SELECT q."id", c.cat, 0 FROM "question" q
   CROSS JOIN unnest(ARRAY['personal', 'car', 'mortgage', 'business']::"LoanCategory"[]) AS c(cat)
   WHERE q."code" = 'i_score_band';
  INSERT INTO "question_loan_category" ("questionId", "category", "displayOrder")
  SELECT addl_id, c.cat, 0 FROM unnest(payslip) AS c(cat)
  ON CONFLICT ("questionId", "category") DO UPDATE SET "optIn" = false;
  UPDATE "question_loan_category" SET "optIn" = false
   WHERE "optIn" AND "questionId" IN (SELECT "id" FROM "question" WHERE "code" = ANY(new_codes) OR "id" IN (emp_id, addl_id));

  -- ---- 5. The facts -----------------------------------------------------------------------
  UPDATE "platform_enumeration"
     SET "boundQuestionId" = (SELECT "id" FROM "question" WHERE "code" = 'i_score_band'),
         "systemOnly" = true, "active" = true, "deprecatedAt" = NULL, "updatedAt" = now()
   WHERE "type" = 'surrogate_fact' AND "key" = 'i_score';
  INSERT INTO "platform_enumeration"
    ("id", "type", "key", "labelEn", "labelAr", "active", "systemOnly", "sortOrder", "boundQuestionId", "updatedAt")
  SELECT 'sf_' || substr(md5('other_income_monthly'), 1, 27), 'surrogate_fact', 'other_income_monthly',
         'Other income', 'دخل إضافي', true, true, 112, q."id", now()
    FROM "question" q WHERE q."code" = 'other_income_monthly';

  -- ---- 6. Order: the pool -----------------------------------------------------------------
  ordered := '{}';
  FOR r IN SELECT "code" FROM "question" WHERE NOT ("code" = ANY(new_codes)) ORDER BY "displayOrder", "code" LOOP
    ordered := ordered || r.code;
    IF r.code = 'employment_status' THEN ordered := ordered || job_block; END IF;
    IF r.code = 'additional_income' THEN ordered := ordered || ARRAY['other_income_monthly', 'has_bank_statement']; END IF;
    IF r.code = 'i_score' THEN ordered := ordered || ARRAY['i_score_band']; END IF;
  END LOOP;
  FOR i IN 1 .. coalesce(array_length(ordered, 1), 0) LOOP
    UPDATE "question" SET "displayOrder" = i WHERE "code" = ordered[i] AND "displayOrder" <> i;
  END LOOP;

  -- ---- 6. Order: each loan type (before the retired rows leave — i_score marks a place) ----
  FOREACH cat IN ARRAY ARRAY['personal', 'car', 'mortgage', 'business']::"LoanCategory"[] LOOP
    ordered := '{}';
    FOR r IN
      SELECT q."code" FROM "question_loan_category" l JOIN "question" q ON q."id" = l."questionId"
       WHERE l."category" = cat AND NOT (q."code" = ANY(new_codes))
         AND NOT (cat = 'car' AND q."code" = 'additional_income')
       ORDER BY l."displayOrder", q."displayOrder", q."code"
    LOOP
      IF NOT (r.code = ANY(retired)) THEN ordered := ordered || r.code; END IF;
      IF r.code = 'employment_status' THEN
        ordered := ordered || job_block;
        IF cat = 'car' THEN
          ordered := ordered || ARRAY['additional_income', 'other_income_monthly', 'has_bank_statement'];
        END IF;
      END IF;
      IF r.code = 'additional_income' THEN
        ordered := ordered || ARRAY['other_income_monthly', 'has_bank_statement'];
      END IF;
      IF r.code = 'i_score' THEN ordered := ordered || ARRAY['i_score_band']; END IF;
    END LOOP;
    -- Anything new in this loan type whose anchor it does not ask goes last.
    FOR r IN
      SELECT q."code" FROM "question_loan_category" l JOIN "question" q ON q."id" = l."questionId"
       WHERE l."category" = cat AND NOT (q."code" = ANY(ordered)) AND NOT (q."code" = ANY(retired))
       ORDER BY q."displayOrder", q."code"
    LOOP
      ordered := ordered || r.code;
    END LOOP;
    FOR i IN 1 .. coalesce(array_length(ordered, 1), 0) LOOP
      UPDATE "question_loan_category" l SET "displayOrder" = i
        FROM "question" q
       WHERE l."questionId" = q."id" AND l."category" = cat AND q."code" = ordered[i];
    END LOOP;
  END LOOP;

  -- ---- 4. Retire --------------------------------------------------------------------------
  DELETE FROM "program_name_question_exclusion" x USING "question" q
   WHERE x."questionId" = q."id" AND q."code" = ANY(retired);
  DELETE FROM "program_name_question_addition" a USING "question" q
   WHERE a."questionId" = q."id" AND q."code" = ANY(retired);
  DELETE FROM "question_loan_category" l USING "question" q
   WHERE l."questionId" = q."id" AND q."code" = ANY(retired);
  UPDATE "question" SET "isActive" = false, "updatedAt" = now()
   WHERE "code" = ANY(retired) AND "isActive";

  -- ---- 5. The set cannot be skipped or added per name -------------------------------------
  DELETE FROM "program_name_question_exclusion" x USING "question" q
   WHERE x."questionId" = q."id" AND (q."code" = ANY(new_codes) OR q."code" = ANY(ARRAY[
     'employment_status', 'additional_income', 'amount_requested', 'repayment_period_months',
     'monthly_income', 'current_installments', 'current_loans', 'obligation_car_loan',
     'credit_card_total_limit', 'obligation_personal_loan', 'obligation_mortgage', 'obligation_other']));
  DELETE FROM "program_name_question_addition" a USING "question" q
   WHERE a."questionId" = q."id" AND (q."code" = ANY(new_codes) OR q."code" = ANY(ARRAY[
     'employment_status', 'additional_income']));

  RAISE NOTICE 'income_proof_question_set: written — republish the questionnaire (npx tsx scripts/publish-questionnaire.ts)';
END $$;
