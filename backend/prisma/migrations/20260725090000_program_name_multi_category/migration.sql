-- program_name multi-category — ADDITIVE ONLY.
--
-- A predefined program (Doctor, Pharmacy, …) may serve SEVERAL loan categories,
-- not a single one. Adds a `categories` text[] tag list and backfills it from the
-- existing single-category `parentKey`, so the bank-program builder can offer a
-- program name under every category it belongs to. `parentKey` is left in place
-- (generic scoping column) but is no longer read for `program_name`.

-- 1) Add the multi-category column (empty default for all non-scoped types).
ALTER TABLE "platform_enumeration"
  ADD COLUMN "categories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- 2) Backfill existing program_name rows: single parentKey -> one-element list.
UPDATE "platform_enumeration"
SET "categories" = ARRAY["parentKey"]
WHERE "type" = 'program_name'
  AND "parentKey" IS NOT NULL
  AND cardinality("categories") = 0;

-- 3) Broaden a shared archetype across the categories it realistically serves.
UPDATE "platform_enumeration"
SET "categories" = ARRAY['personal', 'car']
WHERE "type" = 'program_name' AND "key" = 'doctor';

-- 4) Seed a cross-category archetype (Pharmacy) spanning personal + car + business.
INSERT INTO "platform_enumeration"
  ("id","type","key","labelAr","labelEn","parentKey","categories","active","systemOnly","sortOrder","createdAt","updatedAt")
VALUES
  ('clpepn1600000000000000000000','program_name','pharmacy','قروض الصيدليات','Pharmacy',NULL,ARRAY['personal','car','business'],true,false,10,now(),now())
ON CONFLICT ("type","key") DO NOTHING;
