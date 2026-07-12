/**
 * Database health check — comprehensive production-readiness verification.
 * Covers all 10 production-readiness points.
 * Run with: npm run db:health
 * Exit 0 = all checks pass. Exit 1 = one or more failures.
 */
import { Pool } from 'pg'
import dotenv from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '../.env') })

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false })

// ── Result tracking ────────────────────────────────────────────────────────────

interface Result { label: string; pass: boolean; warn?: boolean; detail?: string }
const results: Result[] = []
const isProd = process.env.NODE_ENV === 'production'

function pass(label: string, detail?: string) {
  console.log(`  PASS  ${label}${detail ? `  (${detail})` : ''}`)
  results.push({ label, pass: true, detail })
}

function warn(label: string, detail?: string) {
  console.log(`  WARN  ${label}${detail ? `  → ${detail}` : ''}`)
  results.push({ label, pass: true, warn: true, detail })
}

function fail(label: string, detail?: string) {
  console.error(`  FAIL  ${label}${detail ? `  → ${detail}` : ''}`)
  results.push({ label, pass: false, detail })
}

function section(title: string) {
  console.log(`\n${'─'.repeat(72)}\n  ${title}\n${'─'.repeat(72)}`)
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function tableExists(name: string): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = $1 AND c.relkind = 'r'`, [name]
  )
  return r.rowCount! > 0
}

async function indexExists(name: string): Promise<boolean> {
  const r = await pool.query(`SELECT 1 FROM pg_class WHERE relname = $1 AND relkind = 'i'`, [name])
  return r.rowCount! > 0
}

async function constraintExists(table: string, name: string): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM pg_constraint WHERE conname = $1 AND conrelid = ($2::regclass)`,
    [name, `public.${table}`]
  )
  return r.rowCount! > 0
}

