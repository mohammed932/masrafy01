-- Only a FIXED question changes the offer, and a fixed question is One choice, Several choices
-- or Number — never Text (v31.3.0, constitution v33.0.0, operator decision 2026-10-27: "do this
-- change for fixed questions only and in fixed question hide text inputs just (number, single
-- choice and multiple choice)").
--
-- 1. A fixed NUMBER question can change the offer by RANGES of the number: `numberEffects`,
--    `[{fromInclusive, toExclusive, maxLoanPercent?, ratePoints?, maxTenorMonths?}]`, half-open,
--    null edge = open (`backend/src/matching/pipeline/answer-effects.ts`). Null on every row:
--    no quote moves.
-- 2. Every fixed TEXT question becomes an ordinary one — today only "Which area do you live
--    in?" (`residence_area`, operator: "Remove it from fixed"). It is still asked exactly as
--    before: it reads no fact, so it stays core on every name of its loan types. Refused if a
--    fixed question is gated on it (a fixed question may only follow a fixed one).
-- 3. An ordinary question's answers stop changing the offer: their effects are cleared. None
--    are set today; this keeps the rule true on any database the migration meets.
--
-- The fixed mark is frozen into the questionnaire snapshot: republish after this runs
-- (`npx tsx scripts/publish-questionnaire.ts`).
ALTER TABLE "question" ADD COLUMN "numberEffects" JSONB;

DO $$
DECLARE
  unfixed text[];
  followers text[];
BEGIN
  SELECT array_agg("code" ORDER BY "code") INTO unfixed
    FROM "question"
   WHERE "type" = 'TEXT' AND "fixedServedOn" IS NOT NULL;

  IF unfixed IS NULL THEN
    RAISE NOTICE 'fixed_questions_number_choice: no fixed text question to make ordinary';
  ELSE
    SELECT array_agg(f."code" ORDER BY f."code") INTO followers
      FROM "question" f
     WHERE f."isActive"
       AND f."fixedServedOn" IS NOT NULL
       AND f."type" <> 'TEXT'
       AND f."enabledWhen" IS NOT NULL
       AND (f."enabledWhen" ->> 'questionCode') = ANY(unfixed);
    IF followers IS NOT NULL THEN
      RAISE EXCEPTION 'fixed_questions_number_choice: fixed questions % are gated on the text question(s) % — make them ordinary or always asked first', followers, unfixed;
    END IF;

    UPDATE "question" SET "fixedServedOn" = NULL
     WHERE "type" = 'TEXT' AND "fixedServedOn" IS NOT NULL;
    RAISE NOTICE 'fixed_questions_number_choice: made ordinary: %', unfixed;
  END IF;

  UPDATE "question_option" o
     SET "effectMaxLoanPercent" = NULL, "effectRatePoints" = NULL, "effectMaxTenorMonths" = NULL
    FROM "question" q
   WHERE q."id" = o."questionId"
     AND q."fixedServedOn" IS NULL
     AND (o."effectMaxLoanPercent" IS NOT NULL OR o."effectRatePoints" IS NOT NULL
          OR o."effectMaxTenorMonths" IS NOT NULL);
END $$;
