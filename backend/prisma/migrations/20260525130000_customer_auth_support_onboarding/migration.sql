-- Constitution v1.7.0 — mobile user-journey Phase 1 alignment.
-- Bundles PR #3 (customer auth + applicantUserId), PR #4 (document customer
-- upload), PR #5 (support module), PR #6 (onboarding screens) at the schema
-- layer so a single `prisma migrate dev` brings devs to the new floor. The
-- code that USES these tables lands across the respective service PRs.

-- ---------------------------------------------------------------------------
-- 1. New AuditEventType enum values.
-- ---------------------------------------------------------------------------
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CUSTOMER_SIGNED_UP';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CUSTOMER_LOGGED_IN';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CUSTOMER_LOGGED_OUT';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CUSTOMER_TOKEN_REFRESHED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CUSTOMER_PASSWORD_CHANGED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CUSTOMER_GUEST_APP_LINKED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'SUPPORT_REQUEST_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'SUPPORT_REQUEST_ASSIGNED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'SUPPORT_REQUEST_RESOLVED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'SUPPORT_CONFIG_UPDATED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'ONBOARDING_SCREEN_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'ONBOARDING_SCREEN_UPDATED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'ONBOARDING_SCREEN_DELETED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'ONBOARDING_SCREEN_REORDERED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CATALOG_VIEWED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'QUESTIONNAIRE_STARTED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'OFFERS_VIEWED';

-- ---------------------------------------------------------------------------
-- 2. Support channel + status enums.
-- ---------------------------------------------------------------------------
CREATE TYPE "SupportChannel" AS ENUM ('chat', 'call', 'whatsapp', 'email');
CREATE TYPE "SupportStatus"  AS ENUM ('open', 'in_progress', 'resolved');

-- ---------------------------------------------------------------------------
-- 3. CustomerAccount + CustomerRefreshToken.
-- ---------------------------------------------------------------------------
CREATE TABLE "customer_account" (
  "id"             VARCHAR(30)  PRIMARY KEY,
  "phone"          VARCHAR(20)  NOT NULL,
  "email"          VARCHAR(320),
  "name"           VARCHAR(120) NOT NULL,
  "locale"         VARCHAR(8)   NOT NULL DEFAULT 'ar-EG',
  "passwordHash"   VARCHAR(72)  NOT NULL,
  "nationalIdHash" CHAR(64),
  "isVerified"     BOOLEAN      NOT NULL DEFAULT false,
  "isActive"       BOOLEAN      NOT NULL DEFAULT true,
  "createdAt"      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt"      TIMESTAMPTZ(6) NOT NULL,
  "lastLoginAt"    TIMESTAMPTZ(6)
);
CREATE UNIQUE INDEX "customer_account_phone_key" ON "customer_account" ("phone");
CREATE UNIQUE INDEX "customer_account_email_key" ON "customer_account" ("email");
CREATE INDEX "idx_customer_account_active_created"
  ON "customer_account" ("isActive", "createdAt" DESC);

