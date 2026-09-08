-- Illustrative I-Score tiers on every surrogate product that adjusts by one.
--
-- WHY. `20260907090100` gave all nine rule-bearing products the four I-Score steps and NOT one
-- figure, so `iscore_band` was blank on every product and every bank program: the compiled
-- `coalesce [iscore_band, const '100']` answered every applicant at 100% and the whole feature
-- was inert. Operator decision (2026-09-07): seed the tiers, and let a bank program override
-- them per tier. The tiers a bank leaves blank are read from the product
-- (`withInheritedDbrCap`'s sibling `withInheritedSlots`), which is what makes ONE statement here
-- reach every bank selling the product.
--
-- THE FIGURES ARE AN ILLUSTRATION AND ARE MARKED AS ONE. Spec §10.10 is explicit: "the design
-- record's 80% / 100% / 110% is an illustration, not a bank's table. The prototypes all carry a
-- single 100% Standard row, i.e. no bank has supplied one yet." So all three figures are written
-- to `valueSources` as `team_estimated`, which is how every other unpublished figure in this
-- database is labelled, and the screens print them as estimates until a bank supplies real ones.
--
--   [0, 550)    80%     under the tier the bureau reports as thin / adverse
--   [550, 700)  100%    the standard tier — the only row the prototypes carry
--   [700, ∞)    110%    the tier a bank rewards
--
-- COVERAGE IS TOTAL, and that is now enforced rather than conventional. The lowest tier starts at
-- 0 and the top tier is open, because a score the table does not cover is answered
-- `no_matching_band` — which on a MULTIPLIER is fatal (`SURROGATE_NO_MATCHING_ROW`), not a
-- smaller quote. `validateBands`' new `coverAll` refuses anything else at save time; this seed
-- has to satisfy the same rule, and the assertions below check that it did.
--
-- WHY A MIGRATION AND NOT THE SEED. `npm run seed:sheet-figures` skips any product that already
-- holds figures (`planCatalogFigures`), and all nine do. The same rows are added to
-- `CATALOG_FIGURES` in the same change, so a re-run reports 0 written / 0 refused and a database
-- rebuilt from nothing gets the identical tiers.
--
-- IDEMPOTENT, AND IT NEVER OVERWRITES AN OPERATOR. Only a product whose `iscore_band` states no
-- bands is written; a product where somebody has typed real tiers is left exactly as it is.

UPDATE "platform_enumeration" p
SET "incomeRule" = jsonb_set(
      p."incomeRule",
      '{stepParams}',
      COALESCE(p."incomeRule" -> 'stepParams', '{}'::jsonb)
        || jsonb_build_object(
             'iscore_band',
             jsonb_build_object(
               'bands',
               jsonb_build_array(
                 jsonb_build_object('fromInclusive', '0',   'toExclusive', '550',      'incomeEGP', '80'),
                 jsonb_build_object('fromInclusive', '550', 'toExclusive', '700',      'incomeEGP', '100'),
                 jsonb_build_object('fromInclusive', '700', 'toExclusive', null,       'incomeEGP', '110')
               )
             )
           )
    ),
    "valueSources" = COALESCE(p."valueSources", '{}'::jsonb)
      || jsonb_build_object(
           'incomeRule.stepParams.iscore_band.bands.0.incomeEGP', 'team_estimated',
           'incomeRule.stepParams.iscore_band.bands.1.incomeEGP', 'team_estimated',
           'incomeRule.stepParams.iscore_band.bands.2.incomeEGP', 'team_estimated'
         ),
    "updatedAt" = now()
WHERE p."type" = 'surrogate_product'
  AND p."incomeRule" ->> 'strategy' = 'steps'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(p."incomeRule" -> 'steps', '[]'::jsonb)) s
    WHERE s ->> 'id' = 'iscore_band'
  )
  -- "States no tiers" is one clause covering both spellings: the key is absent (or holds
  -- something that is not an array), or it holds an empty one. A product an operator has
  -- already filled in matches neither and is left alone.
  AND jsonb_array_length(
        CASE
          WHEN jsonb_typeof(p."incomeRule" -> 'stepParams' -> 'iscore_band' -> 'bands') = 'array'
            THEN p."incomeRule" -> 'stepParams' -> 'iscore_band' -> 'bands'
          ELSE '[]'::jsonb
        END
      ) = 0;

-- The end state, asserted rather than assumed.
DO $$
DECLARE
  seeded int;
  broken int;
  stray int;
BEGIN
  SELECT count(*) INTO seeded
  FROM "platform_enumeration" p
  WHERE p."type" = 'surrogate_product'
    AND jsonb_array_length(COALESCE(p."incomeRule" -> 'stepParams' -> 'iscore_band' -> 'bands', '[]'::jsonb)) > 0;

  -- Every product carrying the step must now hold a table that covers every score, with all
  -- three figures labelled an estimate.
  SELECT count(*) INTO broken
  FROM "platform_enumeration" p
  WHERE p."type" = 'surrogate_product'
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(p."incomeRule" -> 'steps', '[]'::jsonb)) s
      WHERE s ->> 'id' = 'iscore_band'
    )
    AND (
      jsonb_array_length(COALESCE(p."incomeRule" -> 'stepParams' -> 'iscore_band' -> 'bands', '[]'::jsonb)) = 0
      OR p."incomeRule" -> 'stepParams' -> 'iscore_band' -> 'bands' -> 0 ->> 'fromInclusive' <> '0'
      OR jsonb_typeof(
           p."incomeRule" -> 'stepParams' -> 'iscore_band' -> 'bands'
             -> (jsonb_array_length(p."incomeRule" -> 'stepParams' -> 'iscore_band' -> 'bands') - 1)
             -> 'toExclusive'
         ) <> 'null'
      OR NOT (p."valueSources" ? 'incomeRule.stepParams.iscore_band.bands.0.incomeEGP')
    );

  -- And no product WITHOUT the step may hold the slot: a figure no step reads is an orphan the
  -- next template save would refuse (`PRODUCT_TEMPLATE_ORPHANS_FIGURES`).
  SELECT count(*) INTO stray
  FROM "platform_enumeration" p
  WHERE p."type" = 'surrogate_product'
    AND p."incomeRule" -> 'stepParams' ? 'iscore_band'
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(p."incomeRule" -> 'steps', '[]'::jsonb)) s
      WHERE s ->> 'id' = 'iscore_band'
    );

  IF broken > 0 THEN
    RAISE EXCEPTION 'iscore tiers: % product(s) carry the step without a table covering every score', broken;
  END IF;
  IF stray > 0 THEN
    RAISE EXCEPTION 'iscore tiers: % product(s) hold an iscore_band figure no step reads', stray;
  END IF;
  -- Not an assertion: a database with no blueprints seeded legitimately has none of these.
  RAISE NOTICE 'iscore tiers: % product(s) now state a tier table', seeded;
END $$;
