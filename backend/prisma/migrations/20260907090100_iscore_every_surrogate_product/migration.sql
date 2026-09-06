-- Every income-bearing surrogate product adjusts by I-Score.
--
-- WHY. "Adjust by I-Score" was a per-PRODUCT tick (`ProductTemplate.iScore`) and no seeded
-- product declared it, so no bank program could state a bureau-score table at all. Operator
-- decision (2026-09-06): I-Score is statable on every surrogate bank program. The blueprints now
-- declare `iScore: true` on all nine rule-bearing products; the three cap-only products guess no
-- income and have nothing to multiply.
--
-- WHY A MIGRATION AND NOT THE SEED. `npm run seed:blueprints` skips any product that already
-- holds a calculation, so a flag added to the blueprint never reaches an already-seeded row and
-- code and row would disagree permanently. Unlike `waysAre`, I-Score ADDS steps, so writing the
-- flag alone is not a recompile — the four steps are written here exactly as `emitIScore` would
-- emit them, and `iscore-every-product.spec.ts` pins that contract against the compiler:
--
--   iscore_src      factNumber  fact = i_score, optional          (an absent answer → unset)
--   iscore_band     bandTable   of iscore_src                     (THE slot a bank fills)
--   iscore_factor   coalesce   [iscore_band, const '100']         (no table → 100%)
--   iscore_applied  percentOf  [<the old output step>, iscore_factor]
--   output.from   → iscore_applied
--
-- WHERE IN THE LIST. The compiler's order is fixed: sources → ways → basis → uplift → share →
-- I-Score → conditions. So the four steps go immediately BEFORE the first `cond__*` step — a
-- condition's own comparison figure (`cond__paidenough__bound` on the compound guarantee) is a
-- STEP emitted after the multiplier — and at the end when a product has none. Not simply appended:
-- a fresh compile and a migrated row must be the same list in the same order, or the next
-- template save would read as a structural change on a product nobody touched.
--
-- NO FIGURE MOVES. I-Score compiles LAST of the arithmetic, so it lands before `resolveDbrCap`
-- picks a band (the reason it lives inside the rule — `iscore-before-dbr.spec.ts`). A bank that
-- states no table multiplies by 100%, and `iscore_band` is a coalesce member, so a blank table
-- never blocks a save. Inserted, never renamed: every existing slot keeps its id (§5.4) and no
-- bank's figure is orphaned.

UPDATE "platform_enumeration" p
SET "templateSpec" = jsonb_set(p."templateSpec", '{iScore}', 'true'::jsonb),
    "incomeRule" = jsonb_set(
      jsonb_set(
        p."incomeRule",
        '{steps}',
        cut.before || jsonb_build_array(
          jsonb_build_object('id', 'iscore_src', 'op', 'factNumber', 'fact', 'i_score', 'optional', true),
          jsonb_build_object('id', 'iscore_band', 'op', 'bandTable', 'of', jsonb_build_object('step', 'iscore_src')),
          jsonb_build_object(
            'id', 'iscore_factor', 'op', 'coalesce',
            'of', jsonb_build_array(jsonb_build_object('step', 'iscore_band'), jsonb_build_object('const', '100'))
          ),
          jsonb_build_object(
            'id', 'iscore_applied', 'op', 'percentOf',
            'of', jsonb_build_array(
              jsonb_build_object('step', p."incomeRule" -> 'output' ->> 'from'),
              jsonb_build_object('step', 'iscore_factor')
            )
          )
        ) || cut.after
      ),
      '{output,from}',
      '"iscore_applied"'::jsonb
    ),
    "updatedAt" = now()
FROM (
  -- The steps split at the first `cond__*` step (or not split at all, when there is none).
  SELECT q."key",
         COALESCE(jsonb_agg(e.step ORDER BY e.ord) FILTER (WHERE e.ord <  q.cut_at), '[]'::jsonb) AS before,
         COALESCE(jsonb_agg(e.step ORDER BY e.ord) FILTER (WHERE e.ord >= q.cut_at), '[]'::jsonb) AS after
  FROM (
    SELECT p2."key", p2."incomeRule",
           COALESCE(
             (SELECT min(o.ord)
              FROM jsonb_array_elements(p2."incomeRule" -> 'steps') WITH ORDINALITY o(step, ord)
              WHERE o.step ->> 'id' LIKE 'cond\_\_%'),
             2147483647
           ) AS cut_at
    FROM "platform_enumeration" p2
    WHERE p2."type" = 'surrogate_product'
      AND p2."incomeRule" ->> 'strategy' = 'steps'
      AND jsonb_typeof(p2."incomeRule" -> 'steps') = 'array'
  ) q,
  jsonb_array_elements(q."incomeRule" -> 'steps') WITH ORDINALITY e(step, ord)
  GROUP BY q."key"
) cut
WHERE cut."key" = p."key"
  AND p."type" = 'surrogate_product'
  AND p."templateSpec" IS NOT NULL
  AND p."incomeRule" IS NOT NULL
  AND p."incomeRule" ->> 'strategy' = 'steps'
  AND p."incomeRule" -> 'output' ->> 'from' IS NOT NULL
  AND COALESCE(p."templateSpec" ->> 'iScore', 'false') <> 'true'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(p."incomeRule" -> 'steps') s WHERE s ->> 'id' = 'iscore_applied'
  );

-- Assert the end state rather than assume it: every blueprint-backed product with a rule now
-- holds the flag AND the step, and none holds one without the other.
DO $$
DECLARE
  offender text;
BEGIN
  SELECT string_agg(p."key", ', ')
  INTO offender
  FROM "platform_enumeration" p
  WHERE p."type" = 'surrogate_product'
    AND p."templateSpec" IS NOT NULL
    AND p."incomeRule" ->> 'strategy' = 'steps'
    AND (
      COALESCE(p."templateSpec" ->> 'iScore', 'false') <> 'true'
      OR NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(p."incomeRule" -> 'steps') s WHERE s ->> 'id' = 'iscore_applied'
      )
      OR p."incomeRule" -> 'output' ->> 'from' <> 'iscore_applied'
    );
  IF offender IS NOT NULL THEN
    RAISE EXCEPTION 'iscore_every_surrogate_product: % left without a consistent I-Score step', offender;
  END IF;
END $$;
