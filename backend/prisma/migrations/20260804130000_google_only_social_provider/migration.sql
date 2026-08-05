-- Constitution v11.0.0 — social sign-in narrows to Google only; Apple is removed
-- end to end (endpoints, verifier, package, env var, and this enum value).
--
-- Postgres cannot drop a value from an enum in place, so the type is recreated.
-- Apple was never reachable from a shipped client (the mobile buttons were a
-- coming-soon toast and a mis-wired Google call), so the deletes below are
-- expected to be no-ops; they exist so the ALTER TYPE cannot fail on data.

-- 1. Remember who is linked via Apple BEFORE the links are deleted. Scoping the
--    deactivation in step 3 to exactly these customers matters: an account that
--    already had no provider link was un-authenticatable before this migration
--    and is none of its business.
CREATE TEMP TABLE apple_linked_customers AS
SELECT DISTINCT "customerId" FROM "customer_provider" WHERE "provider" = 'APPLE';

-- 2. Drop the Apple links and any in-flight Apple social sessions.
DELETE FROM "social_session" WHERE "provider" = 'APPLE';
DELETE FROM "customer_provider" WHERE "provider" = 'APPLE';

-- 3. An Apple-only account has now lost its last way in — no link, no password.
--    Deactivate rather than delete: the customer's applications, offers, and
--    audit trail must survive (Principle VI — the audit log is append-only).
UPDATE "customer_account" c
SET "isActive" = false
WHERE c."id" IN (SELECT "customerId" FROM apple_linked_customers)
  AND c."passwordHash" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "customer_provider" p WHERE p."customerId" = c."id"
  );

DROP TABLE apple_linked_customers;

-- 4. Recreate the enum with GOOGLE only. The type is kept (rather than replaced
--    by a boolean or dropped) because it keys two tables and is where a future
--    provider would be added.
ALTER TYPE "SocialProvider" RENAME TO "SocialProvider_old";
CREATE TYPE "SocialProvider" AS ENUM ('GOOGLE');

ALTER TABLE "customer_provider"
  ALTER COLUMN "provider" TYPE "SocialProvider" USING ("provider"::text::"SocialProvider");
ALTER TABLE "social_session"
  ALTER COLUMN "provider" TYPE "SocialProvider" USING ("provider"::text::"SocialProvider");

DROP TYPE "SocialProvider_old";
