-- Surrogate products: a no-payslip product's calculation becomes a row of its own,
-- and the catalog names that sell it point at it.
--
-- WHY A MIGRATION AND NOT A SEED. Both halves of the move live only in Postgres —
-- the archetype row and the pointer on the name are correct only together, and
-- every half-applied state quotes a wrong number rather than failing. `migrate
-- deploy` runs on every container start, long before anyone runs
-- `npm run seed:collateral`; a seed-only move would leave any database that had
-- been seeded once carrying a rule on the name AND a rule on the product, with
-- nothing to say which one the engine read. Same reasoning already written at
-- prisma/seed-collateral-products.ts:126.
--
-- SCOPE IS DELIBERATELY TWO PRODUCTS, BY EXPLICIT KEY. Every `business` catalog
-- pair is no-payslip (`catalogIncomeBasis`, prisma/data/program-catalog-matrix.ts),
-- and nine of the eleven `CATALOG_INCOME_RULE` entries are `{"strategy":"declared"}`.
-- Minting one archetype per no-payslip name would produce nine identical products
-- named after catalog names — a rename wearing an archetype's label, and a list
-- nobody can pick from. The curated library is a seed
-- (`npm run seed:surrogate-products`); THIS migration moves only the two products
-- that already have a live pipeline and live bank programs quoting off it.
--
-- KEY REUSE IS SAFE HERE, unlike 20260823130000_compound_classes_three. There the
-- keys were recycled into a DIFFERENT meaning, so a half-applied state was
-- individually plausible and jointly wrong. Here `(type, key)` is the unique, the
-- two rows coexist, and every half-state is caught by the RAISE block at the end.

-- 1. The pointer. Nullable: a payslip name never has one, and a no-payslip name
--    that predates the archetypes keeps its own rule until someone links it.
ALTER TABLE "platform_enumeration" ADD COLUMN "surrogateProductKey" VARCHAR(64);

CREATE INDEX "idx_platform_enumeration_surrogate_product"
  ON "platform_enumeration" ("surrogateProductKey");

-- 2. The archetypes, copied verbatim from the names that hold them today.
--    `id` is derived from the key rather than random so this statement reads the
--    same every time it is inspected; 3 + 24 = 27 chars, inside VARCHAR(30).
--    `updatedAt` has no default on this table and is NOT NULL — it must be given.
--    `systemOnly` is FALSE on purpose: it would block retiring an archetype
--    outright, including one nothing links to. The precise guard is the typed
--    SURROGATE_PRODUCT_IN_USE refusal in the service, which fires only when a
--    catalog name actually points at the row.
INSERT INTO "platform_enumeration"
  ("id", "type", "key", "labelAr", "labelEn", "active", "systemOnly",
   "sortOrder", "incomeRule", "valueSources", "createdAt", "updatedAt")
SELECT
  'sp_' || substr(md5(n."key"), 1, 24),
  'surrogate_product',
  n."key",
  n."labelAr",
  n."labelEn",
  TRUE,
  FALSE,
  n."sortOrder",
  n."incomeRule",
  n."valueSources",
  NOW(),
  NOW()
FROM "platform_enumeration" n
WHERE n."type" = 'program_name'
  AND n."key" IN ('compound_owner', 'car_owner')
  AND n."incomeRule" IS NOT NULL;

-- 3. The link, BY EXPLICIT KEY — never "whatever name had a rule". Inferring the
--    set is how 20260823130000 would have silently re-tiered a compound an
--    operator had filed by hand.
UPDATE "platform_enumeration"
   SET "surrogateProductKey" = "key",
       "updatedAt"           = NOW()
 WHERE "type" = 'program_name'
   AND "key" IN ('compound_owner', 'car_owner')
   AND EXISTS (
     SELECT 1 FROM "platform_enumeration" p
      WHERE p."type" = 'surrogate_product' AND p."key" = "platform_enumeration"."key"
   );

