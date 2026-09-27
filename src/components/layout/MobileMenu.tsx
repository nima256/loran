"use client";

import Link from "next/link";
import { ChevronLeft, LogOut, Phone, User } from "lucide-react";
import { Drawer } from "@/components/ui/Overlay";
import { Logo } from "./Logo";
import { ThemeSegmented } from "./ThemeToggle";
import { genderNav, mainNav } from "@/lib/navigation";
import { useCatalog } from "@/store/CatalogProvider";
import { useAuth } from "@/store/AuthProvider";
import { siteConfig } from "@/lib/site-config";

/** Mobile navigation drawer — opens from the inline-start (right) edge in RTL. */
export function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { isAuthenticated, user, logout } = useAuth();
  const { categoryLinks } = useCatalog();

  const Item = ({ href, children }: { href: string; children: React.ReactNode }) => (
    <Link
      href={href}
      onClick={onClose}
      className="flex min-h-12 items-center justify-between gap-3 rounded-md px-3 text-sm text-fg transition-colors hover:bg-surface-2"
    >
      <span>{children}</span>
      <ChevronLeft className="size-4 shrink-0 text-fg-subtle" aria-hidden />
    </Link>
  );

  return (
    <Drawer open={open} onClose={onClose} side="start" title="منوی لوران">
      <div className="space-y-6 p-4">
        <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-3 p-3">
          <Logo size="sm" href="/" />
          <span className="text-xs text-fg-muted">{siteConfig.domain}</span>
        </div>

        {isAuthenticated ? (
          <Link href="/account" onClick={onClose} className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-surface-2">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-soft-fg">
              <User className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-fg">
                {user?.firstName ? `${user.firstName} ${user.lastName ?? ""}` : "حساب کاربری من"}
              </span>
              <span className="tnum block text-xs text-fg-muted">{user?.phone}</span>
            </span>
            <ChevronLeft className="size-4 text-fg-subtle" aria-hidden />
          </Link>
        ) : (
          <Link href="/auth/login" onClick={onClose} className="flex items-center gap-3 rounded-lg border border-primary-border bg-primary-soft p-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-fg">
              <User className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-fg">ورود یا ثبت‌نام</span>
              <span className="block text-xs text-fg-muted">برای ثبت سفارش و پیگیری خرید</span>
            </span>
            <ChevronLeft className="size-4 text-fg-subtle" aria-hidden />
          </Link>
        )}

        <nav aria-label="دسته‌بندی‌ها">
          <h3 className="mb-1 px-3 text-xs font-semibold text-fg-subtle">دسته‌بندی‌ها</h3>
          <div className="flex flex-col">
            {categoryLinks.map((c) => <Item key={c.href} href={c.href}>{c.label}</Item>)}
          </div>
        </nav>

        <nav aria-label="خرید بر اساس جنسیت">
          <h3 className="mb-2 px-3 text-xs font-semibold text-fg-subtle">خرید برای</h3>
          <div className="grid grid-cols-2 gap-2">
            {genderNav.map((g) => (
              <Link key={g.href} href={g.href} onClick={onClose}
                className="flex min-h-11 items-center justify-center rounded-md border border-border text-sm text-fg-muted hover:border-border-strong hover:text-fg">
                {g.label}
              </Link>
            ))}
          </div>
        </nav>

        <nav aria-label="صفحه‌های دیگر">
          <h3 className="mb-1 px-3 text-xs font-semibold text-fg-subtle">بیشتر</h3>
          <div className="flex flex-col">
            {mainNav.map((l) => <Item key={l.href} href={l.href}>{l.label}</Item>)}
          </div>
        </nav>

        <div className="space-y-4 rounded-lg border border-border p-3">
          <div>
            <h3 className="mb-2 text-xs font-semibold text-fg-subtle">حالت نمایش</h3>
            <ThemeSegmented />
          </div>
          <a href={`tel:${siteConfig.contact.supportPhoneRaw}`} className="flex min-h-11 items-center gap-2 text-sm text-fg-muted hover:text-fg">
            <Phone className="size-4" aria-hidden />
            <span className="tnum">{siteConfig.contact.supportPhone}</span>
          </a>
          {isAuthenticated && (
            <button
              type="button"
              onClick={() => { logout(); onClose(); }}
              className="flex min-h-11 w-full items-center gap-2 text-sm text-danger"
            >
              <LogOut className="size-4" aria-hidden />
              خروج از حساب
            </button>
          )}
        </div>
      </div>
    </Drawer>
  );
}
