-- The car insurance policy, as a `required_document` row.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
-- App. §4.2 makes comprehensive cover a CONDITION of Suez Canal Bank's 20% down-payment
-- programme and not of the 60/50/40% ones, and ADIB prices a whole column of its card on
-- whether the car is insured. The requirement half of that is a document the bank asks for,
-- and it has no registry key — so a programme naming it is refused outright.
--
-- This is the REQUIREMENT only. Insurance as a COST is deliberately not modelled: no sheet in
-- the source reference prints a premium, and a made-up figure would be financed into an
-- immutable offer (Principle I / A6).
--
-- ── WHY A MIGRATION AND NOT A SEED ──────────────────────────────────────────
-- `cross-config.validators.ts#validateAgainstRegistry` throws `UnknownEnumerationKeyException`
-- (422) on an unknown `requiredDocuments` key — a hard refusal, not a warning — so no seed can
-- save a programme naming this until the row exists. `migrate deploy` runs before every seed,
-- which is the only ordering that is reproducible.
--
-- ── WHERE IN THE LIST ───────────────────────────────────────────────────────
-- `sortOrder` 16, continuing the set the SCB auto documents ended at (12–15). Not unique —
-- NATIONAL_ID_FRONT/_BACK already reuse 1 and 2.
--
-- ── NO FIGURE MOVES ─────────────────────────────────────────────────────────
-- One registry row. No programme, no rule and no figure is touched; nothing names it yet.
--
-- ── IDEMPOTENT ──────────────────────────────────────────────────────────────
-- `ON CONFLICT ("type","key") DO NOTHING`, and `systemOnly` is false because this is
-- operator-editable like every other `required_document`.
INSERT INTO "platform_enumeration"
  ("id","type","key","labelAr","labelEn","active","systemOnly","sortOrder","createdAt","updatedAt")
VALUES
  ('clpe160doccarinsurance0a000','required_document','car_insurance_policy','وثيقة تأمين السيارة','Car insurance policy',true,false,16,now(),now())
ON CONFLICT ("type","key") DO NOTHING;

DO $$
DECLARE present int;
BEGIN
  SELECT count(*) INTO present
  FROM "platform_enumeration"
  WHERE "type" = 'required_document' AND "key" = 'car_insurance_policy' AND "active";
  IF present <> 1 THEN
    RAISE EXCEPTION 'car insurance document: expected 1 active row, found %', present;
  END IF;
END $$;
