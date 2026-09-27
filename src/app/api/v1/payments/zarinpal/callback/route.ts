import { NextResponse } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { env } from "@/server/lib/env";
import { logger } from "@/server/lib/logger";
import {
  finalizePaidOrder,
  markPaymentFailed,
  sendOrderRegisteredSms,
} from "@/server/services/orders";
import { verifyPayment } from "@/server/services/zarinpal";

/**
 * GET /api/v1/payments/zarinpal/callback — where ZarinPal returns the customer.
 *
 * Two things this route refuses to do:
 *
 *  1. Treat the query string as proof. `?Status=OK` is attacker-controllable —
 *     it arrives in the customer's browser. Payment is proven only by the
 *     server-to-server verify call below, against the amount the server itself
 *     computed and stored on the order.
 *
 *  2. Act twice. The customer will refresh this URL, and ZarinPal may retry it.
 *     Every consequence of payment — stock, coupon redemption, status events,
 *     the confirmation SMS — is behind the `finalizedAt` guard inside
 *     `finalizePaidOrder`'s transaction. A second call returns
 *     `changed: false` and redirects to the same success page, so refreshing is
 *     harmless: no second charge, no second decrement, no duplicate events.
 *
 * It always redirects rather than returning JSON — the customer's browser is
 * what lands here, so it needs a page.
 */

function redirect(path: string) {
  return NextResponse.redirect(new URL(path, env.SITE_URL), { status: 303 });
}

function successUrl(orderNumber: string, refId?: string) {
  const params = new URLSearchParams({ order: orderNumber });
  if (refId) params.set("ref", refId);
  return `/payment/success?${params.toString()}`;
}

function failureUrl(orderNumber: string | null, reason: string) {
  const params = new URLSearchParams({ reason });
  if (orderNumber) params.set("order", orderNumber);
  return `/payment/failed?${params.toString()}`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const authority = url.searchParams.get("Authority");
  const status = url.searchParams.get("Status");

  if (!authority) {
    logger.warn("بازگشت از درگاه بدون شناسه تراکنش");
    return redirect(failureUrl(null, "authority"));
  }

  // The Authority is the link back to the order. It was stored when the payment
  // was created, so it cannot be used to reach an order the gateway never saw.
  const order = await prisma.order.findUnique({
    where: { paymentAuthority: authority },
    select: {
      id: true,
      number: true,
      payableOnline: true,
      paymentStatus: true,
      paymentRef: true,
      finalizedAt: true,
    },
  });

  if (!order) {
    logger.warn("بازگشت از درگاه برای سفارش ناشناس");
    return redirect(failureUrl(null, "order"));
  }

  // Already settled — a refresh, or a gateway retry. Answer consistently and
  // do nothing else.
  if (order.finalizedAt && order.paymentStatus === "paid") {
    return redirect(successUrl(order.number, order.paymentRef ?? undefined));
  }

  if (status !== "OK") {
    await markPaymentFailed(order.id, "پرداخت توسط کاربر لغو شد یا ناموفق بود");
    return redirect(failureUrl(order.number, "cancelled"));
  }

  /* --- Server-to-server verification: the only proof of payment -------- */
  let verification;
  try {
    verification = await verifyPayment({
      authority,
      // The amount the SERVER computed and stored, never one from the request.
      amount: order.payableOnline,
    });
  } catch (error) {
    logger.error("تأیید پرداخت با خطا مواجه شد", { orderNumber: order.number, cause: error });
    // Deliberately not marked failed: the money may well have been taken, and
    // the verify call is retryable. The order stays pending for the
    // administrator to settle rather than being wrongly written off.
    return redirect(failureUrl(order.number, "verify"));
  }

  if (!verification.ok) {
    await markPaymentFailed(order.id, `تأیید پرداخت ناموفق بود (کد ${verification.code ?? "?"})`);
    return redirect(failureUrl(order.number, "declined"));
  }

  const result = await finalizePaidOrder({
    orderId: order.id,
    paymentRef: verification.refId,
    cardPan: verification.cardPan,
  });

  // Only a first finalisation notifies; `sendOrderRegisteredSms` claims its own
  // flag as a second guard in case two callbacks race past this point.
  if (result.changed) {
    await sendOrderRegisteredSms(order.id);
    logger.info("سفارش پرداخت شد", { orderNumber: result.number });
  }

  return redirect(successUrl(result.number, verification.refId));
}
