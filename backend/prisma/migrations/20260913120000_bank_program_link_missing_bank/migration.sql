-- Link a bank program that names its bank in text but points at no bank row.
--
-- `bank_program.bankId` is nullable and `bank_program.bankName` is a deprecated
-- denormalised display column. `sheet-programs.ts` builds its DTOs with the NAME and never
-- the id, so every program `seed:sheet-figures` created was born unlinked — seven of them
-- on this database, all seven Suez Canal Bank's, against twenty-nine linked rows written by
-- other seeds. The bank detail page lists by `bankId`, so those seven were invisible: the
-- bank read "0 programs across 0 categories" while its seven car programmes were live,
-- active and quoting. The portfolio mix, the category counts and the health ring read 0 for
-- the same reason, and a bank's own page is where an operator goes to find its programmes.
--
-- The join is by NAME, and it is exact rather than fuzzy: `bank.nameEnglish` is `@unique`
-- (schema.prisma:368), so one name resolves to at most one bank and there is no arbitrary
-- pick. Only a row that points at NOTHING is touched — a program already carrying a
-- `bankId` is left alone even where its text name disagrees, because the FK is the
-- authority and correcting the loser of that disagreement is a different decision.
--
-- NOTHING IS ASSERTED, AND THAT IS DELIBERATE. Both properties worth checking are true by
-- construction of the join above — a row it linked cannot have come out NULL, and cannot
-- have come out pointing at a bank whose name differs from the text it matched on — so a
-- `RAISE` over them would only ever fire on rows this statement did not touch. A `bankName`
-- naming a bank the database has never held is a legitimate state (the column outlives the
-- relation by design), and aborting `migrate deploy` over one would refuse a healthy deploy
-- for a row nothing reads. What is left is a NOTICE, so a deploy that fixes nothing says so
-- instead of looking like a deploy that fixed everything.
DO $$
DECLARE
  linked integer;
  unlinked integer;
BEGIN
  WITH moved AS (
    UPDATE "bank_program" AS p
    SET "bankId" = b."id"
    FROM "bank" AS b
    WHERE p."bankId" IS NULL
      AND b."nameEnglish" = p."bankName"
    RETURNING p."programCode"
  )
  SELECT count(*) INTO linked FROM moved;

  SELECT count(*) INTO unlinked FROM "bank_program" WHERE "bankId" IS NULL;

  RAISE NOTICE 'bank_program: % row(s) linked to their bank; % row(s) still carry no bankId (no bank row holds their bankName)',
    linked, unlinked;
END $$;
