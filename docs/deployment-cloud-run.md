# Cloud Run Deployment Guide

## Architecture

```
Browser
  │
  ▼
Firebase Hosting  (static frontend — frontend/dist/)
  │  /api/** rewrites → Cloud Run
  ▼
Cloud Run  (Express backend — server/)
  │
  ▼
Lakebase (Databricks Postgres)
```

- **Firebase Hosting** serves the Vite-built frontend. All `/api/**` requests are transparently proxied to Cloud Run via Hosting rewrites — the frontend never needs to know the Cloud Run URL.
- **Cloud Run** runs the Express backend. It is stateless, auto-scales to zero, and respects `PORT`/`NODE_ENV` environment variables.
- **Lakebase** is the production database. The connection string includes a short-lived OAuth token that must be rotated periodically.

---

## Prerequisites

```bash
# Install CLIs
npm install -g firebase-tools
brew install google-cloud-sdk   # or follow cloud.google.com/sdk/docs/install

# Authenticate
gcloud auth login
gcloud config set project YOUR_GCP_PROJECT_ID
firebase login
firebase use YOUR_FIREBASE_PROJECT_ID
```

---

## Environment Variables

Set these in Cloud Run (not in a .env file — Cloud Run reads them natively):

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | Lakebase OAuth connection string |
| `ALLOWED_ORIGINS` | ✅ | Comma-separated Firebase Hosting domains |
| `NODE_ENV` | ✅ | Set to `production` |
| `NOTIFICATIONS_ENABLED` | — | `true` / `false` (default true) |
| `NOTIFICATION_DRY_RUN` | — | `true` to log without sending (default false) |
| `GOOGLE_EMAIL_PROVIDER` | — | `gmail_api` |
| `GOOGLE_CLIENT_ID` | — | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | — | Google OAuth client secret |
| `GOOGLE_REFRESH_TOKEN` | — | Google OAuth refresh token |
| `EMAIL_FROM` | — | Sender address for notification emails |

`PORT` is injected automatically by Cloud Run — do not set it.

---

## First-time Setup

### 1. Enable APIs

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com
```

### 2. Build and push

```bash
# Build frontend + server
npm run build

# Deploy server to Cloud Run (source-based, Cloud Build handles the Docker build)
npm run deploy:cloudrun
```

Or manually with environment variables:

```bash
gcloud run deploy demo-dashboard \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production,DATABASE_URL=...,ALLOWED_ORIGINS=https://your-app.web.app"
```

### 3. Deploy Firebase Hosting

After your Cloud Run service is live, get its URL:

```bash
gcloud run services describe demo-dashboard --region us-central1 --format="value(status.url)"
```

Update `firebase.json` if needed (the `serviceId` must match your Cloud Run service name), then deploy:

```bash
npm run deploy:firebase
```

---

## Routine Deployment (CI/CD)

```bash
# 1. Build both frontend and server
npm run build

# 2. Deploy backend to Cloud Run
npm run deploy:cloudrun

# 3. Deploy frontend to Firebase Hosting
npm run deploy:firebase
```

---

## Lakebase Token Rotation

Lakebase OAuth tokens expire. When a token expires, the server automatically returns `AUTH_EXPIRED` (HTTP 503) so the frontend can prompt the user to refresh.

**Production (Cloud Run):**

```bash
# Update DATABASE_URL with the new token — triggers a new revision automatically
gcloud run services update demo-dashboard \
  --region us-central1 \
  --update-env-vars "DATABASE_URL=postgresql://user-access-role:<new-token>@<host>/databricks_postgres?sslmode=require"
```

Cloud Run performs a zero-downtime revision swap.

**Development (local):**

Update `DATABASE_URL` in `.env.development` — the server calls `refreshPool()` automatically on the next request after detecting an auth error.

---

## Rollback

```bash
# List recent Cloud Run revisions
gcloud run revisions list --service demo-dashboard --region us-central1

# Route 100% of traffic to a previous revision
gcloud run services update-traffic demo-dashboard \
  --region us-central1 \
  --to-revisions REVISION-NAME=100
```

For Firebase Hosting, rollback via the Firebase console → Hosting → Release history → Roll back.

---

## Health Check

```bash
# Cloud Run
curl https://YOUR-CLOUD-RUN-URL/api/health

# Firebase Hosting (proxied)
curl https://YOUR-APP.web.app/api/health
```

Expected response:
```json
{ "ok": true, "db": "connected", "ts": "2026-...", "db_ts": "..." }
```

---

## Local Production Test

To test the production profile locally before deploying:

```bash
# 1. Build server
npm run build:server

# 2. Create .env.production from the example
cp .env.production.example .env.production
# Edit .env.production with real credentials

# 3. Run in production mode
npm run start
```

---

## Cold Start Optimisation

Cloud Run Node.js best practices applied in this codebase:

- **Singleton pool** — `pg.Pool` created once at module load, reused across all requests
- **No startup I/O** — no blocking calls during module initialisation
- **Stateless** — no local file writes; all state is in Lakebase
- **Graceful shutdown** — SIGTERM handler closes the HTTP server then the DB pool, letting in-flight requests complete
- **In-memory reference cache** — reduces Lakebase round-trips for reference data (operators, hosts, routes, vehicles, models) with a 10-minute TTL

Reference: [Cloud Run Node.js tips](https://cloud.google.com/run/docs/tips/nodejs)
