-- AlterEnum
-- Admin-initiated customer account status events (super_admin only).
ALTER TYPE "AuditEventType" ADD VALUE 'CUSTOMER_DEACTIVATED';
ALTER TYPE "AuditEventType" ADD VALUE 'CUSTOMER_REACTIVATED';
