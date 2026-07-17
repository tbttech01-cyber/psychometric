// Automated UI test for the Question Edit MODAL on the Questions page.
// Mutation-free (opens/closes only) so it is safe against production.
//   ADMIN_URL=... ADMIN_EMAIL=... ADMIN_PASSWORD=... node e2e/questions-modal.mjs
import { chromium } from "playwright";

const ADMIN = process.env.ADMIN_URL || "http://localhost:3001";
const EMAIL = process.env.ADMIN_EMAIL || "nandhinibabu211@gmail.com";
const PASSWORD = process.env.ADMIN_PASSWORD || "nandhini@210508";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0; const fails = [];
const ok = (n, c, e = "") => { console.log(`  [${c ? "PASS" : "FAIL"}] ${n}${e ? " — " + e : ""}`); if (c) pass++; else { fail++; fails.push(`${n} ${e}`); } };

const browser = await chromium.launch();

async function login(ctx) {
  const page = await ctx.newPage();
  await page.goto(`${ADMIN}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", EMAIL); await page.fill("#password", PASSWORD);
  await page.click('button:has-text("Login")');
  await page.waitForURL("**/dashboard", { timeout: 20000 }).catch(() => {});
  await page.goto(`${ADMIN}/questions`, { waitUntil: "networkidle" });
  await sleep(1600);
  return page;
}
const containerTop = (p) => p.evaluate(() => document.querySelector("main").parentElement.scrollTop);

console.log("== Behaviour + a11y (desktop) ==");
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 800 } });
  const page = await login(ctx);
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e).slice(0, 90)));
  page.on("console", (m) => { if (m.type() === "error" && !/40[0-9]|Failed to fetch/.test(m.text())) errs.push(m.text().slice(0, 90)); });

  const rows = page.locator("table.data-table tbody tr");
  const editBtn = rows.nth(Math.min((await rows.count()) - 1, 18)).locator('button:has-text("Edit")');
  await editBtn.scrollIntoViewIfNeeded(); await sleep(300);
  const before = await containerTop(page);
  await editBtn.click(); await sleep(800);

  const modal = page.locator('[role="dialog"]');
  ok("Edit opens a modal (role=dialog + aria-modal)", await modal.getAttribute("aria-modal") === "true");
  ok("accessible title 'Edit Question'", (await page.locator("#q-edit-title").textContent()) === "Edit Question");
  ok("data pre-filled", (await page.locator("textarea").first().inputValue()).trim().length > 0);
  ok("list did not jump / scroll preserved on open", await containerTop(page) === before);
  await page.mouse.move(20, 300); await page.mouse.wheel(0, 800); await sleep(250);
  ok("background does not scroll behind the modal", await containerTop(page) === before);
  const c = await modal.locator("> div").first().evaluate((el) => { const r = el.getBoundingClientRect(); return { x: Math.abs((r.left + r.width / 2) - innerWidth / 2) < 5, inside: r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1 }; });
  ok("modal centered + fully inside viewport", c.x && c.inside);
  ok("'Question Type' label centered", await page.evaluate(() => { const l = [...document.querySelectorAll('[role="dialog"] label')].find((x) => /Question Type/.test(x.textContent || "")); return l && getComputedStyle(l).textAlign === "center"; }));
  ok("focus moved into modal", await page.evaluate(() => document.activeElement?.getAttribute("aria-label") === "Close edit dialog"));

  await page.keyboard.press("Escape"); await sleep(400);
  ok("Escape closes", await modal.count() === 0);
  ok("scroll preserved after close", await containerTop(page) === before);

  await editBtn.click(); await sleep(500);
  await modal.click({ position: { x: 5, y: 5 } }); await sleep(300);
  ok("backdrop click closes", await modal.count() === 0);

  await editBtn.click(); await sleep(500);
  await page.click('button[aria-label="Close edit dialog"]'); await sleep(300);
  ok("close (X) closes", await modal.count() === 0);

  ok("reorder + delete controls unaffected", (await page.locator('button[title="Move up"]').count()) > 0 && (await page.locator('table.data-table tbody button:has-text("Delete")').count()) > 0);
  ok("no console/page errors", errs.length === 0, [...new Set(errs)].slice(0, 3).join(" | "));
  await ctx.close();
}

console.log("== Responsive (modal inside viewport, no overflow) ==");
for (const [W, H, mob] of [[1920, 1080, false], [1440, 900, false], [1366, 768, false], [1280, 720, false], [1024, 768, false], [768, 1024, false], [390, 844, true]]) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: mob });
  const page = await login(ctx);
  await page.locator('table.data-table tbody button:has-text("Edit")').first().click(); await sleep(800);
  const m = await page.evaluate(() => { const r = document.querySelector('[role="dialog"] > div').getBoundingClientRect(); return { inside: r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
  ok(`${W}x${H}: modal inside viewport, no page overflow`, m.inside && m.overflow <= 1, `overflow ${m.overflow}`);
  await ctx.close();
}

await browser.close();
console.log(`\n==================== QUESTION EDIT MODAL: ${pass} passed, ${fail} failed ====================`);
if (fails.length) console.log("FAILURES:\n - " + fails.join("\n - "));
process.exit(fail ? 1 : 0);
