import type { Gender, ProductTag, SortKey } from "@/types";

/**
 * Client-safe catalogue constants.
 *
 * These are static UI vocabulary, not catalogue data. They live apart from the
 * catalogue service so a client component can import them without dragging the
 * server module — and the product catalogue behind it — into the browser
 * bundle.
 */

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "newest", label: "جدیدترین" },
  { value: "bestselling", label: "پرفروش‌ترین" },
  { value: "price-asc", label: "ارزان‌ترین" },
  { value: "price-desc", label: "گران‌ترین" },
  { value: "discount", label: "بیشترین تخفیف" },
  { value: "rating", label: "بالاترین امتیاز" },
];

export const POPULAR_SEARCHES = [
  "کتانی مردانه",
  "اسنیکر سفید",
  "نیم‌بوت زنانه",
  "کفش رانینگ",
  "کفش کلاسیک چرم",
  "کتانی بچگانه",
];

/**
 * The genders a product may be saved with, and the only ones offered by the
 * admin forms and the storefront filters. The database enum still carries the
 * retired `unisex` / `kids` values so older rows keep loading — they are just
 * never written again. The server schema validates against this same list.
 */
export const PRODUCT_GENDERS = ["men", "women"] as const satisfies readonly Gender[];
export type ProductGender = (typeof PRODUCT_GENDERS)[number];

export function isProductGender(value: string): value is ProductGender {
  return (PRODUCT_GENDERS as readonly string[]).includes(value);
}

/** Badges an administrator can put on a product. */
export const PRODUCT_TAGS = ["new", "bestseller", "sale", "limited"] as const satisfies readonly ProductTag[];

/** The homepage sections each badge feeds, and the listing behind "see all". */
export const TAG_SECTIONS = {
  new: { title: "تازه رسیده", href: "/shop?tag=new" },
  bestseller: { title: "پرفروش", href: "/shop?tag=bestseller" },
  sale: { title: "تخفیف", href: "/sale" },
} as const;
