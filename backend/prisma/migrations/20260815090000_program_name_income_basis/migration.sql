-- Feature: the income BASIS is stored on the catalog name, per loan category.
--
-- Until now "this name is sold without a payslip" was DERIVED: the (name,
-- category) pair had one of the four surrogate facts ticked in
-- `platform_enumeration_question`. That inference had three costs:
--
--   1. A NEW NAME COULD NOT SAY IT. The create dialog collects two labels and a
--      sort order; the basis existed nowhere on it, so every new name was
--      payslip-only until an operator found the fact tick-list on another screen.
--   2. THE PAYSLIP SIDE WAS UNFILTERED. The wizard could narrow its name picker
--      to no-payslip names, but not the other way round — a name that only ever
--      sells without a payslip still appeared under "Reads a payslip".
--   3. IT CONFLATED TWO FACTS. "Is this name sold without a payslip" and "which
--      fact does the bank's table read" are different questions with different
--      fixes; only the second is really about the questionnaire.
--
-- Two booleans, not one enum, because a name legitimately carries BOTH — one bank
-- sells "Doctor Loans" against a payslip while another works the income out from
-- years in practice. That pair being ONE product is exactly why v16.0.0 deleted
-- the `fast` category, so the column may not re-split it.
--
-- Per (name, category), not per name: a name may be sold without a payslip as a
-- personal loan and only against a payslip as a car loan, which is the grain both
-- the catalog detail tabs and the bank-program picker already work at.

ALTER TABLE "platform_enumeration_loan_category"
    ADD COLUMN "payslip" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "noPayslip" BOOLEAN NOT NULL DEFAULT false;

-- Backfill, in two halves that must NOT be collapsed:
--
--   `payslip` stays true on EVERY existing pair — including the ones marked
--   no-payslip below. Today the payslip basis lists every name, so any narrower
--   backfill would make bank programs that save fine right now start failing the
--   new pairing check on their next edit. Operators untick it per name; the
--   migration never guesses.
--
--   `noPayslip` is lifted from what the pair already SAYS: the four surrogate
--   facts (`matching/pipeline/surrogate-fact-bindings.ts`) are the derivation
--   this column replaces, so reading them once here carries the existing
--   configuration forward exactly rather than resetting the catalog.
UPDATE "platform_enumeration_loan_category" lc
SET "noPayslip" = true
WHERE EXISTS (
    SELECT 1
    FROM "platform_enumeration_question" peq
    JOIN "question" q ON q."id" = peq."questionId"
    WHERE peq."enumerationId" = lc."enumerationId"
      AND peq."category" = lc."category"
      AND q."code" IN (
        'military_grade',
        'academic_rank',
        'years_in_practice',
        'credit_card_total_limit'
      )
);
