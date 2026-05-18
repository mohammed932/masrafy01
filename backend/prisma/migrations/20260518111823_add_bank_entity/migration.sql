-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEventType" ADD VALUE 'BANK_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'BANK_UPDATED';
ALTER TYPE "AuditEventType" ADD VALUE 'BANK_TOGGLED';
ALTER TYPE "AuditEventType" ADD VALUE 'BANK_DELETED';
ALTER TYPE "AuditEventType" ADD VALUE 'BANK_LOGO_UPLOADED';

-- AlterTable
ALTER TABLE "bank_program" ADD COLUMN     "bankId" VARCHAR(30);

-- CreateTable
CREATE TABLE "bank" (
    "id" VARCHAR(30) NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "nameArabic" VARCHAR(120) NOT NULL,
    "nameEnglish" VARCHAR(120) NOT NULL,
    "logoS3Key" VARCHAR(255),
    "websiteUrl" VARCHAR(500),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" VARCHAR(2000),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdBy" VARCHAR(30) NOT NULL,
    "updatedBy" VARCHAR(30) NOT NULL,

    CONSTRAINT "bank_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bank_code_key" ON "bank"("code");

-- CreateIndex
CREATE INDEX "idx_bank_active_order" ON "bank"("isActive", "displayOrder");

-- CreateIndex
CREATE INDEX "idx_bank_program_bank_id" ON "bank_program"("bankId");

-- AddForeignKey
ALTER TABLE "bank_program" ADD CONSTRAINT "bank_program_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "bank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank" ADD CONSTRAINT "bank_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "staff_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank" ADD CONSTRAINT "bank_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "staff_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Backfill: derive Bank rows from existing bank_program.bankName ───────────
-- Dedupe Salesfloor variants (per Phase 1 decision)
UPDATE "bank_program" SET "bankName" = 'Salesfloor Bank' WHERE "bankName" = 'Sales Floor (2026)';

-- Insert one Bank per distinct bankName, auto-deriving an immutable code.
-- Stable id = 'bk_' || first 22 hex chars of md5(bankName) → idempotent across re-runs.
INSERT INTO "bank" (id, code, "nameArabic", "nameEnglish", "isActive", "displayOrder", version, "createdAt", "updatedAt", "createdBy", "updatedBy")
SELECT
  'bk_' || substr(md5(bp."bankName"), 1, 22),
  UPPER(REGEXP_REPLACE(TRIM(bp."bankName"), '[^A-Za-z0-9]+', '_', 'g')),
  bp."bankName",
  bp."bankName",
  true,
  0,
  1,
  NOW(),
  NOW(),
  (SELECT id FROM "staff_account" ORDER BY "createdAt" ASC LIMIT 1),
  (SELECT id FROM "staff_account" ORDER BY "createdAt" ASC LIMIT 1)
FROM (SELECT DISTINCT "bankName" FROM "bank_program") bp
WHERE EXISTS (SELECT 1 FROM "staff_account")
ON CONFLICT (code) DO NOTHING;

-- Trim trailing underscores from auto-derived codes (e.g. "Sales Floor (2026)" → "SALES_FLOOR_2026_" → "SALES_FLOOR_2026")
UPDATE "bank" SET "code" = TRIM(BOTH '_' FROM "code") WHERE "code" LIKE '\_%' ESCAPE '\' OR "code" LIKE '%\_' ESCAPE '\';

-- Backfill bank_program.bankId
UPDATE "bank_program" bp
SET "bankId" = b.id
FROM "bank" b
WHERE b.code = TRIM(BOTH '_' FROM UPPER(REGEXP_REPLACE(TRIM(bp."bankName"), '[^A-Za-z0-9]+', '_', 'g')));
