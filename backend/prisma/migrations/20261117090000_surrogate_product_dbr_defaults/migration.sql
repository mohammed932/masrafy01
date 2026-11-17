-- A surrogate product's starting debt-burden caps: the flat cap and one per kind of
-- applicant, COPIED into a new bank program's form (never read at quote time).
-- Nullable, no backfill: every product ships stating none, so no quote moves.
ALTER TABLE "platform_enumeration" ADD COLUMN "dbrDefaults" JSONB;
