-- The eleven predefined no-payslip products are renamed after the bank sheets they
-- come from, and the legacy twelfth row is removed.
--
-- WHY. Every product card on `/program-catalog?basis=no_payslip` was named after its
-- MECHANISM — "Income by armed-forces grade", "Cap by the kind of school" — which is
-- correct and anonymous: it describes the arithmetic, not the product a bank sells. The
-- source spec (`docs/surrogate-income-templates-implementation-spec.md`, appendices A–C)
-- names the same eleven things after the sheets they were transcribed from, and that is
-- the vocabulary the operator hears from the bank. The name is the only thing on the
-- board that has to survive that conversation, so the sheet name wins.
--
-- WHY A MIGRATION AND NOT THE SEED. The labels are written by `npm run seed:blueprints`
-- on the run that CREATES a product row and never again — `planSeedAction` answers
-- `skip` for any product that already holds a calculation, which is the promise that an
-- operator's edited figures are never overwritten. So a re-seed cannot relabel, and on
-- every already-seeded database the code and the row would disagree permanently. The
-- blueprint constants in `product-blueprints.ts` move in the same change, so a fresh
-- database is seeded with these names and needs nothing from this file.
--
-- BY EXPLICIT KEY, never by matching the old label: a label is operator-editable, and a
-- row somebody has already renamed by hand must not be renamed again by this file.
-- Keys are untouched — they are what `platform_enumeration.surrogateProductKey`, a bank
-- program's stored link and `surrogate_product_ask` all address.

-- 1. The eleven blueprint-keyed products.
UPDATE "platform_enumeration" SET "labelEn" = 'Egyptian Armed Forces',                "labelAr" = 'القوات المسلحة المصرية',        "updatedAt" = now() WHERE "type" = 'surrogate_product' AND "key" = 'armed_forces_grades';
UPDATE "platform_enumeration" SET "labelEn" = 'University Professors',                "labelAr" = 'أساتذة الجامعات',               "updatedAt" = now() WHERE "type" = 'surrogate_product' AND "key" = 'academic_rank_table';
UPDATE "platform_enumeration" SET "labelEn" = 'Doctors (In Practice)',                "labelAr" = 'الأطباء الممارسون',             "updatedAt" = now() WHERE "type" = 'surrogate_product' AND "key" = 'years_in_practice_bands';
UPDATE "platform_enumeration" SET "labelEn" = 'PL Cross Sell to Credit Card',         "labelAr" = 'التمويل الشخصي مقابل بطاقة ائتمان', "updatedAt" = now() WHERE "type" = 'surrogate_product' AND "key" = 'card_limit_share';
UPDATE "platform_enumeration" SET "labelEn" = 'PL Cross Sell to Auto Loan',           "labelAr" = 'التمويل الشخصي مقابل قرض سيارة',  "updatedAt" = now() WHERE "type" = 'surrogate_product' AND "key" = 'auto_loan_crosssell';
UPDATE "platform_enumeration" SET "labelEn" = 'Liabilities Cross Sell (CDs Holder)',  "labelAr" = 'التمويل مقابل شهادات ادخار مرهونة', "updatedAt" = now() WHERE "type" = 'surrogate_product' AND "key" = 'pledged_collateral_share';
UPDATE "platform_enumeration" SET "labelEn" = 'Compound Owner',                       "labelAr" = 'مالك وحدة في كومباوند',         "updatedAt" = now() WHERE "type" = 'surrogate_product' AND "key" = 'compound_owner';
UPDATE "platform_enumeration" SET "labelEn" = 'Teachers — Predefined Limit',          "labelAr" = 'المعلمون — حد محدد مسبقًا',      "updatedAt" = now() WHERE "type" = 'surrogate_product' AND "key" = 'school_stage_ceiling';
UPDATE "platform_enumeration" SET "labelEn" = 'Teachers — Standard',                  "labelAr" = 'المعلمون — البرنامج القياسي',    "updatedAt" = now() WHERE "type" = 'surrogate_product' AND "key" = 'school_type_cap';
UPDATE "platform_enumeration" SET "labelEn" = 'Club Membership',                      "labelAr" = 'عضوية النادي',                  "updatedAt" = now() WHERE "type" = 'surrogate_product' AND "key" = 'club_branch_cap';
UPDATE "platform_enumeration" SET "labelEn" = 'Salaried — Company Coding',            "labelAr" = 'أصحاب الرواتب — تصنيف جهة العمل', "updatedAt" = now() WHERE "type" = 'surrogate_product' AND "key" = 'company_coding_cap';

-- 2. The legacy twelfth row. `armed_forces_grade` (singular) predates the blueprint
--    library and was left beside its blueprint-keyed twin `armed_forces_grades` when
--    v22.0.0 seeded the eleven, because the seed adopts nothing it did not create. Under
--    one shared name the two are indistinguishable on the board, and the operator has no
--    way to tell which one a bank should be pointed at.
--
--    REFUSED rather than force-deleted if anything still reads it: repointing a live link
--    is a decision about which product a bank sells, and SQL cannot make it. Ask rows are
--    NOT part of the guard — the FK cascades, so they cannot be left as ghosts.
DO $$
DECLARE
  linked_enums int;
  linked_types int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "platform_enumeration"
    WHERE "type" = 'surrogate_product' AND "key" = 'armed_forces_grade'
  ) THEN
    RETURN;
  END IF;

  SELECT count(*) INTO linked_enums
  FROM "platform_enumeration" WHERE "surrogateProductKey" = 'armed_forces_grade';
  SELECT count(*) INTO linked_types
  FROM "enumeration_type_def" WHERE "surrogateProductKey" = 'armed_forces_grade';

  IF linked_enums > 0 OR linked_types > 0 THEN
    RAISE EXCEPTION
      'legacy surrogate_product "armed_forces_grade" is still read by % enumeration row(s) and % list(s) — repoint them at "armed_forces_grades" before this migration can remove it',
      linked_enums, linked_types;
  END IF;

  DELETE FROM "platform_enumeration"
  WHERE "type" = 'surrogate_product' AND "key" = 'armed_forces_grade';
END $$;
