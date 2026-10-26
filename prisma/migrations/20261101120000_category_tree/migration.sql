-- Hierarchical categories. Every existing category keeps parentId = NULL and
-- so stays a top-level category; no product or order data is touched.
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "parentId" TEXT;

CREATE INDEX IF NOT EXISTS "categories_parentId_position_idx" ON "categories"("parentId", "position");

ALTER TABLE "categories"
  ADD CONSTRAINT "categories_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
