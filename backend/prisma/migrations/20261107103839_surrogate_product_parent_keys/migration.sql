-- AlterTable
ALTER TABLE "platform_enumeration_loan_category" RENAME CONSTRAINT "pk_platform_enumeration_loan_category" TO "platform_enumeration_loan_category_pkey";

-- AlterTable
ALTER TABLE "surrogate_product_ask" RENAME CONSTRAINT "pk_surrogate_product_ask" TO "surrogate_product_ask_pkey";

-- CreateTable
CREATE TABLE "surrogate_product_parent_key" (
    "productId" VARCHAR(30) NOT NULL,
    "valueId" VARCHAR(30) NOT NULL,
    "parentKey" VARCHAR(64) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" VARCHAR(30),

    CONSTRAINT "surrogate_product_parent_key_pkey" PRIMARY KEY ("productId","valueId")
);

-- CreateIndex
CREATE INDEX "idx_surrogate_product_parent_key_value" ON "surrogate_product_parent_key"("valueId");

-- AddForeignKey
ALTER TABLE "surrogate_product_parent_key" ADD CONSTRAINT "surrogate_product_parent_key_productId_fkey" FOREIGN KEY ("productId") REFERENCES "platform_enumeration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surrogate_product_parent_key" ADD CONSTRAINT "surrogate_product_parent_key_valueId_fkey" FOREIGN KEY ("valueId") REFERENCES "platform_enumeration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
