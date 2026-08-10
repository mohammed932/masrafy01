-- Purge the "How old are you?" question from the questionnaire.
--
-- Why: age is never asked. It is derived from the verified `birthday` collected
-- at signup / profile completion (Principle XXXVII) and read by every caller via
-- `CustomerProfileCompletenessService.getApplicantAge()` (A31). A self-reported
-- band is therefore a SECOND age that can disagree with the verified one — and
-- the band was the answer being scored, so the disagreement moved the match.
--
-- The seed stopped emitting `your_age` already (see `prisma/seed-questionnaire.ts`),
-- which only helps a database that gets re-seeded: an environment seeded before
-- that still serves the question out of its ACTIVE snapshot, and re-running the
-- whole questionnaire seed against a live environment would rewrite content an
-- operator has since edited. This migration removes just the age question, from
-- every place that can still surface it:
--   pool row + options → catalog templates → per-program weights → published
--   snapshot.
--
-- Answered history is NOT rewritten. `application_answer.questionId` is a
-- RESTRICT foreign key, so the question row is DELETED only where nothing
-- answered it and DEACTIVATED otherwise — either way it leaves the admin pool
-- (every read filters `isActive`) and the customer questionnaire.

-- ---------------------------------------------------------------------------
-- 0. Target set: the seeded code, plus any hand-created twin. An operator could
--    have re-added the same prompt through the admin builder, which mints a
--    fresh slug — matching the prompt as well is what makes this migration mean
--    "age is not asked" rather than "one particular row is gone".
-- ---------------------------------------------------------------------------
--    Narrowed to rows that can still be SEEN — live in the pool, or still frozen
--    into the published snapshot. Without that, a second run would find the row
--    this migration deactivated, republish the snapshot again, and in doing so
--    revert a version an operator published in between.
CREATE TEMP TABLE _age_question AS
SELECT q."id", q."code"
  FROM "question" q
 WHERE (q."code" = 'your_age' OR q."questionEn" ILIKE 'how old are you%')
   AND (
        q."isActive"
        OR EXISTS (
             SELECT 1
               FROM "questionnaire_version" v,
                    jsonb_array_elements(v."snapshot"->'groups') g,
                    jsonb_array_elements(g.value->'questions') sq
              WHERE v."isActive"
                AND sq.value->>'code' = q."code"
           )
       );

-- ---------------------------------------------------------------------------
-- 1. Catalog templates — which questions a program name scores on, per category.
--    Left behind, `ScoringService.saveWeights` would keep offering age as a
--    weightable question on the scoring editor.
-- ---------------------------------------------------------------------------
DELETE FROM "platform_enumeration_question"
 WHERE "questionId" IN (SELECT "id" FROM _age_question);

-- ---------------------------------------------------------------------------
-- 2. Category assignment — assignment is authoritative, so clearing it is what
--    makes the question asked by nobody (v12.0.0).
-- ---------------------------------------------------------------------------
DELETE FROM "question_loan_category"
 WHERE "questionId" IN (SELECT "id" FROM _age_question);

-- ---------------------------------------------------------------------------
-- 3. Branches gated on an age answer. `isQuestionVisible` already treats a rule
--    whose source is not in the pool as "no gate", so this changes no behaviour
--    — it makes the stored data say what the engine does, and stops the admin
--    categories board flagging a dangling branch forever.
-- ---------------------------------------------------------------------------
UPDATE "question"
   SET "enabledWhen" = NULL
 WHERE "enabledWhen"->>'questionCode' IN (SELECT "code" FROM _age_question);

-- ---------------------------------------------------------------------------
-- 4. Options. No foreign key points here from history: `application_answer`
--    stores the option CODE (and a nullable, unconstrained id), so past answers
--    keep reading "31_45" exactly as submitted.
-- ---------------------------------------------------------------------------
DELETE FROM "question_option"
 WHERE "questionId" IN (SELECT "id" FROM _age_question);

-- ---------------------------------------------------------------------------
-- 5. Per-program weights (two-level rows, v8+). Dropping the key alone would
--    leave the remaining weights summing to less than 100, which the scoring
--    editor rejects on the operator's next save (`WEIGHTS_QUESTION_WEIGHT_SUM_INVALID`)
--    — a program nobody could re-save until they hand-fixed every number. The
--    remaining weights are rescaled proportionally instead, so each question
--    keeps its RELATIVE worth and the set stays saveable.
--
--    Rounding drift is absorbed by the heaviest question (`rn = 1`) rather than
--    spread, so the total is exactly 100 and not 100.1 on a 24-question set.
-- ---------------------------------------------------------------------------
WITH target AS (
  SELECT s."id",
         -- Both the parens and the `::text[]` are load-bearing. Arithmetic `-`
         -- binds TIGHTER than `->`, so unparenthesised this reads as
         -- `weights -> ('questionWeights' - array)` and dies parsing the KEY as a
         -- json document; and `code` is a varchar, which matches no `jsonb - …`
         -- operator.
         ("weights"->'questionWeights') - (SELECT array_agg("code")::text[] FROM _age_question) AS qw
    FROM "scoring_weight_set" s
   WHERE s."weights" ? 'questionWeights'
     AND EXISTS (
           SELECT 1 FROM _age_question a
            WHERE s."weights"->'questionWeights' ? a."code"
         )
),
sums AS (
  SELECT t."id",
         t.qw,
         COALESCE((SELECT SUM(e.value::numeric) FROM jsonb_each_text(t.qw) e), 0) AS total
    FROM target t
),
scaled AS (
  SELECT s."id",
         e.key,
         ROUND((e.value::numeric) * 100 / s.total, 2) AS w,
         ROW_NUMBER() OVER (PARTITION BY s."id" ORDER BY (e.value::numeric) DESC, e.key) AS rn
    FROM sums s
    CROSS JOIN LATERAL jsonb_each_text(s.qw) e
   WHERE s.total > 0
),
fixed AS (
  SELECT "id",
         key,
         CASE WHEN rn = 1
              THEN 100 - COALESCE(SUM(w) FILTER (WHERE rn > 1) OVER (PARTITION BY "id"), 0)
              ELSE w
         END AS w
    FROM scaled
),
agg AS (
  SELECT "id", jsonb_object_agg(key, w) AS qw
    FROM fixed
   GROUP BY "id"
)
UPDATE "scoring_weight_set" s
   SET "weights" = jsonb_set(s."weights", '{questionWeights}', COALESCE(a.qw, '{}'::jsonb))
  FROM sums z
  LEFT JOIN agg a ON a."id" = z."id"
 WHERE s."id" = z."id";

