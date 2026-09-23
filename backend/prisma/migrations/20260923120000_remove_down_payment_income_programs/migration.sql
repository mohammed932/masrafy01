-- Every catalog name quoting from `down_payment_income` ("Car Buyers — Down Payment or
-- Savings"), every bank programme under those names, and every application that was made
-- against them, are removed. The PRODUCT stays: it keeps its questions, its ways and its plan
-- tables, and is sold by nothing until an operator links a new name to it.
--
-- WHAT GOES, in dependency order:
--   1. applications filed under one of those names, or holding an offer from one of those
--      programmes — with everything under them (bank_offer, bank_offer_decision, saved_offer,
--      application_answer, document by cascade; questionnaire_answer explicitly, because its
--      foreign key is ON DELETE SET NULL and would otherwise leave orphaned drafts).
--   2. the bank programmes (an audit row each, written BEFORE the delete, the same payload
--      `scb_down_payment_one_programme` wrote — `audit_event.bankProgramId` is SET NULL, so the
--      payload is the only record that survives).
--   3. the catalog names (their loan-category rows cascade).
--
-- WHY APPLICATIONS GO TOO. `bank_offer` is immutable (Principle I / A6), so an offer cannot be
-- repointed; left in place it names a programme that no longer exists. The operator chose
-- removal over orphaned history. Uploaded document OBJECTS in storage are not touched here —
-- only their rows.
--
-- WHY A MIGRATION AND NOT THE SEED. `seed:sheet-figures` creates and updates and DELETES
-- NOTHING, so dropping the three Suez Canal programmes and the two names from the seed files
-- (done in the same change) would leave the rows live forever. The other programmes under
-- `auto_down_payment_income` were created on the admin screen and exist in no seed at all.
--
-- Selected by the product LINK, not by a list of codes: "every programme quoting from this
-- product" is the statement, and it holds on every environment whatever codes an operator
-- gave their own programmes there. A re-run, or a database that never had any, finds nothing.
DO $$
DECLARE
  names    text[];
  codes    text[];
  apps     text[];
  n        integer;
  actor    text;
BEGIN
  SELECT coalesce(array_agg("key"), '{}') INTO names
    FROM "platform_enumeration"
   WHERE "type" = 'program_name' AND "surrogateProductKey" = 'down_payment_income';

  IF cardinality(names) = 0 THEN
    RAISE NOTICE 'remove_down_payment_income_programs: no catalog name links to down_payment_income — nothing to remove';
    RETURN;
  END IF;

  SELECT coalesce(array_agg("programCode"), '{}') INTO codes
    FROM "bank_program" WHERE "programNameKey" = ANY(names);

  -- Every one of them must be a CAR programme on the no-payslip basis. Anything else under
  -- these names is not what this file was written about, and deleting it silently is worse
  -- than stopping the deploy.
  SELECT count(*) INTO n FROM "bank_program"
   WHERE "programCode" = ANY(codes)
     AND ("productCategory" <> 'car' OR "programType" <> 'income_surrogate');
  IF n > 0 THEN
    RAISE EXCEPTION 'remove_down_payment_income_programs: % programme(s) under these names are not surrogate car programmes — refusing', n;
  END IF;

  SELECT coalesce(array_agg(DISTINCT a."id"), '{}') INTO apps
    FROM "application" a
   WHERE a."programNameKey" = ANY(names)
      OR EXISTS (SELECT 1 FROM "bank_offer" o
                  WHERE o."applicationId" = a."id" AND o."programCode" = ANY(codes));

  -- Actor for the audit rows: the system account, else the first super admin. None at all
  -- is a database where the trail cannot be written truthfully.
  SELECT "id" INTO actor FROM "staff_account" WHERE "email" = 'system@masrafy.local' LIMIT 1;
  IF actor IS NULL THEN
    SELECT "id" INTO actor FROM "staff_account"
     WHERE "role" = 'super_admin' ORDER BY "createdAt" LIMIT 1;
  END IF;
  IF actor IS NULL AND cardinality(codes) > 0 THEN
    RAISE EXCEPTION 'remove_down_payment_income_programs: no staff account to attribute the delete to — refusing to delete programmes with no audit trail';
  END IF;

  -- 1. Applications.
  DELETE FROM "questionnaire_answer" WHERE "applicationId" = ANY(apps);
  DELETE FROM "application" WHERE "id" = ANY(apps);
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'remove_down_payment_income_programs: % application(s) removed', n;

  -- 2. Bank programmes — audit first.
  INSERT INTO "audit_event" ("id", "occurredAt", "actorId", "targetId", "bankProgramId", "eventType", "payload")
  SELECT
    'rmdp' || substr(md5(random()::text || p."programCode"), 1, 21),
    now(), actor, NULL, NULL, 'BANK_PROGRAM_DELETED',
    jsonb_build_object(
      'programCode', p."programCode",
      'friendlyName', p."friendlyName",
      'bankName', p."bankName",
      'deletedAt', now(),
      'reason', 'removed with every programme quoting from down_payment_income',
      'id', p."id",
      'version', p."version",
      'bankId', p."bankId",
      'programNameKey', p."programNameKey",
      'productCategory', p."productCategory",
      'programType', p."programType",
      'active', p."active",
      'loanLimits', p."loanLimits",
      'tenor', p."tenor",
      'pricing', p."pricing",
      'fees', p."fees",
      'eligibility', p."eligibility",
      'performanceCriteria', p."performanceCriteria",
      'incomeAssumption', p."incomeAssumption",
      'requiredDocuments', to_jsonb(p."requiredDocuments"),
      'valueSources', p."valueSources",
      'operatorNotes', p."operatorNotes",
      'createdAt', p."createdAt",
      'updatedAt', p."updatedAt"
    )
  FROM "bank_program" AS p WHERE p."programCode" = ANY(codes);

  DELETE FROM "bank_program" WHERE "programCode" = ANY(codes);
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'remove_down_payment_income_programs: % bank programme(s) removed', n;

  -- 3. Catalog names.
  DELETE FROM "platform_enumeration" WHERE "type" = 'program_name' AND "key" = ANY(names);
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'remove_down_payment_income_programs: % catalog name(s) removed', n;

  -- END STATE, ASSERTED.
  IF EXISTS (SELECT 1 FROM "bank_program" WHERE "programNameKey" = ANY(names))
     OR EXISTS (SELECT 1 FROM "bank_offer" WHERE "programCode" = ANY(codes))
     OR EXISTS (SELECT 1 FROM "application" WHERE "programNameKey" = ANY(names))
     OR EXISTS (SELECT 1 FROM "platform_enumeration"
                 WHERE "type" = 'program_name' AND "surrogateProductKey" = 'down_payment_income') THEN
    RAISE EXCEPTION 'remove_down_payment_income_programs: something still points at a removed name or programme';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "platform_enumeration"
                  WHERE "type" = 'surrogate_product' AND "key" = 'down_payment_income') THEN
    RAISE EXCEPTION 'remove_down_payment_income_programs: the product itself is gone — this file must not remove it';
  END IF;
END $$;
