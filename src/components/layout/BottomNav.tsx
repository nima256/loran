"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Grid2x2, Home, Search, ShoppingBag, User } from "lucide-react";
import { useCart } from "@/store/CartProvider";
import { useAuth } from "@/store/AuthProvider";
import { toPersianDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

const SearchOverlay = dynamic(
  () => import("./SearchOverlay").then((mod) => mod.SearchOverlay),
  { ssr: false }
);

/**
 * Mobile bottom navigation — the five shopping actions from the wireframe.
 * Icons always carry a label; the active destination is marked by colour *and*
 * a top indicator bar so it isn't communicated by colour alone.
 */
export function BottomNav() {
  const pathname = usePathname();
  const { count, setMiniCartOpen, hydrating } = useCart();
  const { isAuthenticated } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);

  const items = [
    { key: "home", label: "خانه", href: "/", icon: Home },
    { key: "categories", label: "دسته‌بندی", href: "/shop", icon: Grid2x2 },
    { key: "search", label: "جست‌وجو", icon: Search, onClick: () => setSearchOpen(true) },
    { key: "cart", label: "سبد خرید", icon: ShoppingBag, onClick: () => setMiniCartOpen(true), badge: hydrating ? 0 : count },
    { key: "account", label: "حساب من", href: isAuthenticated ? "/account" : "/auth/login", icon: User },
  ];

  return (
    <>
      <nav
        aria-label="ناوبری سریع"
        className="fixed inset-x-0 bottom-0 border-t border-border bg-surface/95 pb-safe backdrop-blur-md lg:hidden"
        style={{ zIndex: "var(--z-bottom-nav)" }}
      >
        <ul className="flex">
          {items.map((item) => {
            const active = item.href
              ? item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href)
              : false;
            const Icon = item.icon;

            const inner = (
              <>
                <span className="relative">
                  <Icon className="size-[1.375rem]" aria-hidden />
                  {"badge" in item && (item.badge ?? 0) > 0 && (
                    <span className="tnum absolute -top-1 start-2 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[0.5625rem] font-bold text-primary-fg">
                      {toPersianDigits(item.badge!)}
                    </span>
                  )}
                </span>
                <span className="text-[0.6875rem] font-medium">{item.label}</span>
                {active && <span aria-hidden className="absolute inset-x-5 top-0 h-0.5 rounded-b bg-primary" />}
              </>
            );

            const className = cn(
              "relative flex h-16 w-full flex-col items-center justify-center gap-1 transition-colors",
              active ? "text-primary dark:text-[color:var(--primary-soft-fg)]" : "text-fg-muted"
            );

            return (
              <li key={item.key} className="flex-1">
                {item.href ? (
                  <Link href={item.href} aria-current={active ? "page" : undefined} className={className}>
                    {inner}
                  </Link>
                ) : (
                  <button type="button" onClick={item.onClick} className={className}>
                    {inner}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      {searchOpen && <SearchOverlay open onClose={() => setSearchOpen(false)} />}
    </>
  );
}
