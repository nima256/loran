import "server-only";
import { Prisma, type OrderStatus, type OrderSource } from "@prisma/client";
import { prisma, type Db } from "../lib/prisma";
import { conflict, notFound, outOfStock } from "../lib/errors";
import { logger } from "../lib/logger";
import { generateOrderNumber } from "../lib/crypto";
import { canTransition, previousOrderStatus, stockEffectForStatusChange } from "./order-status";
import { redeemCoupon } from "./coupons";
import { env } from "../lib/env";
import { orderAdminRecipients, sendPatternSmsQuietly } from "./sms";
import type { PricedCartLine } from "./cart";
import type { OrderTotals } from "@/types";

/**
 * Orders.
 *
 * Two rules shape everything in this module:
 *
 *  1. The database is the source of truth. Order numbers, prices and stock
 *     changes all happen here, inside transactions — never in the browser.
 *  2. Finalisation is idempotent. A payment callback can arrive twice (the
 *     customer refreshes, the gateway retries), and the second one must not
 *     decrement stock again, consume the coupon again, write a duplicate
 *     timeline event, or send a second SMS. `finalizedAt` is the guard, set
 *     inside the same transaction as those effects.
 */

/* -------------------------------------------------------------------------- */
/* Order numbers                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Generates an order number, retrying on the (rare) collision.
 *
 * The number is random rather than sequential so it can't be used to infer how
 * many orders the shop takes.
 */
export async function nextOrderNumber(db: Db = prisma): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const number = generateOrderNumber();
    const existing = await db.order.findUnique({ where: { number }, select: { id: true } });
    if (!existing) return number;
  }
  throw conflict("ثبت شماره سفارش ناموفق بود. لطفاً دوباره تلاش کنید.");
}

/* -------------------------------------------------------------------------- */
/* Stock                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Decrements variant stock atomically.
 *
 * The `stock >= quantity` predicate lives in the UPDATE itself, so two
 * concurrent orders for the last pair cannot both succeed: whichever executes
 * second matches no row and is rejected. A read-then-write would have a race
 * between the check and the decrement; this has none.
 *
 * Must be called inside a transaction.
 */
export async function decrementStock(
  db: Db,
  lines: { variantId: string; quantity: number; name: string }[]
): Promise<void> {
  for (const line of lines) {
    const updated = await db.$executeRaw`
      UPDATE product_variants
      SET "stock" = "stock" - ${line.quantity}, "updatedAt" = NOW()
      WHERE "id" = ${line.variantId} AND "stock" >= ${line.quantity}
    `;
    if (updated === 0) {
      // Rolls the whole transaction back — a partially fulfilled order is worse
      // than a rejected one.
      throw outOfStock(`موجودی «${line.name}» کافی نیست. لطفاً سبد خرید را بازبینی کنید.`);
    }
  }
}

