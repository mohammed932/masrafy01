-- A KIND of list becomes a row: `platform_enumeration.type` gets a registry of its own.
--
-- WHY A MIGRATION AND NOT A SEED. Every statement this table replaces is a hardcoded
-- constant the server reads on the request path — `PARENT_TYPE_BY_TYPE` decides whether a
-- write is refused, `DELETABLE_TYPES` decides whether a delete is possible. The code that
-- reads them starts consulting this table in the same change, so a database where the rows
-- are missing does not degrade, it refuses: every type would resolve to "no parent axis,
-- not deletable, unnamed". `migrate deploy` runs on every container start; a seed does not.
--
-- WHY THE 14 ARE `systemOnly`. Each is named by string somewhere the registry cannot see —
-- `countReferences`'s switch, `CUSTOMER_READABLE_ENUMERATION_TYPES`, the categorised /
-- question-bound / unscoped axes, `documents.service.ts`'s `required_document`. Renaming or
-- deleting one would strand every `platform_enumeration` row carrying the string AND leave a
-- code path asking for a key nothing answers to. Relabelling is safe and stays allowed.
--
-- DAY-ONE BEHAVIOUR IS IDENTICAL BY CONSTRUCTION. `parentTypeKey` reproduces the single
-- entry of `PARENT_TYPE_BY_TYPE`; `deletable` reproduces `DELETABLE_TYPES` exactly (the same
-- 7 of 14); `onValuesRail` reproduces `LOOKUP_TYPES` exactly (the same 5). The labels,
-- descriptions and examples are lifted verbatim from the three admin maps they replace, so
-- no string on any screen changes.

