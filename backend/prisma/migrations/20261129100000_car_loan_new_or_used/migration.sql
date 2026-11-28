-- v37.1.0 — "Is the car new or used?" for every car loan, payslip and no-payslip.
--
-- 1. The question (answers New / Used), in the car step just before the category, and the
--    fact its answer arrives as (the match gate reads it: `match-gate.ts`, CAR_CONDITION_FACT_KEY).
INSERT INTO "question" ("id", "groupId", "code", "type", "questionAr", "questionEn", "helperTextAr", "helperTextEn",
                        "isRequired", "displayOrder", "isActive", "updatedAt")
SELECT 'c' || substr(md5('question:car_condition'), 1, 24), q."groupId", 'car_condition', 'SINGLE_SELECT',
       'هل السيارة جديدة أم مستعملة؟', 'Is the car new or used?',
       'السيارة الجديدة يُسأل عن وقودها، والمستعملة عن سنة الموديل.', 'A new car is asked what it runs on; a used one its model year.',
       true, q."displayOrder" - 1, true, now()
FROM "question" q
WHERE q."code" = 'car_category'
  AND NOT EXISTS (SELECT 1 FROM "question" WHERE "code" = 'car_condition');

INSERT INTO "question_option" ("id", "questionId", "code", "labelAr", "labelEn", "displayOrder", "isActive", "updatedAt")
SELECT 'c' || substr(md5('option:car_condition:' || v.code), 1, 24), q."id", v.code, v.ar, v.en, v.ord, true, now()
FROM "question" q
CROSS JOIN (VALUES ('new', 'جديدة', 'New', 1), ('used', 'مستعملة', 'Used', 2)) AS v(code, ar, en, ord)
WHERE q."code" = 'car_condition'
  AND NOT EXISTS (SELECT 1 FROM "question_option" o WHERE o."questionId" = q."id" AND o."code" = v.code);

INSERT INTO "platform_enumeration" ("id", "type", "key", "labelAr", "labelEn", "active", "systemOnly", "sortOrder",
                                    "updatedAt", "boundQuestionId", "valueSources", "capOnly")
SELECT 'c' || substr(md5('fact:car_condition'), 1, 24), 'surrogate_fact', 'car_condition', 'جديدة أم مستعملة', 'New or used',
       true, false, 140, now(), q."id", '{}'::jsonb, false
FROM "question" q
WHERE q."code" = 'car_condition'
  AND NOT EXISTS (SELECT 1 FROM "platform_enumeration" WHERE "type" = 'surrogate_fact' AND "key" = 'car_condition');

-- 2. The answer decides what comes next: gas or electric for a new car, the model year for a used one.
UPDATE "question" SET "enabledWhen" = '{"questionCode": "car_condition", "operator": "equals", "optionCode": "new"}'::jsonb, "updatedAt" = now()
WHERE "code" = 'car_fuel_type';
UPDATE "question" SET "enabledWhen" = '{"questionCode": "car_condition", "operator": "equals", "optionCode": "used"}'::jsonb, "updatedAt" = now()
WHERE "code" = 'car_model_year';

-- 2b. The order: new or used first, then category and brand, then what it opens (model year,
--     fuel). A database seeded before this release has model year and fuel above the category.
WITH o AS (SELECT
  (SELECT "displayOrder" FROM "question" WHERE "code" = 'what_brand_is_the_car') AS brand,
  (SELECT LEAST(
     (SELECT "displayOrder" FROM "question" WHERE "code" = 'car_category'),
     (SELECT "displayOrder" FROM "question" WHERE "code" = 'car_model_year'),
     (SELECT "displayOrder" FROM "question" WHERE "code" = 'car_fuel_type'))) AS first)
UPDATE "question" q SET "displayOrder" = CASE q."code"
    WHEN 'car_condition' THEN o.first - 1
    WHEN 'car_model_year' THEN GREATEST(q."displayOrder", o.brand + 1)
    WHEN 'car_fuel_type'  THEN GREATEST(q."displayOrder", o.brand + 2)
  END, "updatedAt" = now()
