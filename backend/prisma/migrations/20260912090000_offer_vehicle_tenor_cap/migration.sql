-- The term ceiling a VEHICLE carried, frozen on the offer it shortened.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
-- A bank's used-car card states how long it will finance a car of a given model year, origin
-- and down payment. `tenor.maxMonthsByFact` is that table, and it shortens the term rather
-- than refusing the program — so an offer can come back at 44 months when the applicant asked
-- for 84, with two different rules having moved it: this ceiling and the applicant's age at
-- maturity. `effectiveTenorMonths` alone cannot tell them apart, and "your term was cut" with
-- no reason is the complaint `bindingConstraint` was added to answer one column over.
--
-- The pair (this, `effectiveTenorMonths`) is the whole sentence: "this bank finances a 2016
-- car for at most 48 months, and your age brought that to 44."
--
-- ── WHY A MIGRATION AND NOT A SEED ──────────────────────────────────────────
-- One column on `bank_offer`. Nothing derives it from existing data — see the backfill note.
--
-- ── WHERE IN THE LIST ───────────────────────────────────────────────────────
-- Beside `requiredDownPaymentEGP` and `collateralCeilingEGP`, the two fields it is frozen for
-- the same reason as: all three are a ceiling the customer needs to see even when something
-- else ended up binding.
--
-- ── NO BACKFILL, AND THAT IS THE POINT ──────────────────────────────────────
-- No offer written before today was quoted against a vehicle table — none existed. Even for
-- one that had been, deriving the figure now would need the bank's table and the applicant's
-- answers AS THEY WERE, and both can move, so a computed value would be a claim about a
-- frozen offer that nobody made (Principle I / A6).
--
-- `NULL` reads as "no vehicle table applied", never as zero: a zero ceiling would say this
-- bank finances the car for no time at all, which is a refusal, not a missing record.
--
-- ── IDEMPOTENT ──────────────────────────────────────────────────────────────
-- `ADD COLUMN IF NOT EXISTS`; re-applying writes nothing.
ALTER TABLE "bank_offer"
  ADD COLUMN IF NOT EXISTS "vehicleMaxTenorMonths" INTEGER;

DO $$
DECLARE cols int; rows_set int;
BEGIN
  SELECT count(*) INTO cols
  FROM information_schema.columns
  WHERE table_name = 'bank_offer' AND column_name = 'vehicleMaxTenorMonths';
  IF cols <> 1 THEN
    RAISE EXCEPTION 'bank_offer.vehicleMaxTenorMonths: expected 1 column, found %', cols;
  END IF;

  SELECT count(*) INTO rows_set FROM "bank_offer" WHERE "vehicleMaxTenorMonths" IS NOT NULL;
  RAISE NOTICE 'bank_offer.vehicleMaxTenorMonths populated on % row(s) (expected 0)', rows_set;
END $$;
