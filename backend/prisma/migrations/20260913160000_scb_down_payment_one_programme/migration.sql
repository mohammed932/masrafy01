-- Suez Canal Bank's five down-payment tiers retire into ONE programme reading the product's
-- plan tables.
--
-- WHY. App. §4 prints five tiers that share an eligibility block, a rate, a fee schedule, a
-- term and the same `income = down payment / 3.6`. What separated them was the share of the
-- car's price financed -- and a share was a scalar, so a different share needed a different
-- programme. `platform_enumeration.planDefaults` now states all five as rows of one table
-- keyed by the deposit the applicant types, so the customer is quoted the tier their own
-- deposit lands in instead of five cards to choose between.
--
-- WHAT THIS FILE DOES AND DOES NOT DO. It deletes the five. It does NOT create the survivor:
-- `seed:sheet-figures` does, through the full save path, with every validator the API runs.
-- The alternative -- pasting the new row here -- would mean this file and the seed both
-- holding seven fields of prose and four JSON blobs that must agree to the byte, and the
-- proof that they do is a seed run reporting "identical to what is stored". Writing it once,
-- in the place that is checked, is strictly better than writing it twice and checking.
--
-- THE DEPLOY WINDOW, STATED. Between this migration and `seed:sheet-figures`, the catalog
-- name `auto_down_payment_income` has NO programme behind it and quotes NOTHING. That is the
-- deliberate direction, and it is the doctors precedent (v25.0.0): a programme quoting
-- nothing is a stated absence, where one surviving tier carrying one scalar share would quote
-- a WRONG figure to four applicants out of five, frozen onto an immutable offer (Principle I
-- / A6). Run order: migrate deploy -> build -> seed:sheet-figures.
--
-- WHY A MIGRATION AND NOT THE SEED. `seed:sheet-figures` creates and updates by programCode
-- and DELETES NOTHING. Four rows dropped from the seed file would stay live, active and
-- quoting forever -- and the next seed run would find them unchanged and say so. The delete
-- has to be here or it does not happen.
--
-- FRESH CODES, NOT A RENAME. `programCode` is immutable through the API (FR-019), so a
-- survivor keeping `SCB-CAR-DP60` would carry a code naming the 40%-share tier on a programme
-- that finances up to 80%, frozen onto every future `bank_offer.programCode`. The v25.0.0
-- rule reuses a key only where a LIVE reader would be stranded; every reader of a programCode
-- (`bank_offer`, `application.noMatchSummary`, `audit_event.payload`) is a frozen historical
-- record, and each keeps meaning exactly what it meant BECAUSE the five codes retire.
DO $$
DECLARE
  doomed   text[] := ARRAY['SCB-CAR-DP20','SCB-CAR-DP30','SCB-CAR-DP40','SCB-CAR-DP50','SCB-CAR-DP60'];
  n        integer;
  bad      integer;
  variants integer;
  actor    text;