-- 4. A link that also keeps a copy is not a link, it is a fork with nothing to
--    reveal it. `valueSources` goes too: `setProgramNameIncomeRule`'s
--    carry-forward would otherwise resurrect an orphan marker map addressing a
--    rule this row no longer has.
UPDATE "platform_enumeration"
   SET "incomeRule"   = NULL,
       "valueSources" = '{}'::jsonb,
       "updatedAt"    = NOW()
 WHERE "type" = 'program_name'
   AND "surrogateProductKey" IS NOT NULL;

-- 5. RAISE rather than commit. These are the states that would quote a wrong
--    number silently; a red deploy is the cheapest place to find them.
--
--    NOT CHECKED, deliberately: "every no-payslip name is linked". That would
--    abort deploy on a perfectly healthy database, because the no-payslip set is
--    ~15 names wide and only two of them are archetypes today. Grandfather what
--    exists, enforce on the next write — the posture `assertIncomeProofMatchesName`
--    already takes.
DO $$
DECLARE
  dangling  INT;
  forked    INT;
  ruleless  INT;
  orphaned  INT;
BEGIN
  -- 5a. A pointer that resolves to nothing. Reads as "no rule" at the seam and
  --     quotes `rule_unconfigured` for every program under the name.
  SELECT COUNT(*) INTO dangling
    FROM "platform_enumeration" n
   WHERE n."type" = 'program_name'
     AND n."surrogateProductKey" IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM "platform_enumeration" p
        WHERE p."type" = 'surrogate_product'
          AND p."key"  = n."surrogateProductKey"
     );
  IF dangling > 0 THEN
    RAISE EXCEPTION 'surrogate_product_link: % program_name row(s) point at a product that does not exist', dangling;
  END IF;

  -- 5b. Two sources of truth for one calculation.
  SELECT COUNT(*) INTO forked
    FROM "platform_enumeration"
   WHERE "type" = 'program_name'
     AND "surrogateProductKey" IS NOT NULL
     AND "incomeRule" IS NOT NULL;
  IF forked > 0 THEN
    RAISE EXCEPTION 'surrogate_product_link: % linked program_name row(s) still hold their own incomeRule', forked;
  END IF;

  -- 5c. The check that would actually catch a botched copy: an archetype whose
  --     pipeline did not come across. A product with no steps validates as a
  --     rule and prices nothing.
  SELECT COUNT(*) INTO ruleless
    FROM "platform_enumeration"
   WHERE "type" = 'surrogate_product'
     AND "key" IN ('compound_owner', 'car_owner')
     AND (
       "incomeRule" IS NULL
       OR jsonb_typeof("incomeRule" -> 'steps') <> 'array'
       OR jsonb_array_length("incomeRule" -> 'steps') = 0
     );
  IF ruleless > 0 THEN
    RAISE EXCEPTION 'surrogate_product_link: % surrogate_product row(s) carry no step list', ruleless;
  END IF;

  -- 5d. A live bank program whose name now resolves to nothing. This is the one
  --     a customer would feel.
  SELECT COUNT(*) INTO orphaned
    FROM "bank_program" b
   WHERE b."programNameKey" IN ('compound_owner', 'car_owner')
     AND NOT EXISTS (
       SELECT 1
         FROM "platform_enumeration" n
         JOIN "platform_enumeration" p
           ON p."type" = 'surrogate_product'
          AND p."key"  = n."surrogateProductKey"
        WHERE n."type" = 'program_name'
          AND n."key"  = b."programNameKey"
          AND jsonb_typeof(p."incomeRule" -> 'steps') = 'array'
          AND jsonb_array_length(p."incomeRule" -> 'steps') > 0
     );
  IF orphaned > 0 THEN
    RAISE EXCEPTION 'surrogate_product_link: % bank_program row(s) would quote nothing after the move', orphaned;
  END IF;
END $$;
