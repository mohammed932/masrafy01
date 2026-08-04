-- Purge the free-text program names that migration
-- `20260724130000_program_name_enumeration` (part 2) promoted into the catalog.
--
-- Why: a bank program's name must come from the operator-curated catalog of
-- archetypes ("Doctor Loans", "New Car", …). The one-off backfill polluted that
-- catalog with per-bank marketing names ("Auto Loan — Prime", "SME Growth
-- Finance"), so the dropdown offered the very free text it was meant to replace.
--
-- Targeted by provenance, not by content: the backfill is the only writer that
-- stamped `id = 'pn_' || md5(…)`, while seeded archetypes carry `clpepn01…` ids
-- and operator-created ones carry cuids. That prefix removes exactly the
-- backfilled rows and cannot reach an archetype an operator added through the
-- catalog board, along with the defaults they tuned on it. Which names the
-- catalog holds is data, so no list of keys belongs in a migration
-- (Principle II).
--
-- Bank programs are NOT touched here; the ones whose name was purged are the
-- demo rows replaced wholesale by `npm run seed:programs -- --wipe`.

DELETE FROM "platform_enumeration"
WHERE "type" = 'program_name'
  AND "id" LIKE 'pn\_%' ESCAPE '\';
