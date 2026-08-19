-- The income proof becomes the catalog NAME's property, and this closes the gap that
-- opens the moment it is enforced.
--
-- Step 3 of the earlier sequence (`20260817090200`) deliberately left `incomeRule` NULL
-- on every name whose programs are all `declared`, on the reasoning that "there is no
-- rule to state, and writing one would claim a decision nobody made". That reasoning
-- held while nothing read the column. It stops holding now: NULL has become an
-- ANSWER — "nobody has decided" — and a surrogate program filed under such a name is
-- refused with `PROGRAM_NAME_INCOME_PROOF_MISSING`.
--
-- Eleven live programs sit under four such names. Without this migration every one of
-- them becomes unsavable on its next unrelated edit (a rate change, a fee change),
-- because `update()` is a full-replacement PUT that re-runs every check — and the same
-- trap `20260817090400` documented would apply: the save that would fix it is the save
-- that fails.
--
--   doctor              ABK-PER-DOCTOR, CIB-PER-DOCTOR                    byYearsInPractice
--   professional        CIB-PER-PROFESSIONAL, HSBC-PER-PROFESSIONAL                declared
--   equipment_finance   ADIB-BIZ-EQUIPMENT_FINANCE, BM-BIZ-EQUIPMENT_FINANCE       declared
--   pharmacy            BDC-PER-PHARMACY, CIB-BIZ-PHARMACY                         declared
--   working_capital     ABK/BDC/CIB/NXT-BIZ-WORKING_CAPITAL                        declared
--
-- `declared` on a no-payslip program is a real configuration, not a missing one: the
-- bank lends against the business and the applicant's own stated income IS the figure
-- (`quote.ts` reads it, the offer records `origin: 'declared'`). Seven seeded business
-- programs are built that way.
--
-- Mirrors `prisma/data/program-catalog-matrix.ts#CATALOG_INCOME_RULE`, which is the
-- durable source; this exists for databases the earlier five migrations already ran on.
-- `AND "incomeRule" IS NULL` on every statement, so a name an operator has since
-- decided for is never overwritten.
--
-- `professional` gets `declared` like the other three, because that is what its two
-- programs carry AS SEEDED (`skeletonFor` types them `income_surrogate` — the archetype
-- is self-employed — with no substitute figure).
--
-- On a dev box those two have been REWRITTEN by `prisma/seed-surrogate-demo.ts` to read
-- academic rank and certificate value, which is two proofs under one name and refused
-- either way — so nothing is lost by stating `declared` here. That seeder now files
-- them under `professor` and `self_employed` instead, so the fix on such a box is to
-- re-run `npm run seed:surrogate:demo`. The report at the foot names them until then.

-- `doctor` — the one name here with a substitute figure. Both its programs read years
-- in practice and AGREE on the proof, which is what makes the name safe to state.
-- FIGURES are ABK-PER-DOCTOR's, the richer of the two tables. Both programs keep their
-- own (`amounts` absent = `'own'`), so this table is only what a NEW program under the
-- name starts from — no existing quote moves.
UPDATE "platform_enumeration"
SET "incomeRule" = '{
  "strategy": "byYearsInPractice",
  "bands": [
    { "fromInclusive": "0",  "toExclusive": "3",  "incomeEGP": "18000" },
    { "fromInclusive": "3",  "toExclusive": "8",  "incomeEGP": "35000" },
    { "fromInclusive": "8",  "toExclusive": "15", "incomeEGP": "60000" },
    { "fromInclusive": "15", "toExclusive": "31", "incomeEGP": "90000" }
  ]
}'::jsonb
WHERE "type" = 'program_name' AND "key" = 'doctor' AND "incomeRule" IS NULL;

-- The four `declared` names. No figures: `declared` has no table by definition, and
-- the empty editor on the catalog screen is the correct rendering, not a bug.
UPDATE "platform_enumeration"
SET "incomeRule" = '{"strategy": "declared"}'::jsonb
WHERE "type" = 'program_name'
  AND "key" IN ('professional', 'equipment_finance', 'pharmacy', 'working_capital')
  AND "incomeRule" IS NULL;

-- The orphan marker `20260817090400` left behind: `professional` and `doctor` carry
-- estimate markers addressing an `incomeRule` that was NULL, moved up from programs the
-- demo seeder had rewritten. `doctor` gets a real table above, so its marker
-- (`incomeRule.bands.3.incomeEGP`) now addresses a band that exists and is KEPT — the
-- 15+ year income genuinely is a team estimate. `professional` is `declared` and has no
-- figures at all, so its marker addresses nothing; a marker on a path that cannot exist
-- would be reported as unknown on the operator's first save and refuse it.
UPDATE "platform_enumeration"
SET "valueSources" = '{}'::jsonb
WHERE "type" = 'program_name'
  AND "key" = 'professional'
  AND "valueSources" <> '{}'::jsonb;

-- ===========================================================================
-- REPORT — every name a surrogate program reads but which states no proof
-- ===========================================================================
-- WARNING, not EXCEPTION. The enforcement is save-time only, so a name left here keeps
-- quoting exactly as it does today; what it loses is the ability to be edited, and that
-- is a fixable operator task rather than a reason to fail a deploy. A dev box carrying
-- `seed-surrogate-demo.ts` legitimately trips this on `professional`.
DO $$
DECLARE
    r record;
    n int := 0;
BEGIN
    FOR r IN
        SELECT bp."programNameKey" AS key,
               count(DISTINCT bp."incomeAssumption" ->> 'strategy') AS proofs,
               string_agg(DISTINCT bp."programCode", ', ' ORDER BY bp."programCode") AS programs
        FROM "bank_program" bp
        LEFT JOIN "platform_enumeration" pe
               ON pe."type" = 'program_name' AND pe."key" = bp."programNameKey"
        WHERE bp."programType" = 'income_surrogate'
          AND bp."programNameKey" IS NOT NULL
          AND pe."incomeRule" IS NULL
        GROUP BY bp."programNameKey"
    LOOP
        n := n + 1;
        RAISE WARNING 'program name % states no income proof but % program(s) read one (% distinct): %',
            r.key, r.proofs, r.proofs, r.programs;
    END LOOP;

    IF n = 0 THEN
        RAISE NOTICE 'income proof: every name a surrogate program is filed under states one';
    ELSE
        RAISE WARNING 'income proof: % name(s) need a decision — run scripts/income-proof-conflicts.ts', n;
    END IF;
END $$;
