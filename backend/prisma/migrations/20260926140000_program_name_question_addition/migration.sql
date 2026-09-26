-- A program NAME may ask a question its loan type does not ask of every name (operator
-- decision, 2026-09-26) — the mirror of `program_name_question_exclusion`.
--
-- TWO pieces, because serve and preview read the category's questions from the FROZEN snapshot
-- and apply reads them from this table: a name can only keep a question that is IN its
-- category, so an added question must sit in the category without being asked of other names.
--
--   1. `question_loan_category.optIn` — the row is in the category but asked only of the names
--      that add it (or whose bank programs read it). Frozen at publish as `optInCategories`,
--      disjoint from `categories`. Every existing row is an ordinary assignment: false.
--   2. `program_name_question_addition` — which name added which question, per loan type. Read
--      LIVE with the rest of the program-name axis, never frozen (v29.0.0).
--
-- Created empty: nothing any applicant is asked changes until an operator ticks a question on
-- a program name. No publish is needed for this migration — no row turns opt-in.
--
-- (`prisma migrate diff` also proposes renaming three primary-key constraints. That drift is
-- older than this change and has nothing to do with it; left alone.)

ALTER TABLE "question_loan_category" ADD COLUMN "optIn" BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "question_loan_category" WHERE "optIn") THEN
    RAISE EXCEPTION 'program_name_question_addition: an existing assignment came out opt-in';
  END IF;
END $$;

CREATE TABLE "program_name_question_addition" (
    "enumerationId" VARCHAR(30) NOT NULL,
    "category" "LoanCategory" NOT NULL,
    "questionId" VARCHAR(30) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(30),

    CONSTRAINT "program_name_question_addition_pkey" PRIMARY KEY ("enumerationId","category","questionId")
);

CREATE INDEX "idx_program_name_question_addition_question" ON "program_name_question_addition"("questionId");

ALTER TABLE "program_name_question_addition" ADD CONSTRAINT "program_name_question_addition_enumerationId_fkey" FOREIGN KEY ("enumerationId") REFERENCES "platform_enumeration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "program_name_question_addition" ADD CONSTRAINT "program_name_question_addition_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
