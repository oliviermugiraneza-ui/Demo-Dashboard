/**
 * Production-readiness migration — structural DB changes before Lakebase deployment.
 *
 * Adds:
 *   1. schema_version table
 *   2. Missing indexes (demo_master, demo_backlog, post_demo, notification_log, satisfaction)
 *   3. FK: notification_log.demo_id → demo_master.id
 *   4. CHECK constraints (demo_master.status, geo, type)
 *   5. NOT NULL on demo_master.demo_ref and geo (after backfilling row 15)
 *
 * Run with: npm run db:migrate-readiness
 * Idempotent — safe to rerun.
 */
import { Pool, PoolClient } from 'pg'
import dotenv from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '../.env') })

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false })

function ts()            { return new Date().toISOString().replace('T',' ').substring(0,19) }
function log(msg: string){ console.log(`[${ts()}] ${msg}`) }
function ok(msg: string) { console.log(`[${ts()}] ✓  ${msg}`) }
function skip(msg: string){ console.log(`[${ts()}] –  ${msg}`) }
function fail(msg: string){ console.error(`[${ts()}] ✗  ${msg}`) }
function hr()            { console.log('─'.repeat(72)) }

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
    fail(`FAILED: ${label} — ${(e as Error).message}`)
    throw e
  } finally {
    client.release()
  }
}

async function indexExists(client: PoolClient, name: string): Promise<boolean> {
  const r = await client.query(
    `SELECT 1 FROM pg_class WHERE relname = $1 AND relkind = 'i'`, [name]
  )
  return r.rowCount! > 0
}

async function constraintExists(client: PoolClient, table: string, name: string): Promise<boolean> {
  const r = await client.query(
    `SELECT 1 FROM pg_constraint
     WHERE conname = $1 AND conrelid = ($2::regclass)`, [name, `public.${table}`]
  )
  return r.rowCount! > 0
}

async function columnIsNullable(client: PoolClient, table: string, column: string): Promise<boolean> {
  const r = await client.query(
    `SELECT is_nullable FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`, [table, column]
  )
  return r.rows[0]?.is_nullable === 'YES'
}

