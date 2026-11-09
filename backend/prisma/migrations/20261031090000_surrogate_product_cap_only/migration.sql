-- =============================================================================
-- v33.1.0 — a no-payslip product can be CAP-ONLY by data, not only by blueprint key.
--
-- A cap-only product works out no income: it asks one answer, and each bank caps its own
-- maximum by it. Until now the only way to be one was to carry a cap blueprint's KEY
-- (`isCapOnlyProductKey`), so an operator could not create one. The column says it for a
-- product the operator creates; the key check stays, so the two seeded rows are recognised
-- either way and a fresh install (migrations before seeds) needs nothing here.
--
-- Additive. The backfill marks the two seeded cap-only rows where they already exist, so the
-- column alone answers truthfully on an upgraded database. No quote moves: nothing in the
-- engine reads this column.
-- =============================================================================

ALTER TABLE "platform_enumeration" ADD COLUMN "capOnly" BOOLEAN NOT NULL DEFAULT false;

UPDATE "platform_enumeration"
   SET "capOnly" = true
 WHERE "type" = 'surrogate_product'
   AND "key" IN ('company_coding_cap', 'school_type_cap');
