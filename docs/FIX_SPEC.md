# Fix Specification — Psychometric Assessment Platform

**Source:** Full-app audit (backend, candidate frontend, admin-web, repo/deploy).
**Status:** proposed — nothing here is implemented yet.
**How to read each item:** *Problem → Impact → Fix → Acceptance criteria → Effort.*
Severity: 🔴 critical · 🟠 high · 🟡 medium · ⚪ low. Effort: S (<30m) · M (~1–2h) · L (half-day+).

Work the phases in order. Phase 0 is safe to ship immediately; each item is independent unless noted.

---

## Phase 0 — Critical security (ship first)

### FIX-1 🔴 Stop logging OTPs / access codes in plaintext — **S**
- **Files:** `app/backend/utils/emailSender.js:26`, `:54`
- **Problem:** `console.log('[EMAIL BYPASS] OTP for ${toEmail} (${toName}): ${otp}')` and the welcome-email `sharedCode` log run **unconditionally**, before the dev-bypass check — so every OTP and access code is written to production logs (Vercel/Render).
- **Impact:** Anyone with log access can read live OTPs → account-verification hijack; access codes leak.
- **Fix:** Remove both `console.log` lines. If a local-dev convenience is wanted, emit only inside the existing dev branch and **never** include the code value (e.g. `console.log('[DEV] OTP email skipped for', toEmail)`).
- **Acceptance:** grep for `OTP for` / `sharedCode:` in `utils/` returns nothing; register/verify still work; production logs contain no code values.

### FIX-2 🔴 Make assessment auto-submit server-authoritative — **M**
- **Files:** `app/backend/controllers/assessmentController.js:194` (`autoSubmitted` from body), `:204` (expiry check), `:228` (unresolved-questions check)
- **Problem:** `autoSubmitted` is trusted from `req.body`. Sending `autoSubmitted: true` skips **both** the `expiresAt + BUFFER` cutoff and the "all questions answered" requirement.
- **Impact:** A candidate can submit long after time expired, partially answered — the timed-assessment guarantee is only advisory.
- **Fix:**
  - Derive it server-side: `const isExpired = Date.now() > session.expiresAt.getTime() + BUFFER_MS; const autoSubmitted = isExpired;` (ignore the body field, or keep it only as a hint).
  - Always reject a submit that arrives past the hard cutoff **and** was not the server's own timeout path — i.e. never let a client-set flag waive the cutoff.
  - Keep the "all questions resolved" rule for on-time manual submits; only a genuinely-expired (server-detected) submit may be partial.
- **Acceptance:** A submit with a forged `autoSubmitted:true` sent after `expiresAt+buffer` is rejected (400); a legitimate expired submit still scores partial answers. Add a test in `app/tests/userAssessment.test.js` covering both.

### FIX-3 🔴 Guard `GMAIL_PASS` access — **S**
- **Files:** `app/backend/utils/emailSender.js:28`, `:56`
- **Problem:** `process.env.GMAIL_PASS.includes('xxxx')` throws `TypeError` when the var is unset → 500 on register/verify (the case the bypass exists for).
- **Fix:** `(process.env.GMAIL_PASS || '').includes('xxxx')` in both places.
- **Acceptance:** With `GMAIL_PASS` unset in dev, register/verify returns cleanly (bypass path), no 500.

---

## Phase 1 — Abuse resistance & robustness

### FIX-4 🟠 Rate-limit the unauthenticated auth surface — **M**
- **Files:** `app/backend/app.js` (limiter defs ~`:88`), `app/backend/routes/userAuth.js`; resend branch `app/backend/controllers/userAuthController.js:52-61`
- **Problem:** `POST /user/validate-code`, `/user/select-code`, and `/user/register` have no rate limit. `validate-code` allows access-code brute-force + label disclosure; `register`'s existing-unverified branch re-sends OTP with no cooldown → inbox/Gmail-quota flooding.
- **Fix:**
  - Add a limiter (e.g. 10/min per IP) to `validate-code`, `select-code`, and `register` — reuse the existing `express-rate-limit` instance pattern already applied to login/verify.
  - In the register resend branch, apply the same 60s cooldown used by `resendOTP` (`:137-139`).
- **Acceptance:** 11th `validate-code` in a minute → 429; repeated register for an unverified email within 60s → 429/cooldown message.

### FIX-5 🟠 Atomic session state transitions — **M**
- **Files:** `app/backend/controllers/assessmentController.js:200` (submit guard), `:328` (status write), `:165-170` (start guard); `app/backend/models/Result.js`, `AssessmentSession.js`
- **Problem:** Check-then-write with awaits between and no atomic transition. Two concurrent `/submit` for one session can both pass → duplicate `Result`s + double `usageCount`. Same shape in `startSession`.
- **Fix:**
  - Submit: replace the read guard with an atomic claim — `const session = await AssessmentSession.findOneAndUpdate({ _id: sessionId, userId, status: 'in-progress' }, { status: 'submitting' }, { new: true });` and bail 400 if null. Finalize to `submitted` at the end.
  - Add `unique` index on `Result.sessionId` as a backstop.
  - Start: rely on a unique partial index (one `in-progress` session per user) or `findOneAndUpdate` upsert semantics.
