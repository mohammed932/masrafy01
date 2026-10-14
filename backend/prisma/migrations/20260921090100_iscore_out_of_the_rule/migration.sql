-- I-Score stops being four steps inside nine products' rules and becomes program-level
-- policy. THE FIGURES MOVE; not one of them changes.
--
-- WHY. `emitIScore` compiled the multiplier into `incomeRule`, so the only programs that
-- could carry a bureau-score table were the ones whose rule IS a step pipeline — 17 of 71,
-- and 4 with a table. The other 54 could not state one at all: `shouldConsultIncomeRule`
-- never reads a rule for a payslip applicant who declared a salary, so a figure stored
-- there could never have fired for them, and `stripForeignMethodConfig` dropped
-- `stepParams` on every strategy but `steps` anyway, so it could never have been stored.
-- The score is a property of the APPLICANT, not of one product's arithmetic. Operator
-- decision (2026-09-21): one mechanism, every program.
--
-- WHY NO FIGURE MOVES, and this is the claim the verification checks rather than trusts.
-- `quoteProgram` step 2a applies the multiplier at exactly the point the deleted
-- `iscore_applied` step occupied — after the rule's arithmetic, BEFORE the additional
-- income is added and before `resolveDbrCap` picks a band. Three facts make that an
-- identity rather than an approximation:
--
--   · `output.from` is `iscore_applied` on all nine products and `iscore_applied` reads the
--     step named below as `head`, so re-pointing the output at `head` yields the rule's
--     pre-multiplier answer, which step 2a then multiplies;
--   · NOTHING else names the four ids. Measured: 0 gates and 0 non-iscore steps contain the
--     substring across all nine rules, so the removal cannot dangle a reference;
--   · NO product carries a `combinationRule`, so the declared salary never competed with a
--     multiplied figure and cannot start winning or losing because of where the multiply
--     happens. Measured: 0 of 71 programs on `steps` carry one.
--
-- The CEILING is why step 2a scales two quantities. `school_stage_ceiling` outputs a
-- `maxAmount`, and its tiers scaled that ceiling while they lived in the rule; scaling only
-- the income would have silently dropped I-Score for it.
--
-- WHY A MIGRATION AND NOT THE SEED. `seed:blueprints` skips any product that already holds
-- a calculation, so a blueprint that no longer declares `iScore` never reaches an
-- already-seeded row — code and row would disagree permanently, which is the reasoning
-- `20260907090100` wrote down when it added these same four steps.
--
-- WHAT IS NOT DONE, deliberately: the 54 programs that could not state a table before
-- still state none, and `resolveIScoreFactor` answers that with a 100% multiplier — the
-- same answer the deleted `coalesce [iscore_band, {const:'100'}]` gave. 80/100/110 is an
-- illustration no bank has supplied (all 27 markers below say `team_estimated`), so
-- seeding it onto 42 payslip programs would price a guess into real offers. An operator
-- states a table per program when a bank publishes one.

DO $$
DECLARE
  r              RECORD;
  head           TEXT;
  kept_steps     JSONB;
  new_sources    JSONB;
  k              TEXT;
  v              JSONB;
  moved_products INT := 0;
  moved_programs INT := 0;
  moved_markers  INT := 0;
