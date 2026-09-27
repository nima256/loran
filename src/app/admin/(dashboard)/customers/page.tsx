import { Suspense } from "react";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import {
  AdminFilterChips,
  AdminPagination,
  AdminResultCount,
  AdminSearch,
} from "@/components/admin/AdminTableControls";
import { NewCustomerButton } from "@/components/admin/CustomerForm";
import { Card, DataTable } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { PriceInline } from "@/components/ui/Price";
import {
  listAdminCustomers,
  type AdminCustomerListItem,
} from "@/server/services/admin-customers";
import { customerFilterSchema } from "@/server/schemas/admin";
import { formatDate, formatPhone, toPersianDigits } from "@/lib/format";

/** Admin customers — server-side paginated and searchable. */

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") flat[key] = value;
  }

  const filters = customerFilterSchema.parse(flat);
  const result = await listAdminCustomers(filters);

  return (
    <>
      <AdminPageHeader
        title="مشتریان"
        description={`${toPersianDigits(result.total)} مشتری`}
        actions={<NewCustomerButton />}
      />

      <Card className="mb-4 space-y-3">
        <Suspense fallback={<div className="skeleton h-11 rounded-md" />}>
          <AdminSearch placeholder="نام، شماره موبایل یا ایمیل" />
        </Suspense>
        <Suspense fallback={null}>
          <AdminFilterChips
            param="status"
            options={[
              { value: "", label: "همه" },
              { value: "active", label: "فعال" },
              { value: "blocked", label: "مسدود" },
            ]}
          />
        </Suspense>
        <Suspense fallback={null}>
          <AdminFilterChips
            param="sort"
            options={[
              { value: "", label: "جدیدترین" },
              { value: "orders", label: "بیشترین سفارش" },
              { value: "spend", label: "بیشترین خرید" },
            ]}
          />
        </Suspense>
      </Card>

      <div className="mb-3">
        <AdminResultCount
          page={result.page}
          pageSize={result.pageSize}
          total={result.total}
          noun="مشتری"
        />
      </div>

      <DataTable<AdminCustomerListItem>
        rows={result.items}
        getKey={(customer) => customer.id}
        empty={
          <EmptyState
            title="مشتری‌ای با این فیلترها نیست"
            description="عبارت جست‌وجو را تغییر دهید یا مشتری تازه‌ای ثبت کنید."
            action={<ButtonLink href="/admin/customers" variant="secondary">نمایش همه مشتریان</ButtonLink>}
          />
        }
        renderCard={(customer) => (
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/admin/customers/${customer.id}`} className="font-medium text-fg hover:text-primary dark:hover:text-[color:var(--primary-soft-fg)]">
                  {customer.fullName}
                </Link>
                <p className="tnum mt-1 text-xs text-fg-muted" dir="ltr">
                  {formatPhone(customer.phone)}
                </p>
              </div>
              {customer.blocked && <Badge tone="danger" size="sm">مسدود</Badge>}
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
              <span className="tnum text-xs text-fg-muted">
                {toPersianDigits(customer.orderCount)} سفارش
              </span>
              <PriceInline value={customer.totalSpent} className="text-sm" />
            </div>
          </Card>
        )}
        columns={[
          {
            key: "name",
            header: "مشتری",
            cell: (customer) => (
              <div className="min-w-0">
                <Link href={`/admin/customers/${customer.id}`} className="font-medium text-fg hover:text-primary dark:hover:text-[color:var(--primary-soft-fg)]">
                  {customer.fullName}
                </Link>
                {customer.createdByAdmin && (
                  <Badge tone="neutral" size="sm" className="ms-2">ثبت دستی</Badge>
                )}
              </div>
            ),
          },
          {
            key: "phone",
            header: "موبایل",
            cell: (customer) => (
              <span className="tnum text-fg-muted" dir="ltr">{formatPhone(customer.phone)}</span>
            ),
          },
          {
            key: "email",
            header: "ایمیل",
            hideOn: "md",
            cell: (customer) => (
              <span className="text-fg-muted" dir="ltr">{customer.email ?? "—"}</span>
            ),
          },
          {
            key: "orders",
            header: "سفارش‌ها",
            align: "center",
            cell: (customer) => (
              <span className="tnum text-fg-muted">{toPersianDigits(customer.orderCount)}</span>
            ),
          },
          {
            key: "spent",
            header: "مجموع خرید",
            align: "end",
            cell: (customer) => <PriceInline value={customer.totalSpent} className="text-sm" />,
          },
          {
            key: "joined",
            header: "عضویت",
            hideOn: "md",
            cell: (customer) => (
              <span className="text-fg-muted">{formatDate(customer.createdAt)}</span>
            ),
          },
          {
            key: "status",
            header: "وضعیت",
            cell: (customer) =>
              customer.blocked ? (
                <Badge tone="danger" size="sm">مسدود</Badge>
              ) : (
                <Badge tone="success" size="sm">فعال</Badge>
              ),
          },
          {
            key: "actions",
            header: "عملیات",
            align: "end",
            cell: (customer) => (
              <Link
                href={`/admin/customers/${customer.id}`}
                className="inline-flex h-9 items-center rounded-md border border-border px-2.5 text-xs text-fg-muted hover:text-fg"
              >
                مشاهده
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
