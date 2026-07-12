/**
 * Lakebase Migration Script
 *
 * Safely exports the local Docker PostgreSQL database and restores it to
 * Databricks Lakebase (or any remote PostgreSQL-compatible target).
 *
 * What it does:
 *   1. Validates environment and Docker availability
 *   2. Snapshots source row counts for later comparison
 *   3. Exports schema + data with pg_dump (excludes backup tables)
 *   4. Restores to Lakebase via psql with sslmode=require
 *   5. Verifies all production tables exist on target
 *   6. Verifies row counts match source exactly
 *   7. Prints migration summary with any mismatches
 *
 * Prerequisites:
 *   - Docker running with demo-postgres container
 *   - LAKEBASE_URL set in .env or environment
 *
 * Usage:
 *   npm run db:migrate-lakebase
 *
 * Flags:
 *   FORCE_MIGRATE=1   Skip the "target already has tables" safety check
 *   DRY_RUN=1         Export dump only — skip restore and verification
 */

import { Pool }                                                     from 'pg'
import { spawnSync }                                                from 'child_process'
import { writeFileSync, readFileSync, mkdirSync, existsSync, statSync } from 'fs'
import { resolve, dirname, join }                                   from 'path'
import { fileURLToPath }                                            from 'url'
import dotenv                                                       from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT      = resolve(__dirname, '..')
dotenv.config({ path: join(ROOT, '.env') })

// ── Configuration ─────────────────────────────────────────────────────────────

const SOURCE_CONTAINER = 'demo-postgres'
const SOURCE_USER      = 'admin'
const SOURCE_DB        = 'demo_dashboard'
const SOURCE_URL       = process.env.DATABASE_URL
  ?? `postgresql://${SOURCE_USER}:demo123@localhost:5432/${SOURCE_DB}`
const TARGET_URL       = process.env.LAKEBASE_URL ?? ''
const FORCE            = process.env.FORCE_MIGRATE === '1' || process.argv.includes('--force')
const DRY_RUN          = process.env.DRY_RUN === '1'       || process.argv.includes('--dry-run')

const EXCLUDE_TABLES = ['backup_satistaction', 'backup_tracker'] as const

const PRODUCTION_TABLES = [
  'admin_users',
  'demo_backlog',
  'demo_master',
  'hosts',
  'models',
  'notification_log',
  'operators',
  'post_demo',
  'routes',
  'satisfaction',
  'schema_version',
  'vehicles',
] as const

type TableName = typeof PRODUCTION_TABLES[number]
type RowCounts = Record<TableName, number>

// ── Logging helpers ───────────────────────────────────────────────────────────

function ts()              { return new Date().toISOString().replace('T', ' ').substring(0, 19) }
function log(msg: string)  { console.log(`[${ts()}]       ${msg}`) }
function ok(msg: string)   { console.log(`[${ts()}] ✓     ${msg}`) }
function skip(msg: string) { console.log(`[${ts()}] –     ${msg}`) }
function warn(msg: string) { console.log(`[${ts()}] WARN  ${msg}`) }
function fail(msg: string) { console.error(`[${ts()}] ✗     ${msg}`) }
function hr()              { console.log('─'.repeat(72)) }

function section(title: string) {
  console.log()
  hr()
  console.log(`  ${title}`)
  hr()
}

function redact(url: string): string {
  return url.replace(/:([^:@/]{1,}?)@/, ':***@')
}

function abort(msg: string): never {
  console.error(`\n[${ts()}] ABORTED\n  ${msg.split('\n').join('\n  ')}\n`)
  process.exit(1)
}

// ── Row count helpers ─────────────────────────────────────────────────────────

async function getRowCounts(pool: Pool): Promise<RowCounts> {
  const counts = {} as RowCounts
  for (const table of PRODUCTION_TABLES) {
    try {
      const r = await pool.query(`SELECT COUNT(*) AS n FROM public.${table}`)
      counts[table] = Number(r.rows[0]!.n)
    } catch {
      counts[table] = -1  // table does not exist or query failed
    }
  }
  return counts
}

// ── URL helpers ───────────────────────────────────────────────────────────────

