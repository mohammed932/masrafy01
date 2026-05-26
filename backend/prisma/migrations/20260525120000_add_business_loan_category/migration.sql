-- Constitution v1.7.0 / Principle II scope-lock widened from 3 to 4
-- retail loan categories. Adds the `business` category (SME / professional-use
-- working-capital lending) alongside the existing personal / car / mortgage
-- members of the loan_purpose and product_category enumeration registries.
--
-- Pure additive change — no destructive operations, no FK touches, no
-- trigger toggling. Idempotent via ON CONFLICT for the rare case where a
-- prior partial seed exists.

INSERT INTO "platform_enumeration" (
  "id", "type", "key", "labelAr", "labelEn",
  "active", "deprecatedAt", "sortOrder", "createdAt", "updatedAt"
) VALUES
  ('clpe040lpurbusiness00a0000', 'loan_purpose',     'business', 'قرض الأعمال', 'Business', true, NULL, 4, now(), now()),
  ('clpe041pcatbusiness00a0000', 'product_category', 'business', 'قرض الأعمال', 'Business', true, NULL, 4, now(), now())
ON CONFLICT ("type", "key") DO NOTHING;

-- Audit trail — record the scope widening for traceability.
INSERT INTO "audit_event" (
  "id", "eventType", "actorId", "targetId", "sourceIp", "correlationId", "payload", "occurredAt"
)
VALUES (
  'cl' || substr(md5(random()::text), 1, 28),
  'PLATFORM_ENUMERATION_CREATED',
  NULL, NULL, NULL,
  gen_random_uuid()::text,
  jsonb_build_object(
    'reason',     'constitution_v1_7_0_scope_widen',
    'addedKeys',  ARRAY['business'],
    'enumTypes',  ARRAY['loan_purpose', 'product_category']
  ),
  now()
);
