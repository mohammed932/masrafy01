-- v37.0.0 — the Nested car demo (Cases on the retired car questions: model, origin) becomes the
-- Car pricing demo on the car pricing card: rates by down payment 10–20 / 20–50 / 50%+, BMW at 9%,
-- an electric car up to 5 years, a European one up to 7, 2 interest-free years on the top
-- band. Only while it is still the untouched seeded demo (its cases still name car_origin); an
-- operator's own edit of the row is left alone. The same grids `seed:programs` writes on a fresh
-- database (src/bank-programs/demo-figures/car-card-grids.ts, CAR_PRICING_DEMO).
UPDATE "bank_program"
SET "friendlyName" = 'Car pricing demo',
    "friendlyNameAr" = 'عرض تسعير السيارات',
    "cases" = '[]'::jsonb,
    "plansSource" = 'own',
    "pricing" = "pricing" || jsonb_build_object('rateByFact', '{"axes":[{"factKey":"car_down_payment_percent"},{"factKey":"what_brand_is_the_car"},{"factKey":"car_fuel_type"},{"factKey":"what_brand_is_the_car","via":"parentClass"}],"cells":[{"keys":[{"fromInclusive":"10","toExclusive":"20"},null,null,null],"value":"20"},{"keys":[{"fromInclusive":"20","toExclusive":"50"},null,null,null],"value":"18"},{"keys":[{"fromInclusive":"50"},null,null,null],"value":"15"},{"keys":[{"fromInclusive":"10","toExclusive":"20"},{"key":"bmw"},null,null],"value":"9"},{"keys":[{"fromInclusive":"20","toExclusive":"50"},{"key":"bmw"},null,null],"value":"9"},{"keys":[{"fromInclusive":"50"},{"key":"bmw"},null,null],"value":"9"}],"onNoMatch":"reject"}'::jsonb, 'interestFreeYearsByFact', '{"axes":[{"factKey":"car_down_payment_percent"},{"factKey":"what_brand_is_the_car"},{"factKey":"car_fuel_type"},{"factKey":"what_brand_is_the_car","via":"parentClass"}],"cells":[{"keys":[{"fromInclusive":"50"},null,null,null],"value":"2"}],"onNoMatch":"useFallback"}'::jsonb),
    "tenor" = ("tenor" - 'maxVehicleAgeYearsByFact') || jsonb_build_object('maxMonths', 96, 'maxMonthsByFact', '{"axes":[{"factKey":"car_down_payment_percent"},{"factKey":"what_brand_is_the_car"},{"factKey":"car_fuel_type"},{"factKey":"what_brand_is_the_car","via":"parentClass"}],"cells":[{"keys":[{"fromInclusive":"10","toExclusive":"20"},null,{"key":"electric"},null],"value":"60"},{"keys":[{"fromInclusive":"20","toExclusive":"50"},null,{"key":"electric"},null],"value":"60"},{"keys":[{"fromInclusive":"50"},null,{"key":"electric"},null],"value":"60"},{"keys":[{"fromInclusive":"10","toExclusive":"20"},null,null,{"key":"european"}],"value":"84"},{"keys":[{"fromInclusive":"20","toExclusive":"50"},null,null,{"key":"european"}],"value":"84"},{"keys":[{"fromInclusive":"50"},null,null,{"key":"european"}],"value":"84"}],"onNoMatch":"useFallback"}'::jsonb),
    "version" = "version" + 1,
    "updatedAt" = now()
WHERE "programCode" = 'NXT-CAR-NEW_CAR' AND "cases"::text LIKE '%car_origin%';
