-- The two dead lookup lists go (v30.5.1): "Units owned" (`unit_count_owned`) and the retired
-- "Unit ownership" (`unit_ownership_share`), each with its switched-off question.
--
--   unit_count_owned — values `unit_one` / `unit_more_than_one`, question
--     `do_you_own_more_than_one_unit`. Its ask on `compound_owner` was detached on 2026-09-03
--     and the question switched off, so nobody has been asked it since, and its one reader —
--     ABK's "+10% for more than one unit" (`ABK-PER-COMPOUND_OWNER.loanLimits.maxLoanAdjustments`)
--     — could never fire. Operator's call (2026-09-25): remove the list AND that rule rather than
--     revive the question. The product's `templateSpec.uplift` named it too; `scope: maxLoan`
--     compiles to nothing, so the product's `incomeRule` is untouched. The adjustment also named
--     a fact the registry drops (its question is inactive), so every save of the ABK programme was
--     refused `MAX_LOAN_BY_FACT_INVALID adjustment_unknown_fact`; that stops.
--   unit_ownership_share — values `joint_sole` / `joint_shared`, question
--     `do_you_own_the_unit_with_someone_else`. Retired when the percentage question
--     `unit_owned_share_pct` replaced it (v23.1.0): no fact row, no reader, no code since.
--
-- The seeds follow: the blueprint no longer declares the ask or the uplift, and
-- `sheet-programs.ts` no longer gives ABK the adjustment. So the key is REMOVED here, never left
-- as `[]` — the seed's own row carries no key, and `seed:sheet-figures` would otherwise see a
-- difference and rewrite the programme. A question is deleted only while unanswered; an answered
-- one is left inactive, with its options, so a stored answer keeps its label.
--
-- Nothing served changes: both questions were already inactive and out of the published
-- questionnaire. If a NOTICE below says one was still active on this database, run
-- `npx tsx scripts/publish-questionnaire.ts` after.
DO $$
DECLARE
  lists     text[] := ARRAY['unit_count_owned', 'unit_ownership_share'];
  questions text[] := ARRAY['do_you_own_more_than_one_unit', 'do_you_own_the_unit_with_someone_else'];
  -- The fact key and every value key this takes away, as a quoted JSON string.
  dropped   text   := '"(unit_count_owned|unit_one|unit_more_than_one|joint_sole|joint_shared)"';
  n         integer;
  q         record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "enumeration_type_def" WHERE "key" = ANY(lists))
     AND NOT EXISTS (SELECT 1 FROM "platform_enumeration"
                      WHERE "type" = ANY(lists)
                         OR ("type" = 'surrogate_fact' AND "key" = 'unit_count_owned'))
     AND NOT EXISTS (SELECT 1 FROM "question" WHERE "code" = ANY(questions))
     AND NOT EXISTS (SELECT 1 FROM "bank_program"
                      WHERE "loanLimits"->'maxLoanAdjustments' @> '[{"whenFactKey": "unit_count_owned"}]')
     AND NOT EXISTS (SELECT 1 FROM "platform_enumeration"
                      WHERE "templateSpec"->'uplift'->>'fact' = 'unit_count_owned') THEN
    RAISE NOTICE 'remove_unit_count_lists: nothing to remove';
    RETURN;
  END IF;

  -- GUARDS — every one before any write.

  -- The adjustment is ABK's, and nobody else's.
  SELECT count(*) INTO n FROM "bank_program"
   WHERE "programCode" <> 'ABK-PER-COMPOUND_OWNER'
     AND "loanLimits"->'maxLoanAdjustments' @> '[{"whenFactKey": "unit_count_owned"}]';
  IF n > 0 THEN
    RAISE EXCEPTION 'remove_unit_count_lists: % programme(s) besides ABK-PER-COMPOUND_OWNER adjust on unit_count_owned — refusing', n;
  END IF;

  -- No bank programme reads a removed key anywhere else: its answer would silently stop matching.
  SELECT count(*) INTO n FROM "bank_program" b
   WHERE ((CASE WHEN jsonb_typeof(b."loanLimits"->'maxLoanAdjustments') = 'array'
                THEN jsonb_set(b."loanLimits", '{maxLoanAdjustments}',
                       coalesce((SELECT jsonb_agg(e.adj)
                                   FROM jsonb_array_elements(b."loanLimits"->'maxLoanAdjustments') AS e(adj)
                                  WHERE e.adj->>'whenFactKey' IS DISTINCT FROM 'unit_count_owned'),
                                '[]'::jsonb))
                ELSE b."loanLimits" END)::text
          || b."pricing"::text || b."tenor"::text || b."eligibility"::text
          || b."incomeAssumption"::text || b."fees"::text || b."valueSources"::text
          || coalesce(b."performanceCriteria"::text, '')) ~ dropped;
  IF n > 0 THEN
    RAISE EXCEPTION 'remove_unit_count_lists: % programme(s) read a removed key — refusing', n;
  END IF;

  -- The uplift is compound_owner's, and no product, name or fact reads a removed key otherwise.
  SELECT count(*) INTO n FROM "platform_enumeration"
   WHERE "templateSpec"->'uplift'->>'fact' = 'unit_count_owned'
     AND NOT ("type" = 'surrogate_product' AND "key" = 'compound_owner');
  IF n > 0 THEN
    RAISE EXCEPTION 'remove_unit_count_lists: % product(s) besides compound_owner uplift on unit_count_owned — refusing', n;
  END IF;
  SELECT count(*) INTO n FROM "platform_enumeration" p
   WHERE (coalesce(p."incomeRule"::text, '')
          || coalesce((CASE WHEN p."templateSpec"->'uplift'->>'fact' = 'unit_count_owned'
                            THEN p."templateSpec" - 'uplift'
                            ELSE p."templateSpec" END)::text, '')
          || coalesce(p."capDefaults"::text, '') || coalesce(p."tenorDefaults"::text, '')
          || coalesce(p."planDefaults"::text, '') || coalesce(p."loanAmountDefaults"::text, '')
          || coalesce(p."iScoreDefaults"::text, '') || coalesce(p."rateDefaults"::text, '')
          || p."valueSources"::text) ~ dropped;
  IF n > 0 THEN
    RAISE EXCEPTION 'remove_unit_count_lists: % product/name/fact row(s) read a removed key — refusing', n;
  END IF;

  -- Only compound_owner ever asked the fact.
  SELECT count(*) INTO n FROM "surrogate_product_ask" a
    JOIN "platform_enumeration" f ON f."id" = a."factId"
    JOIN "platform_enumeration" p ON p."id" = a."productId"
   WHERE f."type" = 'surrogate_fact' AND f."key" = 'unit_count_owned'
     AND NOT (p."type" = 'surrogate_product' AND p."key" = 'compound_owner');
  IF n > 0 THEN
    RAISE EXCEPTION 'remove_unit_count_lists: % other product(s) ask unit_count_owned — refusing', n;
  END IF;

  -- Nothing hangs off either question or either list.
  IF EXISTS (SELECT 1 FROM "question" WHERE "enabledWhen"->>'questionCode' = ANY(questions)) THEN
    RAISE EXCEPTION 'remove_unit_count_lists: a question is gated on one of % — refusing', questions;
  END IF;
  IF EXISTS (SELECT 1 FROM "enumeration_type_def" WHERE "parentTypeKey" = ANY(lists)) THEN
    RAISE EXCEPTION 'remove_unit_count_lists: a list is filed under one of % — refusing', lists;
  END IF;

  -- WRITES.

  -- 1. ABK's adjustment. The key goes with its last entry.
  UPDATE "bank_program" b
     SET "loanLimits" = CASE
           WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(b."loanLimits"->'maxLoanAdjustments') AS e(adj)
                         WHERE e.adj->>'whenFactKey' IS DISTINCT FROM 'unit_count_owned')
             THEN jsonb_set(b."loanLimits", '{maxLoanAdjustments}',
                    (SELECT jsonb_agg(e.adj ORDER BY e.i)
                       FROM jsonb_array_elements(b."loanLimits"->'maxLoanAdjustments')
                            WITH ORDINALITY AS e(adj, i)
                      WHERE e.adj->>'whenFactKey' IS DISTINCT FROM 'unit_count_owned'))
           ELSE b."loanLimits" - 'maxLoanAdjustments'
         END,
         -- Bumped as `20260905120100` bumps: a browser holding the pre-deploy row must not save
         -- over this on optimistic lock.
         "version" = b."version" + 1,
         "updatedAt" = now()
   WHERE b."loanLimits"->'maxLoanAdjustments' @> '[{"whenFactKey": "unit_count_owned"}]';
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'remove_unit_count_lists: multi-unit adjustment removed from % programme(s)', n;

  -- 2. The product's uplift.
  UPDATE "platform_enumeration"
     SET "templateSpec" = "templateSpec" - 'uplift', "updatedAt" = now()
   WHERE "templateSpec"->'uplift'->>'fact' = 'unit_count_owned';
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'remove_unit_count_lists: multi-unit uplift removed from % product(s)', n;

  -- 3. The fact. Its (tombstoned) ask cascades with it.
  DELETE FROM "platform_enumeration" WHERE "type" = 'surrogate_fact' AND "key" = 'unit_count_owned';
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'remove_unit_count_lists: % fact row(s) deleted', n;

  -- 4. The values. `type` carries no FK to the list, so they go explicitly.
  DELETE FROM "platform_enumeration" WHERE "type" = ANY(lists);
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'remove_unit_count_lists: % value(s) deleted', n;

  -- 5. The lists.
  DELETE FROM "enumeration_type_def" WHERE "key" = ANY(lists);
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'remove_unit_count_lists: % list(s) deleted', n;

  -- 6. The questions: deleted while unanswered (options cascade), otherwise left inactive and
  --    assigned to nothing.
  FOR q IN SELECT "id", "code", "isActive" FROM "question" WHERE "code" = ANY(questions) LOOP
    IF q."isActive" THEN
      RAISE NOTICE 'remove_unit_count_lists: % was still ACTIVE here — run publish-questionnaire after', q."code";
    END IF;
    IF EXISTS (SELECT 1 FROM "application_answer" WHERE "questionId" = q."id") THEN
      UPDATE "question" SET "isActive" = false, "updatedAt" = now() WHERE "id" = q."id";
      DELETE FROM "question_loan_category" WHERE "questionId" = q."id";
      RAISE NOTICE 'remove_unit_count_lists: % is answered — left inactive, not deleted', q."code";
    ELSE
      DELETE FROM "question" WHERE "id" = q."id";
      RAISE NOTICE 'remove_unit_count_lists: % deleted', q."code";
    END IF;
  END LOOP;

  -- END STATE, ASSERTED.
  IF EXISTS (SELECT 1 FROM "enumeration_type_def" WHERE "key" = ANY(lists))
     OR EXISTS (SELECT 1 FROM "platform_enumeration"
                 WHERE "type" = ANY(lists)
                    OR ("type" = 'surrogate_fact' AND "key" = 'unit_count_owned')) THEN
    RAISE EXCEPTION 'remove_unit_count_lists: a list, value or fact row survived';
  END IF;
  IF EXISTS (SELECT 1 FROM "bank_program"
              WHERE ("loanLimits"::text || "pricing"::text || "tenor"::text || "eligibility"::text
                     || "incomeAssumption"::text || "fees"::text || "valueSources"::text
                     || coalesce("performanceCriteria"::text, '')) ~ dropped) THEN
    RAISE EXCEPTION 'remove_unit_count_lists: a bank programme still names a removed key';
  END IF;
  IF EXISTS (SELECT 1 FROM "platform_enumeration"
              WHERE (coalesce("incomeRule"::text, '') || coalesce("templateSpec"::text, '')
                     || coalesce("capDefaults"::text, '') || coalesce("tenorDefaults"::text, '')
                     || coalesce("planDefaults"::text, '') || coalesce("loanAmountDefaults"::text, '')
                     || coalesce("iScoreDefaults"::text, '') || coalesce("rateDefaults"::text, '')
                     || "valueSources"::text) ~ dropped) THEN
    RAISE EXCEPTION 'remove_unit_count_lists: a product, name or fact still names a removed key';
  END IF;
  IF EXISTS (SELECT 1 FROM "bank_program"
              WHERE "programCode" = 'ABK-PER-COMPOUND_OWNER'
                AND "loanLimits"->'maxLoanAdjustments' = '[]'::jsonb) THEN
    RAISE EXCEPTION 'remove_unit_count_lists: ABK-PER-COMPOUND_OWNER was left an empty adjustment list';
  END IF;
  IF EXISTS (SELECT 1 FROM "platform_enumeration"
              WHERE "type" = 'surrogate_product' AND "key" = 'compound_owner'
                AND "templateSpec" IS NOT NULL AND NOT ("templateSpec" ? 'primary')) THEN
    RAISE EXCEPTION 'remove_unit_count_lists: compound_owner lost its calculation';
  END IF;
END $$;
