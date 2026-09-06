-- One way per bank program, for EVERY surrogate program: the auto cross-sell declares its two
-- terms to be one way, every other multi-way product states that its ways are alternatives, and
-- every program under a product names the way it sells — single-way products included.
--
-- WHY. `20260904120000` enforced "exactly one way" for the ONE product that declared
-- `waysAre: 'exclusive'`. Everything else was exempt: a multi-way product that forgot the flag
-- folded whatever ways held figures with `minOf(skipUnset)`, and a single-way product recorded no
-- way at all. Operator decision (2026-09-06): every surrogate bank program selects exactly one
-- way, no product exempt. So the default flips to exclusive, `waysOfRule` names a single-way
-- product's way (`primary`) and folds a `'combined'` product's heads into one, and the validator
-- asks every product-backed program for a `wayId`.
--
-- THE CROSS-SELL IS ONE WAY WITH TWO TERMS, NOT TWO WAYS. App. A §4 — "3 × the car instalment OR
-- 10% of the auto loan, whichever is less" — is one sentence a bank fills both halves of. Both
-- ABK programs keep `primary` AND `alt` filled and keep quoting exactly what they quote today; the
-- way they name is `primary`, the first head. NEVER `alt`: that is a SLOT of the one way, not its
-- id, `wayOwnedSlots` answers an empty set for it, and a program on catalog amounts would then
-- inherit nothing.
--
-- The refusals ship in the same change as this backfill, and that ordering is the whole point:
-- run the other way round and every correct existing program becomes unsavable (A25).
--
-- SCOPE. The join below is `bank_program → program_name → surrogate_product`, with BOTH blobs on
-- `strategy = 'steps'`. A payslip name, or a name holding its own hand-wired rule, has no
-- `surrogateProductKey` and drops out of the inner join untouched. The validator asks exactly
-- the programs this join reaches (`IncomeRuleValidationOptions.surrogateProductKey`), so the
-- backfill and the refusal cannot disagree about who is asked.
--
-- WHY BOTH COLUMNS IN STEP 1. `waysAre` is authored on the blueprint's `templateSpec` and carried
-- onto the compiled `incomeRule` by `compileTemplate`. Neither reaches an ALREADY SEEDED database
-- on its own: `npm run seed:blueprints` skips any product that already holds a calculation, so
-- code and row would disagree permanently. The flag adds no step and renames none, so writing it
-- into both blobs is exactly equivalent to a recompile. A fresh database is seeded with it.

-- 1. The auto cross-sell declares that its two heads are the terms of ONE way.
UPDATE "platform_enumeration"
SET "templateSpec" = jsonb_set("templateSpec", '{waysAre}', '"combined"'),
    "incomeRule" = jsonb_set("incomeRule", '{waysAre}', '"combined"'),
    "updatedAt" = now()
WHERE "type" = 'surrogate_product'
  AND "key" = 'auto_loan_crosssell'
  AND "templateSpec" IS NOT NULL
  AND "incomeRule" IS NOT NULL
  AND "templateSpec" -> 'waysAre' IS NULL;

-- 1b. Every other product with two or more ways states `'exclusive'` explicitly.
--
--     Absent now READS as exclusive, so this changes no behaviour; it makes the invariant
--     "`waysAre` is present exactly when the rule holds two or more ways" true of every row, so
--     code and row can be compared by inspection. `templateSpec` is written only where present —
--     a hand-wired calculation has none. Touches nothing on today's book.
UPDATE "platform_enumeration" p
SET "incomeRule" = jsonb_set(p."incomeRule", '{waysAre}', '"exclusive"'),
    "templateSpec" = CASE
      WHEN p."templateSpec" IS NULL THEN NULL
      ELSE jsonb_set(p."templateSpec", '{waysAre}', '"exclusive"')
    END,
    "updatedAt" = now()
