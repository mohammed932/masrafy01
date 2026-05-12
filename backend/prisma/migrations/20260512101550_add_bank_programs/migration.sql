-- CreateEnum
CREATE TYPE "BankProgramType" AS ENUM ('income_proof', 'income_surrogate');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEventType" ADD VALUE 'BANK_PROGRAM_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'BANK_PROGRAM_UPDATED';
ALTER TYPE "AuditEventType" ADD VALUE 'BANK_PROGRAM_TOGGLED';
ALTER TYPE "AuditEventType" ADD VALUE 'BANK_PROGRAM_CLONED';
ALTER TYPE "AuditEventType" ADD VALUE 'BANK_PROGRAM_DELETED';
ALTER TYPE "AuditEventType" ADD VALUE 'BANK_PROGRAM_RATE_UPDATED';
ALTER TYPE "AuditEventType" ADD VALUE 'BANK_PROGRAM_QUALITATIVE_REVIEW_DECIDED';

-- AlterTable
ALTER TABLE "audit_event" ADD COLUMN     "bankProgramId" VARCHAR(30);

-- CreateTable
CREATE TABLE "bank_program" (
    "id" VARCHAR(30) NOT NULL,
    "programCode" VARCHAR(32) NOT NULL,
    "bankName" VARCHAR(80) NOT NULL,
    "friendlyName" VARCHAR(120) NOT NULL,
    "friendlyNameAr" VARCHAR(120),
    "programType" "BankProgramType" NOT NULL,
    "productCategory" VARCHAR(64) NOT NULL,
    "currencies" VARCHAR(3)[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "operatorNotes" VARCHAR(4000),
    "operatorTips" VARCHAR(500)[],
    "requiredDocuments" VARCHAR(80)[],
    "tenor" JSONB NOT NULL,
    "loanLimits" JSONB NOT NULL,
    "pricing" JSONB NOT NULL,
    "eligibility" JSONB NOT NULL,
    "performanceCriteria" JSONB,
    "incomeAssumption" JSONB NOT NULL,
    "fees" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdBy" VARCHAR(30) NOT NULL,
    "updatedBy" VARCHAR(30) NOT NULL,

    CONSTRAINT "bank_program_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bank_program_programCode_key" ON "bank_program"("programCode");

-- CreateIndex
CREATE INDEX "idx_bank_program_active" ON "bank_program"("active");

-- CreateIndex
CREATE INDEX "idx_bank_program_bank_name" ON "bank_program"("bankName");

-- CreateIndex
CREATE INDEX "idx_bank_program_product_category" ON "bank_program"("productCategory");

-- CreateIndex
CREATE INDEX "idx_audit_event_bank_program_time" ON "audit_event"("bankProgramId", "occurredAt" DESC);

-- AddForeignKey
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_bankProgramId_fkey" FOREIGN KEY ("bankProgramId") REFERENCES "bank_program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_program" ADD CONSTRAINT "bank_program_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "staff_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_program" ADD CONSTRAINT "bank_program_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "staff_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- T006: searchVector generated tsvector column + GIN index (FR-016 bilingual search, research.md R9)
ALTER TABLE "bank_program"
  ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', lower(coalesce("programCode", ''))), 'A') ||
    setweight(to_tsvector('simple', lower(coalesce("friendlyName", ''))), 'B') ||
    setweight(to_tsvector('simple', lower(coalesce("friendlyNameAr", ''))), 'B')
  ) STORED;

CREATE INDEX "idx_bank_program_search" ON "bank_program" USING GIN ("searchVector");
