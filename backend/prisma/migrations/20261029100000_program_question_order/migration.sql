-- Questions belong to PROGRAMS, not loan types (v32.0.0, operator decision 2026-10-29: "questions
-- in app show per selected program not loan category ... make assignment to program only").
--
-- Part 1 of 2 (part 2, `20261029110000_drop_question_category_assignment`, drops the old tables
-- once no code reads them). This part MOVES what the loan-type assignment still did onto the
-- program, so nothing an applicant sees changes:
--
--   1. ORDER. Each loan type had its own order (`question_loan_category.displayOrder`). Order now
--      belongs to each program NAME, per loan type (`program_name_question_order`), seeded here
--      from that loan type's order — so every program asks in exactly today's order.
--   2. THE SIX CAR QUESTIONS were FIXED (asked on every program of their loan types) and only in
--      `car`. "Fixed" now means every program of EVERY loan type, so they stop being fixed and
--      become ticks (`program_name_question_addition`) on every name offered under car — the
--      operator's choice ("tick them per car program"). Their answer effects are cleared: only a
--      fixed question may carry one (none was set when this was written).
--
-- Guards first: a fixed question that today skips one of the loan types a name is sold under would
-- start being asked there, so that is refused rather than done silently.
--
-- Fresh database: no questions or names yet, so every step is a no-op and the seeds write the same
-- end state (`seed-questionnaire.ts` creates the car questions unfixed; `seed-program-catalog.ts`
-- ticks them on a name offered under car).
--
-- Republish after this runs (`npx tsx scripts/publish-questionnaire.ts`): the fixed mark is frozen
-- into the questionnaire snapshot.

-- ---- guards ------------------------------------------------------------------------------------
DO $$
DECLARE
  bad text;
BEGIN
  -- G1: every other fixed question is already asked in every loan type a name is offered under.
  SELECT string_agg(DISTINCT q."code" || ' (' || l."category" || ')', ', ') INTO bad
    FROM "question" q
   CROSS JOIN (SELECT DISTINCT "category" FROM "platform_enumeration_loan_category") l
   WHERE q."isActive"
     AND q."fixedServedOn" IS NOT NULL
     AND q."code" NOT IN ('car_price', 'car_down_payment', 'car_model_year', 'car_origin',
                          'car_fuel_type', 'car_dealer')
     AND NOT EXISTS (SELECT 1 FROM "question_loan_category" r
                      WHERE r."questionId" = q."id" AND r."category" = l."category"
                        AND NOT r."optIn");
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'program_question_order: fixed questions not asked in a loan type a program is sold under, which "fixed = every program" would start asking there: %', bad;
  END IF;

  -- G2: the six car questions sit in `car` only — the ticks below put them on car names only.
  SELECT string_agg(q."code" || ' (' || r."category" || ')', ', ') INTO bad
    FROM "question" q
    JOIN "question_loan_category" r ON r."questionId" = q."id"
   WHERE q."code" IN ('car_price', 'car_down_payment', 'car_model_year', 'car_origin',
                      'car_fuel_type', 'car_dealer')
     AND r."category" <> 'car';
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'program_question_order: car questions asked outside car loans: %', bad;
  END IF;
END $$;

-- ---- 1. the program order table ----------------------------------------------------------------
CREATE TABLE "program_name_question_order" (
    "enumerationId" VARCHAR(30) NOT NULL,
    "category" "LoanCategory" NOT NULL,
    "questionId" VARCHAR(30) NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(30),

    CONSTRAINT "program_name_question_order_pkey" PRIMARY KEY ("enumerationId","category","questionId")
);

CREATE INDEX "idx_program_name_question_order_position" ON "program_name_question_order"("enumerationId", "category", "position");

CREATE INDEX "idx_program_name_question_order_question" ON "program_name_question_order"("questionId");

ALTER TABLE "program_name_question_order" ADD CONSTRAINT "program_name_question_order_enumerationId_fkey" FOREIGN KEY ("enumerationId") REFERENCES "platform_enumeration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "program_name_question_order" ADD CONSTRAINT "program_name_question_order_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seeded with today's served order: the loan type's position, then the pool's, then the code —
-- the tie-break `toCustomerSnapshot` sorted by. Every row of the loan type, asked by this name or
-- not, so a question a bank starts reading later lands where it used to be. An opt-in row only
-- where this name adds it (none existed when this was written).
INSERT INTO "program_name_question_order" ("enumerationId", "category", "questionId", "position")
SELECT l."enumerationId", l."category", r."questionId",
       (ROW_NUMBER() OVER (PARTITION BY l."enumerationId", l."category"
                           ORDER BY r."displayOrder", q."displayOrder", q."code") - 1)::int
  FROM "platform_enumeration_loan_category" l
  JOIN "platform_enumeration" e ON e."id" = l."enumerationId" AND e."type" = 'program_name'
  JOIN "question_loan_category" r ON r."category" = l."category"
  JOIN "question" q ON q."id" = r."questionId"
 WHERE NOT r."optIn"
    OR EXISTS (SELECT 1 FROM "program_name_question_addition" a
                WHERE a."enumerationId" = l."enumerationId" AND a."category" = l."category"
                  AND a."questionId" = r."questionId");

-- ---- 2. the six car questions: fixed → ticked on every car program -----------------------------
UPDATE "question_option"
   SET "effectMaxLoanPercent" = NULL, "effectRatePoints" = NULL, "effectMaxTenorMonths" = NULL
 WHERE "questionId" IN (SELECT "id" FROM "question"
                         WHERE "code" IN ('car_price', 'car_down_payment', 'car_model_year',
                                          'car_origin', 'car_fuel_type', 'car_dealer'));

UPDATE "question"
   SET "fixedServedOn" = NULL, "numberEffects" = NULL
 WHERE "code" IN ('car_price', 'car_down_payment', 'car_model_year', 'car_origin',
                  'car_fuel_type', 'car_dealer');

INSERT INTO "program_name_question_addition" ("enumerationId", "category", "questionId")
SELECT l."enumerationId", l."category", q."id"
  FROM "platform_enumeration_loan_category" l
  JOIN "platform_enumeration" e ON e."id" = l."enumerationId" AND e."type" = 'program_name'
  JOIN "question" q ON q."isActive"
                   AND q."code" IN ('car_price', 'car_down_payment', 'car_model_year',
                                    'car_origin', 'car_fuel_type', 'car_dealer')
 WHERE l."category" = 'car'
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  n int;
  off text;
BEGIN
  SELECT count(*) INTO n FROM "program_name_question_addition" a
    JOIN "question" q ON q."id" = a."questionId"
   WHERE q."code" IN ('car_price', 'car_down_payment', 'car_model_year', 'car_origin',
                      'car_fuel_type', 'car_dealer');
  SELECT string_agg("code", ', ') INTO off FROM "question"
   WHERE NOT "isActive"
     AND "code" IN ('car_price', 'car_down_payment', 'car_model_year', 'car_origin',
                    'car_fuel_type', 'car_dealer');
  RAISE NOTICE 'program_question_order: % car-question ticks on car programs', n;
  IF off IS NOT NULL THEN
    RAISE NOTICE 'program_question_order: switched off, so not ticked anywhere: %', off;
  END IF;
END $$;
