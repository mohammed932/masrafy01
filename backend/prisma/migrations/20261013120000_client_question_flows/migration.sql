-- The client's per-tool question flows (v30.10.0), measured against the live programmes. Every
-- change is either a question a tool asks wrongly, or one it asks for nothing.
--
--   A. ACADEMIC RANKS by seniority (registry `professor_rank` + the mirrored question options):
--      dean → professor & section head → professor → assistant professor → lecturer →
--      assistant teacher → junior staff, the order the client lists them. The registry held
--      duplicate sort orders, so the options came out interleaved.
--   B. FOUR NAMES WITH NO PROGRAMME are deleted: `hossam` and `totototototo` (typed on the admin
--      while testing) and `athlete` / `wealth_tier` (catalog names no bank ever sold). None is
--      offered to a customer; each sat in the admin catalog. Refused if anything references one.
--   C. THE QUESTIONNAIRE:
--      1. `military_grade` loses its `employment_status = government_employee` gate. The grade is
--         the ONLY thing the Armed Forces programme prices on, so an officer who answered the job
--         question any other way was never asked it and got zero offers. Served only where a
--         programme reads it (`armed_forces_no_payslip`), so ungated it asks nobody else.
--      2. `existing_bank_loans` / `existing_bank_products` gain a `none` answer ("None of these
--         banks"). Both are REQUIRED where a programme reads their column (compound owner,
--         clinic-owner doctors) and had no way to say "none". `none` matches no bank slug, so it
--         reads the bank's standard column: money-neutral.
--      3. `car_origin` becomes required: the three Crédit Agricole car caps are keyed by it with
--         `onNoMatch: reject`, so a skipped origin got no offer from any of them.
--      4. The rank and grade helpers stop saying "skip this" — each is required where served.
--      5. Order, per loan type and only between questions no payslip name serves together:
--         personal — school type before stage, university type before rank, governorate before
--         years in practice, the four extra-income amounts right after their yes/no; mortgage —
--         income, job, term, amount; I-Score before the debts; location, unit type, value, then
--         the down payment, which moves into the property step (it is asked in mortgage alone).
--      6. The two MORTGAGE names (home_purchase, home_finishing — under `mortgage` only; the
--         personal Home Finishing flow is untouched) skip eleven questions that move no money on
--         any mortgage programme: six read by nothing (salary bank + which bank, approved
--         employer, active account, consultant, assistance) and five the app reads but no
--         mortgage programme prices on (time in job, salary transfer, a past rejection,
--         compound, registration — every transfer table is one `none` row, eligibility is
--         skipped on apply). Their `APP_MAPPED_QUESTIONS_BY_CATEGORY.mortgage` entries go in
--         the same change. Refused if any of them turns out to be read by a mortgage programme.
--   D. CLUB MEMBERSHIP and TEACHERS — STANDARD become no-payslip programmes (operator decision):
--      - `club_branch_cap` gets its calculation (the branch sets the ceiling), exactly as
--        `seed:blueprints` + `seed:sheet-figures` write it; a new name `club_membership`
--        (personal, no payslip) sells it; FAB-PER-CLUB_MEMBERSHIP moves off `private_sector`.
--      - CAE-PER-TEACHERS_STANDARD moves under `teachers_predefined`, on the Predefined product's
--        table with one figure for every stage (national 500,000 / international 750,000); the
--        name is relabelled "Teachers" because it now sells both CAE programmes.
--      Each programme's school-type / branch cap leaves its `loanLimits` (the ceiling IS that
--      table now) and its eligibility is the no-payslip shape the bank-program service writes
--      (`minMonthlyIncomeEGP` 0, transfer `none`). Refused unless each row is in the state this
--      was written against.
--
-- Rows are found by code and key, never by id — ids differ per database. A fresh database
-- (migrations before seeds) gets A and B here and the rest from the seeds, except the mortgage
-- skips (operator data no seed authors; see docs/fresh-install.md).
--
-- The questionnaire snapshot is frozen: republish after this runs
-- (`POST /api/admin/questionnaire/versions/publish`, or `npx tsx scripts/publish-questionnaire.ts`).

