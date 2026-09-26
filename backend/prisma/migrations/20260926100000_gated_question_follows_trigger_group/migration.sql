-- A question shown by an answer is asked on the SAME step as that answer, never an earlier one.
--
-- THE BUG. The mobile wizard pages by group, one step per group. `owns_compound_unit` is on
-- `commitments` (step 2); the seven questions its "yes" reveals were on `financing_info`
-- (step 1), and one of them — `what_percentage_of_the_unit_do_you_own` — is REQUIRED. A
-- customer who answered "yes" on step 2 was given a required question on a step already
-- behind them: Finish stayed grey with every field on screen filled and nothing to say why.
-- `which_club_branch_is_your_membership_at` (gated on `club_membership`) and
-- `how_much_was_the_car_loan_when_it_started` (gated on `current_loans`) had the same shape.
--
-- WHY THEY WERE THERE. A question created with no group joins the FIRST active group
-- (`QuestionnaireService.resolveDefaultGroupId`), and the blueprint builder names none. The
-- service now places a gated question beside its trigger; this moves the ones that exist.
--
-- THE RULE, BY SHAPE, NOT BY CODE. Every active gated question whose group comes no later
-- than its trigger's group — by group `displayOrder` — moves into the trigger's group. Equal
-- orders count as "no later" because a tie is paged in an order nothing pins, so the only
-- placement that is right in every order is the trigger's own group. A gate whose trigger
-- sits on an EARLIER step is left alone: it reveals ahead of the customer, which is fine.
-- Run to a fixpoint so a chain (a gate on a gated question) lands with its root.
--
-- MOVES NO MONEY. Group decides only the step a question is paged on. `displayOrder` is
-- kept, so the no-forward-reference rule (trigger order < target order) still holds.
--
-- The group is frozen into the published snapshot, so the app sees this only after the next
-- publish: run `npx tsx scripts/publish-questionnaire.ts` after deploy.

DO $$
DECLARE
  moved int;
  total int := 0;
  left_behind int;
BEGIN
  LOOP
    UPDATE question t
    SET "groupId" = s."groupId",
        "updatedAt" = now()
    FROM question s, question_group tg, question_group sg
    WHERE t."isActive"
      AND t."enabledWhen" IS NOT NULL
      AND s.code = t."enabledWhen"->>'questionCode'
      AND tg.id = t."groupId"
      AND sg.id = s."groupId"
      AND t."groupId" <> s."groupId"
      AND tg."displayOrder" <= sg."displayOrder";
    GET DIAGNOSTICS moved = ROW_COUNT;
    EXIT WHEN moved = 0;
    total := total + moved;
  END LOOP;
  RAISE NOTICE 'gated questions moved beside their trigger: %', total;

  -- Assert the end state rather than assuming it.
  SELECT count(*) INTO left_behind
  FROM question t
  JOIN question s ON s.code = t."enabledWhen"->>'questionCode'
  JOIN question_group tg ON tg.id = t."groupId"
  JOIN question_group sg ON sg.id = s."groupId"
  WHERE t."isActive"
    AND t."groupId" <> s."groupId"
    AND tg."displayOrder" <= sg."displayOrder";
  IF left_behind > 0 THEN
    RAISE EXCEPTION '% gated question(s) still on a step before their trigger', left_behind;
  END IF;
END $$;
