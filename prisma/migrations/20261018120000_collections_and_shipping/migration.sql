-- Collections (the `brands` table) become administrator-managed: they gain a
-- subtitle, an image, an explicit order and timestamps. Every column is
-- nullable or defaulted, so existing rows migrate without any data change.
ALTER TABLE "brands"
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "image" TEXT,
  ADD COLUMN IF NOT EXISTS "position" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Keep the order customers already saw (alphabetical) as the starting order.
UPDATE "brands" b
SET "position" = ranked.rn - 1
FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY name ASC) AS rn FROM "brands") ranked
WHERE b.id = ranked.id AND b."position" = 0;

CREATE INDEX IF NOT EXISTS "brands_active_position_idx" ON "brands"("active", "position");

-- Free shipping now starts at 8,000,000 Toman, the figure the announcement bar
-- advertises. Only the methods the storefront promises it for are touched, and
-- only while they still carry the old default (3,500,000) or no rule at all —
-- a threshold an administrator set by hand is left alone.
UPDATE "shipping_methods"
SET "freeShippingThreshold" = 8000000
WHERE "code" IN ('tipax', 'post')
  AND ("freeShippingThreshold" IS NULL OR "freeShippingThreshold" = 3500000);
