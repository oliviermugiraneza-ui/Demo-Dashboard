# Lakebase Migration Plan

> **Status:** Pre-migration (local Docker PostgreSQL → Databricks Lakebase)  
> **Prepared:** 2026-07-11  
> **Schema version at migration:** 1.6.1

---

## 1. Pre-Flight Checklist

Run all checks locally before any migration:

```bash
# 1. Ensure DB is clean
npm run db:cleanup

# 2. Verify data integrity
npm run db:verify

# 3. Full schema + data audit
npm run db:audit

# 4. Health check — all PASS required
npm run db:health

# 5. Application smoke test
npm run dev
```

All checks must pass with **0 failures** before proceeding.

---

## 2. Tables to Migrate (Production)

Migrate these tables in dependency order:

| Order | Table | Rows (est.) | Notes |
|-------|-------|-------------|-------|
| 1 | `admin_users` | 5 | Auth users — migrate credentials carefully |
| 2 | `hosts` | 8 | Independent — no FKs |
| 3 | `operators` | 13 | Independent — no FKs |
| 4 | `models` | 16 | Independent — no FKs |
| 5 | `routes` | 11 | Independent — no FKs |
| 6 | `vehicles` | 14 | Independent — no FKs |
| 7 | `demo_master` | 297 | Core table — must come before children |
| 8 | `post_demo` | 7 | FK → demo_master |
| 9 | `notification_log` | 56 | FK → demo_master |
| 10 | `demo_backlog` | 75 | Soft ref to demo_master (no FK) |
| 11 | `satisfaction` | 4 | Independent — no FKs |
| 12 | `schema_version` | 11 | Audit/housekeeping |

**Total rows: ~521**

---

## 3. Tables to EXCLUDE from Production

Do NOT migrate these tables:

| Table | Reason |
|-------|--------|
| `backup_satistaction` | Local backup only — typo table that was dropped |
| `backup_tracker` | Local backup only — unused table that was dropped |

These tables exist only in the local Docker DB as safety backups. They are confirmed empty shells and must not be part of the production schema.

---

## 4. Required Environment Variables

Set these in the production environment before migration:

```env
# Database connection
DATABASE_URL=postgresql://<user>:<password>@<lakebase-host>:<port>/<database>

# Email notifications (Gmail OAuth)
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=...
GMAIL_USER=...

# Google Calendar (optional)
GOOGLE_CALENDAR_ID=...
GOOGLE_CALENDAR_CREDENTIALS=...

# App
NODE_ENV=production
PORT=3001
```

---

## 5. Schema Export for Lakebase

Export the production schema (structure only):

```bash
# Export schema — no data, no backup tables
docker exec demo-postgres pg_dump \
  -U admin \
  -d demo_dashboard \
  --schema-only \
  --no-owner \
  --no-acl \
  --exclude-table='backup_*' \
  -f schema-export-$(date +%Y%m%d).sql
```

Export data (production tables only):

```bash
# Export data with explicit table list
docker exec demo-postgres pg_dump \
  -U admin \
  -d demo_dashboard \
  --data-only \
  --no-owner \
  --no-acl \
  -t admin_users \
  -t hosts \
  -t operators \
  -t models \
  -t routes \
  -t vehicles \
  -t demo_master \
  -t post_demo \
  -t notification_log \
  -t demo_backlog \
  -t satisfaction \
  -t schema_version \
  -f data-export-$(date +%Y%m%d).sql
```

---

## 6. Migration Order on Lakebase

```sql
-- 1. Create schema (run schema-export SQL)
-- 2. Insert independent tables first (no FK dependencies)
COPY admin_users FROM ...;
COPY hosts FROM ...;
COPY operators FROM ...;
COPY models FROM ...;
COPY routes FROM ...;
COPY vehicles FROM ...;

-- 3. Insert parent table
COPY demo_master FROM ...;

-- 4. Insert child tables (FK referencing demo_master)
COPY post_demo FROM ...;
COPY notification_log FROM ...;

-- 5. Insert soft-linked tables
COPY demo_backlog FROM ...;
COPY satisfaction FROM ...;

-- 6. Insert migration history
COPY schema_version FROM ...;

-- 7. Reset sequences
SELECT setval('demo_master_id_seq', (SELECT MAX(id) FROM demo_master));
SELECT setval('post_demo_id_seq',   (SELECT MAX(id) FROM post_demo));
SELECT setval('demo_backlog_id_seq',(SELECT MAX(id) FROM demo_backlog));
-- ... repeat for all tables with bigserial PKs
```

