-- The doctors product becomes TWO products, one per sheet, and the applicant's own pick is
-- what separates them.
--
-- WHY. `years_in_practice_bands` served App. A §7 (Doctors — Clinic Owners) and App. A §8
-- (Doctors — In Practice) as one product on the reading the spec states at §10.7: they band
-- years in practice identically and "use the same bands with different figures … they are two
-- programs". The bands are the same. Nothing else is: 26.5% against 30%, an age floor of 32
-- against 21, a maximum of 2,000,000 against 1,000,000, opposite accepted employment types,
-- and a maximum-loan table keyed by where the doctor practises on §7 against no cap at all on
-- §8. One card described neither, and the operator reading the board asked which of the two
-- programmes under it was which — the answer was that the screen could not say.
--
-- The merged product also had to invent machinery to keep the two apart: an `owns_practice`
-- yes/no plus two gate conditions, each programme switching on the one it sold. That was a
-- second authority on one decision, and a harmful one — the question was OPTIONAL while an
-- unanswered gate fact is FATAL, so a doctor who skipped it was refused by BOTH programmes.
-- Two products means two catalog names, and the name an applicant picks already narrows the
-- programmes their application is matched against, so the gate is deleted rather than moved.
--
-- WHY A MIGRATION AND NOT THE SEED. `npm run seed:blueprints` never touches a product that
-- already holds a calculation — `planSeedAction` answers `skip`, which is the promise that an
-- operator's edited figures survive a deploy — so it can neither delete the merged product nor
-- relabel the name that points at it. Both halves live in Postgres and are only correct
-- together. `product-blueprints.ts`, `demo-figures/sheet-figures.ts` and
-- `demo-figures/sheet-programs.ts` move in the same change, so a fresh database is seeded
-- straight into the split state and needs nothing from this file.
--
-- FRESH KEYS, not a rename. A key cannot be renamed: `years_in_practice_bands` is addressed by
-- `platform_enumeration.surrogateProductKey`, by `surrogate_product_ask.productId` and by the
-- blueprint registry. So the merged row is retired and two new ones are created — by the seed,
-- because only the seed can compile a template into an `incomeRule`.
--
-- THE DEPLOY WINDOW, STATED. `migrate deploy` runs BEFORE any seed, so between this file and
-- `seed:blueprints` both doctor programmes point at catalog names whose product row does not
-- exist yet. `effectiveProgramNameRule` reads a dangling link as "the name states nothing", so
-- both report `rule_unconfigured` and quote NOTHING in that window. That is the deliberate
-- direction: the alternative — leaving `ABK-PER-DOCTORS_CLINIC` on the in-practice name — would
-- resolve it through the WRONG product's structure and quote a figure, which is how a wrong
-- number reaches an immutable offer (Principle I / A6). The required run order is
--
--   prisma migrate deploy → npm run build → npm run prisma:seed
--     → npm run seed:blueprints → npm run seed:sheet-figures
--
-- and `prisma:seed` is in it because that is what deactivates the retired `owns_practice`
-- question: `seedQuestionnaire` switches off every question its own pool does not name. Until
-- it runs the question is still asked and read by nothing, which is harmless — it was optional.

-- 1. The governorate fact moves to the product that still reads it.
--
--    `practice_governorate` asks where the doctor PRACTISES (not the mortgage `governorate`,
--    which asks where the property is) and is read by the clinic-owner half twice over: it
--    picks the income column and it keys the cap row. The in-practice half reads it not at all.
--
--    Re-filed rather than unfiled: `surrogateProductKey` is provenance with no foreign key and
--    gates nothing, so naming a row the seed has yet to create is safe, and it puts an
--    already-seeded database in the state a fresh one is seeded into — `blueprint-plan.ts`
--    stamps a fact its own product created and does not share, which after the split is this
--    one exactly. It must happen BEFORE step 5, or the fact is deleted along with whatever it
--    is filed under.
--
--    A NULL is claimed as well as the merged key. On the database this was written against the
--    stamp was already NULL, and leaving it there would mean a migrated database and a freshly
--    seeded one disagree about who owns the row — which is the divergence that makes the next
--    change unpredictable. Nothing depends on the value today: no admin door deletes a
--    `surrogate_product`, and step 5 below is the only thing that ever has.
UPDATE "platform_enumeration"
SET "surrogateProductKey" = 'doctors_clinic_owner', "updatedAt" = now()
WHERE "type" = 'surrogate_fact'
  AND "key" = 'practice_governorate'
  AND ("surrogateProductKey" = 'years_in_practice_bands' OR "surrogateProductKey" IS NULL);

