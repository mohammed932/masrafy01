-- What a no-payslip product READS becomes a set of its own, instead of a single
-- provenance column being asked to answer a membership question.
--
-- WHY. `platform_enumeration.surrogateProductKey` on a `surrogate_fact` says which
-- product AUTHORED the fact. Its own schema comment calls it "provenance, never a
-- constraint", and the blueprint planner withholds it in two cases deliberately:
-- for a fact several blueprints share (a cascade would kill one product's axis when
-- another product went away) and for every cap-only blueprint, which mints no product
-- row for a fact to be filed under. Both were measured on a real database, and both
-- produced the same visible defect: `club_branch_cap` — a product whose entire content
-- is one ask — rendered "This product asks the applicant nothing yet", and
-- `school_type`, read by three blueprints, appeared on no product's list at all.
--
-- One column cannot hold both relations, so membership gets its own table and the
-- column keeps its meaning untouched. Nothing about the engine changes: what a bank
-- quotes off is still `incomeAssumption`, and what the registry serves is still every
-- active fact with an active bindable question.
--
-- IDs WITH REAL FOREIGN KEYS, unlike `surrogateProductKey`, whose reachable unique is
-- the composite `(type, key)` that a self-FK cannot name without a constant type
-- column. Both ends here address `platform_enumeration.id`, which IS the primary key,
-- so referential integrity is available and taken — an allowed fact delete takes its
-- ask rows with it rather than leaving the ghost rows A26 forbids.
--
-- THE BACKFILL IS ONLY THE HALF SQL CAN SEE. It copies the rows the column does hold.
-- The withheld half (shared facts, and every cap-only product) needs `BLUEPRINTS`,
-- which is TypeScript, so it lands in `npm run seed:blueprints` — which re-asserts its
-- own asks on every run, including for a product it otherwise skips.

-- 1. Who put the ask there. Only an `operator` row may be removed on the product's
--    screen: a `blueprint` row is the library's own statement of what its product
--    reads, and the next seed run would put it back.
CREATE TYPE "SurrogateAskSource" AS ENUM ('blueprint', 'operator');

-- 2. The set itself. `productId` leads so a product's board is a prefix scan; the
--    second index carries "who else reads this fact", which is what the untick
--    refusal and the shared-fact notice on a card both read.
CREATE TABLE "surrogate_product_ask" (
  "productId" VARCHAR(30) NOT NULL,
  "factId"    VARCHAR(30) NOT NULL,
  "source"    "SurrogateAskSource" NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "createdBy" VARCHAR(30),

  CONSTRAINT "pk_surrogate_product_ask" PRIMARY KEY ("productId", "factId")
);

CREATE INDEX "idx_surrogate_product_ask_fact"
  ON "surrogate_product_ask" ("factId");

ALTER TABLE "surrogate_product_ask"
  ADD CONSTRAINT "surrogate_product_ask_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "platform_enumeration" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "surrogate_product_ask"
  ADD CONSTRAINT "surrogate_product_ask_factId_fkey"
  FOREIGN KEY ("factId") REFERENCES "platform_enumeration" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Backfill from the column, joined BY TYPE ON BOTH SIDES. `surrogateProductKey`
--    is also carried by `program_name` rows, where it means something else entirely
--    (which product a catalog name takes its calculation from) — joining on the key
--    alone would file catalog names as facts.
--
--    `source = 'blueprint'` for every row: the column is only ever written by the
--    blueprint path today (the operator door is what this change adds), so claiming
--    an operator made any of these would be false.
INSERT INTO "surrogate_product_ask" ("productId", "factId", "source", "createdBy")
SELECT p."id", f."id", 'blueprint', f."createdBy"
FROM "platform_enumeration" f
JOIN "platform_enumeration" p
  ON p."key" = f."surrogateProductKey"
 AND p."type" = 'surrogate_product'
WHERE f."type" = 'surrogate_fact'
  AND f."surrogateProductKey" IS NOT NULL
ON CONFLICT DO NOTHING;

-- 4. RAISE rather than commit, on the two states that would make the new table lie.
--    Deliberately NOT on "a fact is asked by no product": that is the majority state
--    on every real database today (every shared fact, every cap product's fact, and
--    the four platform builtins), so raising on it would abort a healthy deploy —
--    the mistake 20260825090000_surrogate_product_link's header records avoiding.
--    The seed closes that half.
DO $$
DECLARE
  mistyped INTEGER;
  dangling INTEGER;
BEGIN
  SELECT count(*) INTO mistyped
  FROM "surrogate_product_ask" a
  JOIN "platform_enumeration" p ON p."id" = a."productId"
  JOIN "platform_enumeration" f ON f."id" = a."factId"
  WHERE p."type" <> 'surrogate_product' OR f."type" <> 'surrogate_fact';

  IF mistyped > 0 THEN
    RAISE EXCEPTION 'surrogate_product_ask: % row(s) join the wrong enumeration type', mistyped;
  END IF;

  -- A fact filed under a product key that names no live product row. Pre-existing
  -- data, not caused here: it is exactly why the backfill is a typed join and why
  -- the product screen must read the table rather than the column.
  SELECT count(*) INTO dangling
  FROM "platform_enumeration" f
  WHERE f."type" = 'surrogate_fact'
    AND f."surrogateProductKey" IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM "platform_enumeration" p
      WHERE p."type" = 'surrogate_product' AND p."key" = f."surrogateProductKey"
    );

  IF dangling > 0 THEN
    RAISE EXCEPTION 'surrogate_product_ask: % surrogate_fact row(s) name a surrogate_product that does not exist', dangling;
  END IF;
END $$;
