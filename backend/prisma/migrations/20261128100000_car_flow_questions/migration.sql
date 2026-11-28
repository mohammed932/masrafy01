-- v37.0.0 — the New and Used car flows: every car name asks the category, then the brand;
-- the fuel (gas / electric) is asked on new_car only and the model year on used_car only.
-- The pool's display order already puts category → brand → fuel/year → price → down payment,
-- so no per-name order rows are written.

-- 1. Category and brand on every name offered under car.
INSERT INTO "program_name_question_addition" ("enumerationId", "category", "questionId")
SELECT c."enumerationId", 'car', q."id"
FROM "platform_enumeration_loan_category" c
JOIN "question" q ON q."code" IN ('car_category', 'what_brand_is_the_car') AND q."isActive"
WHERE c."category" = 'car'
ON CONFLICT DO NOTHING;

-- 2. A new car has no age: new_car stops ticking the model year.
DELETE FROM "program_name_question_addition" a
USING "platform_enumeration" e, "question" q
WHERE a."enumerationId" = e."id" AND a."questionId" = q."id" AND a."category" = 'car'
  AND e."key" = 'new_car' AND q."code" = 'car_model_year';

-- 3. Gas or electric is a new-car split: used_car stops ticking the fuel.
DELETE FROM "program_name_question_addition" a
USING "platform_enumeration" e, "question" q
WHERE a."enumerationId" = e."id" AND a."questionId" = q."id" AND a."category" = 'car'
  AND e."key" = 'used_car' AND q."code" = 'car_fuel_type';

-- 4. The brand is required: the car pricing card prices by the brand and its category.
UPDATE "question" SET "isRequired" = true, "updatedAt" = now() WHERE "code" = 'what_brand_is_the_car';

-- 5. The facts bound to the car questions retired by 20261128090000 go with them.
UPDATE "platform_enumeration" SET "active" = false, "deprecatedAt" = now(), "updatedAt" = now()
WHERE "type" = 'surrogate_fact' AND "active" AND "key" IN (
  'car_origin', 'car_dealer', 'do_you_want_insurance_on_the_car', 'what_kind_of_car_is_it',
  'is_your_job_or_degree_printed_on_your_national_id', 'how_many_kilometres_does_the_car_drive_a_year',
  'what_model_is_the_car', 'is_the_car_assembled_in_egypt_or_imported', 'what_is_the_engine_size',
  'what_will_you_use_the_car_for', 'how_many_kilometres_has_the_car_been_driven', 'do_you_have_a_guarantor');
