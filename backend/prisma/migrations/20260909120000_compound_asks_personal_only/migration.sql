-- Two questions stop being asked of people they were never about.
--
-- (1) THE EIGHT COMPOUND QUESTIONS. All eight are assigned to personal, car and mortgage,
--     while all four bank programmes on `compound_owner_4` are personal — so a car or
--     mortgage applicant could never be quoted from any of those answers, and one of the
--     eight (`what_percentage_of_the_unit_do_you_own`) is REQUIRED of them. Narrowed to
--     personal, and gated on the new `owns_compound_unit`, which is what makes the required
--     one honest: `isRequired` is enforced only for a question the shared visibility rule
--     shows, so it now binds every compound owner and nobody else.
--
-- (2) THE CLUB BRANCH QUESTION. Ungated, it asked every personal and auto applicant which
--     branch their club membership is at, including everyone who has none.
--
-- WHY A MIGRATION AND NOT A SEED. `blueprint-plan.ts` creates a question or reuses it; for a
-- question that already exists it only ever REACTIVATES it (`:350-361`) and never rewrites
-- `categories` or `enabledWhen`. So `seed:blueprints` — and `blueprint:retemplate` too —
-- would report success and change nothing. The blueprint declarations move in the same
-- commit, so a database built from nothing mints them right; this is for the ones that exist.
--
-- ORDERING, AND IT FAILS OPEN. This runs BEFORE the seed that creates `owns_compound_unit`,
-- so for that window every gate written here is DANGLING — and a dangling gate never hides
-- its target (`question-visibility.ts:47`, mirrored on mobile). The eight stay visible
-- exactly as they are today until the question exists and the questionnaire is republished.
-- The opposite order would hide eight questions behind an answer nobody could give.

DO $$
DECLARE
  compound_codes text[] := ARRAY[
    'which_compound_is_your_unit_in',
    'what_kind_of_unit_do_you_own',
    'how_much_have_you_paid_for_the_unit_so_far',
    'how_much_was_the_down_payment_on_the_unit',
    'what_is_the_contract_price_of_the_unit',
    'how_many_months_ago_did_you_sign_the_contract',
    'what_percentage_of_the_unit_do_you_own',
    'do_you_own_more_than_one_unit'
  ];
  found int;
  still_wide int;
  ungated int;
BEGIN
  -- A fresh database has none of these yet: they are minted by `seed:blueprints`, which
  -- reads the declarations this commit also changes. Nothing to do, and nothing wrong.
  SELECT count(*) INTO found FROM question WHERE code = ANY (compound_codes);
  IF found = 0 THEN
    RAISE NOTICE 'compound questions not present — fresh database, blueprint will mint them gated';
  ELSE
    -- Only `car` and `mortgage` go. `personal` is deleted by nobody: the product is sold
    -- there, and a question assigned to nothing is asked by nobody (A33).
    DELETE FROM question_loan_category qlc
    USING question q
    WHERE q.id = qlc."questionId"
      AND q.code = ANY (compound_codes)
      AND qlc.category IN ('car', 'mortgage');

    UPDATE question
    SET "enabledWhen" = jsonb_build_object(
          'questionCode', 'owns_compound_unit',
          'operator', 'equals',
          'optionCode', 'yes'
        ),
        "updatedAt" = now()
    WHERE code = ANY (compound_codes)
      -- Never overwrite a gate somebody else authored. All eight are ungated today; if one
      -- is not, that is a decision this migration has no business reversing.
      AND "enabledWhen" IS NULL;
  END IF;

  -- The club branch question, same treatment and the same fail-open window.
  UPDATE question
  SET "enabledWhen" = jsonb_build_object(
        'questionCode', 'club_membership',
        'operator', 'equals',
        'optionCode', 'yes'
      ),
      "updatedAt" = now()
  WHERE code = 'which_club_branch_is_your_membership_at'
    AND "enabledWhen" IS NULL;

  -- Assert the end state rather than assuming it.
  SELECT count(*) INTO still_wide
  FROM question q
  JOIN question_loan_category qlc ON qlc."questionId" = q.id
  WHERE q.code = ANY (compound_codes) AND qlc.category IN ('car', 'mortgage');
  IF still_wide > 0 THEN
    RAISE EXCEPTION 'compound questions still assigned to car/mortgage: % row(s)', still_wide;
  END IF;

  SELECT count(*) INTO ungated
  FROM question
  WHERE code = ANY (compound_codes) AND "enabledWhen" IS NULL;
  IF found > 0 AND ungated > 0 THEN
    RAISE EXCEPTION '% compound question(s) left with no gate', ungated;
  END IF;
END $$;
