-- Feature 013 — program-level eligibility conditions (see schema.prisma, BankProgram.conditions).
-- Nullable, no backfill: NULL reads as "no conditions", so no program's quote moves.
ALTER TABLE "bank_program" ADD COLUMN "conditions" JSONB;
