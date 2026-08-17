-- Re-point the six programs whose catalog name does not describe them — step 4
-- of 5. Nothing reads the catalog rule yet, so this changes NO behaviour today:
-- `programNameKey` is a label and a picker filter, and every one of these programs
-- keeps its own `incomeAssumption` untouched.
--
-- ONLY PROGRAMS THAT ALREADY CARRY THE RULE MOVE. That is the whole safety
-- property of this step, and it is easy to get wrong in the generous direction —
-- an earlier draft also moved CIB-PER-PROFESSIONAL, HSBC-PER-PROFESSIONAL,
-- ABK-PER-DOCTOR, CIB-PER-DOCTOR, ABK-DOCTORS-CLINIC and NBE-PER-ARMED_FORCES,
-- which was WRONG. Those are `income_surrogate` programs carrying
-- `{"strategy":"declared"}`: they quote the income the applicant states. Filing
-- them under a name that carries a real table would, once step 5's successor reads
-- the catalog, hand them a table they never had and MOVE their quoted income. They
-- stay on `professional`, `doctor` and `armed_forces`, which is why those two names
-- keep `incomeRule` NULL.
--
-- Addressed by `programCode` (@unique, and deterministic in every environment),
-- never by `id` — ids are cuids and differ per database.

-- Academic-rank table (12 000 / 18 000 / 25 000) → the name that means it.
UPDATE "bank_program" SET "programNameKey" = 'professor'       WHERE "programCode" = 'ABK-PROFESSORS';

-- Years-in-practice bands. Splits from ABK-DOCTORS-CLINIC, which is a salaried
-- clinic doctor with no table and stays on `doctor`.
UPDATE "bank_program" SET "programNameKey" = 'doctor_practice' WHERE "programCode" = 'ABK-DOCTORS-PRACTICE';

-- 30% of bank statement turnover — an owner's income, not a professional's fee.
UPDATE "bank_program" SET "programNameKey" = 'self_employed'   WHERE "programCode" = 'SF-SELF-EMP';

-- The three below are `declared` → `declared`: they move to a name that also holds
-- `{"strategy":"declared"}`, so NO FIGURE MOVES, now or after the read moves in
-- PR 2. They move because leaving them on `professional` is what forces that name
-- to mean four different things at once — which is the condition the final check
-- below exists to detect.
UPDATE "bank_program" SET "programNameKey" = 'athlete'         WHERE "programCode" = 'ABK-FOOTBALL';
UPDATE "bank_program" SET "programNameKey" = 'wealth_tier'     WHERE "programCode" = 'ABK-WEALTH';
UPDATE "bank_program" SET "programNameKey" = 'wealth_tier'     WHERE "programCode" = 'SF-HIGH-END';

-- ===========================================================================
-- FINAL CHECK — does any catalog name still hold two DIFFERENT real rules?
-- ===========================================================================
-- After the moves above, no seeded name should: that is the state that makes the
-- rule safe to state once per name.
--
-- RAISE WARNING, NOT RAISE EXCEPTION, deliberately.
--
--   1. PR 1 changes no behaviour. Nothing reads `platform_enumeration."incomeRule"`
--      yet, so a name holding two rules today is a data observation, not a broken
--      quote. Failing a deploy over it would be failing it over something that is
--      not yet true.
--   2. `prisma/seed-surrogate-demo.ts` is a DEV seeder that writes real tables onto
--      four matrix programs (ABK-PER-DOCTOR, CIB-PER-DOCTOR, CIB-PER-PROFESSIONAL,
--      HSBC-PER-PROFESSIONAL) to demonstrate the value-source gate. Any developer
--      database that has run it WILL trip this check, on demo data that PR 2
--      rewrites anyway — and an exception here would block that developer's
--      migrate on someone else's demo fixture.
--
-- The HARD gate belongs in PR 2, where the catalog rule becomes the authority and
-- a name meaning two things is a wrong income on a real offer. Until then this is
-- a line in the deploy log naming exactly what a human should look at.
DO $$
DECLARE
    r record;
    n int := 0;
BEGIN
    FOR r IN
        SELECT "programNameKey" AS key,
               count(DISTINCT "incomeAssumption") AS rules,
               string_agg(DISTINCT "programCode", ', ' ORDER BY "programCode") AS programs
        FROM "bank_program"
        WHERE "programNameKey" IS NOT NULL
          AND "incomeAssumption" ->> 'strategy' IS DISTINCT FROM 'declared'
        GROUP BY "programNameKey"
        HAVING count(DISTINCT "incomeAssumption") > 1
    LOOP
        n := n + 1;
        RAISE WARNING
            'program name ''%'' holds % different income rules (%) — PR 2 must reconcile these before the catalog rule becomes authoritative',
            r.key, r.rules, r.programs;
    END LOOP;

    IF n = 0 THEN
        RAISE NOTICE 'income-rule re-point: every catalog name holds at most one distinct rule';
    END IF;
END $$;
