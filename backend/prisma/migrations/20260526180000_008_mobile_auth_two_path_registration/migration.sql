-- =============================================================================
-- Feature 008 — Mobile Authentication & Two-Path Registration
-- Constitution v1.8.0 / Principle XIII.
--
-- Additive-where-possible migration. Existing customer_account rows are
-- preserved and treated as PHONE-path customers (default value backfill).
-- Tightening of CHECK constraints to enforce path-specific invariants is
-- deferred to a follow-up "tighten" migration once application code stops
-- writing legacy shapes — same approach used for v1.5.0 → v1.6.0.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. New enums.
-- ---------------------------------------------------------------------------
CREATE TYPE "RegistrationPath" AS ENUM ('PHONE', 'SOCIAL');
CREATE TYPE "SocialProvider"   AS ENUM ('GOOGLE', 'APPLE');
CREATE TYPE "OtpPurpose"       AS ENUM ('SIGNUP', 'PROFILE_MOBILE', 'FORGOT_PASSWORD', 'MOBILE_CHANGE');

-- ---------------------------------------------------------------------------
-- 2. AuditEventType — new event values.
-- ---------------------------------------------------------------------------
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CUSTOMER_OTP_REQUESTED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CUSTOMER_OTP_VERIFIED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CUSTOMER_OTP_FAILED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CUSTOMER_SIGNUP_PHONE_COMPLETED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CUSTOMER_SIGNUP_SOCIAL_COMPLETED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CUSTOMER_PROFILE_MOBILE_BOUND';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CUSTOMER_PROFILE_EMAIL_SET';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CUSTOMER_PROFILE_AGE_SET';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CUSTOMER_LOGIN_FAILED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CUSTOMER_LOGIN_LOCKED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CUSTOMER_TOKENS_REVOKED_OTHERS';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CUSTOMER_PASSWORD_RESET';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'APPLICATION_SUBMITTED';

-- ---------------------------------------------------------------------------
-- 3. customer_account — add new columns + relax existing NOT NULLs.
--
-- Existing rows are PHONE customers with full data — backfill registrationPath
-- accordingly. mobileVerifiedAt is backfilled to createdAt because the legacy
-- /v1/auth/signup endpoint required OTP-less phone entry but treated it as a
-- trusted phone for the purpose of the customer record. Operations may opt to
-- re-verify legacy customers later — out of scope here.
-- ---------------------------------------------------------------------------
ALTER TABLE "customer_account"
  ADD COLUMN "registrationPath" "RegistrationPath" NOT NULL DEFAULT 'PHONE',
  ADD COLUMN "mobileVerifiedAt" TIMESTAMPTZ(6),
  ADD COLUMN "age" INTEGER;

-- Backfill mobileVerifiedAt for existing PHONE rows (treat as previously verified).
UPDATE "customer_account"
  SET "mobileVerifiedAt" = "createdAt"
  WHERE "registrationPath" = 'PHONE' AND "mobileVerifiedAt" IS NULL;

-- Drop the default — going forward, callers must pass it explicitly.
ALTER TABLE "customer_account"
  ALTER COLUMN "registrationPath" DROP DEFAULT;

-- Relax NOT NULL on phone + passwordHash so SOCIAL customers can exist
-- in the lite state. Postgres UNIQUE on `phone` already allows multiple NULLs.
ALTER TABLE "customer_account"
  ALTER COLUMN "phone" DROP NOT NULL,
  ALTER COLUMN "passwordHash" DROP NOT NULL;

-- Index on registrationPath for admin filters + path-aware queries.
CREATE INDEX "idx_customer_account_registration_path"
  ON "customer_account" ("registrationPath");

