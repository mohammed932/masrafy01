-- Remove enumeration types + keys that no code path can ever match.
--
-- Audit (feature: lookups end-to-end review) traced every `platform_enumeration`
-- type from producer (mobile questionnaire / profile) through matching to bank
-- program config. These rows failed on both ends: nothing produces an applicant
-- value for them, and their consumers were either never written or compared
-- against keys that do not exist.
--
--   salary_category        — the matching adapter fed `company_type` values into
--                            this slot, so a program keyed by cat_a/b/c could
--                            never match. No seeded program used it.
--   loan_purpose           — same 4 keys as `product_category`; its only reader
--                            (`acceptedLoanPurposes`) is bypassed in production,
--                            and the admin form silently reset it to ['personal'].
--   city_tier              — `ctx.cityTier` was never populated by the cascade
--   customer_program_tier    adapter, so these three cascade levels always
--   performance_tier         resolved to "no key matched". `maxByPerformanceTier`
--                            was not even listed in the cascade order.
--   transfer_type/payroll_cat_a|b|c
--                          — bank-internal payroll grades. The app can only
--                            answer payroll / letter / none, and the "employer
--                            whitelist resolves payroll → cat" resolver the admin
--                            UI assumed does not exist anywhere in the codebase.
--
-- DESTRUCTIVE: the rows are deleted, not deactivated. Bank program JSON that
-- still carries the matching tier maps keeps its keys (nothing reads them), and
-- the paired code change drops those fields from the DTOs so they cannot be
-- written again.
DELETE FROM "platform_enumeration"
 WHERE "type" IN (
   'salary_category',
   'loan_purpose',
   'city_tier',
   'customer_program_tier',
   'performance_tier'
 );

DELETE FROM "platform_enumeration"
 WHERE "type" = 'transfer_type'
   AND "key" IN ('payroll_cat_a', 'payroll_cat_b', 'payroll_cat_c');

-- Programs that only accepted the deleted payroll grades would now accept nothing
-- reachable; fold them onto the real payroll key so those programs keep matching.
UPDATE "bank_program"
   SET "eligibility" = jsonb_set(
         "eligibility"::jsonb,
         '{acceptedTransferTypes}',
         to_jsonb(
           ARRAY(
             SELECT DISTINCT CASE WHEN t LIKE 'payroll_cat_%' THEN 'payroll' ELSE t END
               FROM jsonb_array_elements_text("eligibility"::jsonb -> 'acceptedTransferTypes') AS t
           )
         )
       )
 WHERE "eligibility"::jsonb -> 'acceptedTransferTypes' @> '["payroll_cat_a"]'::jsonb
    OR "eligibility"::jsonb -> 'acceptedTransferTypes' @> '["payroll_cat_b"]'::jsonb
    OR "eligibility"::jsonb -> 'acceptedTransferTypes' @> '["payroll_cat_c"]'::jsonb;

-- `acceptedLoanPurposes` is gone from the DTO; strip it from stored config so a
-- later read cannot resurrect a field with no validator behind it.
UPDATE "bank_program"
   SET "eligibility" = ("eligibility"::jsonb - 'acceptedLoanPurposes')
 WHERE "eligibility"::jsonb ? 'acceptedLoanPurposes';
