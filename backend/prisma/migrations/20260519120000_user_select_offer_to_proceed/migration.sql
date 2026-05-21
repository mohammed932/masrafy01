-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE 'APPLICATION_USER_PROCEEDED';

-- AlterTable
ALTER TABLE "application"
    ADD COLUMN "userSelectedBankOfferId" VARCHAR(30),
    ADD COLUMN "userProceededAt" TIMESTAMPTZ(6);

-- CreateIndex
CREATE INDEX "idx_application_user_proceeded_at"
    ON "application"("userProceededAt" DESC);

-- AddForeignKey
ALTER TABLE "application"
    ADD CONSTRAINT "application_userSelectedBankOfferId_fkey"
    FOREIGN KEY ("userSelectedBankOfferId")
    REFERENCES "bank_offer"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: every historical "matched" application with at least one bank offer
-- is treated as "user proceeded" so existing admin dashboards keep working.
-- Selected offer = highest approvalScore (tie-break by createdAt asc).
UPDATE "application" a
   SET "userProceededAt"        = a."createdAt",
       "userSelectedBankOfferId" = best.id
  FROM (
    SELECT DISTINCT ON (bo."applicationId")
           bo."applicationId",
           bo.id
      FROM "bank_offer" bo
     WHERE bo."erasedAt" IS NULL
     ORDER BY bo."applicationId",
              bo."approvalScore" DESC,
              bo."createdAt"    ASC
  ) AS best
 WHERE a.id = best."applicationId"
   AND a."status" = 'matched'
   AND a."userProceededAt" IS NULL;
