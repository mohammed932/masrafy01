-- Feature 011 — two new audit event types.
--
-- Additive enum members only. No data is rewritten: existing events keep their
-- types, and Postgres appends the labels to the enum in place.
--
-- `BANK_PROGRAM_VALUE_SOURCE_CHANGED` is load-bearing beyond the audit trail — it is
-- where `GET /pending-bank-confirmation` reads `waitingSince` from. Without the
-- event there is no record of WHEN a marker arrived, and "waiting 42 days" could
-- only ever be guessed from the row's `updatedAt`, which moves on every unrelated
-- edit.

-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'BANK_PROGRAM_VALUE_SOURCE_CHANGED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'BANK_PROGRAM_DEACTIVATED_BY_ESTIMATE';
