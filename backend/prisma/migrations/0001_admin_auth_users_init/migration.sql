-- Masrafy admin auth + user management initial migration.
-- Constitution v1.0.0 Principle XI: prisma migrate, descriptive name, indexed FKs.

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'VIEWER');

-- CreateEnum
CREATE TYPE "AttemptOutcome" AS ENUM ('SUCCESS', 'WRONG_CREDENTIALS', 'ACCOUNT_INACTIVE', 'LOCKED_OUT');

-- CreateEnum
CREATE TYPE "AuditEventType" AS ENUM (
  'AUTH_LOGIN_SUCCESS',
  'AUTH_LOGIN_FAILURE',
  'AUTH_LOGOUT',
  'AUTH_TOKEN_REFRESHED',
  'AUTH_PASSWORD_CHANGED',
  'AUTH_PASSWORD_FORCED_CHANGE_COMPLETED',
  'ADMIN_USER_CREATED',
  'ADMIN_USER_UPDATED',
  'ADMIN_USER_DEACTIVATED',
  'ADMIN_USER_ROLE_CHANGED',
  'ADMIN_USER_PASSWORD_RESET'
);

-- CreateTable
CREATE TABLE "staff_account" (
  "id"                 VARCHAR(30) NOT NULL,
  "email"              VARCHAR(320) NOT NULL,
  "emailDisplay"       VARCHAR(320) NOT NULL,
  "name"               VARCHAR(120) NOT NULL,
  "passwordHash"       VARCHAR(72) NOT NULL,
  "role"               "StaffRole" NOT NULL,
  "isActive"           BOOLEAN NOT NULL DEFAULT true,
  "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
  "createdAt"          TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt"          TIMESTAMPTZ(6) NOT NULL,
  "lastLoginAt"        TIMESTAMPTZ(6),

  CONSTRAINT "staff_account_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_account_email_key" ON "staff_account"("email");
CREATE INDEX "idx_staff_account_active_role" ON "staff_account"("isActive", "role");

-- CreateTable
CREATE TABLE "refresh_token" (
  "id"            VARCHAR(30) NOT NULL,
  "userId"        VARCHAR(30) NOT NULL,
  "tokenHash"     CHAR(64) NOT NULL,
  "issuedAt"      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "expiresAt"     TIMESTAMPTZ(6) NOT NULL,
  "revokedAt"     TIMESTAMPTZ(6),
  "rotatedFromId" VARCHAR(30),
  "userAgent"     VARCHAR(500),
  "sourceIp"      INET,

  CONSTRAINT "refresh_token_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "refresh_token_tokenHash_key" ON "refresh_token"("tokenHash");
CREATE INDEX "idx_refresh_token_user_active" ON "refresh_token"("userId", "revokedAt", "expiresAt");

-- AddForeignKey
ALTER TABLE "refresh_token" ADD CONSTRAINT "refresh_token_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "staff_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "refresh_token" ADD CONSTRAINT "refresh_token_rotatedFromId_fkey"
  FOREIGN KEY ("rotatedFromId") REFERENCES "refresh_token"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "sign_in_attempt" (
  "id"             VARCHAR(30) NOT NULL,
  "userId"         VARCHAR(30),
  "emailAttempted" VARCHAR(320) NOT NULL,
  "attemptedAt"    TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "outcome"        "AttemptOutcome" NOT NULL,
  "sourceIp"       INET NOT NULL,
  "userAgent"      VARCHAR(500),
  "correlationId"  VARCHAR(36) NOT NULL,

  CONSTRAINT "sign_in_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_sign_in_attempt_email_time" ON "sign_in_attempt"("emailAttempted", "attemptedAt" DESC);
CREATE INDEX "idx_sign_in_attempt_ip_time" ON "sign_in_attempt"("sourceIp", "attemptedAt" DESC);
CREATE INDEX "idx_sign_in_attempt_user_time" ON "sign_in_attempt"("userId", "attemptedAt" DESC);

-- AddForeignKey
ALTER TABLE "sign_in_attempt" ADD CONSTRAINT "sign_in_attempt_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "staff_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "audit_event" (
  "id"            VARCHAR(30) NOT NULL,
  "occurredAt"    TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "actorId"       VARCHAR(30),
  "targetId"      VARCHAR(30),
  "eventType"     "AuditEventType" NOT NULL,
  "sourceIp"      INET,
  "correlationId" VARCHAR(36) NOT NULL,
  "payload"       JSONB NOT NULL DEFAULT '{}',

  CONSTRAINT "audit_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_audit_event_actor_time" ON "audit_event"("actorId", "occurredAt" DESC);
CREATE INDEX "idx_audit_event_target_time" ON "audit_event"("targetId", "occurredAt" DESC);
CREATE INDEX "idx_audit_event_type_time" ON "audit_event"("eventType", "occurredAt" DESC);

-- AddForeignKey
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "staff_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_targetId_fkey"
  FOREIGN KEY ("targetId") REFERENCES "staff_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
