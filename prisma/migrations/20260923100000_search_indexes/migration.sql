-- Persian catalogue search.
--
-- `searchText` already holds the normalised haystack (ی/ک folded, ZWNJ
-- stripped) written by the product service. Postgres has no Persian text-search
-- configuration, and stemming Persian with the `simple` dictionary buys
-- nothing, so substring matching over a trigram index is the right tool: it
-- serves the "every word appears somewhere" behaviour the storefront already
-- has, including partial words as the customer types.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS products_search_text_trgm_idx
  ON products USING gin ("searchText" gin_trgm_ops);

-- Supports the name-prefix ordering used by the search suggestions dropdown.
CREATE INDEX IF NOT EXISTS products_name_trgm_idx
  ON products USING gin ("name" gin_trgm_ops);

-- Facet counts join variants → sizes/colours for the active catalogue only.
CREATE INDEX IF NOT EXISTS product_variants_size_stock_idx
  ON product_variants ("sizeId", "stock");
CREATE INDEX IF NOT EXISTS product_variants_color_idx
  ON product_variants ("colorId");

-- The admin orders table sorts by date within a status filter.
CREATE INDEX IF NOT EXISTS orders_status_created_idx
  ON orders ("status", "createdAt" DESC);

-- Order lookup by tracking code, for the customer tracking page.
CREATE INDEX IF NOT EXISTS orders_tracking_code_idx
  ON orders ("trackingCode") WHERE "trackingCode" IS NOT NULL;
