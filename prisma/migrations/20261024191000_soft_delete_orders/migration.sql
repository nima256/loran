-- Preserve financial, payment and stock history while allowing administrators
-- to remove an order from operational lists without a destructive DELETE.
ALTER TABLE "orders" ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE INDEX "orders_deletedAt_createdAt_idx" ON "orders"("deletedAt", "createdAt");
