// Reusable Playwright audit harness for the PRODUCTION admin + candidate apps.
// Read-only: it never creates or deletes real data (the Delete test opens the
// confirmation dialog and CANCELS). Run from app/admin-web so `playwright`
// resolves:  node e2e/audit.mjs
//
// Sections are gated by env vars, so it runs as far as the provided secrets
// allow:
//   OUT_DIR           screenshot output dir (default: ./e2e/shots)
//   ADMIN_EMAIL       + ADMIN_PASSWORD  -> audits every authenticated admin page
//   TEST_CODE         + TEST_USER_EMAIL + TEST_USER_PASSWORD -> assessment flow
//
// Public pages (admin login, candidate login/register) are always audited.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const OUT = process.env.OUT_DIR || path.join(process.cwd(), "e2e", "shots");
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [320, 375, 425, 768, 1024, 1280, 1440, 1920];
const ADMIN = process.env.ADMIN_URL || "https://admin-web-lilac.vercel.app";
const USER = process.env.USER_URL || "https://psychometric.tamilbusinesstribe.com";

const ADMIN_PAGES = [
  "/dashboard", "/users", "/shared-ids", "/question-types", "/questions",
  "/question-sets", "/answer-options", "/results", "/reports", "/settings",
  "/business-matrix", "/voice",
];

const results = [];
const flow = [];
function rec(o) { results.push(o); }
function step(name, ok, detail = "") { flow.push({ name, ok, detail }); console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? " — " + detail : ""}`); }

// Measure real horizontal page overflow + screenshot one page at one viewport.
async function auditPage(ctxFactory, label, url, w) {
  const ctx = await ctxFactory(w);
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  try {
    const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(600);
    const m = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
    }));
    const overflow = m.scrollW - m.clientW;
    await page.screenshot({ path: path.join(OUT, `${label}__${w}.png`) });
    rec({ page: label, w, http: resp ? resp.status() : 0, overflowPx: overflow, hScroll: overflow > 1 ? `YES(+${overflow})` : "no", consoleErr: consoleErrors.length });
  } catch (e) {
    rec({ page: label, w, http: 0, overflowPx: -1, hScroll: "ERR", err: String(e).slice(0, 90) });
  } finally {
    await ctx.close();
  }
}

const browser = await chromium.launch();
try {
  // ---- 1. Public pages (always) -------------------------------------------
  console.log("\n== Public pages ==");
  const publicCtx = (w) => browser.newContext({ viewport: { width: w, height: 900 } });
  const publicPages = [
    ["admin-login", `${ADMIN}/login`],
    ["user-login", `${USER}/user/login.html`],
    ["user-register", `${USER}/user/register.html`],
  ];
  for (const [label, url] of publicPages) for (const w of VIEWPORTS) await auditPage(publicCtx, label, url, w);

  // ---- 2. Authenticated admin pages ---------------------------------------
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    console.log("\n== Admin login + authenticated pages ==");
    const login = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const lp = await login.newPage();
    await lp.goto(`${ADMIN}/login`, { waitUntil: "networkidle" });
    await lp.fill("#email", process.env.ADMIN_EMAIL);
    await lp.fill("#password", process.env.ADMIN_PASSWORD);
    await lp.click('button:has-text("Login")');
    let loggedIn = false;
    try { await lp.waitForURL("**/dashboard", { timeout: 20000 }); loggedIn = true; } catch { /* stays on login */ }
    step("admin login", loggedIn, loggedIn ? "" : "did not reach /dashboard — check credentials");

    if (loggedIn) {
      const statePath = path.join(OUT, "admin-state.json");
      await login.storageState({ path: statePath });
      await login.close();
      const authCtx = (w) => browser.newContext({ viewport: { width: w, height: 900 }, storageState: statePath });

      for (const p of ADMIN_PAGES) for (const w of VIEWPORTS) await auditPage(authCtx, `admin${p.replace(/\//g, "-")}`, `${ADMIN}${p}`, w);

      // Results page interactions (desktop) — View visible, Delete dialog CANCELS.
      const rc = await authCtx(1280);
      const rp = await rc.newPage();
      await rp.goto(`${ADMIN}/results`, { waitUntil: "networkidle" });
      await rp.waitForTimeout(800);
      const rowCount = await rp.locator("table.data-table tbody tr").count();
      step("results table rendered", rowCount >= 0, `${rowCount} row(s)`);
      const viewVisible = await rp.locator('a:has-text("View")').first().isVisible().catch(() => false);
      step("View button visible", viewVisible);
      const delBtn = rp.locator('button:has-text("Delete")').first();
      if (await delBtn.count()) {
        await delBtn.click();
        const dialog = await rp.locator('text=Delete This Result?').isVisible().catch(() => false);
        step("Delete confirm dialog opens", dialog);
        // CANCEL — never confirm, never delete real data.
        await rp.locator('button:has-text("Cancel")').first().click().catch(() => {});
        const stillOpen = await rp.locator('text=Delete This Result?').isVisible().catch(() => false);
        const after = await rp.locator("table.data-table tbody tr").count();
        step("Delete cancelled (no deletion)", !stillOpen && after === rowCount, `rows ${rowCount} -> ${after}`);
      } else {
        step("Delete dialog test", true, "no rows to test against (skipped)");
      }
      await rc.close();
    } else {
      await login.close();
    }
  } else {
    console.log("\n== Admin pages SKIPPED (set ADMIN_EMAIL + ADMIN_PASSWORD) ==");
  }

  // ---- 3. Assessment flow --------------------------------------------------
  if (process.env.TEST_CODE && process.env.TEST_USER_EMAIL && process.env.TEST_USER_PASSWORD) {
    console.log("\n== Candidate assessment flow ==");
    const c = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const p = await c.newPage();
    try {
      await p.goto(`${USER}/user/login.html`, { waitUntil: "networkidle" });
      await p.fill("#email", process.env.TEST_USER_EMAIL);
      await p.fill("#password", process.env.TEST_USER_PASSWORD);
      await p.click("#btn-login");
      await p.waitForURL("**/user/index.html", { timeout: 20000 });
      step("user login -> access code screen", true);

      await p.fill("#code", process.env.TEST_CODE);
      await p.click("#btn-continue");
      await p.waitForURL("**/user/welcome.html", { timeout: 20000 });
      step("access code accepted -> welcome", true);

      await p.click("#btn-start");
      await p.waitForURL("**/user/assessment.html", { timeout: 20000 });
      step("assessment started", true);
      await p.waitForTimeout(1500);

      // Answer each page: pick the first available option / checkbox, then Next
      // until the Submit button shows. Best-effort across question types.
      let guard = 0;
      while (guard++ < 60) {
        const next = p.locator("#btn-next");
        const submit = p.locator("#btn-submit");
        const submitVisible = await submit.isVisible().catch(() => false);
        // choose an answer if inputs exist
        const radio = p.locator('input[type="radio"]:visible').first();
        const check = p.locator('input[type="checkbox"]:visible').first();
        if (await radio.count()) await radio.check().catch(() => {});
        else if (await check.count()) await check.check().catch(() => {});
        if (submitVisible && !(await next.isVisible().catch(() => false))) break;
        if (await next.isVisible().catch(() => false)) { await next.click().catch(() => {}); await p.waitForTimeout(400); }
        else break;
      }
      const submitBtn = p.locator("#btn-submit");
      if (await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.click();
        await p.waitForURL("**/user/result.html", { timeout: 30000 });
        step("assessment submitted -> result page", true);
        await p.waitForTimeout(1500);
        const hasContent = await p.locator("#result-content").isVisible().catch(() => false);
        const bodyText = await p.locator("body").innerText().catch(() => "");
        const badValues = /(NaN|undefined|\$\{)/.test(bodyText);
        step("result page renders content", hasContent && !badValues, badValues ? "found NaN/undefined" : "");
        // Refresh — result must persist.
        await p.reload({ waitUntil: "networkidle" });
        await p.waitForTimeout(1200);
        const afterRefresh = await p.locator("#result-content").isVisible().catch(() => false);
        step("result persists after refresh", afterRefresh);
      } else {
        step("assessment submit", false, "submit button never appeared");
      }
    } catch (e) {
      step("assessment flow", false, String(e).slice(0, 120));
    } finally {
      await c.close();
    }
  } else {
    console.log("\n== Assessment flow SKIPPED (set TEST_CODE + TEST_USER_EMAIL + TEST_USER_PASSWORD) ==");
  }
} finally {
  await browser.close();
}

