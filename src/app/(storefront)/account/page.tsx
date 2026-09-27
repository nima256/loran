"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MapPin, Package, RotateCcw, Truck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState, Skeleton } from "@/components/ui/Feedback";
import { PriceInline } from "@/components/ui/Price";
import { OrderStatusBadge } from "@/components/account/OrderStatus";
import { useAuth } from "@/store/AuthProvider";
import { api } from "@/lib/api/client";
import { formatDate, toPersianDigits } from "@/lib/format";
import type { Order } from "@/types";

interface AccountSummary {
  counts: { orders: number; openOrders: number; addresses: number; returns: number; reviews: number };
  recentOrders: Order[];
}

export default function AccountDashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<AccountSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<AccountSummary>("/api/v1/account/summary")
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch(() => {
        // A dashboard that cannot load its counts still shows the links.
        if (!cancelled) {
          setSummary({
            counts: { orders: 0, openOrders: 0, addresses: 0, returns: 0, reviews: 0 },
            recentOrders: [],
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = summary?.counts;
  const recent = summary?.recentOrders ?? [];
  const openOrders = recent.filter((o) => ["preparing", "packaged", "shipped"].includes(o.status));

  const dash = "—";
  const stat = (value: number | undefined) => (value == null ? dash : toPersianDigits(value));

  const stats = [
    { label: "سفارش‌های من", value: stat(counts?.orders), href: "/account/orders", icon: Package },
    { label: "در حال پیگیری", value: stat(counts?.openOrders), href: "/account/orders", icon: Truck },
    { label: "آدرس‌های ذخیره‌شده", value: stat(counts?.addresses), href: "/account/addresses", icon: MapPin },
    { label: "مرجوعی و تعویض", value: stat(counts?.returns), href: "/account/returns", icon: RotateCcw },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-fg sm:text-2xl">
          سلام {user?.firstName ?? "دوست عزیز"} 👋
        </h1>
        <p className="mt-1.5 text-sm text-fg-muted">
          از اینجا سفارش‌ها، آدرس‌ها و اطلاعات حسابتان را مدیریت کنید.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ label, value, href, icon: Icon }) => (
          <Link
            key={label}
            href={href}
            className="rounded-lg border border-border bg-surface p-4 transition-colors hover:border-border-strong"
          >
            <Icon className="size-5 text-fg-subtle" aria-hidden />
            <p className="tnum mt-3 text-2xl font-bold text-fg">{value}</p>
            <p className="mt-0.5 text-xs text-fg-muted">{label}</p>
          </Link>
        ))}
      </div>

      {openOrders.length > 0 && (
        <Card padded={false}>
          <div className="flex items-center justify-between gap-3 border-b border-border p-4">
            <h2 className="font-bold text-fg">سفارش در حال پیگیری</h2>
            <Link href="/account/orders" className="inline-flex min-h-9 items-center gap-1 text-sm text-primary hover:underline dark:text-[color:var(--primary-soft-fg)]">
              همه سفارش‌ها
              <ArrowLeft className="size-3.5" aria-hidden />
            </Link>
          </div>
          <div className="p-4">
            <Link
              href={`/account/orders/${openOrders[0].number}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-2 p-4 hover:bg-surface-3"
            >
              <div className="min-w-0">
                <p className="tnum break-token text-sm font-semibold text-fg" dir="ltr">{openOrders[0].number}</p>
                <p className="mt-1 text-xs text-fg-muted">
                  ثبت شده در {formatDate(openOrders[0].createdAt)}، {toPersianDigits(openOrders[0].items.length)} کالا
                </p>
              </div>
              <div className="flex items-center gap-3">
                <OrderStatusBadge status={openOrders[0].status} />
                <ArrowLeft className="size-4 text-fg-subtle" aria-hidden />
              </div>
            </Link>
          </div>
        </Card>
      )}

      <Card padded={false}>
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <h2 className="font-bold text-fg">آخرین سفارش‌ها</h2>
          <Link href="/account/orders" className="inline-flex min-h-9 items-center gap-1 text-sm text-primary hover:underline dark:text-[color:var(--primary-soft-fg)]">
            مشاهده همه
            <ArrowLeft className="size-3.5" aria-hidden />
          </Link>
        </div>

        {summary === null ? (
          <div className="space-y-2 p-4" role="status" aria-label="در حال بارگذاری سفارش‌ها">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full rounded-md" />)}
          </div>
        ) : recent.length === 0 ? (
          <EmptyState
            className="border-0"
            icon={<Package className="size-7" aria-hidden />}
            title="هنوز سفارشی ثبت نکرده‌اید"
            description="اولین خریدتان را از فروشگاه لوران شروع کنید."
            action={<ButtonLink href="/shop">رفتن به فروشگاه</ButtonLink>}
          />
        ) : (
          <ul className="divide-y divide-border">
            {recent.map((order) => (
              <li key={order.id}>
                <Link href={`/account/orders/${order.number}`} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-surface-2">
                  <div className="min-w-0">
                    <p className="tnum break-token text-sm font-medium text-fg" dir="ltr">{order.number}</p>
                    <p className="mt-1 text-xs text-fg-muted">{formatDate(order.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <PriceInline value={order.totals.payableOnline} className="text-sm" />
                    <OrderStatusBadge status={order.status} size="sm" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
