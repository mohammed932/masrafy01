-- The "Secured Against a Deposit" product is retired: blueprint, catalog name, its two bank
-- programmes (SCB / CAE), its payment-frequency question, fact and list. The seeds no longer
-- write any of it; this removes what earlier databases already hold. A fresh database has
-- nothing to do and this file is a no-op there.
DO $$
DECLARE
  bad integer;
BEGIN
  -- Immutable offers name their programme by plain string (Principle I / A6). Never orphan one.
  SELECT count(*) INTO bad FROM "bank_offer"
   WHERE "programCode" IN ('SCB-PER-DEPOSIT_SECURED','CAE-PER-DEPOSIT_SECURED')
      OR "programCode" IN (SELECT "programCode" FROM "bank_program" WHERE "programNameKey" = 'deposit_secured');
  IF bad > 0 THEN
    RAISE EXCEPTION 'remove_deposit_secured: % immutable offer(s) name a deposit-secured programme — refusing', bad;
  END IF;

  DELETE FROM "bank_program" WHERE "programNameKey" = 'deposit_secured';

  DELETE FROM "platform_enumeration"
   WHERE ("type" = 'program_name' AND "key" = 'deposit_secured')
      OR ("type" = 'surrogate_product' AND "key" = 'deposit_secured_ceiling')
      OR ("type" = 'surrogate_fact' AND "key" = 'payment_frequency')
      OR ("type" = 'payment_frequency');

  DELETE FROM "enumeration_type_def" WHERE "key" = 'payment_frequency';

  -- The question stays (answers reference it, RESTRICT) but is switched off, so nobody is
  -- asked how often they would repay a loan that no longer exists. Republish the
  -- questionnaire after deploying so the served snapshot drops it.
  UPDATE "question" SET "isActive" = false WHERE "code" = 'payment_frequency';
END $$;
