-- AlterEnum
-- Feature 010: audit event types for the two prefill layers (bank lending policy,
-- program_name catalog defaults). Both are prefill-only data, never read at match time.
ALTER TYPE "AuditEventType" ADD VALUE 'BANK_POLICY_UPDATED';
ALTER TYPE "AuditEventType" ADD VALUE 'PROGRAM_CATALOG_DEFAULTS_UPDATED';
