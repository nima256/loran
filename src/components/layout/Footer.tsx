import Link from "next/link";
import { Instagram, MapPin, Phone, Send } from "lucide-react";
import { Logo } from "./Logo";
import { NewsletterForm } from "./Newsletter";
import { footerNav } from "@/lib/navigation";
import { siteConfig } from "@/lib/site-config";
import { toPersianDigits } from "@/lib/format";

const SOCIAL_ICONS: Record<string, typeof Instagram> = {
  instagram: Instagram,
  instagram2: Instagram,
  telegram: Send,
};

export function Footer() {
  const year = new Intl.DateTimeFormat("fa-IR", { year: "numeric" }).format(new Date());

  return (
    <footer className="no-print mt-16 border-t border-border bg-surface-3 dark:bg-surface">
      <div className="container-page py-10 sm:py-12">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_2fr]">
          {/* Brand + newsletter */}
          <div className="max-w-md">
            <Logo size="md" />
            <p className="mt-4 text-sm leading-7 text-fg-muted">
              لوران، فروشگاه کفش در یزد. از فروش حضوری در پاساژ ستاره شروع کردیم و حالا به سراسر ایران ارسال می‌کنیم.
            </p>
            <NewsletterForm className="mt-6" />
          </div>

          {/* Link columns */}
          <div className="grid gap-8 sm:grid-cols-3">
            {footerNav.map((column) => (
              <nav key={column.title} aria-label={column.title}>
                <h3 className="text-sm font-bold text-fg">{column.title}</h3>
                <ul className="mt-3 space-y-1">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="inline-flex min-h-9 items-center text-sm text-fg-muted transition-colors hover:text-primary dark:hover:text-[color:var(--primary-soft-fg)]"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        {/* Contact strip — every value here comes from site-config.ts */}
        <div className="mt-10 grid gap-4 border-t border-border pt-8 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex items-start gap-3">
            <Phone className="mt-0.5 size-4 shrink-0 text-fg-subtle" aria-hidden />
            <div>
              <p className="text-sm font-medium text-fg">پشتیبانی</p>
              <a href={`tel:${siteConfig.contact.supportPhoneRaw}`} className="tnum inline-flex min-h-8 items-center text-sm text-fg-muted hover:text-fg" dir="ltr">
                {siteConfig.contact.supportPhone}
              </a>
              <p className="text-xs text-fg-subtle">{siteConfig.contact.workingHours}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 size-4 shrink-0 text-fg-subtle" aria-hidden />
            <div>
              <p className="text-sm font-medium text-fg">فروشگاه حضوری</p>
              <p className="text-sm leading-6 text-fg-muted">{siteConfig.stores[0].address}</p>
              <Link href="/contact#stores" className="inline-flex min-h-8 items-center text-xs text-primary hover:underline dark:text-[color:var(--primary-soft-fg)]">
                دیدن همه شعبه‌ها روی نقشه
              </Link>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Instagram className="mt-0.5 size-4 shrink-0 text-fg-subtle" aria-hidden />
            <div>
              <p className="text-sm font-medium text-fg">ما را دنبال کنید</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {siteConfig.social
                  .filter((s) => s.url)
                  .map((social) => {
                    const Icon = SOCIAL_ICONS[social.id] ?? Instagram;
                    return (
                      <a
                        key={social.id}
                        href={social.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${social.label} لوران ${social.handle}`}
                        className="grid size-10 place-items-center rounded-md border border-border bg-surface text-fg-muted transition-colors hover:border-primary hover:text-primary dark:hover:text-[color:var(--primary-soft-fg)]"
                      >
                        <Icon className="size-4" aria-hidden />
                      </a>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col-reverse items-center justify-between gap-4 border-t border-border pt-6 sm:flex-row">
          <p className="text-center text-xs leading-6 text-fg-subtle sm:text-start">
            © {toPersianDigits(year)} {siteConfig.legalName}. تمام حقوق محفوظ است.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <Link href="/terms" className="inline-flex min-h-8 items-center text-xs text-fg-muted hover:text-fg">قوانین و مقررات</Link>
            <Link href="/privacy" className="inline-flex min-h-8 items-center text-xs text-fg-muted hover:text-fg">حریم خصوصی</Link>
            {/* Placeholder for the e-namad / enamad trust badge the shop will receive. */}
            <span className="grid h-12 w-16 place-items-center rounded-md border border-dashed border-border text-[0.625rem] leading-tight text-fg-subtle">
              نماد
              <br />
              اعتماد
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
