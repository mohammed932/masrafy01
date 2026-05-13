/*
  Warnings:

  - You are about to drop the column `searchVector` on the `bank_program` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ApprovalTier" AS ENUM ('excellent', 'good', 'moderate', 'low', 'very_low');

-- CreateEnum
CREATE TYPE "DecisionOutcome" AS ENUM ('approved', 'rejected', 'withdrawn');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('draft', 'matched', 'no_match', 'archived', 'erased');

-- CreateEnum
CREATE TYPE "ApplicationPriority" AS ENUM ('lowest_installment', 'lowest_interest', 'fastest_approval', 'least_paperwork');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEventType" ADD VALUE 'APPLICATION_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'APPLICATION_MATCHED';
ALTER TYPE "AuditEventType" ADD VALUE 'APPLICATION_NO_MATCH';
ALTER TYPE "AuditEventType" ADD VALUE 'APPLICATION_RATE_LIMITED';
ALTER TYPE "AuditEventType" ADD VALUE 'MATCHING_ENGINE_RUN';
ALTER TYPE "AuditEventType" ADD VALUE 'DATA_ERASURE_COMPLETED';
ALTER TYPE "AuditEventType" ADD VALUE 'SCORING_ENGINE_VERSION_PROMOTED';

-- DropIndex
DROP INDEX "idx_bank_program_search";

-- AlterTable
ALTER TABLE "bank_program" DROP COLUMN "searchVector";

-- CreateTable
CREATE TABLE "application" (
    "id" VARCHAR(30) NOT NULL,
    "applicantUserId" VARCHAR(30),
    "mobileClientId" VARCHAR(64) NOT NULL,
    "submissionCorrelationId" VARCHAR(36) NOT NULL,
    "idempotencyKey" VARCHAR(128),
    "payloadHash" CHAR(64),
    "status" "ApplicationStatus" NOT NULL DEFAULT 'draft',
    "priority" "ApplicationPriority" NOT NULL,
    "requestedAmountEGP" DECIMAL(13,2) NOT NULL,
    "requestedCurrency" VARCHAR(3) NOT NULL DEFAULT 'EGP',
    "preferredTenorMonths" INTEGER NOT NULL,
    "loanPurpose" VARCHAR(64) NOT NULL,
    "age" INTEGER NOT NULL,
    "isGuest" BOOLEAN NOT NULL DEFAULT true,
    "applicantProfile" JSONB NOT NULL,
    "summary" JSONB NOT NULL,
    "noMatchSummary" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMPTZ(6),
    "erasedAt" TIMESTAMPTZ(6),
    "coldTierKey" VARCHAR(256),
    "engineDurationMs" INTEGER,
    "programsCheckedCount" INTEGER NOT NULL DEFAULT 0,
    "eligibleProgramsCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_offer" (
    "id" VARCHAR(30) NOT NULL,
    "applicationId" VARCHAR(30) NOT NULL,
    "programCode" VARCHAR(32) NOT NULL,
    "programVersion" INTEGER NOT NULL,
    "bankName" VARCHAR(80) NOT NULL,
    "programFriendlyName" VARCHAR(120) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "effectiveRatePercent" DECIMAL(7,4) NOT NULL,
    "monthlyInstallmentEGP" DECIMAL(13,2) NOT NULL,
    "requestedLoanAmountEGP" DECIMAL(13,2) NOT NULL,
    "effectiveLoanAmountEGP" DECIMAL(13,2) NOT NULL,
    "requestedTenorMonths" INTEGER NOT NULL,
    "effectiveTenorMonths" INTEGER NOT NULL,
    "feesBreakdown" JSONB NOT NULL,
    "approvalProbabilityPercent" DECIMAL(5,2) NOT NULL,
    "approvalScore" INTEGER NOT NULL,
    "approvalTier" "ApprovalTier" NOT NULL,
    "approvalFactors" JSONB NOT NULL,
    "engineVersion" VARCHAR(32) NOT NULL,
    "requiredDocuments" VARCHAR(80)[],
    "matchReasons" VARCHAR(80)[],
    "cascadeTrace" JSONB NOT NULL,
    "qualitativeReviewBadge" BOOLEAN NOT NULL DEFAULT false,
    "selfDeclared" BOOLEAN NOT NULL DEFAULT false,
    "maxLoanAvailableEGP" DECIMAL(13,2),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "erasedAt" TIMESTAMPTZ(6),

    CONSTRAINT "bank_offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring_engine_version" (
    "id" VARCHAR(30) NOT NULL,
    "version" VARCHAR(32) NOT NULL,
    "description" VARCHAR(1000),
    "weightsConfig" JSONB NOT NULL,
    "activatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivatedAt" TIMESTAMPTZ(6),
    "activatedByStaffId" VARCHAR(30),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scoring_engine_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_offer_decision" (
    "id" VARCHAR(30) NOT NULL,
    "bankOfferId" VARCHAR(30) NOT NULL,
    "outcome" "DecisionOutcome" NOT NULL,
    "recordedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decisionLatencyMs" INTEGER,

    CONSTRAINT "bank_offer_decision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_application_purpose" ON "application"("loanPurpose");

-- CreateIndex
CREATE UNIQUE INDEX "application_mobileClientId_idempotencyKey_key" ON "application"("mobileClientId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "idx_bank_offer_application" ON "bank_offer"("applicationId");

-- CreateIndex
CREATE INDEX "idx_bank_offer_program_created" ON "bank_offer"("programCode", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "idx_bank_offer_currency" ON "bank_offer"("currency");

-- CreateIndex
CREATE INDEX "idx_bank_offer_approval_score" ON "bank_offer"("approvalScore");

-- CreateIndex
CREATE INDEX "idx_bank_offer_engine_version" ON "bank_offer"("engineVersion");

-- CreateIndex
CREATE UNIQUE INDEX "scoring_engine_version_version_key" ON "scoring_engine_version"("version");

-- CreateIndex
CREATE INDEX "idx_scoring_engine_version_activated" ON "scoring_engine_version"("activatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "bank_offer_decision_bankOfferId_key" ON "bank_offer_decision"("bankOfferId");

-- CreateIndex
CREATE INDEX "idx_bank_offer_decision_recorded" ON "bank_offer_decision"("recordedAt" DESC);

-- CreateIndex
CREATE INDEX "idx_bank_offer_decision_outcome" ON "bank_offer_decision"("outcome");

-- AddForeignKey
ALTER TABLE "bank_offer" ADD CONSTRAINT "bank_offer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring_engine_version" ADD CONSTRAINT "scoring_engine_version_activatedByStaffId_fkey" FOREIGN KEY ("activatedByStaffId") REFERENCES "staff_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_offer_decision" ADD CONSTRAINT "bank_offer_decision_bankOfferId_fkey" FOREIGN KEY ("bankOfferId") REFERENCES "bank_offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Partial unique index — enforces "exactly one active scoring_engine_version" at the DB level (R-002 layer 1)
CREATE UNIQUE INDEX "scoring_engine_version_active_unique"
  ON "scoring_engine_version" ((1))
  WHERE "deactivatedAt" IS NULL;

-- Seed the initial registry row from current SCORING_WEIGHTS + threshold table + baseline factor catalog
INSERT INTO "scoring_engine_version" ("id", "version", "description", "weightsConfig", "activatedAt", "deactivatedAt", "createdAt") VALUES (
  'clseed1100init0000000000000000',
  '1.1.0-init',
  'Initial seeded scoring engine — feature 004 baseline. Captures SCORING_WEIGHTS at deploy time.',
  '{"weights":{"BASE":70,"PREVIOUS_REJECTION":-30,"AGE_NEAR_MIN":-10,"HIGH_DBR":-20,"INCOME_NEAR_MIN":-10,"NOT_CAT_A":-15,"HAS_CD_AT_ABK":15,"LONG_TENURE":10,"PAYROLL_TRANSFER":10,"BANKERS_PROGRAM":20,"PENSIONS_PROGRAM":15,"CLAMP_MIN":10,"CLAMP_MAX":95},"thresholds":{"excellent":80,"good":60,"moderate":40,"low":20},"factorCatalog":{"PAYROLL_TRANSFER":{"labelAr":"تحويل الراتب موثق","labelEn":"Salary-transfer is verified"},"HAS_CD_AT_ABK":{"labelAr":"لديك وديعة لدى البنك التجاري العربي","labelEn":"You have a certificate of deposit at ABK"},"LONG_TENURE":{"labelAr":"خبرة طويلة في الوظيفة الحالية","labelEn":"Long tenure at your current job"},"BANKERS_PROGRAM":{"labelAr":"برنامج خاص بالعاملين بالقطاع المصرفي","labelEn":"Eligible for the bankers program segment"},"PENSIONS_PROGRAM":{"labelAr":"برنامج خاص بأصحاب المعاشات","labelEn":"Eligible for the pensions program segment"},"PREVIOUS_REJECTION":{"labelAr":"رفض سابق مسجل","labelEn":"Previous rejection on file"},"HIGH_DBR":{"labelAr":"نسبة دين مرتفعة","labelEn":"High debt-burden ratio"},"NOT_CAT_A":{"labelAr":"ليس من فئة الشركات أ","labelEn":"Employer is not Cat-A"},"AGE_NEAR_MIN":{"labelAr":"العمر قريب من الحد الأدنى","labelEn":"Age is close to the program minimum"},"INCOME_NEAR_MIN":{"labelAr":"الدخل قريب من الحد الأدنى","labelEn":"Income is close to the program minimum"},"CLAMPED_TO_FLOOR":{"labelAr":"تم رفع النتيجة للحد الأدنى","labelEn":"Score lifted to the minimum"},"CLAMPED_TO_CEILING":{"labelAr":"تم خفض النتيجة للحد الأقصى","labelEn":"Score capped at the maximum"}},"legacy":false}'::jsonb,
  now(),
  NULL,
  now()
);
