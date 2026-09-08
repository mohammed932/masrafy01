-- The four documents Suez Canal Bank's auto sheets ask for, as `required_document` rows.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
-- App. §4.5 (unsecured down-payment programs) demands a price quotation and a down-payment
-- receipt on top of the National ID; §5.4 (Green Finance) demands a home-ownership contract
-- and a proforma invoice from an authorised dealer. None of the four has a registry key, and
-- a program naming one without a row is refused outright.
--
-- ── WHY A MIGRATION AND NOT A SEED ──────────────────────────────────────────
-- `cross-config.validators.ts#validateAgainstRegistry` throws `UnknownEnumerationKeyException`
-- (422) on an unknown `requiredDocuments` key — a hard refusal, not a warning — so
-- `npm run seed:sheet-figures` cannot save the seven SCB programs until these rows exist.
-- `migrate deploy` runs before every seed, which is the only ordering that is reproducible;
-- an operator adding them through `/lookups` would create them on one database.
--
-- ── WHERE IN THE LIST ───────────────────────────────────────────────────────
-- `sortOrder` continues the set (national_id 1 … professional_practice_certificate 11), so
-- these take 12–15. It is not unique — NATIONAL_ID_FRONT/_BACK already reuse 1 and 2.
--
-- ── NO FIGURE MOVES ─────────────────────────────────────────────────────────
-- Registry rows only. No program, no rule and no figure is touched.
--
-- ── IDEMPOTENT ──────────────────────────────────────────────────────────────
-- `ON CONFLICT ("type","key") DO NOTHING`, and `systemOnly` is false because these are
-- operator-editable like every other `required_document`.
INSERT INTO "platform_enumeration"
  ("id","type","key","labelAr","labelEn","active","systemOnly","sortOrder","createdAt","updatedAt")
VALUES
  ('clpe150docpricequote000a000','required_document','price_quotation','عرض سعر السيارة','Price quotation',true,false,12,now(),now()),
  ('clpe151docdpreceipt0000a000','required_document','down_payment_receipt','إيصال الدفعة المقدمة','Down payment receipt',true,false,13,now(),now()),
  ('clpe152dochomecontract0a000','required_document','home_ownership_contract','عقد ملكية الوحدة','Home ownership contract',true,false,14,now(),now()),
  ('clpe153docproforma00000a000','required_document','proforma_invoice','فاتورة مبدئية','Proforma invoice',true,false,15,now(),now())
ON CONFLICT ("type","key") DO NOTHING;

DO $$
DECLARE present int;
BEGIN
  SELECT count(*) INTO present
  FROM "platform_enumeration"
  WHERE "type" = 'required_document'
    AND "key" IN ('price_quotation','down_payment_receipt','home_ownership_contract','proforma_invoice')
    AND "active";
  IF present <> 4 THEN
    RAISE EXCEPTION 'scb auto documents: expected 4 active rows, found %', present;
  END IF;
END $$;
