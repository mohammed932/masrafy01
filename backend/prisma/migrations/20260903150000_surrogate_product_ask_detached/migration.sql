-- AN OPERATOR MAY UNTICK A BLUEPRINT-OWNED ASK, AND THE UNTICK MUST SURVIVE A DEPLOY.
--
-- `surrogate_product_ask.source = 'blueprint'` used to make the untick a refusal
-- (`PRODUCT_ASK_BLUEPRINT_OWNED`), on the reasoning that `npm run seed:blueprints`
-- re-asserts every blueprint ask, so a removal would come back on the next release with
-- nothing on screen saying why. That reasoning was right about the seed and wrong about
-- the remedy: the seed's insert is idempotent by PRIMARY KEY, so a row that is still
-- present is a row it writes nothing over.
--
-- So the removal keeps the row and marks it. `detachedAt IS NOT NULL` means "this product
-- does not read the fact"; every read of the ask set filters on it, and the seed pass does
-- not, which is exactly what makes the state durable. Re-ticking the card clears it.
--
-- ADDITIVE AND NULLABLE. Every existing row is a live ask, and NULL already says so, so
-- there is nothing to backfill and no state this can get wrong on the way in.
ALTER TABLE "surrogate_product_ask"
  ADD COLUMN "detachedAt" TIMESTAMPTZ(6),
  ADD COLUMN "detachedBy" VARCHAR(30);
