-- Audit events for the KIND registry (`enumeration_type_def`).
--
-- Separate values rather than reusing `PLATFORM_ENUMERATION_*` with a payload flag: those
-- events carry `payload.type` = the value's type and `payload.key` = the value's key, and a
-- KIND has only one of those. A reader filtering the existing event would silently read a
-- kind's key as a value's type.
--
-- ADD VALUE is one-way — Postgres cannot drop an enum label — which is why they are added
-- once, together, rather than one per screen that turns out to need auditing.
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'ENUMERATION_TYPE_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'ENUMERATION_TYPE_UPDATED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'ENUMERATION_TYPE_DELETED';
