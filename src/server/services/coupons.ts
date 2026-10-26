import "server-only";
import type { Coupon as CouponRow } from "@prisma/client";
import { prisma, type Db } from "../lib/prisma";
import { couponInvalid } from "../lib/errors";
import { applyDiscount } from "./pricing";
import { formatAmount } from "@/lib/format";
import type { Coupon } from "@/types";

/**
 * Coupons.
 *
 * The server is the sole authority on whether a coupon is valid and what it is
 * worth. A discount computed in the browser is never read — `validateCoupon`
 * below is what the cart preview, the checkout and the order creation all call,
 * so the customer can never be shown one number and charged against another.
 */

export function toCoupon(row: CouponRow): Coupon {
  return {
    code: row.code,
    type: row.type,
    value: row.value,
    maxDiscount: row.maxDiscount ?? undefined,
    minSubtotal: row.minSubtotal ?? undefined,
    description: row.description,
    expiresAt: row.expiresAt?.toISOString(),
  };
}

export interface CouponValidation {
  coupon: Coupon;
  couponId: string;
  discount: number;
}

/**
 * Validates a code against the subtotal and, when known, the customer.
 *
 * Throws `coupon_invalid` with a Persian explanation on every rejection path,
 * so the caller never has to decide what to tell the customer.
 */
export async function validateCoupon(
  code: string,
  subtotal: number,
  customerId?: string | null,
  db: Db = prisma
): Promise<CouponValidation> {
  const normalized = code.trim().toUpperCase();
  const row = await db.coupon.findFirst({
    where: { code: { equals: normalized, mode: "insensitive" } },
  });

  if (!row || row.archivedAt) {
    throw couponInvalid("کد تخفیف نامعتبر است. املای آن را بررسی کنید.");
  }
  if (!row.active) {
    throw couponInvalid("این کد تخفیف در حال حاضر فعال نیست.");
  }

  const now = new Date();
  if (row.startsAt && row.startsAt > now) {
    throw couponInvalid("این کد تخفیف هنوز فعال نشده است.");
  }
  if (row.expiresAt && row.expiresAt < now) {
    throw couponInvalid("اعتبار این کد تخفیف به پایان رسیده است.");
  }
  if (row.minSubtotal != null && subtotal < row.minSubtotal) {
    throw couponInvalid(
      `این کد برای سفارش‌های بالای ${formatAmount(row.minSubtotal)} تومان فعال می‌شود.`
    );
  }
  if (row.usageLimit != null && row.usageCount >= row.usageLimit) {
    throw couponInvalid("ظرفیت استفاده از این کد تخفیف تکمیل شده است.");
  }

  // Per-customer limit is counted from actual redemptions, which are only
  // written once a payment is verified — so an abandoned checkout never burns
  // a customer's allowance.
  if (row.perCustomerLimit != null && customerId) {
    const used = await db.couponRedemption.count({
      where: { couponId: row.id, customerId },
    });
    if (used >= row.perCustomerLimit) {
      throw couponInvalid("شما قبلاً از این کد تخفیف استفاده کرده‌اید.");
    }
  }

  const discount = applyDiscount(subtotal, row.type, row.value, row.maxDiscount);
  if (discount <= 0) {
    throw couponInvalid("این کد تخفیف برای سبد فعلی شما مبلغی کم نمی‌کند.");
  }

  return { coupon: toCoupon(row), couponId: row.id, discount };
}

/**
 * Records a redemption and increments the usage counter.
 *
 * Must run inside the order-finalisation transaction. The unique constraint on
 * `orderId` is the idempotency guard: a replayed payment callback attempting a
 * second redemption for the same order violates it and is rejected, so a coupon
 * can never be consumed twice for one order.
 */
export async function redeemCoupon(
  db: Db,
  input: { couponId: string; orderId: string; customerId: string | null; amount: number }
): Promise<void> {
  await db.couponRedemption.create({
    data: {
      couponId: input.couponId,
      orderId: input.orderId,
      customerId: input.customerId,
      amount: input.amount,
    },
  });
  await db.coupon.update({
    where: { id: input.couponId },
    data: { usageCount: { increment: 1 } },
  });
}

/** Coupons safe to advertise publicly — active, in date, with capacity left. */
export async function listPublicCoupons(limit = 3): Promise<Coupon[]> {
  const now = new Date();
  const rows = await prisma.coupon.findMany({
    where: {
      active: true,
      archivedAt: null,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: limit * 3,
  });

  return rows
    .filter((row) => row.usageLimit == null || row.usageCount < row.usageLimit)
    .slice(0, limit)
    .map(toCoupon);
}
