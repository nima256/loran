"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import {
  BarChart3, Boxes, ExternalLink, LayoutDashboard, LogOut, Menu, MessageSquare, Package,
  RotateCcw, Settings, ShoppingCart, Palette, Star, Tags, TicketPercent, Users, X,
} from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "پیشخوان", href: "/admin", icon: LayoutDashboard, exact: true },
  { label: "سفارش‌ها", href: "/admin/orders", icon: ShoppingCart },
  { label: "محصولات", href: "/admin/products", icon: Package },
  { label: "دسته‌بندی‌ها", href: "/admin/categories", icon: Tags },
  { label: "موجودی انبار", href: "/admin/inventory", icon: Boxes },
  { label: "تخفیف و کمپین", href: "/admin/discounts", icon: TicketPercent },
  { label: "مشتریان", href: "/admin/customers", icon: Users },
  { label: "دیدگاه‌ها", href: "/admin/reviews", icon: Star },
  { label: "مرجوعی و تعویض", href: "/admin/returns", icon: RotateCcw },
  { label: "درخواست‌ها", href: "/admin/requests", icon: MessageSquare },
  { label: "گزارش‌ها", href: "/admin/reports", icon: BarChart3 },
  { label: "تنظیمات", href: "/admin/settings", icon: Settings },
  { label: "راهنمای طراحی", href: "/admin/design-system", icon: Palette },
];

/**
 * Admin shell.
 *
 * Visually distinct from the storefront — denser, darker rail, persistent
 * sidebar — while still unmistakably Loran.
 *
 * `admin` is resolved server-side by the `(dashboard)` layout, which is also
 * where access is actually enforced. Rendering it here is presentation only.
 */
export interface AdminShellProps {
  children: React.ReactNode;
  admin: { name: string; email: string };
}

export function AdminShell({ children, admin }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await api.post("/api/v1/admin/auth/logout");
    } finally {
      // Navigate regardless: the cookie is cleared server-side, and a failed
      // request should still take the administrator away from the panel.
      router.replace("/admin/login");
      router.refresh();
    }
  };

  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname.startsWith(href));

  const NavList = ({ onNavigate }: { onNavigate?: () => void }) => (
    <ul className="space-y-0.5">
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href, item.exact);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm transition-colors",
                active
                  ? "bg-primary text-primary-fg font-medium"
                  : "text-fg-muted hover:bg-surface-2 hover:text-fg"
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="min-h-dvh bg-canvas">
      {/* Top bar */}
      <header
        className="sticky top-0 flex h-14 items-center justify-between gap-3 border-b border-border bg-surface px-4"
        style={{ zIndex: "var(--z-header)" }}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="باز کردن منوی مدیریت"
            className="grid size-10 place-items-center rounded-md text-fg-muted hover:bg-surface-2 hover:text-fg lg:hidden"
          >
            <Menu className="size-5" aria-hidden />
          </button>
          <Logo size="sm" href="/admin" />
          <span className="hidden rounded-full border border-border px-2.5 py-1 text-[0.6875rem] font-medium text-fg-muted sm:inline">
            پنل مدیریت
          </span>
        </div>

        <div className="flex items-center gap-1">
          <span className="hidden max-w-40 truncate text-sm text-fg-muted md:inline" title={admin.email}>
            {admin.name}
          </span>
          <ThemeToggle />
          <Link
            href="/"
            className="flex h-10 items-center gap-1.5 rounded-md px-3 text-sm text-fg-muted hover:bg-surface-2 hover:text-fg"
          >
            <ExternalLink className="size-4" aria-hidden />
            <span className="hidden sm:inline">مشاهده فروشگاه</span>
          </Link>
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            aria-busy={signingOut}
            className="flex h-10 items-center gap-1.5 rounded-md px-3 text-sm text-fg-muted hover:bg-surface-2 hover:text-fg disabled:opacity-60"
          >
            <LogOut className="size-4" aria-hidden />
            <span className="hidden sm:inline">{signingOut ? "در حال خروج…" : "خروج"}</span>
          </button>
        </div>
      </header>

      <div className="lg:grid lg:grid-cols-[15rem_1fr]">
        {/* Desktop rail */}
        <aside className="hidden border-e border-border bg-surface lg:block">
          <nav aria-label="منوی پنل مدیریت" className="sticky top-14 p-3">
            <NavList />
          </nav>
        </aside>

        {/* Mobile drawer */}
        {menuOpen && (
          <>
            <div
              className="fixed inset-0 bg-[#1b1310]/55 lg:hidden"
              style={{ zIndex: "var(--z-overlay)" }}
              onClick={() => setMenuOpen(false)}
              aria-hidden
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="منوی پنل مدیریت"
              className="animate-drawer-start fixed inset-y-0 start-0 w-72 overflow-y-auto bg-surface p-3 shadow-e3 lg:hidden"
              style={{ zIndex: "var(--z-drawer)" }}
            >
              <div className="mb-3 flex items-center justify-between">
                <Logo size="sm" href="/admin" />
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  aria-label="بستن منو"
                  className="grid size-10 place-items-center rounded-md text-fg-muted hover:bg-surface-2"
                >
                  <X className="size-5" aria-hidden />
                </button>
              </div>
              <NavList onNavigate={() => setMenuOpen(false)} />
            </div>
          </>
        )}

        <main className="min-w-0 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}

/** Page header used across admin screens. */
export function AdminPageHeader({
  title, description, actions,
}: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-fg sm:text-2xl">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
