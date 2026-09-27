import { describe, expect, it } from "vitest";
import {
  isValidIranMobile,
  normalizeIranMobile,
  normalizePersian,
  normalizePostalCode,
  toLatinDigits,
} from "@/lib/persian";

/**
 * Persian input normalisation.
 *
 * Every one of these is a real thing a customer types. If any of them stops
 * working, a legitimate phone number gets rejected or a search finds nothing.
 */

describe("normalizeIranMobile", () => {
  it.each([
    ["09123456789", "09123456789"],
    ["۰۹۱۲۳۴۵۶۷۸۹", "09123456789"],           // Persian digits
    ["٠٩١٢٣٤٥٦٧٨٩", "09123456789"],           // Arabic-Indic digits
    ["+989123456789", "09123456789"],
    ["00989123456789", "09123456789"],
    ["989123456789", "09123456789"],
    ["9123456789", "09123456789"],
    ["0912 345 6789", "09123456789"],
    ["0912-345-6789", "09123456789"],
  ])("normalises %s", (input, expected) => {
    expect(normalizeIranMobile(input)).toBe(expected);
  });

  it.each(["", "0912345678", "091234567890", "02112345678", "hello", "08123456789"])(
    "rejects %s",
    (input) => {
      expect(normalizeIranMobile(input)).toBe("");
      expect(isValidIranMobile(input)).toBe(false);
    }
  );
});

describe("normalizePersian", () => {
  it("folds Arabic yeh and kaf to their Persian forms", () => {
    // These look identical on screen but are different code points, and
    // Persian keyboards produce both.
    expect(normalizePersian("كتاني")).toBe(normalizePersian("کتانی"));
  });

  it("treats the zero-width non-joiner as a space", () => {
    expect(normalizePersian("کفش‌های")).toBe("کفش های");
  });

  it("folds alef variants", () => {
    expect(normalizePersian("أحمد")).toBe(normalizePersian("احمد"));
  });

  it("collapses whitespace and lowercases", () => {
    expect(normalizePersian("  Loran   SHOES  ")).toBe("loran shoes");
  });

  it("converts Persian digits so a numeric search matches", () => {
    expect(normalizePersian("سایز ۴۲")).toBe("سایز 42");
  });
});

describe("normalizePostalCode", () => {
  it("accepts ten digits in any digit system", () => {
    expect(normalizePostalCode("۸۹۱۶۷۴۵۲۳۱")).toBe("8916745231");
    expect(normalizePostalCode("8916-745231")).toBe("8916745231");
  });

  it("rejects anything that is not ten digits", () => {
    expect(normalizePostalCode("123")).toBe("");
    expect(normalizePostalCode("89167452311")).toBe("");
  });
});

describe("toLatinDigits", () => {
  it("handles both Persian and Arabic digit blocks", () => {
    expect(toLatinDigits("۰۱۲۳۴۵۶۷۸۹")).toBe("0123456789");
    expect(toLatinDigits("٠١٢٣٤٥٦٧٨٩")).toBe("0123456789");
  });
});
