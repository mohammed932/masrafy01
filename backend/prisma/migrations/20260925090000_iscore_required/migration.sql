-- The I-Score question becomes REQUIRED on every loan type (operator decision, 2026-09-25).
--
-- It was optional, and every one of the 71 programmes quotes against the shared I-Score table
-- (v30.4.0), where a blank is the "No I-Score" class at 85%. So a blank cost the applicant 15%
-- of their income under a helper that said "It will not count against you". The question and
-- helper text are reworded to match; only the seeded wording is replaced, so an admin's own
-- edit is left alone. `isRequired` is set whatever the wording.
--
-- Nothing in the engine changes: a blank still resolves to the No I-Score class, which is what
-- an application stored before this, or sent by an older app build, carries.
--
-- The questionnaire snapshot is frozen: run `npx tsx scripts/publish-questionnaire.ts` after.
DO $$
DECLARE
  n integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "question" WHERE "code" = 'i_score') THEN
    RAISE NOTICE 'iscore_required: no I-Score question yet — fresh database, the seed writes it required';
    RETURN;
  END IF;

  UPDATE "question" SET "isRequired" = true, "updatedAt" = now()
   WHERE "code" = 'i_score' AND "isRequired" = false;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'iscore_required: % question row(s) made required', n;

  UPDATE "question"
     SET "questionEn"   = 'What is your I-Score?',
         "questionAr"   = 'ما درجة الآي سكور الخاصة بك؟',
         "updatedAt"    = now()
   WHERE "code" = 'i_score' AND "questionEn" = 'Your I-Score, if you know it';

  UPDATE "question"
     SET "helperTextEn" = 'From your I-Score credit report, between 300 and 900.',
         "helperTextAr" = 'من تقرير الآي سكور الائتماني الخاص بك، بين 300 و900.',
         "updatedAt"    = now()
   WHERE "code" = 'i_score'
     AND "helperTextEn" = 'Leave it blank if you would rather not say. It will not count against you.';

  -- A required question nobody is assigned to is asked of nobody: refuse rather than ship it.
  SELECT count(DISTINCT qlc."category") INTO n
    FROM "question_loan_category" qlc JOIN "question" q ON q."id" = qlc."questionId"
   WHERE q."code" = 'i_score';
  IF n < 4 THEN
    RAISE EXCEPTION 'iscore_required: the I-Score question is assigned to % of the 4 loan types — refusing', n;
  END IF;
END $$;
