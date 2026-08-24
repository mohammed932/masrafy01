-- Compound classes: FIVE tiers → THREE, and every compound re-filed onto them.
--
-- ── WHY A MIGRATION AND NOT A SEED RUN ──────────────────────────────────────
-- Both halves of this change live in Postgres — `platform_enumeration.parentKey`
-- (which class a compound is filed under) and `bank_program.incomeAssumption`
-- (the bank's figure per class) — and they are only correct TOGETHER. Applied
-- half-way, a compound reads a bank figure that was keyed for a different tier.
--
-- The seed cannot do it: `upsertLookups` is upsert-only, so a key dropped from
-- its array goes on living in every database an earlier run reached. The admin
-- cannot do it either: a `compound_category` row can never be deleted through
-- the API (`countReferences` has no case for the type, so DELETE is refused),
-- and deactivating one does NOT stop the engine reading it, because
-- `enumerationParentKeys()` filters the CHILD row's `active` flag and never the
-- parent's. There is no admin-only sequence that ends in a clean state.
--
-- So: one migration, one transaction, with a guard at the end that ABORTS rather
-- than commit a state where any compound points at a class that is not one of
-- the three. `migrate deploy` runs on every container start, before the new code
-- serves a request.
--
-- ── WHY NEW KEYS AND NOT `cat_a` / `cat_b` / `cat_c` ────────────────────────
-- Under the new scheme "Class A" is the TOP tier (6,000,000). `cat_a` was the
-- MIDDLE one (4,000,000). Reusing the key would make every half-applied state
-- individually plausible and jointly wrong: re-file the compounds first and
-- Mivida quotes 4,000,000 instead of 6,000,000; rewrite the table first and
-- Madinaty quotes 6,000,000 instead of 4,000,000 — silently, and frozen onto
-- `bank_offer.collateralCeilingEGP` where it cannot be corrected. With fresh
-- keys every half-state is `no_matching_row`, which STOPS the rule and reports
-- itself. A key is unrenameable by construction anyway (there is no `key` field
-- on `UpdateEnumerationDto`), so reuse buys no fewer writes — only ambiguity.
--
-- ── THE MAPPING ─────────────────────────────────────────────────────────────
--   Class A  6,000,000   Mivida · New Giza · SODIC East                (was AA)
--   Class B  4,000,000   Mountain View iCity · Palm Hills · Madinaty   (was AB, AB, A)
--   Class C  2,000,000   Al Rehab · Dreamland · Another compound       (was B, B, C)
--
-- Two pairs collapse (AB+A → B, B+C → C), which is why no generic old→new key
-- remap is possible: a remap would have to invent which of the two amounts
-- survives, and the answer it would invent (the higher: 5M, 3M) is not the one
-- that was decided (4M, 2M). The known table is rewritten by SHAPE; a table
-- somebody else keyed by hand is deliberately left alone and made VISIBLE by the
-- final guard instead.

-- 1 ── the three classes.
-- `ON CONFLICT DO UPDATE` refreshes labels and order only. `active` is NOT forced
-- back on, for the same reason the seed does not force it: an operator who
-- deactivated a row did so deliberately.
INSERT INTO "platform_enumeration"
  ("id","type","key","labelAr","labelEn","active","systemOnly","sortOrder","createdAt","updatedAt")
VALUES
  ('clcmpcls0000000000000000a0001','compound_category','compound_class_a','الفئة A','Class A',true,false,1,now(),now()),
  ('clcmpcls0000000000000000b0002','compound_category','compound_class_b','الفئة B','Class B',true,false,2,now(),now()),
  ('clcmpcls0000000000000000c0003','compound_category','compound_class_c','الفئة C','Class C',true,false,3,now(),now())
ON CONFLICT ("type","key") DO UPDATE
  SET "labelAr" = EXCLUDED."labelAr",
      "labelEn" = EXCLUDED."labelEn",
      "sortOrder" = EXCLUDED."sortOrder",
      "updatedAt" = now();

-- 2 ── re-file the nine seeded compounds, BY EXPLICIT KEY.
-- Never by old parent: `WHERE "parentKey" = 'cat_ab'` would also move a compound
-- an operator filed there themselves, from one amount to another, with nothing in
-- the trail saying a decision had been made on their behalf.
UPDATE "platform_enumeration" SET "parentKey" = 'compound_class_a', "updatedAt" = now()
 WHERE "type" = 'compound' AND "key" IN ('mivida','new_giza','sodic_east');

UPDATE "platform_enumeration" SET "parentKey" = 'compound_class_b', "updatedAt" = now()
 WHERE "type" = 'compound' AND "key" IN ('mountain_view_icity','palm_hills','madinaty');

UPDATE "platform_enumeration" SET "parentKey" = 'compound_class_c', "updatedAt" = now()
 WHERE "type" = 'compound' AND "key" IN ('al_rehab','dreamland','other');

-- 3 ── everything else a compound could be: filed under a retiring class, filed
-- under nothing, or filed under the empty string (which the DTO's `@Length(0,64)`
-- allowed and which then passes the `parentKey IS NOT NULL` filter and resolves
-- to `no_matching_row`). All three fold to the lowest class.
--
-- Class C rather than NULL, and rather than a refusal: the seed already states
-- the rule for an unplaceable compound — `other` sits at the LOWEST class rather
-- than under nothing, because a value with no parent reads to the customer as a
-- broken program. Stated consequence: a compound that used to stop the rule now
-- quotes 2,000,000 at EG Bank. That is a ceiling INCREASE for whoever picked it,
-- it is the intended meaning of "a compound must have a class", and it cannot
-- reach a frozen `bank_offer` (Principle I / A6) — only future quotes.
UPDATE "platform_enumeration" SET "parentKey" = 'compound_class_c', "updatedAt" = now()
 WHERE "type" = 'compound'
   AND ("parentKey" IS NULL
        OR "parentKey" = ''
        OR "parentKey" NOT IN ('compound_class_a','compound_class_b','compound_class_c'));

-- 4 ── the bank's stored figures, scoped BY SHAPE rather than by programCode, so
-- a second bank that configured the same step is carried too.
--
-- `bool_and` restricts it to a table whose EVERY key is one of the five being
-- retired. A table already partly re-keyed by hand, or keyed by something else
-- entirely, is left untouched — the migration must never invent an amount — and
-- the guard in step 6 then makes that table visible instead of silent.
-- `COALESCE(..., false)` stops an empty array matching.
UPDATE "bank_program"
   SET "incomeAssumption" = jsonb_set(
         "incomeAssumption",
         '{stepParams,capByCompoundClass,keyTable}',
         '[{"key":"compound_class_a","incomeEGP":"6000000.00"},
           {"key":"compound_class_b","incomeEGP":"4000000.00"},
           {"key":"compound_class_c","incomeEGP":"2000000.00"}]'::jsonb,
         false),
       "updatedAt" = now()
 WHERE "incomeAssumption" #> '{stepParams,capByCompoundClass,keyTable}' IS NOT NULL
   AND COALESCE((
         SELECT bool_and(kt->>'key' IN ('cat_aa','cat_ab','cat_a','cat_b','cat_c'))
           FROM jsonb_array_elements("incomeAssumption" #> '{stepParams,capByCompoundClass,keyTable}') AS kt
       ), false);

-- 5 ── re-root any estimated-value MARKER that addressed a retired row.
--
-- A marker path embeds the key: `…capByCompoundClass.keyTable.cat_aa.incomeEGP`.
-- Both collapsing pairs land on one path, and `jsonb_object_agg` folding them is
-- the right semantics — every value is the same literal `'team_estimated'`, so if
-- either contributing figure was a platform guess, the surviving figure is not
-- fully bank-stated. Deliberately does not ADD a marker to a program that had
-- none: a migration-written marker would relabel a bank-stated figure as a guess.
UPDATE "bank_program" bp
   SET "valueSources" = sub.remapped,
       "updatedAt" = now()
  FROM (
    SELECT b."id",
           jsonb_object_agg(
             regexp_replace(
               kv.key,
               '(capByCompoundClass\.keyTable\.)(cat_aa|cat_ab|cat_a|cat_b|cat_c)(\.)',
               '\1' || CASE
                         WHEN kv.key LIKE '%.cat_aa.%' THEN 'compound_class_a'
                         WHEN kv.key LIKE '%.cat_ab.%' THEN 'compound_class_b'
                         WHEN kv.key LIKE '%.cat_a.%'  THEN 'compound_class_b'
                         ELSE 'compound_class_c'
                       END || '\3'
             ),
             kv.value
           ) AS remapped
      FROM "bank_program" b, jsonb_each(b."valueSources") AS kv
     WHERE b."valueSources"::text LIKE '%capByCompoundClass.keyTable.cat\_%'
     GROUP BY b."id"
  ) AS sub
 WHERE bp."id" = sub."id";

-- 6 ── the five retired classes go, and nothing points at them by now.
-- DELETE rather than deactivate: the API can never delete this type afterwards,
-- so a deactivated row would sit on the class board forever as noise an operator
-- has to re-read and re-dismiss. Safe only because steps 2 and 3 leave no child,
-- and because a class key is held by no FK, no question option and no answer.
DELETE FROM "platform_enumeration"
 WHERE "type" = 'compound_category'
   AND "key" IN ('cat_aa','cat_ab','cat_a','cat_b','cat_c');

-- 7 ── the invariant, as a hard stop. This is the point of doing it in SQL: the
-- deploy fails loudly here instead of a customer failing quietly later.
DO $$
DECLARE
  orphans integer;
  stale integer;
BEGIN
  SELECT count(*) INTO orphans
    FROM "platform_enumeration" c
   WHERE c."type" = 'compound'
     AND NOT EXISTS (
       SELECT 1 FROM "platform_enumeration" p
        WHERE p."type" = 'compound_category'
          AND p."key" = c."parentKey"
          AND p."active"
          AND p."deprecatedAt" IS NULL
     );
  IF orphans > 0 THEN
    RAISE EXCEPTION
      'compound class migration aborted: % compound row(s) are not filed under an active class',
      orphans;
  END IF;

  SELECT count(*) INTO stale
    FROM "bank_program" b,
         jsonb_array_elements(b."incomeAssumption" #> '{stepParams,capByCompoundClass,keyTable}') AS kt
   WHERE b."incomeAssumption" #> '{stepParams,capByCompoundClass,keyTable}' IS NOT NULL
     AND kt->>'key' IN ('cat_aa','cat_ab','cat_a','cat_b','cat_c');
  IF stale > 0 THEN
    RAISE EXCEPTION
      'compound class migration aborted: % bank cap-table row(s) still name a retired class',
      stale;
  END IF;
END $$;
