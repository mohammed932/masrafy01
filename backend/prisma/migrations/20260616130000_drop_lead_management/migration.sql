-- Drop the lead-management subsystem (feature 005): agent activity logging,
-- lead assignment, and the lead-status pipeline. The product core
-- (Application.status, BankOffer, BankOfferDecision) is retained.
--
-- Scoped intentionally to lead-management objects only — unrelated dev-DB
-- drift (e.g. bank.code, customer-auth FKs) is left untouched.

-- Application: drop lead-assignment + lead-status columns, their FK and indexes.
ALTER TABLE "application" DROP CONSTRAINT IF EXISTS "application_assignedAgentStaffId_fkey";
DROP INDEX IF EXISTS "idx_application_agent_lead_status";
DROP INDEX IF EXISTS "idx_application_lead_status_created";
ALTER TABLE "application"
  DROP COLUMN IF EXISTS "assignedAgentStaffId",
  DROP COLUMN IF EXISTS "assignedAt",
  DROP COLUMN IF EXISTS "leadStatus";

-- Activity table (append-only agent/system action log). Dropping the table
-- also drops its append-only trigger; the trigger function is standalone and
-- dropped explicitly afterwards.
DROP TABLE IF EXISTS "activity";
DROP FUNCTION IF EXISTS raise_append_only_activity() CASCADE;

-- LeadStatus enum (now unreferenced).
DROP TYPE IF EXISTS "LeadStatus";