-- ---------------------------------------------------------------------------------------------
-- A. Academic ranks by seniority — the registry (runs on every database; the rows predate this).
-- ---------------------------------------------------------------------------------------------
UPDATE "platform_enumeration" AS pe
   SET "sortOrder" = v.ord, "updatedAt" = now()
  FROM (VALUES ('dean', 0), ('professor_section_head', 1), ('professor', 2),
               ('assistant_professor', 3), ('lecturer', 4), ('assistant_teacher', 5),
               ('junior_staff', 6)) AS v(key, ord)
 WHERE pe."type" = 'professor_rank' AND pe."key" = v.key AND pe."sortOrder" <> v.ord;

-- ---------------------------------------------------------------------------------------------
-- B. The four names with no programme.
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  doomed text[] := ARRAY['hossam', 'totototototo', 'athlete', 'wealth_tier'];
  n      integer;
BEGIN
  SELECT count(*) INTO n FROM "bank_program" WHERE "programNameKey" = ANY(doomed);
  IF n > 0 THEN
    RAISE EXCEPTION 'client_question_flows: % bank programme(s) are filed under a name being deleted — refusing', n;
  END IF;
  SELECT count(*) INTO n FROM "application" WHERE "programNameKey" = ANY(doomed);
  IF n > 0 THEN
    RAISE EXCEPTION 'client_question_flows: % application(s) were made under a name being deleted — refusing', n;
  END IF;
  -- Loan-type rows, skips and additions go with them (ON DELETE CASCADE).
  DELETE FROM "platform_enumeration" WHERE "type" = 'program_name' AND "key" = ANY(doomed);
END $$;