- **Acceptance:** Two parallel submits for one session → exactly one `Result`, one `usageCount` increment; the loser gets 400. Unique index present.

### FIX-6 🟡 Escape user input used in `RegExp` — **S**
- **Files:** `app/backend/controllers/adminCRUDController.js:24`, `adminDashboardController.js:77,88-92,139,164`
- **Problem:** `search`/`business` params flow into `new RegExp(value, 'i')` unescaped → ReDoS (admin-only) and altered match semantics.
- **Fix:** Add a small `escapeRegExp(s)` helper (`s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`) and wrap every dynamic RegExp; or switch exact-match filters to `$eq`/`$text`.
- **Acceptance:** A search of `(a+)+$` returns promptly with literal matching, no event-loop hang.

### FIX-7 🟠 Kill infinite loading spinners on API failure — **M**
- **Files:** `app/frontend/user/result.html:99-100`, `app/frontend/user/assessment.html:109-116`
- **Problem:** On `!ok`, code toasts and `return`s without hiding `#loading` or rendering an error → permanent spinner, no recovery. `assessment.html:111 sections = data.data` can throw if `data.data` is missing.
- **Fix:** On failure, hide the spinner and render an inline error block with a **Retry** button that re-invokes the loader. Guard `if (!data.data) { showError(); return; }` before iterating.
- **Acceptance:** With the API forced to fail, the page shows an error + working Retry (not a spinner); a malformed `ok` response doesn't throw.

### FIX-8 🟠 Real `<form>` semantics on auth screens — **M**
- **Files:** `app/frontend/user/login.html:19-29`, `register.html:21-42`, `index.html:20-27`, `otp-register.html:20-25`
- **Problem:** Inputs sit loose in `<div>`s with click-only buttons → Enter doesn't submit; no `autocomplete`/`name` → password managers & mobile autofill don't engage.
- **Fix:** Wrap fields in `<form>` with an `onsubmit` handler (`e.preventDefault()` then existing logic). Add `name` + `autocomplete`: `email`, `current-password` (login), `new-password` (register), `one-time-code` + `inputmode="numeric"` (OTP boxes).
- **Acceptance:** Enter submits each form; browser offers save/autofill; OTP boxes show numeric keypad on mobile.

---

## Phase 2 — admin-web correctness

### FIX-9 🟠 Type the API envelope & make lint blocking — **M**
- **Files:** `app/admin-web/lib/api.ts:3,5,38,44-47`; call sites `dashboard/page.tsx:24-26`, `reports/page.tsx:32`, `results/page.tsx:72`, `questions/page.tsx:101`; `.github/workflows/ci-cd.yml:67-68`
- **Problem:** `ApiResult<T = any>` + `get/post<T = any>` disable checking at ~90% of call sites. Two **incompatible** response conventions coexist (`data.data` envelope vs raw `data` on dashboard/reports) and only "work" because everything is `any`. CI lint is `continue-on-error`, so nothing catches a shape break → runtime crash with zero signal.
- **Fix:**
  - Define one `type ApiEnvelope<T> = { success: boolean; message?: string; data: T; total?: number; pages?: number; stats?: unknown }`.
  - Default generics to `unknown`, not `any`; type each call site to the endpoint's real shape.
  - Normalize `/admin/dashboard` + `/reports` to the same `{success,data}` envelope as everything else (or document the exception explicitly and type it).
  - Remove `continue-on-error: true` from the admin-web lint step **after** the `any`s are cleared, so regressions fail CI.
- **Acceptance:** `npm run lint` passes with no `Unexpected any`; `next build` clean; dashboard/reports read from a typed envelope; CI lint is blocking.

### FIX-10 🟡 admin-web login hardening — **S**
- **Files:** `app/admin-web/app/login/page.tsx:47-48,122-124`; `lib/api.ts:52`
- **Problem:** `setToken(data.token)` without checking `token` exists → `"undefined"` stored, treated as logged-in, every call 401s. "Forgot Password?" is a dead `<span>`.
- **Fix:** Guard `if (!data.token) { showToast('Login failed.'); return; }`. Remove the non-functional Forgot-Password element (or wire a real flow).
- **Acceptance:** A tokenless 200 doesn't fake a session; no dead interactive-looking control.

---

## Phase 3 — Professionalism & hygiene

### FIX-11 🟡 Write real READMEs — **S**
- **Files:** `README.md` (15-byte stub), `app/admin-web/README.md` (create-next-app boilerplate)
- **Fix:** Root README: one-paragraph overview, the three-app architecture, local setup, env vars, test + deploy pointers (link `DEPLOYMENT.md`, `CLAUDE.md`). admin-web README: its own setup + `NEXT_PUBLIC_API_URL`/CORS note.
- **Acceptance:** A new dev can clone and run each app from the README alone.

