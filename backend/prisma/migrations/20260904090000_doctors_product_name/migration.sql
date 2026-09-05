-- The doctors product is named after the PROFESSION, not after one of the two sheets it serves.
--
-- WHY. `20260903120000_surrogate_product_sheet_names` renamed all eleven products after the
-- bank sheets they were transcribed from, which is the right vocabulary for ten of them and
-- the wrong one for this. `years_in_practice_bands` serves THREE sheets — App. A §7 Doctors
-- (Clinic Owners), App. A §8 Doctors (In Practice) and the unattributed Arabic DOCTOR sheet —
-- so naming it "Doctors (In Practice)" put one sheet's name on a card that also carries the
-- other two. Both ABK programmes are configured and live (`ABK-PER-DOCTORS_CLINIC`,
-- `ABK-PER-DOCTORS_PRACTICE`), and an operator reading the board saw only the second and
-- concluded the clinic-owner product had never been built.
--
-- It is ONE product on purpose. The spec is explicit (§10.7): "ABK's two doctor programs use
-- the same bands with different figures (clinic owners 30K-300K, in-practice 15K-150K) - also
-- correct, they are two programs." Same mechanism, different figures per bank programme, which
-- is exactly what the template layer's per-programme `stepParams` are for. A card per sheet
-- would be the same arithmetic duplicated, and the Arabic sheet would make it three.
--
-- WHY A MIGRATION AND NOT THE SEED. Same reason `20260903120000` states at length: labels are
-- written by `npm run seed:blueprints` only on the run that CREATES a product row, because
-- `planSeedAction` answers `skip` for any product that already holds a calculation. So a
-- re-seed cannot relabel, and code and row would disagree permanently on every already-seeded
-- database. `product-blueprints.ts` and `demo-figures/sheet-figures.ts` move in the same
-- change, so a fresh database is seeded with these names and needs nothing from this file.
--
-- KEYS ARE UNTOUCHED. `years_in_practice_bands` is addressed by
-- `platform_enumeration.surrogateProductKey`, by `surrogate_product_ask.productId` and by the
-- blueprint registry; `doctors_in_practice` is addressed by `bank_program.programNameKey` on
-- both doctor programmes. A key rename would orphan every one of them.

-- 1. The product card. Renamed by key with no label guard, deliberately: there is no admin
--    door that can rename a `surrogate_product` (the type is off the values rail and the
--    product page offers no rename), so the row cannot be holding an operator's own words.
UPDATE "platform_enumeration"
SET "labelEn" = 'Doctors', "labelAr" = 'الأطباء', "updatedAt" = now()
WHERE "type" = 'surrogate_product' AND "key" = 'years_in_practice_bands';

-- 2. The catalog name, which carries the same narrowness and reaches CUSTOMERS —
--    `program_name` is on `CUSTOMER_READABLE_ENUMERATION_TYPES`, so this label is read by the
--    mobile client as well as the board.
--
--    Guarded on the seeded label, unlike (1): a `program_name` IS renameable through
--    `enumeration-edit.drawer.ts`, and a name somebody has already worded themselves must not
--    be overwritten by a deploy. Both spellings the repo has ever written are listed, so the
--    guard holds whether or not `seed:sheet-figures` ran before or after this file.
UPDATE "platform_enumeration"
SET "labelEn" = 'Doctors', "labelAr" = 'الأطباء', "updatedAt" = now()
WHERE "type" = 'program_name'
  AND "key" = 'doctors_in_practice'
  AND "labelEn" IN ('Doctors in Practice', 'Doctors (In Practice)');
