-- CreateTable
CREATE TABLE "saved_offer" (
    "id" VARCHAR(30) NOT NULL,
    "customerId" VARCHAR(30) NOT NULL,
    "bankOfferId" VARCHAR(30) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_offer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_saved_offer_customer_created" ON "saved_offer"("customerId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "saved_offer_customerId_bankOfferId_key" ON "saved_offer"("customerId", "bankOfferId");

-- AddForeignKey
ALTER TABLE "saved_offer" ADD CONSTRAINT "saved_offer_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_offer" ADD CONSTRAINT "saved_offer_bankOfferId_fkey" FOREIGN KEY ("bankOfferId") REFERENCES "bank_offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
