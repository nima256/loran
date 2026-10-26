import "server-only";
import { prisma } from "../lib/prisma";
import { conflict, notFound } from "../lib/errors";

/**
 * Safe, recoverable deletion from operational order lists.
 * Never touches inventory, sold counters, payment references or redemption
 * history. Paid transactions remain in accounting/reporting until handled via
 * a separate explicit accounting adjustment.
 */
export async function hideAdminOrder(orderId: string, confirmNumber: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, deletedAt: null },
      select: {
        id: true, number: true, status: true, paymentStatus: true,
        paymentAuthority: true, customerId: true,
      },
    });
    if (!order) throw notFound("این سفارش یافت نشد یا قبلاً حذف شده است.");
    if (order.number !== confirmNumber) {
      throw conflict("کد سفارشی که وارد کردید با سفارش انتخاب‌شده مطابقت ندارد.");
    }
    // An in-progress checkout could still be paid at the gateway: never hide it.
    if (order.paymentAuthority && order.paymentStatus === "pending") {
      throw conflict("پرداخت این سفارش هنوز در جریان است؛ ابتدا نتیجه پرداخت را مشخص کنید.");
    }
    const changed = await tx.order.updateMany({
      where: {
        id: order.id,
        deletedAt: null,
        paymentStatus: order.paymentStatus,
        paymentAuthority: order.paymentAuthority,
        status: order.status,
      },
      data: { deletedAt: new Date() },
    });
    if (changed.count !== 1) throw conflict("سفارش قبلاً حذف شده یا تغییر کرده است.");
    return order;
  });
}