BEGIN
  SELECT count(*) INTO n FROM "bank_program" WHERE "programCode" = ANY(doomed);

  -- A fresh database is seeded straight into the collapsed state, and a re-run finds nothing.
  -- NOTICE, never EXCEPTION: a deploy that legitimately has nothing to do must not abort.
  IF n = 0 THEN
    RAISE NOTICE 'scb_down_payment_one_programme: no down-payment tiers found — nothing to collapse (fresh database, or already collapsed)';
    RETURN;
  END IF;
  IF n <> 5 THEN
    RAISE EXCEPTION 'scb_down_payment_one_programme: expected 5 down-payment tiers, found % — this file does not know what it is collapsing', n;
  END IF;

  -- THE GUARD THE SERVICE ONLY PRETENDS TO HAVE. `deleteByCode` refuses a programme with
  -- offers, and the counter behind that refusal returns a hardcoded 0 on a comment saying
  -- `bank_offer` does not exist yet. It does. Nothing frozen may be orphaned by this file.
  SELECT count(*) INTO bad FROM "bank_offer" WHERE "programCode" = ANY(doomed);
  IF bad > 0 THEN
    RAISE EXCEPTION 'scb_down_payment_one_programme: % immutable offer(s) name a tier this file would delete (Principle I / A6) — refusing', bad;
  END IF;

  -- Every tier still sells the product's `primary` way with the sheet's own divisor.
  SELECT count(*) INTO bad FROM "bank_program"
   WHERE "programCode" = ANY(doomed)
     AND (  "incomeAssumption" ->> 'wayId' IS DISTINCT FROM 'primary'
         OR "incomeAssumption" #>> '{stepParams,primary,scalar,value}' IS DISTINCT FROM '3.6' );
  IF bad > 0 THEN
    RAISE EXCEPTION 'scb_down_payment_one_programme: % tier(s) hold a way or a divisor this collapse cannot carry', bad;
  END IF;

  -- The five shares are exactly the five the sheet prints, and they are now rows of the
  -- product's table. A sixth figure would mean the table is short one row.
  SELECT count(*) INTO bad FROM "bank_program"
   WHERE "programCode" = ANY(doomed)
     AND ("programCode", "loanLimits" ->> 'ltvCeilingPercent') NOT IN
         (('SCB-CAR-DP20','80'),('SCB-CAR-DP30','70'),('SCB-CAR-DP40','60'),
          ('SCB-CAR-DP50','50'),('SCB-CAR-DP60','40'));
  IF bad > 0 THEN
    RAISE EXCEPTION 'scb_down_payment_one_programme: % tier(s) state a financed share the product''s plan table does not hold', bad;
  END IF;

  -- EVERYTHING THE COLLAPSE ASSUMES IS COMMON, ASSERTED. An operator hand-editing one tier is
  -- exactly what this must not silently discard: if the five disagree about eligibility,
  -- pricing, fees, the term or the ceiling, they are not one programme and this file is wrong.
  SELECT count(*) INTO variants FROM (
    SELECT DISTINCT "eligibility"::text, "pricing"::text, "fees"::text, "tenor"::text,
                    "performanceCriteria"::text, "loanLimits" ->> 'maxAmountEGP'
      FROM "bank_program" WHERE "programCode" = ANY(doomed)
  ) AS distinct_shapes;
  IF variants <> 1 THEN
    RAISE EXCEPTION 'scb_down_payment_one_programme: the five tiers hold % distinct common configurations — somebody edited one, and this file would throw that away', variants;
  END IF;

  -- The three distinctions this file KNOWS it is dropping are exactly where it expects them,
  -- and on the 20% tier alone. Each is recorded in the survivor's notes.
  SELECT count(*) INTO bad FROM "bank_program"
   WHERE "programCode" = ANY(doomed)
     AND ( ("loanLimits" ->> 'minAmountEGP' = '1000000') IS DISTINCT FROM ("programCode" = 'SCB-CAR-DP20')
        OR ('car_insurance_policy' = ANY("requiredDocuments")) IS DISTINCT FROM ("programCode" = 'SCB-CAR-DP20')
        OR ("incomeAssumption" -> 'stepParams' ? 'cond__homeowned') IS DISTINCT FROM ("programCode" = 'SCB-CAR-DP20') );
  IF bad > 0 THEN
    RAISE EXCEPTION 'scb_down_payment_one_programme: the per-tier floor, document or ownership condition is not where this file expects it (% row(s))', bad;
  END IF;

  -- The product must already state the plan tables that replace these five, or the delete
  -- would leave the catalog name with nothing to be rebuilt from.
  IF NOT EXISTS (
    SELECT 1 FROM "platform_enumeration"
     WHERE "type" = 'surrogate_product' AND "key" = 'down_payment_income'
       AND "planDefaults" ? 'ltvCeilingByFact'
  ) THEN
    RAISE EXCEPTION 'scb_down_payment_one_programme: down_payment_income states no financed-share plan table — run seed:sheet-figures first';
  END IF;

  -- The audit row's `actorId` is a foreign key to `staff_account`, so it has to be a real
  -- one. The platform's own system actor first, then any super admin -- and a database with
  -- neither is one where the audit trail cannot be written truthfully, which is a refusal and
  -- not something to paper over with a literal.
  SELECT "id" INTO actor FROM "staff_account"
   WHERE "email" = 'system@masrafy.local' LIMIT 1;
  IF actor IS NULL THEN
    SELECT "id" INTO actor FROM "staff_account"
     WHERE "role" = 'super_admin' ORDER BY "createdAt" LIMIT 1;
  END IF;
  IF actor IS NULL THEN
    RAISE EXCEPTION 'scb_down_payment_one_programme: no staff account to attribute the delete to — refusing to retire five programmes with no audit trail';
  END IF;

  -- THE AUDIT ROWS, WRITTEN BEFORE THE DELETE. `audit_event.bankProgramId` is ON DELETE SET
  -- NULL and is the only foreign key into `bank_program`, so the payload is the only record
  -- that survives. `BANK_PROGRAM_DELETED`'s own writer sets `bankProgramId` null for exactly
  -- this reason. Written first so a failure between the two cannot leave a deleted row with
  -- no event.
  INSERT INTO "audit_event" ("id", "occurredAt", "actorId", "targetId", "bankProgramId", "eventType", "payload")
  SELECT
    'clps' || substr(md5(random()::text || p."programCode"), 1, 21),
    now(), actor, NULL, NULL, 'BANK_PROGRAM_DELETED',
    jsonb_build_object(
      'programCode', p."programCode",
      'friendlyName', p."friendlyName",
      'bankName', p."bankName",
      'deletedAt', now(),
      'replacedBy', 'SCB-CAR-DOWN_PAYMENT',
      'reason', 'collapsed into one programme reading down_payment_income plan tables',
      'ltvCeilingPercent', p."loanLimits" ->> 'ltvCeilingPercent',
      'minAmountEGP', p."loanLimits" ->> 'minAmountEGP',
      'requiredDocuments', to_jsonb(p."requiredDocuments"),
      'incomeAssumption', p."incomeAssumption",
      'operatorNotes', p."operatorNotes"
    )
  FROM "bank_program" AS p WHERE p."programCode" = ANY(doomed);

  DELETE FROM "bank_program" WHERE "programCode" = ANY(doomed);
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'scb_down_payment_one_programme: % tier(s) retired; run seed:sheet-figures to create SCB-CAR-DOWN_PAYMENT', n;

  -- END STATE, ASSERTED.
  SELECT count(*) INTO bad FROM "bank_program" WHERE "programCode" = ANY(doomed);
  IF bad <> 0 THEN
    RAISE EXCEPTION 'scb_down_payment_one_programme: % tier(s) survived the delete', bad;
  END IF;
  SELECT count(*) INTO bad FROM "bank_offer" WHERE "programCode" = ANY(doomed);
  IF bad > 0 THEN
    RAISE EXCEPTION 'scb_down_payment_one_programme: % offer(s) appeared against a retired code mid-transaction', bad;
  END IF;
END $$;
