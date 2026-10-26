import { Suspense } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Package, ShoppingCart, TrendingUp, Users } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { BarChart, RankedBarChart, StatTile, TrendChart } from "@/components/admin/Charts";
import { DateRangePicker } from "@/components/admin/DateRangePicker";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/Feedback";
import { OrderStatusBadge } from "@/components/account/OrderStatus";
import { PriceInline } from "@/components/ui/Price";
import {
  getBestSellers,
  getDashboardKpis,
  getInventorySummary,
  getLowStockVariants,
  getOrderSeries,
  getRecentOrders,
  getRevenueByCategory,
  getRevenueSeries,
  parseRange,
} from "@/server/services/analytics";
import { prisma } from "@/server/lib/prisma";
import { formatCompactPrice, formatDate, formatPrice, toPersianDigits } from "@/lib/format";

/**
 * Admin dashboard.
 *
 * Every figure is a live database query over the selected range — there is no
 * seeded or random analytics left. Revenue counts only orders that were paid
 * for and not since cancelled or refunded; see `services/analytics`.
 */

export const dynamic = "force-dynamic";

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const days = Number(params.days ?? 30);
  const range = parseRange(params.from, params.to, Number.isFinite(days) ? days : 30);

  const [
    kpis, revenueSeries, orderSeries, bestSellers, revenueByCategory,
    recentOrders, lowStock, inventory, pendingOrders,
  ] = await Promise.all([
    getDashboardKpis(range),
    getRevenueSeries(range),
    getOrderSeries(range),
    getBestSellers(range),
    getRevenueByCategory(range),
    getRecentOrders(8),
    getLowStockVariants(3, 6),
    getInventorySummary(),
    prisma.order.findMany({
      where: { status: { in: ["awaiting_payment", "preparing", "packaged"] } },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true, number: true, status: true, payableOnline: true, createdAt: true,
        shipRecipientFirstName: true, shipRecipientLastName: true,
      },
    }),
  ]);

  const rangeLabel = `${toPersianDigits(Math.max(1, Math.round((range.to.getTime() - range.from.getTime()) / 86_400_000)))} روز گذشته`;

  return (
    <>
      <AdminPageHeader
        title="پیشخوان"
        description="نمای کلی فروش، سفارش‌ها و وضعیت انبار."
        actions={
          <Suspense fallback={null}>
            <DateRangePicker />
          </Suspense>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="درآمد بازه"
          value={formatCompactPrice(kpis.revenue)}
          delta={{ value: kpis.revenueChange }}
          hint="نسبت به بازه قبل"
          icon={<TrendingUp className="size-4" aria-hidden />}
        />
        <StatTile
          label="سفارش‌های پرداخت‌شده"
          value={toPersianDigits(kpis.orderCount)}
          delta={{ value: kpis.orderChange }}
          hint="نسبت به بازه قبل"
          icon={<ShoppingCart className="size-4" aria-hidden />}
        />
        <StatTile
          label="میانگین ارزش سفارش"
          value={formatCompactPrice(kpis.averageOrderValue)}
          hint={rangeLabel}
          icon={<Package className="size-4" aria-hidden />}
        />
        <StatTile
          label="مشتریان جدید"
          value={toPersianDigits(kpis.newCustomers)}
          hint={`از مجموع ${toPersianDigits(kpis.customerCount)} مشتری`}
          icon={<Users className="size-4" aria-hidden />}
        />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <h2 className="mb-1 font-bold text-fg">روند درآمد</h2>
          <p className="mb-4 text-xs text-fg-muted">فروش پرداخت‌شده به تفکیک روز (تومان)</p>
          <TrendChart points={revenueSeries} title="روند درآمد روزانه" />
        </Card>

        <Card>
          <h2 className="mb-1 font-bold text-fg">تعداد سفارش</h2>
          <p className="mb-4 text-xs text-fg-muted">سفارش‌های پرداخت‌شده به تفکیک روز</p>
          <BarChart points={orderSeries} title="تعداد سفارش به تفکیک روز" />
        </Card>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <Card>
          <h2 className="mb-1 font-bold text-fg">سهم دسته‌بندی‌ها از فروش</h2>
          <p className="mb-4 text-xs text-fg-muted">درآمد {rangeLabel}</p>
          {revenueByCategory.length === 0 ? (
            <p className="py-8 text-center text-sm text-fg-muted">
              در این بازه فروشی ثبت نشده است.
            </p>
          ) : (
            <RankedBarChart
              points={revenueByCategory}
              title="سهم هر دسته‌بندی از درآمد"
              format="compactPrice"
              showShare
            />
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-fg">پرفروش‌ترین محصولات</h2>
              <p className="mt-1 text-xs text-fg-muted">بر اساس تعداد فروش در بازه</p>
            </div>
            <Link href="/admin/reports" className="inline-flex min-h-9 items-center gap-1 text-sm text-primary hover:underline dark:text-[color:var(--primary-soft-fg)]">
              گزارش کامل
              <ArrowLeft className="size-3.5" aria-hidden />
            </Link>
          </div>
          {bestSellers.length === 0 ? (
            <p className="py-8 text-center text-sm text-fg-muted">
              در این بازه فروشی ثبت نشده است.
            </p>
          ) : (
            <RankedBarChart
              points={bestSellers.map((p) => ({ label: p.label, value: p.value }))}
              title="پرفروش‌ترین محصولات بر اساس تعداد"
              format="count"
            />
          )}
        </Card>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {/* Low stock — the thing an operator actually needs to act on. */}
        <Card padded={false}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
            <h2 className="flex items-center gap-2 font-bold text-fg">
              <AlertTriangle className="size-4 text-warning" aria-hidden />
              هشدار موجودی کم
            </h2>
            <Link href="/admin/inventory" className="inline-flex min-h-9 items-center gap-1 text-sm text-primary hover:underline dark:text-[color:var(--primary-soft-fg)]">
              مدیریت انبار
              <ArrowLeft className="size-3.5" aria-hidden />
            </Link>
          </div>

          <p className="border-b border-border bg-warning-soft px-4 py-2 text-xs text-fg">
            {toPersianDigits(inventory.lowStockCount)} تنوع کالا کمتر از ۳ عدد موجودی دارند و{" "}
            {toPersianDigits(inventory.outOfStockCount)} تنوع کاملاً ناموجود است.
          </p>

          {lowStock.length === 0 ? (
            <p className="p-6 text-center text-sm text-fg-muted">موجودی همه تنوع‌ها مناسب است.</p>
          ) : (
            <ul className="divide-y divide-border">
              {lowStock.map((variant) => (
                <li key={variant.variantId} className="flex items-start gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-fg">{variant.productName}</p>
                    <p className="tnum mt-0.5 flex flex-wrap gap-x-2 text-xs text-fg-subtle">
                      <span dir="ltr">{variant.sku}</span>
                      <span>{variant.colorName} / {toPersianDigits(variant.size)}</span>
                    </p>
                  </div>
                  <Badge tone={variant.stock <= 1 ? "danger" : "warning"} size="sm" className="tnum shrink-0">
                    {toPersianDigits(variant.stock)} عدد
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Orders needing attention */}
        <Card padded={false}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
            <h2 className="font-bold text-fg">سفارش‌های در انتظار اقدام</h2>
            <Link href="/admin/orders" className="inline-flex min-h-9 items-center gap-1 text-sm text-primary hover:underline dark:text-[color:var(--primary-soft-fg)]">
              همه سفارش‌ها
              <ArrowLeft className="size-3.5" aria-hidden />
            </Link>
          </div>

          {pendingOrders.length === 0 ? (
            <EmptyState
              className="border-0"
              title="سفارشی در انتظار اقدام نیست"
              description="هر سفارش تازه اینجا نمایش داده می‌شود."
            />
          ) : (
            <>
              <ul className="divide-y divide-border">
                {pendingOrders.map((order) => (
                  <li key={order.id}>
                    <Link href={`/admin/orders/${order.number}`} className="flex flex-wrap items-center justify-between gap-3 p-3 hover:bg-surface-2">
                      <div className="min-w-0">
                        <p className="tnum break-token text-sm font-medium text-fg" dir="ltr">{order.number}</p>
                        <p className="mt-0.5 text-xs text-fg-subtle">
                          {order.shipRecipientFirstName} {order.shipRecipientLastName}، {formatDate(order.createdAt.toISOString())}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <PriceInline value={order.payableOnline} className="text-sm" />
                        <OrderStatusBadge status={order.status} size="sm" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>

              <p className="border-t border-border p-3 text-xs text-fg-subtle">
                ارزش کل سفارش‌های در انتظار:{" "}
                <span className="tnum font-medium text-fg">
                  {formatPrice(pendingOrders.reduce((n, o) => n + o.payableOnline, 0))}
                </span>
              </p>
            </>
          )}
        </Card>
      </div>

      {/* Recent activity across both online and manual orders. */}
      <Card className="mt-5" padded={false}>
        <h2 className="border-b border-border p-4 font-bold text-fg">آخرین سفارش‌ها</h2>
        {recentOrders.length === 0 ? (
          <EmptyState className="border-0" title="هنوز سفارشی ثبت نشده است" />
        ) : (
          <ul className="divide-y divide-border">
            {recentOrders.map((order) => (
              <li key={order.id}>
                <Link href={`/admin/orders/${order.number}`} className="flex flex-wrap items-center justify-between gap-3 p-3 hover:bg-surface-2">
                  <div className="min-w-0">
                    <p className="tnum break-token text-sm font-medium text-fg" dir="ltr">{order.number}</p>
                    <p className="mt-0.5 text-xs text-fg-subtle">
                      {order.customerName}، {formatDate(order.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {order.source === "manual" && (
                      <Badge tone="neutral" size="sm">ثبت دستی</Badge>
                    )}
                    <PriceInline value={order.total} className="text-sm" />
                    <OrderStatusBadge status={order.status} size="sm" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
