-- The car questionnaire asks every debt it offers, and stops asking what no car programme reads.
--
-- (1) THE DEBT AMOUNTS. `current_loans` in car offers car loan / mortgage / credit cards, but
--     their amount questions (`obligation_car_loan`, `obligation_mortgage`,
--     `credit_card_total_limit`) were never assigned to car — `seed-questionnaire.ts`'s
--     `CAR_ASKS` carried only `obligation_personal_loan` and `obligation_other`. The app skips
--     an unasked amount, so a car applicant's car loan, mortgage and card counted as ZERO in the
--     debt burden: over-lending. Assigned to car here. Each is gated on its own `current_loans`
--     pick, so nobody sees one that does not apply. Car position 0, like the two siblings
--     already there; ties break on the pool order, which puts all five in the personal order.
--
-- (2) THE UNREAD QUESTIONS, taken off car:
--       car_insurance, vehicle_condition — no car programme's grid, and no product's
--         calculation or plan table, reads either (a reserved fact is served on every car name
--         whether read or not, which is why they were asked). Both are car-only, so they are
--         then assigned to nothing and are deactivated with their `surrogate_fact` rows, so a
--         grid picker stops offering an axis no applicant is asked;
--       which_club_branch_is_your_membership_at — its gate `club_membership` is personal-only,
--         so in car it could never be shown;
--       existing_bank_loans, existing_bank_products — read only through `loan_is_topup` /
--         `holds_other_product`, by the compound-owner product and the doctors' clinic
--         programme, both personal.
--     And the auto product `down_payment_income` loses its operator asks for `car_insurance`,
--     `vehicle_condition`, `car_dealer`, `car_model_year`: none of its programmes reads them, so
--     its "Questions the engine needs" list stops naming them. (`car_dealer` and
--     `car_model_year` STAY asked in car — the CAE new/used term grids read them.)
--
-- The assignment is frozen into the published questionnaire snapshot, so the app sees it
-- only after the next publish: run `npx tsx scripts/publish-questionnaire.ts` after deploy.
DO $$
DECLARE
  added     text[] := ARRAY['obligation_car_loan', 'obligation_mortgage', 'credit_card_total_limit'];
  unread    text[] := ARRAY['car_insurance', 'vehicle_condition', 'which_club_branch_is_your_membership_at',
                            'existing_bank_loans', 'existing_bank_products'];
  -- Every fact key an unread question feeds, including the two bank axes derived from them.
  unread_facts text[] := ARRAY['car_insurance', 'vehicle_condition', 'club_branch',
                               'loan_is_topup', 'holds_other_product',
                               'existing_bank_loans', 'existing_bank_products'];
  n         integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "question" WHERE "code" = 'current_loans') THEN
    RAISE NOTICE 'car_questions_debts_and_unread: no questionnaire yet — fresh database, seed:questionnaire assigns these';
    RETURN;
  END IF;

  -- (1) needs its gate source asked in car, or the three would be gated on nothing shown.
  IF NOT EXISTS (SELECT 1 FROM "question_loan_category" c JOIN "question" q ON q."id" = c."questionId"
                  WHERE q."code" = 'current_loans' AND c."category" = 'car') THEN
    RAISE EXCEPTION 'car_questions_debts_and_unread: current_loans is not asked in car — the debt amounts would have no gate';
  END IF;
  SELECT count(*) INTO n FROM "question" WHERE "code" = ANY(added) AND "isActive";
  IF n <> cardinality(added) THEN
    RAISE EXCEPTION 'car_questions_debts_and_unread: expected % active debt-amount questions, found %', cardinality(added), n;
  END IF;

  -- (2) is only safe while nothing sold in car reads one of these facts.
  SELECT count(*) INTO n FROM "bank_program"
   WHERE "productCategory" = 'car'
     AND ("loanLimits"::text || "pricing"::text || "tenor"::text || "eligibility"::text
          || coalesce("incomeAssumption"::text, '') || "valueSources"::text || coalesce("fees"::text, ''))
         ~ ('"(' || array_to_string(unread_facts, '|') || ')"');
  IF n > 0 THEN
    RAISE EXCEPTION 'car_questions_debts_and_unread: % car programme(s) read one of % — refusing', n, unread_facts;
  END IF;

  SELECT count(*) INTO n
    FROM "platform_enumeration" p
   WHERE p."type" = 'surrogate_product'
     AND p."key" IN (SELECT DISTINCT e."surrogateProductKey" FROM "platform_enumeration" e
                      JOIN "bank_program" b ON b."programNameKey" = e."key"
                     WHERE e."type" = 'program_name' AND b."productCategory" = 'car')
     AND (coalesce(p."incomeRule"::text, '') || coalesce(p."planDefaults"::text, '')
          || coalesce(p."capDefaults"::text, '') || coalesce(p."rateDefaults"::text, '')
          || coalesce(p."tenorDefaults"::text, '') || coalesce(p."loanAmountDefaults"::text, ''))
         ~ ('"(' || array_to_string(unread_facts, '|') || ')"');
  IF n > 0 THEN
    RAISE EXCEPTION 'car_questions_debts_and_unread: % product(s) sold in car read one of % — refusing', n, unread_facts;
  END IF;

  -- (1)
  INSERT INTO "question_loan_category" ("questionId", "category", "displayOrder")
  SELECT q."id", 'car', 0 FROM "question" q WHERE q."code" = ANY(added)
  ON CONFLICT ("questionId", "category") DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'car_questions_debts_and_unread: % debt amount(s) now asked in car', n;

  -- (2) the product's asks
  DELETE FROM "surrogate_product_ask" a
   USING "platform_enumeration" f, "platform_enumeration" p
   WHERE f."id" = a."factId" AND p."id" = a."productId"
     AND p."type" = 'surrogate_product' AND p."key" = 'down_payment_income'
     AND f."key" IN ('car_insurance', 'vehicle_condition', 'car_dealer', 'car_model_year');
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'car_questions_debts_and_unread: % ask(s) removed from down_payment_income', n;

  -- (2) the car assignments
  DELETE FROM "question_loan_category" c
   USING "question" q
   WHERE q."id" = c."questionId" AND q."code" = ANY(unread) AND c."category" = 'car';
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'car_questions_debts_and_unread: % car assignment(s) removed', n;

  -- (2) the two car-only questions, now assigned to nothing, and their facts
  UPDATE "question" q SET "isActive" = false, "updatedAt" = now()
   WHERE q."code" IN ('car_insurance', 'vehicle_condition') AND q."isActive"
     AND NOT EXISTS (SELECT 1 FROM "question_loan_category" c WHERE c."questionId" = q."id");
  UPDATE "platform_enumeration" SET "active" = false, "updatedAt" = now()
   WHERE "type" = 'surrogate_fact' AND "key" IN ('car_insurance', 'vehicle_condition') AND "active"
     AND NOT EXISTS (SELECT 1 FROM "surrogate_product_ask" a
                      WHERE a."factId" = "platform_enumeration"."id" AND a."detachedAt" IS NULL);

  -- END STATE, ASSERTED.
  SELECT count(*) INTO n FROM "question_loan_category" c JOIN "question" q ON q."id" = c."questionId"
   WHERE q."code" = ANY(added) AND c."category" = 'car';
  IF n <> cardinality(added) THEN
    RAISE EXCEPTION 'car_questions_debts_and_unread: only % of % debt amounts are asked in car', n, cardinality(added);
  END IF;
  IF EXISTS (SELECT 1 FROM "question_loan_category" c JOIN "question" q ON q."id" = c."questionId"
              WHERE q."code" = ANY(unread) AND c."category" = 'car') THEN
    RAISE EXCEPTION 'car_questions_debts_and_unread: an unread question is still asked in car';
  END IF;
  IF EXISTS (SELECT 1 FROM "question_loan_category" c JOIN "question" q ON q."id" = c."questionId"
              WHERE q."code" IN ('car_dealer', 'car_model_year') AND c."category" = 'car')
     IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'car_questions_debts_and_unread: car_dealer / car_model_year must stay asked in car';
  END IF;
END $$;