function withSSL(url: string): string {
  if (url.includes('sslmode=')) return url
  return url + (url.includes('?') ? '&' : '?') + 'sslmode=require'
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n' + '█'.repeat(72))
  console.log('  DEMO DASHBOARD — LAKEBASE MIGRATION')
  console.log('  ' + new Date().toISOString())
  if (DRY_RUN) console.log('  MODE: DRY RUN — restore step will be skipped')
  console.log('█'.repeat(72))

  // ── Phase 0: Validate environment ───────────────────────────────────────────
  section('PHASE 0: ENVIRONMENT VALIDATION')

  if (!TARGET_URL) {
    abort(
      'LAKEBASE_URL is not set.\n' +
      'Add it to .env:\n' +
      '  LAKEBASE_URL=postgresql://user:pass@host:port/database\n\n' +
      'Lakebase connection strings are found in the Databricks workspace:\n' +
      '  Catalog → Connections → [your connection] → Connection details'
    )
  }

  if (!TARGET_URL.startsWith('postgresql://') && !TARGET_URL.startsWith('postgres://')) {
    abort('LAKEBASE_URL must start with postgresql:// or postgres://')
  }

  log(`Source : ${redact(SOURCE_URL)}`)
  log(`Target : ${redact(withSSL(TARGET_URL))}`)
  log(`Exclude: ${EXCLUDE_TABLES.join(', ')}`)
  if (DRY_RUN) warn('DRY_RUN=1 — will export dump but skip restore and verification')
  if (FORCE)   warn('FORCE_MIGRATE=1 — will skip target safety check')
  ok('Environment validated')

  // ── Phase 1: Source database pre-flight ─────────────────────────────────────
  section('PHASE 1: SOURCE DATABASE PRE-FLIGHT')

  // Check Docker container
  const dockerInspect = spawnSync(
    'docker', ['inspect', SOURCE_CONTAINER, '--format', '{{.State.Status}}'],
    { encoding: 'utf8' }
  )
  if (dockerInspect.status !== 0 || !dockerInspect.stdout.trim().includes('running')) {
    abort(
      `Docker container "${SOURCE_CONTAINER}" is not running.\n` +
      `Start it with: docker start ${SOURCE_CONTAINER}`
    )
  }
  ok(`Docker container "${SOURCE_CONTAINER}" is running`)

  // Connect to source
  const sourcePool = new Pool({ connectionString: SOURCE_URL, ssl: false })
  try {
    await sourcePool.query('SELECT 1')
    ok('Source database connection established')
  } catch (e) {
    abort(`Cannot connect to source database: ${(e as Error).message}`)
  }

  // Verify cleanup has run (backup tables must exist locally)
  const backupCheck = await sourcePool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = ANY($1::text[])
  `, [['backup_satistaction', 'backup_tracker']])

  if ((backupCheck.rowCount ?? 0) < 2) {
    warn(
      'One or both backup tables are missing locally.\n' +
      '  Run "npm run db:cleanup" before migrating to ensure the local DB is prepared.'
    )
  } else {
    ok('Local backup tables present — will be excluded from migration')
  }

  // Verify no non-canonical data exists
  const badStatus = await sourcePool.query(`
    SELECT COUNT(*) AS n FROM public.demo_master
    WHERE status NOT IN ('NEED REVIEW','APPROVED','CANCELED','COMPLETED','DELETED')
  `)
  if (Number(badStatus.rows[0]!.n) > 0) {
    abort(
      `demo_master has ${badStatus.rows[0]!.n} rows with non-canonical status.\n` +
      'Run "npm run db:cleanup && npm run db:migrate-readiness" first.'
    )
  }
  ok('demo_master.status — all values canonical')

  // Snapshot source row counts
  log('Capturing source row counts...')
  const sourceCounts = await getRowCounts(sourcePool)
  await sourcePool.end()

  let totalSourceRows = 0
  for (const table of PRODUCTION_TABLES) {
    const n = sourceCounts[table]
    if (n < 0) {
      abort(
        `Required table "${table}" does not exist in source database.\n` +
        'Run "npm run db:migrate-readiness" to create all required tables.'
      )
    }
    log(`  ${table.padEnd(22)} ${String(n).padStart(6)} rows`)
    totalSourceRows += n
  }
  ok(`Source snapshot complete — ${totalSourceRows} total rows across ${PRODUCTION_TABLES.length} tables`)

  // ── Phase 2: Target pre-check ────────────────────────────────────────────────
  section('PHASE 2: TARGET PRE-CHECK')

  if (DRY_RUN) {
    skip('DRY RUN — skipping target pre-check')
  } else {
    const targetPrePool = new Pool({
      connectionString: withSSL(TARGET_URL),
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15_000,
    })

    try {
      await targetPrePool.query('SELECT 1')
      ok('Lakebase connection established')
    } catch (e) {
      abort(
        `Cannot connect to Lakebase:\n  ${(e as Error).message}\n\n` +
        'Check:\n' +
        '  1. LAKEBASE_URL is correct\n' +
        '  2. The Lakebase cluster is running\n' +
        '  3. Your IP is allowed (Databricks network policy)\n' +
        '  4. Credentials are valid'
      )
    }

    // Check for existing production tables on target
    const existingTables = await targetPrePool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
      ORDER BY table_name
    `, [PRODUCTION_TABLES as unknown as string[]])

    if ((existingTables.rowCount ?? 0) > 0) {
      const names = existingTables.rows.map((r: { table_name: string }) => r.table_name).join(', ')
      if (!FORCE) {
        await targetPrePool.end()
        abort(
          `Target Lakebase already has ${existingTables.rowCount} production table(s): ${names}\n\n` +
          'This may mean the database has already been migrated.\n' +
          'To overwrite and re-migrate, set FORCE_MIGRATE=1:\n' +
          '  FORCE_MIGRATE=1 npm run db:migrate-lakebase\n\n' +
          'The dump uses DROP IF EXISTS + CREATE, so re-running is safe for an empty target.\n' +
          'For a populated target, verify this is intentional before using --force.'
        )
      }
      warn(
        `Target has ${existingTables.rowCount} existing table(s): ${names}\n` +
        '  FORCE_MIGRATE=1 — proceeding with restore (DROP IF EXISTS will run first)'
      )
    } else {
      ok('Target Lakebase is empty — ready for fresh migration')
    }

    // Check backup tables are absent from Lakebase
    const targetBackups = await targetPrePool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name LIKE 'backup_%'
    `)
    if ((targetBackups.rowCount ?? 0) > 0) {
      const names = targetBackups.rows.map((r: { table_name: string }) => r.table_name).join(', ')
      warn(`Backup tables found on Lakebase: ${names} — these should not be in production`)
    } else {
      ok('No backup tables on Lakebase')
    }

    await targetPrePool.end()
  }

  // ── Phase 3: Export SQL dump ─────────────────────────────────────────────────
  section('PHASE 3: EXPORT SQL DUMP')

  // Create exports directory
  const exportsDir = join(ROOT, 'exports')
  if (!existsSync(exportsDir)) {
    mkdirSync(exportsDir, { recursive: true })
    ok(`Created exports/ directory`)
  }

  const stamp    = new Date().toISOString().replace(/:/g, '-').replace('T', '_').substring(0, 19)
  const dumpFile = join(exportsDir, `lakebase-migration-${stamp}.sql`)

  log(`Output : ${dumpFile}`)
  log('Flags  : --no-owner --no-acl --clean --if-exists')

  // Build pg_dump arguments
  const excludeFlags = EXCLUDE_TABLES.flatMap(t => ['-T', `public.${t}`])

  const dumpArgs = [
    'exec', SOURCE_CONTAINER,
    'pg_dump',
    '-U', SOURCE_USER,
    '-d', SOURCE_DB,
    '--no-owner',
    '--no-acl',
    '--clean',       // emit DROP ... IF EXISTS before each CREATE
    '--if-exists',   // use IF EXISTS in DROP statements (prevents errors on fresh target)
    ...excludeFlags,
  ]

  log('Running pg_dump...')
  const dumpResult = spawnSync('docker', dumpArgs, {
    encoding: 'buffer',
    maxBuffer: 512 * 1024 * 1024,  // 512 MB ceiling
    timeout:   120_000,             // 2 minute timeout
  })

  if (dumpResult.status !== 0) {
    const errMsg = dumpResult.stderr?.toString().trim() ?? 'Unknown error'
    abort(`pg_dump failed (exit ${dumpResult.status}):\n${errMsg}`)
  }
  if (!dumpResult.stdout || dumpResult.stdout.length === 0) {
    abort('pg_dump produced empty output — is the source database accessible?')
  }

  writeFileSync(dumpFile, dumpResult.stdout)

  const sizeKB = Math.round(statSync(dumpFile).size / 1024)
  ok(`Dump written — ${sizeKB} KB  →  ${dumpFile}`)

  // Sanity-check: verify excluded tables are absent and expected tables are present
  const dumpText = dumpResult.stdout.toString('utf8')

  for (const t of EXCLUDE_TABLES) {
    // pg_dump uses "TABLE public.table_name" in COPY statements
    if (dumpText.includes(`COPY public.${t} `) || dumpText.includes(`TABLE public.${t}`)) {
      abort(
        `Backup table "${t}" was found in the dump despite exclusion flags.\n` +
        `This should not happen — inspect ${dumpFile} before restoring.`
      )
    }
  }
  ok(`Excluded tables confirmed absent from dump (${EXCLUDE_TABLES.join(', ')})`)

  const requiredInDump = ['demo_master', 'admin_users', 'schema_version', 'demo_backlog']
  const missingFromDump = requiredInDump.filter(t => !dumpText.includes(`public.${t}`))
  if (missingFromDump.length > 0) {
    abort(
      `Expected tables missing from dump: ${missingFromDump.join(', ')}\n` +
      `Inspect ${dumpFile} before proceeding.`
    )
  }
  ok(`Required tables confirmed present in dump`)

  // ── Phase 4: Restore to Lakebase ─────────────────────────────────────────────
  section('PHASE 4: RESTORE TO LAKEBASE')

  if (DRY_RUN) {
    skip('DRY RUN — skipping restore step')
    skip('To perform the restore, run without DRY_RUN=1')
    skip(`Dump is ready at: ${dumpFile}`)
    console.log('\n  DRY RUN COMPLETE — dump exported but NOT restored.\n')
    process.exit(0)
  }

  log('Restoring dump to Lakebase via psql...')
  log('Estimated time: 30 seconds – 5 minutes depending on network')

  const targetUrlWithSSL = withSSL(TARGET_URL)
  const dumpContent      = readFileSync(dumpFile)

  const restoreResult = spawnSync(
    'docker',
    ['exec', '-i', SOURCE_CONTAINER, 'psql', targetUrlWithSSL],
    {
      input:     dumpContent,
      encoding:  'buffer',
      maxBuffer: 512 * 1024 * 1024,
      timeout:   600_000,  // 10 minute hard timeout
    }
  )

  const restoreOut = restoreResult.stdout?.toString('utf8') ?? ''
  const restoreErr = restoreResult.stderr?.toString('utf8') ?? ''

  // psql exits 0 even on SQL errors — we must scan stderr/stdout for ERROR lines
  const errorLines = restoreErr.split('\n').filter(l => /^psql:.*ERROR:/i.test(l) || /^ERROR:/i.test(l))
  const noticeLines = restoreErr.split('\n').filter(l => /NOTICE|WARNING/i.test(l))

  if (restoreResult.status !== 0) {
    log('psql stderr:')
    console.error(restoreErr.split('\n').slice(0, 20).map(l => `  ${l}`).join('\n'))
    abort(
      `psql restore process failed with exit code ${restoreResult.status}.\n` +
      'This usually indicates a connection error, not a SQL error.\n' +
      `Dump file is preserved at: ${dumpFile}`
    )
  }

  if (errorLines.length > 0) {
    warn(`Restore completed with ${errorLines.length} SQL error(s):`)
    errorLines.slice(0, 15).forEach(l => console.error(`  ${l}`))
    if (errorLines.length > 15) warn(`  ... and ${errorLines.length - 15} more (see dump file)`)
    warn(
      'SQL errors during restore usually mean:\n' +
      '  - Table already exists (use FORCE_MIGRATE=1 to re-run with DROP IF EXISTS)\n' +
      '  - Missing extension or unsupported feature\n' +
      '  - Constraint violation in existing data\n' +
      `  Dump retained at: ${dumpFile}`
    )
  } else {
    ok('Restore completed — no SQL errors')
  }

  if (noticeLines.length > 0) {
    skip(`${noticeLines.length} NOTICE/WARNING line(s) during restore (non-critical)`)
  }

  // psql output summary
  const dmlLines = restoreOut.split('\n').filter(l => /^(INSERT|UPDATE|DELETE|COPY) [0-9]/.test(l))
  if (dmlLines.length > 0) {
    log(`  ${dmlLines.length} DML statements executed`)
  }

  // ── Phase 5: Verify Lakebase ─────────────────────────────────────────────────
  section('PHASE 5: VERIFY LAKEBASE')

  const targetPool = new Pool({
    connectionString: withSSL(TARGET_URL),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15_000,
  })

  try {
    await targetPool.query('SELECT 1')
    ok('Lakebase connection established for verification')
  } catch (e) {
    abort(`Cannot connect to Lakebase for verification: ${(e as Error).message}`)
  }

  // Confirm backup tables are absent
  const finalBackupCheck = await targetPool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ANY($1::text[])
  `, [EXCLUDE_TABLES as unknown as string[]])

  if ((finalBackupCheck.rowCount ?? 0) > 0) {
    const found = finalBackupCheck.rows.map((r: { table_name: string }) => r.table_name).join(', ')
    fail(`Backup tables are present on Lakebase: ${found}`)
    fail('Drop them manually:')
    for (const r of finalBackupCheck.rows as Array<{ table_name: string }>) {
      fail(`  DROP TABLE IF EXISTS public.${r.table_name};`)
    }
  } else {
    ok('Backup tables correctly absent from Lakebase')
  }

  // Verify schema_version
  let latestVersion = '—'
  try {
    const sv = await targetPool.query(
      `SELECT version, description FROM public.schema_version ORDER BY id DESC LIMIT 1`
    )
    if (sv.rowCount! > 0) {
      latestVersion = `v${sv.rows[0].version} — ${sv.rows[0].description}`
      ok(`Schema version on Lakebase: ${latestVersion}`)
    }
  } catch {
    warn('Could not read schema_version — table may not have been restored')
  }

  // Get Lakebase row counts
  log('Verifying row counts...')
  const targetCounts = await getRowCounts(targetPool)
  await targetPool.end()

  // ── Phase 6: Migration summary ───────────────────────────────────────────────
  section('PHASE 6: MIGRATION SUMMARY')

  const COL_TABLE  = 22
  const COL_SRC    = 8
  const COL_TGT    = 10
  const COL_STATUS = 12

  console.log(
    '  ' +
    'Table'.padEnd(COL_TABLE) +
    'Source'.padStart(COL_SRC) +
    'Lakebase'.padStart(COL_TGT) +
    'Status'.padStart(COL_STATUS)
  )
  console.log('  ' + '─'.repeat(COL_TABLE + COL_SRC + COL_TGT + COL_STATUS))

  let totalMismatches = 0
  let totalMissingTables = 0
  let totalTargetRows = 0

  for (const table of PRODUCTION_TABLES) {
    const src = sourceCounts[table]!
    const tgt = targetCounts[table]!

    let statusLabel: string
    let isError = false

    if (tgt < 0) {
      statusLabel = '✗ MISSING'
      isError = true
      totalMissingTables++
      totalMismatches++
    } else if (src !== tgt) {
      statusLabel = `✗ MISMATCH (${tgt > src ? '+' : ''}${tgt - src})`
      isError = true
      totalMismatches++
      totalTargetRows += tgt
    } else {
      statusLabel = '✓ OK'
      totalTargetRows += tgt
    }

    const line =
      '  ' +
      table.padEnd(COL_TABLE) +
      String(src).padStart(COL_SRC) +
      (tgt < 0 ? '—' : String(tgt)).padStart(COL_TGT) +
      statusLabel.padStart(COL_STATUS)

    if (isError) console.error(line)
    else console.log(line)
  }

  console.log('  ' + '─'.repeat(COL_TABLE + COL_SRC + COL_TGT + COL_STATUS))
  console.log(
    '  ' +
    'TOTAL'.padEnd(COL_TABLE) +
    String(totalSourceRows).padStart(COL_SRC) +
    String(totalTargetRows).padStart(COL_TGT)
  )

  console.log()
  log(`Dump file   : ${dumpFile}`)
  log(`Schema ver  : ${latestVersion}`)
  console.log()

  if (totalMismatches === 0 && totalMissingTables === 0) {
    ok(`All ${PRODUCTION_TABLES.length} tables verified — row counts match`)
    ok(`${totalTargetRows} rows successfully migrated to Lakebase`)
    console.log()
    console.log('  ┌─────────────────────────────────────────────────────────┐')
    console.log('  │   MIGRATION COMPLETE — Lakebase is production-ready.    │')
    console.log('  └─────────────────────────────────────────────────────────┘')
    console.log()
    console.log('  Next steps:')
    console.log('    1. Set DATABASE_URL=<LAKEBASE_URL> in your production environment')
    console.log('    2. Run: DATABASE_URL=$LAKEBASE_URL npm run db:health')
    console.log('    3. Deploy the application and run a smoke test')
    console.log()
    process.exit(0)
  } else {
    console.log()
    fail(`Migration completed with issues:`)
    if (totalMissingTables > 0) fail(`  ${totalMissingTables} table(s) missing on Lakebase`)
    if (totalMismatches - totalMissingTables > 0)
      fail(`  ${totalMismatches - totalMissingTables} table(s) have row count mismatches`)
    console.log()
    console.log('  Troubleshooting:')
    console.log(`    - Inspect dump file: ${dumpFile}`)
    console.log('    - Check psql errors above for SQL-level failures')
    console.log('    - Re-run with FORCE_MIGRATE=1 if the target had stale data')
    console.log('    - Restore manually: docker exec -i demo-postgres psql $LAKEBASE_URL < ' + dumpFile)
    console.log()
    process.exit(1)
  }
}

main().catch(e => {
  console.error(`\n[FATAL] ${(e as Error).message}`)
  process.exit(1)
})
