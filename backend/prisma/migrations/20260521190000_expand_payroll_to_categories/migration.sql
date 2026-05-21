-- Programs previously declared acceptedTransferTypes=['payroll'] (generic).
-- Generic 'payroll' on the operator side was ambiguous: did it mean
-- "any Cat A/B/C" or "uncategorized fallback"? Forcing explicit cats
-- removes the ambiguity. Existing programs migrated as
-- "accept any payroll category" → all three cats listed.
--
-- 'payroll' stays in the platform_enumeration registry because the
-- applicant still picks it on mobile; the backend resolves their employer
-- to Cat A/B/C before matching against the program's accepted list.
-- The admin program-config UI filters 'payroll' out of the multi-select.

UPDATE "bank_program"
   SET "eligibility" = jsonb_set(
         "eligibility",
         '{acceptedTransferTypes}',
         (
           SELECT jsonb_agg(DISTINCT v)
             FROM (
               -- Existing entries except 'payroll'.
               SELECT x AS v
                 FROM jsonb_array_elements_text(
                        "eligibility" -> 'acceptedTransferTypes'
                      ) AS arr(x)
                WHERE x <> 'payroll'
               UNION
               -- If 'payroll' was present, expand it into the 3 cats.
               SELECT cat
                 FROM unnest(ARRAY['payroll_cat_a','payroll_cat_b','payroll_cat_c']) AS cat
                WHERE "eligibility" -> 'acceptedTransferTypes' ? 'payroll'
             ) AS u
         ),
         false
       ),
       "updatedAt" = now()
 WHERE "eligibility" -> 'acceptedTransferTypes' ? 'payroll';
