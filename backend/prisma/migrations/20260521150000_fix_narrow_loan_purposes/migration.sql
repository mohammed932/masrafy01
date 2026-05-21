-- The previous narrowing migration (20260521120000) used type='loanPurpose'
-- (camelCase) while the platform_enumeration table actually stores 'loan_purpose'
-- (snake_case). The UPDATE matched zero rows and nothing was deactivated.
--
-- Constitution v1.5.0 / Principle II scope-lock / A26: lock the platform to
-- exactly three retail loan categories — personal, car, mortgage. Everything
-- else is soft-deactivated; existing rows are preserved for historical reads.

UPDATE "platform_enumeration"
   SET "active" = ("key" IN ('personal', 'car', 'mortgage')),
       "deprecatedAt" = CASE
           WHEN "key" IN ('personal', 'car', 'mortgage') THEN NULL
           ELSE COALESCE("deprecatedAt", now())
       END,
       "updatedAt" = now()
 WHERE "type" = 'loan_purpose';

-- Deactivate bank programs whose productCategory is outside the locked 3.
-- Rows are preserved so historical applications referencing them keep loading;
-- they just stop appearing in operator pickers + matching-engine candidate set.
UPDATE "bank_program"
   SET "active" = false,
       "updatedAt" = now()
 WHERE "productCategory" NOT IN ('personal', 'car', 'mortgage');
