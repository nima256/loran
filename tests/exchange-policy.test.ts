import { describe, expect, it } from "vitest";
import { exchangeDeadline, isWithinExchangeWindow, EXCHANGE_WINDOW_LABEL } from "@/lib/exchange-policy";

/**
 * The 2-business-day exchange window: Saturday–Thursday count, Friday does
 * not; days are Tehran days (UTC+03:30); the delivery day is day 0.
 */

/** A Tehran wall-clock time as a Date. */
const tehran = (iso: string) => new Date(`${iso}+03:30`);

describe("exchange window", () => {
  it("uses the exact wording «۲ روز کاری»", () => {
    expect(EXCHANGE_WINDOW_LABEL).toBe("۲ روز کاری");
  });

  it("Saturday delivery → open until the end of Monday", () => {
    // 2026-10-17 is a Saturday.
    const deadline = exchangeDeadline(tehran("2026-10-17T15:00:00"));
    expect(deadline.toISOString()).toBe(tehran("2026-10-19T23:59:59.999").toISOString());
  });

  it("skips Friday: Wednesday delivery → open until the end of Saturday", () => {
    // 2026-10-21 is a Wednesday; Thursday = day 1, Friday skipped, Saturday = day 2.
    const deadline = exchangeDeadline(tehran("2026-10-21T10:00:00"));
    expect(deadline.toISOString()).toBe(tehran("2026-10-24T23:59:59.999").toISOString());
  });

  it("Thursday delivery → Saturday and Sunday count, not Friday", () => {
    const deadline = exchangeDeadline(tehran("2026-10-22T20:00:00"));
    expect(deadline.toISOString()).toBe(tehran("2026-10-25T23:59:59.999").toISOString());
  });

  it("counts Tehran days, not UTC days, around midnight", () => {
    // 00:30 Tehran on Sunday is still Saturday in UTC; the window must start Sunday.
    const deadline = exchangeDeadline(tehran("2026-10-18T00:30:00"));
    expect(deadline.toISOString()).toBe(tehran("2026-10-20T23:59:59.999").toISOString());
  });

  it("is open at the last moment and closed just after", () => {
    const delivered = tehran("2026-10-17T15:00:00");
    expect(isWithinExchangeWindow(delivered, tehran("2026-10-19T23:59:00"))).toBe(true);
    expect(isWithinExchangeWindow(delivered, tehran("2026-10-20T00:00:01"))).toBe(false);
    expect(isWithinExchangeWindow(null)).toBe(false);
  });
});
