-- One way per bank program: declare the compound guarantee's ways to be ALTERNATIVES, and
-- name the way each existing program already sells.
--
-- WHY. A surrogate product may state several WAYS of reaching its figure. `compound_owner`
-- states five, because four banks sell the same guarantee off four different mechanisms.
-- Nothing made a program pick one: it filled whatever way slots it liked and the compiled rule
-- folded every filled way with `minOf(skipUnset)`, so two filled ways silently became "the
-- lower of the two" — a mechanism no published sheet sells. On this book every program already
-- fills exactly one, so the rule held by convention and was unenforced.
--
-- The refusals ship in the same change as this backfill, and that ordering is the whole point:
-- run the other way round and every correct existing program becomes unsavable (A25).
--
-- WHY BOTH COLUMNS IN STEP 1. `waysAre` is authored on the blueprint's `templateSpec` and
-- carried onto the compiled `incomeRule` by `compileTemplate`. Neither reaches an ALREADY
-- SEEDED database on its own: `npm run seed:blueprints` skips any product that already holds a
-- calculation (a promise to the operator — a re-seed must not undo their figures), so code and
-- row would disagree permanently. The flag adds no step and renames none, so writing it into
-- both blobs here is exactly equivalent to a recompile, and `blueprint:retemplate` is not
-- needed. A fresh database is seeded with it and needs nothing from this file.

-- 1. The product declares that its ways are alternatives.
--
--    Guarded on holding at least two ways, because a one-way product is refused
--    `ways_are_not_applicable` on its next save — a flag that decides nothing is worse than an
--    absent one. Written only where the form or the rule is actually present, so a hand-built
--    calculation (`templateSpec IS NULL`) is left alone.
UPDATE "platform_enumeration"
SET "templateSpec" = jsonb_set("templateSpec", '{waysAre}', '"exclusive"'),
    "incomeRule" = jsonb_set("incomeRule", '{waysAre}', '"exclusive"'),
    "updatedAt" = now()
WHERE "type" = 'surrogate_product'
  AND "key" = 'compound_owner'
  AND "templateSpec" IS NOT NULL
  AND "incomeRule" IS NOT NULL
  AND jsonb_array_length(COALESCE("templateSpec" -> 'alternatives', '[]'::jsonb)) >= 1;

-- 2. Every program under an exclusive product names the way it already sells.
--
--    A WAY IS NOT ONE SLOT. With a second column configured — this product has one —
--    `emitMechanism` returns the `pickByFact` id, so the members of `basis_combine` are picks
--    and each pick spreads into as many COLUMNS as the product has branches. FABMISR's program
--    stores `alt` AND `alt__top_up`: one way, two columns. Counting `stepParams` keys would
--    make it look like two. Nor can the split be read lexically: `alt__unit_paid_to_date` is a
--    way HEAD (the third and later ways are named after the fact they read) while `alt__top_up`
--    is a COLUMN. The two are indistinguishable as strings, so the walk below reads the rule.
DO $$
DECLARE
  offender text;
  filled_count int;