-- 2. The ownership fact is deleted, with its ask row.
--
--    Nothing reads it once the merged product goes: its only readers were that product's two
--    conditions, which live in the row deleted at step 5. REFUSED rather than force-deleted if
--    a bank programme names it — that would be a rule an operator wrote, and which programme
--    should read what is not a decision SQL can make.
--
--    The `surrogate_product_ask` row goes by `ON DELETE CASCADE` on `factId`. The QUESTION is
--    left alone: `application_answer.questionId` is `RESTRICT`, so a question a real customer
--    has answered cannot be deleted, and an archived questionnaire snapshot still carries it.
--    `prisma:seed` deactivates it by omission.
DO $$
DECLARE
  read_by_programs int;
  asks_removed int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "platform_enumeration"
    WHERE "type" = 'surrogate_fact' AND "key" = 'owns_practice'
  ) THEN
    RETURN;
  END IF;

  SELECT count(*) INTO read_by_programs
  FROM "bank_program"
  WHERE "incomeAssumption"::text LIKE '%owns_practice%';

  IF read_by_programs > 0 THEN
    RAISE EXCEPTION
      'doctors split: % bank program(s) still read the fact owns_practice — repoint them before deploying',
      read_by_programs;
  END IF;

  SELECT count(*) INTO asks_removed
  FROM "surrogate_product_ask" a
  JOIN "platform_enumeration" f ON f."id" = a."factId"
  WHERE f."type" = 'surrogate_fact' AND f."key" = 'owns_practice';

  DELETE FROM "platform_enumeration"
  WHERE "type" = 'surrogate_fact' AND "key" = 'owns_practice';

  RAISE NOTICE 'doctors split: retired the fact owns_practice and % ask row(s)', asks_removed;
END $$;

-- 3. The existing catalog name becomes the in-practice one.
--
--    The KEY is reused rather than retired: it is immutable, `ABK-PER-DOCTORS_PRACTICE` already
--    files under it, and a fresh key would strand that programme for the whole deploy window.
--    Its stored meaning does narrow — an application recorded against `doctors_in_practice`
--    before today meant "either doctor programme" and now reads as "in practice" — which no
--    figure depends on (issued offers are frozen) but which is worth knowing when reading an
--    old application's stated narrowing.
--
--    The label is guarded on the two spellings this repo has ever written, unlike the product
--    label below: a `program_name` IS renameable through `enumeration-edit.drawer.ts` and
--    reaches CUSTOMERS (`program_name` is on `CUSTOMER_READABLE_ENUMERATION_TYPES`), so a name
--    somebody has already worded themselves must not be overwritten by a deploy.
--
--    The LINK is set unconditionally: it is not operator-editable prose, it is which product
--    this name quotes from, and it must not be left pointing at a row step 5 deletes.
UPDATE "platform_enumeration"
SET "labelEn" = 'Doctors — In Practice', "labelAr" = 'الأطباء — الممارسة', "updatedAt" = now()
WHERE "type" = 'program_name'
  AND "key" = 'doctors_in_practice'
  AND "labelEn" IN ('Doctors', 'Doctors in Practice', 'Doctors (In Practice)');

UPDATE "platform_enumeration"
SET "surrogateProductKey" = 'doctors_in_practice', "updatedAt" = now()
WHERE "type" = 'program_name'
  AND "key" = 'doctors_in_practice'
  AND "surrogateProductKey" = 'years_in_practice_bands';