-- ---------------------------------------------------------------------------------------------
-- C. The questionnaire.
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  mortgage_skips text[] := ARRAY[
    'salary_bank', 'salary_bank_name', 'employer_approved', 'active_account',
    'needs_consultant', 'needs_assistance',
    'job_tenure', 'salary_transfer', 'prior_rejection', 'in_compound', 'registration_status'];
  engine_codes   text[] := ARRAY[
    'amount_requested', 'repayment_period_months', 'monthly_income', 'current_installments',
    'current_loans', 'obligation_car_loan', 'obligation_personal_loan', 'obligation_mortgage',
    'obligation_other', 'credit_card_total_limit', 'employment_status', 'priority_factor',
    'property_type', 'property_value', 'down_payment'];
  property_group text;
  n              integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "question" WHERE "code" = 'repayment_period_months') THEN
    RAISE NOTICE 'client_question_flows: no questionnaire yet — fresh database, the seeds write C';
    RETURN;
  END IF;

  -- 1. The grade, ungated. Only the gate this was written against is removed.
  UPDATE "question" SET "enabledWhen" = NULL, "updatedAt" = now()
   WHERE "code" = 'military_grade'
     AND "enabledWhen" = '{"operator": "equals", "optionCode": "government_employee", "questionCode": "employment_status"}'::jsonb;

  -- 2. "None of these banks", last, on the two per-bank axes a programme reads.
  INSERT INTO "question_option"
         ("id", "questionId", "code", "labelAr", "labelEn", "displayOrder", "isActive", "createdAt", "updatedAt")
  SELECT 'qo_' || substr(md5(q."code" || ':none'), 1, 27), q."id", 'none',
         'لا يوجد لدي في أي من هذه البنوك', 'None of these banks',
         (SELECT coalesce(max(o."displayOrder"), 0) + 1 FROM "question_option" o WHERE o."questionId" = q."id"),
         true, now(), now()
    FROM "question" q
   WHERE q."code" IN ('existing_bank_loans', 'existing_bank_products')
     AND NOT EXISTS (SELECT 1 FROM "question_option" o WHERE o."questionId" = q."id" AND o."code" = 'none');

  -- 3.
  UPDATE "question" SET "isRequired" = true, "updatedAt" = now()
   WHERE "code" = 'car_origin' AND NOT "isRequired";

  -- 4. Only the seeded wording is replaced; an admin's own edit is left alone.
  UPDATE "question"
     SET "helperTextEn" = 'Some banks set an assumed income from your grade.',
         "helperTextAr" = 'بعض البنوك تحدد دخلًا مفترضًا حسب رتبتك.',
         "updatedAt"    = now()
   WHERE "code" = 'military_grade'
     AND "helperTextEn" = 'Some banks set an assumed income from your grade. Skip this if it does not apply.';
  UPDATE "question"
     SET "helperTextEn" = 'Some banks set an assumed income from your rank.',
         "helperTextAr" = 'بعض البنوك تحدد دخلًا مفترضًا حسب درجتك العلمية.',
         "updatedAt"    = now()
   WHERE "code" = 'academic_rank'
     AND "helperTextEn" = 'Some banks set an assumed income from your rank. Skip this if it does not apply.';

  -- A, the question half: the rank options in the registry's new order.
  UPDATE "question_option" AS o
     SET "displayOrder" = v.ord, "updatedAt" = now()
    FROM "question" q,
         (VALUES ('dean', 1), ('professor_section_head', 2), ('professor', 3),
                 ('assistant_professor', 4), ('lecturer', 5), ('assistant_teacher', 6),
                 ('junior_staff', 7)) AS v(code, ord)
   WHERE q."code" = 'academic_rank' AND o."questionId" = q."id" AND o."code" = v.code
     AND o."displayOrder" <> v.ord;

  -- 5. Order. Each row moves only from the position this was written against, so an operator's
  --    own reorder since is left as it is.
  UPDATE "question_loan_category" AS l
     SET "displayOrder" = v.new_pos
    FROM "question" q,
         (VALUES
            -- personal: school type before stage, university type before rank,
            ('personal', 'is_the_school_international_or_national', 54, 53),
            ('personal', 'which_stage_do_you_teach',                53, 54),
            ('personal', 'is_the_university_government_or_private', 55, 24),
            ('personal', 'academic_rank',                           24, 55),
            -- governorate before years in practice,
            ('personal', 'practice_governorate',                    26, 25),
            ('personal', 'years_in_practice',                       25, 26),
            -- the extra income after the practice questions, its amounts right behind it.
            ('personal', 'additional_income',                       21, 30),
            ('personal', 'rental_income_monthly',                   65, 31),
            ('personal', 'cd_returns_monthly',                      66, 32),
            ('personal', 'fixed_allowances_monthly',                67, 33),
            ('personal', 'variable_allowances_monthly',             68, 34),
            -- mortgage: income, job, term, amount;
            ('mortgage', 'employment_status',                       15, 2),
            ('mortgage', 'repayment_period_months',                  2, 3),
            ('mortgage', 'amount_requested',                         3, 4),
            -- the I-Score before the debts;
            ('mortgage', 'i_score',                                 64, 3),
            -- where the home is, what it is, what it is worth, the deposit against that worth.
            ('mortgage', 'governorate',                             41, 38),
            ('mortgage', 'property_type',                           38, 39),
            ('mortgage', 'property_value',                          42, 40),
            ('mortgage', 'down_payment',                            43, 41),
            ('mortgage', 'in_compound',                             39, 42),
            ('mortgage', 'registration_status',                     40, 43)
         ) AS v(category, code, old_pos, new_pos)
   WHERE q."code" = v.code AND l."questionId" = q."id"
     AND l."category" = v.category::"LoanCategory" AND l."displayOrder" = v.old_pos;

  -- The deposit joins the property step. Asked in mortgage alone, so no other loan type moves.
  SELECT count(*) INTO n FROM "question_loan_category" l JOIN "question" q ON q."id" = l."questionId"
   WHERE q."code" = 'down_payment' AND l."category" <> 'mortgage';
  IF n > 0 THEN
    RAISE EXCEPTION 'client_question_flows: down_payment is asked outside mortgage — moving its step would move it there too';
  END IF;
  SELECT "id" INTO property_group FROM "question_group" WHERE "code" = 'property_financing';
  IF property_group IS NULL THEN
    RAISE EXCEPTION 'client_question_flows: no property_financing step';
  END IF;
  UPDATE "question" SET "groupId" = property_group, "updatedAt" = now()
   WHERE "code" = 'down_payment' AND "groupId" <> property_group;

  -- 6. The mortgage skips — only questions no mortgage programme can be reading.
  SELECT count(*) INTO n FROM unnest(mortgage_skips) AS s(code) WHERE s.code = ANY(engine_codes);
  IF n > 0 THEN
    RAISE EXCEPTION 'client_question_flows: a mortgage skip is an engine input — refusing';
  END IF;
  -- Bound to a fact = something could read it through a table; none of these is.
  SELECT count(*) INTO n
    FROM "platform_enumeration" f JOIN "question" q ON q."id" = f."boundQuestionId"
   WHERE f."type" = 'surrogate_fact' AND q."code" = ANY(mortgage_skips);
  IF n > 0 THEN
    RAISE EXCEPTION 'client_question_flows: % mortgage skip(s) are bound to a fact — refusing', n;
  END IF;
  -- And no mortgage programme names one in any of its tables.
  SELECT count(*) INTO n FROM "bank_program" p, unnest(mortgage_skips) AS s(code)
   WHERE p."productCategory" = 'mortgage' AND p."active"
     AND (coalesce(p."incomeAssumption"::text, '') || coalesce(p."loanLimits"::text, '') ||
          coalesce(p."pricing"::text, '') || coalesce(p."tenor"::text, '') ||
          coalesce(p."fees"::text, '') || coalesce(p."conditions"::text, ''))
         LIKE '%"' || s.code || '"%';
  IF n > 0 THEN
    RAISE EXCEPTION 'client_question_flows: a mortgage programme reads a question this would skip — refusing';
  END IF;

  INSERT INTO "program_name_question_exclusion" ("enumerationId", "category", "questionId", "createdAt")
  SELECT pe."id", 'mortgage'::"LoanCategory", q."id", now()
    FROM "platform_enumeration" pe
    JOIN "platform_enumeration_loan_category" plc
      ON plc."enumerationId" = pe."id" AND plc."category" = 'mortgage'
    JOIN "question" q ON q."code" = ANY(mortgage_skips)
   WHERE pe."type" = 'program_name' AND pe."key" IN ('home_purchase', 'home_finishing')
  ON CONFLICT DO NOTHING;
