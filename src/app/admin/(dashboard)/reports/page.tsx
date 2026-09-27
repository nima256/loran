import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, Package, ShoppingCart, TrendingUp, Users } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { BarChart, RankedBarChart, StatTile, TrendChart } from "@/components/admin/Charts";
import { DateRangePicker } from "@/components/admin/DateRangePicker";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PriceInline } from "@/components/ui/Price";
import {
  getBestSellers,
  getCouponPerformance,
  getDashboardKpis,
  getOrderSeries,
  getOrderStatusDistribution,
  getRevenueByCategory,
  getRevenueSeries,
  parseRange,
} from "@/server/services/analytics";
import { prisma } from "@/server/lib/prisma";
import { ORDER_STATUS_LABELS } from "@/lib/orders";
import { formatCompactPrice, formatAmount, toPersianDigits } from "@/lib/format";
import type { AnyOrderStatus } from "@/types";

/**
 * Admin reports.
 *
 * Every figure is a query over the selected range. Revenue counts only orders
 * that were paid for and not since cancelled or refunded, and uses the amount
 * actually collected online rather than the grand total — postpaid Tipax
 * shipping is the courier's money, not Loran's.
 */

export const dynamic = "force-dynamic";

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const days = Number(params.days ?? 30);
  const range = parseRange(params.from, params.to, Number.isFinite(days) ? days : 30);

  const [
    kpis, revenueSeries, orderSeries, bestSellers,
    revenueByCategory, statusDistribution, coupons, sourceSplit,
  ] = await Promise.all([
    getDashboardKpis(range),
    getRevenueSeries(range),
    getOrderSeries(range),
    getBestSellers(range, 10),
    getRevenueByCategory(range),
    getOrderStatusDistribution(range),
    getCouponPerformance(10),
    prisma.order.groupBy({
      by: ["source"],
      where: {
        paymentStatus: "paid",
        createdAt: { gte: range.from, lte: range.to },
      },
      _count: { _all: true },
      _sum: { payableOnline: true },
    }),
  ]);

  const rangeDays = Math.max(
    1,
    Math.round((range.to.getTime() - range.from.getTime()) / 86_400_000)
  );

  return (
    <>
      <AdminPageHeader
        title="گزارش‌ها"
        description={`تحلیل فروش ${toPersianDigits(rangeDays)} روز گذشته`}
        actions={
          <Suspense fallback={null}>
            <DateRangePicker />
          </Suspense>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="درآمد"
          value={formatCompactPrice(kpis.revenue)}
          delta={{ value: kpis.revenueChange }}
          hint="نسبت به بازه قبل"
          icon={<TrendingUp className="size-4" aria-hidden />}
        />
        <StatTile
          label="سفارش پرداخت‌شده"
          value={toPersianDigits(kpis.orderCount)}
          delta={{ value: kpis.orderChange }}
          hint="نسبت به بازه قبل"
          icon={<ShoppingCart className="size-4" aria-hidden />}
        />
        <StatTile
          label="میانگین ارزش سفارش"
          value={formatCompactPrice(kpis.averageOrderValue)}
          icon={<Package className="size-4" aria-hidden />}
        />
        <StatTile
          label="مشتریان جدید"
          value={toPersianDigits(kpis.newCustomers)}
          hint={`از مجموع ${toPersianDigits(kpis.customerCount)}`}
          icon={<Users className="size-4" aria-hidden />}
        />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <h2 className="mb-1 font-bold text-fg">روند درآمد</h2>
          <p className="mb-4 text-xs text-fg-muted">مبلغ دریافتی آنلاین به تفکیک روز</p>
          <TrendChart points={revenueSeries} title="روند درآمد روزانه" />
        </Card>

        <Card>
          <h2 className="mb-1 font-bold text-fg">تعداد سفارش</h2>
          <p className="mb-4 text-xs text-fg-muted">سفارش‌های پرداخت‌شده</p>
          <BarChart points={orderSeries} title="تعداد سفارش روزانه" />
        </Card>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <Card>
          <h2 className="mb-1 font-bold text-fg">سهم دسته‌بندی‌ها</h2>
          <p className="mb-4 text-xs text-fg-muted">درآمد به تفکیک دسته‌بندی</p>
          {revenueByCategory.length === 0 ? (
            <p className="py-8 text-center text-sm text-fg-muted">در این بازه فروشی ثبت نشده است.</p>
          ) : (
            <RankedBarChart
              points={revenueByCategory}
              title="درآمد هر دسته‌بندی"
              format="compactPrice"
              showShare
            />
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-fg">پرفروش‌ترین محصولات</h2>
              <p className="mt-1 text-xs text-fg-muted">بر اساس تعداد فروش</p>
            </div>
            <Link href="/admin/products" className="inline-flex min-h-9 items-center gap-1 text-sm text-primary hover:underline dark:text-[color:var(--primary-soft-fg)]">
              محصولات
              <ArrowLeft className="size-3.5" aria-hidden />
            </Link>
          </div>
          {bestSellers.length === 0 ? (
            <p className="py-8 text-center text-sm text-fg-muted">در این بازه فروشی ثبت نشده است.</p>
          ) : (
            <RankedBarChart
              points={bestSellers.map((p) => ({ label: p.label, value: p.value }))}
              title="پرفروش‌ترین محصولات"
              format="count"
            />
          )}
        </Card>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <Card padded={false}>
          <h2 className="border-b border-border p-4 font-bold text-fg">توزیع وضعیت سفارش‌ها</h2>
          {statusDistribution.length === 0 ? (
            <p className="p-6 text-center text-sm text-fg-muted">سفارشی در این بازه ثبت نشده است.</p>
          ) : (
            <ul className="divide-y divide-border">
              {statusDistribution
                .sort((a, b) => b.value - a.value)
                .map((row) => (
                  <li key={row.status} className="flex items-center justify-between gap-3 p-3">
                    <span className="text-sm text-fg">
                      {ORDER_STATUS_LABELS[row.status as AnyOrderStatus] ?? row.status}
                    </span>
                    <span className="tnum text-sm font-medium text-fg-muted">
                      {toPersianDigits(row.value)}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </Card>

        <Card padded={false}>
          <h2 className="border-b border-border p-4 font-bold text-fg">
            سفارش‌های آنلاین و دستی
          </h2>
          <ul className="divide-y divide-border">
            {(["online", "manual"] as const).map((source) => {
              const row = sourceSplit.find((s) => s.source === source);
              return (
                <li key={source} className="flex items-center justify-between gap-3 p-3">
                  <span className="flex items-center gap-2 text-sm text-fg">
                    {source === "online" ? "ثبت آنلاین" : "ثبت دستی"}
                    {source === "manual" && <Badge tone="neutral" size="sm">پنل</Badge>}
                  </span>
                  <span className="flex items-center gap-4">
                    <span className="tnum text-xs text-fg-muted">
                      {toPersianDigits(row?._count._all ?? 0)} سفارش
                    </span>
                    <PriceInline value={row?._sum.payableOnline ?? 0} className="text-sm" />
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <Card className="mt-5" padded={false}>
        <h2 className="border-b border-border p-4 font-bold text-fg">عملکرد کدهای تخفیف</h2>
        {coupons.length === 0 ? (
          <p className="p-6 text-center text-sm text-fg-muted">کد تخفیفی تعریف نشده است.</p>
        ) : (
          <ul className="divide-y divide-border">
            {coupons.map((coupon) => (
              <li key={coupon.code} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="tnum font-medium text-fg" dir="ltr">{coupon.code}</p>
                  <p className="line-clamp-1 text-xs text-fg-muted">{coupon.description}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="tnum text-xs text-fg-muted">
                    {toPersianDigits(coupon.usageCount)} استفاده
                  </span>
                  <span className="tnum text-sm font-medium text-fg">
                    {formatAmount(coupon.totalDiscount)} تومان
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