CREATE TABLE "enumeration_type_def" (
  "id"            VARCHAR(30)  NOT NULL,
  "key"           VARCHAR(48)  NOT NULL,
  "labelAr"       VARCHAR(160) NOT NULL,
  "labelEn"       VARCHAR(160) NOT NULL,
  "descriptionAr" VARCHAR(400),
  "descriptionEn" VARCHAR(400),
  "icon"          VARCHAR(48),
  "exampleAr"     VARCHAR(160),
  "exampleEn"     VARCHAR(160),
  "parentTypeKey" VARCHAR(48),
  "deletable"     BOOLEAN      NOT NULL DEFAULT false,
  "onValuesRail"  BOOLEAN      NOT NULL DEFAULT true,
  "systemOnly"    BOOLEAN      NOT NULL DEFAULT false,
  "active"        BOOLEAN      NOT NULL DEFAULT true,
  "sortOrder"     INTEGER      NOT NULL DEFAULT 0,
  "createdAt"     TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ(6) NOT NULL,
  "createdBy"     VARCHAR(30),
  "updatedBy"     VARCHAR(30),

  CONSTRAINT "enumeration_type_def_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "enumeration_type_def_key_key" ON "enumeration_type_def" ("key");
CREATE INDEX "idx_enumeration_type_def_active_sort" ON "enumeration_type_def" ("active", "sortOrder");
CREATE INDEX "idx_enumeration_type_def_parent" ON "enumeration_type_def" ("parentTypeKey");

-- The 14 builtins. `id` is derived from the key rather than random so this statement reads
-- the same every time it is inspected; 4 + 24 = 28 chars, inside VARCHAR(30).
INSERT INTO "enumeration_type_def"
  ("id", "key", "labelAr", "labelEn", "descriptionAr", "descriptionEn", "icon",
   "exampleAr", "exampleEn", "parentTypeKey", "deletable", "onValuesRail", "systemOnly",
   "active", "sortOrder", "createdAt", "updatedAt")
VALUES
  -- The five the Manage-values rail shows today, in its order.
  ('etd_' || substr(md5('transfer_type'), 1, 24), 'transfer_type',
   'أنواع تحويل الراتب', 'Salary transfer types',
   'كيف يصل دخل المتقدم إلى الحساب البنكي.',
   'How the applicant''s income reaches the bank account.', 'swap',
   'مثال: تحويل الراتب على البنك', 'e.g. Salary transferred to the bank',
   NULL, true, true, true, true, 10, NOW(), NOW()),

  ('etd_' || substr(md5('employment_type'), 1, 24), 'employment_type',
   'أنواع التوظيف', 'Employment types',
   'الفئات الرئيسية للتوظيف المعروضة في تطبيق العميل.',
   'Top-level employment buckets shown on the mobile wizard.', 'solution',
   'مثال: موظف قطاع خاص', 'e.g. Private sector employee',
   NULL, true, true, true, true, 20, NOW(), NOW()),

  ('etd_' || substr(md5('product_category'), 1, 24), 'product_category',
   'فئات المنتجات', 'Product categories',
   'التصنيف الرئيسي للمنتجات في دليل برامج البنوك.',
   'Top-level product taxonomy on the bank-programs catalog.', 'appstore',
   'مثال: قروض شخصية', 'e.g. Personal loans',
   NULL, true, true, true, true, 30, NOW(), NOW()),

  ('etd_' || substr(md5('required_document'), 1, 24), 'required_document',
   'المستندات المطلوبة', 'Required documents',
   'مفاتيح أنواع المستندات التي ترجع إليها برامج البنوك ومسار الرفع.',
   'Document-type keys referenced by bank programs and the upload pipeline.', 'file-text',
   'مثال: كشف حساب بنكي — آخر ٦ شهور', 'e.g. Bank statement — last 6 months',
   NULL, true, true, true, true, 40, NOW(), NOW()),

  ('etd_' || substr(md5('governorate'), 1, 24), 'governorate',
   'المحافظات', 'Governorates',
   'محافظات مصر — منتقي العنوان في التطبيق ومعالج التمويل العقاري.',
   'Egyptian governorates — the address picker in the mobile app and the mortgage wizard.',
   'environment', 'مثال: الجيزة', 'e.g. Giza',
   NULL, true, true, true, true, 50, NOW(), NOW()),

  -- The collateral products' own lists. Off the rail on purpose (v18.4.0): they are the
  -- lists ONE product's calculation reads, and they live on that product's workspace.
  ('etd_' || substr(md5('compound_category'), 1, 24), 'compound_category',
   'فئات الكومباوندات', 'Compound classes',
   'الفئات التي يبني عليها البنك جدول الحد الأقصى للتمويل.',
   'The classes a bank keys its cap table by.', 'gold',
   'مثال: الفئة أ', 'e.g. Class A',
   NULL, false, false, true, true, 60, NOW(), NOW()),

  ('etd_' || substr(md5('compound'), 1, 24), 'compound',
   'الكومباوندات', 'Compounds',
   'الكومباوندات التي يختار منها المتقدم، وكل واحد منها مُدرج تحت فئة.',
   'The compounds an applicant picks from, each filed under a class.', 'home',
   'مثال: ميفيدا', 'e.g. Mivida',
   'compound_category', false, false, true, true, 70, NOW(), NOW()),

  -- Named but never on the rail: read by a frozen income method, or by a screen of its own.
  ('etd_' || substr(md5('military_grade'), 1, 24), 'military_grade',
   'الرتب العسكرية', 'Military grades', NULL, NULL, 'safety',
   NULL, NULL, NULL, false, false, true, true, 80, NOW(), NOW()),

  ('etd_' || substr(md5('professor_rank'), 1, 24), 'professor_rank',
   'الدرجات الأكاديمية', 'Academic ranks', NULL, NULL, 'read',
   NULL, NULL, NULL, false, false, true, true, 90, NOW(), NOW()),

  ('etd_' || substr(md5('property_type'), 1, 24), 'property_type',
   'أنواع العقارات', 'Property types', NULL, NULL, 'build',
   NULL, NULL, NULL, false, false, true, true, 100, NOW(), NOW()),

  ('etd_' || substr(md5('company_type'), 1, 24), 'company_type',
   'أنواع الشركات', 'Company types', NULL, NULL, 'bank',
   NULL, NULL, NULL, false, false, true, true, 110, NOW(), NOW()),

  -- Three with dedicated screens: the catalog, the fact registry, the product library.
  ('etd_' || substr(md5('program_name'), 1, 24), 'program_name',
   'أسماء البرامج', 'Program names',
   'أسماء البرامج التي تبيعها البنوك، ولكل اسم فئات القروض المتاحة له.',
   'The catalog names banks sell, each with the loan types it is offered under.', 'tags',
   'مثال: قرض شخصي بلس', 'e.g. Personal Loan Plus',
   NULL, true, false, true, true, 120, NOW(), NOW()),

  ('etd_' || substr(md5('surrogate_fact'), 1, 24), 'surrogate_fact',
   'معطيات الدخل البديلة', 'Income facts',
   'الرقم أو الإجابة التي يبني عليها البنك حساب الدخل عند عدم وجود مفردات مرتب.',
   'The figure or answer a bank works an income out from when there is no payslip.',
   'function', NULL, NULL,
   NULL, true, false, true, true, 130, NOW(), NOW()),

  ('etd_' || substr(md5('surrogate_product'), 1, 24), 'surrogate_product',
   'منتجات الدخل البديل', 'Surrogate products',
   'طريقة محفوظة لحساب الدخل بدون مفردات مرتب، يرتبط بها اسم البرنامج.',
   'A saved way of working an income out without a payslip, linked to by a program name.',
   'calculator', NULL, NULL,
   NULL, false, false, true, true, 140, NOW(), NOW());

-- Everything else the table actually holds, defined generically rather than by name.
--
-- Six retired kinds predate the 14-value union and still have rows: `salary_category`,
-- `loan_purpose`, `currency`, `performance_tier`, `customer_program_tier`, `city_tier` —
-- seeded by 20260513124003 and deactivated wholesale by 20260616120000. Listing them by
-- hand would be a guess about what every database contains; a DISTINCT over the table is
-- the same answer on all of them, and covers a type a developer created locally too.
--
-- `active = false`: these are not kinds an operator should be offered. That flag governs
-- OFFERING only — `parentTypeOf` and the delete gate read a definition whatever its active
-- state, so an inactive kind's existing values go on behaving exactly as they do today.
--
-- Labels default to the key, which is what `enumerationTypeLabel` already renders for an
-- unnamed type. `systemOnly = false`: no code names these, so they may be relabelled and,
-- once emptied, deleted. `deletable = false`: matching `DELETABLE_TYPES`, which omits them.
INSERT INTO "enumeration_type_def"
  ("id", "key", "labelAr", "labelEn", "parentTypeKey", "deletable", "onValuesRail",
   "systemOnly", "active", "sortOrder", "createdAt", "updatedAt")
SELECT
  'etd_' || substr(md5(e."type"), 1, 24),
  e."type",
  e."type",
  e."type",
  NULL,
  false,
  false,
  false,
  false,
  900,
  NOW(),
  NOW()
FROM (SELECT DISTINCT "type" FROM "platform_enumeration") e
WHERE NOT EXISTS (
  SELECT 1 FROM "enumeration_type_def" d WHERE d."key" = e."type"
);

-- RAISE rather than commit on the two states that would change behaviour silently.
DO $$
DECLARE
  unregistered INT;
  orphan_axis  INT;
BEGIN
  -- 1. A type held by real rows with no definition. From this migration on, such a type
  --    resolves to "no parent axis, not deletable, unnamed" — which for `compound` would
  --    mean an operator could no longer file one under a class. The backfill above makes
  --    this unreachable; it is checked anyway because the backfill is the thing that could
  --    be wrong, and a red deploy is the cheapest place to find that out.
  SELECT COUNT(DISTINCT e."type") INTO unregistered
    FROM "platform_enumeration" e
   WHERE NOT EXISTS (
     SELECT 1 FROM "enumeration_type_def" d WHERE d."key" = e."type"
   );
  IF unregistered > 0 THEN
    RAISE EXCEPTION 'enumeration_type_registry: % enumeration type(s) in platform_enumeration have no definition row', unregistered;
  END IF;

  -- 1b. The one axis that must survive verbatim: `compound` filed under `compound_category`.
  --     If the backfill won the race and defined `compound` with a NULL axis, every compound
  --     would become unfileable and `factParentTable` would quote nothing for all of them.
  IF NOT EXISTS (
    SELECT 1 FROM "enumeration_type_def"
     WHERE "key" = 'compound' AND "parentTypeKey" = 'compound_category'
  ) THEN
    RAISE EXCEPTION 'enumeration_type_registry: the compound -> compound_category parent axis was not preserved';
  END IF;

  -- 2. A parent axis pointing at a kind that does not exist. `resolveParentKey` would then
  --    demand a parent from a list nothing can populate, making every value of that kind
  --    uncreatable.
  SELECT COUNT(*) INTO orphan_axis
    FROM "enumeration_type_def" d
   WHERE d."parentTypeKey" IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM "enumeration_type_def" p WHERE p."key" = d."parentTypeKey"
     );
  IF orphan_axis > 0 THEN
    RAISE EXCEPTION 'enumeration_type_registry: % type definition(s) name a parent kind that does not exist', orphan_axis;
  END IF;
END $$;
