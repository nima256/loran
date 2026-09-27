"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, FileText, Package, Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Navigation";
import { Alert, EmptyState, Skeleton } from "@/components/ui/Feedback";
import { PriceInline } from "@/components/ui/Price";
import { OrderStatusBadge } from "@/components/account/OrderStatus";
import { api, errorMessage } from "@/lib/api/client";
import { formatDate, toLatinDigits, toPersianDigits } from "@/lib/format";
import type { AnyOrderStatus, Order } from "@/types";

const TAB_FILTERS: Record<string, AnyOrderStatus[] | null> = {
  all: null,
  open: ["awaiting_payment", "preparing", "packaged", "shipped"],
  delivered: ["delivered"],
  problem: ["cancelled", "returned", "refunded", "payment_failed", "expired"],
};

function OrdersList() {
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ orders: Order[] }>("/api/v1/account/orders")
      .then((data) => {
        if (!cancelled) setOrders(data.orders);
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(errorMessage(caught));
          setOrders([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const all = useMemo(() => orders ?? [], [orders]);

  const filtered = useMemo(() => {
    const statuses = TAB_FILTERS[tab];
    const term = toLatinDigits(query).trim().toLowerCase();
    return all.filter((order) => {
      if (statuses && !statuses.includes(order.status)) return false;
      if (!term) return true;
      return (
        order.number.toLowerCase().includes(term) ||
        order.items.some((item) => item.name.includes(query.trim()))
      );
    });
  }, [all, tab, query]);

  const counts = {
    all: all.length,
    open: all.filter((o) => TAB_FILTERS.open!.includes(o.status)).length,
    delivered: all.filter((o) => o.status === "delivered").length,
    problem: all.filter((o) => TAB_FILTERS.problem!.includes(o.status)).length,
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold text-fg sm:text-2xl">سفارش‌های من</h1>
        <p className="mt-1.5 text-sm text-fg-muted">سابقه خریدها، وضعیت ارسال و فاکتورها.</p>
      </header>

      {/* Search keeps the page usable when a customer has dozens of orders. */}
      <div className="relative">
        <Search className="pointer-events-none absolute inset-y-0 start-4 my-auto size-4 text-fg-subtle" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="جست‌وجو بر اساس شماره سفارش یا نام کالا"
          aria-label="جست‌وجو در سفارش‌ها"
          className="h-12 w-full rounded-md border border-border-strong bg-surface px-4 ps-11 text-sm
                     focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
        />
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "all", label: "همه", count: counts.all },
          { value: "open", label: "جاری", count: counts.open },
          { value: "delivered", label: "تحویل‌شده", count: counts.delivered },
          { value: "problem", label: "لغو و مرجوعی", count: counts.problem },
        ]}
      />

      {error && <Alert tone="danger" role="alert">{error}</Alert>}

      {orders === null ? (
        <div className="space-y-3" role="status" aria-label="در حال بارگذاری سفارش‌ها">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-40 w-full rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Package className="size-7" aria-hidden />}
          title={query ? "سفارشی با این مشخصات پیدا نشد" : "در این بخش سفارشی ندارید"}
          description={query ? "شماره سفارش یا نام کالا را دوباره بررسی کنید." : "سفارش‌های این دسته اینجا نمایش داده می‌شوند."}
          action={<ButtonLink href="/shop">رفتن به فروشگاه</ButtonLink>}
        />
      ) : (
        <ul className="space-y-3">
          {filtered.map((order) => (
            <li key={order.id}>
              <Card padded={false}>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
                  <div className="min-w-0">
                    <p className="tnum break-token font-semibold text-fg" dir="ltr">{order.number}</p>
                    <p className="mt-1 text-xs text-fg-muted">
                      {formatDate(order.createdAt)}، {toPersianDigits(order.items.length)} کالا
                    </p>
                  </div>
                  <OrderStatusBadge status={order.status} />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 p-4">
                  <div className="flex -space-x-3 space-x-reverse">
                    {order.items.slice(0, 4).map((item, index) => (
                      <span
                        key={`${item.variantId}-${index}`}
                        className="relative size-14 overflow-hidden rounded-md border-2 border-surface bg-surface-inset"
                      >
                        {item.image ? (
                          <Image src={item.image} alt={item.name} fill sizes="56px" className="object-cover" />
                        ) : null}
                      </span>
                    ))}
                    {order.items.length > 4 && (
                      <span className="tnum grid size-14 place-items-center rounded-md border-2 border-surface bg-surface-2 text-xs text-fg-muted">
                        +{toPersianDigits(order.items.length - 4)}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <PriceInline value={order.totals.payableOnline} />
                    <Link
                      href={`/account/orders/${order.number}/invoice`}
                      className="inline-flex h-11 items-center gap-1.5 rounded-md border border-border px-3 text-sm text-fg-muted hover:text-fg"
                    >
                      <FileText className="size-4" aria-hidden />
                      فاکتور
                    </Link>
                    <Link
                      href={`/account/orders/${order.number}`}
                      className="inline-flex h-11 items-center gap-1.5 rounded-md bg-surface-2 px-3 text-sm font-medium text-fg hover:bg-surface-3"
                    >
                      جزئیات و پیگیری
                      <ArrowLeft className="size-4" aria-hidden />
                    </Link>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="skeleton h-96 rounded-lg" />}>
      <OrdersList />
    </Suspense>
  );
}
