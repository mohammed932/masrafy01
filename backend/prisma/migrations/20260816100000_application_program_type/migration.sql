-- Feature: income-type step in the mobile selection wizard.
--
-- Records the income basis the applicant said they can prove, which — alongside
-- `category` and `programNameKey` — narrowed the program set this application was
-- matched against. Without it a stored application cannot explain why a program
-- the customer can see in the catalog produced no offer.
--
-- Nullable, and the null is about CLIENT VERSIONS, not about programs: every app
-- build before the income-type step sends none, and a null means "both bases were
-- in scope", never "unknown". (`bank_program.programType` is NOT NULL — every
-- program has always been classified; this is the request side.)
--
-- No backfill: an application submitted before the step existed genuinely was not
-- narrowed by it, so writing either value in would be a claim the row never made.

ALTER TABLE "application" ADD COLUMN "programType" "BankProgramType";
