-- "What matters most to you in a loan?" comes back (operator decision 2026-11-01).
--
-- v31.0.0 (`20261027100000_retire_unread_app_questions`) retired `priority_factor` as "nothing
-- reads it". The ORDER of the offers reads it: the app maps the answer to `priority`, and
-- `rankOffers` sorts by it (lowest instalment / lowest interest / fastest answer / fewest
-- papers). Unasked, every applicant was ordered the same default way.
--
-- Back as a FIXED question on every name (`every_name`) and OPTIONAL, last in the pool (order is
-- pool-wide; the admin moves it, and each program orders its own), with FOUR answers — one per sort key `rankOffers` has (`PRIORITY_ANSWERS` in
-- `base-question-set.ts` says what each means). The four extra answers it used to carry all
-- sorted by instalment, so they are not brought back.
--
-- Idempotent: skips a database that already has the code, and a fresh one (the seed writes it).
-- The questionnaire snapshot is frozen: republish after this runs
-- (`npx tsx scripts/publish-questionnaire.ts`).

DO $$
DECLARE
  grp text;
  qid text := 'q_' || substr(md5('priority_factor'), 1, 28);
BEGIN
  IF EXISTS (SELECT 1 FROM "question" WHERE "code" = 'priority_factor') THEN
    RAISE NOTICE 'priority_question_returns: already present — nothing to do';
    RETURN;
  END IF;

  SELECT "id" INTO grp FROM "question_group" WHERE "code" = 'financing_info';
  IF grp IS NULL THEN
    RAISE NOTICE 'priority_question_returns: no questionnaire yet — fresh database, the seed writes it';
    RETURN;
  END IF;

  INSERT INTO "question"
    ("id", "groupId", "code", "type", "questionEn", "questionAr", "helperTextEn", "helperTextAr",
     "isRequired", "displayOrder", "isActive", "fixedServedOn", "updatedAt")
  VALUES
    (qid, grp, 'priority_factor', 'SINGLE_SELECT',
     'What matters most to you in a loan?', 'ما أهم شيء لك في التمويل؟',
     'Your offers are listed in this order.', 'نرتب لك العروض حسب اختيارك.',
     false,
     (SELECT coalesce(max("displayOrder"), 0) + 1 FROM "question"),
     true, 'every_name', now());

  INSERT INTO "question_option"
    ("id", "questionId", "code", "labelEn", "labelAr", "displayOrder", "isActive", "updatedAt")
  SELECT 'qo_' || substr(md5('priority_factor:' || o.code), 1, 27), qid, o.code, o.en, o.ar, o.ord,
         true, now()
    FROM (VALUES
      ('lowest_monthly_installment', 'The smallest payment each month', 'أقل قسط شهري', 1),
      ('lowest_interest_rate', 'The lowest interest', 'أقل سعر فائدة', 2),
      ('fastest_approval', 'The fastest answer', 'أسرع موافقة', 3),
      ('least_documentation_required', 'The fewest papers', 'أقل أوراق مطلوبة', 4)
    ) AS o(code, en, ar, ord);

  RAISE NOTICE 'priority_question_returns: written — republish the questionnaire (npx tsx scripts/publish-questionnaire.ts)';
END $$;
