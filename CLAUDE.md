# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repository Contains

Three distinct things live here:

1. **`build_spec.js`** — a Node.js script that generates a `.docx` specification document for the platform (the spec *generator*, not the platform itself).
2. **`app/`** — the actual Psychometric Assessment Platform implementation: Express backend + vanilla HTML/JS frontend for the user-facing app.
3. **`app/admin-web/`** — the **single, centralized admin application** — a Next.js frontend (React/TypeScript, Tailwind v4). The legacy vanilla admin UI (`app/frontend/admin/`) has been retired; do not recreate it. admin-web talks to the same Express API over CORS (see `ADMIN_WEB_URL` below) rather than being served statically by Express. It has its own `CLAUDE.md`/`AGENTS.md` — **read `app/admin-web/AGENTS.md` before editing code there**: it's on a bleeding-edge Next.js canary with breaking API changes vs. training data, and that file points to `node_modules/next/dist/docs/` for the current APIs.

---

## Spec Generator (`build_spec.js`)

```bash
npm install docx          # root-level dependency
node build_spec.js        # writes Psychometric_Assessment_Platform_Spec_v2.docx
```

The output path is hardcoded near the bottom of the file (the `build()` function). When running locally, update it to a writable path.

### Architecture of `build_spec.js`

Three layers:

**Primitive helpers (top ~330 lines):** `p()`, `txt()`, `h1()`–`h4()`, `body()`, `note()`, `warn()`, `critical()`, `bullets()`, `numbered()` wrap `docx` library primitives.

**Table helpers:** each returns a styled `Table` — `kv()`, `apiTable()`, `fieldTable()`, `dbTable()`, `btnTable()`, `genTable()`.

**Part functions (`part1()`–`part15()`):** each returns an array of `docx` block elements for one spec section. `build()` at the bottom assembles all parts into a single document.

**Key constraints:**
- Column widths are in DXA (1 inch = 1440 DXA; A4 with 1080 DXA margins = 9360 DXA total).
- `note()` / `warn()` / `critical()` are single-cell tables — they cannot contain nested block elements.
- Table cell `children` must be arrays of `Paragraph` or `Table`, never raw strings.
- The three list styles (`bullets`, `subbullets`, `numbers`) are defined once in the `numbering` config inside `build()`; all list items reference them by name.

---

## App (`app/`)

### Setup

```bash
cd app
npm install
cp .env.example .env      # fill in MONGO_URI, JWT_SECRET, GMAIL_USER, GMAIL_PASS
npm run seed              # seeds admin account, question types, 40 questions, answer options
npm run seed:dummy        # additionally seeds dummy users/results, for local dashboard testing
npm run seed:matrix       # seeds dummy BusinessMatrixCell rows, for local matrix-admin testing
npm run dev               # development with nodemon (port 5000)
npm start                 # production
npm test                  # jest --runInBand, against a real MongoDB (see Testing below)
```

To run a single test file: `npx jest tests/adminAuth.test.js --runInBand`.

### Testing

