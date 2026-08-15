-- Hard delete for catalog program names — one new audit event type.
--
-- Additive enum member only. No data is rewritten: existing events keep their
-- types, and Postgres appends the label to the enum in place.
--
-- Deliberately NOT reusing PLATFORM_ENUMERATION_DEPRECATED. Deprecation is
-- reversible and leaves the row behind to explain the keys old bank programs
-- still carry; a delete removes the row and its loan-category / question join
-- rows (ON DELETE CASCADE), so this event is the ONLY surviving record that the
-- key existed at all. Reading the two as one would make the audit unable to
-- answer "is this name coming back?".

-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'PLATFORM_ENUMERATION_DELETED';
