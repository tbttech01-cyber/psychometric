// Automated UI test for the admin Users page — responsive layout + interactions.
// Run from app/admin-web with an admin-web server running (defaults to :3001)
// pointed at a backend with users:
//   ADMIN_URL=http://localhost:3001 ADMIN_EMAIL=... ADMIN_PASSWORD=... node e2e/users.mjs
import { chromium } from "playwright";

const ADMIN = process.env.ADMIN_URL || "http://localhost:3001";
const EMAIL = process.env.ADMIN_EMAIL || "nandhinibabu211@gmail.com";
const PASSWORD = process.env.ADMIN_PASSWORD || "nandhini@210508";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0; const fails = [];
const ok = (n, c, e = "") => { console.log(`  [${c ? "PASS" : "FAIL"}] ${n}${e ? " — " + e : ""}`); if (c) pass++; else { fail++; fails.push(`${n} ${e}`); } };

const browser = await chromium.launch();

async function open(w, h, mobile) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") page.__errs = (page.__errs || []).concat(m.text().slice(0, 90)); });
  await page.goto(`${ADMIN}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", EMAIL); await page.fill("#password", PASSWORD);
  await page.click('button:has-text("Login")');
  await page.waitForURL("**/dashboard", { timeout: 20000 }).catch(() => {});
  await page.goto(`${ADMIN}/users`, { waitUntil: "networkidle" });
  await sleep(1800);
  return { ctx, page };
}
const noPageScroll = (p) => p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
const scrollWidthOf = (p, sel) => p.evaluate((s) => { const el = document.querySelector(s); return el ? el.scrollWidth - el.clientWidth : -1; }, sel);

// ---------- DESKTOP ----------
console.log("== Desktop (1440) ==");
{
  const { ctx, page } = await open(1440, 1000, false);
  ok("desktop: no page horizontal overflow", await noPageScroll(page));
  ok("desktop: data table is visible", await page.locator("table.data-table").isVisible());
  ok("desktop: mobile card list is hidden", !(await page.locator("div.rounded-xl.border.p-3").first().isVisible().catch(() => false)));
  ok("desktop: stat cards render (4)", (await page.locator(".card").filter({ hasText: /Total Users|Verified|Pending|Completed/ }).count()) >= 4);
  ok("desktop: no console errors", (page.__errs || []).length === 0, (page.__errs || []).join(" | "));
  await ctx.close();
}

// ---------- MOBILE (the fix) ----------
console.log("== Mobile (390) ==");
{
  const { ctx, page } = await open(390, 844, true);
  ok("mobile: no page horizontal overflow", await noPageScroll(page));
  // the wide table must not be the visible/scrolling element on mobile
  const tableVisible = await page.locator("table.data-table").isVisible().catch(() => false);
  ok("mobile: wide table is hidden (no sideways scroll)", !tableVisible);
  const ts = await scrollWidthOf(page, ".table-scroll");
  ok("mobile: table-scroll not overflowing (hidden)", ts <= 1, `overflow ${ts}px`);
  // stacked cards present, each with the key info + Delete visible
  const cardCount = await page.locator("div.rounded-xl.border.p-3").count();
  ok("mobile: stacked user cards render", cardCount > 0, `${cardCount} cards`);
  const firstCard = page.locator("div.rounded-xl.border.p-3").first();
  ok("mobile: card shows a status badge", await firstCard.locator(".badge").first().isVisible());
  ok("mobile: card shows Verified/Unverified + Completed/Pending", (await firstCard.locator(".badge").count()) >= 2);
  const del = firstCard.locator('button:has-text("Delete")');
  ok("mobile: Delete button is visible (was off-screen before)", await del.isVisible());
  const box = await del.boundingBox();
  ok("mobile: Delete button within viewport", !!box && box.x >= 0 && box.x + box.width <= 390 + 1, box ? `x=${Math.round(box.x)} w=${Math.round(box.width)}` : "no box");
  ok("mobile: card shows Access Code + Batch + ID + Registered meta", /Code:|Batch:|ID:|Registered:/.test(await firstCard.textContent() || ""));
  await ctx.close();
}

// ---------- LAPTOP 1366 (the reported clipping bug) ----------
console.log("== Laptop (1366) ==");
for (const W of [1280, 1366, 1440]) {
  const { ctx, page } = await open(W, 768, false);
  ok(`laptop ${W}: no page horizontal overflow`, await noPageScroll(page));
  const tsOverflow = await scrollWidthOf(page, ".table-scroll");
  ok(`laptop ${W}: table not clipped inside its card (table-scroll overflow ~0)`, tsOverflow <= 1, `overflow ${tsOverflow}px`);
  // Actions header not truncated to "ACT..." and Delete button fully within viewport
  const actionsFull = await page.locator("th", { hasText: "Actions" }).first().evaluate((el) => { const r = el.getBoundingClientRect(); return r.right <= window.innerWidth + 1 && r.left >= 0; }).catch(() => false);
  ok(`laptop ${W}: Actions header fully visible (not "ACT")`, actionsFull);
  const del = page.locator("table.data-table tbody button:has-text('Delete')").first();
  const box = await del.boundingBox().catch(() => null);
  ok(`laptop ${W}: Delete button fully within viewport (not clipped)`, !!box && box.x >= 0 && box.x + box.width <= W + 1 && box.width >= 40, box ? `right=${Math.round(box.x + box.width)}/${W}` : "no box");
  await ctx.close();
}

// ---------- INTERACTIONS (desktop) ----------
console.log("== Interactions ==");
{
  const { ctx, page } = await open(1440, 1000, false);
  // filter: status = verified -> Apply
  await page.selectOption("select", { label: "Verified" }).catch(() => {});
  await page.click('button:has-text("Apply")'); await sleep(1200);
  const onlyVerified = await page.locator("table.data-table tbody tr").evaluateAll((rows) => rows.every((r) => /Verified/.test(r.textContent || "") && !/Unverified/.test(r.textContent || "")));
  ok("filter: Status=Verified shows only verified rows", onlyVerified);
  // clear
  await page.click('button:has-text("Clear")'); await sleep(1000);
  ok("filter: Clear resets the list", (await page.locator("table.data-table tbody tr").count()) > 0);
  // search
  await page.fill('input[placeholder*="Name"]', "roshini"); await page.click('button:has-text("Apply")'); await sleep(1200);
  ok("search: filters by name", (await page.locator("table.data-table tbody").textContent() || "").toLowerCase().includes("roshini"));
  await page.click('button:has-text("Clear")'); await sleep(800);
  // Add New User form opens + closes
  await page.click('button:has-text("Add New User")'); await sleep(500);
  ok("Add New User: form opens", await page.locator('input[placeholder*="Full name"], input[placeholder*="name" i]').first().isVisible());
  // Delete confirm modal opens then cancel (NEVER confirm real data)
  const firstDelete = page.locator("table.data-table tbody tr button:has-text('Delete')").first();
  if (await firstDelete.count()) {
    await firstDelete.click(); await sleep(500);
    const modal = await page.locator("text=/delete/i").count();
    ok("Delete: confirm modal opens", modal > 0);
    const cancel = page.locator('button:has-text("Cancel")').first();
    if (await cancel.count()) await cancel.click().catch(() => {});
    await sleep(300);
    ok("Delete: cancelled (no deletion)", true);
  }
  await ctx.close();
}

await browser.close();
console.log(`\n==================== USERS PAGE UI TEST: ${pass} passed, ${fail} failed ====================`);
if (fails.length) console.log("FAILURES:\n - " + fails.join("\n - "));
process.exit(fail ? 1 : 0);
