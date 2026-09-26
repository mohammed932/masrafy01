-- A program NAME may skip a question its loan type asks (operator decision, 2026-09-26).
--
-- One row = "applicants who pick this name, under this loan type, are not asked this question".
-- Subtractive and per (name, category): other names and `question_loan_category` are untouched.
-- Bounded by `question-scope.ts`, which ignores a row whose question the quote needs, so this
-- table can never starve a bank program of an answer it reads.
--
-- Created empty: nothing any applicant is asked changes until an operator unticks a question.
-- Read live with the rest of the program-name axis — no questionnaire publish is needed.

CREATE TABLE "program_name_question_exclusion" (
    "enumerationId" VARCHAR(30) NOT NULL,
    "category" "LoanCategory" NOT NULL,
    "questionId" VARCHAR(30) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(30),

    CONSTRAINT "program_name_question_exclusion_pkey" PRIMARY KEY ("enumerationId","category","questionId")
);

CREATE INDEX "idx_program_name_question_exclusion_question" ON "program_name_question_exclusion"("questionId");

ALTER TABLE "program_name_question_exclusion" ADD CONSTRAINT "program_name_question_exclusion_enumerationId_fkey" FOREIGN KEY ("enumerationId") REFERENCES "platform_enumeration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "program_name_question_exclusion" ADD CONSTRAINT "program_name_question_exclusion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
