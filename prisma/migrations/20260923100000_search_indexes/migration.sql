-- Persian catalogue search.
--
-- pg_trgm is not available on this shared PostgreSQL server.
-- The storefront search can still work without trigram indexes; those indexes
-- are performance optimizations only. Keep the remaining standard indexes.

-- Facet counts join variants -> sizes/colours for the active catalogue only.
CREATE INDEX IF NOT EXISTS product_variants_size_stock_idx
  ON product_variants ("sizeId", "stock");

CREATE INDEX IF NOT EXISTS product_variants_color_idx
  ON product_variants ("colorId");

-- The admin orders table sorts by date within a status filter.
CREATE INDEX IF NOT EXISTS orders_status_created_idx
  ON orders ("status", "createdAt" DESC);

-- Order lookup by tracking code, for the customer tracking page.
CREATE INDEX IF NOT EXISTS orders_tracking_code_idx
  ON orders ("trackingCode")
  WHERE "trackingCode" IS NOT NULL;
