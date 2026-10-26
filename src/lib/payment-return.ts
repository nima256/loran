/**
 * Remember which order this browser tab sent to the payment gateway.
 * Keep this in sessionStorage (not localStorage), so a payment in one tab does
 * not clear a different tab's cart just because somebody opens a success URL.
 * Storage may be disabled by the browser; never let it block payment.
 */
const PENDING_ORDER_KEY = "loran:pending-payment-order";

export function rememberPendingPayment(orderNumber: string): void {
  try {
    window.sessionStorage.setItem(PENDING_ORDER_KEY, orderNumber);
  } catch {
    // Payment must still proceed when browser storage is unavailable.
  }
}

export function hasPendingPayment(orderNumber: string): boolean {
  if (!orderNumber) return false;
  try {
    return window.sessionStorage.getItem(PENDING_ORDER_KEY) === orderNumber;
  } catch {
    return false;
  }
}

export function forgetPendingPayment(): void {
  try {
    window.sessionStorage.removeItem(PENDING_ORDER_KEY);
  } catch {
    // Nothing to remove when browser storage is unavailable.
  }
}
