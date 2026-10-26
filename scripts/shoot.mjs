/**
 * Dev helper: screenshots routes at a given viewport width.
 *   node scripts/shoot.mjs <outDir> <width> <height|full> [--dark] <path...>
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const args = process.argv.slice(2);
const dark = args.includes("--dark");
const [outDir, width, height, ...rest] = args.filter((a) => a !== "--dark");
const paths = rest;
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({
  viewport: { width: +width, height: height === "full" ? 900 : +height },
  colorScheme: dark ? "dark" : "light",
  deviceScaleFactor: 1,
});

for (const p of paths) {
  const name = (p.replace(/^\//, "").replace(/[/?=&#]/g, "_") || "home") + `-${width}${dark ? "-dark" : ""}.png`;
  await page.goto(`http://localhost:3000${p}`, { waitUntil: "networkidle" }).catch(() => {});
  // Settle fonts and entrance animations before capturing.
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${outDir}/${name}`, fullPage: height === "full" });
  console.log("ok", name);
}
await browser.close();
