-- Feature 011 — income provenance frozen on the offer.
--
-- Two additive nullable columns. NO BACKFILL, deliberately: an offer produced
-- before this feature has no recorded provenance, and `null` must keep meaning
-- exactly that. Defaulting them to `'declared'` would be a lie about history —
-- `quote.ts` step 3 took the declared salary whenever it was > 0, which is not
-- the same claim as "this offer's income came from the declared salary and the
-- combination rule agreed".
--
-- Frozen at creation, never updated: the `approvalUsedDefault` precedent. Editing
-- a program's income table later must not rewrite what an immutable offer meant
-- (Principle I / A6).
--
-- No index: both are always read with the offer row.

-- AlterTable
ALTER TABLE "bank_offer" ADD COLUMN     "incomeOrigin" VARCHAR(32),
ADD COLUMN     "incomeSurrogateStrategy" VARCHAR(32);
