-- I-Score becomes program-level policy: the columns. The figures move in `..090100`.
--
-- WHY TWO MIGRATIONS AND NOT ONE. This one is pure DDL and reversible by dropping three
-- columns; the next one MOVES nine products' tier tables out of their compiled rules and
-- asserts what it found before it deletes anything. Keeping them apart means the move can
-- be re-run, inspected and (if it RAISEs) fixed without the columns having to come and go
-- with it.
--
-- NOTHING READS THESE YET after this file. Every column is NULLABLE with no default and no
-- backfill, so applying this migration alone changes no figure anywhere: `asIScoreTiers`
-- reads a NULL as "states no tiers" and `resolveIScoreFactor` answers that with a 100%
-- multiplier — which is exactly what the `coalesce [iscore_band, {const:'100'}]` step it
-- replaces answered. The 17 programmes that DO have tiers keep reading them through the
-- rule until `..090100` moves them, and that file does both halves in one transaction.

-- The product's default tier table, read by a program that states none of its own.
-- Mirrors `tenorDefaults` / `loanAmountDefaults` / `planDefaults` beside it: live
-- inheritance, and a bank that states its own always wins.
ALTER TABLE "platform_enumeration" ADD COLUMN "iScoreDefaults" JSONB;

-- The multiplier this offer was priced at, frozen. Both NULL on every offer written before
-- today, and absent is NOT 100: "no table was in force / they left the question blank" and
-- "measured, and their score cost them nothing" are different facts about an immutable row
-- (Principle I / A6).
ALTER TABLE "bank_offer" ADD COLUMN "iScoreFactorPercent" DECIMAL(7,4);
ALTER TABLE "bank_offer" ADD COLUMN "iScoreTiersSource" VARCHAR(16);
