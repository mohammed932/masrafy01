-- Which reduction decided an offer's amount, and the down payment it implies.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
-- `Quote.bindingConstraint` has existed since feature 010 and reached no surface: the
-- customer was shown a cut amount with nothing saying whether their income, the program's
-- ceiling or the share of the car's price cut it. The auto programs make that the difference
-- between "borrow less" and "put more down", so the answer has to travel.
-- `requiredDownPaymentEGP` is the second half of the same sentence: price − cash paid out.
--
-- ── WHY A MIGRATION AND NOT A SEED ──────────────────────────────────────────
-- Two columns on `bank_offer`. Nothing derives them from existing data — see the backfill
-- note below — so this is schema only.
--
-- ── WHERE IN THE LIST ───────────────────────────────────────────────────────
-- Beside `collateralCeilingEGP`, the field they are frozen for the same reason as.
--
-- ── NO BACKFILL, AND THAT IS THE POINT ──────────────────────────────────────
-- An offer written before today recorded no constraint. Deriving one now would need the
-- program's limits and the applicant's answers AS THEY WERE, and both can have moved since —
-- so a computed value would be a claim about a frozen offer that nobody made (Principle I /
-- A6). `null` reads as "not recorded", and every surface renders the absence.
--
-- ── IDEMPOTENT ──────────────────────────────────────────────────────────────
-- `ADD COLUMN IF NOT EXISTS`; re-applying writes nothing.
ALTER TABLE "bank_offer"
  ADD COLUMN IF NOT EXISTS "bindingConstraint" VARCHAR(32),
  ADD COLUMN IF NOT EXISTS "requiredDownPaymentEGP" DECIMAL(13,2);

DO $$
DECLARE cols int; rows_null int;
BEGIN
  SELECT count(*) INTO cols
  FROM information_schema.columns
  WHERE table_name = 'bank_offer'
    AND column_name IN ('bindingConstraint', 'requiredDownPaymentEGP');
  IF cols <> 2 THEN
    RAISE EXCEPTION 'offer binding columns: expected 2, found %', cols;
  END IF;

  SELECT count(*) INTO rows_null FROM "bank_offer" WHERE "bindingConstraint" IS NULL;
  RAISE NOTICE 'offer binding columns: % existing offer(s) carry no constraint, as intended', rows_null;
END $$;
