-- The `car_loan_installment` fact is named after a question CODE, not after anything a
-- person would call it: the bank-program form renders `obligation_car_loan` in the list of
-- money a bank counts.
--
-- WHY IT HAPPENED, so the fix is not mistaken for cosmetics: `BlueprintService#factLabels`
-- falls back to the question code when a `bindQuestion` ask states no labels, and the state
-- it reads (`questionAssignments()`) carries no question TEXT to fall back to instead. The
-- ask now states both labels, which covers every database seeded from here on.
--
-- IT DOES NOT COVER THIS ONE. `createFact` runs only when the fact is ABSENT, so re-running
-- `seed:blueprints` will not relabel a row it already created; and `surrogate_fact` left the
-- values rail in v16.3.0, so there is no admin door to rename it either. A migration is the
-- only path.
--
-- GUARDED, so an operator's own wording is never overwritten: the update fires only while
-- the row still holds the slug it was born with. On a database where somebody already fixed
-- it by hand, this is a no-op, and so is every re-run.
UPDATE "platform_enumeration"
SET "labelEn" = 'Monthly car loan instalment',
    "labelAr" = 'القسط الشهري لقرض السيارة',
    "updatedAt" = now()
WHERE "type" = 'surrogate_fact'
  AND "key" = 'car_loan_installment'
  AND "labelEn" = 'obligation_car_loan';
