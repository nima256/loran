import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Wrench } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "به‌روزرسانی سایت",
  robots: { index: false, follow: false },
};

/**
 * Maintenance page.
 *
 * ▶ To use it: point the edge/middleware at `/maintenance` during a deploy
 *   window. It intentionally keeps the contact channels live so customers with
 *   an open order can still reach the shop.
 */
export default function MaintenancePage() {
  return (
    <div className="relative flex min-h-[70vh] flex-col items-center justify-center px-4 py-16 text-center">
      <div aria-hidden className="brand-grid absolute inset-0 opacity-40" />

      <div className="relative">
        <Logo size="lg" href={null} />

        <span className="mx-auto mt-10 grid size-16 place-items-center rounded-full bg-primary-soft text-primary-soft-fg">
          <Wrench className="size-8" aria-hidden />
        </span>

        <h1 className="mt-5 text-xl font-bold text-fg sm:text-2xl">فروشگاه موقتاً در دسترس نیست</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-8 text-fg-muted">
          در حال به‌روزرسانی فروشگاه هستیم تا تجربه خرید بهتری داشته باشید. خیلی زود برمی‌گردیم.
        </p>

        <p className="mt-5 inline-flex items-center gap-2 rounded-md bg-surface-2 px-4 py-2 text-sm text-fg-muted">
          <Clock className="size-4" aria-hidden />
          زمان تقریبی بازگشت: کمتر از یک ساعت
        </p>

        <div className="mt-8 border-t border-border pt-6 text-sm text-fg-muted">
          <p>سفارش در جریان دارید؟ با ما تماس بگیرید:</p>
          <a
            href={`tel:${siteConfig.contact.supportPhoneRaw}`}
            className="tnum mt-2 inline-flex min-h-11 items-center text-base font-bold text-primary hover:underline dark:text-[color:var(--primary-soft-fg)]"
            dir="ltr"
          >
            {siteConfig.contact.supportPhone}
          </a>
          <p className="mt-3">
            یا در{" "}
            {siteConfig.social.filter((s) => s.url).slice(0, 1).map((s) => (
              <Link key={s.id} href={s.url} className="text-primary hover:underline dark:text-[color:var(--primary-soft-fg)]">
                اینستاگرام لوران
              </Link>
            ))}{" "}
            پیام بدهید.
          </p>
        </div>
      </div>
    </div>
  );
}
