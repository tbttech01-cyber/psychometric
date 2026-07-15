# E2E / responsive audit (Playwright)

`audit.mjs` drives the **production** admin + candidate apps with a real
Chromium browser. It is **read-only** — it never creates or deletes real data
(the Delete test opens the confirmation dialog and cancels).

## Run

```bash
cd app/admin-web
node e2e/audit.mjs
```

Public pages (admin login, candidate login/register) are always audited across
these viewports: 320, 375, 425, 768, 1024, 1280, 1440, 1920.

### Optional credentialed sections (env vars)

```bash
# Audit every authenticated admin page + Results View/Delete-cancel checks:
ADMIN_EMAIL="..." ADMIN_PASSWORD="..." node e2e/audit.mjs

# Also drive the full candidate assessment flow. Opens a VISIBLE browser and
# PAUSES at the OTP screen (admin login needs no OTP; candidate register/login
# does) — type the OTP in that window and it resumes automatically through
# submit -> result -> refresh.
TEST_CODE="..." TEST_USER_EMAIL="..." TEST_USER_PASSWORD="..." \
TEST_USER_MODE="register" \
node e2e/audit.mjs
```

- `TEST_USER_MODE`: `register` (default — registers then waits for the emailed
  OTP) or `login` (a verified user; still pauses if an OTP appears).
- `TEST_USER_NAME`: optional display name when registering.
- The OTP pause waits up to **5 minutes**; run in a terminal you control so it
  isn't killed while you fetch the OTP.

Overrides: `ADMIN_URL`, `USER_URL`, `OUT_DIR` (screenshot dir, default `e2e/shots`).

## Output

Screenshots (`<page>__<viewport>.png`) and `audit.json` land in `OUT_DIR`.
The console prints a per-page horizontal-overflow table and PASS/FAIL flow
checks. Exit code is non-zero if any overflow offender, load error, or flow
check fails.

`e2e/shots/` is gitignored — it also holds `admin-state.json` (a logged-in
storage state containing an auth token), which must never be committed.
