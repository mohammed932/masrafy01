-- Product rules (compound / club / collateral products): freeze the borrowing ceiling a
-- rule derived for this applicant onto the immutable offer.
--
-- Additive and nullable. An offer of an income-based program carries NULL, as does every
-- offer written before this column existed — and absent is not zero: a stored 0 would say
-- the collateral supports nothing, which is a different fact from "this program does not
-- read collateral" (Principle I / A6, FR-020).
ALTER TABLE "bank_offer" ADD COLUMN "collateralCeilingEGP" DECIMAL(13,2);
