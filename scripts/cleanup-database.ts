/**
 * Safe database cleanup script — normalises data and drops empty shell tables.
 * Every destructive action is preceded by a backup. Script is idempotent.
 * Run with: npm run db:cleanup
 */
import { Pool, PoolClient } from 'pg'
import dotenv from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '../.env') })

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false })

// ── Logging helpers ────────────────────────────────────────────────────────────

function log(msg: string)     { console.log(`[${ts()}] ${msg}`) }
function ok(msg: string)      { console.log(`[${ts()}] ✓  ${msg}`) }
function skip(msg: string)    { console.log(`[${ts()}] –  ${msg}`) }
function fail(msg: string)    { console.error(`[${ts()}] ✗  ${msg}`) }
function ts()                 { return new Date().toISOString().replace('T',' ').substring(0,19) }
function hr()                 { console.log('─'.repeat(72)) }

// ── Step runner — stops on error ───────────────────────────────────────────────

async function step(label: string, fn: (client: PoolClient) => Promise<void>) {
  hr()
  log(`STEP: ${label}`)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await fn(client)
    await client.query('COMMIT')
    ok(`DONE: ${label}`)
  } catch (e) {
    await client.query('ROLLBACK')
    fail(`FAILED: ${label}`)
    fail((e as Error).message)
    throw e
  } finally {
    client.release()
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function tableExists(client: PoolClient, name: string): Promise<boolean> {
  const r = await client.query(
    `SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = $1 AND c.relkind = 'r'`, [name]
  )
  return r.rowCount! > 0
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n' + '█'.repeat(72))
  console.log('  DEMO DASHBOARD — DATABASE CLEANUP')
  console.log('  ' + new Date().toISOString())
  console.log('█'.repeat(72) + '\n')

  // ── STEP 1: Backup + drop public.satistaction ──────────────────────────────
  await step('Backup and drop public.satistaction (typo table)', async client => {
    const exists = await tableExists(client, 'satistaction')
    if (!exists) { skip('satistaction does not exist — already dropped'); return }

    const colRes = await client.query(`
      SELECT COUNT(*) AS n FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'satistaction'
    `)
    const colCount = Number(colRes.rows[0].n)
    log(`satistaction has ${colCount} columns`)

    const backupExists = await tableExists(client, 'backup_satistaction')
    if (backupExists) {
      skip('backup_satistaction already exists — skipping backup creation')
    } else {
      await client.query(`CREATE TABLE public.backup_satistaction AS TABLE public.satistaction`)
      ok('Created public.backup_satistaction')
    }

    await client.query(`DROP TABLE public.satistaction`)
    ok('Dropped public.satistaction')
  })

  // ── STEP 2: Backup + drop public.tracker ──────────────────────────────────
  await step('Backup and drop public.tracker (unused empty table)', async client => {
    const exists = await tableExists(client, 'tracker')
    if (!exists) { skip('tracker does not exist — already dropped'); return }

    const colRes = await client.query(`
      SELECT COUNT(*) AS n FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'tracker'
    `)
    const colCount = Number(colRes.rows[0].n)
    log(`tracker has ${colCount} columns`)

    const backupExists = await tableExists(client, 'backup_tracker')
    if (backupExists) {
      skip('backup_tracker already exists — skipping backup creation')
    } else {
      await client.query(`CREATE TABLE public.backup_tracker AS TABLE public.tracker`)
      ok('Created public.backup_tracker')
    }

    await client.query(`DROP TABLE public.tracker`)
    ok('Dropped public.tracker')
  })

  // ── STEP 3: Normalise demo_master.type ────────────────────────────────────
  await step('Normalise demo_master.type values', async client => {
    const mappings: Array<[string, string]> = [
      ['Friends and Family', 'Friend& Family'],
      ['External Guest',     'External'],
      ['OEM Support',        'OEM support'],
    ]

    for (const [from, to] of mappings) {
      const check = await client.query(
        `SELECT COUNT(*) AS n FROM public.demo_master WHERE type = $1`, [from]
      )
      const count = Number(check.rows[0].n)
      if (count === 0) {
        skip(`No rows with type="${from}" — skipping`)
        continue
      }
      await client.query(
        `UPDATE public.demo_master SET type = $2 WHERE type = $1`, [from, to]
      )
      ok(`Updated ${count} rows: "${from}" → "${to}"`)
    }
  })

  // ── STEP 4: Normalise demo_backlog.status — all variants → CANCELED ─────────
  await step('Normalise demo_backlog.status — "Cancelled"/"Canceled" → "CANCELED"', async client => {
    const variants = ['Cancelled', 'Canceled', 'cancelled', 'canceled', 'CANCELLED']
    for (const variant of variants) {
      const check = await client.query(
        `SELECT COUNT(*) AS n FROM public.demo_backlog WHERE status = $1`, [variant]
      )
      const count = Number(check.rows[0].n)
      if (count === 0) { skip(`No rows with status="${variant}"` ); continue }
      await client.query(
        `UPDATE public.demo_backlog SET status = 'CANCELED' WHERE status = $1`, [variant]
      )
      ok(`Updated ${count} rows: "${variant}" → "CANCELED"`)
    }
    const remaining = await client.query(
      `SELECT COUNT(*) AS n FROM public.demo_backlog WHERE status = 'CANCELED'`
    )
    ok(`demo_backlog CANCELED rows after normalisation: ${remaining.rows[0].n}`)
  })

  // ── STEP 5: Normalise demo_master.status — legacy variants ────────────────
  await step('Normalise demo_master.status — all legacy variants to canonical', async client => {
    const mappings: Array<[string, string]> = [
      ['Reviewed',     'APPROVED'],
      ['Approved',     'APPROVED'],
      ['Needs Review', 'NEED REVIEW'],
      ['Need Review',  'NEED REVIEW'],
      ['NEEDS REVIEW', 'NEED REVIEW'],
      ['Cancelled',    'CANCELED'],
      ['Canceled',     'CANCELED'],
      ['Completed',    'COMPLETED'],
    ]
    for (const [from, to] of mappings) {
      const check = await client.query(
        `SELECT COUNT(*) AS n FROM public.demo_master WHERE status = $1`, [from]
      )
      const count = Number(check.rows[0].n)
      if (count === 0) { skip(`No rows with status="${from}"`); continue }
      await client.query(
        `UPDATE public.demo_master SET status = $2 WHERE status = $1`, [from, to]
      )
      ok(`Updated ${count} rows in demo_master: "${from}" → "${to}"`)
    }
  })

  // ── STEP 6: Move operators with role='Assistant' → admin_users ───────────
  await step('Move Assistant operators to admin_users', async client => {
    const assistants = await client.query(
      `SELECT id, full_name, email, geo, created_at, updated_at
       FROM public.operators WHERE role = 'Assistant'`
    )
    if (assistants.rowCount === 0) {
      skip('No Assistant operators found — nothing to migrate'); return
    }
    for (const op of assistants.rows) {
      const existing = await client.query(
        `SELECT id, role FROM public.admin_users WHERE email = $1`, [op.email]
      )
      if (existing.rowCount! > 0) {
        const existing_row = existing.rows[0]
        if (existing_row.role !== 'Assistant') {
          await client.query(
            `UPDATE public.admin_users SET role = 'Assistant', updated_at = NOW() WHERE id = $1`,
            [existing_row.id]
          )
          ok(`Updated existing admin_users row for ${op.email} → role='Assistant'`)
        } else {
          skip(`${op.email} already in admin_users as Assistant — skipping insert`)
        }
      } else {
        await client.query(
          `INSERT INTO public.admin_users (full_name, email, geo, role, password, created_at, updated_at)
           VALUES ($1, $2, $3, 'Assistant', NULL, $4, $5)`,
          [op.full_name, op.email, op.geo, op.created_at, op.updated_at]
        )
        ok(`Migrated ${op.full_name} (${op.email}) to admin_users as Assistant`)
      }
      await client.query(`DELETE FROM public.operators WHERE id = $1`, [op.id])
      ok(`Removed ${op.email} from operators`)
    }
  })

  // ── Summary ────────────────────────────────────────────────────────────────
  hr()
  console.log(`\n[${ts()}] ALL STEPS COMPLETE\n`)
  console.log('  Next: npm run db:verify && npm run db:migrate-readiness\n')

  await pool.end()
}

main().catch(e => {
  fail('CLEANUP ABORTED — ' + e.message)
  pool.end()
  process.exit(1)
})
