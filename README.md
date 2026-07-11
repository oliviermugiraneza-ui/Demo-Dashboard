# Demo Operation HUB

Internal dashboard for managing the Wayve demo pipeline across UK, JP, US, and DE regions.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS |
| API server | Express 4 + Node.js (TypeScript via tsx) |
| Database | Azure Databricks Lakebase (PostgreSQL-compatible) |
| Charts | Recharts |
| UI components | Radix UI / shadcn pattern |

---

## Architecture

```
Browser (Vite dev server :5173)
    |
    | fetch /api/*   [proxied to :3001]
    v
Express API Server (:3001)
    |
    +-- DemoService ---------> DemoRepository ---------> public.demo_master_raw
    |
    +-- SatisfactionService -> SatisfactionRepository -> public.satisfaction
    |
    v
Azure Databricks Lakebase PostgreSQL
    Host: ep-soft-waterfall-e9retxot.database.eastus.azuredatabricks.net
    DB:   databricks_postgres
    SSL:  required
```

**Rule:** The UI never touches the database directly.
All data flows: `UI hook -> /api/* -> Service -> Repository -> Lakebase`.

---

## Quick Start

### 1. Obtain a Databricks OAuth token

1. Sign in to the Azure Databricks workspace
2. Click your username (top-right) -> **Settings** -> **Developer** -> **Access tokens**
3. Click **Generate new token** (set a 60-minute or longer expiry)
4. Copy the token — it is shown only once

### 2. Create your `.env` file

```bash
cp .env.example .env
```

Edit `.env` and replace `<YOUR_OAUTH_TOKEN>` with the token from step 1:

```env
DATABASE_URL=postgresql://olivier.mugiraneza%40wayve.ai:<YOUR_OAUTH_TOKEN>@ep-soft-waterfall-e9retxot.database.eastus.azuredatabricks.net/databricks_postgres?sslmode=require
API_PORT=3001
```

**Never commit `.env` to git.** It is already in `.gitignore`.

### 3. Install dependencies

```bash
# Root (API server deps)
npm install

# Frontend deps
cd frontend && npm install && cd ..
```

### 4. Run the full stack

```bash
npm run dev
```

| Service | URL |
|---|---|
| React frontend | http://localhost:5173 |
| Express API | http://localhost:3001 |
| Health check | http://localhost:3001/api/health |

---

## Token Expiry

Databricks OAuth tokens expire after approximately 1 hour.

**When the token expires**, the API returns HTTP 503 with:
```json
{
  "ok": false,
  "code": "AUTH_EXPIRED",
  "error": "Database authentication failed — OAuth token may be expired.",
  "hint": "Update DATABASE_URL in .env with a fresh Databricks OAuth token. The server will retry automatically on the next request."
}
```

**To refresh:**
1. Get a new token from the Databricks console (see step 1 above)
2. Update `DATABASE_URL` in `.env` with the new token
3. Make any API request — the server automatically reloads `.env` and reconnects

No server restart is needed.

---

## Running services individually

```bash
# API server only (hot-reload)
npm run server

# Frontend only
npm run frontend
```

---

## API Endpoints

### Demos — `public.demo_master_raw`

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/demos` | List demos (filterable, paginated, sortable) |
| `POST` | `/api/demos` | Insert a new demo row |
| `PUT` | `/api/demos` | Update rows by requester + date_request_received |
| `DELETE` | `/api/demos` | Delete rows by requester + date_request_received |

**GET `/api/demos` query parameters:**

| Param | Type | Description |
|---|---|---|
| `limit` | number | Rows per page (max 1000, default 500) |
| `offset` | number | Row offset for pagination |
| `search` | string | Full-text search across requester, org, host, geo, type |
| `geo` | string | Exact geo filter (UK, JP, US, DE) |
| `type` | string | Partial type filter |
| `status` | string | Partial status filter |
| `requester` | string | Partial requester filter |
| `approver` | string | Partial approver filter |
| `host` | string | Partial host filter |
| `sortBy` | string | `demo_date` \| `date_requested` \| `lead_days` |
| `sortDir` | string | `ASC` \| `DESC` |

### Satisfaction — `public.satisfaction`

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/satisfaction` | List satisfaction records |
| `POST` | `/api/satisfaction` | Insert a record |
| `PUT` | `/api/satisfaction/:id` | Update by id |
| `DELETE` | `/api/satisfaction/:id` | Delete by id |

**GET `/api/satisfaction` query parameters:**

| Param | Description |
|---|---|
| `limit`, `offset` | Pagination |
| `geo` | Filter by geo |
| `type` | Partial type filter |
| `startDate`, `endDate` | ISO date range filter |

### Utility

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | DB connectivity check with timestamp |
| `GET` | `/api/schema` | Column list for `demo_master_raw` (or `?table=satisfaction`) |

The Vite dev server proxies `/api/*` to `http://localhost:3001`.

---

## Server Architecture

```
server/
  db.ts                          pg Pool with SSL, isAuthError/isConnError helpers,
                                 refreshPool() for hot token reload
  types.ts                       Shared TypeScript interfaces
  repositories/
    DemoRepository.ts            SQL: SELECT with filters/sort/pagination, INSERT, UPDATE, DELETE
    SatisfactionRepository.ts    SQL: SELECT *, schema introspection, INSERT, UPDATE, DELETE
  services/
    DemoService.ts               Normalisation (status, type, dates, times), wraps DemoRepository
    SatisfactionService.ts       Wraps SatisfactionRepository
  index.ts                       Express routes, centralised error handling
```

---

## Data Normalisation

All normalisation happens in `DemoService` before rows reach the client:

| DB column | Frontend field | Transformation |
|---|---|---|
| `status` | `status` | Reviewed / Needs Review / Canceled / DELETED |
| `type` | `type` | "Friends and Family" -> "Friend & Family", "VIP Demo" -> "VIP", etc. |
| `date_of_demo` | `demo_date` | DD/MM/YYYY -> YYYY-MM-DD |
| `demo_start_time` | `start_time` | "DD/MM/YYYY HH:MM:SS" -> "HH:MM" |
| `date_request_received` | `date_requested` | "Feb 2, 2026, 19:46:33" -> "2026-02-02" |
| `guests_organization` | `organization` | Trim only |
| `lead_time_days` | `lead_days` | Text -> integer |
| `total_guests` | `total_guests` | Text -> integer |

---

## Frontend Hooks

```typescript
// All data comes from Lakebase via these hooks.
// Falls back to mock data if the API server is unreachable.

import {
  useGetDemos,
  useGetDemosWithParams,
  useGetSatisfaction,
  useUpdateDemo,
} from './hooks/backend/demos'
```

`useGetDemosWithParams` accepts the full query-param set for server-side filtering/sorting/pagination.

---

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | Full Databricks Lakebase connection string including OAuth token as password |
| `API_PORT` | Express server port (default: 3001) |

---

## Project Structure

```
Demo-dashboard/
  server/               Express API (TypeScript, tsx)
    db.ts               pg Pool + SSL + auto token reload
    types.ts            Shared interfaces
    repositories/       SQL — one class per table
    services/           Business logic + normalisation
    index.ts            Routes + error handling
  frontend/             Vite + React SPA
    hooks/backend/
      demos.ts          useGetDemos, useGetSatisfaction, useGetDemosWithParams
    pages/data/
      sampleData.ts     Mock data (fallback only)
    vite.config.ts      /api/* proxy to :3001
  .env                  Secrets (git-ignored)
  .env.example          Template
  package.json          Root: server + concurrently
```
