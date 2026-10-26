import { siteConfig } from "@/lib/site-config";
import { toPersianDigits } from "@/lib/format";

/**
 * Exchange-only policy: an order can be exchanged within
 * `siteConfig.commerce.exchangeWindowBusinessDays` business days of delivery.
 * There are no refunds/returns.
 *
 * Business days are Saturday–Thursday, the shop's working week; Friday, the
 * weekly holiday in Iran, does not count. The delivery day itself is day 0, so
 * an order delivered on Wednesday can be exchanged until the end of Saturday
 * (Thursday = 1, Friday skipped, Saturday = 2). Days are counted on Tehran
 * time, which has had a fixed UTC+03:30 offset since daylight saving ended.
 *
 * Official public holidays are not modelled; the window is the stricter
 * reading, and the shop can always accept a late request by hand.
 *
 * Shared by the server (which enforces it) and the UI (which explains it), so
 * the two can never disagree.
 */

export const EXCHANGE_WINDOW_BUSINESS_DAYS = siteConfig.commerce.exchangeWindowBusinessDays;

/** «۲ روز کاری» — the exact wording used everywhere on the site. */
export const EXCHANGE_WINDOW_LABEL = `${toPersianDigits(EXCHANGE_WINDOW_BUSINESS_DAYS)} روز کاری`;

const TEHRAN_OFFSET_MS = 210 * 60_000;
const FRIDAY = 5; // Date#getUTCDay(): Sunday = 0 … Saturday = 6
const DAY_MS = 86_400_000;

/** The last moment an exchange can be requested for an order delivered at `deliveredAt`. */
export function exchangeDeadline(deliveredAt: Date): Date {
  // Midnight (Tehran) at the start of the delivery day, as a UTC timestamp.
  const local = new Date(deliveredAt.getTime() + TEHRAN_OFFSET_MS);
  let day = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());

  for (let counted = 0; counted < EXCHANGE_WINDOW_BUSINESS_DAYS; ) {
    day += DAY_MS;
    if (new Date(day).getUTCDay() !== FRIDAY) counted++;
  }
  // End of that business day in Tehran.
  return new Date(day + DAY_MS - TEHRAN_OFFSET_MS - 1);
}

export function isWithinExchangeWindow(deliveredAt: Date | null | undefined, now = new Date()): boolean {
  return Boolean(deliveredAt) && now.getTime() <= exchangeDeadline(deliveredAt!).getTime();
}
