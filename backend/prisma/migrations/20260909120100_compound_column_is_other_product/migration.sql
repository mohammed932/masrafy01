-- FABMISR's X-SELL figures stop being read as a top-up column.
--
-- App. B's FABMISR compound sheet splits its down-payment brackets by X-SELL — the client
-- holds another product, a credit card with a limit of at least 100,000 — and spec §10.3 is
-- explicit that this is a DIFFERENT question from new-loan/top-up. Its four figures were
-- filed in a top-up column, so an applicant holding a card and no ABK loan was quoted the
-- X-SELL row as though they were topping a loan up. The programme's own "notes" said so, in
-- as many words, for three versions.
--
-- WHAT WAS WRONG WAS ONE COLUMN REACHING EVERY WAY, NOT THE COLUMN.
--
-- The product declared "secondColumn" at PRODUCT level, so all five ways got the same axis.
-- Two of them genuinely have a new-loan/top-up column and the catalog seeds both of its
-- sides: the class table (spec §7's own worked example) and the unit-type table, whose two
-- sets differ (2M/3M/4M against 3M/3.5M/4.5M). Deleting the product column outright would
-- have thrown those away. So each way now carries the column its own sheet prints:
--
--   class table       -> loan_is_topup        (kept, spec §7)
--   bracket table     -> holds_other_product  (THE FIX, FABMISR's sheet)
--   unit-type table   -> loan_is_topup        (kept, two different figure sets)
--   share of paid     -> no column            (both copies held 15%, identical to the
--                                              standard column beside them, so the column
--                                              stated nothing)
--   share of deposit  -> no column            (states no figures at all)
--
-- THREE figure slots move. The second and third were found by querying the database and the
-- catalog rather than by reading one seed file:
--
--   alt__top_up                    -> alt__other_product_held   RENAMED  (bank + catalog)
--   alt__unit_paid_to_date__top_up -> dropped                            (bank + catalog)
--
-- The dropped one is asserted equal to the standard column beside it before it goes, not
-- assumed: if it ever differs, this migration refuses rather than discarding a figure
-- somebody chose.
--
-- WHY THE SPEC AND THE RULE ARE PASTED. They are the compiler's own output for the blueprint
-- this commit ships, written in the SAME statement as the figures they re-key, so there is no
-- window in which a programme names a column its product does not have. The v27.1.0
-- precedent (20260909090000) does exactly this, for the same reason.
--
-- AND WHY stepParams IS MERGED RATHER THAN REPLACED. The compiled rule carries STRUCTURE and
-- no figures. Writing it whole wipes the product's own defaults — its I-Score tiers among
-- them — which is the wipe v26.2.0 records hitting through a figures-only PUT. Every figure
-- the product holds is carried across and only the structure is replaced.

DO $$
DECLARE
  product_id text;
  stored_params jsonb;
  legacy_std jsonb;
  legacy_topup jsonb;
  leftover int;
BEGIN
  SELECT id, COALESCE("incomeRule" -> 'stepParams', '{}'::jsonb)
    INTO product_id, stored_params
  FROM platform_enumeration
  WHERE type = 'surrogate_product' AND key = 'compound_owner';

  IF product_id IS NULL THEN
    RAISE NOTICE 'compound_owner absent — fresh database, the blueprint ships the new shape';
    RETURN;
  END IF;

  -- Guarded on the TARGET, not on the old shape: this has to be a no-op on a database that
  -- already carries the fix, and it must still finish the job on one where an earlier attempt
  -- moved the template but not the figures.
  IF EXISTS (
    SELECT 1 FROM platform_enumeration
    WHERE id = product_id
      -- The WHOLE target, not one clause of it. A looser check cannot tell a finished
      -- database from one where an earlier attempt moved the bracket way's column and left
      -- the class table's behind — and on that database an early return is the wrong answer.
      AND "templateSpec" -> 'alternatives' -> 0 -> 'column' ->> 'fact' = 'holds_other_product'
      AND "templateSpec" -> 'primary' -> 'column' ->> 'fact' = 'loan_is_topup'
      AND "templateSpec" -> 'alternatives' -> 2 -> 'column' ->> 'fact' = 'loan_is_topup'
      AND NOT ("templateSpec" ? 'secondColumn')
      AND NOT ("incomeRule" -> 'stepParams' ? 'alt__top_up')
  ) THEN
    RAISE NOTICE 'compound_owner already carries the per-way columns — nothing to do';
    RETURN;
  END IF;

  -- ---- the bank programmes, joined through the NAME and never a hardcoded code ----
  --
  -- Every programme reached here is filed under a catalog name that takes its calculation
  -- from THIS product, which is what makes the join the right one: a programme code is a fact
  -- about one bank's row, and this change is about the product's shape.

  UPDATE bank_program p
  SET "incomeAssumption" = jsonb_set(
        p."incomeAssumption",
        '{stepParams}',
        (p."incomeAssumption" -> 'stepParams')
          - 'alt__top_up'
          || jsonb_build_object('alt__other_product_held',
                                p."incomeAssumption" -> 'stepParams' -> 'alt__top_up')
      ),
      "updatedAt" = now()
  FROM platform_enumeration n
  WHERE n.type = 'program_name' AND n.key = p."programNameKey"
    AND n."surrogateProductKey" = 'compound_owner'
    AND p."incomeAssumption" -> 'stepParams' ? 'alt__top_up';

  -- The duplicate column on the share-of-paid way. Pruned only while it still says nothing.
  FOR legacy_std, legacy_topup IN
    SELECT p."incomeAssumption" -> 'stepParams' -> 'alt__unit_paid_to_date',
           p."incomeAssumption" -> 'stepParams' -> 'alt__unit_paid_to_date__top_up'
    FROM bank_program p
    JOIN platform_enumeration n
      ON n.type = 'program_name' AND n.key = p."programNameKey"
    WHERE n."surrogateProductKey" = 'compound_owner'
      AND p."incomeAssumption" -> 'stepParams' ? 'alt__unit_paid_to_date__top_up'
  LOOP
    IF legacy_std IS DISTINCT FROM legacy_topup THEN
      RAISE EXCEPTION
        'a top-up column on the share-of-paid way holds % against % on the standard column '
        '— that is a real figure and this migration will not discard it',
        legacy_topup, legacy_std;
    END IF;
  END LOOP;

  UPDATE bank_program p
  SET "incomeAssumption" = jsonb_set(
        p."incomeAssumption",
        '{stepParams}',
        (p."incomeAssumption" -> 'stepParams') - 'alt__unit_paid_to_date__top_up'
      ),
      "updatedAt" = now()
  FROM platform_enumeration n
  WHERE n.type = 'program_name' AND n.key = p."programNameKey"
    AND n."surrogateProductKey" = 'compound_owner'
    AND p."incomeAssumption" -> 'stepParams' ? 'alt__unit_paid_to_date__top_up';

  -- ---- the product's own shape and its own default figures, in one statement ----
  IF stored_params ? 'alt__unit_paid_to_date__top_up'
     AND stored_params -> 'alt__unit_paid_to_date__top_up'
         IS DISTINCT FROM stored_params -> 'alt__unit_paid_to_date' THEN
    RAISE EXCEPTION
      'the catalog top-up default on the share-of-paid way holds % against % — refusing to drop it',
      stored_params -> 'alt__unit_paid_to_date__top_up',
      stored_params -> 'alt__unit_paid_to_date';
  END IF;

  stored_params := stored_params - 'alt__unit_paid_to_date__top_up';
  IF stored_params ? 'alt__top_up' THEN
    stored_params := (stored_params - 'alt__top_up')
      || jsonb_build_object('alt__other_product_held', stored_params -> 'alt__top_up');
  END IF;

  UPDATE platform_enumeration
  SET "templateSpec" = '{"version":1,"outputKind":"maxAmount","iScore":true,"primary":{"kind":"classTable","fact":"compound_name","column":{"fact":"loan_is_topup","branches":["new_loan","top_up"]}},"alternatives":[{"kind":"numberBand","fact":"unit_down_payment","column":{"fact":"holds_other_product","branches":["other_product_none","other_product_held"]}},{"kind":"shareOf","fact":"unit_paid_to_date"},{"kind":"choiceTable","fact":"owned_unit_type","column":{"fact":"loan_is_topup","branches":["new_loan","top_up"]}},{"kind":"shareOf","fact":"unit_down_payment"}],"combine":"lower","waysAre":"exclusive","uplift":{"fact":"unit_count_owned","whenOption":"unit_more_than_one","otherwiseOption":"unit_one","scope":"maxLoan"},"share":{"kind":"statedPercent","fact":"unit_owned_share_pct","scope":"income"},"conditions":[{"id":"ownedlongenough","measure":{"of":"fact","fact":"unit_months_owned"},"test":{"op":"atLeast"},"reasonCode":"CONTRACT_TOO_NEW"},{"id":"paidenough","measure":{"of":"fact","fact":"unit_paid_to_date"},"test":{"op":"atLeastShareOf","fact":"unit_contract_price"},"reasonCode":"DOWN_PAYMENT_BELOW_MIN"},{"id":"unitworthenough","measure":{"of":"fact","fact":"unit_contract_price"},"test":{"op":"atLeast"},"reasonCode":"UNIT_PRICE_BELOW_MIN"},{"id":"businessoldenough","measure":{"of":"fact","fact":"business_months"},"test":{"op":"oneOf","expect":["24m_or_more","not_self_employed"]},"reasonCode":"BUSINESS_TOO_NEW"},{"id":"selfemployedpapers","measure":{"of":"fact","fact":"self_employed_licence"},"test":{"op":"oneOf","expect":["yes","not_self_employed"]},"reasonCode":"SELF_EMPLOYED_DOCS_MISSING"}],"blueprintKey":"compound_owner"}'::jsonb,
      -- MERGED, never replaced: the compiled rule states no figures, and writing it whole
      -- would wipe this product's I-Score tiers and every other default it holds.
      "incomeRule" = '{"strategy":"steps","waysAre":"exclusive","steps":[{"id":"src__unit_contract_price","op":"factNumber","fact":"unit_contract_price"},{"id":"src__unit_down_payment","op":"factNumber","fact":"unit_down_payment"},{"id":"src__unit_owned_share_pct","op":"factNumber","fact":"unit_owned_share_pct"},{"id":"src__unit_paid_to_date","op":"factNumber","fact":"unit_paid_to_date"},{"id":"primary","op":"factParentTable","fact":"compound_name"},{"id":"primary__top_up","op":"factParentTable","fact":"compound_name"},{"id":"primary_pick","op":"pickByFact","fact":"loan_is_topup","of":[{"step":"primary"},{"step":"primary__top_up"}],"branches":["new_loan","top_up"]},{"id":"alt","op":"bandTable","of":{"step":"src__unit_down_payment"}},{"id":"alt__other_product_held","op":"bandTable","of":{"step":"src__unit_down_payment"}},{"id":"alt_pick","op":"pickByFact","fact":"holds_other_product","of":[{"step":"alt"},{"step":"alt__other_product_held"}],"branches":["other_product_none","other_product_held"]},{"id":"alt__unit_paid_to_date","op":"percentOf","of":{"step":"src__unit_paid_to_date"}},{"id":"alt__owned_unit_type","op":"factChoiceTable","fact":"owned_unit_type"},{"id":"alt__owned_unit_type__top_up","op":"factChoiceTable","fact":"owned_unit_type"},{"id":"alt__owned_unit_type_pick","op":"pickByFact","fact":"loan_is_topup","of":[{"step":"alt__owned_unit_type"},{"step":"alt__owned_unit_type__top_up"}],"branches":["new_loan","top_up"]},{"id":"alt__unit_down_payment","op":"percentOf","of":{"step":"src__unit_down_payment"}},{"id":"basis_combine","op":"minOf","of":[{"step":"primary_pick"},{"step":"alt_pick"},{"step":"alt__unit_paid_to_date"},{"step":"alt__owned_unit_type_pick"},{"step":"alt__unit_down_payment"}],"skipUnset":true},{"id":"basis","op":"coalesce","of":[{"step":"basis_combine"},{"step":"primary_pick"},{"step":"alt_pick"},{"step":"alt__unit_paid_to_date"},{"step":"alt__owned_unit_type_pick"},{"step":"alt__unit_down_payment"}]},{"id":"share","op":"percentOf","of":[{"step":"basis"},{"step":"src__unit_owned_share_pct"}]},{"id":"iscore_src","op":"factNumber","fact":"i_score","optional":true},{"id":"iscore_band","op":"bandTable","of":{"step":"iscore_src"}},{"id":"iscore_factor","op":"coalesce","of":[{"step":"iscore_band"},{"const":"100"}]},{"id":"iscore_applied","op":"percentOf","of":[{"step":"share"},{"step":"iscore_factor"}]},{"id":"cond__paidenough__bound","op":"percentOf","of":{"step":"src__unit_contract_price"}}],"gates":[{"id":"cond__ownedlongenough","kind":"number","op":"gte","left":{"fact":"unit_months_owned"},"reasonCode":"CONTRACT_TOO_NEW"},{"id":"cond__paidenough","kind":"number","op":"gte","left":{"fact":"unit_paid_to_date"},"right":{"step":"cond__paidenough__bound"},"reasonCode":"DOWN_PAYMENT_BELOW_MIN"},{"id":"cond__unitworthenough","kind":"number","op":"gte","left":{"fact":"unit_contract_price"},"reasonCode":"UNIT_PRICE_BELOW_MIN"},{"id":"cond__businessoldenough","kind":"choice","op":"in","fact":"business_months","expect":["24m_or_more","not_self_employed"],"reasonCode":"BUSINESS_TOO_NEW"},{"id":"cond__selfemployedpapers","kind":"choice","op":"in","fact":"self_employed_licence","expect":["yes","not_self_employed"],"reasonCode":"SELF_EMPLOYED_DOCS_MISSING"}],"output":{"kind":"maxAmount","from":"iscore_applied"}}'::jsonb || jsonb_build_object('stepParams', stored_params),
      "valueSources" = CASE
        WHEN "valueSources" IS NULL THEN NULL
        ELSE ("valueSources" - 'incomeRule.stepParams.alt__unit_paid_to_date__top_up.scalar.value')
      END,
      "updatedAt" = now()
  WHERE id = product_id;

  -- ---- assert the end state rather than assuming it ----
  IF EXISTS (SELECT 1 FROM platform_enumeration WHERE id = product_id AND "templateSpec" ? 'secondColumn') THEN
    RAISE EXCEPTION 'compound_owner still carries a product-level second column';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM platform_enumeration
    WHERE id = product_id
      AND "templateSpec" -> 'alternatives' -> 0 -> 'column' ->> 'fact' = 'holds_other_product'
      AND "templateSpec" -> 'primary' -> 'column' ->> 'fact' = 'loan_is_topup'
  ) THEN
    RAISE EXCEPTION 'the per-way columns did not come out as intended';
  END IF;

  SELECT count(*) INTO leftover
  FROM bank_program p
  JOIN platform_enumeration n
    ON n.type = 'program_name' AND n.key = p."programNameKey"
  WHERE n."surrogateProductKey" = 'compound_owner'
    AND (p."incomeAssumption" -> 'stepParams' ? 'alt__top_up'
      OR p."incomeAssumption" -> 'stepParams' ? 'alt__unit_paid_to_date__top_up');
  IF leftover > 0 THEN
    RAISE EXCEPTION '% programme(s) still file figures under a retired slot', leftover;
  END IF;
END $$;