BEGIN
  -- ---- 1. the nine products ------------------------------------------------
  FOR r IN
    SELECT id, key, "incomeRule", "templateSpec", "valueSources"
    FROM "platform_enumeration"
    WHERE type = 'surrogate_product'
      AND "incomeRule" -> 'stepParams' ? 'iscore_band'
    ORDER BY key
  LOOP
    -- The step `iscore_applied` multiplies: `of[0]` is the rule's own answer, `of[1]` is the
    -- factor. Read rather than assumed — a product whose shape put something else there
    -- must stop this migration, not be rewired by it.
    SELECT s -> 'of' -> 0 ->> 'step'
      INTO head
      FROM jsonb_array_elements(r."incomeRule" -> 'steps') s
     WHERE s ->> 'id' = 'iscore_applied';

    IF head IS NULL THEN
      RAISE EXCEPTION 'iscore: % has an iscore_band table but no iscore_applied step to unwire', r.key;
    END IF;

    IF r."incomeRule" -> 'output' ->> 'from' <> 'iscore_applied' THEN
      RAISE EXCEPTION 'iscore: % output.from is %, not iscore_applied — refusing to guess its head',
        r.key, r."incomeRule" -> 'output' ->> 'from';
    END IF;

    -- The head must SURVIVE the removal, or the rule ends up pointing at nothing.
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(r."incomeRule" -> 'steps') s
       WHERE s ->> 'id' = head
         AND s ->> 'id' NOT IN ('iscore_src','iscore_band','iscore_factor','iscore_applied')
    ) THEN
      RAISE EXCEPTION 'iscore: % head % is itself an iscore step or absent', r.key, head;
    END IF;

    -- ORDER PRESERVED. A fresh compile and a migrated row must be the same list in the same
    -- order, or the next template save reads as a structural change on a product nobody
    -- touched — the property `20260907090100` established when it inserted these steps
    -- rather than appending them.
    SELECT COALESCE(jsonb_agg(s ORDER BY ord), '[]'::jsonb)
      INTO kept_steps
      FROM jsonb_array_elements(r."incomeRule" -> 'steps') WITH ORDINALITY t(s, ord)
     WHERE s ->> 'id' NOT IN ('iscore_src','iscore_band','iscore_factor','iscore_applied');

    -- The MARKERS travel with the figures they are about. Re-rooted from
    -- `incomeRule.stepParams.iscore_band.` to `iScoreDefaults.`, exactly as a program's
    -- markers were re-rooted when its figures moved onto the name. Left behind they would
    -- name a path that no longer exists, and the three estimates would read as bank-stated.
    new_sources := '{}'::jsonb;
    FOR k, v IN SELECT * FROM jsonb_each(COALESCE(r."valueSources", '{}'::jsonb))
    LOOP
      IF k LIKE 'incomeRule.stepParams.iscore_band.%' THEN
        new_sources := new_sources || jsonb_build_object(
          'iScoreDefaults.' || substring(k FROM length('incomeRule.stepParams.iscore_band.') + 1),
          v
        );
        moved_markers := moved_markers + 1;
      ELSE
        new_sources := new_sources || jsonb_build_object(k, v);
      END IF;
    END LOOP;

    UPDATE "platform_enumeration"
       SET "iScoreDefaults" = r."incomeRule" -> 'stepParams' -> 'iscore_band',
           "incomeRule" = jsonb_set(
             jsonb_set(
               r."incomeRule" #- '{stepParams,iscore_band}',
               '{steps}',
               kept_steps
             ),
             '{output,from}',
             to_jsonb(head)
           ),
           -- The FLAG goes with the emitter. `ProductTemplate.iScore` is still accepted on
           -- the way in so a stored spec written before today parses, but it compiles to
           -- nothing — leaving it set would make the product screen offer a tick that does
           -- nothing at all.
           "templateSpec" = CASE
             WHEN r."templateSpec" IS NULL THEN NULL
             ELSE r."templateSpec" - 'iScore'
           END,
           "valueSources" = new_sources,
           "updatedAt" = now()
     WHERE id = r.id;

    moved_products := moved_products + 1;
  END LOOP;

  -- ---- 2. the four bank programs holding their OWN tiers -------------------
  --
  -- A frozen copy of the product's table, one slot deep in `stepParams`. It moves to the
  -- blob key the new reader looks at; the slot goes, because a figure keyed by a step id
  -- nothing emits is a number that disappears while the program reads as configured.
  FOR r IN
    SELECT id, "programCode", "incomeAssumption"
    FROM "bank_program"
    WHERE "incomeAssumption" -> 'stepParams' ? 'iscore_band'
    ORDER BY "programCode"
  LOOP
    UPDATE "bank_program"
       SET "incomeAssumption" = jsonb_set(
             r."incomeAssumption" #- '{stepParams,iscore_band}',
             '{iScoreTiers}',
             r."incomeAssumption" -> 'stepParams' -> 'iscore_band'
           ),
           "updatedAt" = now()
     WHERE id = r.id;

    moved_programs := moved_programs + 1;
  END LOOP;

  -- ---- 3. the post-conditions, asserted rather than trusted ---------------
  IF EXISTS (
    SELECT 1 FROM "platform_enumeration"
     WHERE "incomeRule"::text LIKE '%iscore%'
  ) THEN
    RAISE EXCEPTION 'iscore: an iscore reference survives in a platform_enumeration incomeRule';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "bank_program"
     WHERE "incomeAssumption" -> 'stepParams' ? 'iscore_band'
  ) THEN
    RAISE EXCEPTION 'iscore: a bank program still holds an iscore_band slot';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "platform_enumeration"
     WHERE "valueSources"::text LIKE '%iscore_band%'
  ) THEN
    RAISE EXCEPTION 'iscore: an estimate marker still names the retired slot';
  END IF;

  -- Every product that HAD a table must now state one, and its rule must point at a step
  -- that exists. The second half is what catches a mis-wired `output.from`, which would
  -- otherwise surface as `rule_unconfigured` on a live quote rather than here.
  IF (SELECT count(*) FROM "platform_enumeration"
       WHERE type = 'surrogate_product' AND "iScoreDefaults" IS NOT NULL) <> moved_products THEN
    RAISE EXCEPTION 'iscore: moved % products but % hold tiers',
      moved_products,
      (SELECT count(*) FROM "platform_enumeration"
        WHERE type = 'surrogate_product' AND "iScoreDefaults" IS NOT NULL);
  END IF;

  IF EXISTS (
    SELECT 1
      FROM "platform_enumeration" p
     WHERE p."incomeRule" IS NOT NULL
       AND p."incomeRule" -> 'output' ? 'from'
       AND NOT EXISTS (
         SELECT 1 FROM jsonb_array_elements(p."incomeRule" -> 'steps') s
          WHERE s ->> 'id' = p."incomeRule" -> 'output' ->> 'from'
       )
  ) THEN
    RAISE EXCEPTION 'iscore: a rule output names a step that is not in its step list';
  END IF;

  RAISE NOTICE 'iscore: % product(s) moved, % marker(s) re-rooted, % program copy/copies moved',
    moved_products, moved_markers, moved_programs;
END $$;
