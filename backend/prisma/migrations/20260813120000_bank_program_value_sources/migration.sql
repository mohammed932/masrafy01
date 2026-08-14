-- Feature 011 — value-source markers on a bank program.
--
-- One additive JSONB column, defaulted `{}`. NO BACKFILL, deliberately: the map
-- is SPARSE and an absent path means "the bank stated this". So every program
-- that existed before this feature reads as fully bank-stated on deploy, stays
-- live, and never appears on the waiting list (FR-037). A backfill writing an
-- explicit state per numeric path would both be enormous and destroy the one
-- distinction that matters — "nobody has marked this yet" vs. "we estimated it".
--
-- No index: the column is always read with its row, and the single query that
-- filters on it (`GET /pending-bank-confirmation`) scans ~20 programs.

-- AlterTable
ALTER TABLE "bank_program" ADD COLUMN     "valueSources" JSONB NOT NULL DEFAULT '{}';
