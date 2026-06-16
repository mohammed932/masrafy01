-- Drop bank `code` (no longer a business key); move uniqueness to nameEnglish.
DROP INDEX "bank_code_key";

ALTER TABLE "bank" DROP COLUMN "code";

CREATE UNIQUE INDEX "bank_nameEnglish_key" ON "bank"("nameEnglish");
