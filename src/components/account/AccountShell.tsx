"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, LogOut, MapPin, Package, RotateCcw, Settings, Star, User,
} from "lucide-react";
import { Skeleton } from "@/components/ui/Feedback";
import { accountNav } from "@/lib/navigation";
import { useAuth } from "@/store/AuthProvider";
import { useToast } from "@/components/ui/Toast";
import { formatPhone } from "@/lib/format";
import { cn } from "@/lib/utils";

const ICONS = {
  dashboard: LayoutDashboard,
  orders: Package,
  returns: RotateCcw,
  addresses: MapPin,
  reviews: Star,
  profile: User,
  settings: Settings,
} as const;

/**
 * Account shell: a sidebar on desktop, a horizontal scroller on phones.
 * Guards the whole section — an unauthenticated visitor is sent to sign in
 * and returned here afterwards.
 */
export function AccountShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, hydrating, logout } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!hydrating && !isAuthenticated) {
      router.replace(`/auth/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [hydrating, isAuthenticated, router, pathname]);

  if (hydrating) {
    return (
      <div className="container-page py-8">
        <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
          <Skeleton className="h-96 rounded-lg" />
          <Skeleton className="h-96 rounded-lg" />
        </div>
      </div>
    );
  }
  if (!isAuthenticated) return null;

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  const signOut = () => {
    logout();
    toast({ tone: "info", title: "از حساب خود خارج شدید" });
    router.push("/");
  };

  return (
    <div className="container-page py-6 lg:py-8">
      <div className="grid gap-6 lg:grid-cols-[16rem_1fr] lg:gap-8">
        <aside className="no-print min-w-0">
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-border bg-surface p-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-soft-fg">
              <User className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-fg">
                {user?.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : "کاربر لوران"}
              </p>
              <p className="tnum truncate text-xs text-fg-muted" dir="ltr">
                {user ? formatPhone(user.phone) : ""}
              </p>
            </div>
          </div>

          {/* Desktop rail */}
          <nav aria-label="منوی حساب کاربری" className="hidden lg:block">
            <ul className="overflow-hidden rounded-lg border border-border bg-surface">
              {accountNav.map((item) => {
                const Icon = ICONS[item.icon as keyof typeof ICONS];
                const active = isActive(item.href, item.exact);
                return (
                  <li key={item.href} className="border-b border-border last:border-0">
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-12 items-center gap-3 px-4 text-sm transition-colors",
                        active
                          ? "bg-primary-soft font-semibold text-primary-soft-fg"
                          : "text-fg-muted hover:bg-surface-2 hover:text-fg"
                      )}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
              <li className="border-t border-border">
                {/* Sign-out is separated from navigation on purpose. */}
                <button
                  type="button"
                  onClick={signOut}
                  className="flex min-h-12 w-full items-center gap-3 px-4 text-sm text-danger transition-colors hover:bg-danger-soft"
                >
                  <LogOut className="size-4 shrink-0" aria-hidden />
                  خروج از حساب
                </button>
              </li>
            </ul>
          </nav>

          {/* Mobile scroller */}
          <nav aria-label="منوی حساب کاربری" className="lg:hidden">
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
              {accountNav.map((item) => {
                const Icon = ICONS[item.icon as keyof typeof ICONS];
                const active = isActive(item.href, item.exact);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-fg"
                        : "border-border bg-surface text-fg-muted"
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                    {item.label}
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={signOut}
                className="flex h-11 shrink-0 items-center gap-2 rounded-full border border-danger/30 px-4 text-sm text-danger"
              >
                <LogOut className="size-4" aria-hidden />
                خروج
              </button>
            </div>
          </nav>
        </aside>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
