-- ============================================================================
-- Feature 010 — GLOBAL question pool (drop per-category questionnaire).
--
-- Questions/groups/options become a single global pool with globally-unique
-- codes; there is ONE global questionnaire version series. Per-program scoring
-- (ScoringWeightSet.weights.questionWeights) is unchanged — it keeps referencing
-- question codes, and those codes survive the merge, so each program's existing
-- weight set IS its pre-assignment (Migration strategy: "merge by code").
--
-- Strategy: collapse rows that share a `code` across categories into ONE
-- canonical row (lowest id wins), re-point foreign keys, then drop `category`
-- and switch the unique keys from (category, code) to (code).
--
-- NOTE: option sets are UNIONed by code (canonical kept; any option code present
-- only on a duplicate is moved onto the canonical). If two same-code questions
-- had genuinely different answers, review the merged pool in the admin editor.
-- Existing questionnaire_version snapshots become structurally stale; the first
-- admin publish (or a re-seed) regenerates the correct global snapshot.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1) GROUPS — merge duplicate codes, re-point questions, delete duplicates.
-- --------------------------------------------------------------------------
CREATE TEMP TABLE _group_canon ON COMMIT DROP AS
SELECT g.id AS dup_id,
       first_value(g.id) OVER (PARTITION BY g.code ORDER BY g.id) AS canon_id
FROM "question_group" g;

UPDATE "question" q
SET "groupId" = c.canon_id
FROM _group_canon c
WHERE q."groupId" = c.dup_id AND c.dup_id <> c.canon_id;

DELETE FROM "question_group" g
USING _group_canon c
WHERE g.id = c.dup_id AND c.dup_id <> c.canon_id;

-- --------------------------------------------------------------------------
-- 2) QUESTIONS — merge duplicate codes.
-- --------------------------------------------------------------------------
CREATE TEMP TABLE _q_canon ON COMMIT DROP AS
SELECT q.id AS dup_id,
       first_value(q.id) OVER (PARTITION BY q.code ORDER BY q.id) AS canon_id
FROM "question" q;

-- 2a) Move each duplicate's options onto the canonical question, but only when
--     the canonical doesn't already carry that option code (union by code).
UPDATE "question_option" o
SET "questionId" = c.canon_id
FROM _q_canon c
WHERE o."questionId" = c.dup_id
  AND c.dup_id <> c.canon_id
  AND NOT EXISTS (
    SELECT 1 FROM "question_option" o2
    WHERE o2."questionId" = c.canon_id AND o2."code" = o."code"
  );

-- 2b) Re-point application answers (FK is ON DELETE RESTRICT) to the canonical.
--     One application only answers one category, so (applicationId, questionId)
--     stays unique after the re-point.
UPDATE "application_answer" a
SET "questionId" = c.canon_id
FROM _q_canon c
WHERE a."questionId" = c.dup_id AND c.dup_id <> c.canon_id;

-- 2c) Delete duplicate questions — cascades their leftover (same-code) options.
DELETE FROM "question" q
USING _q_canon c
WHERE q.id = c.dup_id AND c.dup_id <> c.canon_id;

-- --------------------------------------------------------------------------
-- 3) QUESTIONNAIRE VERSIONS — collapse the four per-category series into one
--    global series. Renumber to a single sequence (keeps them unique while the
--    old (category, versionNumber) index is still present), then keep exactly
--    one active (latest published).
-- --------------------------------------------------------------------------
WITH renum AS (
  SELECT id, row_number() OVER (
    ORDER BY "publishedAt" ASC NULLS FIRST, "versionNumber" ASC, id ASC
  ) AS rn
  FROM "questionnaire_version"
)
UPDATE "questionnaire_version" v
SET "versionNumber" = r.rn
FROM renum r
WHERE v.id = r.id;

UPDATE "questionnaire_version" SET "isActive" = false;
WITH latest AS (
  SELECT id FROM "questionnaire_version"
  ORDER BY "publishedAt" DESC NULLS LAST, "versionNumber" DESC
  LIMIT 1
)
UPDATE "questionnaire_version" v
SET "isActive" = true
FROM latest
WHERE v.id = latest.id;

-- --------------------------------------------------------------------------
-- 4) STRUCTURAL — drop old indexes, drop `category`, add global unique keys.
--    (All DROPs first so the reused index name `idx_question_group_order` is
--    free before it is re-created on question_group.)
-- --------------------------------------------------------------------------
DROP INDEX "question_group_category_code_key";
DROP INDEX "idx_question_group_category_order";
DROP INDEX "question_category_code_key";
DROP INDEX "idx_question_group_order";
DROP INDEX "questionnaire_version_category_versionNumber_key";
DROP INDEX "idx_questionnaire_version_category_active";

ALTER TABLE "question_group" DROP COLUMN "category";
ALTER TABLE "question" DROP COLUMN "category";
ALTER TABLE "questionnaire_version" DROP COLUMN "category";

CREATE UNIQUE INDEX "uniq_question_group_code" ON "question_group"("code");
CREATE INDEX "idx_question_group_order" ON "question_group"("displayOrder");
CREATE UNIQUE INDEX "uniq_question_code" ON "question"("code");
CREATE INDEX "idx_question_group_question_order" ON "question"("groupId", "displayOrder");
CREATE UNIQUE INDEX "uniq_questionnaire_version_number" ON "questionnaire_version"("versionNumber");
CREATE INDEX "idx_questionnaire_version_active" ON "questionnaire_version"("isActive");
