-- Question-catalog review, the cleanups that move no offer (v30.5.0).
--
--   1. The four "other income" amounts (`rental_income_monthly`, `cd_returns_monthly`,
--      `fixed_allowances_monthly`, `variable_allowances_monthly`) become asks of
--      `doctors_in_practice`, the one product whose programme (ABK-PER-DOCTORS_PRACTICE,
--      `additionalIncome`) weighs them. With no product asking their facts, the scope rule's
--      "no product asks it" clause kept all four — and their `additional_income` gate — on
--      every payslip name. Inserted as `blueprint` asks, exactly what `seed:blueprints` writes
--      from the same declaration, so a re-run of that seed writes nothing.
--   2. `wants_insurance` is active and assigned to no loan type (asked by nobody): deactivated,
--      as `seed-questionnaire.ts` now does.
--   3. An INACTIVE question still assigned to a loan type loses the assignment
--      (`how_often_would_you_repay`, personal).
--   4. A `surrogate_fact` bound to an inactive question and asked by no product is deactivated
--      (`unit_approved_compound`, left behind when the car sheet conditions went).
--
-- Snapshot frozen: run `npx tsx scripts/publish-questionnaire.ts` after.
DO $$
DECLARE
  product_id text;
  facts      text[] := ARRAY['rental_income_monthly', 'cd_returns_monthly',
                             'fixed_allowances_monthly', 'variable_allowances_monthly'];
  n          integer;
BEGIN
  -- 1.
  SELECT "id" INTO product_id FROM "platform_enumeration"
   WHERE "type" = 'surrogate_product' AND "key" = 'doctors_in_practice';
  IF product_id IS NULL THEN
    RAISE NOTICE 'question_scope_cleanups: no doctors_in_practice product — seed:blueprints records the asks';
  ELSE
    INSERT INTO "surrogate_product_ask" ("productId", "factId", "source")
    SELECT product_id, f."id", 'blueprint'
      FROM "platform_enumeration" f
     WHERE f."type" = 'surrogate_fact' AND f."key" = ANY(facts)
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE NOTICE 'question_scope_cleanups: % other-income ask(s) recorded on doctors_in_practice', n;
  END IF;

  -- 2.
  UPDATE "question" q SET "isActive" = false, "updatedAt" = now()
   WHERE q."code" = 'wants_insurance' AND q."isActive"
     AND NOT EXISTS (SELECT 1 FROM "question_loan_category" c WHERE c."questionId" = q."id");

  -- 3.
  DELETE FROM "question_loan_category" c USING "question" q
   WHERE q."id" = c."questionId" AND NOT q."isActive";
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'question_scope_cleanups: % assignment(s) of inactive questions removed', n;

  -- 4.
  UPDATE "platform_enumeration" f SET "active" = false, "updatedAt" = now()
   WHERE f."type" = 'surrogate_fact' AND f."active"
     AND f."key" = 'unit_approved_compound'
     AND NOT EXISTS (SELECT 1 FROM "question" q WHERE q."id" = f."boundQuestionId" AND q."isActive")
     AND NOT EXISTS (SELECT 1 FROM "surrogate_product_ask" a WHERE a."factId" = f."id" AND a."detachedAt" IS NULL);

  -- END STATE, ASSERTED.
  IF EXISTS (SELECT 1 FROM "question_loan_category" c JOIN "question" q ON q."id" = c."questionId"
              WHERE NOT q."isActive") THEN
    RAISE EXCEPTION 'question_scope_cleanups: an inactive question is still assigned';
  END IF;
  IF product_id IS NOT NULL AND (
       SELECT count(*) FROM "surrogate_product_ask" a JOIN "platform_enumeration" f ON f."id" = a."factId"
        -- A row an operator untick tombstoned still counts: that untick is theirs to keep.
        WHERE a."productId" = product_id AND f."key" = ANY(facts)
     ) <> (SELECT count(*) FROM "platform_enumeration" WHERE "type" = 'surrogate_fact' AND "key" = ANY(facts)) THEN
    RAISE EXCEPTION 'question_scope_cleanups: an other-income fact is not asked by doctors_in_practice';
  END IF;
END $$;
