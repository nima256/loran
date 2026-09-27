import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, FileText, MessageSquare, Package } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Feedback";
import { siteConfig } from "@/lib/site-config";
import { toPersianDigits } from "@/lib/format";

export const metadata: Metadata = { title: "پرداخت موفق", robots: { index: false } };

export default async function PaymentSuccessPage({
  searchParams,
}: { searchParams: Promise<{ order?: string; ref?: string }> }) {
  const { order = "LRN-000000-0000", ref = "۷۳۴۵۹۲۱۸" } = await searchParams;

  return (
    <div className="container-narrow py-12">
      <div className="rounded-xl border border-success/30 bg-surface p-6 text-center sm:p-10">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-success-soft text-success">
          <CheckCircle2 className="size-9" aria-hidden />
        </span>
        <h1 className="mt-5 text-2xl font-bold text-fg">سفارش شما با موفقیت ثبت شد</h1>
        <p className="mt-3 text-sm leading-8 text-fg-muted">
          از خرید شما ممنونیم. سفارش به انبار لوران ارسال شد و به‌زودی آماده‌سازی آن شروع می‌شود.
        </p>

        <dl className="mx-auto mt-6 grid max-w-md gap-3 text-start sm:grid-cols-2">
          <div className="rounded-lg bg-surface-2 p-3">
            <dt className="text-xs text-fg-subtle">شماره سفارش</dt>
            <dd className="tnum break-token mt-1 font-bold text-fg" dir="ltr">{order}</dd>
          </div>
          <div className="rounded-lg bg-surface-2 p-3">
            <dt className="text-xs text-fg-subtle">کد رهگیری پرداخت</dt>
            <dd className="tnum break-token mt-1 font-bold text-fg" dir="ltr">{toPersianDigits(ref)}</dd>
          </div>
        </dl>

        <Alert tone="warning" className="mt-6 text-start" title="کرایه ارسال هنگام تحویل">
          {siteConfig.commerce.shippingNoticeShort} مبلغی که پرداخت کردید فقط بابت کالاهای سفارش بود.
        </Alert>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <ButtonLink href="/account/orders" icon={<Package className="size-4" aria-hidden />}>
            پیگیری سفارش
          </ButtonLink>
          <ButtonLink href="/shop" variant="secondary">ادامه خرید</ButtonLink>
        </div>

        <div className="mt-8 grid gap-3 border-t border-border pt-6 text-start sm:grid-cols-3">
          {[
            { icon: MessageSquare, title: "پیامک وضعیت", body: "هر تغییر وضعیت سفارش برایتان پیامک می‌شود." },
            { icon: Package, title: "آماده‌سازی", body: "سفارش طی یک روز کاری بسته‌بندی می‌شود." },
            { icon: FileText, title: "فاکتور", body: "فاکتور سفارش در حساب کاربری شما در دسترس است." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-2.5">
              <Icon className="mt-0.5 size-4 shrink-0 text-fg-subtle" aria-hidden />
              <div>
                <p className="text-sm font-medium text-fg">{title}</p>
                <p className="mt-0.5 text-xs leading-6 text-fg-muted">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-fg-muted">
        سؤالی دارید؟{" "}
        <Link href="/contact" className="text-primary hover:underline dark:text-[color:var(--primary-soft-fg)]">
          با پشتیبانی لوران تماس بگیرید
        </Link>
      </p>
    </div>
  );
}
