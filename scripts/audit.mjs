/**
 * Dev helper: opens routes in Chromium and reports layout problems that are
 * easy to miss by eye — horizontal overflow, tiny tap targets, console errors.
 *
 *   node scripts/audit.mjs <width> <path...>
 */
import { chromium } from "playwright-core";

const rawArgs = process.argv.slice(2);
const authed = rawArgs.includes("--auth");
const [width, ...paths] = rawArgs.filter((a) => a !== "--auth");
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: +width, height: 900 } });

if (authed) {
  // Seed the mock session so account and checkout screens render for real.
  await page.goto("http://localhost:3000/");
  await page.evaluate(() => {
    localStorage.setItem("loran:auth", JSON.stringify({
      user: { id: "u-1", phone: "09131234567", firstName: "نیما", lastName: "رضوانی",
              createdAt: "2024-02-11T08:30:00.000Z", smsNotifications: true },
      addresses: [{
        id: "a-1", title: "خانه", recipientFirstName: "نیما", recipientLastName: "رضوانی",
        phone: "09131234567", province: "یزد", city: "یزد",
        addressLine: "بلوار دانشجو، کوچه شهید مرادی، مجتمع نگین",
        postalCode: "8916745231", plaque: "۱۲", unit: "۴", isDefault: true,
      }],
    }));
  });
}

const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 160)));
page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message.slice(0, 160)));

for (const p of paths) {
  errors.length = 0;
  await page.goto(`http://localhost:3000${p}`, { waitUntil: "networkidle" }).catch(() => {});
  const report = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const overflow = [];
    const small = [];
    for (const el of document.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // Children of a horizontal scroller are meant to sit outside the frame.
      let inScroller = false;
      for (let n = el.parentElement; n; n = n.parentElement) {
        const ov = getComputedStyle(n).overflowX;
        if (ov === "auto" || ov === "scroll" || ov === "hidden") { inScroller = true; break; }
      }
      if (!inScroller && (r.right > vw + 1 || r.left < -1)) {
        overflow.push(`${el.tagName}.${String(el.className).slice(0, 60)} [${Math.round(r.left)}→${Math.round(r.right)}]`);
      }
    }
    for (const el of document.querySelectorAll('a,button,[role="button"],input,select')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // sr-only helpers are 1×1 by design.
      if (el.classList.contains("sr-only")) continue;
      if (r.height < 24 || r.width < 24) {
        small.push(`${el.tagName} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 24)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
      }
    }
    return {
      scrollW: document.documentElement.scrollWidth,
      vw,
      overflow: [...new Set(overflow)].slice(0, 8),
      small: [...new Set(small)].slice(0, 8),
    };
  });
  const bad = report.scrollW > report.vw + 1;
  console.log(`\n=== ${p} @${width}px ===`);
  console.log(`scrollWidth ${report.scrollW} / viewport ${report.vw} ${bad ? "❌ OVERFLOW" : "✅"}`);
  if (report.overflow.length) console.log("overflowing:\n  " + report.overflow.join("\n  "));
  if (report.small.length) console.log("small targets:\n  " + report.small.join("\n  "));
  if (errors.length) console.log("console errors:\n  " + [...new Set(errors)].join("\n  "));
}

await browser.close();
