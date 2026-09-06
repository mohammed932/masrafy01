-- Giza moves to the secondary tier, because ABK's top tier is Cairo and Alexandria only.
--
-- ── WHAT WAS WRONG ──────────────────────────────────────────────────────────
-- `20260901120000` filed `cairo, giza, alexandria` under `city_tier_major` and called that
-- "both banks' top tier". Only one of the two banks says so. App. A §7 -- ABK Doctors
-- (Clinic Owners) -- tiers cities as "Cairo & Alexandria" against everywhere else; Giza is
-- on the everywhere-else side. The Arabic DOCTOR sheet does put Giza in its top tier, along
-- with Assiut, Minya, Qalyubia, Gharbia and Dakahlia.
--
-- The live cost, measured against the seeded `ABK-PER-DOCTORS_CLINIC` cap table: a Giza
-- doctor was capped at 1,500,000 new-loan / 2,000,000 top-up instead of the 500,000 / 750,000
-- the sheet publishes. A million pounds, frozen onto an immutable offer (Principle I / A6).
--
-- ── WHY THIS IS A RE-FILE AND NOT A FOURTH CLASS ────────────────────────────
-- Intersect the two banks' groupings and read off the cells:
--
--   {Cairo, Alexandria}                              ABK top      Arabic top
--   {Giza}                                           ABK bottom   Arabic top
--   {Assiut, Minya, Qalyubia, Gharbia, Dakahlia}     ABK bottom   Arabic top
--   the other 19                                     ABK bottom   Arabic bottom
--
-- {Giza} and {Assiut...} have IDENTICAL membership in both banks' groupings, so they belong
-- in one class -- and `city_tier_secondary` already is that class. Giza was mis-filed, not
-- un-modelled. After this re-file the granularity rule of the source spec (S10.1) holds
-- again: ABK's top = `major`, ABK's bottom = `secondary` + `other`; the Arabic bank's top =
-- `major` + `secondary`, its bottom = `other`. Every grouping is a union of whole classes.
--
-- A fourth class would be strictly worse, and the reason is worth writing down for whoever
-- meets the third bank. A new class needs a row in EVERY bank's cap table;
-- `resolveMaxLoanByFact` finds no row for a class a bank has not filled and falls to
-- `onNoMatch`, which on the seeded programme means the programme maximum -- 2,000,000, i.e.
-- worse than the bug being fixed here. And `prisma migrate deploy` runs BEFORE any seed, so a
-- single-deploy split opens a window in which Giza is uncapped. If a bank ever does cut
-- across `secondary`, the order is: migration A adds the class only -> deploy -> the sheet
-- seed writes each bank's new row -> migration B re-files the governorates -> deploy. Two
-- deploys, which is S10.1's own non-destructive split procedure.
--
-- ── WHY THE KEYS DO NOT MOVE ────────────────────────────────────────────────
-- `city_tier_secondary` is what `stepParams.primary__city_tier_secondary` and every
-- `loanLimits.maxLoanByFact.rows[].rowKey` are filed under, in code and in stored JSONB. A
-- key rename orphans all of them silently. Only one governorate's `parentKey` and two class
-- LABELS change here; both labels were describing the membership this migration corrects.

BEGIN;

-- 1 ── the re-file itself.
UPDATE "platform_enumeration"
   SET "parentKey" = 'city_tier_secondary', "updatedAt" = now()
 WHERE "type" = 'governorate'
   AND "key"  = 'giza';

-- 2 ── the two labels that named the old membership. `city_tier_major` literally read
--      "Cairo, Giza and Alexandria", and the class board prints it.
UPDATE "platform_enumeration"
   SET "labelAr"   = 'القاهرة والإسكندرية',
       "labelEn"   = 'Cairo and Alexandria',
       "updatedAt" = now()
 WHERE "type" = 'city_tier' AND "key" = 'city_tier_major';

UPDATE "platform_enumeration"
   SET "labelAr"   = 'الجيزة ومحافظات رئيسية أخرى',
       "labelEn"   = 'Giza and other main governorates',
       "updatedAt" = now()
 WHERE "type" = 'city_tier' AND "key" = 'city_tier_secondary';

-- 3 ── refuse rather than commit a half-applied state. Same posture as `20260901120000`,
--      whose own top-tier assertion this replaces.
DO $$
DECLARE
  unfiled int;
  tiers   int;
  ranks   int;
  major   int;
  giza    text;
BEGIN
  SELECT count(*) INTO unfiled
    FROM "platform_enumeration" g
   WHERE g."type" = 'governorate'
     AND NOT EXISTS (
           SELECT 1 FROM "platform_enumeration" t
            WHERE t."type" = 'city_tier'
              AND t."key"  = g."parentKey"
              AND t."active"
              AND t."deprecatedAt" IS NULL );
  IF unfiled > 0 THEN
    RAISE EXCEPTION 'giza tier: % governorate(s) are not under a live tier', unfiled;
  END IF;

  SELECT count(*), count(DISTINCT "sortOrder") INTO tiers, ranks
    FROM "platform_enumeration"
   WHERE "type" = 'city_tier' AND "active" AND "deprecatedAt" IS NULL;
  IF tiers <> 3 OR ranks <> 3 THEN
    RAISE EXCEPTION 'giza tier: expected 3 live tiers with 3 distinct sortOrders, got %/%', tiers, ranks;
  END IF;

  SELECT "parentKey" INTO giza
    FROM "platform_enumeration"
   WHERE "type" = 'governorate' AND "key" = 'giza';
  IF giza IS DISTINCT FROM 'city_tier_secondary' THEN
    RAISE EXCEPTION 'giza tier: giza is filed under %, expected city_tier_secondary', coalesce(giza, 'nothing');
  END IF;

  -- The top tier is now exactly the two governorates ABK names. If a third key is in there,
  -- the list is not the one this migration was written against and a bank's cap table would
  -- be keyed against a tier nobody checked.
  SELECT count(*) INTO major
    FROM "platform_enumeration"
   WHERE "type" = 'governorate' AND "parentKey" = 'city_tier_major';
  IF major <> 2 THEN
    RAISE EXCEPTION 'giza tier: expected exactly Cairo and Alexandria in the top tier, found % governorate(s)', major;
  END IF;

  SELECT count(*) INTO major
    FROM "platform_enumeration"
   WHERE "type" = 'governorate'
     AND "key" IN ('cairo','alexandria')
     AND "parentKey" = 'city_tier_major';
  IF major <> 2 THEN
    RAISE EXCEPTION 'giza tier: Cairo and Alexandria are not both in the top tier, found %', major;
  END IF;
END $$;

COMMIT;
