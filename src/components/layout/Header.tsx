"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { genderNav, mainNav } from "@/lib/navigation";
import { useCatalog } from "@/store/CatalogProvider";
import { useCart } from "@/store/CartProvider";
import { useAuth } from "@/store/AuthProvider";
import { toPersianDigits } from "@/lib/format";
import { siteConfig } from "@/lib/site-config";
import { cn } from "@/lib/utils";

const SearchOverlay = dynamic(
  () => import("./SearchOverlay").then((mod) => mod.SearchOverlay),
  { ssr: false }
);
const MobileMenu = dynamic(
  () => import("./MobileMenu").then((mod) => mod.MobileMenu),
  { ssr: false }
);
const MiniCart = dynamic(
  () => import("./MiniCart").then((mod) => mod.MiniCart),
  { ssr: false }
);

/**
 * Site header.
 *
 * Follows the supplied wireframe: the Loran mark sits in the centre, the
 * shopping controls (cart, account, theme) sit on the inline-end (left) side,
 * and navigation sits on the inline-start (right) side. On phones the desktop
 * bar is not shrunk — it is replaced by a 56px bar plus the bottom navigation.
 */
export function Header() {
  const pathname = usePathname();
  const { categoryLinks } = useCatalog();
  const { count, setMiniCartOpen, miniCartOpen, hydrating } = useCart();
  const { isAuthenticated } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [announcementOpen, setAnnouncementOpen] = useState(true);

  // Route changes close every transient surface.
  useEffect(() => {
    setMenuOpen(false);
    setCategoriesOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  // ⌘I / Ctrl+I opens search from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "i") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const cartCount = hydrating ? 0 : count;

  const CartButton = ({ className }: { className?: string }) => (
    <button
      type="button"
      onClick={() => setMiniCartOpen(true)}
      aria-label={cartCount > 0 ? `سبد خرید، ${toPersianDigits(cartCount)} کالا` : "سبد خرید، خالی"}
      className={cn("relative grid size-11 place-items-center rounded-md text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg", className)}
    >
      <ShoppingBag className="size-5" aria-hidden />
      {cartCount > 0 && (
        <span className="tnum absolute -top-0.5 start-0 grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[0.625rem] font-bold text-primary-fg">
          {toPersianDigits(cartCount)}
        </span>
      )}
    </button>
  );

  return (
    <>
      {announcementOpen && (
        <div className="no-print relative bg-primary text-primary-fg">
          <div className="container-page flex min-h-9 items-center justify-center gap-2 py-1.5 text-center text-xs sm:text-sm">
            <p>
              ارسال رایگان برای سفارش‌های بالای{" "}
              <span className="tnum font-bold">{siteConfig.commerce.freeShippingThreshold.toLocaleString("fa-IR")}</span> تومان
            </p>
            <button
              type="button"
              onClick={() => setAnnouncementOpen(false)}
              aria-label="بستن اعلان"
              className="absolute inset-y-0 end-2 my-auto grid size-8 place-items-center rounded-md hover:bg-black/15"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      )}

      <header
        className="no-print sticky top-0 border-b border-border bg-canvas/85 backdrop-blur-md"
        style={{ zIndex: "var(--z-header)" }}
      >
        <div className="container-page">
          {/* ---------- mobile bar ---------- */}
          <div className="flex h-14 items-center justify-between gap-2 lg:hidden">
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-label="باز کردن منو"
                className="grid size-11 place-items-center rounded-md text-fg-muted hover:bg-surface-2 hover:text-fg"
              >
                <Menu className="size-5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                aria-label="جست‌وجو"
                className="grid size-11 place-items-center rounded-md text-fg-muted hover:bg-surface-2 hover:text-fg"
              >
                <Search className="size-5" aria-hidden />
              </button>
            </div>

            <Logo size="sm" />

            <div className="flex items-center">
              <ThemeToggle />
              <CartButton />
            </div>
          </div>

          {/* ---------- desktop bar ---------- */}
          <div className="hidden h-16 grid-cols-[1fr_auto_1fr] items-center gap-4 lg:grid">
            {/* start (right in RTL): navigation */}
            <nav aria-label="ناوبری اصلی" className="flex items-center gap-1">
              <div
                className="relative"
                onMouseEnter={() => setCategoriesOpen(true)}
                onMouseLeave={() => setCategoriesOpen(false)}
              >
                <button
                  type="button"
                  onClick={() => setCategoriesOpen((v) => !v)}
                  aria-expanded={categoriesOpen}
                  aria-haspopup="true"
                  className="flex h-11 items-center gap-1 rounded-md px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
                >
                  دسته‌بندی‌ها
                  <ChevronDown className={cn("size-4 transition-transform duration-[--dur-fast]", categoriesOpen && "rotate-180")} aria-hidden />
                </button>

                {categoriesOpen && (
                  <div
                    className="animate-slide-up absolute start-0 top-full w-[34rem] rounded-xl border border-border bg-surface p-4 shadow-e3"
                    style={{ zIndex: "var(--z-header)" }}
                  >
                    <div className="grid grid-cols-2 gap-1">
                      {categoryLinks.map((c) => (
                        <Link key={c.href} href={c.href} className="rounded-md p-3 transition-colors hover:bg-surface-2">
                          <span className="block text-sm font-medium text-fg">{c.label}</span>
                          <span className="mt-0.5 block line-clamp-1 text-xs text-fg-subtle">{c.description}</span>
                        </Link>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
                      <span className="text-xs text-fg-subtle">خرید برای:</span>
                      {genderNav.map((g) => (
                        <Link key={g.href} href={g.href} className="rounded-full border border-border px-3 py-1.5 text-xs text-fg-muted hover:border-border-strong hover:text-fg">
                          {g.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {mainNav.map((link) => {
                const active = pathname === link.href.split("?")[0];
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-11 items-center rounded-md px-3 text-sm font-medium transition-colors hover:bg-surface-2",
                      active ? "text-primary dark:text-[color:var(--primary-soft-fg)]" : "text-fg"
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            {/* centre: the logo, per the wireframe */}
            <div className="justify-self-center">
              <Logo size="md" />
            </div>

            {/* end (left in RTL): shopping controls */}
            <div className="flex items-center justify-end gap-1">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="flex h-11 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm text-fg-subtle transition-colors hover:border-border-strong hover:text-fg-muted xl:w-56"
              >
                <Search className="size-4 shrink-0" aria-hidden />
                <span className="hidden xl:inline">جست‌وجو در محصولات</span>
                <kbd className="ms-auto hidden rounded border border-border px-1.5 py-0.5 font-sans text-[0.625rem] text-fg-subtle xl:inline">Ctrl I</kbd>
              </button>
              <ThemeToggle />
              <Link
                href={isAuthenticated ? "/account" : "/auth/login"}
                aria-label={isAuthenticated ? "حساب کاربری" : "ورود یا ثبت‌نام"}
                className="grid size-11 place-items-center rounded-md text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
              >
                <User className="size-5" aria-hidden />
              </Link>
              <CartButton />
            </div>
          </div>
        </div>
      </header>

      {searchOpen && <SearchOverlay open onClose={() => setSearchOpen(false)} />}
      {menuOpen && <MobileMenu open onClose={() => setMenuOpen(false)} />}
      {miniCartOpen && <MiniCart />}
    </>
  );
}
