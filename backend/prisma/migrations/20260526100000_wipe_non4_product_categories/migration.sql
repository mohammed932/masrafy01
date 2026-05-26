-- Constitution v1.7.0 / Principle II scope-lock + Anti-pattern A26.
-- The set of *retail loan categories* the platform supports is fixed at
-- exactly four: personal, car, mortgage, business. Earlier seeds left four
-- forbidden retail-loan rows in the product_category enumeration (education,
-- pension, secured, buyout). These were never wired to any bank_program or
-- application (verified via SELECT count) — but operators still saw them in
-- the Lookups admin picker, which violates A26 ("ghost rows after removal =
-- review block").
--
-- This migration performs the destructive removal per Principle II ("physical
-- removal is the standard"). Adjacent non-retail-loan product categories
-- (wealth, clubs, credit_card_cross_sell, auto_cross_sell) are preserved —
-- they are NOT retail loans and fall outside the scope-lock.
--
-- Because no bank_program or application referenced these keys, no FK
-- cascade is needed and the activity append-only guard does not need to
-- be disabled.

DELETE FROM "platform_enumeration"
 WHERE "type" = 'product_category'
   AND "key" IN ('education', 'pension', 'secured', 'buyout');

INSERT INTO "audit_event" (
  "id", "eventType", "actorId", "targetId", "sourceIp", "correlationId", "payload", "occurredAt"
)
VALUES (
  'cl' || substr(md5(random()::text), 1, 28),
  'DATA_ERASURE_COMPLETED',
  NULL, NULL, NULL,
  gen_random_uuid()::text,
  jsonb_build_object(
    'reason',     'constitution_v1_7_0_a26_wipe_forbidden_retail_categories',
    'wipedFrom',  'product_category',
    'wipedKeys',  ARRAY['education', 'pension', 'secured', 'buyout'],
    'preservedAdjacent', ARRAY['wealth', 'clubs', 'credit_card_cross_sell', 'auto_cross_sell']
  ),
  now()
);