async function insertVersion(client: PoolClient, version: string, description: string) {
  await client.query(
    `INSERT INTO public.schema_version (version, description)
     VALUES ($1, $2) ON CONFLICT (version) DO NOTHING`, [version, description]
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n' + '█'.repeat(72))
  console.log('  PRODUCTION READINESS MIGRATION')
  console.log('  ' + new Date().toISOString())
  console.log('█'.repeat(72) + '\n')

  // ── 1. Create schema_version table ──────────────────────────────────────────
  await step('Create schema_version table', async client => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_version (
        id          BIGSERIAL PRIMARY KEY,
        version     TEXT NOT NULL UNIQUE,
        description TEXT,
        applied_at  TIMESTAMP DEFAULT NOW()
      )
    `)
    ok('schema_version table ready')
    await insertVersion(client, '1.0.0', 'Initial schema: demo_master, post_demo, backlog, hosts, operators, satisfaction')
    await insertVersion(client, '1.1.0', 'Added: routes, vehicles tables')
    await insertVersion(client, '1.2.0', 'Added: admin_users table')
    await insertVersion(client, '1.3.0', 'Dropped: satistaction (typo), tracker (unused) — data normalized')
    ok('Seeded baseline version history')
  })

  // ── 2. Fix demo_master row 15 (null demo_ref and geo) ───────────────────────
  await step('Backfill demo_master row 15 (null geo + demo_ref)', async client => {
    const check = await client.query(
      `SELECT id, geo, demo_ref FROM public.demo_master WHERE id = 15`
    )
    if (check.rowCount === 0) { skip('Row 15 not found'); return }
    const row = check.rows[0]
    let updated = false

    if (!row.geo || row.geo === '') {
      await client.query(`UPDATE public.demo_master SET geo = 'UK' WHERE id = 15`)
      ok('Set geo=UK for row 15')
      updated = true
    } else {
      skip(`Row 15 geo already set: ${row.geo}`)
    }

    if (!row.demo_ref || row.demo_ref === '') {
      // Generate a backfill ref: UK-260705-99 (99 = backfill placeholder)
      await client.query(`UPDATE public.demo_master SET demo_ref = 'UK-260705-99' WHERE id = 15`)
      ok('Set demo_ref=UK-260705-99 for row 15 (backfill)')
      updated = true
    } else {
      skip(`Row 15 demo_ref already set: ${row.demo_ref}`)
    }

    if (!updated) skip('Row 15 already complete — no changes needed')
    await insertVersion(client, '1.3.1', 'Backfilled demo_master row 15: geo=UK, demo_ref=UK-260705-99')
  })

  // ── 3. Add indexes — demo_master ────────────────────────────────────────────
  await step('Add indexes: demo_master', async client => {
    const toCreate: Array<{ name: string; sql: string }> = [
      { name: 'idx_demo_master_status',      sql: `CREATE INDEX IF NOT EXISTS idx_demo_master_status      ON public.demo_master (status)` },
      { name: 'idx_demo_master_geo',         sql: `CREATE INDEX IF NOT EXISTS idx_demo_master_geo         ON public.demo_master (geo)` },
      { name: 'idx_demo_master_date',        sql: `CREATE INDEX IF NOT EXISTS idx_demo_master_date        ON public.demo_master (date_of_demo)` },
      { name: 'idx_demo_master_host',        sql: `CREATE INDEX IF NOT EXISTS idx_demo_master_host        ON public.demo_master (host)` },
      { name: 'idx_demo_master_type',        sql: `CREATE INDEX IF NOT EXISTS idx_demo_master_type        ON public.demo_master (type)` },
      { name: 'idx_demo_master_requester',   sql: `CREATE INDEX IF NOT EXISTS idx_demo_master_requester   ON public.demo_master (requester)` },
    ]
    for (const idx of toCreate) {
      if (await indexExists(client, idx.name)) { skip(`${idx.name} already exists`); continue }
      await client.query(idx.sql)
      ok(`Created ${idx.name}`)
    }
    // demo_master.demo_ref already has a UNIQUE constraint (acts as index)
    skip('demo_master.demo_ref — unique constraint already provides an index')
  })

  // ── 4. Add indexes — demo_backlog ───────────────────────────────────────────
  await step('Add indexes: demo_backlog', async client => {
    const toCreate: Array<{ name: string; sql: string }> = [
      { name: 'idx_demo_backlog_geo',      sql: `CREATE INDEX IF NOT EXISTS idx_demo_backlog_geo      ON public.demo_backlog (geo)` },
      { name: 'idx_demo_backlog_demo_type', sql: `CREATE INDEX IF NOT EXISTS idx_demo_backlog_demo_type ON public.demo_backlog (demo_type)` },
      { name: 'idx_demo_backlog_priority', sql: `CREATE INDEX IF NOT EXISTS idx_demo_backlog_priority ON public.demo_backlog (priority)` },
    ]
    for (const idx of toCreate) {
      if (await indexExists(client, idx.name)) { skip(`${idx.name} already exists`); continue }
      await client.query(idx.sql)
      ok(`Created ${idx.name}`)
    }
  })

  // ── 5. Add indexes — post_demo ──────────────────────────────────────────────
  await step('Add indexes: post_demo', async client => {
    const toCreate: Array<{ name: string; sql: string }> = [
      { name: 'idx_post_demo_route',       sql: `CREATE INDEX IF NOT EXISTS idx_post_demo_route       ON public.post_demo (route)` },
      { name: 'idx_post_demo_submitted_at', sql: `CREATE INDEX IF NOT EXISTS idx_post_demo_submitted_at ON public.post_demo (submitted_at)` },
      { name: 'idx_post_demo_vehicle',     sql: `CREATE INDEX IF NOT EXISTS idx_post_demo_vehicle     ON public.post_demo (vehicle)` },
    ]
    for (const idx of toCreate) {
      if (await indexExists(client, idx.name)) { skip(`${idx.name} already exists`); continue }
      await client.query(idx.sql)
      ok(`Created ${idx.name}`)
    }
  })

  // ── 6. Add indexes — notification_log ──────────────────────────────────────
  await step('Add indexes: notification_log', async client => {
    const toCreate: Array<{ name: string; sql: string }> = [
      { name: 'idx_notification_log_demo_id',    sql: `CREATE INDEX IF NOT EXISTS idx_notification_log_demo_id    ON public.notification_log (demo_id)` },
      { name: 'idx_notification_log_event_type', sql: `CREATE INDEX IF NOT EXISTS idx_notification_log_event_type ON public.notification_log (event_type)` },
      { name: 'idx_notification_log_created_at', sql: `CREATE INDEX IF NOT EXISTS idx_notification_log_created_at ON public.notification_log (created_at)` },
      { name: 'idx_notification_log_recipient',  sql: `CREATE INDEX IF NOT EXISTS idx_notification_log_recipient  ON public.notification_log (recipient)` },
    ]
    for (const idx of toCreate) {
      if (await indexExists(client, idx.name)) { skip(`${idx.name} already exists`); continue }
      await client.query(idx.sql)
      ok(`Created ${idx.name}`)
    }
  })

  // ── 7. Add indexes — satisfaction ──────────────────────────────────────────
  await step('Add indexes: satisfaction', async client => {
    const toCreate: Array<{ name: string; sql: string }> = [
      { name: 'idx_satisfaction_geo',          sql: `CREATE INDEX IF NOT EXISTS idx_satisfaction_geo          ON public.satisfaction (geo)` },
      { name: 'idx_satisfaction_date_of_demo', sql: `CREATE INDEX IF NOT EXISTS idx_satisfaction_date_of_demo ON public.satisfaction (date_of_demo)` },
    ]
    for (const idx of toCreate) {
      if (await indexExists(client, idx.name)) { skip(`${idx.name} already exists`); continue }
      await client.query(idx.sql)
      ok(`Created ${idx.name}`)
    }
  })

  // ── 8. FK: notification_log.demo_id → demo_master.id ───────────────────────
  await step('FK: notification_log.demo_id → demo_master.id', async client => {
    const fkName = 'notification_log_demo_id_fkey'
    if (await constraintExists(client, 'notification_log', fkName)) {
      skip('FK notification_log_demo_id_fkey already exists')
      return
    }
    // Verify no orphans first
    const orphans = await client.query(`
      SELECT COUNT(*) AS n FROM public.notification_log nl
      WHERE nl.demo_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM public.demo_master m WHERE m.id = nl.demo_id)
    `)
    const orphanCount = Number(orphans.rows[0].n)
    if (orphanCount > 0) {
      fail(`${orphanCount} orphan notification_log rows — fix before adding FK`)
      throw new Error('Orphan rows prevent FK creation')
    }
    await client.query(`
      ALTER TABLE public.notification_log
      ADD CONSTRAINT notification_log_demo_id_fkey
      FOREIGN KEY (demo_id) REFERENCES public.demo_master(id) ON DELETE SET NULL
    `)
    ok('Added FK: notification_log.demo_id → demo_master.id')
    await insertVersion(client, '1.4.0', 'Added FK: notification_log.demo_id → demo_master.id')
  })

  // ── 9. CHECK constraint: demo_master.status ─────────────────────────────────
  await step('CHECK constraint: demo_master.status', async client => {
    const cname = 'chk_demo_master_status'
    if (await constraintExists(client, 'demo_master', cname)) {
      skip(`${cname} already exists`)
      return
    }
    // Verify data is clean first
    const bad = await client.query(`
      SELECT status, COUNT(*) AS n FROM public.demo_master
      WHERE status NOT IN ('NEED REVIEW','APPROVED','CANCELED','COMPLETED','DELETED')
        AND status IS NOT NULL
      GROUP BY status
    `)
    if (bad.rowCount! > 0) {
      for (const r of bad.rows) fail(`Non-canonical status "${r.status}" (${r.n} rows) — run db:cleanup first`)
      throw new Error('Non-canonical status values prevent CHECK constraint')
    }
    await client.query(`
      ALTER TABLE public.demo_master
      ADD CONSTRAINT chk_demo_master_status
      CHECK (status IN ('NEED REVIEW','APPROVED','CANCELED','COMPLETED','DELETED'))
    `)
    ok('Added CHECK: demo_master.status')
    await insertVersion(client, '1.5.0', 'CHECK constraint: demo_master.status enum')
  })

  // ── 10. CHECK constraint: demo_master.geo ──────────────────────────────────
  await step('CHECK constraint: demo_master.geo', async client => {
    const cname = 'chk_demo_master_geo'
    if (await constraintExists(client, 'demo_master', cname)) {
      skip(`${cname} already exists`)
      return
    }
    const bad = await client.query(`
      SELECT geo, COUNT(*) AS n FROM public.demo_master
      WHERE geo NOT IN ('JP','UK','US','DE') AND geo IS NOT NULL AND geo <> ''
      GROUP BY geo
    `)
    if (bad.rowCount! > 0) {
      for (const r of bad.rows) fail(`Non-canonical geo "${r.geo}" (${r.n} rows)`)
      throw new Error('Non-canonical geo values prevent CHECK constraint')
    }
    await client.query(`
      ALTER TABLE public.demo_master
      ADD CONSTRAINT chk_demo_master_geo
      CHECK (TRIM(geo) IN ('JP','UK','US','DE'))
    `)
    ok('Added CHECK: demo_master.geo')
    await insertVersion(client, '1.5.1', 'CHECK constraint: demo_master.geo enum')
  })

  // ── 11. CHECK constraint: demo_master.type ─────────────────────────────────
  await step('CHECK constraint: demo_master.type', async client => {
    const cname = 'chk_demo_master_type'
    if (await constraintExists(client, 'demo_master', cname)) {
      skip(`${cname} already exists`)
      return
    }
    const canonicalTypes = ['VIP','Media','External','OEM support','Performance Check','Candidate','Conference','Friend& Family']
    const bad = await client.query(`
      SELECT type, COUNT(*) AS n FROM public.demo_master
      WHERE type NOT IN (${canonicalTypes.map((_, i) => `$${i+1}`).join(',')})
        AND type IS NOT NULL AND type <> ''
      GROUP BY type
    `, canonicalTypes)
    if (bad.rowCount! > 0) {
      for (const r of bad.rows) fail(`Non-canonical type "${r.type}" (${r.n} rows)`)
      throw new Error('Non-canonical type values prevent CHECK constraint')
    }
    await client.query(`
      ALTER TABLE public.demo_master
      ADD CONSTRAINT chk_demo_master_type
      CHECK (type IN ('VIP','Media','External','OEM support','Performance Check','Candidate','Conference','Friend& Family'))
    `)
    ok('Added CHECK: demo_master.type')
    await insertVersion(client, '1.5.2', 'CHECK constraint: demo_master.type enum')
  })

  // ── 12. NOT NULL: demo_master.geo ──────────────────────────────────────────
  await step('NOT NULL: demo_master.geo', async client => {
    if (!await columnIsNullable(client, 'demo_master', 'geo')) {
      skip('demo_master.geo already NOT NULL')
      return
    }
    const nullRows = await client.query(
      `SELECT COUNT(*) AS n FROM public.demo_master WHERE geo IS NULL OR geo = ''`
    )
    if (Number(nullRows.rows[0].n) > 0) {
      fail(`${nullRows.rows[0].n} rows still have null/empty geo — backfill must run first`)
      throw new Error('Cannot set NOT NULL: null rows remain')
    }
    await client.query(`ALTER TABLE public.demo_master ALTER COLUMN geo SET NOT NULL`)
    ok('Set demo_master.geo NOT NULL')
    await insertVersion(client, '1.6.0', 'demo_master.geo set NOT NULL')
  })

  // ── 13. NOT NULL + UNIQUE: demo_master.demo_ref ────────────────────────────
  await step('NOT NULL: demo_master.demo_ref', async client => {
    if (!await columnIsNullable(client, 'demo_master', 'demo_ref')) {
      skip('demo_master.demo_ref already NOT NULL')
      return
    }
    const nullRows = await client.query(
      `SELECT COUNT(*) AS n FROM public.demo_master WHERE demo_ref IS NULL OR demo_ref = ''`
    )
    if (Number(nullRows.rows[0].n) > 0) {
      fail(`${nullRows.rows[0].n} rows still have null/empty demo_ref — backfill must run first`)
      throw new Error('Cannot set NOT NULL: null rows remain')
    }
    await client.query(`ALTER TABLE public.demo_master ALTER COLUMN demo_ref SET NOT NULL`)
    ok('Set demo_master.demo_ref NOT NULL')
    await insertVersion(client, '1.6.1', 'demo_master.demo_ref set NOT NULL')
  })

  // ── 14. CHECK: admin_users.role ───────────────────────────────────────────
  await step('CHECK constraint: admin_users.role', async client => {
    const cname = 'chk_admin_users_role'
    if (await constraintExists(client, 'admin_users', cname)) {
      skip(`${cname} already exists`); return
    }
    const bad = await client.query(
      `SELECT role, COUNT(*) AS n FROM public.admin_users
       WHERE role NOT IN ('Assistant','Admin','Super Admin') GROUP BY role`
    )
    if (bad.rowCount! > 0) {
      for (const r of bad.rows) fail(`Non-canonical admin role "${r.role}" (${r.n} rows)`)
      throw new Error('Non-canonical role values prevent CHECK constraint')
    }
    await client.query(`
      ALTER TABLE public.admin_users
      ADD CONSTRAINT chk_admin_users_role
      CHECK (role IN ('Assistant','Admin','Super Admin'))
    `)
    ok('Added CHECK: admin_users.role IN (Assistant, Admin, Super Admin)')
    await insertVersion(client, '1.7.0', 'CHECK constraint: admin_users.role enum')
  })

  // ── 15. CHECK: hosts.role = 'Host' ────────────────────────────────────────
  await step('CHECK constraint: hosts.role', async client => {
    const cname = 'chk_hosts_role'
    if (await constraintExists(client, 'hosts', cname)) {
      skip(`${cname} already exists`); return
    }
    const bad = await client.query(
      `SELECT role, COUNT(*) AS n FROM public.hosts WHERE role != 'Host' GROUP BY role`
    )
    if (bad.rowCount! > 0) {
      for (const r of bad.rows) fail(`Non-canonical host role "${r.role}" (${r.n} rows)`)
      throw new Error('Non-canonical role values prevent CHECK constraint')
    }
    await client.query(`
      ALTER TABLE public.hosts
      ADD CONSTRAINT chk_hosts_role CHECK (role = 'Host')
    `)
    ok('Added CHECK: hosts.role = Host')
    await insertVersion(client, '1.7.1', 'CHECK constraint: hosts.role = Host')
  })

  // ── 16. CHECK: operators.role = 'Operator' ────────────────────────────────
  await step('CHECK constraint: operators.role', async client => {
    const cname = 'chk_operators_role'
    if (await constraintExists(client, 'operators', cname)) {
      skip(`${cname} already exists`); return
    }
    const bad = await client.query(
      `SELECT role, COUNT(*) AS n FROM public.operators WHERE role != 'Operator' GROUP BY role`
    )
    if (bad.rowCount! > 0) {
      for (const r of bad.rows) fail(`Non-canonical operator role "${r.role}" (${r.n} rows)`)
      throw new Error('Non-canonical role values prevent CHECK constraint — run db:cleanup first')
    }
    await client.query(`
      ALTER TABLE public.operators
      ADD CONSTRAINT chk_operators_role CHECK (role = 'Operator')
    `)
    ok('Added CHECK: operators.role = Operator')
    await insertVersion(client, '1.7.2', 'CHECK constraint: operators.role = Operator')
  })

  // ── Final ─────────────────────────────────────────────────────────────────
  hr()
  log('Verifying schema_version entries:')
  const client = await pool.connect()
  try {
    const versions = await client.query(`SELECT version, description, applied_at FROM public.schema_version ORDER BY id`)
    for (const v of versions.rows) {
      console.log(`  [${v.version}] ${v.description} (${String(v.applied_at).substring(0,10)})`)
    }
  } finally {
    client.release()
  }

  hr()
  console.log(`\n[${ts()}] PRODUCTION READINESS MIGRATION COMPLETE\n`)
  console.log('  Next: npm run db:verify && npm run db:health\n')
  await pool.end()
}

main().catch(e => {
  fail('MIGRATION ABORTED — ' + e.message)
  pool.end()
  process.exit(1)
})
