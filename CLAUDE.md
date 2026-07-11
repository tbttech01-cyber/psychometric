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

Tests live in `app/tests/` and run against a **real MongoDB**, not mocks — `globalSetup.js`/`globalTeardown.js` spin up a connection and `dbConnect.js` provides it to specs; `tests/setupEnv.js` loads `.env.test` first. The only thing mocked is outbound email (`tests/mocks/emailSender.js`, aliased over the real `utils/emailSender` via `jest.config.js`'s `moduleNameMapper`) so tests don't send real OTP mail. CI (`.github/workflows/ci-cd.yml`, `test-backend` job) runs `npm test` in `app/` against a `mongo:7` service container on every push/PR to `main` — see "CI/CD" under Deployment below for the full pipeline.

### Architecture

**Single-server design:** Express serves both the REST API (`/api/v1/...`) and the user-facing frontend as static files from `frontend/`. There is no build step for it — plain HTML + vanilla JS. The admin app (`app/admin-web/`) is a separate Next.js app, not served by this Express process — see below. Old links to the retired vanilla admin (`/admin/*`) 302-redirect to `ADMIN_WEB_URL`.

**Backend structure:**

```
backend/
  server.js               # thin entry point — connectDB() then app.listen()
  app.js                  # the real Express app — middleware, CORS, rate limiters,
                          #   lazy serverless DB connect, routes, static serving of frontend/
  config/db.js            # Mongoose connection
  routes/                 # 7 route files
    adminAuth.js          # POST /api/v1/admin/login, /logout, /change-password; GET /profile
    adminCRUD.js          # CRUD for shared-ids, question-types, questions, answer-options
    adminDashboard.js     # GET stats, results list, export (PDF/CSV), email
    adminBusinessMatrix.js # CRUD for BusinessMatrixCell (rowTypeId x colTypeId -> business + rating)
    adminQuestionSets.js  # CRUD for QuestionSet (a set's questionIds array order IS its question order)
    userAuth.js           # POST /api/v1/user/register, /verify-otp, /login, etc.
    assessment.js         # GET /questions, POST /start, /submit, GET /result
  controllers/            # one controller per route file
  models/                 # Mongoose schemas: Admin, User, SharedUserID, QuestionType,
                          #   Question, AnswerOption, AssessmentSession, UserAnswer, Result,
                          #   BusinessMatrixCell, Setting, QuestionSet, QuestionAudio
                          #   (OTPs are stored as fields directly on Admin/User, not a separate model)
  middleware/
    adminAuth.js          # JWT verification for admin routes
    userAuth.js           # JWT verification for user routes
    validate.js           # express-validator result checker
    errorHandler.js       # global error handler
  utils/
    otpGenerator.js       # generates 6-digit OTP
    emailSender.js        # Nodemailer (Gmail)
    evaluationEngine.js   # per-questionType answer scoring — the ONLY place scoring rules live
    scoreCalculator.js    # aggregates evaluationEngine output into category + dimension results
    businessRecommendationEngine.js # rule-based business suggestions, driven by dimension percentages
    exportHelper.js       # PDF (pdfkit) and CSV (json2csv) export
  scripts/
    seed.js                # main seeder — admin account, question types, questions, answer options
    seedData.js            # static seed data referenced by seed.js
    seedDummyData.js       # optional extra dummy users/results for local dashboard testing
    seedBusinessMatrixDummy.js # optional dummy BusinessMatrixCell rows for local matrix-admin testing
    migratePhase1QuestionTypes.js # one-time backfill: sets dimension/questionType/marks on pre-existing
                          #   Questions (maps each legacy QuestionType.name to its canonical dimension)
    migrateQuestionSets.js # one-time: bundles all active questions into a "Default Set", assigns it to
                          #   every access code, backfills in-progress sessions (idempotent). Run:
                          #   `node backend/scripts/migrateQuestionSets.js`
    generateQuestionAudio.js # generates free neural-TTS mp3 per active question (Microsoft Edge
                          #   voices via utils/edgeTts.js) and caches it in QuestionAudio. Idempotent
                          #   (skips unchanged text; --force re-does all). Run with the target DB's
                          #   MONGO_URI — offline only; the deployed server never calls the TTS endpoint.
```

**Frontend structure:**

```
frontend/
  user/       # 7 HTML pages: index, register, otp-register, login, welcome, assessment, result
  assets/js/  # api.js (fetch wrapper — reads `window.TBT_API_BASE` for the API origin, see Deployment), timer.js, charts.js (Chart.js), validator.js
  assets/css/ # Tailwind-based styles
              # (there is no admin/ subfolder — the admin UI lives entirely in app/admin-web/)
```

### Authentication Flow

Admin and user auth are **not** symmetric:

- **Admin** (`routes/adminAuth.js` / `controllers/adminAuthController.js`): direct `email + password` → JWT. No OTP step. The admin document tracks a single `activeToken`, which is cleared on logout or password change (effectively single-session).
- **User** (`routes/userAuth.js` / `controllers/userAuthController.js`): OTP-over-email — POST registration → server emails a 6-digit OTP → client POSTs OTP to `/verify-otp` → JWT issued. `/resend-otp` is rate-limited to one request per 60 seconds server-side.
- Both `/api/v1/admin/login`, `/api/v1/user/login`, and `/api/v1/user/verify-otp` additionally sit behind a shared 10-requests/minute rate limiter (`backend/app.js`).
- Admin and user JWTs are verified by separate middleware (`middleware/adminAuth.js` / `middleware/userAuth.js`) and carry a `role` claim.
- CORS is allowlist-based (`backend/app.js`): origins from `USER_APP_URL`, `ADMIN_APP_URL`, and `ADMIN_WEB_URL` env vars (the last one is for the standalone `admin-web` Next.js frontend calling the API cross-origin instead of being served statically) are always allowed, and `http://localhost:*` / any `*.vercel.app` origin is allowed unconditionally on top of that allowlist (so preview deploys work without an env var update).

### Key Domain Concepts

- **SharedUserID** — an alphanumeric access code given to users; scoped to a particular assessment cohort. Carries a `questionSetId` — the **QuestionSet that cohort's users are assessed on** (nullable; users of an unassigned code are blocked at `/start`).
- **QuestionSet** — a named, admin-managed group of questions with its own `durationMinutes` (per-set timer). `questionIds` is an **ordered array of Question refs where array position IS the per-set order** (decoupled from the globally-unique `Question.order` — the same question can sit at different positions in different sets). Questions are **shared**: a question can belong to many sets, and deleting a set never deletes its questions (deletion is blocked, 409, while any access code still references the set). Managed via `adminQuestionSets.js`; reordering is just a PUT with the array in a new sequence (no separate reorder endpoint).
- **QuestionType** — the category grouping shown to admins/users (e.g., verbal, numerical). Each has a unique `order`. Distinct from `Question.questionType` below — the naming collision is real, don't conflate them.
- **Question** — belongs to a `QuestionType` category (`typeId`) and additionally carries a `questionType` enum describing its *answer shape*: `LIKERT_SCALE`, `SITUATIONAL`, `NUMERICAL_ABILITY`, `PERCENTAGE_TYPE`, `PUZZLE_TYPE`, `LOGICAL_ABILITY`, `VERBAL_ABILITY`, `IMAGE_BASED`, `MULTI_SELECT`, `RANKING` (see `models/Question.js`'s `QUESTION_TYPES`). Each question also has a `dimension` (one of 12 psychometric traits in `Question.DIMENSIONS` — Communication, Leadership, Problem Solving, etc.) that its score rolls up into for the report's dimension breakdown, independent of its `QuestionType` category. Type-specific fields (`correctOptionId`, `correctOptionIds`, `idealOrder`, `scoringMode`) are all on one schema rather than split across models.
- **Question audio** — when `hasAudio` is set, the admin uploads an audio clip that's stored **inline as a base64 data URI in `audioUrl`** (no external file storage — chosen for portability across the Vercel/Render deploys). Uploads are capped at 3 MB client-side (`admin-web` questions form) and `audioUrl.length` is bounded server-side (`routes/adminCRUD.js`); `backend/app.js` raises the `express.json` body limit to 8 MB to fit the payload. `adminCRUDController.listQuestions` excludes `audioUrl` from the questions list (only `getQuestion` and the candidate `getQuestions` return it) so the base64 blobs don't bloat list responses. **Every** candidate question shows a custom Play/Pause/Resume/Replay/Stop control (`frontend/user/assessment.html` `renderAudio` + `startPlayback`), with a **3-tier audio priority**: (1) admin-uploaded `audioUrl`; else (2) cached **neural TTS** — an mp3 pre-generated by `scripts/generateQuestionAudio.js`, stored in `QuestionAudio`, flagged per-question by `getQuestions` as `neuralAudio` and fetched lazily from `GET /api/v1/assessment/questions/:id/audio`; else (3) the browser Web Speech API reading `question.text` (language auto-detected — Tamil `U+0B80–U+0BFF` → `ta-IN`, else `en-US`). Only one clip/utterance ever plays (`stopAllPlayback`); navigation/submit/exit stop it.
- **AnswerOption** — options carry a `score` (not a fixed `marks` value); `SITUATIONAL` options additionally carry `dimensionScores` (one option maps to multiple dimensions at once, e.g. `{Communication: 5, Teamwork: 4}`).
- **evaluationEngine.js** — one evaluator function per `questionType`, dispatched by `evaluateAnswer(question, options, userAnswer)`. This is the only place scoring rules live; controllers must never inline per-type logic. `NUMERICAL_ABILITY`/`PERCENTAGE_TYPE`/`PUZZLE_TYPE`/`LOGICAL_ABILITY`/`VERBAL_ABILITY`/`IMAGE_BASED` all share `evaluateSingleCorrect` (correct option → full marks, else 0).
- **UserAnswer** — exactly one of `answerOptionId` (single-select types), `selectedOptionIds` (`MULTI_SELECT`), or `rankingOrder` (`RANKING`) is populated, depending on the question's `questionType`.
- **AssessmentSession** — tracks in-progress / submitted / expired state with a timer (`expiresAt`). At `startSession` it **snapshots the resolved set** onto the session: `questionSetId`, an ordered `questionIds` (the frozen list this attempt is scored against), and `durationMinutes`. `getQuestions` and `submitAssessment` read this snapshot — **not** the live set — so mid-attempt admin edits (reorder, membership, timer, cohort reassignment, deactivating a reused question) can't corrupt an in-flight attempt. Safe because question delete is a soft-delete, so a snapshotted id always resolves. Question *content/marks/options* are still live-read at submit (scoring stays server-authoritative). `assessmentController.resolveUserSet(user)` maps a user → their code's set → active-filtered, order-preserved question ids.
- **scoreCalculator.calculateResult** — aggregates `UserAnswer` scores two ways: per `QuestionType` category and per `dimension` (summed across whatever dimensions each answer's `dimensionScores` touches — most types touch one, `SITUATIONAL` touches several). Maxes come from `computeQuestionMaxes` over the **session's snapshot question set** (not all active questions), so **percentages are relative to the set the candidate actually took**. The function is parameterized on the question array, so no change was needed for set-scoping. Also derives `aptitudeScore`/`personalityScore`/`businessMindsetScore`/`financialAwarenessScore` as averages over fixed dimension groupings, and calls `businessRecommendationEngine` for recommendations.
- **businessRecommendationEngine.getRecommendations(dimensionPercentages)** — ordered rule list matched against dimension percentages (e.g. high Communication + Leadership + Risk Taking → sales/marketing businesses), deduped and capped at 5, with a fallback set if nothing matches. Replaces the old static `BUSINESS_MAP` (still present in `scoreCalculator.js` but superseded for new results).
- **Result** — one per submitted session. Original fields (total/percentage/level, per-category scores, `recommendedBusiness`, `improvementAreas`) plus additive fields for dimension scoring (`dimensionScores`, `dimensionPercentages`, `strongDimensions`/`weakDimensions`, the four composite scores, `recommendations`) — the additive fields are absent on Result documents created before this was introduced, so treat them as optional when reading.
- **BusinessMatrixCell** — admin-editable `rowTypeId` × `colTypeId` (both `QuestionType` refs) → recommended `businessName` + `rating` (1–5), unique per pair; managed via `adminBusinessMatrix.js`, separate from both `BUSINESS_MAP` and `businessRecommendationEngine`.
- **Setting** — a generic `key`/`value` (Mixed) store for admin-configurable platform settings. Holds `assessment_duration_minutes` (default 30 when unset). Since per-QuestionSet timers were introduced this is **no longer the live assessment timer** — each attempt's duration comes from its snapshot set's `durationMinutes`. It now serves as a **fallback** (the migration seeds the Default Set's timer from it; `getSettings` falls back to it only when a cohort has no usable set) and as the admin-editable default used to pre-fill a new set's timer. Still exposed at `GET /api/v1/assessment/settings` (now reflects the caller's own set duration) and `GET`/`POST /api/v1/admin/settings`. `AssessmentTimer` (`frontend/assets/js/timer.js`) accepts either a duration-in-seconds number or an absolute `expiresAt` date.

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

Two independent deploy paths exist for the Express app (`app/`), both driven by the same `backend/app.js`:

- **Render** (primary): single web service via `render.yaml` at the repo root (rootDir `app/`), running `backend/server.js`; auto-deploys on push to `main`. Full walkthrough (MongoDB Atlas, Gmail app password, Render env vars, production seeding) is in `DEPLOYMENT.md`.
- **Vercel** (standalone/serverless): `app/api/index.js` re-exports `backend/app.js` as the serverless entrypoint; `app/vercel.json` rewrites all requests to it. Since there's no boot-time hook on a serverless platform, `backend/app.js` connects to MongoDB lazily on first request and caches the connection on `global.__tbtMongoConnect` for warm invocations (`backend/server.js`'s `connectDB()` call is a no-op in this mode since the connection is already established). The candidate frontend (`frontend/`) reads its API origin from `window.TBT_API_BASE` (`frontend/assets/js/api.js`) so it can be hosted standalone on Vercel pointing at a separately-hosted API — set that global (e.g. injected via env at build/deploy time) when the frontend and API aren't on the same origin.

`admin-web` is not part of either blueprint above — it's always a separate deploy target (e.g. Vercel) calling the API cross-origin; see its `ADMIN_WEB_URL` CORS requirement above.

### CI/CD (`.github/workflows/ci-cd.yml`)

A single GitHub Actions workflow covers both halves of the repo and runs on every push/PR to `main`:
- `test-backend` — `app/`'s Jest suite against a `mongo:7` service container (same as the old `ci.yml`).
- `build-admin-web` — installs, lints (non-blocking), and runs `next build` for `app/admin-web/`.
- `deploy-backend` / `deploy-admin-web` — on a push to `main` only, and gated on the corresponding test/build job passing, deploy each app to its own Vercel project via the Vercel CLI (`vercel pull` → `vercel build --prod` → `vercel deploy --prebuilt --prod`). Requires a `VERCEL_TOKEN` repo secret; production env vars live in each Vercel project's dashboard, not in the workflow. See `DEPLOYMENT.md` §6 for full setup.

This is independent of Render's own git-based auto-deploy (still active per its own dashboard setting) — the two are not mutually exclusive.
