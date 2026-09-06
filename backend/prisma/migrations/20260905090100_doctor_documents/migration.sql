-- The three documents ABK asks a clinic-owning doctor for, as `required_document` registry rows.
--
-- App. A §7 -- Doctors (Clinic Owners) -- demands a syndicate ID (كارنيه النقابة), a medical
-- facility operating licence (رخصة تشغيل منشأة طبية) and a certificate of professional practice
-- (شهادة مزاولة المهنة). The programme has been carrying that as a `notes` line reading "no
-- document key exists for these yet"; these are the keys.
--
-- ── WHY A MIGRATION, AND WHY BEFORE THE SEED ────────────────────────────────
-- `cross-config.validators.ts` feeds a program's `requiredDocuments` through
-- `validateAgainstRegistry`, which throws `UnknownEnumerationKeyException` (422) on an unknown
-- key -- so this is a hard refusal, not a warning, and `npm run seed:sheet-figures` cannot save
-- the doctors programme until these rows exist. `migrate deploy` runs before every seed, which
-- is the only ordering that is reproducible; an operator adding them through `/lookups` would
-- create them on one database.
--
-- `syndicate_card` is the spelling `prisma/seed-surrogate-demo.ts` already uses on an income
-- rule's own document list, where it has never had a registry row behind it. Reusing that
-- spelling makes the dangling reference correct instead of minting a second name for one
-- document.
--
-- `systemOnly` is false: these are operator-editable, like every other `required_document`.
-- `sortOrder` continues the base set (national_id 1 ... property_deed 8) and is not unique --
-- `NATIONAL_ID_FRONT`/`_BACK` already reuse 1 and 2.
INSERT INTO "platform_enumeration"
  ("id","type","key","labelAr","labelEn","active","systemOnly","sortOrder","createdAt","updatedAt")
VALUES
  ('clpe140docsyndcard0000a0000','required_document','syndicate_card','كارنيه النقابة','Syndicate ID card',true,false, 9,now(),now()),
  ('clpe141docmedlic000000a0000','required_document','medical_facility_licence','رخصة تشغيل منشأة طبية','Medical facility operating licence',true,false,10,now(),now()),
  ('clpe142docpraccert0000a0000','required_document','professional_practice_certificate','شهادة مزاولة المهنة','Certificate of professional practice',true,false,11,now(),now())
ON CONFLICT ("type","key") DO NOTHING;