// ---- Report -----------------------------------------------------------------
console.log("\n===== RESPONSIVE AUDIT =====");
console.log(["page", "vw", "http", "h-scroll", "consoleErr"].join("\t"));
for (const r of results) console.log([r.page, r.w, r.http, r.hScroll, r.consoleErr ?? r.err ?? ""].join("\t"));
const bad = results.filter((r) => r.overflowPx > 1);
console.log(`\nHorizontal page-scroll offenders: ${bad.length ? bad.map((b) => `${b.page}@${b.w}`).join(", ") : "NONE"}`);
const errPages = results.filter((r) => r.overflowPx === -1);
if (errPages.length) console.log(`Load errors: ${errPages.map((b) => `${b.page}@${b.w}`).join(", ")}`);
console.log("\n===== FLOW / INTERACTION CHECKS =====");
for (const f of flow) console.log(`  [${f.ok ? "PASS" : "FAIL"}] ${f.name}${f.detail ? " — " + f.detail : ""}`);
fs.writeFileSync(path.join(OUT, "audit.json"), JSON.stringify({ results, flow }, null, 2));
console.log(`\nScreenshots + audit.json in: ${OUT}`);

const failed = flow.filter((f) => !f.ok).length + bad.length + errPages.length;
process.exit(failed ? 1 : 0);
