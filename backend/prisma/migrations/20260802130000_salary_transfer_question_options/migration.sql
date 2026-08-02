-- The salary-transfer question became "How does your salary reach the bank?"
-- with the four real `transfer_type` answers. The seed unions options by code
-- (never deletes, so a re-seed cannot drop an option an application answered),
-- which leaves the old Yes / No pair behind on this question.
--
-- Drop them here: with both old and new options live, the applicant would see a
-- six-option list mixing two vocabularies, and answering "Yes" maps to no
-- transfer type at all.
--
-- Safe for history: `application_answer` stores the option CODE (and a nullable
-- id) with no foreign key to `question_option`, so past answers keep reading
-- "yes"/"no" exactly as submitted.
DELETE FROM "question_option"
 WHERE "code" IN ('yes', 'no')
   AND "questionId" IN (SELECT "id" FROM "question" WHERE "code" = 'salary_transfer');