/** Returns stock to the shelf, for a cancellation or a completed return. */
export async function restoreStock(
  db: Db,
  lines: { variantId: string | null; quantity: number }[]
): Promise<void> {
  for (const line of lines) {
    if (!line.variantId) continue;
    await db.productVariant.updateMany({
      where: { id: line.variantId },
      data: { stock: { increment: line.quantity } },
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Creation                                                                    */
/* -------------------------------------------------------------------------- */

export interface CreateOrderInput {
  source: OrderSource;
  customerId: string | null;
  customer: { firstName: string; lastName: string; phone: string; email?: string | null };
  address: {
    recipientFirstName: string;
    recipientLastName: string;
    phone: string;
    province: string;
    city: string;
    addressLine: string;
    postalCode: string;
    plaque?: string | null;
    unit?: string | null;
  };
  shipping: {
    id: string | null;
    code: string;
    name: string;
    paidOnDelivery: boolean;
  };
  items: PricedCartLine[];
  totals: OrderTotals;
  coupon: { id: string; code: string; discount: number } | null;
  customerNote?: string | null;
  adminNote?: string | null;
  paymentMethod: string;
  /** Initial status. Online orders start awaiting payment. */
  status: OrderStatus;
  smsNotifications?: boolean;
}

/**
 * Creates an order and its items inside a transaction.
 *
 * Every display field is snapshotted onto the order rows, so the order stays
 * historically correct after the catalogue, the customer's profile or their
 * address book is edited later.
 *
 * Stock is *not* touched here. An online order commits stock only once payment
 * verifies (see `finalizePaidOrder`); a manual order commits it immediately and
 * passes `commitStock: true`.
 */
export async function createOrder(
  input: CreateOrderInput,
  options: { commitStock?: boolean; db?: Db } = {}
): Promise<{ id: string; number: string }> {
  const run = async (tx: Db) => {
    const number = await nextOrderNumber(tx);

    const order = await tx.order.create({
      data: {
        number,
        status: input.status,
        source: input.source,
        customerId: input.customerId,

        customerFirstName: input.customer.firstName,
        customerLastName: input.customer.lastName,
        customerPhone: input.customer.phone,
        customerEmail: input.customer.email ?? null,

        shipRecipientFirstName: input.address.recipientFirstName,
        shipRecipientLastName: input.address.recipientLastName,
        shipPhone: input.address.phone,
        shipProvince: input.address.province,
        shipCity: input.address.city,
        shipAddressLine: input.address.addressLine,
        shipPostalCode: input.address.postalCode,
        shipPlaque: input.address.plaque ?? null,
        shipUnit: input.address.unit ?? null,

        shippingMethodId: input.shipping.id,
        shippingMethodCode: input.shipping.code,
        shippingMethodName: input.shipping.name,
        shippingPaidOnDelivery: input.shipping.paidOnDelivery,

        subtotal: input.totals.subtotal,
        productDiscount: input.totals.productDiscount,
        couponDiscount: input.totals.couponDiscount,
        shippingCost: input.totals.shippingCost,
        payableOnline: input.totals.payableOnline,
        grandTotal: input.totals.grandTotal,

        couponId: input.coupon?.id ?? null,
        couponCode: input.coupon?.code ?? null,

        paymentMethod: input.paymentMethod,
        paymentStatus: "pending",
        stockCommitted: Boolean(options.commitStock),

        customerNote: input.customerNote ?? null,
        adminNote: input.adminNote ?? null,
        smsNotifications: input.smsNotifications ?? true,

        items: {
          create: input.items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            slug: item.slug,
            name: item.name,
            image: item.image,
            colorName: item.colorName,
            colorHex: item.colorHex,
            size: item.size,
            sku: item.sku,
            quantity: item.quantity,
            unitPrice: item.price,
            compareAtPrice: item.compareAtPrice ?? null,
          })),
        },
        events: {
          create: {
            status: input.status,
            actor: input.source === "manual" ? "admin" : "system",
            note: input.source === "manual" ? "سفارش به‌صورت دستی ثبت شد" : "سفارش ثبت شد",
          },
        },
      },
      select: { id: true, number: true },
    });

    if (options.commitStock) {
      await decrementStock(
        tx,
        input.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity, name: i.name }))
      );
    }

    return order;
  };

  return options.db ? run(options.db) : prisma.$transaction(run);
}

/* -------------------------------------------------------------------------- */
/* Payment finalisation                                                        */
/* -------------------------------------------------------------------------- */

export interface FinalizeInput {
  orderId: string;
  paymentRef: string;
  cardPan?: string | null;
}

export interface FinalizeResult {
  /** False when the order had already been finalised — a replayed callback. */
  changed: boolean;
  number: string;
  customerPhone: string;
  customerName: string;
  smsNotifications: boolean;
  shippingMethodCode: string;
}

/**
 * Marks an order paid and applies every consequence, exactly once.
 *
 * Everything that must not happen twice lives in one transaction: the
 * `finalizedAt` guard, the stock decrement, the coupon redemption, the status
 * event and the paid flags. A second callback re-enters, sees `finalizedAt`
 * already set, and returns `changed: false` without touching anything.
 *
 * The order-registered SMS is handled by the caller, gated on
 * `orderSmsSentAt`, because a network call has no place inside a transaction.
 */
export async function finalizePaidOrder(input: FinalizeInput): Promise<FinalizeResult> {
  // Serializable transactions legitimately abort when two of them touch the
  // same rows at once (Postgres 40001). That is the database doing its job, not
  // a failure to report — so the work is simply retried. Only once the retries
  // are spent does the caller see an error, and it is the honest one
  // ("out of stock") rather than a driver message.
  return withSerializationRetry(() => finalizePaidOrderOnce(input));
}

/** Retries a transaction through serialization failures and deadlocks. */
async function withSerializationRetry<T>(run: () => Promise<T>, attempts = 4): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await run();
    } catch (error) {
      if (!isRetryableTransactionError(error)) throw error;
      lastError = error;
      // A little jitter so two racing callbacks don't retry in lockstep.
      const backoff = 25 * 2 ** attempt + Math.floor(Math.random() * 25);
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }
  logger.warn("تراکنش پس از چند تلاش هم موفق نشد", { cause: lastError });
  throw outOfStock(
    "به دلیل خرید همزمان، موجودی این کالا تمام شد. لطفاً سبد خرید خود را بازبینی کنید."
  );
}

