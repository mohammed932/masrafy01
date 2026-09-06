-- Freeze the engine's own rank position on the offer.
--
-- WHY A COLUMN. `rankOffers(offers, priority)` sorts by the key the applicant's own
-- `priority` answer names -- lowest instalment, lowest rate, fewest documents -- and every
-- read then threw that away. All of an application's offers are written in ONE transaction,
-- so `createdAt` is identical across them and cannot rank anything, and the fallback
-- `ORDER BY "approvalScore" DESC` re-sorted the list by a number the customer never asked
-- to be sorted by: somebody who chose "lowest monthly payment" was shown the
-- highest-scoring offer first.
--
-- FROZEN, not derived (Principle I / A6). The order is an output of the engine over the
-- profile, the priority and the whole candidate set at match time. Re-deriving it later
-- would re-rank an immutable list from data that has since moved.
--
-- NO DEFAULT, deliberately. A `DEFAULT 0` looks harmless and is the trap: a writer that
-- forgets the column stamps every offer rank 0, the tie falls to an identical `createdAt`,
-- and the order goes non-deterministic silently -- the exact defect this fixes. NOT NULL
-- with no default makes Prisma's generated create input require it, so `tsc` names every
-- writer.
ALTER TABLE "bank_offer" ADD COLUMN "rankIndex" INTEGER;

-- Backfill EXACTLY the order the API used to return, while `approvalScore` still exists.
-- This is why the backfill and the column drop are two migrations in timestamp order and
-- not one: reverse them and every historical application's offer list re-orders.
--
-- `id` is the final tiebreak because BOTH prior keys can tie -- two programs can share a
-- score, and `createdAt` is identical inside the transaction -- so the old ORDER BY was
-- itself non-deterministic in that case and a backfill needs a total order.
--
-- Erased offers are numbered too: readers filter `erasedAt IS NULL`, so gaps are expected.
-- Only the relative order is load-bearing.
UPDATE "bank_offer" AS o
SET "rankIndex" = r.rn - 1
FROM (
  SELECT id,
         row_number() OVER (
           PARTITION BY "applicationId"
           ORDER BY "approvalScore" DESC, "createdAt" ASC, id ASC
         ) AS rn
  FROM "bank_offer"
) AS r
WHERE o.id = r.id;

ALTER TABLE "bank_offer" ALTER COLUMN "rankIndex" SET NOT NULL;

-- The hot ORDER BY (Principle XI). `idx_bank_offer_application` is redundant once this
-- exists -- `applicationId` is this composite's leading column.
CREATE INDEX "idx_bank_offer_application_rank" ON "bank_offer" ("applicationId", "rankIndex");
DROP INDEX "idx_bank_offer_application";

-- Every offer of one application must hold a distinct rank, or the ORDER BY has no total
-- order and the list reshuffles between reads. Checked rather than assumed: the backfill
-- above is the only writer of historical rows.
DO $$
DECLARE bad INTEGER;
BEGIN
  SELECT count(*) INTO bad FROM (
    SELECT "applicationId"
    FROM "bank_offer"
    GROUP BY "applicationId"
    HAVING count(*) <> count(DISTINCT "rankIndex")
  ) t;
  IF bad > 0 THEN
    RAISE EXCEPTION 'rankIndex backfill left % application(s) with duplicate ranks', bad;
  END IF;
END $$;
