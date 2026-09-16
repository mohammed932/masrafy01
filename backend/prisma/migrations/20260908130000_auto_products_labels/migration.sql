-- The two Suez Canal Bank auto products are named after their mechanism alone
-- (`Down Payment as Income`, `Savings as Income`), so `/program-catalog?basis=no_payslip`
-- — which sorts by the rendered label — filed them under D and S with nothing on either
-- card saying they are auto products. Both are sold under `car` and nothing else.
--
-- Labels only. The KEYS `down_payment_income` / `savings_income` are addressed by
-- `platform_enumeration.surrogateProductKey` (both catalog names), by
-- `surrogate_product_ask.productId` and by the blueprint registry, so a key rename would
-- orphan every one of them.
--
-- A migration rather than a re-seed: `seed:blueprints` writes a product's labels only on the
-- run that CREATES the row (`planSeedAction` answers `skip` for a product that already holds
-- a calculation), so a re-seed cannot relabel and code and row would disagree permanently.
-- Unconditional by key: there is no admin door that renames a `surrogate_product` row (it is
-- off the values rail and the product page offers no rename), so the row cannot be holding an
-- operator's own words.

UPDATE "platform_enumeration"
SET "labelEn" = 'Auto Loan — Down Payment as Income',
    "labelAr" = 'قرض سيارة — الدفعة المقدمة كدخل',
    "updatedAt" = now()
WHERE "type" = 'surrogate_product' AND "key" = 'down_payment_income';

UPDATE "platform_enumeration"
SET "labelEn" = 'Auto Loan — Savings as Income',
    "labelAr" = 'قرض سيارة — المدخرات كدخل',
    "updatedAt" = now()
WHERE "type" = 'surrogate_product' AND "key" = 'savings_income';

-- Assert the end state rather than assume it — but only for the rows that are actually THERE.
--
-- These two products are written by `seed:blueprints`, which runs AFTER `migrate deploy` in the
-- documented order (`migrate deploy → build → seed:questionnaire → seed:blueprints → ...`). So on
-- a fresh database this file legitimately finds nothing: demanding 2 made the whole chain
-- unreplayable, and `migrate reset` and every new environment stopped here with
-- `expected 2 ... found 0`. Nothing is lost by passing — a database with no product row has no
-- stale label to correct, and the seed creates the row with the label the registry carries.
--
-- This is the posture the very next migration takes for the same two rows:
-- `20260909090000_auto_product_one_two_ways` merges them and opens with
-- "A fresh database is seeded straight into the merged state and this file finds nothing to do",
-- returning on a NOTICE rather than raising.
--
-- A HALF-state still raises: every product row of these two keys that exists must carry the auto
-- label, or the UPDATEs above did not do what this file says they do.
DO $$
DECLARE
  present int;
  renamed int;
BEGIN
  SELECT count(*) INTO present
  FROM "platform_enumeration"
  WHERE "type" = 'surrogate_product'
    AND "key" IN ('down_payment_income', 'savings_income');

  IF present = 0 THEN
    RAISE NOTICE 'auto_products_labels: neither auto product exists — nothing to relabel (fresh database, seed has not run)';
    RETURN;
  END IF;

  SELECT count(*) INTO renamed
  FROM "platform_enumeration"
  WHERE "type" = 'surrogate_product'
    AND "key" IN ('down_payment_income', 'savings_income')
    AND "labelEn" LIKE 'Auto Loan — %'
    AND "labelAr" LIKE 'قرض سيارة — %';

  IF renamed <> present THEN
    RAISE EXCEPTION 'expected all % auto surrogate product(s) to carry the auto label, found %', present, renamed;
  END IF;
END $$;