-- 4. The clinic-owner programme moves onto its own name.
--
--    By explicit programCode. `seed:sheet-figures` re-asserts this, and creates the name row;
--    doing it here as well is what keeps the programme from resolving through the in-practice
--    product in the window between the two — see THE DEPLOY WINDOW above.
UPDATE "bank_program"
SET "programNameKey" = 'doctors_clinic_owner',
    -- Bumped so a browser holding the pre-deploy row cannot save over this on optimistic
    -- lock. `seed:sheet-figures` reads the version fresh, so it is unaffected.
    "version" = "version" + 1,
    "updatedAt" = now()
WHERE "programCode" = 'ABK-PER-DOCTORS_CLINIC'
  AND "programNameKey" = 'doctors_in_practice';

-- 5. The merged product row is retired.
--
--    REFUSED rather than force-deleted if anything still points at it after steps 1 to 3:
--    repointing a live link is a decision about which product a bank sells. `surrogate_product_ask`
--    rows are not part of the guard — they cascade, so they cannot be left as ghosts (A26).
DO $$
DECLARE
  product_id text;
  linked_enums int;
  linked_types int;
  asks_removed int;
BEGIN
  SELECT "id" INTO product_id FROM "platform_enumeration"
  WHERE "type" = 'surrogate_product' AND "key" = 'years_in_practice_bands';

  IF product_id IS NULL THEN
    RAISE NOTICE 'doctors split: no merged product row — nothing to retire';
    RETURN;
  END IF;

  SELECT count(*) INTO linked_enums
  FROM "platform_enumeration" WHERE "surrogateProductKey" = 'years_in_practice_bands';

  SELECT count(*) INTO linked_types
  FROM "enumeration_type_def" WHERE "surrogateProductKey" = 'years_in_practice_bands';

  IF linked_enums > 0 OR linked_types > 0 THEN
    RAISE EXCEPTION
      'doctors split: % enumeration row(s) and % list(s) still filed under years_in_practice_bands — repoint them before deploying',
      linked_enums, linked_types;
  END IF;

  SELECT count(*) INTO asks_removed
  FROM "surrogate_product_ask" WHERE "productId" = product_id;

  DELETE FROM "platform_enumeration" WHERE "id" = product_id;

  RAISE NOTICE 'doctors split: retired years_in_practice_bands and % ask row(s)', asks_removed;
END $$;

-- 6. The whole end state, asserted rather than assumed. A half-applied split is the one
--    outcome where every step looks plausible on its own: the merged product gone but the name
--    still pointing at it quotes nothing forever, and the name relinked while the product
--    survives leaves a third card on the board.
DO $$
DECLARE
  problem text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM "platform_enumeration"
    WHERE "type" = 'surrogate_product' AND "key" = 'years_in_practice_bands'
  ) THEN
    problem := 'the merged product years_in_practice_bands still exists';
  ELSIF EXISTS (
    SELECT 1 FROM "platform_enumeration" WHERE "surrogateProductKey" = 'years_in_practice_bands'
  ) THEN
    problem := 'a row is still filed under years_in_practice_bands';
  ELSIF EXISTS (
    SELECT 1 FROM "platform_enumeration"
    WHERE "type" = 'surrogate_fact' AND "key" = 'owns_practice'
  ) THEN
    problem := 'the retired fact owns_practice still exists';
  ELSIF EXISTS (
    SELECT 1 FROM "platform_enumeration"
    WHERE "type" = 'program_name' AND "key" = 'doctors_in_practice'
      AND "surrogateProductKey" IS DISTINCT FROM 'doctors_in_practice'
  ) THEN
    problem := 'the catalog name doctors_in_practice does not point at its own product';
  END IF;

  -- No branch for `practice_governorate` itself: the second check above already refuses any
  -- row still filed under the merged key, and a NULL there is a legitimate state (a fact two
  -- products ask belongs to the platform, not to one of them), so demanding a stamp would
  -- abort a healthy deploy.

  IF problem IS NOT NULL THEN
    RAISE EXCEPTION 'doctors split left a half-state: %', problem;
  END IF;
END $$;
