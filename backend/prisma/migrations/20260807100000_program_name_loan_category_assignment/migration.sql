-- Feature: per-loan-category assignment on the program-name catalog.
--
-- Re-introduces the name → category binding that
-- `20260802090000_drop_program_name_categories` removed — but as a join table,
-- and with the three properties the dropped `categories[]` array lacked:
--
--   1. BACKFILLED WIDE. Every existing entry is assigned to all four
--      categories, so the bank-program builder offers exactly what it offered
--      before this migration until an operator narrows one. The array shipped
--      with no backfill, so narrowing it silently hid valid picks — the defect
--      that got it dropped.
--   2. AUTHORITATIVE AND ENFORCED. An entry with no rows here is "parked":
--      offerable nowhere, and bank-program create/update/duplicate reject an
--      unassigned (programNameKey, productCategory) pair with
--      PROGRAM_NAME_KEY_NOT_IN_CATEGORY. An array that nothing enforced could
--      drift from what the builder actually accepted.
--   3. INDEXED AND AUDITABLE PER PAIR. One row per (entry, category), so the
--      admin's assignment edits land in the audit log as a real diff.
--
-- `parentKey` stays NULL for `program_name`
-- (`20260807090000_clear_program_name_parent_key`) — that column is the
-- registry's generic single-parent SCOPE and is a different axis from this
-- many-to-many ASSIGNMENT. Both can be true at once.
--
-- The table is generic over enumeration types, but only `program_name` is
-- seeded: every other type stays at zero rows, which reads correctly as "not
-- categorised" because nothing consults them.

CREATE TABLE "platform_enumeration_loan_category" (
    "enumerationId" VARCHAR(30) NOT NULL,
    "category" "LoanCategory" NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_platform_enumeration_loan_category" PRIMARY KEY ("enumerationId","category")
);

CREATE INDEX "idx_platform_enumeration_loan_category_category"
    ON "platform_enumeration_loan_category"("category");

ALTER TABLE "platform_enumeration_loan_category"
    ADD CONSTRAINT "platform_enumeration_loan_category_enumerationId_fkey"
    FOREIGN KEY ("enumerationId") REFERENCES "platform_enumeration"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every EXISTING program_name entry (active, inactive or deprecated)
-- is assigned to all four categories. Deprecated entries are included on
-- purpose — reactivating one must not also silently park it.
INSERT INTO "platform_enumeration_loan_category" ("enumerationId", "category")
SELECT pe."id", c."category"
FROM "platform_enumeration" pe
CROSS JOIN (
    SELECT unnest(ARRAY['personal','car','mortgage','business']::"LoanCategory"[]) AS "category"
) c
WHERE pe."type" = 'program_name'
ON CONFLICT DO NOTHING;
