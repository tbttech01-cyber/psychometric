# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repository Contains

Two distinct things live here:

1. **`build_spec.js`** — a Node.js script that generates a `.docx` specification document for the platform (the spec *generator*, not the platform itself).
2. **`app/`** — the actual Psychometric Assessment Platform implementation: Express backend + vanilla HTML/JS frontend.

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
npm run dev               # development with nodemon (port 5000)
npm start                 # production
```

### Architecture

**Single-server design:** Express serves both the REST API (`/api/v1/...`) and the frontend as static files from `frontend/`. There is no build step — the frontend is plain HTML + vanilla JS.

**Backend structure:**

```
backend/
  server.js               # entry point — wires middleware, routes, static serving
  config/db.js            # Mongoose connection
  routes/                 # 5 route files
    adminAuth.js          # POST /api/v1/admin/login, /verify-otp, /logout
    adminCRUD.js          # CRUD for shared-ids, question-types, questions, answer-options
    adminDashboard.js     # GET stats, results list, export (PDF/CSV), email
    userAuth.js           # POST /api/v1/user/register, /verify-otp, /login, etc.
    assessment.js         # GET /questions, POST /start, /submit, GET /result
  controllers/            # one controller per route file
  models/                 # Mongoose schemas: Admin, User, SharedUserID, QuestionType,
                          #   Question, AnswerOption, AssessmentSession, UserAnswer, Result
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
  scripts/seed.js         # database seeder
```

**Frontend structure:**

```
frontend/
  user/       # 7 HTML pages: index, register, otp-register, login, welcome, assessment, result
  admin/      # 8 HTML pages: login, otp, dashboard, shared-ids, results, question-types,
              #               questions, answer-options
  assets/js/  # api.js (fetch wrapper), timer.js, charts.js (Chart.js), validator.js
  assets/css/ # Tailwind-based styles
```

### Authentication Flow

Both admin and user auth use an OTP-over-email pattern:
1. POST credentials → server emails a 6-digit OTP → client POSTs OTP to `/verify-otp` → JWT issued.
2. Auth endpoints are rate-limited to 10 requests/minute.
3. Admin and user JWTs are verified by separate middleware (`adminAuth` / `userAuth`).

### Key Domain Concepts

- **SharedUserID** — an alphanumeric access code given to users; scoped to a particular assessment cohort.
- **QuestionType** — 8 categories (e.g., verbal, numerical). Each has an `order` 1–8.
- **Question** — 40 questions total, each belongs to a `QuestionType`, has `order` 1–40.
- **AnswerOption** — 1–5 options per question, each carrying a `marks` value (1–5).
- **AssessmentSession** — tracks in-progress / submitted / expired state with a timer (`expiresAt`).
- **Result** — one per submitted session; stores total/percentage/level, per-category scores (`Map`), recommended business areas, and improvement suggestions.
- **scoreCalculator** — aggregates marks per question type, maps totals to named levels via `BUSINESS_MAP`.