/** Postgres 40001 (serialization failure) and 40P01 (deadlock) are retryable. */
function isRetryableTransactionError(error: unknown): boolean {
  const code =
    error instanceof Prisma.PrismaClientKnownRequestError
      ? String((error.meta as { code?: string } | undefined)?.code ?? error.code)
      : "";
  const message = error instanceof Error ? error.message : "";
  return (
    code === "40001" ||
    code === "40P01" ||
    message.includes("40001") ||
    message.includes("40P01") ||
    message.includes("could not serialize access")
  );
}

async function finalizePaidOrderOnce(input: FinalizeInput): Promise<FinalizeResult> {
  return prisma.$transaction(
    async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: input.orderId },
        include: { items: true },
      });
      if (!order) throw notFound("سفارش پیدا نشد.");

      // The idempotency guard. Anything below runs at most once per order.
      if (order.finalizedAt) {
        return {
          changed: false,
          number: order.number,
          customerPhone: order.customerPhone,
          customerName: `${order.customerFirstName} ${order.customerLastName}`.trim(),
          smsNotifications: order.smsNotifications,
          shippingMethodCode: order.shippingMethodCode,
        };
      }

      await decrementStock(
        tx,
        order.items.map((i) => ({
          variantId: i.variantId!,
          quantity: i.quantity,
          name: i.name,
        }))
      );

      if (order.couponId) {
        // The unique constraint on `orderId` is a second, database-level guard
        // against a coupon being consumed twice for one order.
        await redeemCoupon(tx, {
          couponId: order.couponId,
          orderId: order.id,
          customerId: order.customerId,
          amount: order.couponDiscount,
        });
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: "paid",
          paymentRef: input.paymentRef,
          paymentCardPan: input.cardPan ?? null,
          paidAt: new Date(),
          status: "preparing",
          finalizedAt: new Date(),
          stockCommitted: true,
        },
      });

      await tx.orderStatusEvent.create({
        data: {
          orderId: order.id,
          status: "preparing",
          actor: "gateway",
          note: "پرداخت با موفقیت تأیید شد",
        },
      });

      // Sold counts feed the best-seller lists and the dashboard.
      for (const item of order.items) {
        if (!item.productId) continue;
        await tx.product.update({
          where: { id: item.productId },
          data: { soldCount: { increment: item.quantity } },
        });
      }

      return {
        changed: true,
        number: order.number,
        customerPhone: order.customerPhone,
        customerName: `${order.customerFirstName} ${order.customerLastName}`.trim(),
        smsNotifications: order.smsNotifications,
        shippingMethodCode: order.shippingMethodCode,
      };
    },
    // Serializable: two concurrent callbacks for the same order must not both
    // pass the `finalizedAt` check.
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 }
  );
}

/** Marks a payment failed. Safe to call repeatedly. */
export async function markPaymentFailed(orderId: string, reason: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    // A paid order is never walked back by a late failure callback.
    if (!order || order.paymentStatus === "paid" || order.finalizedAt) return;
    if (order.status === "payment_failed") return;

    await tx.order.update({
      where: { id: orderId },
      data: { paymentStatus: "failed", status: "payment_failed" },
    });
    await tx.orderStatusEvent.create({
      data: {
        orderId,
        status: "payment_failed",
        actor: "gateway",
        note: reason.slice(0, 200),
      },
    });
  });
}

/**
 * Sends the order-registered SMS at most once per order.
 *
 * `orderSmsSentAt` is claimed with a conditional update before the message goes
 * out, so a concurrent second callback finds nothing to claim and stays quiet.
 */
export async function sendOrderRegisteredSms(orderId: string): Promise<void> {
  const claimed = await prisma.order.updateMany({
    where: { id: orderId, paymentStatus: "paid", orderSmsSentAt: null, smsNotifications: true },
    data: { orderSmsSentAt: new Date() },
  });
  if (claimed.count === 0) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { number: true, customerPhone: true, customerFirstName: true, customerLastName: true },
  });
  if (!order) return;

  const name = `${order.customerFirstName} ${order.customerLastName}`.trim();
  const result = await sendPatternSmsQuietly("orderRegistered", order.customerPhone, [
    name,
    order.number,
  ]);

  // Release the claim if it never actually went out, so a retry can try again.
  if (!result || result.mocked) {
    await prisma.order.update({ where: { id: orderId }, data: { orderSmsSentAt: null } });
  }
}


/**
 * Once a payment is confirmed, message each configured administrator once.
 *
 * The DB claim protects against concurrent callbacks. Successful recipients
 * are persisted individually; a failed recipient can be retried without
 * re-notifying somebody who already received their SMS. A crash between
 * provider acceptance and persistence cannot be made exactly-once without a
 * provider-supported idempotency key, but every recorded delivery is deduped.
 */
