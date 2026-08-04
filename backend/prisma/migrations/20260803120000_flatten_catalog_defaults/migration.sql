-- Catalog defaults lose their loan-category dimension.
--
-- A predefined program is a NAME plus ONE flat set of lending values. The loan
-- category is chosen when the bank program is created and lives on
-- `bank_program.productCategory` — the catalog never owned it. Keying
-- `defaults` by category made the catalog restate a dimension it does not own,
-- and left prefill picking a branch from a category the form no longer sends.
--
-- DEPLOY ORDER: apply this BEFORE rolling the new backend. `validateProgramDefaults`
-- runs with `forbidNonWhitelisted`, so a row still keyed by category is not an
-- unknown-but-ignored shape — prefill would answer 400 for that program name
-- instead of degrading to "no catalog layer".
--
-- Collapse precedence: personal -> car -> mortgage -> business. Fourteen of the
-- sixteen seeded archetypes carry exactly one category and collapse losslessly.
-- The two that do not — `doctor` (personal + car) and `pharmacy` (personal +
-- car + business) — resolve to their personal variant: personal is the widest,
-- unsecured baseline, and the secured car / business variants existed only as
-- an artefact of the category split being removed here.
--
-- Only a category holding a non-empty JSON object can win. A present-but-empty
-- object and a JSON `null` are absences, not values: letting either win would
-- discard a populated sibling, and a stored `null` would then break every
-- reader that treats `defaults` as an object. When no category qualifies the
-- row collapses to `{}` — the same "no defaults yet" state a fresh name has.
--
-- Rows already flat and rows still at `{}` match nothing and are left as they
-- are, so this statement is safe to re-run.
UPDATE "platform_enumeration" AS pe
SET "defaults" = COALESCE(
      (
        SELECT pe."defaults" -> c.category
        FROM unnest(ARRAY['personal', 'car', 'mortgage', 'business'])
             WITH ORDINALITY AS c(category, precedence)
        WHERE jsonb_typeof(pe."defaults" -> c.category) = 'object'
          AND pe."defaults" -> c.category <> '{}'::jsonb
        ORDER BY c.precedence
        LIMIT 1
      ),
      '{}'::jsonb
    )
WHERE pe."type" = 'program_name'
  AND pe."defaults" ?| ARRAY['personal', 'car', 'mortgage', 'business'];
