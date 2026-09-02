-- Surrogate products author their own lists, questions and facts.
--
-- Until now the pieces of a no-payslip product were made in three unrelated
-- places: the list on the Manage-values rail, the question in the questionnaire
-- editor, the fact by a seed script. Only the seed knew they were one thing, and
-- only the seed could guarantee the one invariant that joins them —
-- `question_option.code` === `platform_enumeration.key`. This migration adds the
-- two columns that let the PRODUCT screen make all three, and retires the demo
-- product whose hand-seeded rows were the only worked example of the old way.
--
-- Nothing here is destructive to a live book: both columns are nullable and
-- default NULL, so every existing list keeps behaving exactly as it does today.

-- ---------------------------------------------------------------------------
-- 1. Who authored a list, and which question mirrors it
-- ---------------------------------------------------------------------------

-- The product that made this kind of list. Provenance, not a constraint: any
-- rule may read any list. NULL for all 14 builtins.
ALTER TABLE "enumeration_type_def"
  ADD COLUMN "surrogateProductKey" VARCHAR(48);

-- The question whose options ARE this list, one-for-one by code. Stored, not
-- derived: coverage inference breaks the moment a tenth value is added, which is
-- precisely the moment the sync has to run.
ALTER TABLE "enumeration_type_def"
  ADD COLUMN "mirrorQuestionId" VARCHAR(30);

CREATE INDEX "idx_enumeration_type_def_surrogate_product"
  ON "enumeration_type_def" ("surrogateProductKey");

CREATE INDEX "idx_enumeration_type_def_mirror_question"
  ON "enumeration_type_def" ("mirrorQuestionId");

-- ON DELETE SET NULL, not CASCADE: a question leaving the pool must not take a
-- list of values with it — banks have key tables written against those keys.
ALTER TABLE "enumeration_type_def"
  ADD CONSTRAINT "enumeration_type_def_mirrorQuestionId_fkey"
  FOREIGN KEY ("mirrorQuestionId") REFERENCES "question"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 2. Retire the compound-ownership demo's two list KINDS
-- ---------------------------------------------------------------------------
--
-- The demo product itself (its rule, its five bank programs, its questions and its
-- values) was to be retired by `seed-collateral-products.ts#pruneRetiredDemoProducts`.
-- CORRECTION, written in after the fact: that file was deleted in `ad6d6d0` before it
-- ever ran, so this migration delegated to nothing and the demo rows survived on every
-- database that had seeded them. The work now lives in
-- `scripts/purge-handbuilt-surrogate-products.ts` (`npm run purge:handbuilt`), which is
-- a SCRIPT and not a migration for the reason its own header states: a migration runs on
-- every deploy with nobody present, and this deletes bank programs. It knows the FK order
-- that `application_answer.questionId ON DELETE RESTRICT` imposes.
--
-- Only the two `enumeration_type_def` rows are retired HERE, because that table has no
-- seed-side writer other than the migration that created it. This comment is corrected
-- rather than the SQL changed: the statements below already ran everywhere.
--
-- DEACTIVATED, NOT DELETED, and the first draft of this migration got that wrong.
-- Three reasons, each on its own sufficient:
--
--   1. A KIND cannot be deleted while values of it survive — `deleteType` refuses
--      with `ENUMERATION_TYPE_IN_USE`, because `listTypeStats` would then surface
--      those rows under an unlabelled rail entry nobody can manage. A migration
--      that does what the service refuses to do is a migration that manufactures
--      the state the service exists to prevent.
--   2. Operators DO add values. A dev database already had one. There is no
--      remedy to offer them either: a value's `type` is immutable through the API
--      (there is no move-a-value-to-another-list endpoint), so a guard demanding
--      "move them first" demands something unreachable, and refusing the deploy
--      over it strands the whole migration on one stray row.
--   3. `typeDefinitions()` deliberately returns INACTIVE kinds — its own doc says
--      why: `active` governs whether a kind is OFFERED, and must not decide
--      whether an existing value still has a parent axis. A surviving compound
--      keeps its class, `factParentTable` keeps walking it, and whoever priced
--      off it keeps quoting.
--
-- So: off every picker and off the rail, label intact, axis intact. If the last
-- value ever goes, an operator can delete the kind through the ordinary path.
UPDATE "enumeration_type_def"
   SET "active" = false,
       "onValuesRail" = false,
       "systemOnly" = false,
       "updatedAt" = NOW()
 WHERE "key" IN ('compound', 'compound_category');