END $$;

-- ---------------------------------------------------------------------------------------------
-- D. Club Membership and Teachers — Standard, without a payslip.
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  club_rule jsonb := '{"gates": [], "steps": [{"id": "primary", "op": "factChoiceTable", "fact": "club_branch"}], "output": {"from": "primary", "kind": "maxAmount", "baselineDbrPercent": "50"}, "strategy": "steps", "stepParams": {"primary": {"keyTable": [{"key": "branch_new_cairo", "incomeEGP": "750000"}, {"key": "branch_sheikh_zayed", "incomeEGP": "510000"}, {"key": "branch_main", "incomeEGP": "160000"}]}}}';
  club_tpl  jsonb := '{"primary": {"fact": "club_branch", "kind": "choiceTable"}, "version": 1, "conditions": [], "outputKind": "maxAmount", "blueprintKey": "club_branch_cap", "baselineDbrPercent": "50"}';
  fab_cap   jsonb := '{"rows": [{"rowKey": "branch_new_cairo", "maxAmountEGP": "750000"}, {"rowKey": "branch_sheikh_zayed", "maxAmountEGP": "510000"}, {"rowKey": "branch_main", "maxAmountEGP": "160000"}], "factKey": "club_branch", "onNoMatch": "useProgramMax"}';
  fab_rule  jsonb := '{"wayId": "primary", "amounts": "own", "strategy": "steps", "stepParams": {"primary": {"keyTable": [{"key": "branch_new_cairo", "incomeEGP": "750000"}, {"key": "branch_sheikh_zayed", "incomeEGP": "510000"}, {"key": "branch_main", "incomeEGP": "160000"}]}}}';
  cae_cap   jsonb := '{"rows": [{"rowKey": "school_national", "maxAmountEGP": "500000"}, {"rowKey": "school_international", "maxAmountEGP": "750000"}], "factKey": "school_type", "onNoMatch": "useProgramMax"}';
  cae_rule  jsonb := '{"wayId": "primary", "amounts": "own", "strategy": "steps", "stepParams": {"primary": {"keyTable": [{"key": "stage_primary", "incomeEGP": "500000"}, {"key": "stage_preparatory", "incomeEGP": "500000"}, {"key": "stage_secondary", "incomeEGP": "500000"}]}, "primary__school_international": {"keyTable": [{"key": "stage_primary", "incomeEGP": "750000"}, {"key": "stage_preparatory", "incomeEGP": "750000"}, {"key": "stage_secondary", "incomeEGP": "750000"}]}}}';
  no_payslip_eligibility jsonb := '{"minMonthlyIncomeEGP": "0", "acceptedTransferTypes": ["none"]}';
  fab_notes text := $notes$Figures transcribed from App. B — FABMISR Al Ahly club membership.
