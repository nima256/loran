import Link from "next/link";
import { ExternalLink, Info } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { PaymentManager, ShippingManager } from "@/components/admin/SettingsManager";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Feedback";
import { listPaymentSettings, listShippingMethodsForAdmin, listAuditLog } from "@/server/services/settings";
import { siteConfig } from "@/lib/site-config";
import { formatDateTime } from "@/lib/format";

/**
 * Store settings.
 *
 * Shipping methods and the business-level payment settings are database rows an
 * administrator edits here. Store identity still comes from `site-config.ts` —
 * it is deployment configuration, not something that should change from a
 * browser form, and it is shown read-only so the operator knows where it lives.
 */

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const [shipping, payments, audit] = await Promise.all([
    listShippingMethodsForAdmin(),
    listPaymentSettings(),
    listAuditLog({ page: 1, pageSize: 12 }),
  ]);

  return (
    <>
      <AdminPageHeader
        title="تنظیمات فروشگاه"
        description="ارسال، پرداخت و سابقه عملیات مدیریتی."
      />

      <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
        <div className="space-y-4">
          <ShippingManager methods={shipping} />
          <PaymentManager methods={payments} />
        </div>

        <div className="space-y-4">
          <Card>
            <h2 className="mb-1 font-bold text-fg">اطلاعات فروشگاه</h2>
            <p className="mb-4 text-xs text-fg-muted">
              این مقادیر در فایل پیکربندی پروژه تعریف شده‌اند و از پنل تغییر نمی‌کنند.
            </p>
            <dl className="space-y-2.5 text-sm">
              {[
                ["نام فروشگاه", siteConfig.name],
                ["نام رسمی (روی فاکتور)", siteConfig.legalName],
                ["دامنه", siteConfig.domain],
                ["تلفن پشتیبانی", siteConfig.contact.supportPhone],
                ["ایمیل پشتیبانی", siteConfig.contact.email],
                ["ساعات پاسخ‌گویی", siteConfig.contact.workingHours],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="text-fg-muted">{label}</dt>
                  <dd className="text-end text-fg">{value}</dd>
                </div>
              ))}
            </dl>
            <Alert tone="info" className="mt-4">
              برای تغییر این اطلاعات، فایل{" "}
              <code dir="ltr">src/lib/site-config.ts</code> را ویرایش و پروژه را دوباره منتشر کنید.
            </Alert>
          </Card>

          <Card padded={false}>
            <div className="flex items-center justify-between gap-3 border-b border-border p-4">
              <h2 className="font-bold text-fg">سابقه عملیات مدیریتی</h2>
              <Link
                href="/admin/settings/audit"
                className="inline-flex min-h-9 items-center gap-1 text-sm text-primary hover:underline dark:text-[color:var(--primary-soft-fg)]"
              >
                همه رکوردها
                <ExternalLink className="size-3.5" aria-hidden />
              </Link>
            </div>

            {audit.items.length === 0 ? (
              <p className="p-6 text-center text-sm text-fg-muted">
                هنوز عملیاتی ثبت نشده است.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {audit.items.map((entry) => (
                  <li key={entry.id} className="p-3">
                    <p className="text-sm text-fg">{entry.summary}</p>
                    <p className="tnum mt-0.5 flex flex-wrap gap-x-2 text-xs text-fg-subtle">
                      <span dir="ltr">{entry.action}</span>
                      <span>{formatDateTime(entry.createdAt)}</span>
                      {entry.adminEmail && <span dir="ltr">{entry.adminEmail}</span>}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            <p className="flex items-start gap-2 border-t border-border p-3 text-xs leading-6 text-fg-subtle">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              هر تغییر مهم در پنل (ورود، محصول، سفارش، موجودی، تخفیف، مشتری و…) با زمان و شناسه
              مدیر ثبت می‌شود.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
