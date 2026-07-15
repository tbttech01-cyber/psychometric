# Deployment

**Production topology: Vercel only.** Three Vercel projects, all deployed by `.github/workflows/ci-cd.yml` on push to `main` (see §5):

- **backend** — the Express API + serverless entrypoint (`app/`)
- **user-web** — the standalone candidate frontend (`app/frontend`)
- **admin-web** — the Next.js admin app (`app/admin-web`)

Render is no longer part of the deploy path — its blueprint (`render.yaml`) has been removed. If a Render service still exists from before, disable its auto-deploy (Dashboard → the service → Settings → Auto-Deploy → No) or suspend/delete it, so pushes deploy only to Vercel.

Steps that need your accounts/credentials are marked accordingly — nothing below requires pasting secrets into chat with Claude.

## 1. MongoDB Atlas (production database)

1. Create a free account at https://www.mongodb.com/cloud/atlas/register (no card needed for the M0 free tier).
2. Create an M0 cluster.
3. Database Access → add a user with a strong generated password.
4. Network Access → allow access from anywhere (`0.0.0.0/0`), since serverless (Vercel) outbound IPs aren't static.
5. Get the connection string (Connect → Drivers), e.g.:
   `mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/psychometric_assessment?retryWrites=true&w=majority`

## 2. Gmail App Password (OTP emails)

1. Use a Gmail account with 2-Step Verification enabled.
2. Generate an App Password: https://myaccount.google.com/apppasswords → app "Mail" → copy the 16-character password.
3. This becomes `GMAIL_USER` (the Gmail address) and `GMAIL_PASS` (the app password, not your normal password).

## 3. Vercel projects

The three projects are already linked (each has a gitignored `.vercel/project.json`; the workflow hardcodes the same org/project IDs — identifiers, not credentials). On the serverless backend, `app/api/index.js` re-exports `backend/app.js` and `app/vercel.json` rewrites all requests to it; MongoDB connects lazily on first request and is cached across warm invocations.

Set **Production** env vars in each Vercel project (dashboard → project → Settings → Environment Variables → Production), since `vercel pull` fetches these at deploy time:

- **backend**: `MONGO_URI`, `JWT_SECRET`, `GMAIL_USER`, `GMAIL_PASS`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `USER_APP_URL`, `ADMIN_APP_URL`, `ADMIN_WEB_URL`.
- **user-web**: `TBT_API_BASE` is supplied by the deploy job (the backend's production origin) — no dashboard var needed.
- **admin-web**: `NEXT_PUBLIC_API_URL` (the backend's production origin + `/api/v1`) is supplied by the deploy job; you may also set it in the dashboard as a backup.

## 4. Seed the production database

Serverless doesn't support one-off shell commands, so seed via a local run pointed at the Atlas cluster:

```bash
cd app
MONGO_URI="<your Atlas connection string>" ADMIN_EMAIL="<prod admin email>" ADMIN_PASSWORD="<prod admin password>" node backend/scripts/seed.js
```

(PowerShell: set each as `$env:VAR = "..."` first, then run `node backend/scripts/seed.js`.)

## 5. CI/CD via GitHub Actions → Vercel (`.github/workflows/ci-cd.yml`)

On every push/PR to `main`, the workflow tests `app/`'s Jest suite (against a `mongo:7` service container) and builds `app/admin-web/` (lint is **blocking**, then `next build`). On a push to `main` (not PRs), and only once the corresponding test/build job passes, it deploys each project to Vercel as a production deployment via the Vercel CLI (`vercel pull` → `vercel build --prod` → `vercel deploy --prebuilt --prod`):

- `deploy-backend` (gated on `test-backend`)
- `deploy-user-web` (gated on `test-backend`) — bakes `TBT_API_BASE` into `assets/js/env.js` at build time
- `deploy-admin-web` (gated on `build-admin-web`) — bakes `NEXT_PUBLIC_API_URL` into the Next build

A broken build or a failing `npm test` blocks the corresponding deploy job entirely.

Setup required:

1. **One GitHub secret**: repo Settings → Secrets and variables → Actions → `VERCEL_TOKEN` — a token from https://vercel.com/account/tokens with access to the projects' team.
2. **Production env vars** in each Vercel project as listed in §3.
3. If the Vercel projects are ever relinked (e.g. recreated), update `VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` in `.github/workflows/ci-cd.yml` to match the new `.vercel/project.json` values.

## 6. Verify

- Visit the **user-web** production URL — should redirect to `/user/login.html`.
- Register a test user with the seeded shared code (`TBT2024`), complete the OTP flow (a real email should arrive), take an assessment, and confirm scoring/result render correctly.
- Open the **admin-web** production URL, log in as the seeded admin, and confirm the dashboard loads (i.e. it's talking to the backend, not `localhost`).
