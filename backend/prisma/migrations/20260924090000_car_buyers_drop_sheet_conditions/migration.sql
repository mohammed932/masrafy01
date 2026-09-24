-- The auto product `down_payment_income` ("Car Buyers — Down Payment or Savings") stops
-- carrying the four Suez Canal sheet conditions, and car applicants stop being asked the
-- three questions only those conditions read.
--
-- WHY. All four were opened to every answer on the product screen on 2026-09-23
-- (business `under_12m`…`not_self_employed`, licence `yes`/`no`/`not_self_employed`, home
-- every option, compound `yes`/`no`/`no_unit`). An allow-list that accepts every answer
-- refuses nobody — its only remaining effect was to refuse an UNANSWERED fact, which made
-- every car applicant answer a commercial register, a tax card, a business age and a compound
-- question about a car loan. The operator chose removal (2026-09-24).
--
-- WHAT GOES:
--   1. the four entries in the product's `templateSpec.conditions` and the four compiled
--      `cond__*` gates in its `incomeRule` — the calculation's steps and output are untouched,
--      so no quote an applicant who answered all four could get moves;
--   2. the product's asks for `business_months`, `self_employed_licence`,
--      `unit_approved_compound` (deleted, not tombstoned: the blueprint no longer declares
--      them, so there is nothing for a re-seed to revive);
--   3. the `car` assignment of those three questions. `personal` keeps the first two — the
--      compound-owner product reads them there. `unit_approved_compound` is then assigned to
--      nothing and is deactivated, as `seed-questionnaire.ts` would.
--
-- WHAT STAYS: `home_ownership`. The car financed-share table (`ltvCeilingByFact`, the
-- 20–30% deposit band) reads it, on the product's plan table and on bank programmes — it
-- was never only a condition.
--
-- The assignment is frozen into the published questionnaire snapshot, so the app sees it
-- only after the next publish: run `npx tsx scripts/publish-questionnaire.ts` after deploy.
DO $$
DECLARE
  product_id text;
  dropped    text[] := ARRAY['business_months', 'self_employed_licence', 'unit_approved_compound'];
  cond_ids   text[] := ARRAY['businessoldenough', 'selfemployedpapers', 'homeowned', 'unitinapprovedcompound'];
  n          integer;
