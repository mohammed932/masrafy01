-- Move the income rule's ESTIMATED-VALUE MARKERS onto the catalog name — step 5
-- of 5, and the last thing PR 1 does. Still nothing reads either column.
--
-- `bank_program.valueSources` (`20260813120000_bank_program_value_sources`) is a
-- sparse map of config dot-path → `'team_estimated'`. An ABSENT path means the
-- bank stated the figure; a present one means somebody on this side guessed it,
-- and the program may not go live while any remain (FR-035 / FR-037,
-- `PROGRAM_HAS_ESTIMATED_VALUES`). Paths rooted at `incomeAssumption.` —
-- `incomeAssumption.keyTable.professor.incomeEGP`,
-- `incomeAssumption.bands.0.incomeEGP` — mark figures that step 3 has just copied
-- onto the catalog. The marker has to follow the figure, or it stops describing
-- anything.
--
-- MUST RUN AFTER THE RE-POINT (step 4). It sends each marker to the name the
-- program points at NOW; run before, and ABK-PROFESSORS' markers land on
-- `professional` instead of `professor`.
--
-- ── WHY BOTH HALVES ARE REQUIRED ────────────────────────────────────────────
-- Half (ii) — stripping the moved keys off the program — is not tidying. Once the
-- read moves in PR 2 the program has no `incomeAssumption` for such a path to
-- name, and three things then hold at once:
--
--   * `validateValueSources` rejects the path as unknown, so the program 422s on
--     its next save;
--   * `pruneValueSources` only runs ON UPDATE, so it can never clean it — the
--     save that would prune it is the save that fails;
--   * `toggle(active: true)` reads the STORED map, so the program is refused
--     activation forever.
--
-- A program left holding one of these paths is therefore unfixable from the
-- admin. Leaving half (ii) out is not a smaller change; it is a trap.
--
-- ── WHAT THIS DELIBERATELY DOES NOT DO ──────────────────────────────────────
-- It does not deactivate anything, and it does not mark anything that was not
-- already marked. A marker that blocked ONE program's activation now sits on a
-- name several programs share — which is honest, because all of them really are
-- quoting off that guess — but the FR-035 auto-deactivation stays program-local.
-- One operator marking a shared name must never take another bank's live product
-- dark inside one transaction.

-- ===========================================================================
-- i) Copy the income markers up to the catalog name
-- ===========================================================================
-- Re-rooted `incomeAssumption.` → `incomeRule.` to match the column they now
-- describe. `jsonb_object_agg` over the re-rooted pairs, merged into whatever the
-- name already carries (`|| ` right-hand wins, and the name carries `{}` at this
-- point in the deploy, so nothing of the operator's is overwritten).
--
-- TWO PROGRAMS, ONE NAME: after step 4 no name is reached by two programs that
-- both carry income markers, so there is nothing to reconcile in the seeded data.
-- Should a hand-edited database hold such a pair, `DISTINCT ON (...) ORDER BY
-- "programCode"` makes the winner deterministic and reviewable rather than
-- whichever row the planner reached last — a marker is a warning, and taking the
-- first program alphabetically keeps a re-run and a fresh replay identical.
WITH moved AS (
    SELECT DISTINCT ON (bp."programNameKey")
           bp."programNameKey" AS key,
           (SELECT jsonb_object_agg('incomeRule.' || substr(e.k, length('incomeAssumption.') + 1), e.v)
              FROM jsonb_each(bp."valueSources") AS e(k, v)
             WHERE e.k LIKE 'incomeAssumption.%') AS markers
    FROM "bank_program" bp
    WHERE bp."programNameKey" IS NOT NULL
      AND EXISTS (
            SELECT 1 FROM jsonb_each(bp."valueSources") AS e(k, v)
             WHERE e.k LIKE 'incomeAssumption.%')
    ORDER BY bp."programNameKey", bp."programCode"
)
UPDATE "platform_enumeration" pe
SET "valueSources" = pe."valueSources" || moved.markers,
    "updatedAt"    = now()
FROM moved
WHERE pe."type" = 'program_name'
  AND pe."key" = moved.key
  AND moved.markers IS NOT NULL;

-- ===========================================================================
-- ii) Strip them off the program
-- ===========================================================================
-- `COALESCE(..., '{}'::jsonb)` is load-bearing, not defensive noise:
-- `jsonb_object_agg` over ZERO rows returns NULL, not `{}`. A program whose ONLY
-- markers were income markers would otherwise be written NULL into a NOT NULL
-- column and the migration would abort mid-deploy — on exactly the rows this step
-- exists for.
--
-- The `EXISTS` guard keeps the write to the rows that actually change, so a
-- re-run is a no-op rather than a full-table rewrite that bumps every
-- `updatedAt`. `updatedAt` is deliberately NOT touched here: nothing about the
-- program's own configuration changed, and moving it would misdate the audit
-- trail for a row whose meaning is unaltered.
UPDATE "bank_program" bp
SET "valueSources" = COALESCE(
        (SELECT jsonb_object_agg(e.k, e.v)
           FROM jsonb_each(bp."valueSources") AS e(k, v)
          WHERE e.k NOT LIKE 'incomeAssumption.%'),
        '{}'::jsonb)
WHERE EXISTS (
    SELECT 1 FROM jsonb_each(bp."valueSources") AS e(k, v)
     WHERE e.k LIKE 'incomeAssumption.%');

-- ===========================================================================
-- Report
-- ===========================================================================
-- No exception: an income marker is a "somebody guessed this" flag, and a
-- database with none is the normal state (the seeded catalogs carry markers only
-- where `seed-surrogate-demo.ts` has run). The line exists so the deploy log
-- records what moved, which is the only trace this step leaves.
DO $$
DECLARE
    n int;
BEGIN
    SELECT count(*) INTO n
    FROM "platform_enumeration"
    WHERE "type" = 'program_name' AND "valueSources" <> '{}'::jsonb;

    RAISE NOTICE 'income value sources: % catalog name(s) now carry estimated-figure markers', n;
END $$;
