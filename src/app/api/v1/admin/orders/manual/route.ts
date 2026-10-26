import { created } from "@/server/lib/http";
import { adminBody, adminRoute } from "@/server/lib/admin-route";
import { createManualOrder } from "@/server/services/manual-orders";
import { manualOrderSchema } from "@/server/schemas/admin";
import { toPersianDigits } from "@/lib/format";

/**
 * POST /api/v1/admin/orders/manual — records an order taken by hand.
 *
 * Everything authoritative is recomputed server-side: the variants, their
 * prices and the stock check. The response reports the resulting stock so the
 * administrator can see the inventory actually moved.
 */
export const POST = adminRoute(async (request, { audit }) => {
  const input = await adminBody(request, manualOrderSchema);
  const result = await createManualOrder(input);

  await audit({
    action: "order.create_manual",
    entityType: "order",
    entityId: result.id,
    summary: `سفارش دستی ${result.number} برای ${input.customer.firstName} ${input.customer.lastName} ثبت شد`,
    meta: {
      items: input.items.length,
      status: input.status,
      paymentStatus: input.paymentStatus,
      linkedCustomer: Boolean(result.customerId),
    },
  });

  return created({
    order: { id: result.id, number: result.number },
    stockAfter: result.stockAfter,
    message: `سفارش ${result.number} ثبت شد و موجودی انبار به‌روزرسانی شد: ${result.stockAfter
      .map((s) => `${s.name} → ${toPersianDigits(s.stock)}`)
      .join("، ")}`,
  });
});
