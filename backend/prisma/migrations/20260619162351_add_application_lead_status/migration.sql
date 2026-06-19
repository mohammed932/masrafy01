-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('pending', 'in_progress', 'done', 'cancelled');

-- AlterTable
ALTER TABLE "application" ADD COLUMN     "leadStatus" "LeadStatus" NOT NULL DEFAULT 'pending';

-- CreateIndex
CREATE INDEX "idx_application_lead_status" ON "application"("leadStatus");
