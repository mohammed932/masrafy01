-- Feature 009 — eligibility bridge: map answers onto the engine's ApplicantProfile.
ALTER TABLE "question" ADD COLUMN "profileField" VARCHAR(80);
ALTER TABLE "question_option" ADD COLUMN "profileValue" VARCHAR(120);
