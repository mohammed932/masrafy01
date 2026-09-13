-- The PLAN tables a surrogate product hands down, and the one field that decides whose apply.
--
-- A plan is one row of a bank's auto card: "20% down -> 10% a year, 6-60 months, we finance
-- 80%, and not under a million". Four figures against one axis, each already a
-- `FactGridConfig` the engine prices from today. Nothing here is a new mechanism; these two
-- columns decide which COPY of those tables a programme reads.
--
-- ADDITIVE, NULLABLE, AND NOTHING IS BACKFILLED. Measured before deploy: 0 of 12
-- `surrogate_product` rows would carry `planDefaults`, and 0 of 36 `bank_program` rows carry
-- a rate, term-floor, financed-share or amount-floor grid. `plansSource` is NULL on every
-- row and NULL reads as `'own'`, so every programme on this database goes on reading exactly
-- the figures it reads now.
--
-- WHY A SELECTOR AND NOT "BLANK INHERITS". `tenorDefaults` is inherited by absence, and that
-- was safe because `tenor.minMonths`/`maxMonths` were both REQUIRED until v29.1.0 — "states
-- neither" was unreachable and could be given a new meaning for free. The grids are not in
-- that position. `tenor.maxMonthsByFact` is optional TODAY and a blank one already means
-- something; its own docstring says "a blank grid there is a stated 'this bank does not cap
-- by that', not 'nobody has said yet'". Inheriting by absence would mean that the first table
-- an operator types on a product silently hands every programme under it a ceiling it never
-- had, with no screen having said so. `plansSource` is the same shape as
-- `incomeAssumption.amounts`: it does not describe the tables, it selects whose apply.
--
-- WHY THE SELECTOR IS ON `bank_program` AND NOT INSIDE A BLOB. The four tables live in THREE
-- different JSON columns (`pricing`, `tenor`, `loanLimits`). A key inside any one of them
-- would be a statement about the other two made in the wrong place, and `carriedKeysOf` on
-- the wizard would have to learn it three times.
--
-- WHY `planDefaults` IS ITS OWN COLUMN. Not `incomeRule` -- that blob is
-- `IncomeAssumptionConfig`, read by the income RESOLVER, and a rate is not a statement about
-- income. Not `capDefaults`, whose whole contract is that it is COPIED ONCE at programme
-- create: these are read live, so one column would mean two mechanisms. Not `tenorDefaults`,
-- which is two integers with no axes and no `onNoMatch`.
--
-- No quote moves when this lands.
ALTER TABLE "platform_enumeration" ADD COLUMN "planDefaults" JSONB;
ALTER TABLE "bank_program" ADD COLUMN "plansSource" VARCHAR(16);

DO $$
DECLARE
  products integer;
  programs integer;
BEGIN
  SELECT count(*) INTO products
    FROM "platform_enumeration" WHERE "planDefaults" IS NOT NULL;
  SELECT count(*) INTO programs
    FROM "bank_program" WHERE "plansSource" IS NOT NULL;

  -- Both are zero by construction of an ADD COLUMN with no default. Asserted rather than
  -- assumed because the whole "no quote moves" claim above rests on it: a non-NULL row here
  -- would be a programme reading somebody else's figures from the instant this lands.
  IF products <> 0 OR programs <> 0 THEN
    RAISE EXCEPTION 'plan_defaults_and_source: expected 0 products and 0 programmes to carry the new columns, found % and %', products, programs;
  END IF;

  RAISE NOTICE 'plan_defaults_and_source: columns added; 0 products state plans and 0 programmes read them (absent plansSource = own)';
END $$;