BEGIN
  CREATE TEMP TABLE _ways ON COMMIT DROP AS
  WITH product AS (
    SELECT "key" AS product_key, "incomeRule" AS rule
    FROM "platform_enumeration"
    WHERE "type" = 'surrogate_product' AND "incomeRule" ->> 'waysAre' = 'exclusive'
  ),
  step AS (
    SELECT p.product_key, p.rule, s AS step
    FROM product p, jsonb_array_elements(p.rule -> 'steps') s
  ),
  -- The ways are the step members of `basis`, minus the comparison between them. Reading
  -- `basis` rather than `basis_combine` covers both spellings at once: a product with no
  -- `combine` emits `coalesce [ ...ways ]` and no comparison at all.
  head AS (
    SELECT b.product_key, r ->> 'step' AS head
    FROM step b, jsonb_array_elements(b.step -> 'of') r
    WHERE b.step ->> 'id' = 'basis'
      AND b.step ->> 'op' = 'coalesce'
      AND r ? 'step'
      AND r ->> 'step' <> 'basis_combine'
  )
  SELECT h.product_key,
         -- The FIRST column keeps the bare head id (`emitMechanism`), so it names the way.
         COALESCE(pick.step -> 'of' -> 0 ->> 'step', h.head) AS way_id,
         CASE
           WHEN pick.step IS NULL THEN ARRAY[h.head]
           ELSE ARRAY(
             SELECT r ->> 'step'
             FROM jsonb_array_elements(pick.step -> 'of') r
             WHERE r ? 'step'
           )
         END AS slots
  FROM head h
  LEFT JOIN step pick
    ON pick.product_key = h.product_key
   AND pick.step ->> 'id' = h.head
   AND pick.step ->> 'op' = 'pickByFact';

  CREATE TEMP TABLE _filled ON COMMIT DROP AS
  SELECT bp."programCode",
         w.way_id,
         -- "Holds a figure", the same reading `programFigureKeysUnderProduct` takes: an empty
         -- params entry is a box nobody filled, and counting it would name a way this bank
         -- never sold.
         (
           SELECT count(*)
           FROM unnest(w.slots) slot
           WHERE bp."incomeAssumption" -> 'stepParams' -> slot IS NOT NULL
             AND (
               COALESCE(bp."incomeAssumption" -> 'stepParams' -> slot ->> 'valueEGP', '') <> ''
               OR jsonb_array_length(
                    COALESCE(bp."incomeAssumption" -> 'stepParams' -> slot -> 'keyTable', '[]'::jsonb)
                  ) > 0
               OR jsonb_array_length(
                    COALESCE(bp."incomeAssumption" -> 'stepParams' -> slot -> 'bands', '[]'::jsonb)
                  ) > 0
               OR COALESCE(
                    bp."incomeAssumption" -> 'stepParams' -> slot -> 'scalar' ->> 'value', ''
                  ) <> ''
             )
         ) > 0 AS is_filled
  FROM "bank_program" bp
  JOIN "platform_enumeration" n
    ON n."type" = 'program_name' AND n."key" = bp."programNameKey"
  JOIN _ways w ON w.product_key = n."surrogateProductKey"
  WHERE bp."programType" = 'income_surrogate';

  -- REFUSED rather than guessed. A program filling two ways is one this change cannot make
  -- compliant, and picking one of them would be the platform deciding which mechanism a bank
  -- publishes. Measured before writing this: none do. If one ever appears, the answer is a
  -- grandfather flag on the refusal, not a coin toss here.
  SELECT string_agg(x.code, ', ')
  INTO offender
  FROM (
    SELECT f."programCode" AS code
    FROM _filled f
    WHERE f.is_filled
    GROUP BY f."programCode"
    HAVING count(*) > 1
  ) x;

  SELECT count(*) INTO filled_count FROM _filled WHERE is_filled;

  IF offender IS NOT NULL THEN
    RAISE EXCEPTION
      'program_income_way: %(s) fill more than one way of an exclusive product; pick one before deploying',
      offender;
  END IF;

  -- A program filling NO way is left without a `wayId`. It is already unsavable and already
  -- quotes nothing (`coalesce_empty` refuses it, and the resolver answers `rule_unconfigured`),
  -- so naming a way for it would invent a decision nobody made.
  UPDATE "bank_program" bp
  SET "incomeAssumption" = jsonb_set(bp."incomeAssumption", '{wayId}', to_jsonb(f.way_id)),
      "updatedAt" = now()
  FROM _filled f
  WHERE f."programCode" = bp."programCode"
    AND f.is_filled
    AND bp."incomeAssumption" ->> 'wayId' IS NULL;

  RAISE NOTICE 'program_income_way: % program(s) name a way', filled_count;
END $$;
