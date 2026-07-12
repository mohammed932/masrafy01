-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE 'CUSTOMER_PROFILE_COMPLETED';

-- DropForeignKey
ALTER TABLE "customer_provider" DROP CONSTRAINT "customer_provider_customerId_fkey";

-- DropForeignKey
ALTER TABLE "customer_refresh_token" DROP CONSTRAINT "customer_refresh_token_customerId_fkey";

-- DropForeignKey
ALTER TABLE "customer_refresh_token" DROP CONSTRAINT "customer_refresh_token_rotatedFromId_fkey";

-- DropForeignKey
ALTER TABLE "document" DROP CONSTRAINT "document_uploadedByCustomerId_fkey";

-- DropForeignKey
ALTER TABLE "password_reset_token" DROP CONSTRAINT "password_reset_token_customerId_fkey";

-- DropForeignKey
ALTER TABLE "questionnaire_answer" DROP CONSTRAINT "questionnaire_answer_applicationId_fkey";

-- DropForeignKey
ALTER TABLE "questionnaire_answer" DROP CONSTRAINT "questionnaire_answer_customerId_fkey";

-- DropForeignKey
ALTER TABLE "support_request" DROP CONSTRAINT "support_request_customerId_fkey";

-- AlterTable
ALTER TABLE "customer_account" ALTER COLUMN "registrationPath" SET DEFAULT 'PHONE';

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_uploadedByCustomerId_fkey" FOREIGN KEY ("uploadedByCustomerId") REFERENCES "customer_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_refresh_token" ADD CONSTRAINT "customer_refresh_token_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_refresh_token" ADD CONSTRAINT "customer_refresh_token_rotatedFromId_fkey" FOREIGN KEY ("rotatedFromId") REFERENCES "customer_refresh_token"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_provider" ADD CONSTRAINT "customer_provider_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_token" ADD CONSTRAINT "password_reset_token_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questionnaire_answer" ADD CONSTRAINT "questionnaire_answer_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questionnaire_answer" ADD CONSTRAINT "questionnaire_answer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_request" ADD CONSTRAINT "support_request_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "uniq_customer_provider_subject" RENAME TO "customer_provider_provider_providerUserId_key";
