-- Constitution v1.6.0 / Principle II scope-lock / A26:
-- Hard removal is the standard when a retail loan category leaves scope.
-- The earlier soft-deactivation migration (20260521120000) is now finished
-- off by physically deleting every artifact tied to a non-{personal,car,mortgage}
-- purpose.
--
-- Activity rows are append-only via a DB trigger (activity_append_only_guard).
-- Disable it for the duration of the wipe, then re-enable.
ALTER TABLE "activity" DISABLE TRIGGER "activity_append_only_guard";

-- 1. Capture the application ids we're about to remove (count + audit).
CREATE TEMP TABLE _to_purge_apps ON COMMIT DROP AS
SELECT id FROM "application"
 WHERE "loanPurpose" NOT IN ('personal', 'car', 'mortgage');

-- 2. Cascade-delete dependents bottom-up.
DELETE FROM "activity"
 WHERE "applicationId" IN (SELECT id FROM _to_purge_apps);

DELETE FROM "bank_offer_decision"
 WHERE "bankOfferId" IN (
   SELECT id FROM "bank_offer"
    WHERE "applicationId" IN (SELECT id FROM _to_purge_apps)
 );

DELETE FROM "bank_offer"
 WHERE "applicationId" IN (SELECT id FROM _to_purge_apps);

DELETE FROM "document"
 WHERE "applicationId" IN (SELECT id FROM _to_purge_apps);

DELETE FROM "application"
 WHERE id IN (SELECT id FROM _to_purge_apps);

-- 3. Drop out-of-scope bank programs (and their remaining bank_offer rows,
--    which may belong to applications kept in the 3 categories — unlikely but
--    guards against accidental orphans).
DELETE FROM "bank_offer"
 WHERE "programCode" IN (
   SELECT "programCode" FROM "bank_program"
    WHERE "productCategory" NOT IN ('personal', 'car', 'mortgage')
 );

DELETE FROM "bank_program"
 WHERE "productCategory" NOT IN ('personal', 'car', 'mortgage');

-- 4. Drop the deprecated platform_enumeration entries entirely.
DELETE FROM "platform_enumeration"
 WHERE "type" = 'loan_purpose'
   AND "key" NOT IN ('personal', 'car', 'mortgage');

-- 5. Audit trail — one synthetic event records what was erased.
INSERT INTO "audit_event" (
  "id", "eventType", "actorId", "targetId", "sourceIp", "correlationId", "payload", "occurredAt"
)
VALUES (
  'cl' || substr(md5(random()::text), 1, 28),
  'DATA_ERASURE_COMPLETED',
  NULL, NULL, NULL,
  gen_random_uuid()::text,
  jsonb_build_object(
    'reason', 'constitution_v1_6_0_scope_lock_hard_wipe',
    'deletedApplications', (SELECT count(*) FROM _to_purge_apps),
    'wipedKeys', ARRAY['buyout', 'education', 'pension', 'secured', 'home_renovation']
  ),
  now()
);

-- Re-enable the append-only guard.
ALTER TABLE "activity" ENABLE TRIGGER "activity_append_only_guard";
