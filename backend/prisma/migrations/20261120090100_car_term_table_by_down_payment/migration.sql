-- Crédit Agricole's car term tables, keyed by the down payment first (2026-11-20).
--
-- Every car program now shows ONE plan table on its own page, and that table's rows are the
-- down payment. These three term tables were keyed by the car alone (origin × dealer, and
-- fuel on the EV card), so the page could not draw them and an operator saw only "84 months"
-- while Chinese cars were held to 60. The same rows, now under a down payment band that starts
-- where each program's financed-share table starts: below it the program refuses anyway, so
-- no customer is quoted differently.

UPDATE bank_program SET
  tenor = jsonb_set(
    tenor,
    '{maxMonthsByFact}',
    jsonb_build_object(
      'axes', jsonb_build_array(jsonb_build_object('factKey', 'car_down_payment_percent'))
        || (tenor->'maxMonthsByFact'->'axes'),
      'cells', (
        SELECT jsonb_agg(
          jsonb_set(c, '{keys}',
            jsonb_build_array(jsonb_build_object(
              'fromInclusive', CASE "programCode"
                WHEN 'CAE-CAR-NEW_CAR' THEN '20'
                WHEN 'CAE-CAR-USED_CAR' THEN '40'
                WHEN 'CAE-CAR-EV' THEN '35'
              END,
              'toExclusive', NULL
            )) || (c->'keys')
          ) ORDER BY ord)
        FROM jsonb_array_elements(tenor->'maxMonthsByFact'->'cells') WITH ORDINALITY AS t(c, ord)
      ),
      'onNoMatch', tenor->'maxMonthsByFact'->'onNoMatch'
    )
  ),
  version = version + 1,
  "updatedAt" = now()
WHERE "programCode" IN ('CAE-CAR-NEW_CAR', 'CAE-CAR-USED_CAR', 'CAE-CAR-EV')
  AND tenor ? 'maxMonthsByFact'
  AND tenor->'maxMonthsByFact'->'axes'->0->>'factKey' <> 'car_down_payment_percent';
