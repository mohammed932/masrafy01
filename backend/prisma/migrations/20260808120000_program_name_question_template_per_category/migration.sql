-- Feature: the catalog question TEMPLATE becomes per LOAN CATEGORY.
--
-- `20260808090000_program_name_question_template` keyed the template by
-- (enumerationId, questionId) — one flat set per archetype. That cannot express
-- the thing the admin actually needs to say:
--
--   "Doctor Loans scores on `monthly_income` as a PERSONAL loan,
--    but not as a BUSINESS one."
--
-- because both statements are the same row. A name serves several categories
-- (Principle II: a name is just a name), and the products underneath differ —
-- which is the entire reason `question_loan_category` exists on the other axis.
-- So the suggestion is a fact about the (name, category) PAIR.
--
-- The consumer always has a category to read with: a bank program is
-- (bank, productCategory, programNameKey), so its scoring wizard asks for
-- exactly one set and never has to guess which of several applies.
--
-- STILL ADVISORY, still read by nothing at runtime.
-- `scoring_weight_set.weights.questionWeights` remains the sole authority on
-- what a bank program scores, and `saveWeights` does not consult this table.
-- Adding the category axis does not change that; do not "complete" the feature
-- by wiring it into save validation.
--
-- The category is NOT foreign-keyed to `platform_enumeration_loan_category`, and
-- the service does not reject a pick under an unassigned category. Deliberate,
-- and the same anti-prune posture the out-of-scope question code already takes:
-- a pick left behind when someone narrows the name's categories is KEPT and
-- flagged in the UI, never silently deleted. Re-assign the category and the
-- picks are still there.
--
-- Rebuild rather than ALTER: the new column is part of the primary key, so the
-- PK has to be dropped and rebuilt anyway, and a NOT NULL column on an existing
-- table needs a value for every row. Rebuilding makes the fan-out below the
-- explicit, reviewable step it should be.

-- Built under a temporary PK NAME, then renamed at the end. Constraint (index)
-- names are unique per SCHEMA, not per table, so declaring the final name here
-- collides with the old table's PK, which is still standing at this point:
--   ERROR: relation "pk_platform_enumeration_question" already exists
CREATE TABLE "platform_enumeration_question_new" (
    "enumerationId" VARCHAR(30) NOT NULL,
    "category" "LoanCategory" NOT NULL,
    "questionId" VARCHAR(30) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_platform_enumeration_question_new" PRIMARY KEY ("enumerationId","category","questionId")
);

-- Fan each existing flat pick out to the categories where it can mean anything:
-- the categories the NAME is offered under, intersected with the categories that
-- ASK the question. The intersection, not the name's set alone — a pick copied
-- into a category that never asks the question would be born as drift, and the
-- board would immediately flag configuration no operator ever chose.
--
-- The parent migration seeded this table EMPTY, so in practice this moves
-- whatever a developer ticked while the flat shape was live. It is written to be
-- correct anyway: a silent no-op backfill and a silent data loss look identical
-- afterwards.
INSERT INTO "platform_enumeration_question_new" ("enumerationId", "category", "questionId", "createdAt")
SELECT peq."enumerationId", pelc."category", peq."questionId", peq."createdAt"
FROM "platform_enumeration_question" peq
JOIN "platform_enumeration_loan_category" pelc
  ON pelc."enumerationId" = peq."enumerationId"
JOIN "question_loan_category" qlc
  ON qlc."questionId" = peq."questionId"
 AND qlc."category" = pelc."category"
ON CONFLICT DO NOTHING;

DROP TABLE "platform_enumeration_question";

ALTER TABLE "platform_enumeration_question_new"
    RENAME TO "platform_enumeration_question";

-- The old PK is gone with the old table, so the final name is free now.
ALTER TABLE "platform_enumeration_question"
    RENAME CONSTRAINT "pk_platform_enumeration_question_new"
    TO "pk_platform_enumeration_question";

-- Indexes and FKs after the rename, so they carry their final names rather than
-- the "_new" ones Prisma would then report as drift.
--
-- The composite PK covers reads by (enumerationId) and (enumerationId, category)
-- as leading-column prefixes — the board's whole-name read and the per-tab
-- write. This index covers the reverse: "which archetypes suggest this
-- question", which the questionnaire side needs before retiring one.
CREATE INDEX "idx_platform_enumeration_question_question"
    ON "platform_enumeration_question"("questionId");

ALTER TABLE "platform_enumeration_question"
    ADD CONSTRAINT "platform_enumeration_question_enumerationId_fkey"
    FOREIGN KEY ("enumerationId") REFERENCES "platform_enumeration"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "platform_enumeration_question"
    ADD CONSTRAINT "platform_enumeration_question_questionId_fkey"
    FOREIGN KEY ("questionId") REFERENCES "question"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