The branch the membership is at sets the ceiling; the engine still reduces it by the applicant’s existing debts.
The sheet also checks the customer’s real declared income against a debt-burden cap. Sold without a payslip, that check is not run — the operator’s decision (2026-10-13).
The sheet also prints a minimum down payment per branch (85,500 · 85,500 · 256,500), which is policy the operator must read here.
The debt-burden percentage is not shown on the sheet — 50% is an estimate.
Credit card / Murabaha maximum limit 100,000.$notes$;
  cae_notes text := $notes$Figures transcribed from App. B — Crédit Agricole Teachers, standard (0759-17 / 0759-18).
The school type sets the ceiling — the same figure at every stage; the engine still reduces it by the applicant’s existing debts.
The sheet also runs a real income and debt-burden check "as per retail risk policy". Sold without a payslip, that check is not run — the operator’s decision (2026-10-13).
That percentage is not printed on the sheet — 50% is an estimate, and until a bank gives the real one every figure this program quotes is provisional.
International means an American diploma, an international Bachelor, or IGCSE following an international curriculum.
Rate and fees are not stated on the sheet.$notes$;
  stored    jsonb;
  club_id   text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "bank_program" WHERE "programCode" = 'FAB-PER-CLUB_MEMBERSHIP') THEN
    RAISE NOTICE 'client_question_flows: no sheet programmes yet — fresh database, the seeds write D';
    RETURN;
  END IF;

  -- The product's calculation.
  SELECT "incomeRule" INTO stored FROM "platform_enumeration"
   WHERE "type" = 'surrogate_product' AND "key" = 'club_branch_cap';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'client_question_flows: no club_branch_cap product — run seed:blueprints first';
  END IF;
  IF stored IS NULL THEN
    UPDATE "platform_enumeration"
       SET "incomeRule" = club_rule, "templateSpec" = club_tpl,
           "valueSources" = '{"incomeRule.output.baselineDbrPercent": "team_estimated"}',
           "updatedAt" = now()
     WHERE "type" = 'surrogate_product' AND "key" = 'club_branch_cap' AND "incomeRule" IS NULL;
  ELSIF stored <> club_rule THEN
    RAISE EXCEPTION 'client_question_flows: club_branch_cap already holds a different calculation — refusing';
  END IF;

  -- The name that sells it.
  SELECT "id" INTO club_id FROM "platform_enumeration" WHERE "type" = 'program_name' AND "key" = 'club_membership';
  IF club_id IS NULL THEN
    club_id := 'pn_' || substr(md5('club_membership'), 1, 24);
    INSERT INTO "platform_enumeration"
           ("id", "type", "key", "labelAr", "labelEn", "active", "systemOnly", "sortOrder",
            "createdAt", "updatedAt", "valueSources", "surrogateProductKey")
    VALUES (club_id, 'program_name', 'club_membership', 'عضوية النادي', 'Club Membership', true, false, 0,
            now(), now(), '{}', 'club_branch_cap');
  ELSIF NOT EXISTS (SELECT 1 FROM "platform_enumeration" WHERE "id" = club_id AND "surrogateProductKey" = 'club_branch_cap') THEN
    RAISE EXCEPTION 'client_question_flows: club_membership exists and sells another product — refusing';
  END IF;
  INSERT INTO "platform_enumeration_loan_category" ("enumerationId", "category", "createdAt", "payslip", "noPayslip")
  SELECT club_id, 'personal', now(), false, true
   WHERE NOT EXISTS (SELECT 1 FROM "platform_enumeration_loan_category"
                      WHERE "enumerationId" = club_id AND "category" = 'personal');

  -- "Teachers": it sells both CAE programmes now. Only the seeded label is replaced.
  UPDATE "platform_enumeration"
     SET "labelEn" = 'Teachers', "labelAr" = 'المعلمون', "updatedAt" = now()
   WHERE "type" = 'program_name' AND "key" = 'teachers_predefined'
     AND "labelEn" = 'Teachers — Predefined Limit';

  -- The two programmes.
  IF EXISTS (SELECT 1 FROM "bank_program" WHERE "programCode" = 'FAB-PER-CLUB_MEMBERSHIP'
              AND "programNameKey" = 'club_membership' AND "programType" = 'income_surrogate') THEN
    NULL;  -- already moved
  ELSIF EXISTS (SELECT 1 FROM "bank_program" WHERE "programCode" = 'FAB-PER-CLUB_MEMBERSHIP'
                 AND "programNameKey" = 'private_sector' AND "programType" = 'income_proof'
                 AND "incomeAssumption" = '{"strategy": "declared"}'::jsonb
                 AND "loanLimits"->'maxLoanByFact' = fab_cap) THEN
    UPDATE "bank_program"
       SET "programNameKey"   = 'club_membership',
           "programType"      = 'income_surrogate',
           "incomeAssumption" = fab_rule,
           "loanLimits"       = "loanLimits" - 'maxLoanByFact',
           "eligibility"      = "eligibility" || no_payslip_eligibility,
           "operatorNotes"    = fab_notes,
           "version"          = "version" + 1,
           "updatedAt"        = now()
     WHERE "programCode" = 'FAB-PER-CLUB_MEMBERSHIP';
  ELSE
    RAISE EXCEPTION 'client_question_flows: FAB-PER-CLUB_MEMBERSHIP is not in the state this was written against — refusing';
  END IF;

  IF EXISTS (SELECT 1 FROM "bank_program" WHERE "programCode" = 'CAE-PER-TEACHERS_STANDARD'
              AND "programNameKey" = 'teachers_predefined' AND "programType" = 'income_surrogate') THEN
    NULL;  -- already moved
  ELSIF EXISTS (SELECT 1 FROM "bank_program" WHERE "programCode" = 'CAE-PER-TEACHERS_STANDARD'
                 AND "programNameKey" = 'private_sector' AND "programType" = 'income_proof'
                 AND "incomeAssumption" = '{"strategy": "declared"}'::jsonb
                 AND "loanLimits"->'maxLoanByFact' = cae_cap) THEN
    UPDATE "bank_program"
       SET "programNameKey"   = 'teachers_predefined',
           "programType"      = 'income_surrogate',
           "incomeAssumption" = cae_rule,
           "loanLimits"       = "loanLimits" - 'maxLoanByFact',
           "eligibility"      = "eligibility" || no_payslip_eligibility,
           "operatorNotes"    = cae_notes,
           "version"          = "version" + 1,
           "updatedAt"        = now()
     WHERE "programCode" = 'CAE-PER-TEACHERS_STANDARD';
  ELSE
    RAISE EXCEPTION 'client_question_flows: CAE-PER-TEACHERS_STANDARD is not in the state this was written against — refusing';
  END IF;
END $$;
