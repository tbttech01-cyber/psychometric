# Psychometric Assessment Platform

A web platform (by Tamil Business Tribe) that runs psychometric assessments for
candidates and gives admins tools to manage questions, cohorts, and results. It
scores each candidate across psychometric dimensions and produces
business-readiness recommendations.

## What's in this repo

Three independently-deployable applications plus a spec generator:

| Path | What it is | Stack |
|------|------------|-------|
| `app/backend` | REST API (`/api/v1/...`) + serves the candidate frontend | Express, MongoDB (Mongoose), JWT |
| `app/frontend` | Candidate-facing assessment UI | Vanilla HTML + JS, Tailwind (no framework) |
| `app/admin-web` | The single admin application | Next.js (App Router), React, TypeScript, Tailwind |
| `build_spec.js` | Internal tool that generates the platform spec `.docx` (not the product) | Node, `docx` |

The candidate flow is **Login → Access Code → Question Set**: a user logs in,
enters an access code, and is assessed on the question set bound to that code.
See `CLAUDE.md` for the full architecture and domain model.

## Quick start

### Backend + candidate frontend (`app/`)

```bash
cd app
npm install
cp .env.example .env        # fill in MONGO_URI, JWT_SECRET, GMAIL_USER, GMAIL_PASS
npm run seed                # admin account, question types, questions, answer options
npm run dev                 # nodemon on http://localhost:5000
```

Optional seeders: `npm run seed:dummy` (dummy users/results), `npm run seed:matrix`
(business-matrix rows). The candidate UI is served at `/` by the same server.

### Admin app (`app/admin-web`)

```bash
cd app/admin-web
npm install
npm run dev                 # Next.js on http://localhost:3000
```

Point it at the running backend and make sure the backend's `ADMIN_WEB_URL`
env var matches this app's origin (CORS). **Read `app/admin-web/AGENTS.md`
before editing** — it's on a Next.js canary with APIs that differ from stable.

## Testing

```bash
cd app
npm test                          # Jest, runs against a real MongoDB
npx jest tests/userAssessment.test.js --runInBand   # a single file
```

Tests need a reachable MongoDB and load `app/.env.test`. Outbound email is
mocked. CI runs the same suite on every push/PR (`.github/workflows/ci-cd.yml`).

## Environment variables

See `app/.env.example` for the full list. Key ones: `MONGO_URI`, `JWT_SECRET`,
`GMAIL_USER`/`GMAIL_PASS` (OTP email), and the CORS origins `USER_APP_URL`,
`ADMIN_WEB_URL`. The standalone candidate frontend reads its API origin from
`TBT_API_BASE` (baked into `assets/js/env.js` at build time).

## Deployment

The backend + candidate frontend deploy to Render (single service) and/or Vercel;
`app/admin-web` deploys separately. Full walkthrough — env vars, MongoDB Atlas,
Gmail app password, CI/CD — is in `DEPLOYMENT.md`.
