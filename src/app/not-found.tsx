import Link from "next/link";
import { Home, Search, ShoppingBag } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Logo } from "@/components/layout/Logo";
import { mainNav } from "@/lib/navigation";

/**
 * 404. Self-contained (the root layout carries no chrome) but still recognisably
 * Loran, and every path out of here is a real destination.
 */
export default function NotFound() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-16 text-center">
      <div aria-hidden className="brand-grid absolute inset-0 opacity-40" />

      <div className="relative">
        <Link href="/" className="inline-flex rounded-md" aria-label="لوران — صفحه اصلی">
          <Logo size="lg" href={null} />
        </Link>

        <p className="tnum mt-10 text-6xl font-bold text-primary sm:text-7xl dark:text-[color:var(--primary-soft-fg)]">۴۰۴</p>
        <h1 className="mt-4 text-xl font-bold text-fg sm:text-2xl">این صفحه پیدا نشد</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-8 text-fg-muted">
          شاید آدرس را اشتباه وارد کرده‌اید یا این محصول دیگر در فروشگاه موجود نیست.
          از اینجا می‌توانید ادامه دهید:
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <ButtonLink href="/" icon={<Home className="size-4" aria-hidden />}>صفحه اصلی</ButtonLink>
          <ButtonLink href="/shop" variant="secondary" icon={<ShoppingBag className="size-4" aria-hidden />}>
            فروشگاه
          </ButtonLink>
          <ButtonLink href="/search" variant="ghost" icon={<Search className="size-4" aria-hidden />}>
            جست‌وجو
          </ButtonLink>
        </div>

        <nav aria-label="پیوندهای مفید" className="mt-10">
          <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {mainNav.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="inline-flex min-h-9 items-center text-sm text-fg-muted hover:text-primary dark:hover:text-[color:var(--primary-soft-fg)]">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
