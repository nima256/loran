import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, MapPin } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { EditCustomerButton } from "@/components/admin/CustomerForm";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/Feedback";
import { PriceInline } from "@/components/ui/Price";
import { OrderStatusBadge } from "@/components/account/OrderStatus";
import { getAdminCustomer } from "@/server/services/admin-customers";
import { formatDate, formatPhone, toPersianDigits } from "@/lib/format";

/** Admin → Customers → one customer: profile, addresses and order history. */

export const dynamic = "force-dynamic";

export default async function AdminCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let customer;
  try {
    customer = await getAdminCustomer(id);
  } catch {
    notFound();
  }

  const fullName = [customer.firstName, customer.lastName].filter(Boolean).join(" ") || "بدون نام";

  return (
    <>
      <Link href="/admin/customers" className="mb-4 inline-flex min-h-9 items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowRight className="size-4" aria-hidden />
        بازگشت به مشتریان
      </Link>

      <AdminPageHeader
        title={fullName}
        description={`عضویت از ${formatDate(customer.createdAt)}`}
        actions={
          <EditCustomerButton
            customer={{
              id: customer.id,
              phone: customer.phone,
              firstName: customer.firstName ?? "",
              lastName: customer.lastName ?? "",
              email: customer.email ?? "",
              nationalId: customer.nationalId ?? "",
              note: customer.note ?? "",
              blocked: customer.blocked,
              smsNotifications: customer.smsNotifications,
            }}
          />
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr] xl:items-start">
        <div className="space-y-4">
          <Card>
            <h2 className="mb-3 font-bold text-fg">اطلاعات حساب</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-fg-muted">موبایل</dt>
                <dd className="tnum text-fg" dir="ltr">{formatPhone(customer.phone)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-fg-muted">ایمیل</dt>
                <dd className="text-fg" dir="ltr">{customer.email ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-fg-muted">وضعیت</dt>
                <dd>
                  {customer.blocked
                    ? <Badge tone="danger" size="sm">مسدود</Badge>
                    : <Badge tone="success" size="sm">فعال</Badge>}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-fg-muted">آخرین ورود</dt>
                <dd className="text-fg">
                  {customer.lastLoginAt ? formatDate(customer.lastLoginAt) : "هنوز وارد نشده"}
                </dd>
              </div>
              {customer.createdByAdmin && (
                <div className="flex justify-between gap-3">
                  <dt className="text-fg-muted">نحوه ثبت</dt>
                  <dd><Badge tone="neutral" size="sm">ثبت دستی توسط مدیر</Badge></dd>
                </div>
              )}
            </dl>

            {customer.note && (
              <p className="mt-4 rounded-md bg-surface-2 p-3 text-sm leading-7 text-fg-muted">
                {customer.note}
              </p>
            )}

            <p className="mt-4 border-t border-border pt-3 text-xs text-fg-subtle">
              ورود این مشتری با شماره موبایل و کد پیامکی انجام می‌شود. رمز عبوری وجود ندارد و از
              پنل هم قابل تعیین نیست.
            </p>
          </Card>

          <Card>
            <h2 className="mb-3 font-bold text-fg">خلاصه خرید</h2>
            <dl className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-md bg-surface-2 p-3">
                <dt className="text-xs text-fg-muted">سفارش</dt>
                <dd className="tnum mt-1 text-lg font-bold text-fg">
                  {toPersianDigits(customer.stats.orderCount)}
                </dd>
              </div>
              <div className="rounded-md bg-surface-2 p-3">
                <dt className="text-xs text-fg-muted">پرداخت‌شده</dt>
                <dd className="tnum mt-1 text-lg font-bold text-fg">
                  {toPersianDigits(customer.stats.paidOrderCount)}
                </dd>
              </div>
              <div className="rounded-md bg-surface-2 p-3">
                <dt className="text-xs text-fg-muted">مجموع خرید</dt>
                <dd className="mt-1 text-sm font-bold text-fg">
                  <PriceInline value={customer.stats.totalSpent} />
                </dd>
              </div>
            </dl>
          </Card>

          <Card>
            <h2 className="mb-3 flex items-center gap-2 font-bold text-fg">
              <MapPin className="size-4 text-fg-subtle" aria-hidden />
              آدرس‌ها ({toPersianDigits(customer.addresses.length)})
            </h2>
            {customer.addresses.length === 0 ? (
              <p className="text-sm text-fg-muted">آدرسی ثبت نشده است.</p>
            ) : (
              <ul className="space-y-3">
                {customer.addresses.map((address) => (
                  <li key={address.id} className="rounded-md border border-border p-3 text-sm">
                    <p className="flex items-center gap-2 font-medium text-fg">
                      {address.title}
                      {address.isDefault && <Badge tone="info" size="sm">پیش‌فرض</Badge>}
                    </p>
                    <p className="mt-1 leading-7 text-fg-muted">
                      {address.province}، {address.city}، {address.addressLine}
                    </p>
                    <p className="tnum mt-1 text-xs text-fg-subtle">
                      {address.recipient} — <span dir="ltr">{formatPhone(address.phone)}</span> — کد
                      پستی {toPersianDigits(address.postalCode)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card padded={false}>
          <h2 className="border-b border-border p-4 font-bold text-fg">
            سفارش‌ها ({toPersianDigits(customer.orders.length)})
          </h2>
          {customer.orders.length === 0 ? (
            <EmptyState className="border-0" title="این مشتری هنوز سفارشی ثبت نکرده است" />
          ) : (
            <ul className="divide-y divide-border">
              {customer.orders.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/admin/orders/${order.number}`}
                    className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-surface-2"
                  >
                    <div className="min-w-0">
                      <p className="tnum break-token text-sm font-medium text-fg" dir="ltr">
                        {order.number}
                      </p>
                      <p className="mt-0.5 text-xs text-fg-subtle">{formatDate(order.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {order.source === "manual" && <Badge tone="neutral" size="sm">دستی</Badge>}
                      <PriceInline value={order.total} className="text-sm" />
                      <OrderStatusBadge status={order.status} size="sm" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
