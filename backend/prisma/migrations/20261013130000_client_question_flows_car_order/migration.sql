-- The client's Auto Loan order (v30.10.0), the car half of `20261013120000_client_question_flows`.
--
--   1. The job first, then income, term and amount — the client's card opens on "What's your job /
--      customer type?".
--   2. The down payment moves into the car step, right after the car's price it is a share of
--      (the client asks price, then down payment). It used to open the financing step, three
--      steps before the price. `car_down_payment` is asked in car alone, so no other loan type
--      moves; the Green Finance pair after it shifts one place.
--
-- Each row moves only from the position this was written against, so an operator's own reorder
-- since is left alone. A fresh database gets the step from the seed (`CAR` config).
--
-- The questionnaire snapshot is frozen: republish after this runs.
DO $$
DECLARE
  vehicle_group text;
  n             integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "question" WHERE "code" = 'car_down_payment') THEN
    RAISE NOTICE 'client_question_flows_car_order: no questionnaire yet — fresh database, the seeds write this';
    RETURN;
  END IF;

  UPDATE "question_loan_category" AS l
     SET "displayOrder" = v.new_pos
    FROM "question" q,
         (VALUES
            ('employment_status',       15, 1),
            ('monthly_income',           1, 2),
            ('repayment_period_months',  2, 3),
            ('amount_requested',         3, 4),
            ('car_down_payment',        54, 50),
            ('total_savings',           50, 51),
            ('green_buyer_type',        51, 52)
         ) AS v(code, old_pos, new_pos)
   WHERE q."code" = v.code AND l."questionId" = q."id"
     AND l."category" = 'car' AND l."displayOrder" = v.old_pos;

  SELECT count(*) INTO n FROM "question_loan_category" l JOIN "question" q ON q."id" = l."questionId"
   WHERE q."code" = 'car_down_payment' AND l."category" <> 'car';
  IF n > 0 THEN
    RAISE EXCEPTION 'client_question_flows_car_order: car_down_payment is asked outside car — moving its step would move it there too';
  END IF;
  SELECT "id" INTO vehicle_group FROM "question_group" WHERE "code" = 'vehicle_financing';
  IF vehicle_group IS NULL THEN
    RAISE EXCEPTION 'client_question_flows_car_order: no vehicle_financing step';
  END IF;
  UPDATE "question" SET "groupId" = vehicle_group, "updatedAt" = now()
   WHERE "code" = 'car_down_payment' AND "groupId" <> vehicle_group;
END $$;
