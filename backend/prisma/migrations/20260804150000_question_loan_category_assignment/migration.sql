-- Feature: per-loan-category question assignment on the GLOBAL question pool.
--
-- One question may serve several loan categories, so the assignment is a join
-- table rather than a `category` column on `question` (which A33 forbids and
-- which could hold only one value anyway).
--
-- Backfill: every EXISTING question (active or soft-deleted) is assigned to all
-- four categories, so behaviour is byte-identical to the pre-migration global
-- questionnaire until an admin narrows an assignment in the dashboard.

CREATE TABLE "question_loan_category" (
    "questionId" VARCHAR(30) NOT NULL,
    "category" "LoanCategory" NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_question_loan_category" PRIMARY KEY ("questionId","category")
);

CREATE INDEX "idx_question_loan_category_category" ON "question_loan_category"("category");

ALTER TABLE "question_loan_category"
    ADD CONSTRAINT "question_loan_category_questionId_fkey"
    FOREIGN KEY ("questionId") REFERENCES "question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "question_loan_category" ("questionId", "category")
SELECT q."id", c."category"
FROM "question" q
CROSS JOIN (
    SELECT unnest(ARRAY['personal','car','mortgage','business']::"LoanCategory"[]) AS "category"
) c
ON CONFLICT DO NOTHING;
