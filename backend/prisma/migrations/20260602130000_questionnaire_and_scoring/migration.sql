-- Feature 00X — Dynamic Questionnaire & Matching (Constitution V v4.1.0).
-- Additive only: new enums + tables for admin-editable questionnaire and
-- per-bank scoring weights, plus two nullable columns on `application`.

-- CreateEnum
CREATE TYPE "LoanCategory" AS ENUM ('personal', 'car', 'mortgage', 'business');
CREATE TYPE "QuestionType" AS ENUM ('SINGLE_SELECT', 'MULTI_SELECT', 'TEXT', 'NUMERIC');
CREATE TYPE "QuestionSystemRole" AS ENUM ('SALARY', 'LOAN_AMOUNT', 'CURRENT_INSTALLMENTS', 'AGE', 'DOWN_PAYMENT', 'TENOR');
CREATE TYPE "ScoringFactorKind" AS ENUM ('DIRECT', 'COMPUTED');
CREATE TYPE "ScoringWeightSetStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'ARCHIVED', 'REJECTED');

-- AlterTable (additive, nullable)
ALTER TABLE "application"
  ADD COLUMN "category" "LoanCategory",
  ADD COLUMN "questionnaireVersionId" VARCHAR(30);

-- CreateTable
CREATE TABLE "question_group" (
    "id" VARCHAR(30) NOT NULL,
    "category" "LoanCategory" NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "titleAr" VARCHAR(160) NOT NULL,
    "titleEn" VARCHAR(160) NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "question_group_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "question" (
    "id" VARCHAR(30) NOT NULL,
    "groupId" VARCHAR(30) NOT NULL,
    "category" "LoanCategory" NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "type" "QuestionType" NOT NULL DEFAULT 'SINGLE_SELECT',
    "questionAr" VARCHAR(500) NOT NULL,
    "questionEn" VARCHAR(500) NOT NULL,
    "helperTextAr" VARCHAR(500),
    "helperTextEn" VARCHAR(500),
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "enabledWhen" JSONB,
    "systemRole" "QuestionSystemRole",
    "scoringFactorCode" VARCHAR(64),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "question_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "question_option" (
    "id" VARCHAR(30) NOT NULL,
    "questionId" VARCHAR(30) NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "labelAr" VARCHAR(200) NOT NULL,
    "labelEn" VARCHAR(200) NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "numericMin" DECIMAL(18,2),
    "numericMax" DECIMAL(18,2),
    "numericPoint" DECIMAL(18,2),
    "scoreValue" DECIMAL(4,3),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "question_option_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "questionnaire_version" (
    "id" VARCHAR(30) NOT NULL,
    "category" "LoanCategory" NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMPTZ(6),
    "publishedBy" VARCHAR(30),
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "questionnaire_version_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "application_answer" (
    "id" VARCHAR(30) NOT NULL,
    "applicationId" VARCHAR(30) NOT NULL,
    "questionId" VARCHAR(30) NOT NULL,
    "questionCode" VARCHAR(64) NOT NULL,
    "selectedOptionId" VARCHAR(30),
    "selectedOptionCode" VARCHAR(64),
    "textValue" VARCHAR(2000),
    "numericValue" DECIMAL(18,2),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "application_answer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "scoring_factor" (
    "id" VARCHAR(30) NOT NULL,
    "category" "LoanCategory" NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "kind" "ScoringFactorKind" NOT NULL DEFAULT 'DIRECT',
    "labelAr" VARCHAR(200) NOT NULL,
    "labelEn" VARCHAR(200) NOT NULL,
    "description" VARCHAR(500),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sourceQuestionCode" VARCHAR(64),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "scoring_factor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "scoring_weight_set" (
    "id" VARCHAR(30) NOT NULL,
    "bankProgramId" VARCHAR(30) NOT NULL,
    "status" "ScoringWeightSetStatus" NOT NULL DEFAULT 'DRAFT',
    "versionNumber" INTEGER NOT NULL,
    "weights" JSONB NOT NULL,
    "createdBy" VARCHAR(30) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedBy" VARCHAR(30),
    "approvedAt" TIMESTAMPTZ(6),
    "rejectedReason" VARCHAR(500),
    CONSTRAINT "scoring_weight_set_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_question_group_category_order" ON "question_group"("category", "displayOrder");
CREATE UNIQUE INDEX "question_group_category_code_key" ON "question_group"("category", "code");
CREATE INDEX "idx_question_group_order" ON "question"("groupId", "displayOrder");
CREATE UNIQUE INDEX "question_category_code_key" ON "question"("category", "code");
CREATE INDEX "idx_question_option_question_order" ON "question_option"("questionId", "displayOrder");
CREATE UNIQUE INDEX "question_option_questionId_code_key" ON "question_option"("questionId", "code");
CREATE INDEX "idx_questionnaire_version_category_active" ON "questionnaire_version"("category", "isActive");
CREATE UNIQUE INDEX "questionnaire_version_category_versionNumber_key" ON "questionnaire_version"("category", "versionNumber");
CREATE INDEX "idx_application_answer_application" ON "application_answer"("applicationId");
CREATE UNIQUE INDEX "application_answer_applicationId_questionId_key" ON "application_answer"("applicationId", "questionId");
CREATE UNIQUE INDEX "scoring_factor_category_code_key" ON "scoring_factor"("category", "code");
CREATE INDEX "idx_scoring_weight_set_program_status" ON "scoring_weight_set"("bankProgramId", "status");
CREATE UNIQUE INDEX "scoring_weight_set_bankProgramId_versionNumber_key" ON "scoring_weight_set"("bankProgramId", "versionNumber");

-- AddForeignKey
ALTER TABLE "question" ADD CONSTRAINT "question_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "question_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "question_option" ADD CONSTRAINT "question_option_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "application_answer" ADD CONSTRAINT "application_answer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "application_answer" ADD CONSTRAINT "application_answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "scoring_weight_set" ADD CONSTRAINT "scoring_weight_set_bankProgramId_fkey" FOREIGN KEY ("bankProgramId") REFERENCES "bank_program"("id") ON DELETE CASCADE ON UPDATE CASCADE;