-- The answer-scoring rule blocks keyed by the question, plus the top-level key a
-- LEGACY row (`{questionCode → {optionCode → points}}`, upgraded on read) holds.
UPDATE "scoring_weight_set" s
   SET "weights" = ((((s."weights" #- ARRAY['answerScores', a."code"])
                                   #- ARRAY['multiSelectRules', a."code"])
                                   #- ARRAY['numericBands', a."code"])
                                   #- ARRAY['textRules', a."code"])
                                   -  a."code"
  FROM _age_question a
 WHERE s."weights" ? a."code"
    OR s."weights"->'answerScores' ? a."code"
    OR s."weights"->'multiSelectRules' ? a."code"
    OR s."weights"->'numericBands' ? a."code"
    OR s."weights"->'textRules' ? a."code";

-- ---------------------------------------------------------------------------
-- 6. Republish the snapshot. The customer questionnaire is served from the
--    ACTIVE `questionnaire_version` blob, never from the live tables, so steps
--    1–5 alone would leave the app still asking. A snapshot is immutable
--    (A33), so this publishes a NEW version with the question filtered out of
--    every group — and drops a group the filter empties, which is the same rule
--    `QuestionnaireService.publish()` applies (an empty group renders as a blank
--    wizard step).
-- ---------------------------------------------------------------------------
WITH active AS (
  SELECT "snapshot"
    FROM "questionnaire_version"
   WHERE "isActive"
   ORDER BY "versionNumber" DESC
   LIMIT 1
),
groups AS (
  SELECT g.ord,
         g.value AS grp,
         COALESCE((
           SELECT jsonb_agg(q.value ORDER BY q.ord)
             FROM jsonb_array_elements(g.value->'questions') WITH ORDINALITY AS q(value, ord)
            WHERE q.value->>'code' NOT IN (SELECT "code" FROM _age_question)
         ), '[]'::jsonb) AS questions
    FROM active a,
         jsonb_array_elements(a."snapshot"->'groups') WITH ORDINALITY AS g(value, ord)
),
rebuilt AS (
  SELECT COALESCE(jsonb_agg(jsonb_set(grp, '{questions}', questions) ORDER BY ord), '[]'::jsonb) AS groups
    FROM groups
   WHERE jsonb_array_length(questions) > 0
),
nextver AS (
  SELECT COALESCE(MAX("versionNumber"), 0) + 1 AS n FROM "questionnaire_version"
)
INSERT INTO "questionnaire_version" ("id", "versionNumber", "isActive", "publishedAt", "publishedBy", "snapshot", "createdAt")
SELECT 'clmigrage' || substr(md5(random()::text || clock_timestamp()::text), 1, 21),
       n.n,
       false,
       now(),
       'migration_drop_age_question',
       jsonb_build_object('versionNumber', n.n, 'groups', r.groups),
       now()
  FROM nextver n, rebuilt r
 WHERE EXISTS (SELECT 1 FROM _age_question);

-- Flip over only if the new version actually got written. A database that never
-- had the question (or has no published snapshot at all) has nothing to swap,
-- and its current ACTIVE version must stay active — hence the `_age_question`
-- guard, which also makes a re-run a no-op instead of reverting a snapshot an
-- operator published later.
UPDATE "questionnaire_version" v
   SET "isActive" = (v."id" = (
         SELECT "id" FROM "questionnaire_version"
          WHERE "publishedBy" = 'migration_drop_age_question'
          ORDER BY "versionNumber" DESC
          LIMIT 1
       ))
 WHERE EXISTS (SELECT 1 FROM _age_question)
   AND EXISTS (
         SELECT 1 FROM "questionnaire_version"
          WHERE "publishedBy" = 'migration_drop_age_question'
       )
   AND (v."isActive" OR v."publishedBy" = 'migration_drop_age_question');

-- ---------------------------------------------------------------------------
-- 7. The pool row itself. Deleted where no application answered it; deactivated
--    where one did, because that FK is RESTRICT and an application's answers are
--    history, not content.
-- ---------------------------------------------------------------------------
DELETE FROM "question" q
 WHERE q."id" IN (SELECT "id" FROM _age_question)
   AND NOT EXISTS (
         SELECT 1 FROM "application_answer" a WHERE a."questionId" = q."id"
       );

UPDATE "question"
   SET "isActive" = false
 WHERE "id" IN (SELECT "id" FROM _age_question);

DROP TABLE _age_question;
