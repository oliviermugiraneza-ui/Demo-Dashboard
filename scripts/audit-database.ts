/**
 * Database audit script — prints a full schema + data health report.
 * Run with: npm run db:audit
 */
import { Pool } from 'pg'
import dotenv from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '../.env') })

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false })

function hr(char = '─', width = 72) { return char.repeat(width) }
function section(title: string) { console.log('\n' + hr('═') + '\n  ' + title + '\n' + hr('═')) }
function subsection(title: string) { console.log('\n' + hr() + '\n  ' + title + '\n' + hr()) }

async function main() {
  console.log('\n' + hr('█') + '\n  DEMO DASHBOARD — DATABASE AUDIT REPORT\n  ' + new Date().toISOString() + '\n' + hr('█'))

  // ── 1. List all tables with row counts ────────────────────────────────────────
  section('1. ALL PUBLIC TABLES')
  const tablesRes = await pool.query<{ table_name: string; row_count: string }>(`
    SELECT
      c.relname                                          AS table_name,
      c.reltuples::BIGINT                                AS row_count
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname
  `)

  const tables = tablesRes.rows
  console.log(`\n  ${'TABLE'.padEnd(28)} ${'EST. ROWS'.padStart(10)}`)
  console.log('  ' + hr('-', 40))
  for (const t of tables) {
    const exact = await pool.query(`SELECT COUNT(*) AS n FROM public.${t.table_name}`)
    const count = exact.rows[0].n
    console.log(`  ${t.table_name.padEnd(28)} ${String(count).padStart(10)}`)
  }

  // ── 2. Column schemas for each table ──────────────────────────────────────────
  section('2. COLUMN SCHEMAS')
  for (const t of tables) {
    subsection(t.table_name)
    const cols = await pool.query<{
      column_name: string; data_type: string; is_nullable: string; column_default: string | null
    }>(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [t.table_name])

    if (cols.rows.length === 0) {
      console.log('  (no columns — empty shell)')
      continue
    }
    console.log(`  ${'COLUMN'.padEnd(32)} ${'TYPE'.padEnd(22)} ${'NULL'.padEnd(6)} DEFAULT`)
    console.log('  ' + hr('-', 70))
    for (const c of cols.rows) {
      const nullable = c.is_nullable === 'YES' ? 'YES' : 'NO '
      const def      = c.column_default ? c.column_default.substring(0, 30) : ''
      console.log(`  ${c.column_name.padEnd(32)} ${c.data_type.padEnd(22)} ${nullable}    ${def}`)
    }
  }

  // ── 3. Data quality checks ────────────────────────────────────────────────────
  section('3. DATA QUALITY CHECKS')

  // demo_master.type distribution
  subsection('demo_master — type distribution')
  const types = await pool.query(`
    SELECT type, COUNT(*) AS n FROM public.demo_master
    GROUP BY type ORDER BY n DESC NULLS LAST
  `)
  const canonicalTypes = ['VIP','Media','External','OEM support','Performance Check','Candidate','Conference','Friend& Family']
  console.log(`  ${'TYPE'.padEnd(28)} ${'COUNT'.padStart(8)}  STATUS`)
  console.log('  ' + hr('-', 55))
  for (const r of types.rows) {
    const isCanonical = canonicalTypes.includes(r.type ?? '')
    const status      = r.type === null ? '⚠  NULL' : isCanonical ? '✓  canonical' : '✗  NON-CANONICAL'
    console.log(`  ${String(r.type ?? 'NULL').padEnd(28)} ${String(r.n).padStart(8)}  ${status}`)
  }

  // demo_master.status distribution
  subsection('demo_master — status distribution')
  const statuses = await pool.query(`
    SELECT status, COUNT(*) AS n FROM public.demo_master
    GROUP BY status ORDER BY n DESC
  `)
  const canonicalStatuses = ['NEED REVIEW','APPROVED','CANCELED','COMPLETED','DELETED']
  console.log(`  ${'STATUS'.padEnd(28)} ${'COUNT'.padStart(8)}  STATUS`)
  console.log('  ' + hr('-', 55))
  for (const r of statuses.rows) {
    const ok     = canonicalStatuses.includes(r.status ?? '')
    const status = ok ? '✓  canonical' : '✗  NON-CANONICAL'
    console.log(`  ${String(r.status ?? 'NULL').padEnd(28)} ${String(r.n).padStart(8)}  ${status}`)
  }

  // demo_backlog.status distribution
  subsection('demo_backlog — status distribution')
  const bStatuses = await pool.query(`
    SELECT status, COUNT(*) AS n FROM public.demo_backlog
    GROUP BY status ORDER BY n DESC
  `)
  const canonicalBacklogStatuses = ['Proposed','Confirmed','Arranging','Completed','Converted','Canceled']
  console.log(`  ${'STATUS'.padEnd(28)} ${'COUNT'.padStart(8)}  STATUS`)
  console.log('  ' + hr('-', 55))
  for (const r of bStatuses.rows) {
    const ok     = canonicalBacklogStatuses.includes(r.status ?? '')
    const status = ok ? '✓  canonical' : '✗  NON-CANONICAL'
    console.log(`  ${String(r.status ?? 'NULL').padEnd(28)} ${String(r.n).padStart(8)}  ${status}`)
  }

  // admin_users roles
  subsection('admin_users — role distribution')
  const roles = await pool.query(`
    SELECT role, COUNT(*) AS n FROM public.admin_users
    GROUP BY role ORDER BY n DESC
  `)
  console.log(`  ${'ROLE'.padEnd(20)} ${'COUNT'.padStart(8)}`)
  console.log('  ' + hr('-', 30))
  for (const r of roles.rows) {
    console.log(`  ${String(r.role ?? 'NULL').padEnd(20)} ${String(r.n).padStart(8)}`)
  }

  // post_demo columns of interest
  subsection('post_demo — legacy vs new columns')
  const pdLegacy = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE demo_route IS NOT NULL AND demo_route <> '')  AS demo_route_populated,
      COUNT(*) FILTER (WHERE route IS NOT NULL AND route <> '')            AS route_populated,
      COUNT(*) FILTER (WHERE speed_following_score IS NOT NULL)            AS speed_following_populated,
      COUNT(*)                                                             AS total
    FROM public.post_demo
  `)
  const pd = pdLegacy.rows[0]
  console.log(`  Total post_demo rows:          ${pd.total}`)
  console.log(`  demo_route populated:          ${pd.demo_route_populated}  (legacy — fallback in PostDemoPage)`)
  console.log(`  route populated:               ${pd.route_populated}  (new — primary going forward)`)
  console.log(`  speed_following_score non-null: ${pd.speed_following_populated}  (legacy — no longer collected by form)`)

  // satistaction table check
  subsection('satistaction (typo table) — schema check')
  const satBad = await pool.query(`
    SELECT COUNT(*) AS n FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'satistaction'
  `)
  const satBadCount = Number(satBad.rows[0].n)
  if (satBadCount === 0) {
    console.log('  satistaction has 0 columns — empty shell, safe to DROP')
  } else {
    const satBadRows = await pool.query(`SELECT COUNT(*) AS n FROM public.satistaction`)
    console.log(`  satistaction has ${satBadCount} columns and ${satBadRows.rows[0].n} rows`)
  }

  // tracker table check
  subsection('tracker — schema check')
  const trackerCols = await pool.query(`
    SELECT COUNT(*) AS n FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tracker'
  `)
  const trackerColCount = Number(trackerCols.rows[0].n)
  if (trackerColCount === 0) {
    console.log('  tracker has 0 columns — empty shell, safe to DROP')
  } else {
    const trackerRows = await pool.query(`SELECT COUNT(*) AS n FROM public.tracker`)
    console.log(`  tracker has ${trackerColCount} columns and ${trackerRows.rows[0].n} rows`)
  }

  // ── 4. Summary ────────────────────────────────────────────────────────────────
  section('4. CLEANUP PLAN SUMMARY')
  console.log(`
  TABLES TO DROP (after backup):
    ✗  public.satistaction   — typo duplicate, 0 rows, 0 columns
    ✗  public.tracker        — unused, 0 rows, 0 columns

  DATA TO NORMALISE:
    demo_master.type:
      "Friends and Family" → "Friend& Family"
      "External Guest"     → "External"
      "OEM Support"        → "OEM support"

    demo_backlog.status:
      "Cancelled"          → "Canceled"

  LEGACY COLUMNS (keep — referenced in code):
    post_demo.demo_route          — fallback in PostDemoPage (r.route ?? r.demo_route)
    post_demo.speed_following_score — historical data, no longer collected by form

  ACTION:
    Run: npm run db:cleanup
    Then: npm run db:verify
`)

  await pool.end()
}

main().catch(e => { console.error('\n  AUDIT FAILED:', e.message); pool.end(); process.exit(1) })