WHERE p."type" = 'surrogate_product'
  AND p."incomeRule" ->> 'strategy' = 'steps'
  AND p."incomeRule" -> 'waysAre' IS NULL
  AND (
    SELECT count(*)
    FROM jsonb_array_elements(p."incomeRule" -> 'steps') s,
         jsonb_array_elements(
           CASE WHEN jsonb_typeof(s -> 'of') = 'array' THEN s -> 'of' ELSE '[]'::jsonb END
         ) r
    WHERE s ->> 'id' = 'basis'
      AND s ->> 'op' = 'coalesce'
      AND r ? 'step'
      AND r ->> 'step' <> 'basis_combine'
  ) >= 2;

-- 2. Every program under a product names the way it sells.
--
--    The walk below is `waysOfRule` in SQL. A WAY IS NOT ONE SLOT: with a second column a way
--    spans its head, its columns and its pick (FABMISR's compound program stores `alt` AND
--    `alt__top_up` — one way), and `alt__unit_paid_to_date` (a HEAD) is indistinguishable as a
--    string from `alt__top_up` (a COLUMN). So the rule is read, never the keys.
DO $$
DECLARE
  offender text;
  one_way_count int;
  multi_way_count int;
BEGIN
  CREATE TEMP TABLE _ways ON COMMIT DROP AS
  WITH product AS (
    SELECT "key" AS product_key, "incomeRule" AS rule
    FROM "platform_enumeration"
    WHERE "type" = 'surrogate_product' AND "incomeRule" ->> 'strategy' = 'steps'
  ),
  step AS (
    SELECT p.product_key, p.rule, t.s AS step
    FROM product p, jsonb_array_elements(p.rule -> 'steps') AS t(s)
  ),
  -- MULTI-WAY: the step members of `basis`, minus the comparison between them, in the order
  -- the product declares them. WITH ORDINALITY, because "first" decides a combined way's id.
  basis_head AS (
    SELECT b.product_key, x.r ->> 'step' AS head, x.ord
    FROM step b,
         jsonb_array_elements(
           CASE WHEN jsonb_typeof(b.step -> 'of') = 'array' THEN b.step -> 'of' ELSE '[]'::jsonb END
         ) WITH ORDINALITY AS x(r, ord)
    WHERE b.step ->> 'id' = 'basis'
      AND b.step ->> 'op' = 'coalesce'
      AND x.r ? 'step'
      AND x.r ->> 'step' <> 'basis_combine'
  ),
  -- ONE WAY: no `basis` coalesce at all, so the way IS the head — `primary_pick` behind a
  -- second column, else `primary`. A rule naming neither offers no way and gets none.
  single_head AS (
    SELECT p.product_key,
           CASE
             WHEN EXISTS (SELECT 1 FROM step s WHERE s.product_key = p.product_key AND s.step ->> 'id' = 'primary_pick') THEN 'primary_pick'
             WHEN EXISTS (SELECT 1 FROM step s WHERE s.product_key = p.product_key AND s.step ->> 'id' = 'primary') THEN 'primary'
           END AS head,
           1::bigint AS ord
    FROM product p
    WHERE NOT EXISTS (SELECT 1 FROM basis_head h WHERE h.product_key = p.product_key)
  ),
  head AS (
    SELECT * FROM basis_head
    UNION ALL
    SELECT * FROM single_head WHERE head IS NOT NULL
  ),
  expanded AS (
    SELECT h.product_key, h.ord,
           -- The FIRST column keeps the bare head id (`emitMechanism`), so it names the way.
           COALESCE(pick.step -> 'of' -> 0 ->> 'step', h.head) AS way_id,
           CASE
             WHEN pick.step IS NULL THEN ARRAY[h.head]
             ELSE ARRAY(
               SELECT r ->> 'step'
               FROM jsonb_array_elements(pick.step -> 'of') r
               WHERE r ? 'step'
             ) || ARRAY[h.head]
           END AS slots
    FROM head h
    LEFT JOIN step pick
      ON pick.product_key = h.product_key
     AND pick.step ->> 'id' = h.head
     AND pick.step ->> 'op' = 'pickByFact'
  )
  -- COMBINED: the heads are terms of ONE way — first head's id, UNION of every head's slots.
  -- The union is load-bearing: a catalog-amounts program inherits by these slots, and the first
  -- head's alone would drop `alt` and quote 3 × the instalment with the 10% clamp gone.
  SELECT e.product_key, e.way_id, e.slots
  FROM expanded e
  JOIN product p ON p.product_key = e.product_key
  WHERE COALESCE(p.rule ->> 'waysAre', 'exclusive') <> 'combined'
  UNION ALL
  SELECT k.product_key,
         (SELECT e2.way_id FROM expanded e2 WHERE e2.product_key = k.product_key ORDER BY e2.ord LIMIT 1),
         (SELECT array_agg(DISTINCT s) FROM expanded e3, unnest(e3.slots) s WHERE e3.product_key = k.product_key)
  FROM (SELECT DISTINCT product_key FROM expanded) k
  JOIN product p ON p.product_key = k.product_key
  WHERE p.rule ->> 'waysAre' = 'combined';

  CREATE TEMP TABLE _way_count ON COMMIT DROP AS
  SELECT product_key, count(*) AS n FROM _ways GROUP BY product_key;

  CREATE TEMP TABLE _filled ON COMMIT DROP AS
  SELECT bp."programCode",
         w.product_key,
         w.way_id,
         -- "Holds a figure": the same reading `filledWayIds` and `programFigureKeysUnderProduct`
         -- take. An empty params entry is a box nobody filled.
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
  WHERE bp."programType" = 'income_surrogate'
    AND bp."incomeAssumption" ->> 'strategy' = 'steps';

  -- REFUSED rather than guessed, as before: a program filling two RIVAL ways is one this change
  -- cannot make compliant, and picking one would be the platform deciding which mechanism a
  -- bank publishes. Measured before writing this: none do.
  SELECT string_agg(x.code, ', ')
  INTO offender
  FROM (
    SELECT f."programCode" AS code
    FROM _filled f
    JOIN _way_count c ON c.product_key = f.product_key
    WHERE c.n >= 2 AND f.is_filled
    GROUP BY f."programCode"
    HAVING count(*) > 1
  ) x;

  IF offender IS NOT NULL THEN
    RAISE EXCEPTION
      'one_way_every_program: %(s) fill more than one way of a product; pick one before deploying',
      offender;
  END IF;

  -- ONE-WAY products (and the combined cross-sell): every program under them names the one way,
  -- filled or not. There is nothing to choose, so nothing is invented — and this is what catches
  -- a program on catalog amounts, which stores no `stepParams` at all.
  UPDATE "bank_program" bp
  SET "incomeAssumption" = jsonb_set(bp."incomeAssumption", '{wayId}', to_jsonb(f.way_id)),
      "updatedAt" = now()
  FROM _filled f
  JOIN _way_count c ON c.product_key = f.product_key
  WHERE f."programCode" = bp."programCode"
    AND c.n = 1
    AND bp."incomeAssumption" ->> 'wayId' IS NULL;
  GET DIAGNOSTICS one_way_count = ROW_COUNT;

  -- MULTI-WAY products: exactly one filled way is written; a program filling none is left
  -- without a `wayId` (already unsavable via `coalesce_empty`, so naming one would invent a
  -- decision nobody made). Same posture as `20260904120000`.
  UPDATE "bank_program" bp
  SET "incomeAssumption" = jsonb_set(bp."incomeAssumption", '{wayId}', to_jsonb(f.way_id)),
      "updatedAt" = now()
  FROM _filled f
  JOIN _way_count c ON c.product_key = f.product_key
  WHERE f."programCode" = bp."programCode"
    AND c.n >= 2
    AND f.is_filled
    AND bp."incomeAssumption" ->> 'wayId' IS NULL;
  GET DIAGNOSTICS multi_way_count = ROW_COUNT;

  RAISE NOTICE 'one_way_every_program: % program(s) under a one-way product named it; % under a multi-way product named the way they fill',
    one_way_count, multi_way_count;
END $$;
