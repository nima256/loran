import type { Category } from "@/types";

/**
 * Site navigation.
 *
 * Everything here is static link vocabulary. Category links are the one
 * exception — they come from the database, so `categoryNav()` takes the
 * categories the server already loaded rather than importing them.
 *
 * That indirection is deliberate: this module is imported by the header and
 * footer, which are client components. Importing the catalogue here previously
 * shipped the entire product catalogue into every storefront page's bundle.
 */

/** Primary header links. Kept short deliberately — five items maximum. */
export const mainNav = [
  { label: "فروشگاه", href: "/shop" },
  { label: "جدیدترین‌ها", href: "/shop?sort=newest" },
  { label: "تخفیف‌ها", href: "/sale" },
  { label: "درباره لوران", href: "/about" },
  { label: "تماس با ما", href: "/contact" },
];

/** Gender shortcuts shown inside the categories menu. */
export const genderNav = [
  { label: "مردانه", href: "/shop?gender=men" },
  { label: "زنانه", href: "/shop?gender=women" },
  { label: "یونیسکس", href: "/shop?gender=unisex" },
  { label: "بچگانه", href: "/shop?gender=kids" },
];

export interface CategoryNavItem {
  label: string;
  href: string;
  slug: string;
  description?: string;
}

/** Builds the category menu from categories loaded server-side. */
export function categoryNav(categories: Category[]): CategoryNavItem[] {
  return categories.map((c) => ({
    label: c.name,
    href: `/category/${c.slug}`,
    slug: c.slug,
    description: c.description,
  }));
}

/** Footer columns. Every link here resolves to a real page. */
export const footerNav = [
  {
    title: "خرید",
    links: [
      { label: "همه محصولات", href: "/shop" },
      { label: "کتانی و اسنیکر", href: "/category/sneaker" },
      { label: "ورزشی و رانینگ", href: "/category/running" },
      { label: "رسمی و کلاسیک", href: "/category/classic" },
      { label: "بوت و نیم‌بوت", href: "/category/boots" },
      { label: "تخفیف‌ها و حراج", href: "/sale" },
    ],
  },
  {
    title: "خدمات مشتریان",
    links: [
      { label: "پیگیری سفارش", href: "/account/orders" },
      { label: "شیوه‌های ارسال", href: "/shipping" },
      { label: "مرجوعی و تعویض", href: "/returns" },
      { label: "راهنمای سایز", href: "/size-guide" },
      { label: "پرسش‌های پرتکرار", href: "/faq" },
      { label: "درخواست مشاوره", href: "/consultation" },
    ],
  },
  {
    title: "لوران",
    links: [
      { label: "درباره ما", href: "/about" },
      { label: "تماس با ما", href: "/contact" },
      { label: "شعبه‌های حضوری", href: "/contact#stores" },
      { label: "قوانین و مقررات", href: "/terms" },
      { label: "حریم خصوصی", href: "/privacy" },
    ],
  },
];

/** Account sidebar. `exact` marks the dashboard root so it isn't always active. */
export const accountNav = [
  { label: "پیشخوان", href: "/account", icon: "dashboard", exact: true },
  { label: "سفارش‌ها", href: "/account/orders", icon: "orders" },
  { label: "مرجوعی و تعویض", href: "/account/returns", icon: "returns" },
  { label: "آدرس‌ها", href: "/account/addresses", icon: "addresses" },
  { label: "دیدگاه‌های من", href: "/account/reviews", icon: "reviews" },
  { label: "اطلاعات حساب", href: "/account/profile", icon: "profile" },
  { label: "تنظیمات", href: "/account/settings", icon: "settings" },
];
