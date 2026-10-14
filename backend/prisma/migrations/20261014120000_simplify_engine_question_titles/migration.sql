-- Plain, short titles on the questions the loan engine and the app read (the operator's call,
-- 2026-10-14: "the mandatory questions must be clear and titles must be very simple").
--
-- WORDING ONLY. No code, type, unit, answer, required flag, show-when rule or loan-type row
-- changes, so nothing the engine reads moves and the engine-input lock (which leaves wording
-- editable) is not engaged. Titles that were already short are left as they are.
--
-- One of them was not just wordy but wrong: `current_loans` asked "Do you pay back any loans
-- right now?" while one of its answers is credit cards — a card holder with no loan could
-- answer "None", and the card limit was then never asked or counted.
--
-- Each title is rewritten only where it still reads exactly what the seed wrote. A title an
-- admin has since reworded is left alone (NOTICE), because their wording is the newer decision.
--
-- The questionnaire snapshot is frozen: republish after this runs.
DO $$
DECLARE
  r record;
  n integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "question" WHERE "code" = 'repayment_period_months') THEN
    RAISE NOTICE 'simplify_engine_question_titles: no questionnaire yet — fresh database, the seed writes the new titles';
    RETURN;
  END IF;

  FOR r IN
    SELECT * FROM (VALUES
      ('repayment_period_months', 'Over how many months do you want to pay it back?', 'How many months to pay it back?'),
      ('monthly_income', 'What is your net monthly income?', 'What is your monthly income after deductions?'),
      ('current_installments', 'Your total monthly commitments', 'What are your total monthly commitments?'),
      ('current_loans', 'Do you pay back any loans right now?', 'Do you have any loans or credit cards now?'),
      ('credit_card_total_limit', 'What is the total credit limit of ALL your credit cards?', 'What is the total limit of all your credit cards?'),
      ('obligation_mortgage', 'How much is your mortgage each month?', 'How much is your home loan each month?'),
      ('salary_transfer', 'How does your pay reach the bank?', 'Is your salary transferred to the bank?'),
      ('priority_factor', 'What matters most to you?', 'What matters most to you in a loan?'),
      ('prior_rejection', 'Has a bank ever said no to you?', 'Has a bank ever refused your loan request?'),
      ('car_down_payment', 'How much will you pay up front?', 'How much is your down payment?'),
      ('down_payment', 'How much money can you pay up front?', 'How much is your down payment?'),
      ('property_type', 'What kind of place do you want to buy?', 'What type of property?'),
      ('property_value', 'About how much is the place worth?', 'About how much is the property worth?'),
      ('how_is_your_employer_coded_at_the_bank', 'How is your employer coded at the bank?', 'Which class does the bank put your employer in?')
    ) AS t(code, was, now)
  LOOP
    UPDATE "question" SET "questionEn" = r.now, "updatedAt" = now()
     WHERE "code" = r.code AND "questionEn" = r.was;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n = 0 AND EXISTS (SELECT 1 FROM "question" WHERE "code" = r.code AND "questionEn" <> r.now) THEN
      RAISE NOTICE 'simplify_engine_question_titles: % (en) was reworded since the seed — left as it is', r.code;
    END IF;
  END LOOP;

  FOR r IN
    SELECT * FROM (VALUES
      ('monthly_income', 'ما صافي دخلك الشهري؟', 'كم دخلك الشهري بعد الخصومات؟'),
      ('current_installments', 'إجمالي التزاماتك الشهرية', 'كم إجمالي التزاماتك الشهرية؟'),
      ('current_loans', 'هل لديك قروض أو التزامات حالية؟', 'هل عليك قروض أو بطاقات ائتمان حاليًا؟'),
      ('credit_card_total_limit', 'ما إجمالي الحد الائتماني لجميع بطاقاتك الائتمانية؟', 'كم إجمالي حد كل بطاقاتك الائتمانية؟'),
      ('employment_status', 'ما هي حالتك الوظيفية؟', 'ما نوع عملك؟'),
      ('salary_transfer', 'كيف يصل راتبك إلى البنك؟', 'هل يتم تحويل راتبك إلى البنك؟'),
      ('priority_factor', 'أهم عامل عند اختيار التمويل؟', 'ما أهم شيء لك في التمويل؟'),
      ('prior_rejection', 'هل سبق رفض طلب تمويل لك؟', 'هل رفض بنك طلب تمويل لك من قبل؟'),
      ('down_payment', 'ما حجم الدفعة المقدمة المتاحة لديك؟', 'كم المقدم الذي يمكنك دفعه؟'),
      ('property_type', 'ما نوع العقار الذي ترغب في تمويله؟', 'ما نوع العقار؟'),
      ('business_age', 'منذ متى والنشاط يعمل؟', 'منذ متى بدأ نشاطك؟'),
      ('how_is_your_employer_coded_at_the_bank', 'كيف تصنّف جهة عملك في البنك؟', 'ما فئة جهة عملك لدى البنك؟')
    ) AS t(code, was, now)
  LOOP
    UPDATE "question" SET "questionAr" = r.now, "updatedAt" = now()
     WHERE "code" = r.code AND "questionAr" = r.was;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n = 0 AND EXISTS (SELECT 1 FROM "question" WHERE "code" = r.code AND "questionAr" <> r.now) THEN
      RAISE NOTICE 'simplify_engine_question_titles: % (ar) was reworded since the seed — left as it is', r.code;
    END IF;
  END LOOP;
END $$;
