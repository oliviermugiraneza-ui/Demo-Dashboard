/**
 * Post-cleanup verification script — confirms all cleanup steps were applied.
 * Run with: npm run db:verify
 * Exit code 0 = all checks pass. Exit code 1 = one or more checks failed.
 */
import { Pool } from 'pg'
import dotenv from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '../.env') })

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false })

let passed  = 0
let failed  = 0
let warned  = 0

function ts() { return new Date().toISOString().replace('T',' ').substring(0,19) }
function pass(msg: string)  { console.log(`[${ts()}] PASS  ${msg}`); passed++ }
function fail(msg: string)  { console.error(`[${ts()}] FAIL  ${msg}`); failed++ }
function warn(msg: string)  { console.log(`[${ts()}] WARN  ${msg}`); warned++ }
function info(msg: string)  { console.log(`[${ts()}]       ${msg}`) }
function hr()               { console.log('─'.repeat(72)) }

async function tableExists(name: string): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = $1 AND c.relkind = 'r'`, [name]
  )
  return r.rowCount! > 0
}

async function rowCount(table: string): Promise<number> {
  const r = await pool.query(`SELECT COUNT(*) AS n FROM public.${table}`)
  return Number(r.rows[0].n)
}

async function main() {
  console.log('\n' + '█'.repeat(72))
  console.log('  DEMO DASHBOARD — DATABASE VERIFICATION')
  console.log('  ' + new Date().toISOString())
  console.log('█'.repeat(72) + '\n')

  // ── 1. Dropped tables are gone ─────────────────────────────────────────────
  hr(); info('CHECK: Dropped tables do not exist')

  if (!await tableExists('satistaction')) {
    pass('public.satistaction does not exist (dropped)')
  } else {
    fail('public.satistaction still exists — run db:cleanup')
  }

  if (!await tableExists('tracker')) {
    pass('public.tracker does not exist (dropped)')
  } else {
    fail('public.tracker still exists — run db:cleanup')
  }

  // ── 2. Backup tables exist (proof that cleanup ran safely) ─────────────────
  hr(); info('CHECK: Backup tables present')

  if (await tableExists('backup_satistaction')) {
    pass('public.backup_satistaction exists')
  } else {
    warn('public.backup_satistaction missing — cleanup may not have run yet')
  }

  if (await tableExists('backup_tracker')) {
    pass('public.backup_tracker exists')
  } else {
    warn('public.backup_tracker missing — cleanup may not have run yet')
  }

  // ── 3. demo_master.type — no non-canonical values ─────────────────────────
  hr(); info('CHECK: demo_master.type canonical values')

  const badTypes = await pool.query(`
    SELECT type, COUNT(*) AS n FROM public.demo_master
    WHERE type NOT IN ('VIP','Media','External','OEM support','Performance Check','Candidate','Conference','Friend& Family')
      AND type IS NOT NULL
    GROUP BY type
  `)
  if (badTypes.rowCount === 0) {
    pass('demo_master.type — all values canonical')
  } else {
    for (const r of badTypes.rows) {
      fail(`demo_master.type has non-canonical value: "${r.type}" (${r.n} rows)`)
    }
  }

  const nullTypes = await pool.query(`SELECT COUNT(*) AS n FROM public.demo_master WHERE type IS NULL`)
  const nullCount = Number(nullTypes.rows[0].n)
  if (nullCount > 0) {
    warn(`demo_master.type has ${nullCount} NULL row(s)`)
  } else {
    pass('demo_master.type — no NULL values')
  }

  // ── 4. demo_master.status — only canonical values ─────────────────────────
  hr(); info('CHECK: demo_master.status canonical values')

  const badStatuses = await pool.query(`
    SELECT status, COUNT(*) AS n FROM public.demo_master
    WHERE status NOT IN ('NEED REVIEW','APPROVED','CANCELED','COMPLETED','DELETED')
      AND status IS NOT NULL
    GROUP BY status
  `)
  if (badStatuses.rowCount === 0) {
    pass('demo_master.status — all values canonical')
  } else {
    for (const r of badStatuses.rows) {
      fail(`demo_master.status non-canonical: "${r.status}" (${r.n} rows)`)
    }
  }

  // ── 5. demo_backlog.status — no "Cancelled" ───────────────────────────────
  hr(); info('CHECK: demo_backlog.status — "Cancelled" normalised')

  const cancelled = await pool.query(`
    SELECT COUNT(*) AS n FROM public.demo_backlog WHERE status = 'Cancelled'
  `)
  if (Number(cancelled.rows[0].n) === 0) {
    pass('demo_backlog.status — no "Cancelled" rows (correct spelling used)')
  } else {
    fail(`demo_backlog.status still has ${cancelled.rows[0].n} rows with "Cancelled" — run db:cleanup`)
  }

  const badBStatuses = await pool.query(`
    SELECT status, COUNT(*) AS n FROM public.demo_backlog
    WHERE status NOT IN ('Proposed','Requested','Arranging','Confirmed','Completed','CANCELED','Converted')
      AND status IS NOT NULL
    GROUP BY status
  `)
  if (badBStatuses.rowCount === 0) {
    pass('demo_backlog.status — all values canonical')
  } else {
    for (const r of badBStatuses.rows) {
      fail(`demo_backlog.status non-canonical: "${r.status}" (${r.n} rows)`)
    }
  }

  // ── 6. admin_users — only Admin/Super Admin roles ─────────────────────────
  hr(); info('CHECK: admin_users roles are Admin or Super Admin only')

  const badRoles = await pool.query(`
    SELECT role, COUNT(*) AS n FROM public.admin_users
    WHERE role NOT IN ('Assistant','Admin','Super Admin')
    GROUP BY role
  `)
  if (badRoles.rowCount === 0) {
    pass('admin_users.role — only Assistant/Admin/Super Admin present')
  } else {
    for (const r of badRoles.rows) {
      fail(`admin_users.role has unexpected value: "${r.role}" (${r.n} rows)`)
    }
  }

  // ── 7. post_demo — legacy column status ───────────────────────────────────
  hr(); info('INFO: post_demo legacy column status (informational)')

  const pdInfo = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE demo_route IS NOT NULL AND demo_route <> '')  AS demo_route_rows,
      COUNT(*) FILTER (WHERE route IS NOT NULL AND route <> '')            AS route_rows,
      COUNT(*) FILTER (WHERE speed_following_score IS NOT NULL)            AS speed_following_rows,
      COUNT(*)                                                             AS total
    FROM public.post_demo
  `)
  const pdi = pdInfo.rows[0]
  info(`post_demo total rows:           ${pdi.total}`)
  info(`post_demo.demo_route populated: ${pdi.demo_route_rows}  (legacy fallback — keep)`)
  info(`post_demo.route populated:      ${pdi.route_rows}  (new primary column)`)
  info(`post_demo.speed_following_score: ${pdi.speed_following_rows}  (legacy — form removed, historical data kept)`)

  // ── 8. Row counts for all kept tables ─────────────────────────────────────
  hr(); info('INFO: Row counts for all kept tables')

  const keptTables = [
    'admin_users','demo_backlog','demo_master','hosts','models',
    'notification_log','operators','post_demo','routes','satisfaction','vehicles',
  ]
  for (const t of keptTables) {
    const n = await rowCount(t)
    info(`  ${t.padEnd(24)} ${String(n).padStart(6)} rows`)
  }

  // ── Final summary ──────────────────────────────────────────────────────────
  hr()
  console.log(`\n  RESULT:  ${passed} passed  |  ${warned} warnings  |  ${failed} failed\n`)

  await pool.end()

  if (failed > 0) {
    console.error('  One or more checks failed. Run: npm run db:cleanup\n')
    process.exit(1)
  } else {
    console.log('  Database is clean and ready for Lakebase deployment.\n')
    process.exit(0)
  }
}

main().catch(e => {
  console.error(`[${new Date().toISOString()}] VERIFY SCRIPT ERROR: ${e.message}`)
  pool.end()
  process.exit(1)
})