### FIX-12 🟡 De-clutter the repo root — **M**
- **Files (root):** `Psychometric_Assessment_Platform_Spec_v2.docx`, `build_spec.js`, `TBT Logo - White.png`, root `package.json`/`package-lock.json` (only dep: `docx`), untracked `Screenshot *.png`; `.gitignore`
- **Fix:** Move spec-authoring tooling (`build_spec.js` + its root `package.json` + the `.docx`) into a separate `tools/spec/` folder or its own repo; relocate the logo under app assets if used, else drop. Extend root `.gitignore` with `Screenshot*.png`, `*.docx`, editor/OS files. (Note: `*.pdf` already ignored; the 45 MB PDF is **not** committed.)
- **Acceptance:** Repo root contains only product-relevant files; `git status` never surfaces stray screenshots.

### FIX-13 🟡 Brand the production API origin — **M**
- **Files:** `.github/workflows/ci-cd.yml:129` (`TBT_API_BASE: https://backend-three-peach-48.vercel.app`)
- **Problem:** The candidate frontend's API base is a random Vercel project slug — leaks internal naming to users, breaks if the project is renamed.
- **Fix:** Attach a custom domain to the backend project (e.g. `api.tamilbusinesstribe.com`), set that as `TBT_API_BASE` (ideally a GitHub Actions **variable**/Vercel env var, not a hardcoded literal), add it to the backend CORS allowlist.
- **Acceptance:** Live `env.js` points at the branded domain; API + CORS still work; renaming the Vercel project doesn't break the frontend.

### FIX-14 🟡 Choose one canonical deploy topology — **M**
- **Files:** `render.yaml`, `app/vercel.json`, `.github/workflows/ci-cd.yml`, `DEPLOYMENT.md`
- **Problem:** The candidate frontend ships **twice** — Express-static (Render, same-origin) *and* the standalone `user-web` Vercel project (cross-origin) — which can drift and doubles build minutes.
- **Fix:** Pick one production path. Recommended: keep the three-project Vercel topology as canonical, disable Render auto-deploy (or vice-versa), and document the single set of production URLs in `DEPLOYMENT.md`.
- **Acceptance:** One documented production URL per app; no duplicate/ambiguous frontend deploys.

### FIX-15 ⚪ Remove dead UI & upgrade CI Node — **S**
- **Files:** admin-web `questions/page.tsx:279-280` (dead "coming soon" branch, `ENABLED_TYPES` always full — `lib/types.ts:9`); `.github/workflows/ci-cd.yml:38,58,94,135,167` (Node 20, near EOL)
- **Fix:** Delete the unreachable disabled-type branch (or make `ENABLED_TYPES` meaningful). Bump all jobs to `node-version: '22'`; set matching `engines` in the package.json files.
- **Acceptance:** No unreachable branches; CI runs on Node 22 green.

### FIX-16 🟡 Accessibility pass (candidate app) — **M**
- **Files:** `app/frontend/user/otp-register.html:20-25`, `assessment.html:486,507` (`alt=""`), `:575-580` (dot-nav), `:540-541` (ranking arrows), `:672-711` (focus on nav)
- **Fix:** OTP boxes: `aria-label="OTP digit N"`, `inputmode="numeric"`, `autocomplete="one-time-code"`. IMAGE_BASED: non-empty descriptive `alt` (server-provided). Add `aria-label` to dot-nav ("Go to section N") and ranking arrows ("Move up"/"Move down"). On `showSection()`, move focus to the new section heading (`tabindex="-1"`) or add an `aria-live` announcement. Pair color-only status (timer danger, dot state) with text/shape.
- **Acceptance:** Keyboard + screen-reader can complete the assessment; automated a11y check (axe) shows no critical violations on each page.

---

## Suggested batching

| Batch | Items | Why together |
|---|---|---|
| **A — security hotfix** | FIX-1, FIX-2, FIX-3 | Small, high-impact, backend-only; ship same day + tests |
| **B — abuse & robustness** | FIX-4, FIX-5, FIX-6, FIX-7 | Backend hardening + the worst frontend UX dead-end |
| **C — admin correctness** | FIX-9, FIX-10 | Types + login guard; unblocks blocking-lint |
| **D — polish & hygiene** | FIX-8, FIX-11, FIX-12, FIX-14, FIX-15, FIX-16 | Professionalism + a11y; mostly independent |
| **E — infra** | FIX-13, FIX-14 | Needs a domain + Vercel/Render dashboard access |

Backend fixes must keep `app/tests` green (`cd app && npm test`); add the new tests noted in FIX-2 and FIX-5. Frontend/admin changes should be verified by driving the real flow, not just build.
