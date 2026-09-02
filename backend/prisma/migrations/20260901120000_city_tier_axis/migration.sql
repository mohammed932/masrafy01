-- Governorates get a CLASS, so two banks that tier cities differently can both be right.
--
-- ── WHY NOT A TWO-OPTION `city_tier` QUESTION ───────────────────────────────
-- ABK Doctors (Clinic Owners) tiers cities as "Cairo & Alex" against everything else. The
-- Arabic DOCTOR sheet tiers eight governorates -- Cairo, Giza, Alexandria, Assiut, Minya,
-- Qalyubia, Gharbia, Dakahlia -- against everything else. Neither grouping is a union of the
-- other's classes, because "other" names a different set in each. A two-option question can
-- therefore serve at most one of the two banks, and the second arrives within weeks.
--
-- So the LIST stays the 27 governorates (which is also what the applicant can answer without
-- being asked to classify their own city), and the TIER is the parent class -- cut fine
-- enough that both banks' groupings are unions of whole classes:
--
--   city_tier_major      Cairo . Giza . Alexandria          (both banks' top tier)
--   city_tier_secondary  Assiut . Minya . Qalyubia . Gharbia . Dakahlia
--   city_tier_other      everything else
--
-- ABK then fills the same figure against `secondary` and `other`; the Arabic bank fills the
-- same figure against `major` and `secondary`. Both correct, one list, no new mechanism --
-- `factParentTable` already walks a value up to its class.
--
-- ── WHY A MIGRATION AND NOT A SEED ──────────────────────────────────────────
-- Same argument as `20260829090000`: the class list must exist BEFORE any governorate points
-- at it (`resolveParentKey` refuses an unfiled child of a kind that declares an axis), the
-- 27 rows are only correct filed, and a seed cannot RAISE instead of committing a half-state.
--
-- ── WHAT THIS DOES NOT TOUCH ────────────────────────────────────────────────
-- The customer PROFILE writes a governorate by key (`customer-auth-mobile.service.ts` checks
-- `isActiveMember`). Filing a value under a class changes no key and no label, so every
-- stored profile still resolves. Nothing here makes the tier answerable by a customer: the
-- applicant names their governorate, exactly as before.

BEGIN;

-- 1 ── the class kind. Off the values rail: the tiers are read by a bank's table and are
--      maintained through the class board, not entered one at a time beside the 27 names.
INSERT INTO "enumeration_type_def"
  ("id","key","labelAr","labelEn","descriptionAr","descriptionEn","icon",
   "deletable","onValuesRail","systemOnly","active","sortOrder","createdAt","updatedAt")
VALUES
  ('clcitytierdef0000000000000001','city_tier','فئة المدينة','City tier',
   'تجميع المحافظات الذي تُسعّر البنوك على أساسه','The grouping of governorates a bank prices against',
   'environment', false, false, false, true, 70, now(), now())
ON CONFLICT ("key") DO UPDATE
   SET "labelAr"       = EXCLUDED."labelAr",
       "labelEn"       = EXCLUDED."labelEn",
       "descriptionAr" = EXCLUDED."descriptionAr",
       "descriptionEn" = EXCLUDED."descriptionEn",
       "updatedAt"     = now();

-- 2 ── the three tiers. `sortOrder` dense and DISTINCT, most central first: the class board
--      derives its rank accent from the position, so a gap or a tie is a display bug.
INSERT INTO "platform_enumeration"
  ("id","type","key","labelAr","labelEn","active","systemOnly","sortOrder","createdAt","updatedAt")
VALUES
  ('clcitytier000000000000major1','city_tier','city_tier_major',     'المحافظات الكبرى','Cairo, Giza and Alexandria', true,false,1,now(),now()),
  ('clcitytier00000000000second2','city_tier','city_tier_secondary', 'محافظات رئيسية أخرى','Other main governorates',   true,false,2,now(),now()),
  ('clcitytier0000000000000oth3','city_tier','city_tier_other',      'باقي المحافظات','The rest of Egypt',            true,false,3,now(),now())
ON CONFLICT ("type","key") DO UPDATE
   SET "labelAr"   = EXCLUDED."labelAr",
       "labelEn"   = EXCLUDED."labelEn",
       "sortOrder" = EXCLUDED."sortOrder",
       "updatedAt" = now();

-- 3 ── the axis, and where an unnamed governorate lands.
--
-- `fallbackParentKey` is read by `resolveParentKey` under `allowUnfiled` and nowhere else: an
-- operator's untick is a decision the kind can answer. A governorate created later with no
-- tier named is a typo, and `ENUMERATION_PARENT_REQUIRED` still refuses it.
UPDATE "enumeration_type_def"
   SET "parentTypeKey"     = 'city_tier',
       "fallbackParentKey" = 'city_tier_other',
       "updatedAt"         = now()
 WHERE "key" = 'governorate';

-- 4 ── file all 27, BY EXPLICIT KEY for the two named tiers.
--
-- Explicit, never "whatever looks urban": the two lists above are transcribed from two bank
-- sheets, and a rule inferring them would put a governorate in a tier no bank named.
UPDATE "platform_enumeration"
   SET "parentKey" = 'city_tier_major', "updatedAt" = now()
 WHERE "type" = 'governorate'
   AND "key" IN ('cairo','giza','alexandria');

UPDATE "platform_enumeration"
   SET "parentKey" = 'city_tier_secondary', "updatedAt" = now()
 WHERE "type" = 'governorate'
   AND "key" IN ('assiut','minya','qalyubia','gharbia','dakahlia');

-- 5 ── everything else to the catch-all, including any governorate an operator added.
UPDATE "platform_enumeration"
   SET "parentKey" = 'city_tier_other', "updatedAt" = now()
 WHERE "type" = 'governorate'
   AND ("parentKey" IS NULL
        OR "parentKey" = ''
        OR NOT EXISTS (SELECT 1 FROM "platform_enumeration" p
                        WHERE p."type" = 'city_tier' AND p."key" = "platform_enumeration"."parentKey"));

-- 6 ── refuse rather than commit a half-applied state.
DO $$
DECLARE
  unfiled int;
  tiers   int;
  ranks   int;
  major   int;
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
    RAISE EXCEPTION 'city tiers: % governorate(s) are not under a live tier', unfiled;
  END IF;

  SELECT count(*), count(DISTINCT "sortOrder") INTO tiers, ranks
    FROM "platform_enumeration"
   WHERE "type" = 'city_tier' AND "active" AND "deprecatedAt" IS NULL;
  IF tiers <> 3 OR ranks <> 3 THEN
    RAISE EXCEPTION 'city tiers: expected 3 live tiers with 3 distinct sortOrders, got %/%', tiers, ranks;
  END IF;

  -- The top tier is the one both sheets agree on. If those three keys are not where they
  -- were put, the governorate list is not the one this migration was written against and a
  -- bank's table would be keyed against tiers nobody checked.
  SELECT count(*) INTO major
    FROM "platform_enumeration"
   WHERE "type" = 'governorate'
     AND "key" IN ('cairo','giza','alexandria')
     AND "parentKey" = 'city_tier_major';
  IF major <> 3 THEN
    RAISE EXCEPTION 'city tiers: expected Cairo, Giza and Alexandria in the top tier, found %', major;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "enumeration_type_def"
                  WHERE "key" = 'governorate'
                    AND "parentTypeKey" = 'city_tier'
                    AND "fallbackParentKey" = 'city_tier_other') THEN
    RAISE EXCEPTION 'city tiers: the governorate -> city_tier axis was not written';
  END IF;
END $$;

COMMIT;
