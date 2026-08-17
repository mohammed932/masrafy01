-- Backfill: the six catalog names that have an income rule get it — step 3 of 5.
-- Still nothing reads it; `bank_program.incomeAssumption` remains the only
-- authority until the read moves.
--
-- EVERY OTHER NAME KEEPS `incomeRule` NULL, including `doctor` and `professional`.
-- That is not an omission: after step 4 re-points the five table-carrying programs
-- away, every program still filed under those two names carries
-- `{"strategy":"declared"}`, so there is no rule to state and NULL is the honest
-- answer. Writing an explicit `declared` on them would claim an operator had
-- decided something nobody decided.
--
-- The figures below are copied VERBATIM from the program that carries them today.
-- Not one may move: an income that moves is a loan amount that moves, and an
-- offer already written is immutable (Principle I, FR-015). Each statement names
-- its source program so the copy is checkable against the seed in review.
--
-- HAND-WRITTEN LITERALS, NOT A QUERY. The obvious shortcut — copy
-- `incomeAssumption` from whichever program under this name has one — is a
-- `DISTINCT ON (...) ORDER BY "updatedAt" DESC`, which is unreviewable (the
-- reviewer cannot see which of the five ABK `professional` programs it picked) and
-- picks arbitrarily where two programs disagree. Disagreement is precisely what
-- this feature exists to surface, so it may not be resolved by a sort order.

-- ===========================================================================
-- GUARD A — refuse to run against a database where a real rule has no home
-- ===========================================================================
-- A program with a non-`declared` rule and NO `programNameKey` cannot be part of
-- this move: there is no catalog name to carry its table, and step 4 would leave
-- it behind silently. Legacy rows are allowed to have a NULL key (the column is
-- nullable for exactly that reason) — they just may not also carry a table.
--
-- `IS DISTINCT FROM 'declared'` also catches a malformed blob (no `strategy` key,
-- or JSON null): a rule nobody can read, on a program with nowhere to move it, is
-- the same "look at this by hand" as a real one. This is a deliberate stop, not a
-- warning — it runs BEFORE any write, so the deploy fails with nothing half-done.
DO $$
DECLARE
    n int;
BEGIN
    SELECT count(*) INTO n
    FROM "bank_program"
    WHERE "programNameKey" IS NULL
      AND "incomeAssumption" ->> 'strategy' IS DISTINCT FROM 'declared';

    IF n > 0 THEN
        RAISE EXCEPTION
            'PLAN-BLOCK: % program(s) carry a real income rule with no programNameKey — assign a catalog name first', n;
    END IF;
END $$;

-- ===========================================================================
-- The six rules
-- ===========================================================================
-- `AND "incomeRule" IS NULL` on every statement: a re-run (or a baseline replay
-- against a database an operator has since edited) must not overwrite a decision
-- made after this migration first ran — the same posture the catalog inserts take
-- with ON CONFLICT DO NOTHING.

-- SOURCE: ABK-PROFESSORS (`src/bank-programs/seeds/catalogs/abk-egypt-2026.ts`).
-- Academic-rank key table, three ranks, unchanged.
UPDATE "platform_enumeration"
SET "incomeRule" = '{"strategy":"byProfessorRank","keyTable":[{"key":"lecturer","incomeEGP":"12000"},{"key":"assistant_professor","incomeEGP":"18000"},{"key":"professor","incomeEGP":"25000"}]}'::jsonb,
    "updatedAt" = now()
WHERE "type" = 'program_name' AND "key" = 'professor' AND "incomeRule" IS NULL;

-- SOURCE: ABK-DOCTORS-PRACTICE (same file).
-- Years-in-practice bands. The top band STAYS CLOSED at 51 and the lower edge
-- STAYS 6 — the comment above the seed records why: the legacy table overlapped on
-- year 5 and the lookup is first-match, so 5 has always resolved to 15 000, and
-- opening the top band would start paying a 51-year practitioner 40 000 where today
-- they get no figure at all. Both edges are load-bearing (FR-015); this is a COPY,
-- not an opportunity to tidy the table.
UPDATE "platform_enumeration"
SET "incomeRule" = '{"strategy":"byYearsInPractice","bands":[{"fromInclusive":"0","toExclusive":"6","incomeEGP":"15000"},{"fromInclusive":"6","toExclusive":"51","incomeEGP":"40000"}]}'::jsonb,
    "updatedAt" = now()
WHERE "type" = 'program_name' AND "key" = 'doctor_practice' AND "incomeRule" IS NULL;

-- SOURCE: SF-SELF-EMP (`src/bank-programs/seeds/catalogs/salesfloor-egp-2026.ts`),
-- whose legacy shape is `{strategy:'byBankStatementPercent', bankStatementPercent:'30.0'}`.
-- Written in the CANONICAL `scalar` form here because `normalizeIncomeAssumption`
-- produces the identical figure from either — the same conversion the seed's other
-- rules already had applied to them, done once, at the copy.
UPDATE "platform_enumeration"
SET "incomeRule" = '{"strategy":"byBankStatementPercent","scalar":{"value":"30.0","unit":"percent"}}'::jsonb,
    "updatedAt" = now()
WHERE "type" = 'program_name' AND "key" = 'self_employed' AND "incomeRule" IS NULL;

-- SOURCE: ABK-FOOTBALL (abk-egypt-2026.ts). Quoted off the income the applicant
-- states. Written EXPLICITLY rather than left NULL: NULL means "nobody decided",
-- an explicit `declared` means "an operator decided this name uses the typed
-- salary". Both quote the same; only the catalog counters read the difference.
UPDATE "platform_enumeration"
SET "incomeRule" = '{"strategy":"declared"}'::jsonb,
    "updatedAt" = now()
WHERE "type" = 'program_name' AND "key" = 'athlete' AND "incomeRule" IS NULL;

-- SOURCE: ABK-WEALTH + SF-HIGH-END (both catalogs). Two programs, one rule, and
-- they already agree — which is what makes the name safe to state once.
UPDATE "platform_enumeration"
SET "incomeRule" = '{"strategy":"declared"}'::jsonb,
    "updatedAt" = now()
WHERE "type" = 'program_name' AND "key" = 'wealth_tier' AND "incomeRule" IS NULL;

-- SOURCE: ABK-MILITARY (abk-egypt-2026.ts). An EXISTING catalog name, not one of
-- the five added in step 2, and no program moves onto or off it — the rule simply
-- moves up from the one program that already carries it.
UPDATE "platform_enumeration"
SET "incomeRule" = '{"strategy":"byMilitaryGrade","keyTable":[{"key":"officer","incomeEGP":"15000"},{"key":"senior_officer","incomeEGP":"25000"},{"key":"general","incomeEGP":"40000"}]}'::jsonb,
    "updatedAt" = now()
WHERE "type" = 'program_name' AND "key" = 'armed_forces' AND "incomeRule" IS NULL;
