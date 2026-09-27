import type { OrderStatus } from "@prisma/client";

/**
 * The order status workflow.
 *
 * Statuses are not free-form: an administrator cannot post an arbitrary value
 * and drive an order into an impossible state. `canTransition` is the single
 * gate, checked server-side on every status change.
 *
 * The five primary statuses form the timeline the customer sees, in order:
 *
 *   awaiting_payment → preparing → packaged → shipped → delivered
 *
 * The exception statuses sit outside that line and render as a terminal state.
 */

/** Allowed next statuses for each status. */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  awaiting_payment: ["preparing", "cancelled", "payment_failed", "expired"],
  // `preparing` is where a paid order lands. Shipping directly from here is
  // allowed as well as via `packaged`: a small shop often picks, packs and
  // hands the parcel to the courier in one go, and entering a tracking code
  // should advance the order rather than silently leave it behind.
  preparing: ["packaged", "shipped", "cancelled", "refunded"],
  packaged: ["shipped", "preparing", "cancelled"],
  shipped: ["delivered", "returned"],
  delivered: ["returned", "refunded"],

  // Terminal-ish. A cancelled order may be refunded if money had changed hands.
  cancelled: ["refunded"],
  returned: ["refunded"],
  refunded: [],
  payment_failed: ["awaiting_payment", "cancelled"],
  expired: ["cancelled"],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return false;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function allowedTransitions(from: OrderStatus): OrderStatus[] {
  return TRANSITIONS[from] ?? [];
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  awaiting_payment: "در انتظار پرداخت",
  preparing: "در حال آماده‌سازی",
  packaged: "بسته‌بندی شد",
  shipped: "ارسال شد",
  delivered: "تحویل داده شد",
  cancelled: "لغو شده",
  returned: "مرجوع شده",
  refunded: "وجه بازگردانده شد",
  payment_failed: "پرداخت ناموفق",
  expired: "منقضی شده",
};

/** Statuses an administrator may set by hand. */
export const ADMIN_SETTABLE: OrderStatus[] = [
  "preparing",
  "packaged",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
  "refunded",
];

/**
 * Statuses that mean the order's stock has been committed.
 *
 * Used when deciding whether cancelling should return stock to the shelf.
 */
export const STOCK_COMMITTED: OrderStatus[] = [
  "preparing",
  "packaged",
  "shipped",
  "delivered",
];

/** Statuses whose revenue counts towards reporting. */
export const REVENUE_STATUSES: OrderStatus[] = [
  "preparing",
  "packaged",
  "shipped",
  "delivered",
];
