-- Expand the employment_type registry from 2 broad keys (salaried,
-- self_employed) to 4 spec-aligned keys (government_employee,
-- private_employee, business_owner, freelancer). The legacy keys stay
-- active so existing bank programs with `acceptedEmploymentTypes`
-- arrays referring to them keep resolving; bank programs are backfilled
-- to also accept the matching new keys.
--
-- No FK / cascade — additive registry + JSONB array merge.

INSERT INTO "platform_enumeration" (
  "id", "type", "key", "labelAr", "labelEn",
  "active", "deprecatedAt", "sortOrder", "createdAt", "updatedAt"
) VALUES
  ('clpe050emp_government00a0000', 'employment_type', 'government_employee', 'موظف حكومي', 'Government employee', true, NULL, 3, now(), now()),
  ('clpe051emp_private0000a0000',  'employment_type', 'private_employee',    'موظف قطاع خاص', 'Private-sector employee', true, NULL, 4, now(), now()),
  ('clpe052emp_business000a0000',  'employment_type', 'business_owner',      'صاحب عمل',     'Business owner',          true, NULL, 5, now(), now()),
  ('clpe053emp_freelancer0a0000',  'employment_type', 'freelancer',          'مستقل',         'Freelancer',              true, NULL, 6, now(), now())
ON CONFLICT ("type", "key") DO NOTHING;

-- Backfill BankProgram.eligibility.acceptedEmploymentTypes so existing
-- programs keep matching real applicants once mobile starts sending the
-- new keys.
--   - programs accepting 'salaried'      → also accept government_employee + private_employee
--   - programs accepting 'self_employed' → also accept business_owner + freelancer
UPDATE "bank_program"
   SET "eligibility" = jsonb_set(
         "eligibility",
         '{acceptedEmploymentTypes}',
         (
           SELECT to_jsonb(array_agg(DISTINCT v))
             FROM unnest(
               ARRAY(SELECT jsonb_array_elements_text("eligibility"->'acceptedEmploymentTypes'))
               || ARRAY['government_employee', 'private_employee']
             ) AS v
         ),
         false
       ),
       "updatedAt" = now()
 WHERE "eligibility" -> 'acceptedEmploymentTypes' ? 'salaried';

UPDATE "bank_program"
   SET "eligibility" = jsonb_set(
         "eligibility",
         '{acceptedEmploymentTypes}',
         (
           SELECT to_jsonb(array_agg(DISTINCT v))
             FROM unnest(
               ARRAY(SELECT jsonb_array_elements_text("eligibility"->'acceptedEmploymentTypes'))
               || ARRAY['business_owner', 'freelancer']
             ) AS v
         ),
         false
       ),
       "updatedAt" = now()
 WHERE "eligibility" -> 'acceptedEmploymentTypes' ? 'self_employed';

INSERT INTO "audit_event" (
  "id", "eventType", "actorId", "targetId", "sourceIp", "correlationId", "payload", "occurredAt"
)
VALUES (
  'cl' || substr(md5(random()::text), 1, 28),
  'PLATFORM_ENUMERATION_CREATED',
  NULL, NULL, NULL,
  gen_random_uuid()::text,
  jsonb_build_object(
    'reason',    'phase1_spec_alignment_employment_type_expansion',
    'enumType',  'employment_type',
    'addedKeys', ARRAY['government_employee', 'private_employee', 'business_owner', 'freelancer'],
    'backfill',  'bank_program.eligibility.acceptedEmploymentTypes merged in matching subset'
  ),
  now()
);
