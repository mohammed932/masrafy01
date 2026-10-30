-- =============================================================================
-- v32.1.0 — a FIXED question can be asked on surrogate (no-payslip) programs only.
--
-- `question.fixedServedOn` said where a fixed question is asked with two words: `every_name`
-- (every program) and `income_proof` (every income-proof program). The admin's "Asked on" now
-- offers the mirror of the second, `income_surrogate` — `bank_program.programType`'s own word.
--
-- Additive only: no row is re-marked, so no served questionnaire and no quote moves, and the
-- published snapshot needs no republish. A row is given the new value by the admin, from the
-- question editor, after this has run (Postgres refuses a new enum value inside the
-- transaction that added it, so nothing here writes one).
-- =============================================================================

ALTER TYPE "FixedQuestionServedOn" ADD VALUE IF NOT EXISTS 'income_surrogate';
