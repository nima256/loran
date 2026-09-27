import type { SortKey } from "@/types";

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
