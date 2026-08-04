-- Persist which predefined catalog name a bank program was built from.
--
-- Until now the link was inferred in the browser by string-matching
-- `platform_enumeration.labelEn === bank_program.friendlyName`, so a renamed
-- catalog entry silently orphaned every program built from it and free text
-- slipped through. The key is now stored and validated server-side
-- (`PROGRAM_NAME_KEY_UNKNOWN`, 422).
--
-- Nullable in the DB (legacy rows + `BankOffer` snapshots reference programs by
-- string), REQUIRED by the create/update DTOs. A follow-up migration may set
-- NOT NULL once every environment reports zero NULLs.

ALTER TABLE "bank_program" ADD COLUMN "programNameKey" VARCHAR(64);

-- Backfill with exactly the heuristic the admin form used, now that the junk
-- catalog rows are gone (migration 20260803090000): anything that still matches
-- a catalog label was genuinely built from that archetype.
UPDATE "bank_program" bp
SET "programNameKey" = pe."key"
FROM "platform_enumeration" pe
WHERE pe."type" = 'program_name'
  AND pe."labelEn" = bp."friendlyName"
  AND bp."programNameKey" IS NULL;

CREATE INDEX "idx_bank_program_program_name_key"
  ON "bank_program" ("programNameKey");
