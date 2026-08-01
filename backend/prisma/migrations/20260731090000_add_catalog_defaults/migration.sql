-- Feature 010 (FR-001..FR-004): per-category lending defaults on `program_name`
-- enumeration members. Prefill-only data — copied into a bank program on save
-- (FR-009) and never read by the matching engine (FR-021b).
ALTER TABLE "platform_enumeration"
  ADD COLUMN "defaults" JSONB NOT NULL DEFAULT '{}';
