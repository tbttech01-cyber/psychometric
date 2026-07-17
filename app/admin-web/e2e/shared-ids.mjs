// Automated UI test for the Access Codes (shared-ids) "Create New Code" form —
// alignment (single aligned row on desktop, clean stack on mobile) + no overflow.
// Run from app/admin-web with an admin-web server running (defaults to :3001):
//   ADMIN_URL=... ADMIN_EMAIL=... ADMIN_PASSWORD=... node e2e/shared-ids.mjs
import { chromium } from "playwright";

const ADMIN = process.env.ADMIN_URL || "http://localhost:3001";
const EMAIL = process.env.ADMIN_EMAIL || "nandhinibabu211@gmail.com";
const PASSWORD = process.env.ADMIN_PASSWORD || "nandhini@210508";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0; const fails = [];
const ok = (n, c, e = "") => { console.log(`  [${c ? "PASS" : "FAIL"}] ${n}${e ? " — " + e : ""}`); if (c) pass++; else { fail++; fails.push(`${n} ${e}`); } };

const browser = await chromium.launch();

async function inspect(w, h, mobile) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile });
  const page = await ctx.newPage();
  await page.goto(`${ADMIN}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", EMAIL); await page.fill("#password", PASSWORD);
  await page.click('button:has-text("Login")');
  await page.waitForURL("**/dashboard", { timeout: 20000 }).catch(() => {});
  await page.goto(`${ADMIN}/shared-ids`, { waitUntil: "networkidle" });
  await sleep(1500);
  const m = await page.evaluate(() => {
    const row = [...document.querySelectorAll(".card")].find((c) => /Create New Code/.test(c.textContent || "")).querySelector(".flex");
    const boxes = [...row.children].map((el) => { const r = el.getBoundingClientRect(); return { top: Math.round(r.top), h: Math.round(r.height), right: Math.round(r.right) }; });
    return {
      count: boxes.length,
      isRow: new Set(boxes.map((x) => x.top)).size === 1,        // all on one baseline
      isStack: new Set(boxes.map((x) => x.top)).size === boxes.length, // each on its own line
      sameHeight: new Set(boxes.map((x) => x.h)).size === 1,
      heights: boxes.map((x) => x.h),
      maxRight: Math.max(...boxes.map((x) => x.right)),
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      vw: window.innerWidth,
    };
  });
  await ctx.close();
  return m;
}

console.log("== Desktop / laptop (single aligned row) ==");
for (const W of [1920, 1440, 1366, 1280]) {
  const m = await inspect(W, 800, false);
  ok(`${W}: all 4 controls on one baseline (aligned row)`, m.isRow, `heights ${JSON.stringify(m.heights)}`);
  ok(`${W}: all controls same height`, m.sameHeight, JSON.stringify(m.heights));
  ok(`${W}: no horizontal overflow / clipping`, m.pageOverflow <= 1 && m.maxRight <= m.vw + 1, `overflow ${m.pageOverflow}`);
}

console.log("== Tablet / mobile (clean stack) ==");
for (const [W, mob] of [[820, false], [390, true]]) {
  const m = await inspect(W, 800, mob);
  ok(`${W}: controls stack (each full-width row)`, m.isStack, `${m.count} controls`);
  ok(`${W}: stacked controls same height`, m.sameHeight, JSON.stringify(m.heights));
  ok(`${W}: no horizontal overflow`, m.pageOverflow <= 1 && m.maxRight <= m.vw + 1, `overflow ${m.pageOverflow}`);
}

await browser.close();
console.log(`\n==================== ACCESS CODES FORM TEST: ${pass} passed, ${fail} failed ====================`);
if (fails.length) console.log("FAILURES:\n - " + fails.join("\n - "));
process.exit(fail ? 1 : 0);
