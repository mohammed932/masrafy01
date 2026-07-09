-- Drop correlationId columns (Principle VII X-Correlation-Id removed)
ALTER TABLE "sign_in_attempt" DROP COLUMN "correlationId";
ALTER TABLE "audit_event" DROP COLUMN "correlationId";
