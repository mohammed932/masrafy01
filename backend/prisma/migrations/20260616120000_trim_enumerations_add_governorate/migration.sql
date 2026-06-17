-- MVP enumeration registry (Manage values) — ADDITIVE ONLY.
--
-- The "simple rail" the operator sees is achieved in the admin UI (MVP_TYPES
-- filter in lookups.page.ts), NOT by deactivating rows here: seeded bank-program
-- catalogs still reference company_type and product_category keys like `wealth`/
-- `clubs`/`*_cross_sell`, and the registry validator THROWS on deprecated keys at
-- program write — so deactivating those types would break program edits/re-seed.
--
-- This migration only ADDS:
--   1) governorate (27) — the one shared, non-question dropdown the wizard needs.
--   2) employment_type — the keys the questionnaire actually emits (registry had
--      only salaried + self_employed; programs already accept the wider set via
--      seed alignEligibility(), so they must be valid ACTIVE members).
--   3) the `business` category in loan_purpose + product_category (4-category MVP).
-- Idempotent: ON CONFLICT ("type","key") DO NOTHING.

-- ===========================================================================
-- 1) Governorates (property-address dropdown; expanded into the mortgage snapshot)
-- ===========================================================================
INSERT INTO "platform_enumeration" ("id","type","key","labelAr","labelEn","active","systemOnly","sortOrder","createdAt","updatedAt")
VALUES
  ('clpegov0100000000000000000000','governorate','cairo','القاهرة','Cairo',true,false, 1,now(),now()),
  ('clpegov0200000000000000000000','governorate','giza','الجيزة','Giza',true,false, 2,now(),now()),
  ('clpegov0300000000000000000000','governorate','alexandria','الإسكندرية','Alexandria',true,false, 3,now(),now()),
  ('clpegov0400000000000000000000','governorate','qalyubia','القليوبية','Qalyubia',true,false, 4,now(),now()),
  ('clpegov0500000000000000000000','governorate','port_said','بورسعيد','Port Said',true,false, 5,now(),now()),
  ('clpegov0600000000000000000000','governorate','suez','السويس','Suez',true,false, 6,now(),now()),
  ('clpegov0700000000000000000000','governorate','dakahlia','الدقهلية','Dakahlia',true,false, 7,now(),now()),
  ('clpegov0800000000000000000000','governorate','sharqia','الشرقية','Sharqia',true,false, 8,now(),now()),
  ('clpegov0900000000000000000000','governorate','gharbia','الغربية','Gharbia',true,false, 9,now(),now()),
  ('clpegov1000000000000000000000','governorate','menofia','المنوفية','Menofia',true,false,10,now(),now()),
  ('clpegov1100000000000000000000','governorate','beheira','البحيرة','Beheira',true,false,11,now(),now()),
  ('clpegov1200000000000000000000','governorate','kafr_el_sheikh','كفر الشيخ','Kafr El Sheikh',true,false,12,now(),now()),
  ('clpegov1300000000000000000000','governorate','damietta','دمياط','Damietta',true,false,13,now(),now()),
  ('clpegov1400000000000000000000','governorate','ismailia','الإسماعيلية','Ismailia',true,false,14,now(),now()),
  ('clpegov1500000000000000000000','governorate','fayoum','الفيوم','Fayoum',true,false,15,now(),now()),
  ('clpegov1600000000000000000000','governorate','beni_suef','بني سويف','Beni Suef',true,false,16,now(),now()),
  ('clpegov1700000000000000000000','governorate','minya','المنيا','Minya',true,false,17,now(),now()),
  ('clpegov1800000000000000000000','governorate','assiut','أسيوط','Assiut',true,false,18,now(),now()),
  ('clpegov1900000000000000000000','governorate','sohag','سوهاج','Sohag',true,false,19,now(),now()),
  ('clpegov2000000000000000000000','governorate','qena','قنا','Qena',true,false,20,now(),now()),
  ('clpegov2100000000000000000000','governorate','luxor','الأقصر','Luxor',true,false,21,now(),now()),
  ('clpegov2200000000000000000000','governorate','aswan','أسوان','Aswan',true,false,22,now(),now()),
  ('clpegov2300000000000000000000','governorate','red_sea','البحر الأحمر','Red Sea',true,false,23,now(),now()),
  ('clpegov2400000000000000000000','governorate','new_valley','الوادي الجديد','New Valley',true,false,24,now(),now()),
  ('clpegov2500000000000000000000','governorate','matrouh','مطروح','Matrouh',true,false,25,now(),now()),
  ('clpegov2600000000000000000000','governorate','north_sinai','شمال سيناء','North Sinai',true,false,26,now(),now()),
  ('clpegov2700000000000000000000','governorate','south_sinai','جنوب سيناء','South Sinai',true,false,27,now(),now())
ON CONFLICT ("type","key") DO NOTHING;

-- ===========================================================================
-- 2) employment_type — questionnaire-visible keys (one vocabulary: picker + matching)
-- ===========================================================================
INSERT INTO "platform_enumeration" ("id","type","key","labelAr","labelEn","active","systemOnly","sortOrder","createdAt","updatedAt")
VALUES
  ('clpeemp0100000000000000000000','employment_type','government_employee','موظف حكومي','Government employee',true,false, 3,now(),now()),
  ('clpeemp0200000000000000000000','employment_type','private_employee','موظف قطاع خاص','Private sector employee',true,false, 4,now(),now()),
  ('clpeemp0300000000000000000000','employment_type','business_owner','صاحب عمل / شركة','Business owner',true,false, 5,now(),now()),
  ('clpeemp0400000000000000000000','employment_type','freelancer','عمل حر','Freelancer',true,false, 6,now(),now()),
  ('clpeemp0500000000000000000000','employment_type','retired','متقاعد','Retired',true,false, 7,now(),now())
ON CONFLICT ("type","key") DO NOTHING;

-- ===========================================================================
-- 3) business category in loan_purpose + product_category (4-category MVP)
-- ===========================================================================
INSERT INTO "platform_enumeration" ("id","type","key","labelAr","labelEn","active","systemOnly","sortOrder","createdAt","updatedAt")
VALUES
  ('clpelpurbusiness000000a0000x1','loan_purpose','business','قرض أعمال','Business',true,false, 4,now(),now()),
  ('clpeprodbusiness00000a0000x2','product_category','business','قرض أعمال','Business',true,false, 4,now(),now())
ON CONFLICT ("type","key") DO NOTHING;
