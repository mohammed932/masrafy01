-- Constitution v1.7.0 / Principle II strict scope-lock — operator decision
-- to mirror the loan-category set into product_category as well, so the
-- Lookups admin picker shows ONLY the four constitution-allowed values:
-- personal, car, mortgage, business.
--
-- Removes adjacent non-loan products (wealth, clubs) and cross-sell SKUs
-- (credit_card_cross_sell, auto_cross_sell). None are referenced by any
-- bank_program (verified) so no FK cascade is required.

DELETE FROM "platform_enumeration"
 WHERE "type" = 'product_category'
   AND "key" IN ('wealth', 'clubs', 'credit_card_cross_sell', 'auto_cross_sell');

INSERT INTO "audit_event" (
  "id", "eventType", "actorId", "targetId", "sourceIp", "correlationId", "payload", "occurredAt"
)
VALUES (
  'cl' || substr(md5(random()::text), 1, 28),
  'DATA_ERASURE_COMPLETED',
  NULL, NULL, NULL,
  gen_random_uuid()::text,
  jsonb_build_object(
    'reason',    'constitution_v1_7_0_strict_alignment',
    'wipedFrom', 'product_category',
    'wipedKeys', ARRAY['wealth', 'clubs', 'credit_card_cross_sell', 'auto_cross_sell']
  ),
  now()
);