---

## 7. Verification SQL (run on Lakebase after migration)

```sql
-- 7.1 Row count validation
SELECT
  'demo_master'    AS tbl, COUNT(*) FROM demo_master   UNION ALL
  SELECT 'post_demo',      COUNT(*) FROM post_demo      UNION ALL
  SELECT 'demo_backlog',   COUNT(*) FROM demo_backlog   UNION ALL
  SELECT 'hosts',          COUNT(*) FROM hosts          UNION ALL
  SELECT 'operators',      COUNT(*) FROM operators      UNION ALL
  SELECT 'admin_users',    COUNT(*) FROM admin_users    UNION ALL
  SELECT 'models',         COUNT(*) FROM models         UNION ALL
  SELECT 'routes',         COUNT(*) FROM routes         UNION ALL
  SELECT 'vehicles',       COUNT(*) FROM vehicles       UNION ALL
  SELECT 'satisfaction',   COUNT(*) FROM satisfaction   UNION ALL
  SELECT 'notification_log',COUNT(*) FROM notification_log;

-- 7.2 Status values are canonical
SELECT status, COUNT(*) FROM demo_master GROUP BY status;
-- Expected: only NEED REVIEW / APPROVED / CANCELED / COMPLETED / DELETED

-- 7.3 No null demo_ref
SELECT COUNT(*) FROM demo_master WHERE demo_ref IS NULL OR demo_ref = '';
-- Expected: 0

-- 7.4 No null geo
SELECT COUNT(*) FROM demo_master WHERE geo IS NULL OR geo = '';
-- Expected: 0

-- 7.5 No orphan post_demo rows
SELECT COUNT(*) FROM post_demo p
WHERE p.demo_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM demo_master m WHERE m.id = p.demo_id);
-- Expected: 0

-- 7.6 No orphan notification_log rows
SELECT COUNT(*) FROM notification_log n
WHERE n.demo_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM demo_master m WHERE m.id = n.demo_id);
-- Expected: 0

-- 7.7 Backup tables must NOT exist on Lakebase
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'backup_%';
-- Expected: 0 rows

-- 7.8 schema_version present
SELECT version, description FROM schema_version ORDER BY id;
-- Expected: entries from 1.0.0 through 1.6.1
```

---

## 8. Application Config for Lakebase

Update `server/db.ts` to use the Lakebase DATABASE_URL:

```typescript
// The pool already reads from process.env.DATABASE_URL
// No code change needed — just set the env var
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
```

Set `ssl: true` or SSL config if Lakebase requires it:

```typescript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})
```

---

## 9. Rollback Plan

If migration fails:

1. Stop the production app server
2. Restore the local Docker DB (it is the source of truth until migration is verified)
3. Point `DATABASE_URL` back to local PostgreSQL
4. Investigate failure using schema_version table and pg_dump error logs
5. Fix the issue in the local DB
6. Re-run the pre-flight checklist
7. Retry migration

Local backup tables (`backup_satistaction`, `backup_tracker`) are already in place for the local schema changes.

---

## 10. Post-Migration

After successful migration:

```bash
# Re-run health check against production DB (set DATABASE_URL to Lakebase)
DATABASE_URL=postgresql://... npm run db:health

# Run smoke test
npm run dev
```

Confirm in the app:
- Home page KPIs load
- Tracker table shows demos
- Demo detail drawer opens
- Post-demo form submits (test with a dummy entry)
- Admin page tabs load (Admin, Hosts, Operators, Models, Routes, Vehicles)
