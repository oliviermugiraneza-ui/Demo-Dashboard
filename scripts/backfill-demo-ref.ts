/**
 * Backfills and repairs all demo_ref values in public.demo_master.
 * - Fixes NULL refs
 * - Replaces invalid refs (XX-*, wrong format, mismatched date/geo)
 * - Never overwrites a valid, correctly-formatted ref
 * - Prints a detailed summary
 *
 * Run with: npm run backfill-demo-ref
 */
import { Pool } from 'pg'
import dotenv from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '../.env') })

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false })

const VALID_GEOS = ['JP', 'UK', 'US', 'DE'] as const
const REF_REGEX  = /^(JP|UK|US|DE)-[0-9]{6}-[0-9]{2}$/

function normaliseGeo(geo: string | null | undefined): string | null {
  const g = String(geo ?? '').trim().toUpperCase()
  return VALID_GEOS.includes(g as typeof VALID_GEOS[number]) ? g : null
}

function toYYMMDD(dateStr: string | null): string {
  if (!dateStr) return '000000'
  const s = String(dateStr).trim().substring(0, 10)
  const [y, m, d] = s.split('-')
  if (!y || !m || !d || y === '0000') return '000000'
  return `${y.slice(-2)}${m}${d}`
}

async function run() {
  console.log('\n══════════════════════════════════════════════')
  console.log('   Demo Reference Backfill & Repair')
  console.log('══════════════════════════════════════════════\n')
  console.log('Connecting to:', process.env.DATABASE_URL?.replace(/:([^:@]+)@/, ':***@'))

  // Verify column + constraint exist
  await pool.query(`ALTER TABLE public.demo_master ADD COLUMN IF NOT EXISTS demo_ref TEXT`)
  const uc = await pool.query(`
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema='public' AND table_name='demo_master' AND constraint_name='demo_master_demo_ref_key'`)
  if (uc.rowCount === 0) {
    await pool.query(`ALTER TABLE public.demo_master ADD CONSTRAINT demo_master_demo_ref_key UNIQUE (demo_ref)`)
    console.log('✅  UNIQUE constraint added')
  }

  // Overall stats
  const total   = await pool.query<{ c: string }>(`SELECT COUNT(*) AS c FROM public.demo_master`)
  const valid   = await pool.query<{ c: string }>(`SELECT COUNT(*) AS c FROM public.demo_master WHERE demo_ref ~ '^(JP|UK|US|DE)-[0-9]{6}-[0-9]{2}$'`)
  const invalid = await pool.query<{ c: string }>(`SELECT COUNT(*) AS c FROM public.demo_master WHERE demo_ref IS NULL OR demo_ref !~ '^(JP|UK|US|DE)-[0-9]{6}-[0-9]{2}$'`)

  console.log(`📊  Total rows:         ${total.rows[0]?.c ?? 0}`)
  console.log(`✅  Already valid:      ${valid.rows[0]?.c ?? 0}`)
  console.log(`⚠️   Need backfill/fix:  ${invalid.rows[0]?.c ?? 0}\n`)

  if (Number(invalid.rows[0]?.c ?? 0) === 0) {
    console.log('Nothing to do — all refs are already valid.\n')
    await pool.end()
    return
  }

  // Fetch rows needing repair
  const rows = await pool.query<{
    id: string; geo: string | null; date_of_demo: string | null; demo_ref: string | null
  }>(
    `SELECT id,
            UPPER(TRIM(COALESCE(geo, '')))       AS geo,
            TO_CHAR(date_of_demo, 'YYYY-MM-DD')  AS date_of_demo,
            demo_ref
     FROM public.demo_master
     WHERE demo_ref IS NULL OR demo_ref !~ '^(JP|UK|US|DE)-[0-9]{6}-[0-9]{2}$'
     ORDER BY COALESCE(date_of_demo, '9999-12-31'), id ASC`,
  )

  let updated = 0
  let skipped = 0
  const skippedRows: { id: string; reason: string }[] = []

  for (const row of rows.rows) {
    const id = Number(row.id)

    const g = normaliseGeo(row.geo)
    if (!g) {
      skipped++
      skippedRows.push({ id: row.id, reason: `GEO="${row.geo ?? ''}" not in JP/UK/US/DE` })
      continue
    }

    const yymmdd = toYYMMDD(row.date_of_demo)
    if (yymmdd === '000000') {
      skipped++
      skippedRows.push({ id: row.id, reason: 'date_of_demo is missing/invalid' })
      continue
    }

    // Clear invalid ref before re-generating
    if (row.demo_ref !== null) {
      await pool.query(`UPDATE public.demo_master SET demo_ref = NULL WHERE id = $1`, [id])
    }

    const prefix  = `${g}-${yymmdd}`
    const pattern = `${prefix}-%`
    const rxTest  = `^${prefix}-[0-9]+$`

    const res = await pool.query<{ demo_ref: string }>(
      `UPDATE public.demo_master
       SET demo_ref = (
         SELECT $1 || '-' || LPAD(
           (COALESCE(MAX(
             CASE WHEN demo_ref ~ $2 THEN CAST(SPLIT_PART(demo_ref, '-', 3) AS INTEGER) END
           ), 0) + 1)::text, 2, '0'
         )
         FROM public.demo_master WHERE demo_ref LIKE $3
       )
       WHERE id = $4 AND demo_ref IS NULL
       RETURNING demo_ref`,
      [prefix, rxTest, pattern, id],
    )

    if (res.rowCount && res.rowCount > 0 && res.rows[0]?.demo_ref) {
      updated++
      const was = row.demo_ref ? `was "${row.demo_ref}"` : 'was NULL'
      console.log(`  ✓ #${id} (${was}) → ${res.rows[0].demo_ref}`)
    } else {
      skipped++
      skippedRows.push({ id: row.id, reason: 'generate returned no row (possible race)' })
    }
  }

  // Final validation
  const finalInvalid = await pool.query<{ c: string }>(
    `SELECT COUNT(*) AS c FROM public.demo_master WHERE demo_ref IS NULL OR demo_ref !~ '^(JP|UK|US|DE)-[0-9]{6}-[0-9]{2}$'`,
  )
  const duplicates = await pool.query<{ demo_ref: string; cnt: string }>(
    `SELECT demo_ref, COUNT(*) AS cnt FROM public.demo_master GROUP BY demo_ref HAVING COUNT(*) > 1`,
  )

  console.log('\n══════════════════════════════════════════════')
  console.log(`✅  Backfilled:   ${updated} rows`)
  console.log(`⏭️   Skipped:      ${skipped} rows`)
  if (skippedRows.length > 0) {
    console.log('\n  Skipped details:')
    skippedRows.forEach(r => console.log(`    id=${r.id}: ${r.reason}`))
  }
  console.log(`\n📊  Still invalid: ${finalInvalid.rows[0]?.c ?? 0}`)
  console.log(`🔑  Duplicates:    ${duplicates.rowCount ?? 0}`)
  if (duplicates.rowCount && duplicates.rowCount > 0) {
    console.error('\n❌  DUPLICATE REFS DETECTED:')
    duplicates.rows.forEach(r => console.error(`   ${r.demo_ref} × ${r.cnt}`))
    process.exitCode = 1
  } else {
    console.log('✅  No duplicates\n')
  }

  await pool.end()
}

void run().catch(err => { console.error('Fatal:', err); process.exit(1) })