-- ---------------------------------------------------------------------------
-- 4. customer_account — CHECK constraints (NOT VALID so legacy data is
-- grandfathered; new writes must comply).
--
-- Rules (per spec FR-001 / FR-002 / data-model.md):
--   * PHONE customers MUST have phone, mobileVerifiedAt, passwordHash, name.
--     (email is currently optional on the existing PHONE-only schema; we keep
--     that as-is — the spec wants email but legacy data may lack it. Tighten
--     in a follow-up migration once data is backfilled.)
--   * SOCIAL customers MUST have NULL passwordHash.
--   * Age, when set, MUST be 18–80.
-- ---------------------------------------------------------------------------
ALTER TABLE "customer_account"
  ADD CONSTRAINT "customer_account_age_range_check"
  CHECK (age IS NULL OR (age >= 18 AND age <= 80)) NOT VALID;

ALTER TABLE "customer_account"
  ADD CONSTRAINT "customer_account_phone_invariants_check"
  CHECK (
    "registrationPath" = 'SOCIAL'
    OR (
      "registrationPath" = 'PHONE'
      AND "phone" IS NOT NULL
      AND "mobileVerifiedAt" IS NOT NULL
      AND "passwordHash" IS NOT NULL
    )
  ) NOT VALID;

ALTER TABLE "customer_account"
  ADD CONSTRAINT "customer_account_social_no_password_check"
  CHECK (
    "registrationPath" = 'PHONE'
    OR (
      "registrationPath" = 'SOCIAL'
      AND "passwordHash" IS NULL
    )
  ) NOT VALID;

