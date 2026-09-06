-- `ABK-PER-DOCTORS_PRACTICE` drops the three figure slots its own sheet does not have.
--
-- WHY THIS IS A SECOND FILE. It belongs to the same change as
-- `20260905120000_doctors_two_products`, and it is separate only because that file was already
-- applied when the need showed up — a migration's checksum is its identity, so editing an
-- applied one would break every other database. The two must be deployed together.
--
-- WHY. `seed:blueprints` REFUSED to create the `doctors_in_practice` product:
--
--   PRODUCT_TEMPLATE_ORPHANS_FIGURES
--   {"programCodes":["ABK-PER-DOCTORS_PRACTICE"],
--    "lostKeys":["cond__notownsclinic","primary__city_tier_other","primary__city_tier_secondary"]}
--
-- which is §5.4's guarantee working exactly as designed: a template may not be saved if it
-- would strand a figure some bank has typed. The three keys are real leftovers of the merged
-- product — a city-tier income column App. A §8 does not print, and one half of the ownership
-- condition that told the two doctor programmes apart before each got its own catalog name.
--
-- NOTHING IS LOST, and that was checked rather than assumed: both `primary__city_tier_*` slots
-- hold figures byte-identical to `primary` (the sheet prices by years alone; the merged product
-- simply required every column to be filled), and `cond__notownsclinic` is a switch whose
-- condition no longer exists. `seed:sheet-figures` rewrites this programme's whole blob
-- afterwards to the same one-slot shape, so this file only unblocks the product create that has
-- to happen first.
--
-- BY EXPLICIT PROGRAM CODE and BY EXPLICIT KEY. A blanket "strip every `primary__city_tier_*`"
-- would reach `ABK-PER-DOCTORS_CLINIC`, whose sheet DOES tier the cap and whose product still
-- declares that column, and the Arabic DOCTOR catalog defaults besides.
DO $$
DECLARE
  params jsonb;
  pruned jsonb;
BEGIN
  SELECT "incomeAssumption"->'stepParams' INTO params
  FROM "bank_program" WHERE "programCode" = 'ABK-PER-DOCTORS_PRACTICE';

  IF params IS NULL THEN
    RAISE NOTICE 'doctors split: ABK-PER-DOCTORS_PRACTICE holds no stepParams — nothing to prune';
    RETURN;
  END IF;

  pruned := params - 'cond__notownsclinic' - 'primary__city_tier_secondary' - 'primary__city_tier_other';

  -- The one thing a prune must never do is leave the programme with no way to reach a figure:
  -- an empty `stepParams` quotes nothing, silently, for every doctor.
  IF NOT (pruned ? 'primary') THEN
    RAISE EXCEPTION
      'doctors split: pruning ABK-PER-DOCTORS_PRACTICE would leave it with no primary income slot';
  END IF;

  IF pruned = params THEN
    RAISE NOTICE 'doctors split: ABK-PER-DOCTORS_PRACTICE already holds one slot';
    RETURN;
  END IF;

  UPDATE "bank_program"
  SET "incomeAssumption" = jsonb_set("incomeAssumption", '{stepParams}', pruned),
      -- Bumped for the same reason `20260905120000` bumps the clinic programme: a browser
      -- holding the pre-deploy row must not save over this on optimistic lock.
      "version" = "version" + 1,
      "updatedAt" = now()
  WHERE "programCode" = 'ABK-PER-DOCTORS_PRACTICE';

  RAISE NOTICE 'doctors split: ABK-PER-DOCTORS_PRACTICE pruned to % slot(s)',
    (SELECT count(*) FROM jsonb_object_keys(pruned));
END $$;
