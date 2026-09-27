/**
 * Persian text normalisation.
 *
 * Persian users type ی/ي, ک/ك and the zero-width non-joiner inconsistently, so
 * every value that is searched, compared or stored as an identifier passes
 * through here first. Shared by the client (search box) and the server (search
 * index, phone validation), which is why it lives in `src/lib` and not
 * `src/server`.
 */

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** «۰۹۱۲» → "0912". Handles both Persian and Arabic-Indic digit blocks. */
export function toLatinDigits(value: string): string {
  return String(value)
    .replace(/[\u06F0-\u06F9]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[\u0660-\u0669]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));
}

/**
 * Folds the Arabic/Persian letter variants, strips the ZWNJ and collapses
 * whitespace. The result is what gets indexed and what a query is matched
 * against, so «کفش‌های» and «كفش هاي» reach the same string.
 */
export function normalizePersian(value: string): string {
  return toLatinDigits(String(value))
    .toLowerCase()
    // ي (Arabic yeh) and its presentation forms → ی
    .replace(/[\u064A\u0649\uFEF1\uFEF2\uFEF3\uFEF4]/g, "ی")
    // ك (Arabic kaf) and its presentation forms → ک
    .replace(/[\u0643\uFED9\uFEDA\uFEDB\uFEDC]/g, "ک")
    // ه with hamza/ye above → ه
    .replace(/[\u0629\u06C0]/g, "ه")
    // Alef variants → ا
    .replace(/[\u0622\u0623\u0625\u0671]/g, "ا")
    // Strip Arabic diacritics.
    .replace(/[\u064B-\u0652\u0670]/g, "")
    // ZWNJ and other zero-width marks become a plain space.
    .replace(/[\u200B-\u200F\u2028\u2029\uFEFF]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalises an Iranian mobile number to the canonical `09XXXXXXXXX`.
 * Returns an empty string when the input can't be read as one.
 */
export function normalizeIranMobile(value: string): string {
  let mobile = toLatinDigits(String(value ?? ""))
    .trim()
    .replace(/[^\d+]/g, "");

  mobile = mobile
    .replace(/^\+98/, "0")
    .replace(/^0098/, "0")
    .replace(/^98(?=9\d{9}$)/, "0");

  if (/^9\d{9}$/.test(mobile)) mobile = `0${mobile}`;
  return /^09\d{9}$/.test(mobile) ? mobile : "";
}

export function isValidIranMobile(value: string): boolean {
  return normalizeIranMobile(value) !== "";
}

/** Iranian postal codes are exactly ten digits. */
export function normalizePostalCode(value: string): string {
  const digits = toLatinDigits(String(value ?? "")).replace(/[\s-]/g, "");
  return /^\d{10}$/.test(digits) ? digits : "";
}

/** Slugifies a Persian or Latin name, keeping Persian letters readable. */
export function slugify(value: string): string {
  return normalizePersian(value)
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
