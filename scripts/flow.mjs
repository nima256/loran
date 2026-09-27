/**
 * Dev helper: drives the full purchase flow in a real browser and screenshots
 * each step, so the journey can be reviewed the way a customer sees it.
 *
 *   node scripts/flow.mjs <outDir> <width> [--dark]
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const args = process.argv.slice(2);
const dark = args.includes("--dark");
const [outDir, width] = args.filter((a) => a !== "--dark");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const ctx = await browser.newContext({
  viewport: { width: +width, height: +width < 700 ? 844 : 950 },
  colorScheme: dark ? "dark" : "light",
  locale: "fa-IR",
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message.slice(0, 200)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 200)));

const suffix = `${width}${dark ? "-dark" : ""}`;
let step = 0;
const shot = async (name) => {
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${outDir}/${String(++step).padStart(2, "0")}-${name}-${suffix}.png` });
  console.log(`  ${step}. ${name}`);
};
const go = async (path) => { await page.goto(`http://localhost:3000${path}`, { waitUntil: "networkidle" }); };

console.log(`\n=== flow @${suffix} ===`);

await go("/");
await shot("home");

await go("/shop?size=42&stock=1&sort=discount");
await shot("shop-filtered");

// Wait for the navigation explicitly — a pending filter transition can
// otherwise swallow the click.
await Promise.all([
  page.waitForURL(/\/product\//, { timeout: 15000 }),
  page.locator("article h3 a").first().click(),
]);
await page.waitForLoadState("networkidle");
await shot("product");

const colorButtons = page.locator('fieldset button[aria-label^="رنگ"]');
if (await colorButtons.count() > 1) await colorButtons.nth(1).click();
const sizeButtons = page.locator("#size-picker button:not([disabled])");
if (await sizeButtons.count() > 1) await sizeButtons.nth(1).click();
await shot("product-variant");

await page.getByRole("button", { name: /افزودن به سبد خرید/ }).first().click();
await shot("product-added");

await go("/cart");
await page.locator("#coupon-code").fill("LORAN10");
await page.getByRole("button", { name: "اعمال" }).click();
await page.waitForTimeout(900);
await shot("cart-coupon");

await go("/checkout");
await page.waitForTimeout(900);
await shot("checkout-redirect-login");

await page.locator("#phone").fill("09131234567");
await page.getByRole("button", { name: "دریافت کد تأیید" }).click();
await page.waitForTimeout(1400);
await shot("otp");

const boxes = page.locator('input[aria-label*="رقم"]');
for (let i = 0; i < 5; i++) await boxes.nth(i).fill("9");
await page.waitForTimeout(1300);
await shot("otp-error");

for (let i = 0; i < 5; i++) await boxes.nth(i).fill("1");
await page.waitForTimeout(1800);
await shot("checkout-step1");

await page.getByRole("button", { name: "ادامه" }).click();
await shot("checkout-step2");
await page.getByRole("button", { name: "ادامه" }).click();
await shot("checkout-step3");

await go("/account");
await shot("account");
await go("/account/orders");
await shot("orders");
await Promise.all([
  page.waitForURL(/\/account\/orders\/LRN/, { timeout: 15000 }),
  page.getByRole("link", { name: /جزئیات و پیگیری/ }).first().click(),
]);
await page.waitForLoadState("networkidle");
await shot("order-tracking");

await go("/account/orders/LRN-140328-0654/invoice");
await shot("invoice");

await go("/admin");
await shot("admin-dashboard");
await go("/admin/products/loran-sepehr-562");
await page.getByRole("tab", { name: /تنوع و موجودی/ }).click();
await shot("admin-variant-matrix");

if (errors.length) console.log("\nCONSOLE/PAGE ERRORS:\n  " + [...new Set(errors)].join("\n  "));
else console.log("\nno console errors");

await browser.close();
