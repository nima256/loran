import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, FileText, Printer, Truck } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import {
  AdminNoteForm,
  OrderStatusActions,
  TrackingForm,
} from "@/components/admin/OrderActions";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PriceInline } from "@/components/ui/Price";
import { OrderStatusBadge, OrderTimeline } from "@/components/account/OrderStatus";
import { OrderSummary } from "@/components/cart/OrderSummary";
import { getAdminOrder } from "@/server/services/order-queries";
import { allowedTransitions } from "@/server/services/order-status";
import { listTrackingCarriers } from "@/server/services/shipping";
import { prisma } from "@/server/lib/prisma";
import { PAYMENT_METHOD_LABELS } from "@/lib/orders";
import { formatDateTime, formatPhone, toPersianDigits } from "@/lib/format";

/**
 * Admin order detail.
 *
 * A server component that loads the order, with client islands for the write
 * actions. The status buttons offer only transitions the workflow permits, and
 * the tracking code written here is the same row the customer's order page
 * reads — there is no admin-only copy of it.
 */

export const dynamic = "force-dynamic";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = await params;

  let order;
  try {
    order = await getAdminOrder(decodeURIComponent(number));
  } catch {
    notFound();
  }

  const [carriers, customer] = await Promise.all([
    listTrackingCarriers(),
    prisma.order
      .findUnique({ where: { id: order.id }, select: { customerId: true } })
      .then((row) => row?.customerId ?? null),
  ]);

  const allowed = allowedTransitions(order.status);

  return (
    <>
      <Link href="/admin/orders" className="mb-4 inline-flex min-h-9 items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowRight className="size-4" aria-hidden />
        بازگشت به سفارش‌ها
      </Link>

      <AdminPageHeader
        title={order.number}
        description={`ثبت شده در ${formatDateTime(order.createdAt)}${order.source === "manual" ? " — ثبت دستی" : ""}`}
        actions={
          <>
            <Link
              href={`/admin/orders/${order.number}/packing-slip`}
              className="inline-flex h-12 items-center gap-2 rounded-md border border-border-strong bg-surface px-5 text-sm font-medium text-fg hover:bg-surface-2"
            >
              <Printer className="size-4" aria-hidden />
              برگه بسته‌بندی
            </Link>
            <Link
              href={`/admin/orders/${order.number}/invoice`}
              className="inline-flex h-12 items-center gap-2 rounded-md border border-border-strong bg-surface px-5 text-sm font-medium text-fg hover:bg-surface-2"
            >
              <FileText className="size-4" aria-hidden />
              فاکتور
            </Link>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr] xl:items-start">
        <div className="space-y-4">
          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-bold text-fg">وضعیت سفارش</h2>
              <OrderStatusBadge status={order.status} />
            </div>

            <OrderTimeline status={order.status} timeline={order.timeline} />

            <OrderStatusActions
              orderId={order.id}
              status={order.status}
              allowedStatuses={allowed}
            />
          </Card>

          <Card>
            <h2 className="mb-4 flex items-center gap-2 font-bold text-fg">
              <Truck className="size-4 text-fg-subtle" aria-hidden />
              اطلاعات ارسال
            </h2>
            <p className="mb-4 text-sm text-fg-muted">
              شیوه ارسال این سفارش: <span className="font-medium text-fg">{order.shippingMethodName}</span>
              {order.shippingPaidOnDelivery && " (پس‌کرایه)"}
            </p>
            <TrackingForm
              orderId={order.id}
              carriers={carriers.length ? carriers : [{ code: "tipax", name: "تیپاکس" }]}
              currentCarrier={order.carrier}
              currentCode={order.trackingCode}
              smsAvailable={order.smsNotifications}
            />
          </Card>

          <Card padded={false}>
            <h2 className="border-b border-border p-4 font-bold text-fg">
              اقلام سفارش ({toPersianDigits(order.items.length)} مورد)
            </h2>
            <ul className="divide-y divide-border">
              {order.items.map((item, index) => (
                <li key={`${item.variantId}-${index}`} className="flex gap-3 p-4">
                  <Link href={`/admin/products/${item.slug}`} className="relative size-16 shrink-0 overflow-hidden rounded-md bg-surface-inset">
                    {item.image && <Image src={item.image} alt="" fill sizes="64px" className="object-cover" />}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/products/${item.slug}`} className="line-clamp-2 text-sm font-medium text-fg hover:text-primary dark:hover:text-[color:var(--primary-soft-fg)]">
                      {item.name}
                    </Link>
                    <p className="tnum mt-1 flex flex-wrap gap-x-3 text-xs text-fg-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <span aria-hidden className="size-3 rounded-full border border-border" style={{ background: item.colorHex }} />
                        {item.colorName}
                      </span>
                      <span>سایز {toPersianDigits(item.size)}</span>
                      <span>تعداد {toPersianDigits(item.quantity)}</span>
                    </p>
                  </div>
                  <PriceInline value={item.unitPrice * item.quantity} className="shrink-0 text-sm" />
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <h2 className="mb-3 font-bold text-fg">یادداشت‌ها</h2>
            {order.customerNote && (
              <div className="mb-4 rounded-md bg-surface-2 p-3">
                <p className="mb-1 text-xs font-medium text-fg-subtle">یادداشت مشتری</p>
                <p className="text-sm leading-7 text-fg">{order.customerNote}</p>
              </div>
            )}
            <AdminNoteForm orderId={order.id} initial={order.adminNote} />
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <h2 className="mb-3 font-bold text-fg">مشتری</h2>
            <p className="font-medium text-fg">{order.customerName}</p>
            <p className="tnum mt-1 text-sm text-fg-muted" dir="ltr">{formatPhone(order.customerPhone)}</p>
            {order.customerEmail && (
              <p className="mt-1 text-sm text-fg-muted" dir="ltr">{order.customerEmail}</p>
            )}
            {customer ? (
              <Link href={`/admin/customers/${customer}`} className="mt-3 inline-flex min-h-9 items-center text-sm text-primary hover:underline dark:text-[color:var(--primary-soft-fg)]">
                مشاهده پروفایل مشتری
              </Link>
            ) : (
              <p className="mt-3 text-xs text-fg-subtle">
                این سفارش به حساب کاربری متصل نیست (ثبت دستی).
              </p>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 font-bold text-fg">آدرس تحویل</h2>
            <p className="text-sm leading-7 text-fg-muted">
              {order.address.province}، {order.address.city}، {order.address.addressLine}
            </p>
            {(order.address.plaque || order.address.unit) && (
              <p className="tnum mt-1 text-sm text-fg-muted">
                {order.address.plaque && `پلاک ${order.address.plaque}`}
                {order.address.unit && `، واحد ${order.address.unit}`}
              </p>
            )}
            <p className="tnum mt-1 text-sm text-fg-muted">
              کد پستی: {toPersianDigits(order.address.postalCode)}
            </p>
            <p className="tnum mt-2 border-t border-border pt-2 text-sm text-fg-muted">
              گیرنده: {order.address.recipientFirstName} {order.address.recipientLastName}
              <br />
              <span dir="ltr">{formatPhone(order.address.phone)}</span>
            </p>
          </Card>

          <Card>
            <h2 className="mb-3 font-bold text-fg">پرداخت</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-fg-muted">روش</dt>
                <dd className="text-fg">
                  {PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod}
                </dd>
              </div>
              {order.paymentRef && (
                <div className="flex justify-between gap-3">
                  <dt className="text-fg-muted">کد پیگیری</dt>
                  <dd className="tnum break-token text-fg" dir="ltr">{order.paymentRef}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-fg-muted">وضعیت</dt>
                <dd>
                  {order.paymentStatus === "paid" ? (
                    <Badge tone="success" size="sm">پرداخت شده</Badge>
                  ) : order.paymentStatus === "refunded" ? (
                    <Badge tone="info" size="sm">بازپرداخت شده</Badge>
                  ) : order.paymentStatus === "failed" ? (
                    <Badge tone="danger" size="sm">ناموفق</Badge>
                  ) : (
                    <Badge tone="warning" size="sm">پرداخت نشده</Badge>
                  )}
                </dd>
              </div>
            </dl>
          </Card>

          <OrderSummary
            totals={order.totals}
            couponCode={order.couponCode}
            shippingMethod={{
              name: order.shippingMethodName,
              cost: order.totals.shippingCost,
              paidOnDelivery: order.shippingPaidOnDelivery,
            }}
            compact
          />
        </div>
      </div>
    </>
  );
}
