-- Ready-made amount methods (v37.0.0). Picked on the product page and copied into the
-- product; nothing here is read by a quote.
CREATE TABLE "method_template" (
    "id" VARCHAR(30) NOT NULL,
    "key" VARCHAR(64) NOT NULL,
    "labelEn" VARCHAR(120) NOT NULL,
    "labelAr" VARCHAR(120) NOT NULL,
    "mechanism" JSONB NOT NULL,
    "figures" JSONB NOT NULL DEFAULT '{}',
    "source" VARCHAR(16) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" VARCHAR(30),

    CONSTRAINT "method_template_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "method_template_key_key" ON "method_template"("key");
CREATE INDEX "idx_method_template_live_order" ON "method_template"("deletedAt", "sortOrder");
