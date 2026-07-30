-- Program-name catalog (Manage values → "Program names") — ADDITIVE ONLY.
--
-- Introduces the `program_name` enumeration type: an operator-curated catalog of
-- named loan programs (Doctor, Military, …) that replaces the free-text
-- "Program name" input on the bank-program form with a dropdown. Each member is
-- scoped to a product category via `parentKey` so the form shows only the names
-- that fit the loan type being created.
--
-- Two parts:
--   1) Seed common Egyptian retail archetypes per category.
--   2) Backfill: promote every DISTINCT existing bank_program name into the
--      catalog (keyed by a slug of the English name, scoped to its category) so
--      the dropdown can render already-saved programs in edit mode.
--
-- Idempotent: ON CONFLICT ("type","key") DO NOTHING. Seed rows are inserted
-- first, so a backfilled name that slugs to a seed key is silently skipped.

-- ===========================================================================
-- 1) Seed archetypes
-- ===========================================================================
INSERT INTO "platform_enumeration" ("id","type","key","labelAr","labelEn","parentKey","active","systemOnly","sortOrder","createdAt","updatedAt")
VALUES
  -- personal
  ('clpepn0100000000000000000000','program_name','doctor','قروض الأطباء','Doctor Loans','personal',true,false,1,now(),now()),
  ('clpepn0200000000000000000000','program_name','armed_forces','العاملون بالقوات المسلحة','Armed Forces Personnel','personal',true,false,2,now(),now()),
  ('clpepn0300000000000000000000','program_name','police','رجال الشرطة','Police Personnel','personal',true,false,3,now(),now()),
  ('clpepn0400000000000000000000','program_name','pensioner','أصحاب المعاشات','Pensioners','personal',true,false,4,now(),now()),
  ('clpepn0500000000000000000000','program_name','youth','قروض الشباب','Youth Loans','personal',true,false,5,now(),now()),
  ('clpepn0600000000000000000000','program_name','bankers','العاملون بالبنوك','Bankers','personal',true,false,6,now(),now()),
  ('clpepn0700000000000000000000','program_name','govt_employee','موظفو الحكومة','Government Employees','personal',true,false,7,now(),now()),
  ('clpepn0800000000000000000000','program_name','private_sector','موظفو القطاع الخاص','Private-Sector Employees','personal',true,false,8,now(),now()),
  ('clpepn0900000000000000000000','program_name','professional','أصحاب المهن الحرة','Professionals','personal',true,false,9,now(),now()),
  -- car
  ('clpepn1000000000000000000000','program_name','new_car','سيارة جديدة','New Car','car',true,false,1,now(),now()),
  ('clpepn1100000000000000000000','program_name','used_car','سيارة مستعملة','Used Car','car',true,false,2,now(),now()),
  -- mortgage
  ('clpepn1200000000000000000000','program_name','home_purchase','شراء وحدة سكنية','Home Purchase','mortgage',true,false,1,now(),now()),
  ('clpepn1300000000000000000000','program_name','home_finishing','تشطيب وحدة سكنية','Home Finishing','mortgage',true,false,2,now(),now()),
  -- business
  ('clpepn1400000000000000000000','program_name','working_capital','رأس مال عامل','Working Capital','business',true,false,1,now(),now()),
  ('clpepn1500000000000000000000','program_name','equipment_finance','تمويل معدات','Equipment Finance','business',true,false,2,now(),now())
ON CONFLICT ("type","key") DO NOTHING;

-- ===========================================================================
-- 2) Backfill from existing bank programs
--    key  = slug of the English name (lowercased, non-alnum -> "_", trimmed)
--    id   = deterministic 27-char id derived from the English name
-- ===========================================================================
INSERT INTO "platform_enumeration" ("id","type","key","labelAr","labelEn","parentKey","active","systemOnly","sortOrder","createdAt","updatedAt")
SELECT
  'pn_' || substr(md5(lower(d."friendlyName")), 1, 24),
  'program_name',
  substr(trim(both '_' from regexp_replace(lower(d."friendlyName"), '[^a-z0-9]+', '_', 'g')), 1, 64),
  COALESCE(NULLIF(d."friendlyNameAr", ''), d."friendlyName"),
  substr(d."friendlyName", 1, 160),
  d."productCategory",
  true,
  false,
  100,
  now(),
  now()
FROM (
  SELECT DISTINCT "friendlyName", "friendlyNameAr", "productCategory"
  FROM "bank_program"
  WHERE "friendlyName" IS NOT NULL AND length(trim("friendlyName")) > 0
) d
WHERE trim(both '_' from regexp_replace(lower(d."friendlyName"), '[^a-z0-9]+', '_', 'g')) <> ''
ON CONFLICT ("type","key") DO NOTHING;