export async function sendOrderAdminSms(orderId: string): Promise<void> {
  const recipients = orderAdminRecipients();
  if (!env.MELIPAYAMAK_SHARED_KEY || !env.MELIPAYAMAK_ADMIN_ORDER_BODY_ID || !recipients.length) {
    logger.warn("پیامک سفارش مدیران پیکربندی نشده است");
    return;
  }

  const claimAt = new Date();
  const staleBefore = new Date(claimAt.getTime() - 2 * 60_000);
  const claim = await prisma.order.updateMany({
    where: {
      id: orderId,
      paymentStatus: "paid",
      finalizedAt: { not: null },
      OR: [
        { adminOrderSmsLockAt: null },
        { adminOrderSmsLockAt: { lt: staleBefore } },
      ],
    },
    data: { adminOrderSmsLockAt: claimAt },
  });
  if (!claim.count) return;

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { number: true, adminOrderSmsSentTo: true },
    });
    if (!order) return;

    const delivered = new Set(order.adminOrderSmsSentTo);
    for (const recipient of recipients) {
      if (delivered.has(recipient)) continue;
      const sent = await sendPatternSmsQuietly("adminOrderRegistered", recipient, [order.number]);
      if (!sent || sent.mocked) continue;

      // Persist each success before moving to the next recipient. A partial
      // outage can therefore be retried without replaying the first message.
      const updated = await prisma.order.updateMany({
        where: { id: orderId, adminOrderSmsLockAt: claimAt },
        data: { adminOrderSmsSentTo: { push: recipient } },
      });
      if (!updated.count) {
        // We lost our lock (e.g. a long pause/stale takeover). Stop sending.
        logger.warn("قفل ارسال پیامک مدیران تغییر کرده است", { orderNumber: order.number });
        return;
      }
      delivered.add(recipient);
    }
  } finally {
    await prisma.order.updateMany({
      where: { id: orderId, adminOrderSmsLockAt: claimAt },
      data: { adminOrderSmsLockAt: null },
    });
  }
}