CREATE TABLE "customer_refresh_token" (
  "id"             VARCHAR(30)  PRIMARY KEY,
  "customerId"     VARCHAR(30)  NOT NULL,
  "tokenHash"      CHAR(64)     NOT NULL,
  "issuedAt"       TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "expiresAt"      TIMESTAMPTZ(6) NOT NULL,
  "revokedAt"      TIMESTAMPTZ(6),
  "rotatedFromId"  VARCHAR(30),
  "userAgent"      VARCHAR(500),
  "sourceIp"       INET,
  "mobileClientId" VARCHAR(64),
  CONSTRAINT "customer_refresh_token_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "customer_account" ("id") ON DELETE CASCADE,
  CONSTRAINT "customer_refresh_token_rotatedFromId_fkey"
    FOREIGN KEY ("rotatedFromId") REFERENCES "customer_refresh_token" ("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX "customer_refresh_token_tokenHash_key"
  ON "customer_refresh_token" ("tokenHash");
CREATE INDEX "idx_customer_refresh_token_active"
  ON "customer_refresh_token" ("customerId", "revokedAt", "expiresAt");

-- ---------------------------------------------------------------------------
-- 4. Application.applicantUserId — already exists as a loose String column.
--    Add the FK to customer_account (SetNull on customer delete).
-- ---------------------------------------------------------------------------
ALTER TABLE "application"
  ADD CONSTRAINT "application_applicantUserId_fkey"
  FOREIGN KEY ("applicantUserId") REFERENCES "customer_account" ("id")
  ON DELETE SET NULL;

CREATE INDEX "idx_application_customer_created"
  ON "application" ("applicantUserId", "createdAt" DESC);

-- ---------------------------------------------------------------------------
-- 5. Document.uploadedByCustomerId — let mobile customers be the uploader.
-- ---------------------------------------------------------------------------
ALTER TABLE "document"
  ADD COLUMN "uploadedByCustomerId" VARCHAR(30);

ALTER TABLE "document"
  ADD CONSTRAINT "document_uploadedByCustomerId_fkey"
  FOREIGN KEY ("uploadedByCustomerId") REFERENCES "customer_account" ("id")
  ON DELETE SET NULL;

CREATE INDEX "idx_document_customer_uploader_created"
  ON "document" ("uploadedByCustomerId", "createdAt" DESC);

-- ---------------------------------------------------------------------------
-- 6. SupportConfig (singleton) + SupportRequest.
-- ---------------------------------------------------------------------------
CREATE TABLE "support_config" (
  "id"           VARCHAR(16) PRIMARY KEY DEFAULT 'singleton',
  "phone"        VARCHAR(40) NOT NULL,
  "email"        VARCHAR(320) NOT NULL,
  "whatsappUrl"  VARCHAR(500) NOT NULL,
  "hoursAr"      VARCHAR(200) NOT NULL,
  "hoursEn"      VARCHAR(200) NOT NULL,
  "updatedAt"    TIMESTAMPTZ(6) NOT NULL,
  "updatedBy"    VARCHAR(30)
);

-- Seed the singleton row so mobile contact endpoint never 404s.
INSERT INTO "support_config" (
  "id", "phone", "email", "whatsappUrl", "hoursAr", "hoursEn", "updatedAt"
) VALUES (
  'singleton',
  '+20-2-XXXX-XXXX',
  'support@masrafy.eg',
  'https://wa.me/20XXXXXXXXXX',
  'الأحد إلى الخميس · 9 صباحًا – 6 مساءً',
  'Sun–Thu · 9 AM – 6 PM (Cairo time)',
  now()
)
ON CONFLICT ("id") DO NOTHING;

CREATE TABLE "support_request" (
  "id"              VARCHAR(30) PRIMARY KEY,
  "applicationId"   VARCHAR(30),
  "customerId"      VARCHAR(30),
  "mobileClientId"  VARCHAR(64),
  "channel"         "SupportChannel" NOT NULL,
  "note"            VARCHAR(2000),
  "status"          "SupportStatus"  NOT NULL DEFAULT 'open',
  "assignedStaffId" VARCHAR(30),
  "createdAt"       TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "resolvedAt"      TIMESTAMPTZ(6),
  CONSTRAINT "support_request_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "customer_account" ("id") ON DELETE SET NULL
);
CREATE INDEX "idx_support_request_status_created"
  ON "support_request" ("status", "createdAt" DESC);
CREATE INDEX "idx_support_request_agent_status"
  ON "support_request" ("assignedStaffId", "status");
CREATE INDEX "idx_support_request_application"
  ON "support_request" ("applicationId");

-- ---------------------------------------------------------------------------
-- 7. OnboardingScreen.
-- ---------------------------------------------------------------------------
CREATE TABLE "onboarding_screen" (
  "id"         VARCHAR(30) PRIMARY KEY,
  "order"      INTEGER     NOT NULL,
  "titleAr"    VARCHAR(200) NOT NULL,
  "titleEn"    VARCHAR(200) NOT NULL,
  "bodyAr"     VARCHAR(2000) NOT NULL,
  "bodyEn"     VARCHAR(2000) NOT NULL,
  "imageS3Key" VARCHAR(255),
  "active"     BOOLEAN     NOT NULL DEFAULT true,
  "createdAt"  TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt"  TIMESTAMPTZ(6) NOT NULL,
  "updatedBy"  VARCHAR(30)
);
CREATE UNIQUE INDEX "onboarding_screen_order_key" ON "onboarding_screen" ("order");
CREATE INDEX "idx_onboarding_screen_active_order"
  ON "onboarding_screen" ("active", "order");