async function fkExists(table: string, name: string): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM pg_constraint
     WHERE conname = $1 AND conrelid = ($2::regclass) AND contype = 'f'`,
    [name, `public.${table}`]
  )
  return r.rowCount! > 0
}

async function count(query: string, params?: unknown[]): Promise<number> {
  const r = await pool.query(query, params)
  return Number(r.rows[0]?.n ?? r.rows[0]?.count ?? 0)
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n' + '█'.repeat(72))
  console.log('  DEMO DASHBOARD — DATABASE HEALTH CHECK')
  console.log('  ' + new Date().toISOString())
  console.log('█'.repeat(72))

  // ── 1. Required tables exist ─────────────────────────────────────────────────
  section('1. REQUIRED TABLES')
  const required = [
    'admin_users','demo_backlog','demo_master','hosts','models',
    'notification_log','operators','post_demo','routes','satisfaction',
    'schema_version','vehicles',
  ]
  for (const t of required) {
    if (await tableExists(t)) {
      const n = await count(`SELECT COUNT(*) AS n FROM public.${t}`)
      pass(`public.${t} exists`, `${n} rows`)
    } else {
      fail(`public.${t} is MISSING`)
    }
  }

  // ── 2. Backup tables NOT in production ──────────────────────────────────────
  section('2. BACKUP TABLES (must not exist in production)')
  const backupTables = ['backup_satistaction', 'backup_tracker']
  for (const t of backupTables) {
    if (await tableExists(t)) {
      if (isProd) {
        fail(`public.${t} EXISTS — backup table must not be in production`)
      } else {
        warn(`public.${t} exists locally (OK for dev) — exclude from Lakebase migration`)
      }
    } else {
      pass(`public.${t} does not exist (correct for production)`)
    }
  }

  // ── 3. demo_master.status — only canonical values ───────────────────────────
  section('3. STATUS VALUES — demo_master')
  const canonical = ['NEED REVIEW','APPROVED','CANCELED','COMPLETED','DELETED']
  const badStatus = await pool.query(
    `SELECT status, COUNT(*) AS n FROM public.demo_master
     WHERE status NOT IN (${canonical.map((_,i) => `$${i+1}`).join(',')}) AND status IS NOT NULL
     GROUP BY status`, canonical
  )
  if (badStatus.rowCount === 0) {
    pass('demo_master.status — all values canonical')
  } else {
    for (const r of badStatus.rows) fail(`Non-canonical status "${r.status}"`, `${r.n} rows`)
  }
  const nullStatus = await count(`SELECT COUNT(*) AS n FROM public.demo_master WHERE status IS NULL`)
  nullStatus === 0 ? pass('demo_master.status — no NULL values') : fail(`demo_master.status has ${nullStatus} NULL rows`)

  // ── 4. demo_master.geo — only canonical values ──────────────────────────────
  section('4. GEO VALUES — demo_master')
  const badGeo = await pool.query(
    `SELECT geo, COUNT(*) AS n FROM public.demo_master
     WHERE TRIM(geo) NOT IN ('JP','UK','US','DE') AND geo IS NOT NULL
     GROUP BY geo`
  )
  if (badGeo.rowCount === 0) {
    pass('demo_master.geo — all values canonical (JP/UK/US/DE)')
  } else {
    for (const r of badGeo.rows) fail(`Non-canonical geo "${r.geo}"`, `${r.n} rows`)
  }
  const nullGeo = await count(`SELECT COUNT(*) AS n FROM public.demo_master WHERE geo IS NULL OR geo = ''`)
  nullGeo === 0 ? pass('demo_master.geo — no NULL/empty values') : fail(`demo_master.geo has ${nullGeo} null/empty rows`)

  // ── 5. demo_master.type — only canonical values ─────────────────────────────
  section('5. DEMO TYPE VALUES — demo_master')
  const validTypes = ['VIP','Media','External','OEM support','Performance Check','Candidate','Conference','Friend& Family']
  const badType = await pool.query(
    `SELECT type, COUNT(*) AS n FROM public.demo_master
     WHERE type NOT IN (${validTypes.map((_,i) => `$${i+1}`).join(',')}) AND type IS NOT NULL
     GROUP BY type`, validTypes
  )
  if (badType.rowCount === 0) {
    pass('demo_master.type — all values canonical')
  } else {
    for (const r of badType.rows) fail(`Non-canonical type "${r.type}"`, `${r.n} rows`)
  }

  // ── 6. demo_master.demo_ref — NOT NULL and UNIQUE ───────────────────────────
  section('6. demo_ref INTEGRITY')
  const nullRef = await count(`SELECT COUNT(*) AS n FROM public.demo_master WHERE demo_ref IS NULL OR demo_ref = ''`)
  nullRef === 0 ? pass('demo_master.demo_ref — no NULL/empty values') : fail(`demo_master.demo_ref has ${nullRef} null rows`)

  const dupRef = await pool.query(
    `SELECT demo_ref, COUNT(*) AS n FROM public.demo_master
     WHERE demo_ref IS NOT NULL AND demo_ref <> ''
     GROUP BY demo_ref HAVING COUNT(*) > 1`
  )
  dupRef.rowCount === 0 ? pass('demo_master.demo_ref — no duplicates') : fail(`demo_master.demo_ref has ${dupRef.rowCount} duplicate values`)

  // ── 7. No orphan rows ──────────────────────────────────────────────────────
  section('7. ORPHAN ROWS (FK integrity)')
  const orphanPD = await count(`
    SELECT COUNT(*) AS n FROM public.post_demo p
    WHERE p.demo_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.demo_master m WHERE m.id = p.demo_id)
  `)
  orphanPD === 0 ? pass('post_demo — no orphan demo_id rows') : fail(`post_demo has ${orphanPD} orphan rows`)

  const orphanNL = await count(`
    SELECT COUNT(*) AS n FROM public.notification_log n
    WHERE n.demo_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.demo_master m WHERE m.id = n.demo_id)
  `)
  orphanNL === 0 ? pass('notification_log — no orphan demo_id rows') : fail(`notification_log has ${orphanNL} orphan rows`)

  // ── 8. Foreign key constraints ─────────────────────────────────────────────
  section('8. FOREIGN KEY CONSTRAINTS')
  ;(await fkExists('post_demo', 'post_demo_demo_id_fkey'))
    ? pass('FK: post_demo.demo_id → demo_master.id')
    : fail('FK: post_demo.demo_id → demo_master.id MISSING')

  ;(await fkExists('notification_log', 'notification_log_demo_id_fkey'))
    ? pass('FK: notification_log.demo_id → demo_master.id')
    : fail('FK: notification_log.demo_id → demo_master.id MISSING')

  // ── 9. CHECK constraints ───────────────────────────────────────────────────
  section('9. CHECK CONSTRAINTS')
  ;(await constraintExists('demo_master', 'chk_demo_master_status'))
    ? pass('CHECK: demo_master.status enum')
    : fail('CHECK: demo_master.status enum MISSING — run db:migrate-readiness')

  ;(await constraintExists('demo_master', 'chk_demo_master_geo'))
    ? pass('CHECK: demo_master.geo enum')
    : fail('CHECK: demo_master.geo enum MISSING — run db:migrate-readiness')

  ;(await constraintExists('demo_master', 'chk_demo_master_type'))
    ? pass('CHECK: demo_master.type enum')
    : fail('CHECK: demo_master.type enum MISSING — run db:migrate-readiness')

  // ── 10. Indexes ────────────────────────────────────────────────────────────
  section('10. INDEXES')
  const expectedIndexes: Array<[string, string]> = [
    ['demo_master',      'idx_demo_master_status'],
    ['demo_master',      'idx_demo_master_geo'],
    ['demo_master',      'idx_demo_master_date'],
    ['demo_master',      'idx_demo_master_host'],
    ['demo_master',      'idx_demo_master_type'],
    ['demo_master',      'demo_master_demo_ref_key'],
    ['demo_backlog',     'idx_demo_backlog_status'],
    ['demo_backlog',     'idx_demo_backlog_geo'],
    ['post_demo',        'idx_post_demo_demo_id'],
    ['post_demo',        'idx_post_demo_demo_ref'],
    ['post_demo',        'idx_post_demo_geo'],
    ['post_demo',        'idx_post_demo_model_name'],
    ['post_demo',        'idx_post_demo_route'],
    ['notification_log', 'idx_notification_log_demo_id'],
    ['notification_log', 'idx_notification_log_event_type'],
    ['notification_log', 'idx_notification_log_created_at'],
    ['satisfaction',     'idx_satisfaction_geo'],
  ]
  for (const [table, idx] of expectedIndexes) {
    if (await indexExists(idx)) {
      pass(`Index ${idx} on ${table}`)
    } else {
      fail(`Index ${idx} on ${table} MISSING — run db:migrate-readiness`)
    }
  }

  // ── 11. Role constraints ───────────────────────────────────────────────────
  section('11. ROLE CONSTRAINTS')
  const badAdminRoles = await pool.query(
    `SELECT role, COUNT(*) AS n FROM public.admin_users
     WHERE role NOT IN ('Assistant','Admin','Super Admin') GROUP BY role`
  )
  badAdminRoles.rowCount === 0
    ? pass('admin_users.role — only Assistant/Admin/Super Admin')
    : badAdminRoles.rows.forEach(r => fail(`admin_users.role unexpected: "${r.role}"`, `${r.n} rows`))

  const badHostRoles = await pool.query(
    `SELECT role, COUNT(*) AS n FROM public.hosts WHERE role != 'Host' GROUP BY role`
  )
  badHostRoles.rowCount === 0
    ? pass('hosts.role — only Host')
    : badHostRoles.rows.forEach(r => fail(`hosts.role unexpected: "${r.role}"`, `${r.n} rows`))

  const badOpRoles = await pool.query(
    `SELECT role, COUNT(*) AS n FROM public.operators WHERE role != 'Operator' GROUP BY role`
  )
  badOpRoles.rowCount === 0
    ? pass('operators.role — only Operator')
    : badOpRoles.rows.forEach(r => fail(`operators.role unexpected: "${r.role}" (${r.n} rows) — run db:cleanup`, ''))

  // ── 12. Duplicate email checks ─────────────────────────────────────────────
  section('12. DUPLICATE EMAILS')
  for (const table of ['admin_users', 'hosts', 'operators'] as const) {
    const dups = await pool.query(
      `SELECT email, COUNT(*) AS n FROM public.${table} GROUP BY email HAVING COUNT(*) > 1`
    )
    dups.rowCount === 0
      ? pass(`${table} — no duplicate emails`)
      : fail(`${table} has ${dups.rowCount} duplicate email(s)`)
  }

  // ── 13. post_demo schema checks ────────────────────────────────────────────
  section('13. POST_DEMO SCHEMA')
  const hasModel1 = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'post_demo'
       AND column_name LIKE 'model_1_%' OR column_name LIKE 'model_2_%'`
  )
  hasModel1.rowCount === 0
    ? pass('post_demo — no model_1_* or model_2_* columns')
    : fail(`post_demo has legacy model_1/model_2 columns: ${hasModel1.rows.map(r => r.column_name).join(', ')}`)

  // ── 14. schema_version table ───────────────────────────────────────────────
  section('14. SCHEMA VERSION')
  if (await tableExists('schema_version')) {
    const versions = await pool.query(
      `SELECT version, description FROM public.schema_version ORDER BY id`
    )
    pass(`schema_version exists`, `${versions.rowCount} entries`)
    const latest = versions.rows[versions.rows.length - 1]
    if (latest) console.log(`  Latest: v${latest.version} — ${latest.description}`)
  } else {
    fail('schema_version table MISSING — run db:migrate-readiness')
  }

  // ── 15. demo_backlog.status — no old Cancelled spelling ────────────────────
  section('15. BACKLOG STATUS NORMALIZATION')
  const oldCancelled = await count(
    `SELECT COUNT(*) AS n FROM public.demo_backlog WHERE status IN ('Cancelled','Canceled','cancelled')`
  )
  oldCancelled === 0
    ? pass('demo_backlog — no old "Cancelled"/"Canceled" rows (all CANCELED)')
    : fail(`demo_backlog has ${oldCancelled} rows with old Cancelled spelling`)

  const blStatus = await pool.query(
    `SELECT status, COUNT(*) AS n FROM public.demo_backlog GROUP BY status ORDER BY n DESC`
  )
  const validBl = ['Proposed','Requested','Arranging','Confirmed','Completed','CANCELED','Converted']
  for (const r of blStatus.rows) {
    if (!validBl.includes(r.status)) fail(`demo_backlog.status non-canonical: "${r.status}"`, `${r.n} rows`)
  }
  if (blStatus.rows.every(r => validBl.includes(r.status))) pass('demo_backlog.status — all values valid')

  // ── 16. Row counts summary ─────────────────────────────────────────────────
  section('16. ROW COUNTS SUMMARY')
  const tables = [
    'admin_users','demo_backlog','demo_master','hosts','models',
    'notification_log','operators','post_demo','routes','satisfaction','vehicles',
  ]
  for (const t of tables) {
    if (await tableExists(t)) {
      const n = await count(`SELECT COUNT(*) AS n FROM public.${t}`)
      console.log(`  ${t.padEnd(24)} ${String(n).padStart(6)} rows`)
    }
  }

  // ── Final summary ──────────────────────────────────────────────────────────
  const passed  = results.filter(r => r.pass && !r.warn).length
  const warned  = results.filter(r => r.warn).length
  const failed  = results.filter(r => !r.pass).length

  console.log('\n' + '═'.repeat(72))
  console.log(`  RESULT:  ${passed} passed  |  ${warned} warnings  |  ${failed} failed`)
  console.log('═'.repeat(72) + '\n')

  await pool.end()

  if (failed > 0) {
    console.error(`  ${failed} health check(s) failed. Fix before Lakebase deployment.\n`)
    process.exit(1)
  } else {
    console.log('  All health checks passed. Database is production-ready.\n')
    process.exit(0)
  }
}

main().catch(e => {
  console.error('\n  HEALTH CHECK ERROR:', e.message)
  pool.end()
  process.exit(1)
})