BEGIN
  SELECT "id" INTO product_id FROM "platform_enumeration"
   WHERE "type" = 'surrogate_product' AND "key" = 'down_payment_income';
  IF product_id IS NULL THEN
    RAISE NOTICE 'car_buyers_drop_sheet_conditions: no down_payment_income product — fresh database, the blueprint mints it without them';
    RETURN;
  END IF;

  -- A car programme reading one of the three facts through its OWN rows would lose its
  -- question here. None does today; if one does, removing the question is the wrong change.
  SELECT count(*) INTO n FROM "bank_program"
   WHERE "productCategory" = 'car'
     AND ("loanLimits"::text || "pricing"::text || "tenor"::text || "eligibility"::text
          || coalesce("incomeAssumption"::text, '') || "valueSources"::text)
         ~ '"(business_months|self_employed_licence|unit_approved_compound)"';
  IF n > 0 THEN
    RAISE EXCEPTION 'car_buyers_drop_sheet_conditions: % car programme(s) read one of % — refusing to unassign it', n, dropped;
  END IF;

  -- Any OTHER product asking one of the three for car keeps it asked; only compound_owner
  -- (personal) is expected.
  SELECT count(*) INTO n
    FROM "surrogate_product_ask" a
    JOIN "platform_enumeration" f ON f."id" = a."factId"
   WHERE f."key" = ANY(dropped) AND a."productId" <> product_id AND a."detachedAt" IS NULL
     AND a."productId" NOT IN (SELECT "id" FROM "platform_enumeration"
                                WHERE "type" = 'surrogate_product' AND "key" = 'compound_owner');
  IF n > 0 THEN
    RAISE EXCEPTION 'car_buyers_drop_sheet_conditions: % other product ask(s) read one of % — not written for that', n, dropped;
  END IF;

  -- A question gated on one of the three would turn unconditionally visible (a dangling gate
  -- never hides its target). None is today.
  IF EXISTS (SELECT 1 FROM "question" WHERE "enabledWhen"->>'questionCode' = ANY(dropped)) THEN
    RAISE EXCEPTION 'car_buyers_drop_sheet_conditions: a question is gated on one of % — refusing', dropped;
  END IF;

  -- 1. The calculation.
  UPDATE "platform_enumeration"
     SET "templateSpec" = CASE
           -- An empty list, never an absent key: `TemplateSpec.conditions` is required, and
           -- every other product stores `[]` (and `gates: []` below).
           WHEN "templateSpec" ? 'conditions' THEN
             jsonb_set("templateSpec", '{conditions}', coalesce(
               (SELECT jsonb_agg(c) FROM jsonb_array_elements("templateSpec"->'conditions') c
                 WHERE NOT (c->>'id' = ANY(cond_ids))), '[]'::jsonb))
           ELSE "templateSpec" END,
         "incomeRule" = CASE
           WHEN "incomeRule" ? 'gates' THEN
             jsonb_set("incomeRule", '{gates}', coalesce(
               (SELECT jsonb_agg(g) FROM jsonb_array_elements("incomeRule"->'gates') g
                 WHERE NOT (g->>'id' = ANY(SELECT 'cond__' || x FROM unnest(cond_ids) x))), '[]'::jsonb))
           ELSE "incomeRule" END,
         "updatedAt" = now()
   WHERE "id" = product_id;

  -- 2. The asks.
  DELETE FROM "surrogate_product_ask" a
   USING "platform_enumeration" f
   WHERE f."id" = a."factId" AND a."productId" = product_id AND f."key" = ANY(dropped);
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'car_buyers_drop_sheet_conditions: % ask(s) removed', n;

  -- 3. The car assignment.
  DELETE FROM "question_loan_category" c
   USING "question" q
   WHERE q."id" = c."questionId" AND q."code" = ANY(dropped) AND c."category" = 'car';
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'car_buyers_drop_sheet_conditions: % car assignment(s) removed', n;

  UPDATE "question" q SET "isActive" = false, "updatedAt" = now()
   WHERE q."code" = 'unit_approved_compound' AND q."isActive"
     AND NOT EXISTS (SELECT 1 FROM "question_loan_category" c WHERE c."questionId" = q."id");

  -- END STATE, ASSERTED.
  IF EXISTS (SELECT 1 FROM "platform_enumeration" WHERE "id" = product_id
              AND ("templateSpec"::text ~ '"(businessoldenough|selfemployedpapers|homeowned|unitinapprovedcompound)"'
                   OR coalesce("incomeRule"::text, '') ~ 'cond__(businessoldenough|selfemployedpapers|homeowned|unitinapprovedcompound)')) THEN
    RAISE EXCEPTION 'car_buyers_drop_sheet_conditions: a condition survived on the product';
  END IF;
  IF EXISTS (SELECT 1 FROM "question_loan_category" c JOIN "question" q ON q."id" = c."questionId"
              WHERE q."code" = ANY(dropped) AND c."category" = 'car') THEN
    RAISE EXCEPTION 'car_buyers_drop_sheet_conditions: a dropped question is still asked for car';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "question_loan_category" c JOIN "question" q ON q."id" = c."questionId"
                  WHERE q."code" = 'home_ownership' AND c."category" = 'car')
     AND EXISTS (SELECT 1 FROM "question" WHERE "code" = 'home_ownership') THEN
    RAISE EXCEPTION 'car_buyers_drop_sheet_conditions: home_ownership is no longer asked for car — the financed-share table reads it';
  END IF;
END $$;
