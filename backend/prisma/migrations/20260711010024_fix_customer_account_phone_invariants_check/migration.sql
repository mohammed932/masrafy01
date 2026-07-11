-- =============================================================================
-- Corrective migration — customer_account_phone_invariants_check drift.
-- Constitution Principle XIII / XXXVII.
--
-- Migration 008 (20260526180000) encoded the OLD "fully upfront" PHONE
-- registration model (constitution v1.8.0): CHECK required passwordHash
-- NOT NULL at row-creation time for registrationPath = 'PHONE'.
--
-- Constitution v4.0.0 (2026-06-02, migration 20260602120000) redefined
-- Principle XIII to a LITE-row + mandatory-profile-completion model: PHONE
-- signup creates the row with passwordHash = NULL (collected LATER at
-- profile completion — see CustomerAccountRepository.createPhoneVerifiedLite).
-- That migration added customer_account profile columns but never updated
-- this stale CHECK, so every real phone signup has been failing with
-- Postgres error 23514 since 2026-06-02.
--
-- New invariant: PHONE requires phone + mobileVerifiedAt NOT NULL only.
-- passwordHash for PHONE is intentionally NOT constrained here — it is
-- populated later at profile completion and enforced as a completeness gate
-- in application code (CustomerProfileCompletenessService), not as a
-- row-creation invariant.
--
-- customer_account_social_no_password_check and customer_account_age_range_check
-- (added by the same migration 008) are unrelated and untouched.
-- =============================================================================

ALTER TABLE "customer_account"
  DROP CONSTRAINT IF EXISTS "customer_account_phone_invariants_check";

ALTER TABLE "customer_account"
  ADD CONSTRAINT "customer_account_phone_invariants_check"
  CHECK (
    "registrationPath" = 'SOCIAL'
    OR (
      "registrationPath" = 'PHONE'
      AND "phone" IS NOT NULL
      AND "mobileVerifiedAt" IS NOT NULL
    )
  ) NOT VALID;
