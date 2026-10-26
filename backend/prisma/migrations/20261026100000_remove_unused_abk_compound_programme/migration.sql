-- Compound Owner had TWO ABK programmes (operator, 2026-10-26: "remove the unused one").
--
--   - `ABK-PER-COMPOUND_OWNER` — the seeded one (`seed:sheet-figures`). Kept.
--   - `ABK-PERSONAL-7110` — made from the admin wizard on 2026-09-06 with the same figures, in
--     no seed, and never offered to anyone. A compound owner was quoted ABK twice for one thing.
--
-- Deleted the way `BankProgramsService.deleteByCode` deletes: refused while any offer names it
-- (an offer is immutable history, A6), a `BANK_PROGRAM_DELETED` audit event written first, and
-- `audit_event.bankProgramId` nulled by its own `ON DELETE SET NULL` — the events keep the
-- code in their payload. Idempotent: a database that never had the row (a fresh install, the
-- seeds do not make it) does nothing.
DO $$
DECLARE
  dup bank_program%ROWTYPE;
  offers integer;
BEGIN
  SELECT * INTO dup FROM "bank_program" WHERE "programCode" = 'ABK-PERSONAL-7110';
  IF NOT FOUND THEN
    RAISE NOTICE 'remove_unused_abk_compound_programme: no ABK-PERSONAL-7110 here — nothing to do';
    RETURN;
  END IF;

  SELECT count(*) INTO offers FROM "bank_offer" WHERE "programCode" = 'ABK-PERSONAL-7110';
  IF offers > 0 THEN
    RAISE EXCEPTION 'remove_unused_abk_compound_programme: ABK-PERSONAL-7110 has % offer(s) — it is used, not removed', offers;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "bank_program"
    WHERE "programCode" = 'ABK-PER-COMPOUND_OWNER' AND "programNameKey" = dup."programNameKey"
  ) THEN
    RAISE EXCEPTION 'remove_unused_abk_compound_programme: the seeded ABK-PER-COMPOUND_OWNER is not beside it — refusing to leave ABK with no Compound Owner programme';
  END IF;

  INSERT INTO "audit_event" ("id", "eventType", "actorId", "targetId", "bankProgramId", "sourceIp", "payload", "occurredAt")
  VALUES (
    'cl' || substr(md5(random()::text), 1, 28),
    'BANK_PROGRAM_DELETED',
    NULL, NULL, NULL, NULL,
    jsonb_build_object(
      'programCode', dup."programCode",
      'friendlyName', dup."friendlyName",
      'bankName', dup."bankName",
      'deletedAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'reason', 'duplicate of ABK-PER-COMPOUND_OWNER, never offered (migration 20261026100000)'
    ),
    now()
  );

  DELETE FROM "bank_program" WHERE "id" = dup."id";
END $$;
