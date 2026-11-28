-- v37.0.0 — car loans price by CATEGORY → BRAND (docs/superpowers/specs/2026-11-28-auto-loan-pricing-design.md).
--
-- The car list was country → brand → model. It becomes category → brand: five category values
-- (the admin may rename, add or remove one), each brand filed under one. Countries and models
-- leave the car flow, with the car questions no car program reads under the new pricing card.
-- On a fresh database every statement below is a no-op: seed:questionnaire writes the lists.

-- 1. The category list and its five values.
INSERT INTO "enumeration_type_def" ("id", "key", "labelEn", "labelAr", "parentTypeKey", "deletable", "onValuesRail", "updatedAt")
SELECT 'c' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 24), 'car_category', 'Category', 'الفئة', NULL, false, false, now()
WHERE EXISTS (SELECT 1 FROM "enumeration_type_def" WHERE "key" = 'car_brand')
  AND NOT EXISTS (SELECT 1 FROM "enumeration_type_def" WHERE "key" = 'car_category');

INSERT INTO "platform_enumeration" ("id", "type", "key", "labelEn", "labelAr", "sortOrder", "updatedAt")
SELECT 'c' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 24), 'car_category', v.key, v.en, v.ar, v.ord, now()
FROM (VALUES
  ('american', 'American', 'أمريكية', 1),
  ('european', 'European', 'أوروبية', 2),
  ('korean', 'Korean', 'كورية', 3),
  ('japanese', 'Japanese', 'يابانية', 4),
  ('chinese', 'Chinese', 'صينية', 5)
) AS v(key, en, ar, ord)
WHERE EXISTS (SELECT 1 FROM "enumeration_type_def" WHERE "key" = 'car_category')
  AND NOT EXISTS (SELECT 1 FROM "platform_enumeration" p WHERE p."type" = 'car_category' AND p."key" = v.key);

-- 2. Brands are filed under a category, by where each was filed before (its country).
UPDATE "enumeration_type_def" SET "parentTypeKey" = 'car_category', "updatedAt" = now()
WHERE "key" = 'car_brand' AND "parentTypeKey" IS DISTINCT FROM 'car_category';

UPDATE "platform_enumeration" SET "parentKey" = CASE
    WHEN "parentKey" = 'usa' THEN 'american'
    WHEN "parentKey" IN ('germany', 'france', 'italy', 'uk', 'sweden', 'spain', 'czechia', 'romania',
                         'netherlands', 'croatia', 'russia', 'other_origin') THEN 'european'
    WHEN "parentKey" = 'korea' THEN 'korean'
    WHEN "parentKey" = 'japan' THEN 'japanese'
    ELSE 'chinese' -- china, egypt (Chery-based), india, malaysia, vietnam, taiwan
  END, "updatedAt" = now()
WHERE "type" = 'car_brand'
  AND ("parentKey" IS NULL OR "parentKey" NOT IN ('american', 'european', 'korean', 'japanese', 'chinese'));

-- 3. Countries and models leave the car list.
UPDATE "enumeration_type_def" SET "mirrorQuestionId" = NULL WHERE "key" IN ('car_country', 'car_model');
DELETE FROM "platform_enumeration" WHERE "type" IN ('car_country', 'car_model');
DELETE FROM "enumeration_type_def" WHERE "key" IN ('car_country', 'car_model');

-- 4. The car questions the new card does not read are switched off (never deleted: old
--    applications keep their answers), and no car name asks them any more.
UPDATE "question" SET "isActive" = false, "updatedAt" = now()
WHERE "code" IN (
  'car_origin', 'what_model_is_the_car', 'car_dealer', 'do_you_want_insurance_on_the_car',
  'what_kind_of_car_is_it', 'is_your_job_or_degree_printed_on_your_national_id',
  'how_many_kilometres_does_the_car_drive_a_year', 'is_the_car_assembled_in_egypt_or_imported',
  'what_is_the_engine_size', 'what_will_you_use_the_car_for',
  'how_many_kilometres_has_the_car_been_driven', 'do_you_have_a_guarantor'
);
DELETE FROM "program_name_question_addition" a
USING "question" q
WHERE a."questionId" = q."id" AND q."isActive" = false;

-- 5. Fuel is Gas or Electric.
UPDATE "question_option" o SET "isActive" = false, "updatedAt" = now()
FROM "question" q
WHERE o."questionId" = q."id" AND q."code" = 'car_fuel_type' AND o."code" = 'hybrid';
UPDATE "question_option" o SET "labelEn" = 'Gas', "labelAr" = 'بنزين', "updatedAt" = now()
FROM "question" q
WHERE o."questionId" = q."id" AND q."code" = 'car_fuel_type' AND o."code" = 'petrol_diesel';
UPDATE "question_option" o SET "labelEn" = 'Electric', "labelAr" = 'كهربائية', "updatedAt" = now()
FROM "question" q
WHERE o."questionId" = q."id" AND q."code" = 'car_fuel_type' AND o."code" = 'electric';
