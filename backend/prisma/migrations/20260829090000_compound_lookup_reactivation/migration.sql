-- Compound lookups back on, six classes, and a declared home for an unfiled value.
--
-- ── WHY A MIGRATION AND NOT A SEED ──────────────────────────────────────────
-- There is no lookup-values seed any more: `upsertLookups` went with
-- `seed-collateral-products.ts` in `ad6d6d0`, and every enumeration VALUE in this
-- database was inserted by a migration. More importantly the four facts below are
-- only correct TOGETHER — the six classes must exist BEFORE any compound can be
-- created, because `resolveParentKey` refuses an unfiled child with
-- `ENUMERATION_PARENT_REQUIRED`. `migrate deploy` runs on every container start,
-- before the new code serves a request, so a fresh database is correct on boot.
-- A seed cannot promise that and cannot RAISE instead of committing a half-state.
--
-- ── WHY `compound_tier_*` AND NOT `compound_class_*` ────────────────────────
-- `20260823130000` created `compound_class_a|b|c` where "A" was the TOP tier
-- (6,000,000). Under six classes "A" is the third of six. Those rows were later
-- deleted outside any migration, so a stored `keyTable` still naming them is
-- currently DEAD — `factParentTable` answers `no_matching_row`, which stops the
-- rule and reports itself. Re-creating the keys would revive it into a SILENTLY
-- WRONG figure, frozen onto `bank_offer.collateralCeilingEGP` where Principle I /
-- A6 make it uncorrectable. Fresh keys keep every stale row loud. This is the
-- argument `20260823130000` spends its own header making; it applies unchanged,
-- and a key is unrenameable by construction anyway, so reuse buys no fewer writes.
--
-- ── WHAT THIS DOES NOT DO ───────────────────────────────────────────────────
-- It does not insert any real compound. The operator enters those through
-- `/lookups/paste`, which is the screen this migration exists to make usable.
-- The only compound written here is the catch-all, which the customer picks.

BEGIN;

-- 1 ── the stray, BY EXPLICIT KEY, BEFORE any class is inserted.
--
-- `test_compund` (sic) carries a DANGLING `parentKey = 'compound_class_a'` — a
-- class deleted outside any migration. Deleted FIRST and by name, not by "anything
-- dangling": a generic delete in a migration that runs unattended in every
-- environment is destruction by default. Anything else left dangling is FOLDED to
-- the catch-all in step 6, never deleted.
--
-- Order is load-bearing. Step 2 does not create `compound_class_a`, but a future
-- reader adding a class must not be able to resurrect this row's parent and turn a
-- typo into a real, priceable compound.
DELETE FROM "platform_enumeration"
 WHERE "type" = 'compound' AND "key" = 'test_compund';

-- 2 ── the six classes.
--
-- `sortOrder` 1..6, dense and DISTINCT: `getActiveMembers` orders
-- `[sortOrder asc, key asc]` and `parent-class-board` derives its rank accent from
-- the position, so a gap or a tie is a display bug. Asserted in step 7.
--
-- `ON CONFLICT DO UPDATE` refreshes labels and order only. `active` is NOT forced
-- back on — an operator who retired a class did so deliberately, the same posture
-- `20260823130000` documents.
INSERT INTO "platform_enumeration"
  ("id","type","key","labelAr","labelEn","active","systemOnly","sortOrder","createdAt","updatedAt")
VALUES
  ('clcmptier00000000000000aa001','compound_category','compound_tier_aa',   'الفئة AA','Class AA',true,false,1,now(),now()),
  ('clcmptier00000000000000ab002','compound_category','compound_tier_ab',   'الفئة AB','Class AB',true,false,2,now(),now()),
  ('clcmptier000000000000000a003','compound_category','compound_tier_a',    'الفئة A', 'Class A', true,false,3,now(),now()),
  ('clcmptier000000000000000b004','compound_category','compound_tier_b',    'الفئة B', 'Class B', true,false,4,now(),now()),
  ('clcmptier000000000000000c005','compound_category','compound_tier_c',    'الفئة C', 'Class C', true,false,5,now(),now()),
  ('clcmptier0000000000000oth006','compound_category','compound_tier_other','أخرى',    'Other',   true,false,6,now(),now())
ON CONFLICT ("type","key") DO UPDATE
  SET "labelAr"   = EXCLUDED."labelAr",
      "labelEn"   = EXCLUDED."labelEn",
      "sortOrder" = EXCLUDED."sortOrder",
      "updatedAt" = now();

-- 3 ── the catch-all COMPOUND, filed under the catch-all CLASS.
--
-- This is the customer's honest answer, and it is a different thing from the
-- fallback in step 5. An applicant whose compound is genuinely not on the list
-- picks this and gets priced at the Other figure. Without it their only options are
-- to pick a compound they do not live in or to abandon the application, and the
-- program would be LISTED with `fact_not_answered` against it.
--
-- The precedent is `20260823130000` step 3, which put its own `other` at the LOWEST
-- class rather than under nothing, "because a value with no parent reads to the
-- customer as a broken program".
INSERT INTO "platform_enumeration"
  ("id","type","key","labelAr","labelEn","active","systemOnly","parentKey","sortOrder","createdAt","updatedAt")
VALUES
  ('clcmpother0000000000000oth01','compound','compound_other','ليس من بينها','My compound is not listed',
   true,false,'compound_tier_other',9000,now(),now())
