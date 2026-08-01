-- Sharia-compliance flag frozen onto the offer at match time, mirroring
-- `bankIsFeatured`. Principle I: BankOffer is immutable after creation, so the
-- program attribute is snapshotted rather than joined at read time.
ALTER TABLE "bank_offer"
  ADD COLUMN "isShariaCompliant" BOOLEAN NOT NULL DEFAULT false;
