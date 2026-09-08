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

-- Assert the end state rather than assume it: a product row that is not there at all would
-- otherwise make this migration a silent no-op on a database the seed has never run against.
DO $$
DECLARE renamed int;
BEGIN
  SELECT count(*) INTO renamed
  FROM "platform_enumeration"
  WHERE "type" = 'surrogate_product'
    AND "key" IN ('down_payment_income', 'savings_income')
    AND "labelEn" LIKE 'Auto Loan — %'
    AND "labelAr" LIKE 'قرض سيارة — %';

  IF renamed <> 2 THEN
    RAISE EXCEPTION 'expected 2 auto surrogate products carrying the auto label, found %', renamed;
  END IF;
END $$;
