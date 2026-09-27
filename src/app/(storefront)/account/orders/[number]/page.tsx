"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight, Copy, FileText, Headphones, MapPin, MessageSquare, Package, RotateCcw, Truck,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Switch } from "@/components/ui/Checkbox";
import { Alert, EmptyState, Skeleton } from "@/components/ui/Feedback";
import { PriceInline } from "@/components/ui/Price";
import { OrderStatusBadge, OrderTimeline } from "@/components/account/OrderStatus";
import { OrderSummary } from "@/components/cart/OrderSummary";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/api/client";
import { useAction } from "@/lib/use-action";
import { PAYMENT_METHOD_LABELS } from "@/lib/orders";
import { formatDate, formatDateTime, formatPhone, toPersianDigits } from "@/lib/format";
import { siteConfig } from "@/lib/site-config";
import type { Order } from "@/types";

/**
 * The order's shape as the API returns it: the shared `Order` plus the
 * snapshotted shipping-method fields the summary needs.
 */
type OrderDetail = Order & {
  shippingMethodName: string;
  shippingPaidOnDelivery: boolean;
  carrier?: string;
};

export default function OrderDetailPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = use(params);
  const { toast } = useToast();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [smsEnabled, setSmsEnabled] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ order: OrderDetail }>(`/api/v1/account/orders/${encodeURIComponent(decodeURIComponent(number))}`)
      .then((data) => {
        if (cancelled) return;
        setOrder(data.order);
        setSmsEnabled(data.order.smsNotifications);
      })
      .catch((caught) => {
        if (!cancelled) setLoadError(errorMessage(caught));
      });
    return () => {
      cancelled = true;
    };
  }, [number]);

  /** Kept in the same place the rest of the page's actions live. */
  const saveSms = useAction(
    async (next: boolean) => {
      await api.patch("/api/v1/account/profile", { smsNotifications: next });
      return next;
    },
    {
      onSuccess: (next) =>
        toast({
          tone: "success",
          title: next ? "اطلاع‌رسانی پیامکی فعال شد" : "اطلاع‌رسانی پیامکی خاموش شد",
        }),
      onError: (message) => {
        // Put the switch back where it was: it never actually changed.
        setSmsEnabled((value) => !value);
        toast({ tone: "error", title: "ذخیره نشد", description: message });
      },
    }
  );

  if (loadError) {
    return (
      <EmptyState
        icon={<Package className="size-7" aria-hidden />}
        title="سفارش پیدا نشد"
        description={loadError}
        action={<ButtonLink href="/account/orders">بازگشت به سفارش‌ها</ButtonLink>}
      />
    );
  }

  if (!order) {
    return (
      <div className="space-y-4" role="status" aria-label="در حال بارگذاری سفارش">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-72 w-full rounded-lg" />
      </div>
    );
  }

  const method = {
    name: order.shippingMethodName,
    cost: order.totals.shippingCost,
    paidOnDelivery: order.shippingPaidOnDelivery,
  };
  const canReturn = order.status === "delivered";
  const needsPayment = order.status === "awaiting_payment" || order.status === "payment_failed";

  const copy = (value: string, label: string) => {
    navigator.clipboard?.writeText(value);
    toast({ tone: "success", title: `${label} کپی شد` });
  };

  return (
    <div className="space-y-5">
      <Link href="/account/orders" className="inline-flex min-h-9 items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowRight className="size-4" aria-hidden />
        بازگشت به سفارش‌ها
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-3 text-xl font-bold text-fg sm:text-2xl">
            <span className="tnum break-token" dir="ltr">{order.number}</span>
            <OrderStatusBadge status={order.status} />
          </h1>
          <p className="mt-1.5 text-sm text-fg-muted">
            ثبت شده در {formatDateTime(order.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/account/orders/${order.number}/invoice`} variant="secondary" size="sm" icon={<FileText className="size-4" aria-hidden />}>
            مشاهده فاکتور
          </ButtonLink>
          <ButtonLink href="/contact" variant="ghost" size="sm" icon={<Headphones className="size-4" aria-hidden />}>
            پشتیبانی سفارش
          </ButtonLink>
        </div>
      </header>

      {needsPayment && (
        <Alert
          tone={order.status === "payment_failed" ? "danger" : "warning"}
          role="status"
          title={order.status === "payment_failed" ? "پرداخت این سفارش ناموفق بود" : "این سفارش در انتظار پرداخت است"}
          action={<ButtonLink href="/checkout" size="sm">پرداخت سفارش</ButtonLink>}
        >
          تا زمانی که پرداخت کامل نشود، آماده‌سازی سفارش شروع نمی‌شود.
        </Alert>
      )}

      <Card>
        <h2 className="mb-5 font-bold text-fg">وضعیت سفارش</h2>
        <OrderTimeline status={order.status} timeline={order.timeline} />

        {order.trackingCode && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-2 p-4">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-medium text-fg">
                <Truck className="size-4 text-fg-subtle" aria-hidden />
                {/* The carrier is whatever the administrator actually recorded. */}
                کد رهگیری {order.carrier ?? order.shippingMethodName}
              </p>
              <p className="tnum break-token mt-1 font-bold text-fg" dir="ltr">{order.trackingCode}</p>
              {order.estimatedDelivery && (
                <p className="mt-1 text-xs text-fg-muted">
                  تحویل تخمینی: {formatDate(order.estimatedDelivery)}
                </p>
              )}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => copy(order.trackingCode!, "کد رهگیری")}
              icon={<Copy className="size-4" aria-hidden />}
            >
              کپی کد
            </Button>
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-start gap-3">
          <MessageSquare className="mt-1 size-5 shrink-0 text-fg-subtle" aria-hidden />
          <div className="flex-1">
            <Switch
              checked={smsEnabled}
              disabled={saveSms.pending}
              onChange={(value) => {
                // Optimistic, with the action putting it back on failure.
                setSmsEnabled(value);
                void saveSms.run(value);
              }}
              label="اطلاع‌رسانی پیامکی وضعیت این سفارش"
              description="با هر تغییر وضعیت (آماده‌سازی، ارسال، تحویل) برای شما پیامک ارسال می‌شود."
            />
          </div>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem] lg:items-start">
        <Card padded={false}>
          <h2 className="border-b border-border p-4 font-bold text-fg sm:p-5">
            کالاهای سفارش ({toPersianDigits(order.items.length)} مورد)
          </h2>
          <ul className="divide-y divide-border">
            {order.items.map((item, index) => (
              <li key={`${item.variantId}-${index}`} className="flex gap-3 p-4">
                <Link href={`/product/${item.slug}`} className="relative size-20 shrink-0 overflow-hidden rounded-md bg-surface-inset">
                  <Image src={item.image} alt={item.name} fill sizes="80px" className="object-cover" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/product/${item.slug}`} className="line-clamp-2 text-sm font-medium text-fg hover:text-primary dark:hover:text-[color:var(--primary-soft-fg)]">
                    {item.name}
                  </Link>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden className="size-3 rounded-full border border-border" style={{ background: item.colorHex }} />
                      {item.colorName}
                    </span>
                    <span className="tnum">سایز {toPersianDigits(item.size)}</span>
                    <span className="tnum">تعداد {toPersianDigits(item.quantity)}</span>
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <PriceInline value={item.unitPrice * item.quantity} className="text-sm" />
                    {order.status === "delivered" && (
                      <Link
                        href={`/product/${item.slug}#reviews`}
                        className="inline-flex min-h-9 items-center text-xs font-medium text-primary hover:underline dark:text-[color:var(--primary-soft-fg)]"
                      >
                        ثبت دیدگاه
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-5">
          <OrderSummary
            totals={order.totals}
            couponCode={order.couponCode}
            shippingMethod={method}
            compact
          />

          <Card>
            <h2 className="mb-3 flex items-center gap-2 font-bold text-fg">
              <MapPin className="size-4 text-fg-subtle" aria-hidden />
              آدرس تحویل
            </h2>
            <div className="text-sm leading-7 text-fg-muted">
              <p className="font-medium text-fg">{order.address.title}</p>
              <p>{order.address.province}، {order.address.city}، {order.address.addressLine}</p>
              <p className="tnum">
                {order.address.plaque && `پلاک ${order.address.plaque}`}
                {order.address.unit && `، واحد ${order.address.unit}`}
              </p>
              <p className="tnum">کد پستی: {toPersianDigits(order.address.postalCode)}</p>
              <p className="tnum mt-2 border-t border-border pt-2">
                گیرنده: {order.address.recipientFirstName} {order.address.recipientLastName}
                <br />
                {formatPhone(order.address.phone)}
              </p>
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 flex items-center gap-2 font-bold text-fg">
              <Package className="size-4 text-fg-subtle" aria-hidden />
              ارسال و پرداخت
            </h2>
            <dl className="space-y-2.5 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-fg-muted">شیوه ارسال</dt>
                <dd className="text-end text-fg">{method.name}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-fg-muted">روش پرداخت</dt>
                <dd className="text-end text-fg">{PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod}</dd>
              </div>
              {order.paymentRef && (
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-fg-muted">کد پیگیری پرداخت</dt>
                  <dd className="tnum break-token text-end text-fg" dir="ltr">{order.paymentRef}</dd>
                </div>
              )}
              {order.paidAt && (
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-fg-muted">تاریخ پرداخت</dt>
                  <dd className="text-end text-fg">{formatDate(order.paidAt)}</dd>
                </div>
              )}
              {method.paidOnDelivery && (
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-fg-muted">کرایه ارسال</dt>
                  <dd className="text-end"><Badge tone="warning" size="sm">پس‌کرایه، هنگام تحویل</Badge></dd>
                </div>
              )}
            </dl>
          </Card>

          {canReturn && (
            <Card className="bg-surface-2">
              <h2 className="flex items-center gap-2 font-bold text-fg">
                <RotateCcw className="size-4 text-fg-subtle" aria-hidden />
                تعویض یا مرجوع کردن
              </h2>
              <p className="mt-2 text-sm leading-7 text-fg-muted">
                تا {toPersianDigits(siteConfig.commerce.returnWindowDays)} روز پس از تحویل می‌توانید
                درخواست تعویض سایز یا مرجوعی ثبت کنید.
              </p>
              <ButtonLink href={`/account/returns?order=${order.number}`} variant="secondary" size="sm" className="mt-4">
                ثبت درخواست
              </ButtonLink>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
