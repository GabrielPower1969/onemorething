#!/usr/bin/env node
// Screenshots for review: node scripts/shoot.mjs [baseUrl] [outDir] [paths...]
// Uses the system Chrome (Playwright channel "chrome"); typing is skipped via reduced motion
// unless SHOOT_MOTION=1, so shots show the final state.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const [base = "http://localhost:4321", out = "docs/screenshots", ...paths] = process.argv.slice(2);
const pages = paths.length ? paths : ["/", "/zh/"];
const sizes = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 },
];
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const errors = [];
for (const s of sizes) {
  const ctx = await browser.newContext({
    viewport: { width: s.width, height: s.height },
    isMobile: !!s.isMobile,
    deviceScaleFactor: s.deviceScaleFactor ?? 1,
    reducedMotion: process.env.SHOOT_MOTION ? "no-preference" : "reduce",
  });
  for (const p of pages) {
    const page = await ctx.newPage();
    page.on("console", (m) => m.type() === "error" && errors.push(`${s.name} ${p}: ${m.text()}`));
    page.on("pageerror", (e) => errors.push(`${s.name} ${p}: ${e.message}`));
    await page.goto(base + p, { waitUntil: "load", timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    // Reveal everything below the fold, then return to top for a full-page shot.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); }
      scrollTo(0, 0);
    });
    await page.waitForTimeout(400);
    const slug = (p.replace(/\/$/, "").replace(/^\//, "").replace(/\//g, "_") || "home").replace(/^zh$/, "zh_home");
    await page.screenshot({ path: `${out}/${slug}--${s.name}.png`, fullPage: true });
    await page.close();
  }
  await ctx.close();
}
await browser.close();
if (errors.length) { console.error("console errors:\n" + errors.join("\n")); process.exitCode = 1; }
console.log(`shots → ${out}`);