/** SMS is best-effort: a notification outage must never undo a paid order. */
export async function notifyPaidOrder(orderId: string): Promise<void> {
  const results = await Promise.allSettled([
    sendOrderRegisteredSms(orderId),
    sendOrderAdminSms(orderId),
  ]);
  for (const result of results) {
    if (result.status === "rejected") {
      logger.error("ارسال اطلاع‌رسانی سفارش ناموفق بود", { cause: result.reason });
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Status changes                                                              */
/* -------------------------------------------------------------------------- */

export interface StatusChangeInput {
  orderId: string;
  status: OrderStatus;
  expectedStatus?: OrderStatus;
  /** Explicit undo; must match the order's actual prior status. */
  undo?: boolean;
  note?: string;
  actor: string;
  actorId?: string;
}

/**
 * Admin workflow changes, including an explicit audited one-step undo.
 * Status rollback never reverses a real payment or bank refund. The inventory
 * flag is separately persisted so repeated cancellations/reversions cannot
 * return or deduct stock twice. All changes are atomic with the event.
 */
export async function changeOrderStatus(input: StatusChangeInput): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      include: {
        items: true,
        events: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { status: true, isUndo: true } },
      },
    });
    if (!order || order.deletedAt) throw notFound("سفارش پیدا نشد.");

    if (input.expectedStatus && order.status !== input.expectedStatus) {
      throw conflict("وضعیت سفارش قبلاً تغییر کرده است. صفحه را به‌روز کنید.");
    }
    if (input.status === "cancelled" && order.paymentAuthority && order.paymentStatus === "pending") {
      throw conflict("تراکنش پرداخت این سفارش هنوز در جریان است؛ ابتدا وضعیت پرداخت را مشخص کنید.");
    }

    if (input.undo) {
      const previous = previousOrderStatus(order.status, order.events);
      if (!previous || previous !== input.status) {
        throw conflict("وضعیت قبلی سفارش تغییر کرده است. صفحه را تازه کنید و دوباره تلاش کنید.");
      }
    } else if (
      ["awaiting_payment", "payment_failed", "expired"].includes(input.status) ||
      !(
        // Admins may select any operational stage directly for a paid order;
        // unpaid orders and refunded money must never be represented as paid.
        (["preparing", "packaged", "shipped", "delivered"].includes(input.status) &&
         order.paymentStatus === "paid" && order.status !== "refunded") ||
        canTransition(order.status, input.status)
      )
    ) {
      throw conflict(`تغییر وضعیت از «${order.status}» به «${input.status}» مجاز نیست.`);
    }

    // Finance remains the source of truth: never undo a gateway confirmation,
    // issue an imaginary bank refund, or mark a refunded payment as paid.
    const effect = stockEffectForStatusChange({
      destination: input.status,
      stockCommitted: order.stockCommitted,
      inventoryWasCommitted: order.source === "manual" || order.finalizedAt !== null,
    });
    const returningStock = effect === "restore";
    const reclaimingStock = effect === "reserve";
    if (reclaimingStock && order.items.some((item) => !item.variantId)) {
      throw conflict("برگشت این سفارش ممکن نیست؛ تنوع یکی از کالاهای سفارش از انبار حذف شده است.");
    }

    if (returningStock) {
      await restoreStock(tx, order.items.map((item) => ({
        variantId: item.variantId,
        quantity: item.quantity,
      })));
    } else if (reclaimingStock) {
      await decrementStock(tx, order.items.map((item) => ({
        variantId: item.variantId ?? "", quantity: item.quantity,
        name: item.name,
      })).filter((item) => item.variantId));
    }

    // soldCount is incremented only when a real paid order is finalised. An
    // unpaid manual order has inventory reserved but no completed sale count.
    if ((returningStock || reclaimingStock) && order.finalizedAt) {
      for (const item of order.items) {
        if (!item.productId) continue;
        await tx.product.update({
          where: { id: item.productId },
          data: { soldCount: returningStock
            ? { decrement: item.quantity }
            : { increment: item.quantity } },
        });
      }
    }

    // Conditional status comparison protects against concurrent admin changes.
    // The entire transaction (including stock) rolls back on a mismatch.
    const moved = await tx.order.updateMany({
      where: { id: input.orderId, status: order.status, deletedAt: null },
      data: {
        status: input.status,
        stockCommitted: returningStock ? false : reclaimingStock ? true : order.stockCommitted,
        ...(input.status === "shipped" ? { shippedAt: new Date() } : {}),
        ...(input.status === "delivered" ? { deliveredAt: new Date() } : {}),
        ...(["awaiting_payment", "preparing", "packaged", "payment_failed", "expired", "cancelled"].includes(input.status)
          ? { shippedAt: null, deliveredAt: null }
          : input.status === "shipped" ? { deliveredAt: null } : {}),
        // A refund is a financial action; never silently roll it back when an
        // order's operational status moves backwards.
        ...(input.status === "refunded" ? { paymentStatus: "refunded" } : {}),
      },
    });
    if (moved.count !== 1) {
      throw conflict("وضعیت سفارش هم‌زمان تغییر کرده است. دوباره تلاش کنید.");
    }

    await tx.orderStatusEvent.create({
      data: {
        orderId: input.orderId,
        status: input.status,
        note: `${input.undo ? `بازگشت از «${order.status}» به وضعیت قبلی` : "تغییر وضعیت توسط مدیر"}${input.note ? ` — ${input.note}` : ""}`,
        actor: input.actor,
        actorId: input.actorId ?? null,
        isUndo: input.undo === true,
      },
    });

    if (returningStock || reclaimingStock) {
      logger.info("موجودی سفارش پس از تغییر وضعیت اصلاح شد", {
        orderId: input.orderId, restored: returningStock, reclaimed: reclaimingStock,
      });
    }
  });
}

/**
 * Records a carrier and tracking code.
 *
 * Writing a tracking code also advances the order to `shipped` when it is ready
 * for that, because in practice the two always happen together — and it keeps
 * the customer's timeline honest without the administrator having to remember a
 * second step.
 */
export async function setTracking(input: {
  orderId: string;
  carrier: string;
  trackingCode: string;
  actorId?: string;
}): Promise<{ number: string; advanced: boolean; phone: string; notify: boolean }> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: input.orderId } });
    if (!order) throw notFound("سفارش پیدا نشد.");

    const advanced = canTransition(order.status, "shipped");

    await tx.order.update({
      where: { id: input.orderId },
      data: {
        carrier: input.carrier,
        trackingCode: input.trackingCode,
        ...(advanced ? { status: "shipped", shippedAt: new Date() } : {}),
      },
    });

    await tx.orderStatusEvent.create({
      data: {
        orderId: input.orderId,
        status: advanced ? "shipped" : order.status,
        actor: "admin",
        actorId: input.actorId ?? null,
        note: `کد رهگیری ${input.carrier}: ${input.trackingCode}`,
      },
    });

    return {
      number: order.number,
      advanced,
      phone: order.customerPhone,
      notify: order.smsNotifications,
    };
  });
}
