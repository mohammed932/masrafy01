-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('needs_first_contact', 'document_collection', 'ready_for_submission', 'submitted_to_bank', 'bank_decided');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEventType" ADD VALUE 'APPLICATION_ACTIVITY_LOGGED';
ALTER TYPE "AuditEventType" ADD VALUE 'DOCUMENT_UPLOADED';
ALTER TYPE "AuditEventType" ADD VALUE 'APPLICATION_REASSIGNED';
ALTER TYPE "AuditEventType" ADD VALUE 'MANAGER_ATTENTION_REQUESTED';
ALTER TYPE "AuditEventType" ADD VALUE 'APPLICATION_LEAD_STATUS_CHANGED';

-- AlterTable
ALTER TABLE "application" ADD COLUMN     "assignedAgentStaffId" VARCHAR(30),
ADD COLUMN     "assignedAt" TIMESTAMPTZ(6),
ADD COLUMN     "leadStatus" "LeadStatus" NOT NULL DEFAULT 'needs_first_contact';

-- CreateTable
CREATE TABLE "activity" (
    "id" VARCHAR(30) NOT NULL,
    "applicationId" VARCHAR(30) NOT NULL,
    "actorStaffId" VARCHAR(30) NOT NULL,
    "actorRole" VARCHAR(32) NOT NULL,
    "activityType" VARCHAR(48) NOT NULL,
    "reason" VARCHAR(64) NOT NULL,
    "note" VARCHAR(2000),
    "durationMinutes" INTEGER,
    "outcomeFlags" VARCHAR(48)[],
    "followUpAt" TIMESTAMPTZ(6),
    "attachedDocumentIds" VARCHAR(30)[],
    "meta" JSONB,
    "correlationId" VARCHAR(36) NOT NULL,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document" (
    "id" VARCHAR(30) NOT NULL,
    "applicationId" VARCHAR(30) NOT NULL,
    "documentType" VARCHAR(64) NOT NULL,
    "s3Key" VARCHAR(256) NOT NULL,
    "status" VARCHAR(24) NOT NULL,
    "uploadedByContext" VARCHAR(24) NOT NULL,
    "uploadedBySource" VARCHAR(24) NOT NULL,
    "uploadedByStaffId" VARCHAR(30),
    "originalFilename" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(48) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMPTZ(6),
    "verifiedByStaffId" VARCHAR(30),
    "erasedAt" TIMESTAMPTZ(6),

    CONSTRAINT "document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_activity_application_occurred" ON "activity"("applicationId", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "idx_activity_actor_occurred" ON "activity"("actorStaffId", "occurredAt" DESC);

-- CreateIndex (partial: only rows with a pending reminder)
CREATE INDEX "idx_activity_followup" ON "activity"("followUpAt") WHERE "followUpAt" IS NOT NULL;

-- CreateIndex
CREATE INDEX "idx_activity_type_reason" ON "activity"("activityType", "reason");

-- CreateIndex
CREATE UNIQUE INDEX "document_s3Key_key" ON "document"("s3Key");

-- CreateIndex
CREATE INDEX "idx_document_application_type_status" ON "document"("applicationId", "documentType", "status");

-- CreateIndex
CREATE INDEX "idx_document_uploader_created" ON "document"("uploadedByStaffId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "idx_application_agent_lead_status" ON "application"("assignedAgentStaffId", "leadStatus");

-- CreateIndex
CREATE INDEX "idx_application_lead_status_created" ON "application"("leadStatus", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "application" ADD CONSTRAINT "application_assignedAgentStaffId_fkey" FOREIGN KEY ("assignedAgentStaffId") REFERENCES "staff_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity" ADD CONSTRAINT "activity_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity" ADD CONSTRAINT "activity_actorStaffId_fkey" FOREIGN KEY ("actorStaffId") REFERENCES "staff_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_uploadedByStaffId_fkey" FOREIGN KEY ("uploadedByStaffId") REFERENCES "staff_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_verifiedByStaffId_fkey" FOREIGN KEY ("verifiedByStaffId") REFERENCES "staff_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ===========================================================================
-- Feature 005 — Append-only enforcement on activity table (R-001).
-- Two-layer defense: repository pattern has no update/delete methods (app layer)
-- PLUS this trigger which makes any direct UPDATE/DELETE raise at DB level.
-- ===========================================================================

CREATE OR REPLACE FUNCTION raise_append_only_activity()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'activity rows are append-only; UPDATE/DELETE forbidden';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER activity_append_only_guard
  BEFORE UPDATE OR DELETE ON activity
  FOR EACH ROW EXECUTE FUNCTION raise_append_only_activity();

-- ===========================================================================
-- Reserved system actor (R-006). Authors STALE_LEAD_FLAGGED + future
-- system-generated activities. isActive=false blocks login; passwordHash is
-- intentionally invalid bcrypt format as paranoia layer 2.
-- ===========================================================================

INSERT INTO "staff_account" (
  "id", "email", "emailDisplay", "name", "passwordHash", "role",
  "isActive", "mustChangePassword", "createdAt", "updatedAt"
) VALUES (
  'clsysactor00000000000000000000',
  'system@masrafy.local',
  'system@masrafy.local',
  'System',
  '!disabled!',
  'super_admin',
  false,
  false,
  now(),
  now()
)
ON CONFLICT ("id") DO NOTHING;
