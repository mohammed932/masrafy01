-- The question-catalog review (v30.5.0). Every change here is a question in the wrong place, or
-- asked the wrong way, measured against the bank sheets and the programmes that read the answer.
-- The engine-side half (debts / duration / employment type on product-only names, the vehicle
-- model year) is code in the same change; this is the stored half.
--
--   1. LOAN DURATION: `repayment_period_months` max 120 → 300. Eight home-purchase programmes
--      run to 240 months; the question stopped the applicant at 120, so every mortgage was
--      quoted over half its term. Each programme still clamps to its own `tenor.maxMonths`.
--   2. NET INCOME: `monthly_income` read "إجمالي" (total/gross) while every DBR takes it as the
--      net salary. Reworded to net, with a helper for the business owner.
--   3. MILITARY GRADES: `general`, `senior_officer`, `officer` retired. App. A §11 prints seven
--      grades, and `general` was labelled "لواء" exactly like `grade_major_general` — 40,000
--      against 75,000 on ABK-PER-ARMED_FORCES, side by side on the Arabic app. Their rows leave
--      the programme's table, the `armed_forces_grades` product and the `armed_forces` name
--      rule (re-keyed to the seven), then the registry rows are deactivated so the question
--      stops offering them.
--   4. EMPLOYMENT TYPE IN CAR: `employment_status` assigned to car. CAE's car programmes cap a
--      self-employed buyer at 60 months; unasked, the app sent `salaried` for everyone.
--   5. LEAD DATA OPTIONAL: `down_payment`, `property_value`, `business_age` — required, read
--      by no programme. An answer that changes nothing must not block an applicant.
--   6. BUSINESS DEBTS ITEMISED: `current_loans` and its five amounts assigned to business, the
--      same flow as every other loan type; `current_facilities` (required yes/no, read by
--      nothing — "yes" with commitments of 0 went straight through) leaves business and is
--      deactivated.
--
-- The questionnaire snapshot is frozen: run `npx tsx scripts/publish-questionnaire.ts` after.
DO $$
DECLARE
  retired  text[] := ARRAY['general', 'senior_officer', 'officer'];
  debts    text[] := ARRAY['current_loans', 'obligation_car_loan', 'obligation_mortgage',
                           'credit_card_total_limit', 'obligation_personal_loan', 'obligation_other'];
  seven    jsonb := '[{"key":"grade_major_general","incomeEGP":"75000"},{"key":"grade_brigadier_general","incomeEGP":"60000"},{"key":"grade_colonel","incomeEGP":"45000"},{"key":"grade_lt_colonel","incomeEGP":"40000"},{"key":"grade_major","incomeEGP":"30000"},{"key":"grade_captain","incomeEGP":"28000"},{"key":"grade_first_lieutenant","incomeEGP":"18000"}]';
  n        integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "question" WHERE "code" = 'repayment_period_months') THEN
    RAISE NOTICE 'question_catalog_review: no questionnaire yet — fresh database, the seeds write all of this';
    RETURN;
  END IF;

  -- 1.
  UPDATE "question" SET "numericMaxValue" = 300, "updatedAt" = now()
   WHERE "code" = 'repayment_period_months' AND "numericMaxValue" < 300;

  -- 2. Only the seeded wording is replaced; an admin's own edit is left alone.
  UPDATE "question"
     SET "questionEn"   = 'What is your net monthly income?',
         "questionAr"   = 'ما صافي دخلك الشهري؟',
         "helperTextEn" = 'After tax and deductions. If you run a business, your profit after business costs.',
         "helperTextAr" = 'بعد الضرائب والاستقطاعات. لأصحاب الأنشطة: الربح بعد مصروفات النشاط.',
         "updatedAt"    = now()
   WHERE "code" = 'monthly_income' AND "questionAr" = 'ما إجمالي الدخل الشهري؟';

  -- 3. Nothing but the three places below may still read a retired grade.
  SELECT count(*) INTO n FROM "bank_program"
   WHERE "programCode" <> 'ABK-PER-ARMED_FORCES'
     AND ("incomeAssumption"::text || "loanLimits"::text || "pricing"::text || "tenor"::text)
         ~ '"key": "(general|senior_officer|officer)"';
  IF n > 0 THEN
    RAISE EXCEPTION 'question_catalog_review: % other programme(s) key a figure on a retired grade — refusing', n;
  END IF;

  UPDATE "bank_program"
     SET "incomeAssumption" = jsonb_set("incomeAssumption", '{stepParams,primary,keyTable}',
           (SELECT coalesce(jsonb_agg(e), '[]'::jsonb)
              FROM jsonb_array_elements("incomeAssumption"->'stepParams'->'primary'->'keyTable') e
             WHERE NOT (e->>'key' = ANY(retired)))),
         "valueSources" = "valueSources"
           - 'incomeAssumption.stepParams.primary.keyTable.general.incomeEGP'
           - 'incomeAssumption.stepParams.primary.keyTable.senior_officer.incomeEGP'
           - 'incomeAssumption.stepParams.primary.keyTable.officer.incomeEGP',
         "updatedAt" = now()
   WHERE "programCode" = 'ABK-PER-ARMED_FORCES'
     AND "incomeAssumption"->'stepParams'->'primary'->'keyTable' IS NOT NULL;

  UPDATE "platform_enumeration"
     SET "incomeRule" = jsonb_set("incomeRule", '{stepParams,primary,keyTable}',
           (SELECT coalesce(jsonb_agg(e), '[]'::jsonb)
              FROM jsonb_array_elements("incomeRule"->'stepParams'->'primary'->'keyTable') e
             WHERE NOT (e->>'key' = ANY(retired)))),
         "updatedAt" = now()
   WHERE "type" = 'surrogate_product' AND "key" = 'armed_forces_grades'
     AND "incomeRule"->'stepParams'->'primary'->'keyTable' IS NOT NULL;

  UPDATE "platform_enumeration"
     SET "incomeRule" = jsonb_set("incomeRule", '{keyTable}', seven), "updatedAt" = now()
   WHERE "type" = 'program_name' AND "key" = 'armed_forces'
     AND "incomeRule"->'keyTable' IS NOT NULL
     AND "incomeRule"::text ~ '"key": "(general|senior_officer|officer)"';

  UPDATE "platform_enumeration"
     SET "active" = false, "deprecatedAt" = coalesce("deprecatedAt", now()), "updatedAt" = now()
   WHERE "type" = 'military_grade' AND "key" = ANY(retired) AND "active";
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'question_catalog_review: % military grade(s) retired', n;

  -- 4.
  INSERT INTO "question_loan_category" ("questionId", "category", "displayOrder")
  SELECT "id", 'car', 0 FROM "question" WHERE "code" = 'employment_status'
  ON CONFLICT ("questionId", "category") DO NOTHING;

  -- 5.
  UPDATE "question" SET "isRequired" = false, "updatedAt" = now()
   WHERE "code" IN ('down_payment', 'property_value', 'business_age') AND "isRequired";

  -- 6. The five amounts are gated on `current_loans`, so the source goes in with them.
  INSERT INTO "question_loan_category" ("questionId", "category", "displayOrder")
  SELECT "id", 'business', 0 FROM "question" WHERE "code" = ANY(debts)
  ON CONFLICT ("questionId", "category") DO NOTHING;
  DELETE FROM "question_loan_category" c USING "question" q
   WHERE q."id" = c."questionId" AND q."code" = 'current_facilities' AND c."category" = 'business';
  UPDATE "question" q SET "isActive" = false, "updatedAt" = now()
   WHERE q."code" = 'current_facilities' AND q."isActive"
     AND NOT EXISTS (SELECT 1 FROM "question_loan_category" c WHERE c."questionId" = q."id");

  -- END STATE, ASSERTED.
  IF EXISTS (SELECT 1 FROM "question" WHERE "code" = 'repayment_period_months' AND "numericMaxValue" < 240) THEN
    RAISE EXCEPTION 'question_catalog_review: the duration still stops short of the 240-month programmes';
  END IF;
  IF EXISTS (SELECT 1 FROM "platform_enumeration" WHERE "type" = 'military_grade' AND "key" = ANY(retired) AND "active")
     OR EXISTS (SELECT 1 FROM "bank_program" WHERE "incomeAssumption"::text ~ '"key": "(general|senior_officer|officer)"')
     OR EXISTS (SELECT 1 FROM "platform_enumeration"
                 WHERE "type" IN ('surrogate_product', 'program_name')
                   AND coalesce("incomeRule"::text, '') ~ '"key": "(general|senior_officer|officer)"') THEN
    RAISE EXCEPTION 'question_catalog_review: a retired military grade is still live or still keys a figure';
  END IF;
  SELECT count(*) INTO n FROM "question_loan_category" c JOIN "question" q ON q."id" = c."questionId"
   WHERE c."category" = 'business' AND q."code" = ANY(debts);
  IF n <> cardinality(debts) THEN
    RAISE EXCEPTION 'question_catalog_review: only % of % debt questions are asked in business', n, cardinality(debts);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "question_loan_category" c JOIN "question" q ON q."id" = c."questionId"
                  WHERE c."category" = 'car' AND q."code" = 'employment_status') THEN
    RAISE EXCEPTION 'question_catalog_review: employment_status is not asked in car';
  END IF;
END $$;
