-- AlterTable
ALTER TABLE "bank_program"
    ADD COLUMN "isShariaCompliant" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "idx_bank_program_sharia"
    ON "bank_program"("isShariaCompliant");

-- Constitution v1.5.0 / Principle II scope-lock / A26:
-- Platform supports exactly three retail loan categories: personal, car, mortgage.
-- Soft-deactivate all other historical purposes in the platform enumeration registry.
UPDATE "platform_enumeration"
   SET "active" = false,
       "deprecatedAt" = COALESCE("deprecatedAt", now()),
       "updatedAt" = now()
 WHERE "type" = 'loanPurpose'
   AND "key" NOT IN ('personal', 'car', 'mortgage');
