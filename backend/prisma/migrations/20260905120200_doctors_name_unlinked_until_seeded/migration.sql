-- The in-practice catalog name is left UNLINKED until the seed has built its product, and the
-- clinic programme drops the last slot of the retired ownership condition.
--
-- THIRD FILE OF ONE CHANGE. `20260905120000_doctors_two_products` and
-- `20260905120100_doctors_practice_one_slot` were already applied when this came to light, and
-- a migration's checksum is its identity — editing an applied one breaks every other database.
-- All three deploy together.
--
-- WHY. Step 3 of `20260905120000` pointed `program_name doctors_in_practice` at the product key
-- `doctors_in_practice` so the name would never reference the row step 5 deletes. That is right
-- about the dangling link and wrong about the ORDER, and `seed:blueprints` said so:
--
--   INCOME_PROOF_IN_USE {"programNameKey":"doctors_in_practice",
--                        "programCodes":["ABK-PER-DOCTORS_PRACTICE"]}
--
-- `setSurrogateProductTemplate` refuses a proof change while live programmes read the product,
-- across two hops (product → linked names → programmes), because a bank's stored table is
-- keyed by the proof it was written against. A product row is born with no rule, so its first
-- template save always reads as "nothing → steps" — a proof CHANGE — and the pre-set link is
-- what made a programme visible to it. The guard is correct and stays; what has to move is when
-- the name is linked.
--
-- So the name is unlinked here, and `seed:sheet-figures` establishes the link afterwards, once
-- both products exist and hold their calculations. Its reuse path re-asserts
-- `surrogateProductKey` on every run and that write carries no proof check of its own, which is
-- what makes it the right owner of the link.
--
-- This LENGTHENS the window `20260905120000` documents: from that file until
-- `seed:sheet-figures`, both doctor programmes resolve through a name that states nothing and
-- quote NOTHING (`rule_unconfigured`). Still the deliberate direction — the alternative quotes
-- a figure through the wrong product, which is how a wrong number reaches an immutable offer
-- (Principle I / A6). Required order, unchanged except that the last step is now load-bearing
-- for the link as well as the figures:
--
--   prisma migrate deploy → npm run build → npm run seed:questionnaire
--     → npm run seed:blueprints → npm run seed:sheet-figures
--
-- A FRESH DATABASE reaches neither statement: it holds no `doctors_in_practice` name row for
-- step 1 to clear, and no doctor programme for step 2 to prune. Both are repairs to a database
-- that already carried the merged product.

-- 1. Unlink, so no name references a product with no rule.
--
--    Only when it points at the product this change is about: a name somebody has since
--    repointed by hand is theirs, and clearing that would be this file overruling an operator.
UPDATE "platform_enumeration"
SET "surrogateProductKey" = NULL, "updatedAt" = now()
WHERE "type" = 'program_name'
  AND "key" = 'doctors_in_practice'
  AND "surrogateProductKey" IN ('doctors_in_practice', 'years_in_practice_bands');

-- 2. `ABK-PER-DOCTORS_CLINIC` drops `cond__ownsclinic`, the same prune `20260905120100` did on
--    the other programme and for the same reason: the condition it switches on no longer
--    exists, and neither doctor product declares one. Left in place it is an orphaned figure
--    key — `assertNoOrphanedFigures` would refuse the next template save on the clinic product,
--    naming a slot whose meaning went away three migrations ago.
--
--    `seed:sheet-figures` rewrites this programme's blob to the same shape, so this only closes
--    the window between the two.
DO $$
DECLARE
  params jsonb;
  pruned jsonb;
BEGIN
  SELECT "incomeAssumption"->'stepParams' INTO params
  FROM "bank_program" WHERE "programCode" = 'ABK-PER-DOCTORS_CLINIC';

  IF params IS NULL OR NOT (params ? 'cond__ownsclinic') THEN
    RAISE NOTICE 'doctors split: ABK-PER-DOCTORS_CLINIC holds no ownership condition — nothing to prune';
    RETURN;
  END IF;

  pruned := params - 'cond__ownsclinic';

  -- A prune must never leave a programme unable to reach a figure: an empty `stepParams`
  -- quotes nothing, silently, for every doctor.
  IF NOT (pruned ? 'primary') THEN
    RAISE EXCEPTION
      'doctors split: pruning ABK-PER-DOCTORS_CLINIC would leave it with no primary income slot';
  END IF;

  UPDATE "bank_program"
  SET "incomeAssumption" = jsonb_set("incomeAssumption", '{stepParams}', pruned),
      "version" = "version" + 1,
      "updatedAt" = now()
  WHERE "programCode" = 'ABK-PER-DOCTORS_CLINIC';

  RAISE NOTICE 'doctors split: ABK-PER-DOCTORS_CLINIC pruned to % slot(s)',
    (SELECT count(*) FROM jsonb_object_keys(pruned));
END $$;
