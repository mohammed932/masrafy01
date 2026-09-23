-- Auto Loan asks the I-Score question (v30.4.0).
--
-- Every programme reads an I-Score table now (`iscore_classes`), and the factor it picks
-- scales the income before the debt-burden cap on every path. Auto Loan was the one loan type
-- that did not ask the question, so no car applicant ever had a score for a table to read —
-- `seed-questionnaire.ts`' own `CAR_ASKS` has always listed `i_score`; the live assignment
-- had drifted from it.
--
-- Placed LAST in its own step for car, so no other question moves. Optional, like everywhere
-- else: an unanswered score is a 100% factor, never a refusal.
--
-- The assignment is frozen into the published questionnaire snapshot, so the app sees it
-- only after the next publish: run `npx tsx scripts/publish-questionnaire.ts` after deploy.
DO $$
DECLARE
  qid   TEXT;
  gid   TEXT;
  pos   INTEGER;
BEGIN
  SELECT "id", "groupId" INTO qid, gid FROM "question" WHERE "code" = 'i_score';
  IF qid IS NULL THEN
    RAISE NOTICE 'iscore_asked_in_auto_loan: no i_score question on this database — nothing to assign';
    RETURN;
  END IF;

  SELECT COALESCE(max(c."displayOrder"), -1) + 1 INTO pos
    FROM "question_loan_category" c
    JOIN "question" q ON q."id" = c."questionId"
   WHERE c."category" = 'car' AND q."groupId" = gid;

  INSERT INTO "question_loan_category" ("questionId", "category", "displayOrder")
  VALUES (qid, 'car', pos)
  ON CONFLICT ("questionId", "category") DO NOTHING;
END $$;
