import type { AnyOrderStatus, OrderStatus } from "@/types";

/**
 * Order status vocabulary.
 *
 * The five primary statuses are fixed by the business and define the timeline
 * in order. Exception statuses sit outside the timeline: an order in one of them
 * renders a terminal banner instead of a progress step.
 */
export const ORDER_STATUS_FLOW: OrderStatus[] = [
  "awaiting_payment",
  "preparing",
  "packaged",
  "shipped",
  "delivered",
];

export const ORDER_STATUS_LABELS: Record<AnyOrderStatus, string> = {
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

/** Short customer-facing explanation shown under the status chip. */
export const ORDER_STATUS_HINTS: Record<AnyOrderStatus, string> = {
  awaiting_payment: "سفارش شما ثبت شده اما هنوز پرداخت نشده است.",
  preparing: "سفارش شما در انبار در حال آماده‌سازی است.",
  packaged: "سفارش بسته‌بندی شد و آماده تحویل به تیپاکس است.",
  shipped: "مرسوله تحویل تیپاکس شد و در مسیر رسیدن به شماست.",
  delivered: "سفارش با موفقیت تحویل داده شد.",
  cancelled: "این سفارش لغو شده است.",
  returned: "کالاهای این سفارش مرجوع شده‌اند.",
  refunded: "مبلغ این سفارش به حساب شما بازگردانده شد.",
  payment_failed: "پرداخت این سفارش ناموفق بود. می‌توانید دوباره تلاش کنید.",
  expired: "مهلت پرداخت این سفارش به پایان رسید و سفارش باطل شد.",
};

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

export const ORDER_STATUS_TONE: Record<AnyOrderStatus, StatusTone> = {
  awaiting_payment: "warning",
  preparing: "info",
  packaged: "info",
  shipped: "info",
  delivered: "success",
  cancelled: "neutral",
  returned: "neutral",
  refunded: "success",
  payment_failed: "danger",
  expired: "neutral",
};

export function isExceptionStatus(status: AnyOrderStatus): boolean {
  return !ORDER_STATUS_FLOW.includes(status as OrderStatus);
}

/** Index in the five-step timeline, or -1 for exception statuses. */
export function statusStep(status: AnyOrderStatus): number {
  return ORDER_STATUS_FLOW.indexOf(status as OrderStatus);
}

/**
 * Payment-method labels.
 *
 * "online" is the ZarinPal gateway, the only one Loran uses. The others cover
 * how a manually entered order was settled. A lookup that misses falls back to
 * the raw code at the call site rather than rendering nothing.
 */
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  online: "پرداخت اینترنتی",
  cash: "نقدی / حضوری",
  card: "کارت به کارت",
  pos: "دستگاه کارت‌خوان",
  cod: "پرداخت در محل",
};

/** Mirrors the ReturnStatus enum in the database. */
export const RETURN_STATUS_LABELS: Record<string, string> = {
  requested: "ثبت شده",
  info_requested: "در انتظار اطلاعات تکمیلی",
  approved: "تأیید شده",
  rejected: "رد شده",
  in_transit: "در مسیر بازگشت",
  received: "دریافت شد",
  completed: "تکمیل شده",
  refunded: "بازپرداخت شد",
  cancelled: "لغو شده",
};

export const RETURN_STATUS_TONE: Record<string, StatusTone> = {
  requested: "warning",
  info_requested: "warning",
  approved: "info",
  rejected: "danger",
  in_transit: "info",
  received: "info",
  completed: "success",
  refunded: "success",
  cancelled: "neutral",
};
