-- Constitution v4.0.0 — Mandatory profile completion (Principle XXXVII) + guest-plumbing removal.
--
-- CustomerAccount: `name` -> `firstName`+`lastName`; `age` -> `birthday` (age derived, never
-- stored); add `profilePhotoKey`. Document: customer-owned National ID docs (nullable
-- `applicationId`, new `customerId`). Application: required customer FK; drop `isGuest` +
-- `mobileClientId`. Refresh-token + support: drop `mobileClientId`.

-- ---------------------------------------------------------------------------
-- CustomerAccount — name split + birthday + profile photo
-- ---------------------------------------------------------------------------
ALTER TABLE "customer_account"
  ADD COLUMN "firstName" VARCHAR(60),
  ADD COLUMN "lastName" VARCHAR(60),
  ADD COLUMN "nameSplitNeedsReview" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "birthday" DATE,
  ADD COLUMN "profilePhotoKey" VARCHAR(256);

-- Backfill name split (best-effort: first token -> firstName, remainder -> lastName).
-- Rows without a space are flagged for admin review. `age` is lossy and dropped: the
-- profile-completeness gate forces re-collection of `birthday` on next apply.
UPDATE "customer_account" SET
  "firstName" = CASE WHEN position(' ' in "name") > 0 THEN split_part("name", ' ', 1) ELSE "name" END,
  "lastName"  = CASE WHEN position(' ' in "name") > 0 THEN substring("name" from position(' ' in "name") + 1) ELSE '' END,
  "nameSplitNeedsReview" = (position(' ' in "name") = 0);

ALTER TABLE "customer_account"
  ALTER COLUMN "firstName" SET NOT NULL,
  ALTER COLUMN "lastName" SET NOT NULL;

ALTER TABLE "customer_account"
  DROP COLUMN "age",
  DROP COLUMN "name";

-- ---------------------------------------------------------------------------
-- Document — allow customer-owned (pre-application) National ID documents
-- ---------------------------------------------------------------------------
ALTER TABLE "document" ALTER COLUMN "applicationId" DROP NOT NULL;
ALTER TABLE "document" ADD COLUMN "customerId" VARCHAR(30);
ALTER TABLE "document"
  ADD CONSTRAINT "document_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "customer_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "idx_document_customer_type_status" ON "document"("customerId", "documentType", "status");
-- Exactly one owner: an application document OR a customer (profile) document.
ALTER TABLE "document"
  ADD CONSTRAINT "document_one_owner"
  CHECK (("applicationId" IS NOT NULL) <> ("customerId" IS NOT NULL));

-- ---------------------------------------------------------------------------
-- Application — required customer FK; drop guest columns
-- ---------------------------------------------------------------------------
-- Pre-launch / dev data audit: remove orphan guest applications (no owning customer).
-- Cascades to bank_offer / activity / document; questionnaire_answer.applicationId is set
-- null. The `activity` append-only USER trigger would block the cascade DELETE, so disable
-- USER triggers on `activity` for the delete (system FK/cascade triggers stay enabled).
ALTER TABLE "activity" DISABLE TRIGGER USER;
DELETE FROM "application" WHERE "applicantUserId" IS NULL;
ALTER TABLE "activity" ENABLE TRIGGER USER;

ALTER TABLE "application" DROP CONSTRAINT "application_applicantUserId_fkey";
DROP INDEX "application_mobileClientId_idempotencyKey_key";

ALTER TABLE "application" ALTER COLUMN "applicantUserId" SET NOT NULL;
ALTER TABLE "application"
  ADD CONSTRAINT "application_applicantUserId_fkey"
  FOREIGN KEY ("applicantUserId") REFERENCES "customer_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "application"
  DROP COLUMN "mobileClientId",
  DROP COLUMN "isGuest";

CREATE UNIQUE INDEX "application_applicantUserId_idempotencyKey_key"
  ON "application"("applicantUserId", "idempotencyKey");

-- ---------------------------------------------------------------------------
-- Refresh-token + Support — drop the (write-only, always-null) mobileClientId
-- ---------------------------------------------------------------------------
ALTER TABLE "customer_refresh_token" DROP COLUMN "mobileClientId";
ALTER TABLE "support_request" DROP COLUMN "mobileClientId";
