/**
 * Dev helper: renders an inline-SVG React component to a PNG so the drawing can
 * be checked without booting the app. Converts JSX camelCase attributes to the
 * SVG spelling and substitutes default prop values.
 *
 *   node scripts/preview-svg.mjs src/components/home/HangingShoe.tsx out.png [bg]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const [file, out, bg = "#F6EFE7", width = "640", height = "860"] = process.argv.slice(2);
const source = readFileSync(file, "utf8");

// Default values from the component's destructured props.
const defaults = Object.fromEntries(
  [...source.matchAll(/^\s+(\w+)\s*=\s*"([^"]+)",?$/gm)].map((m) => [m[1], m[2]])
);

let svg = source.slice(source.indexOf("<svg"), source.lastIndexOf("</svg>") + 6);
svg = svg
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
  .replace(/className=\{className\}/, `width="${width}"`)
  .replace(/\{(\w+)\}/g, (m, name) => (defaults[name] ? `"${defaults[name]}"` : m))
  .replace(/(\s)(stopColor|stopOpacity|strokeWidth|strokeLinecap|strokeLinejoin|strokeDasharray|fillOpacity|clipPath|clipRule|fillRule|strokeOpacity)=/g,
    (m, sp, attr) => sp + attr.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase()) + "=")
  .replace(/\s(role|aria-label)="[^"]*"/g, "");

writeFileSync("/tmp/_svg-preview.html", `<html><body style="margin:0;background:${bg};display:grid;place-items:center;height:${height}px">${svg}</body></html>`);
execFileSync("/opt/pw-browsers/chromium", [
  "--headless", "--disable-gpu", "--no-sandbox",
  `--screenshot=${out}`, `--window-size=${+width + 80},${height}`,
  "file:///tmp/_svg-preview.html",
], { stdio: "ignore" });
console.log("rendered", out);