-- ---------------------------------------------------------------------------
-- 5. customer_provider.
-- ---------------------------------------------------------------------------
CREATE TABLE "customer_provider" (
  "id"             VARCHAR(30)  PRIMARY KEY,
  "customerId"     VARCHAR(30)  NOT NULL,
  "provider"       "SocialProvider" NOT NULL,
  "providerUserId" VARCHAR(255) NOT NULL,
  "email"          VARCHAR(320),
  "linkedAt"       TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

ALTER TABLE "customer_provider"
  ADD CONSTRAINT "customer_provider_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "customer_account" ("id") ON DELETE CASCADE;

CREATE UNIQUE INDEX "uniq_customer_provider_subject"
  ON "customer_provider" ("provider", "providerUserId");

CREATE INDEX "idx_customer_provider_customer"
  ON "customer_provider" ("customerId");

-- ---------------------------------------------------------------------------
-- 6. otp_challenge.
-- ---------------------------------------------------------------------------
CREATE TABLE "otp_challenge" (
  "id"           VARCHAR(30)    PRIMARY KEY,
  "customerId"   VARCHAR(30),
  "phone"        VARCHAR(20)    NOT NULL,
  "purpose"      "OtpPurpose"   NOT NULL,
  "codeHash"     VARCHAR(72)    NOT NULL,
  "attemptsLeft" INTEGER        NOT NULL DEFAULT 5,
  "expiresAt"    TIMESTAMPTZ(6) NOT NULL,
  "consumedAt"   TIMESTAMPTZ(6),
  "createdAt"    TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE INDEX "idx_otp_challenge_active"
  ON "otp_challenge" ("phone", "purpose", "expiresAt");

CREATE INDEX "idx_otp_challenge_customer"
  ON "otp_challenge" ("customerId", "expiresAt");

-- ---------------------------------------------------------------------------
-- 7. verified_mobile_token.
-- ---------------------------------------------------------------------------
CREATE TABLE "verified_mobile_token" (
  "id"          VARCHAR(30)    PRIMARY KEY,
  "tokenHash"   CHAR(64)       NOT NULL,
  "phone"       VARCHAR(20)    NOT NULL,
  "expiresAt"   TIMESTAMPTZ(6) NOT NULL,
  "consumedAt"  TIMESTAMPTZ(6),
  "createdAt"   TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "verified_mobile_token_tokenHash_key"
  ON "verified_mobile_token" ("tokenHash");

CREATE INDEX "idx_verified_mobile_token_phone"
  ON "verified_mobile_token" ("phone", "expiresAt");

-- ---------------------------------------------------------------------------
-- 8. social_session.
-- ---------------------------------------------------------------------------
CREATE TABLE "social_session" (
  "id"                 VARCHAR(30)      PRIMARY KEY,
  "provider"           "SocialProvider" NOT NULL,
  "providerUserId"     VARCHAR(255)     NOT NULL,
  "email"              VARCHAR(320),
  "fullName"           VARCHAR(120),
  "resolvedCustomerId" VARCHAR(30),
  "expiresAt"          TIMESTAMPTZ(6)   NOT NULL,
  "consumedAt"         TIMESTAMPTZ(6),
  "createdAt"          TIMESTAMPTZ(6)   NOT NULL DEFAULT now()
);

CREATE INDEX "idx_social_session_subject"
  ON "social_session" ("provider", "providerUserId");

-- ---------------------------------------------------------------------------
-- 9. password_reset_token.
-- ---------------------------------------------------------------------------
CREATE TABLE "password_reset_token" (
  "id"         VARCHAR(30)    PRIMARY KEY,
  "customerId" VARCHAR(30)    NOT NULL,
  "tokenHash"  CHAR(64)       NOT NULL,
  "expiresAt"  TIMESTAMPTZ(6) NOT NULL,
  "consumedAt" TIMESTAMPTZ(6),
  "createdAt"  TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

ALTER TABLE "password_reset_token"
  ADD CONSTRAINT "password_reset_token_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "customer_account" ("id") ON DELETE CASCADE;

CREATE UNIQUE INDEX "password_reset_token_tokenHash_key"
  ON "password_reset_token" ("tokenHash");

CREATE INDEX "idx_password_reset_token_active"
  ON "password_reset_token" ("customerId", "expiresAt");

-- ---------------------------------------------------------------------------
-- 10. questionnaire_answer — server-side persistence (FR-007).
-- payloadJson holds the full questionnaire body (employment, income, amount,
-- priority, etc.). On loan submission the active row's `applicationId` is set
-- to freeze the snapshot — the same row is reused for subsequent edits until
-- submission.
-- ---------------------------------------------------------------------------
CREATE TABLE "questionnaire_answer" (
  "id"            VARCHAR(30)    PRIMARY KEY,
  "customerId"    VARCHAR(30)    NOT NULL,
  "applicationId" VARCHAR(30),
  "payloadJson"   JSONB          NOT NULL,
  "createdAt"     TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ(6) NOT NULL
);

ALTER TABLE "questionnaire_answer"
  ADD CONSTRAINT "questionnaire_answer_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "customer_account" ("id") ON DELETE CASCADE,
  ADD CONSTRAINT "questionnaire_answer_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "application" ("id") ON DELETE SET NULL;

CREATE INDEX "idx_questionnaire_answer_customer"
  ON "questionnaire_answer" ("customerId");

CREATE INDEX "idx_questionnaire_answer_application"
  ON "questionnaire_answer" ("applicationId");

-- =============================================================================
-- NOTES FOR REVIEWERS
-- =============================================================================
-- * CHECK constraints are NOT VALID — they enforce only NEW writes. Legacy
--   customer_account rows are grandfathered. A follow-up "tighten" migration
--   can VALIDATE these once application code stops writing the legacy shape:
--     ALTER TABLE "customer_account" VALIDATE CONSTRAINT "customer_account_phone_invariants_check";
--     etc.
-- * Constitution v1.8.0 removed the guest-application claim endpoint. The
--   audit event CUSTOMER_GUEST_APP_LINKED is retained as a historical value
--   for already-emitted rows; no new code emits it. The /v1/auth/claim-
--   applications HTTP route must be removed in the same PR that lands the
--   service-layer changes (subsequent task list).
-- * Mobile uniqueness (FR-003) is enforced by the existing UNIQUE index on
--   customer_account.phone (Postgres allows multiple NULLs in a regular
--   UNIQUE index, so SOCIAL customers with null phone can coexist).
-- =============================================================================
