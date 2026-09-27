import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import {
  AdminFilterChips,
  AdminPagination,
  AdminResultCount,
  AdminSearch,
} from "@/components/admin/AdminTableControls";
import { Card, DataTable } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { PriceInline } from "@/components/ui/Price";
import { OrderStatusBadge } from "@/components/account/OrderStatus";
import { listAdminOrders, type AdminOrderListItem } from "@/server/services/order-queries";
import { prisma } from "@/server/lib/prisma";
import { orderFilterSchema } from "@/server/schemas/admin";
import { formatDate, toPersianDigits } from "@/lib/format";

/**
 * Admin orders.
 *
 * Paginated, searched and filtered on the server — the browser never receives
 * more than one page of rows, so the table stays usable as the shop grows.
 */

export const dynamic = "force-dynamic";

const STATUS_FILTERS = [
  { value: "", label: "همه" },
  { value: "awaiting_payment", label: "در انتظار پرداخت" },
  { value: "preparing", label: "آماده‌سازی" },
  { value: "packaged", label: "بسته‌بندی‌شده" },
  { value: "shipped", label: "ارسال‌شده" },
  { value: "delivered", label: "تحویل‌شده" },
  { value: "cancelled", label: "لغو شده" },
];

const SOURCE_FILTERS = [
  { value: "", label: "همه منابع" },
  { value: "online", label: "ثبت آنلاین" },
  { value: "manual", label: "ثبت دستی" },
];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") flat[key] = value;
  }

  const filters = orderFilterSchema.parse(flat);
  const [result, statusCounts] = await Promise.all([
    listAdminOrders(filters),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const countByStatus = new Map(statusCounts.map((row) => [row.status as string, row._count._all]));
  const totalOrders = statusCounts.reduce((n, row) => n + row._count._all, 0);

  return (
    <>
      <AdminPageHeader
        title="سفارش‌ها"
        description={`${toPersianDigits(totalOrders)} سفارش ثبت‌شده`}
        actions={
          <ButtonLink href="/admin/orders/new" icon={<Plus className="size-4" aria-hidden />}>
            ثبت سفارش دستی
          </ButtonLink>
        }
      />

      <Card className="mb-4 space-y-3">
        <Suspense fallback={<div className="skeleton h-11 rounded-md" />}>
          <AdminSearch placeholder="شماره سفارش، نام مشتری، موبایل یا کد رهگیری" />
        </Suspense>
        <Suspense fallback={null}>
          <AdminFilterChips
            param="status"
            options={STATUS_FILTERS.map((f) => ({
              ...f,
              count: f.value ? countByStatus.get(f.value) ?? 0 : totalOrders,
            }))}
          />
        </Suspense>
        <Suspense fallback={null}>
          <AdminFilterChips param="source" options={SOURCE_FILTERS} />
        </Suspense>
      </Card>

      <div className="mb-3">
        <AdminResultCount
          page={result.page}
          pageSize={result.pageSize}
          total={result.total}
          noun="سفارش"
        />
      </div>

      <DataTable<AdminOrderListItem>
        rows={result.items}
        getKey={(order) => order.id}
        empty={
          <EmptyState
            title="سفارشی با این فیلترها نیست"
            description="فیلتر یا عبارت جست‌وجو را تغییر دهید."
            action={<ButtonLink href="/admin/orders" variant="secondary">نمایش همه سفارش‌ها</ButtonLink>}
          />
        }
        renderCard={(order) => (
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/admin/orders/${order.number}`} className="tnum break-token font-medium text-fg hover:text-primary dark:hover:text-[color:var(--primary-soft-fg)]" dir="ltr">
                  {order.number}
                </Link>
                <p className="mt-1 text-xs text-fg-muted">{order.customerName}</p>
                <p className="mt-0.5 text-xs text-fg-subtle">{formatDate(order.createdAt)}</p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <OrderStatusBadge status={order.status} size="sm" />
                {order.source === "manual" && <Badge tone="neutral" size="sm">دستی</Badge>}
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
              <span className="tnum text-xs text-fg-muted">{toPersianDigits(order.itemCount)} کالا</span>
              <PriceInline value={order.payableOnline} className="text-sm" />
            </div>
          </Card>
        )}
        columns={[
          {
            key: "number",
            header: "شماره سفارش",
            cell: (order) => (
              <div className="flex items-center gap-2">
                <Link href={`/admin/orders/${order.number}`} className="tnum break-token font-medium text-fg hover:text-primary dark:hover:text-[color:var(--primary-soft-fg)]" dir="ltr">
                  {order.number}
                </Link>
                {order.source === "manual" && <Badge tone="neutral" size="sm">دستی</Badge>}
              </div>
            ),
          },
          {
            key: "customer",
            header: "مشتری",
            cell: (order) => (
              <div>
                <p className="text-fg">{order.customerName}</p>
                <p className="tnum text-xs text-fg-subtle" dir="ltr">{order.customerPhone}</p>
              </div>
            ),
          },
          {
            key: "date",
            header: "تاریخ",
            cell: (order) => <span className="text-fg-muted">{formatDate(order.createdAt)}</span>,
          },
          {
            key: "items",
            header: "اقلام",
            align: "center",
            cell: (order) => <span className="tnum text-fg-muted">{toPersianDigits(order.itemCount)}</span>,
          },
          {
            key: "total",
            header: "مبلغ",
            align: "end",
            cell: (order) => <PriceInline value={order.payableOnline} className="text-sm" />,
          },
          {
            key: "tracking",
            header: "کد رهگیری",
            hideOn: "md",
            cell: (order) =>
              order.trackingCode ? (
                <span className="tnum break-token text-xs text-fg-muted" dir="ltr">{order.trackingCode}</span>
              ) : (
                <span className="text-xs text-fg-subtle">—</span>
              ),
          },
          { key: "status", header: "وضعیت", cell: (order) => <OrderStatusBadge status={order.status} size="sm" /> },
          {
            key: "actions",
            header: "عملیات",
            align: "end",
            cell: (order) => (
              <Link
                href={`/admin/orders/${order.number}`}
                className="inline-flex h-9 items-center rounded-md border border-border px-2.5 text-xs text-fg-muted hover:text-fg"
              >
                مدیریت
              </Link>
            ),
          },
        ]}
      />

      <Suspense fallback={null}>
        <AdminPagination page={result.page} totalPages={result.totalPages} className="mt-6" />
      </Suspense>
    </>
  );
}
