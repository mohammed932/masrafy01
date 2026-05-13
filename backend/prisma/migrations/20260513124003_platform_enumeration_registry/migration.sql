-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEventType" ADD VALUE 'PLATFORM_ENUMERATION_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'PLATFORM_ENUMERATION_UPDATED';
ALTER TYPE "AuditEventType" ADD VALUE 'PLATFORM_ENUMERATION_DEACTIVATED';
ALTER TYPE "AuditEventType" ADD VALUE 'PLATFORM_ENUMERATION_DEPRECATED';

-- CreateTable
CREATE TABLE "platform_enumeration" (
    "id" VARCHAR(30) NOT NULL,
    "type" VARCHAR(48) NOT NULL,
    "key" VARCHAR(64) NOT NULL,
    "labelAr" VARCHAR(160) NOT NULL,
    "labelEn" VARCHAR(160) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deprecatedAt" TIMESTAMPTZ(6),
    "systemOnly" BOOLEAN NOT NULL DEFAULT false,
    "parentKey" VARCHAR(64),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdBy" VARCHAR(30),
    "updatedBy" VARCHAR(30),

    CONSTRAINT "platform_enumeration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_platform_enumeration_type_active_sort" ON "platform_enumeration"("type", "active", "sortOrder");

-- CreateIndex
CREATE INDEX "idx_platform_enumeration_type_parent" ON "platform_enumeration"("type", "parentKey");

-- CreateIndex
CREATE UNIQUE INDEX "platform_enumeration_type_key_key" ON "platform_enumeration"("type", "key");

-- Restore partial index on activity.followUpAt (prisma drift; feature 005 created it WHERE NOT NULL).
DROP INDEX IF EXISTS "idx_activity_followup";
CREATE INDEX "idx_activity_followup" ON "activity"("followUpAt") WHERE "followUpAt" IS NOT NULL;

-- ===========================================================================
-- Backfill seed: every enumeration member previously hardcoded in the
-- in-memory stub. ON CONFLICT DO NOTHING keeps re-running safe.
-- ===========================================================================
INSERT INTO "platform_enumeration" ("id","type","key","labelAr","labelEn","active","systemOnly","sortOrder","createdAt","updatedAt")
VALUES
  -- salary_category
  ('clpe000salcata0000000000a0000','salary_category','cat_a','الفئة أ','Cat-A',true,false, 1,now(),now()),
  ('clpe001salcatb0000000000a0000','salary_category','cat_b','الفئة ب','Cat-B',true,false, 2,now(),now()),
  ('clpe002salcatc0000000000a0000','salary_category','cat_c','الفئة ج','Cat-C',true,false, 3,now(),now()),
  ('clpe003saloutsource0000a0000','salary_category','outsource','متعاقد خارجي','Outsource',true,false, 4,now(),now()),
  -- transfer_type
  ('clpe010trfpayroll000000a0000','transfer_type','payroll','تحويل راتب','Payroll',true,false, 1,now(),now()),
  ('clpe011trfpayrolla0000a0000','transfer_type','payroll_cat_a','تحويل راتب — الفئة أ','Payroll · Cat-A',true,false, 2,now(),now()),
  ('clpe012trfpayrollb0000a0000','transfer_type','payroll_cat_b','تحويل راتب — الفئة ب','Payroll · Cat-B',true,false, 3,now(),now()),
  ('clpe013trfpayrollc0000a0000','transfer_type','payroll_cat_c','تحويل راتب — الفئة ج','Payroll · Cat-C',true,false, 4,now(),now()),
  ('clpe014trfsaltransl000a0000','transfer_type','salary_transfer_letter','خطاب تحويل راتب','Salary Transfer Letter',true,false, 5,now(),now()),
  ('clpe015trfinctransl000a0000','transfer_type','income_transfer_letter','خطاب تحويل دخل','Income Transfer Letter',true,false, 6,now(),now()),
  ('clpe016trfnone00000000a0000','transfer_type','none','بدون تحويل','None',true,false, 7,now(),now()),
  -- employment_type
  ('clpe020empsalaried0000a0000','employment_type','salaried','موظف','Salaried',true,false, 1,now(),now()),
  ('clpe021empselfempl0000a0000','employment_type','self_employed','صاحب عمل حر','Self-Employed',true,false, 2,now(),now()),
  -- loan_purpose
  ('clpe030lpurpersonal000a0000','loan_purpose','personal','قرض شخصي','Personal',true,false, 1,now(),now()),
  ('clpe031lpurcar000000000a0000','loan_purpose','car','قرض سيارة','Car',true,false, 2,now(),now()),
  ('clpe032lpurmortgage000a0000','loan_purpose','mortgage','قرض عقاري','Mortgage',true,false, 3,now(),now()),
  ('clpe033lpureducation00a0000','loan_purpose','education','تمويل تعليمي','Education',true,false, 4,now(),now()),
  ('clpe034lpurpension0000a0000','loan_purpose','pension','قرض معاش','Pension',true,false, 5,now(),now()),
  ('clpe035lpursecured0000a0000','loan_purpose','secured','قرض بضمانات','Secured',true,false, 6,now(),now()),
  ('clpe036lpurbuyout00000a0000','loan_purpose','buyout','سداد قروض','Buyout',true,false, 7,now(),now()),
  -- property_type
  ('clpe040propapt00000000a0000','property_type','apartment','شقة','Apartment',true,false, 1,now(),now()),
  ('clpe041proptwinh000000a0000','property_type','twin_house','توين هاوس','Twin House',true,false, 2,now(),now()),
  ('clpe042propvilla000000a0000','property_type','villa','فيلا','Villa',true,false, 3,now(),now()),
  -- city_tier
  ('clpe050citymainc000000a0000','city_tier','main_cities','المدن الرئيسية','Main Cities',true,false, 1,now(),now()),
  ('clpe051cityotherc00000a0000','city_tier','other_cities','مدن أخرى','Other Cities',true,false, 2,now(),now()),
  -- professor_rank
  ('clpe060proflecturer000a0000','professor_rank','lecturer','مدرس','Lecturer',true,false, 1,now(),now()),
  ('clpe061profasstprof000a0000','professor_rank','assistant_professor','أستاذ مساعد','Assistant Professor',true,false, 2,now(),now()),
  ('clpe062profprofessor00a0000','professor_rank','professor','أستاذ','Professor',true,false, 3,now(),now()),
  -- military_grade
  ('clpe070milofficer00000a0000','military_grade','officer','ضابط','Officer',true,false, 1,now(),now()),
  ('clpe071milseniorof0000a0000','military_grade','senior_officer','ضابط أقدم','Senior Officer',true,false, 2,now(),now()),
  ('clpe072milgeneral00000a0000','military_grade','general','لواء','General',true,false, 3,now(),now()),
  -- product_category
  ('clpe080prodpersonal000a0000','product_category','personal','قرض شخصي','Personal',true,false, 1,now(),now()),
  ('clpe081prodmortgage000a0000','product_category','mortgage','قرض عقاري','Mortgage',true,false, 2,now(),now()),
  ('clpe082prodcar000000000a0000','product_category','car','قرض سيارة','Car',true,false, 3,now(),now()),
  ('clpe083prodeducation00a0000','product_category','education','تمويل تعليمي','Education',true,false, 4,now(),now()),
  ('clpe084prodpension0000a0000','product_category','pension','قرض معاش','Pension',true,false, 5,now(),now()),
  ('clpe085prodsecured0000a0000','product_category','secured','قرض بضمانات','Secured',true,false, 6,now(),now()),
  ('clpe086prodbuyout00000a0000','product_category','buyout','سداد قروض','Buyout',true,false, 7,now(),now()),
  ('clpe087prodccxsell0000a0000','product_category','credit_card_cross_sell','بطاقة ائتمان — بيع متقاطع','Credit Card Cross-Sell',true,false, 8,now(),now()),
  ('clpe088prodautoxsell00a0000','product_category','auto_cross_sell','سيارة — بيع متقاطع','Auto Cross-Sell',true,false, 9,now(),now()),
  ('clpe089prodwealth00000a0000','product_category','wealth','برنامج الثروات','Wealth',true,false,10,now(),now()),
  ('clpe08aprodclubs000000a0000','product_category','clubs','عضوية النوادي','Clubs',true,false,11,now(),now()),
  -- customer_program_tier
  ('clpe090cptierblue00000a0000','customer_program_tier','blue','بلو','Blue',true,false, 1,now(),now()),
  ('clpe091cptierplus00000a0000','customer_program_tier','plus','بلس','Plus',true,false, 2,now(),now()),
  ('clpe092cptierwealth000a0000','customer_program_tier','wealth','ثروات','Wealth',true,false, 3,now(),now()),
  -- performance_tier
  ('clpe100perfmob6000000a0000','performance_tier','mob_6','6 أشهر تعاملات','6 months on book',true,false, 1,now(),now()),
  ('clpe101perfmob12000000a0000','performance_tier','mob_12','12 شهر تعاملات','12 months on book',true,false, 2,now(),now()),
  ('clpe102perfmob18000000a0000','performance_tier','mob_18','18 شهر تعاملات','18 months on book',true,false, 3,now(),now()),
  ('clpe103perfmob24000000a0000','performance_tier','mob_24','24 شهر تعاملات','24 months on book',true,false, 4,now(),now()),
  -- company_type
  ('clpe110cocommbank00000a0000','company_type','commercial_bank','بنك تجاري','Commercial Bank',true,false, 1,now(),now()),
  ('clpe111copubbank000000a0000','company_type','public_bank','بنك حكومي','Public Bank',true,false, 2,now(),now()),
  -- required_document
  ('clpe120docnatid00000000a0000','required_document','national_id','بطاقة الرقم القومي','National ID',true,false, 1,now(),now()),
  ('clpe121docsalcert00000a0000','required_document','salary_certificate','شهادة راتب','Salary Certificate',true,false, 2,now(),now()),
  ('clpe122dochrletter00000a0000','required_document','hr_letter','خطاب موارد بشرية','HR Letter',true,false, 3,now(),now()),
  ('clpe123docbankstmt00000a0000','required_document','bank_statement','كشف حساب بنكي','Bank Statement',true,false, 4,now(),now()),
  ('clpe124doccommreg00000a0000','required_document','commercial_register','سجل تجاري','Commercial Register',true,false, 5,now(),now()),
  ('clpe125doctaxcard00000a0000','required_document','tax_card','بطاقة ضريبية','Tax Card',true,false, 6,now(),now()),
  ('clpe126docutilbill00000a0000','required_document','utility_bill','إيصال مرافق','Utility Bill',true,false, 7,now(),now()),
  ('clpe127docpropdeed00000a0000','required_document','property_deed','سند ملكية','Property Deed',true,false, 8,now(),now()),
  -- currency
  ('clpe130curegp00000000000a0000','currency','EGP','جنيه مصري','Egyptian Pound',true,false, 1,now(),now()),
  ('clpe131curusd00000000000a0000','currency','USD','دولار أمريكي','US Dollar',true,false, 2,now(),now()),
  ('clpe132cureur00000000000a0000','currency','EUR','يورو','Euro',true,false, 3,now(),now())
ON CONFLICT ("type","key") DO NOTHING;