Tests live in `app/tests/` and run against a **real MongoDB**, not mocks — `globalSetup.js`/`globalTeardown.js` spin up a connection and `dbConnect.js` provides it to specs; `tests/setupEnv.js` loads `.env.test` first. The only thing mocked is outbound email (`tests/mocks/emailSender.js`, aliased over the real `utils/emailSender` via `jest.config.js`'s `moduleNameMapper`) so tests don't send real OTP mail. CI (`.github/workflows/ci.yml`) runs `npm test` in `app/` against a `mongo:7` service container on every push/PR to `main`.

### Architecture

**Single-server design:** Express serves both the REST API (`/api/v1/...`) and the user-facing frontend as static files from `frontend/`. There is no build step for it — plain HTML + vanilla JS. The admin app (`app/admin-web/`) is a separate Next.js app, not served by this Express process — see below. Old links to the retired vanilla admin (`/admin/*`) 302-redirect to `ADMIN_WEB_URL`.

**Backend structure:**

```
backend/
  server.js               # entry point — wires middleware, routes, static serving
  config/db.js            # Mongoose connection
  routes/                 # 6 route files
    adminAuth.js          # POST /api/v1/admin/login, /logout, /change-password; GET /profile
    adminCRUD.js          # CRUD for shared-ids, question-types, questions, answer-options
    adminDashboard.js     # GET stats, results list, export (PDF/CSV), email
    adminBusinessMatrix.js # CRUD for BusinessMatrixCell (rowTypeId x colTypeId -> business + rating)
    userAuth.js           # POST /api/v1/user/register, /verify-otp, /login, etc.
    assessment.js         # GET /questions, POST /start, /submit, GET /result
  controllers/            # one controller per route file
  models/                 # Mongoose schemas: Admin, User, SharedUserID, QuestionType,
                          #   Question, AnswerOption, AssessmentSession, UserAnswer, Result,
                          #   BusinessMatrixCell
                          #   (OTPs are stored as fields directly on Admin/User, not a separate model)
  middleware/
    adminAuth.js          # JWT verification for admin routes
    userAuth.js           # JWT verification for user routes
    validate.js           # express-validator result checker
    errorHandler.js       # global error handler
  utils/
    otpGenerator.js       # generates 6-digit OTP
    emailSender.js        # Nodemailer (Gmail)
    scoreCalculator.js    # scoring logic and level thresholds
    exportHelper.js       # PDF (pdfkit) and CSV (json2csv) export
  scripts/
    seed.js                # main seeder — admin account, question types, questions, answer options
    seedData.js            # static seed data referenced by seed.js
    seedDummyData.js       # optional extra dummy users/results for local dashboard testing
    seedBusinessMatrixDummy.js # optional dummy BusinessMatrixCell rows for local matrix-admin testing
```

**Frontend structure:**

```
frontend/
  user/       # 7 HTML pages: index, register, otp-register, login, welcome, assessment, result
  assets/js/  # api.js (fetch wrapper), timer.js, charts.js (Chart.js), validator.js
  assets/css/ # Tailwind-based styles
              # (there is no admin/ subfolder — the admin UI lives entirely in app/admin-web/)
```

### Authentication Flow

Admin and user auth are **not** symmetric:

- **Admin** (`routes/adminAuth.js` / `controllers/adminAuthController.js`): direct `email + password` → JWT. No OTP step. The admin document tracks a single `activeToken`, which is cleared on logout or password change (effectively single-session).
- **User** (`routes/userAuth.js` / `controllers/userAuthController.js`): OTP-over-email — POST registration → server emails a 6-digit OTP → client POSTs OTP to `/verify-otp` → JWT issued. `/resend-otp` is rate-limited to one request per 60 seconds server-side.
- Both `/api/v1/admin/login`, `/api/v1/user/login`, and `/api/v1/user/verify-otp` additionally sit behind a shared 10-requests/minute rate limiter (`backend/app.js`).
- Admin and user JWTs are verified by separate middleware (`middleware/adminAuth.js` / `middleware/userAuth.js`) and carry a `role` claim.
- CORS origins are read from `USER_APP_URL`, `ADMIN_APP_URL`, and `ADMIN_WEB_URL` env vars (the last one is for the standalone `admin-web` Next.js frontend calling the API cross-origin instead of being served statically).

### Key Domain Concepts

- **SharedUserID** — an alphanumeric access code given to users; scoped to a particular assessment cohort.
- **QuestionType** — 8 categories (e.g., verbal, numerical). Each has an `order` 1–8.
- **Question** — 40 questions total, each belongs to a `QuestionType`, has `order` 1–40.
- **AnswerOption** — 1–5 options per question, each carrying a `marks` value (1–5).
- **AssessmentSession** — tracks in-progress / submitted / expired state with a timer (`expiresAt`).
- **Result** — one per submitted session; stores total/percentage/level, per-category scores (`Map`), recommended business areas, and improvement suggestions.
- **scoreCalculator** — aggregates marks per question type, maps totals to named levels via `BUSINESS_MAP`.
- **BusinessMatrixCell** — admin-editable `rowTypeId` × `colTypeId` (both `QuestionType` refs) → recommended `businessName` + `rating` (1–5), unique per pair; managed via `adminBusinessMatrix.js`, separate from the static `BUSINESS_MAP` in `scoreCalculator`.

---

## Admin Web (`app/admin-web/`) — the single admin application

```bash
cd app/admin-web
npm install
npm run dev      # Next.js dev server, port 3000
npm run build
npm run lint
```

Standalone Next.js (App Router, TypeScript, Tailwind v4) app, not served by the Express `app/backend`. It calls the same backend REST API cross-origin — point it at the running `app/backend` server and make sure that server's `ADMIN_WEB_URL` env var matches this app's origin, or CORS will reject the requests. Uses Chart.js for dashboard charts and Playwright (devDependency) for e2e tests. **See `app/admin-web/AGENTS.md` for required reading before writing Next.js code here** — it's on a canary release with API surface that differs from stable Next.js.

There is no other admin frontend — do not add HTML pages under `app/frontend/` for admin features; extend admin-web instead.

---

## Deployment

Single Render web service via `render.yaml` at the repo root (rootDir `app/`); auto-deploys on push to `main`. Full walkthrough (MongoDB Atlas, Gmail app password, Render env vars, production seeding) is in `DEPLOYMENT.md`. Note `admin-web` — the only admin frontend — is not part of this blueprint; it's a separate deploy target (e.g. Vercel) not yet wired up.
