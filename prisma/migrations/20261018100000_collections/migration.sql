-- Independent collection taxonomy; separate from brands, categories and campaigns.
CREATE TABLE IF NOT EXISTS "storefront_collections" (
  "id" TEXT PRIMARY KEY,
  "slug" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "subtitle" TEXT NOT NULL DEFAULT '',
  "image" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "storefront_collections_active_position_idx"
  ON "storefront_collections" ("active", "position");
CREATE TABLE IF NOT EXISTS "storefront_collection_products" (
  "collectionId" TEXT NOT NULL REFERENCES "storefront_collections"("id") ON DELETE CASCADE,
  "productId" TEXT NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  PRIMARY KEY ("collectionId", "productId")
);
CREATE INDEX IF NOT EXISTS "storefront_collection_products_product_idx"
  ON "storefront_collection_products" ("productId");

-- Align configured free-shipping methods with the displayed 8,000,000 Toman limit.
-- Methods with NULL thresholds remain non-participating; shipping costs/methods are untouched.
UPDATE "shipping_methods" SET "freeShippingThreshold" = 8000000
WHERE "freeShippingThreshold" IS NOT NULL;
