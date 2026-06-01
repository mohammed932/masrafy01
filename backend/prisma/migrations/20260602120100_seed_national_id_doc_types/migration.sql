-- Constitution v4.0.0 / Principle XXXVII — National ID front + back are collected at profile
-- completion as two structured Document rows. Register both as active `required_document`
-- enumeration members so the customer-scoped upload type-check (`assertDocumentTypeActive`)
-- accepts them. Idempotent.
INSERT INTO "platform_enumeration"
  ("id", "type", "key", "labelAr", "labelEn", "active", "systemOnly", "sortOrder", "createdAt", "updatedAt")
VALUES
  ('clpe120docnatidfront0000a000', 'required_document', 'NATIONAL_ID_FRONT', 'بطاقة الرقم القومي - الوجه الأمامي', 'National ID - Front', true, false, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('clpe120docnatidback00000a000', 'required_document', 'NATIONAL_ID_BACK', 'بطاقة الرقم القومي - الوجه الخلفي', 'National ID - Back', true, false, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("type", "key") DO NOTHING;
