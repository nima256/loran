-- Track actual inventory movements independently of customer-facing statuses.
-- The previous implementation only restored stock on cancelled/returned
-- when the immediate previous state was in the fulfilment flow.
ALTER TABLE "orders" ADD COLUMN "stockCommitted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "order_status_events" ADD COLUMN "isUndo" BOOLEAN NOT NULL DEFAULT false;

WITH history AS (
  SELECT "orderId", status,
    LAG(status) OVER (PARTITION BY "orderId" ORDER BY "createdAt", id) AS previous
  FROM "order_status_events"
), stock_restored AS (
  SELECT DISTINCT "orderId" FROM history
  WHERE status IN ('cancelled', 'returned')
    AND previous IN ('preparing', 'packaged', 'shipped', 'delivered')
)
UPDATE "orders" o SET "stockCommitted" =
  (o.source = 'manual' OR o."finalizedAt" IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM stock_restored r WHERE r."orderId" = o.id);