ON CONFLICT ("type","key") DO UPDATE
  SET "labelAr"   = EXCLUDED."labelAr",
      "labelEn"   = EXCLUDED."labelEn",
      "parentKey" = EXCLUDED."parentKey",
      "updatedAt" = now();

-- 4 ── the fallback column.
--
-- ON THE CHILD kind, beside `parentTypeKey`: it answers "where do THIS kind's
-- unfiled values go?", and one parent list can be the axis of two child kinds that
-- want different answers.
--
-- NO FOREIGN KEY, the same posture `parentTypeKey` takes and for the stronger
-- reason — the reachable unique on the target is the composite `(type, key)`, which
-- a self-FK cannot express without a constant type column.
ALTER TABLE "enumeration_type_def"
  ADD COLUMN "fallbackParentKey" VARCHAR(64);

-- 5 ── both kinds live again. Parent FIRST: nothing enforces the order, but
-- reversing it briefly puts a child list on the rail whose class list is off every
-- picker.
--
-- `deletable = true` on `compound` is the ongoing posture, not the mechanism for
-- step 1: a several-hundred-row operator-managed list needs a delete for the
-- inevitable typo, and `countGenericReferences` answers it correctly because
-- nothing is filed UNDER a compound. What it does not count —
-- `question_option.code`, `application_answer.selectedOptionCode`, a bank's
-- `stepParams[].keyTable[].key` — degrades to `no_matching_row`, which is exactly
-- what a DEPRECATED compound already does today. Not a new class of damage, and
-- `assertMirroredListSurvives` still stops the list dropping below two options.
UPDATE "enumeration_type_def"
   SET "active" = true, "onValuesRail" = true, "updatedAt" = now()
 WHERE "key" = 'compound_category';

UPDATE "enumeration_type_def"
   SET "active"            = true,
       "onValuesRail"      = true,
       "deletable"         = true,
       "fallbackParentKey" = 'compound_tier_other',
       "updatedAt"         = now()
 WHERE "key" = 'compound';

-- 6 ── fold every leftover onto the catch-all. NEVER delete.
--
-- Three states, one remedy: `NULL`, `''` (which the DTO's old `@Length(0,64)`
-- allowed, and which then passes the engine's `parentKey IS NOT NULL` filter and
-- resolves to `no_matching_row` anyway), and a key naming no live class.
--
-- An unfiled compound is a PICKABLE answer that prices nothing, so the fix is a
-- class, not a hole. This is the one place the platform files on the operator's
-- behalf, and it is doing so for rows that are already broken.
UPDATE "platform_enumeration" c
   SET "parentKey" = 'compound_tier_other', "updatedAt" = now()
 WHERE c."type" = 'compound'
   AND ( c."parentKey" IS NULL
      OR c."parentKey" = ''
      OR NOT EXISTS (
           SELECT 1 FROM "platform_enumeration" p
            WHERE p."type" = 'compound_category'
              AND p."key"  = c."parentKey"
              AND p."active"
              AND p."deprecatedAt" IS NULL ) );

-- 7 ── guards. RAISE rather than commit a half-state.
DO $$
DECLARE
  unfiled  int;
  classes  int;
  ranks    int;
  stale    int;
BEGIN
  SELECT count(*) INTO unfiled
    FROM "platform_enumeration" c
   WHERE c."type" = 'compound'
     AND NOT EXISTS (
           SELECT 1 FROM "platform_enumeration" p
            WHERE p."type" = 'compound_category'
              AND p."key"  = c."parentKey"
              AND p."active"
              AND p."deprecatedAt" IS NULL );
  IF unfiled > 0 THEN
    RAISE EXCEPTION 'compound reactivation: % compound(s) are not under a live class', unfiled;
  END IF;

  SELECT count(*), count(DISTINCT "sortOrder") INTO classes, ranks
    FROM "platform_enumeration"
   WHERE "type" = 'compound_category' AND "active" AND "deprecatedAt" IS NULL;
  IF classes <> 6 OR ranks <> 6 THEN
    RAISE EXCEPTION 'compound reactivation: expected 6 live classes with 6 distinct sortOrders, got %/%',
      classes, ranks;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "enumeration_type_def"
                  WHERE "key" = 'compound'
                    AND "active"
                    AND "fallbackParentKey" = 'compound_tier_other') THEN
    RAISE EXCEPTION 'compound reactivation: the compound kind is not live with a declared fallback';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "enumeration_type_def"
                  WHERE "key" = 'compound' AND "parentTypeKey" = 'compound_category') THEN
    RAISE EXCEPTION 'compound reactivation: the compound -> compound_category axis was not preserved';
  END IF;

  -- NOTICE, not EXCEPTION: a table somebody keyed by hand against a retired key is
  -- not this migration's fault, and blocking the deploy over it strands everything
  -- else. The same call `20260823130000` made. Those rows quote `no_matching_row`,
  -- which is loud, and `check:parent-keys` reports them.
  SELECT count(*) INTO stale
    FROM "bank_program"
   WHERE "incomeAssumption"::text LIKE '%compound_class_%';
  IF stale > 0 THEN
    RAISE NOTICE 'compound reactivation: % bank program(s) still name a compound_class_* key — they quote no_matching_row until re-keyed', stale;
  END IF;
END $$;

COMMIT;
