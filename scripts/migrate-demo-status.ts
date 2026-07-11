/**
 * Migrate demo_master.status to the new canonical status model:
 *   Reviewed      → APPROVED
 *   Needs Review  → NEED REVIEW
 *   Canceled/led  → CANCELED
 *
 * Also auto-completes any APPROVED demos whose end time + 3h has passed.
 *
 * Safe to rerun: WHERE clauses are idempotent.
 */

import { Pool } from 'pg'
import * as dotenv from 'dotenv'

dotenv.config()

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    `postgresql://admin:demo123@localhost:5432/demo_dashboard`,
})

async function run() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const r1 = await client.query(`
      UPDATE public.demo_master
      SET status = 'APPROVED'
      WHERE LOWER(TRIM(status)) = 'reviewed'
    `)
    console.log(`  Reviewed → APPROVED     : ${r1.rowCount ?? 0} rows`)

    const r2 = await client.query(`
      UPDATE public.demo_master
      SET status = 'NEED REVIEW'
      WHERE LOWER(TRIM(status)) IN ('needs review', 'need review', 'needs_review')
    `)
    console.log(`  Needs Review → NEED REVIEW: ${r2.rowCount ?? 0} rows`)

    const r3 = await client.query(`
      UPDATE public.demo_master
      SET status = 'CANCELED'
      WHERE LOWER(TRIM(status)) IN ('canceled', 'cancelled')
    `)
    console.log(`  Canceled/led → CANCELED  : ${r3.rowCount ?? 0} rows`)

    // Auto-complete past approved demos (end time + 3 h already elapsed)
    const r4 = await client.query(`
      UPDATE public.demo_master
      SET status = 'COMPLETED'
      WHERE status = 'APPROVED'
        AND date_of_demo IS NOT NULL
        AND demo_end_time IS NOT NULL
        AND (date_of_demo::date + demo_end_time::time + INTERVAL '3 hours') < NOW()
    `)
    console.log(`  Auto-completed past demos : ${r4.rowCount ?? 0} rows`)

    await client.query('COMMIT')

    // Verify final state
    const check = await client.query<{ status: string; count: string }>(
      `SELECT COALESCE(status, 'NULL') AS status, COUNT(*)::text AS count
       FROM public.demo_master
       GROUP BY status
       ORDER BY status`,
    )
    console.log('\n  Final status distribution:')
    check.rows.forEach(r => console.log(`    ${r.status}: ${r.count}`))
    console.log('')

  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Migration failed — rolled back:', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

void run()
