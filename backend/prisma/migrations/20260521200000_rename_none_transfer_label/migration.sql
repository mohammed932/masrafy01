-- Bare "None" was confusing in the admin dropdown. Rename for clarity:
-- the underlying key stays 'none' (data contract unchanged), only the
-- human-facing label moves to "No salary transfer".

UPDATE "platform_enumeration"
   SET "labelEn" = 'No salary transfer',
       "labelAr" = 'بدون تحويل راتب',
       "updatedAt" = now()
 WHERE "type" = 'transfer_type'
   AND "key" = 'none';
