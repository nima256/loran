/**
 * Persian formatting helpers.
 *
 * Every number the customer reads goes through here, so digit shape, separators
 * and the «تومان» suffix stay identical across the storefront, the invoice and
 * the admin panel.
 */

const faNumber = new Intl.NumberFormat("fa-IR");
/** One decimal place, Persian digits and the Persian decimal separator (٫). */
const faDecimal = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 });

/** ۱۲۳۴ → «۱٬۲۳۴» */
export function formatNumber(value: number): string {
  return faNumber.format(value);
}

/** Persian digits without grouping — for OTP boxes, counters, sizes. */
export function toPersianDigits(value: string | number): string {
  return String(value).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

/** «۰۱۲۳۴۵۶۷۸۹» → "0123456789" — for anything that must round-trip to an API. */
export function toLatinDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

/** ۱۲۵۰۰۰۰ → «۱٬۲۵۰٬۰۰۰ تومان» */
export function formatPrice(value: number): string {
  return `${faNumber.format(Math.round(value))} تومان`;
}

/** Amount only, for tables and rows that carry the unit in the column header. */
export function formatAmount(value: number): string {
  return faNumber.format(Math.round(value));
}

/** Compact form for dashboards: ۱۲٫۵ میلیون تومان */
export function formatCompactPrice(value: number): string {
  if (value >= 1_000_000_000) return `${faDecimal.format(value / 1_000_000_000)} میلیارد تومان`;
  if (value >= 1_000_000) return `${faDecimal.format(value / 1_000_000)} میلیون تومان`;
  if (value >= 1_000) return `${faNumber.format(Math.round(value / 1_000))} هزار تومان`;
  return formatPrice(value);
}

export function formatPercent(value: number): string {
  return `${toPersianDigits(Math.round(value))}٪`;
}

const faDate = new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "long", day: "numeric" });
const faDateShort = new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "2-digit", day: "2-digit" });
const faDateTime = new Intl.DateTimeFormat("fa-IR", {
  year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
});

/** «۲۱ اسفند ۱۴۰۳» */
export function formatDate(iso: string): string {
  return faDate.format(new Date(iso));
}

/** «۱۴۰۳/۱۲/۲۱» */
export function formatDateShort(iso: string): string {
  return faDateShort.format(new Date(iso));
}

/** «۲۱ اسفند ۱۴۰۳، ساعت ۱۴:۳۰» */
export function formatDateTime(iso: string): string {
  return faDateTime.format(new Date(iso)).replace("،", "، ساعت");
}

/** «۳ روز پیش» */
export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days < 1) return "امروز";
  if (days === 1) return "دیروز";
  if (days < 30) return `${toPersianDigits(days)} روز پیش`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${toPersianDigits(months)} ماه پیش`;
  return `${toPersianDigits(Math.floor(months / 12))} سال پیش`;
}

/** mm:ss for the OTP resend timer. */
export function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return toPersianDigits(`${m}:${String(s).padStart(2, "0")}`);
}

/** «۰۹۱۲ ۳۴۵ ۶۷۸۹» */
export function formatPhone(phone: string): string {
  const digits = toLatinDigits(phone).replace(/\D/g, "");
  if (digits.length !== 11) return toPersianDigits(phone);
  return toPersianDigits(`${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`);
}

/** Iranian mobile numbers only: 11 digits starting with 09. */
export function isValidPhone(phone: string): boolean {
  return /^09\d{9}$/.test(toLatinDigits(phone).replace(/\s/g, ""));
}

export function isValidPostalCode(code: string): boolean {
  return /^\d{10}$/.test(toLatinDigits(code).replace(/[\s-]/g, ""));
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export function discountPercent(price: number, compareAt?: number): number {
  if (!compareAt || compareAt <= price) return 0;
  return Math.round(((compareAt - price) / compareAt) * 100);
}