FROM o
WHERE q."code" IN ('car_condition', 'car_model_year', 'car_fuel_type');

-- 3. One payslip car name, Car Loan, in place of New Car + Used Car.
INSERT INTO "platform_enumeration" ("id", "type", "key", "labelAr", "labelEn", "active", "systemOnly", "sortOrder",
                                    "updatedAt", "valueSources", "capOnly")
SELECT 'c' || substr(md5('program_name:car_loan'), 1, 24), 'program_name', 'car_loan', 'قرض سيارة', 'Car Loan',
       true, false, COALESCE((SELECT "sortOrder" FROM "platform_enumeration" WHERE "type" = 'program_name' AND "key" = 'new_car'), 0),
       now(), '{}'::jsonb, false
WHERE NOT EXISTS (SELECT 1 FROM "platform_enumeration" WHERE "type" = 'program_name' AND "key" = 'car_loan');

INSERT INTO "platform_enumeration_loan_category" ("enumerationId", "category", "payslip", "noPayslip")
SELECT e."id", 'car', true, false FROM "platform_enumeration" e
WHERE e."type" = 'program_name' AND e."key" = 'car_loan'
ON CONFLICT DO NOTHING;

-- 4. Every car program says what it finances; the 13 on the old names move, keeping the kind.
UPDATE "bank_program" SET "carCondition" = 'new',  "programNameKey" = 'car_loan', "updatedAt" = now()
WHERE "productCategory" = 'car' AND "programNameKey" = 'new_car';
UPDATE "bank_program" SET "carCondition" = 'used', "programNameKey" = 'car_loan', "updatedAt" = now()
WHERE "productCategory" = 'car' AND "programNameKey" = 'used_car';
UPDATE "bank_program" SET "carCondition" = 'any', "updatedAt" = now()
WHERE "productCategory" = 'car' AND "carCondition" IS NULL;

-- 5. The old names' car ticks merge onto Car Loan; every car name asks the new question.
INSERT INTO "program_name_question_addition" ("enumerationId", "category", "questionId")
SELECT (SELECT "id" FROM "platform_enumeration" WHERE "type" = 'program_name' AND "key" = 'car_loan'), 'car', a."questionId"
FROM "program_name_question_addition" a
JOIN "platform_enumeration" e ON e."id" = a."enumerationId"
WHERE a."category" = 'car' AND e."key" IN ('new_car', 'used_car')
ON CONFLICT DO NOTHING;

INSERT INTO "program_name_question_addition" ("enumerationId", "category", "questionId")
SELECT c."enumerationId", 'car', q."id"
FROM "platform_enumeration_loan_category" c
JOIN "question" q ON q."code" IN ('car_condition', 'car_fuel_type', 'car_model_year')
WHERE c."category" = 'car'
ON CONFLICT DO NOTHING;

-- 6. The old names leave car: New Car is switched off (no loan type left); Used Car keeps its
--    personal loan type. Not deleted — old applications still name them.
DELETE FROM "program_name_question_addition" a USING "platform_enumeration" e
WHERE a."enumerationId" = e."id" AND a."category" = 'car' AND e."key" IN ('new_car', 'used_car');
DELETE FROM "program_name_question_order" o USING "platform_enumeration" e
WHERE o."enumerationId" = e."id" AND o."category" = 'car' AND e."key" IN ('new_car', 'used_car');
DELETE FROM "platform_enumeration_loan_category" c USING "platform_enumeration" e
WHERE c."enumerationId" = e."id" AND c."category" = 'car' AND e."key" IN ('new_car', 'used_car');
UPDATE "platform_enumeration" SET "active" = false, "updatedAt" = now()
WHERE "type" = 'program_name' AND "key" = 'new_car';
