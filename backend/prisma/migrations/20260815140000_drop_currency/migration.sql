-- Drop the currency dimension platform-wide. EGP is the only currency the
-- product has ever sold in: every seeded catalog, the calculator and the whole
-- mobile surface already hardcode it, so `currencies[]`, `requestedCurrency`
-- and the per-currency loan-limit map were configuration nobody could vary.
--
-- DESTRUCTIVE and one-way. `bank_offer.currency` is a column on an immutable
-- offer (Principle I): dropping it removes a frozen fact from historical rows.
-- Every surviving row carried 'EGP' — the value is not recoverable from the
-- offer, only from that invariant.

-- 1. bank_program.loanLimits: { perCurrency: { EGP: { minAmount, maxAmount } } }
--    → { minAmountEGP, maxAmountEGP }. Sibling keys (maxByCDTier, ltvCeilingPercent,
--    …) are preserved; the currency map is the only key replaced.
UPDATE "bank_program"
SET "loanLimits" = ("loanLimits" - 'perCurrency')
  || jsonb_build_object(
       'minAmountEGP', COALESCE("loanLimits" -> 'perCurrency' -> 'EGP' ->> 'minAmount', '0'),
       'maxAmountEGP', COALESCE("loanLimits" -> 'perCurrency' -> 'EGP' ->> 'maxAmount', '0')
     )
WHERE "loanLimits" ? 'perCurrency';

-- 2. Any row that never carried a perCurrency map still needs the two keys, so
--    the engine reads a limit rather than undefined.
UPDATE "bank_program"
SET "loanLimits" = "loanLimits"
  || jsonb_build_object('minAmountEGP', '0', 'maxAmountEGP', '0')
WHERE NOT ("loanLimits" ? 'minAmountEGP');

-- 3. Columns.
ALTER TABLE "bank_program" DROP COLUMN "currencies";
ALTER TABLE "application" DROP COLUMN "requestedCurrency";
DROP INDEX IF EXISTS "idx_bank_offer_currency";
ALTER TABLE "bank_offer" DROP COLUMN "currency";

-- 4. The operator-curated currency lookup, and its Lookups rail card, are gone.
DELETE FROM "platform_enumeration" WHERE "type" = 'currency';
