-- Tipax: collect the freight on delivery. Post: prepaid online, 150,000 Toman.
-- This migration updates existing production rows; seed.ts alone doesn't.
INSERT INTO "shipping_methods" (
  "id", "code", "name", "description", "cost", "paidOnDelivery", "estimate",
  "active", "position", "supportsTracking", "freeShippingThreshold", "createdAt", "updatedAt"
) VALUES (
  'clorantipax00000000000001', 'tipax', 'تیپاکس (پس‌کرایه)',
  'کرایه ارسال هنگام تحویل پرداخت می‌شود.', 0, TRUE, '۲ تا ۴ روز کاری',
  TRUE, 1, TRUE, 8000000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
) ON CONFLICT ("code") DO UPDATE SET
  "active"=TRUE, "paidOnDelivery"=TRUE, "cost"=0,
  "freeShippingThreshold"=8000000, "updatedAt"=CURRENT_TIMESTAMP;
INSERT INTO "shipping_methods" (
  "id", "code", "name", "description", "cost", "paidOnDelivery", "estimate",
  "active", "position", "supportsTracking", "freeShippingThreshold", "createdAt", "updatedAt"
) VALUES (
  'cloranpost000000000000001', 'post', 'پست پیشتاز',
  'ارسال با پست پیشتاز؛ کرایه به مبلغ سفارش افزوده و آنلاین پرداخت می‌شود.',
  150000, FALSE, '۲ تا ۴ روز کاری', TRUE, 0, TRUE, 8000000,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
) ON CONFLICT ("code") DO UPDATE SET
  "active"=TRUE, "paidOnDelivery"=FALSE, "cost"=150000,
  "description"='ارسال با پست پیشتاز؛ کرایه به مبلغ سفارش افزوده و آنلاین پرداخت می‌شود.',
  "estimate"='۲ تا ۴ روز کاری', "freeShippingThreshold"=8000000,
  "updatedAt"=CURRENT_TIMESTAMP;
