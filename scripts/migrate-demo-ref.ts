/**
 * Adds demo_ref to public.demo_master and converted_demo_ref to public.demo_backlog.
 * Safe to re-run — uses IF NOT EXISTS / DO NOTHING guards.
 * Run with: npm run migrate-demo-ref
 */
import { Pool } from 'pg'
import dotenv from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '../.env') })

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false })

async function run() {
  console.log('Connecting to:', process.env.DATABASE_URL?.replace(/:([^:@]+)@/, ':***@'))
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 1. Add demo_ref to demo_master (nullable first — backfill sets it for all rows)
    await client.query(`
      ALTER TABLE public.demo_master
        ADD COLUMN IF NOT EXISTS demo_ref TEXT
    `)
    console.log('✅  demo_master.demo_ref column added (or already exists)')

    // 2. Add UNIQUE constraint (skip if already present)
    const uc = await client.query(`
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND table_name   = 'demo_master'
        AND constraint_name = 'demo_master_demo_ref_key'
    `)
    if (uc.rowCount === 0) {
      await client.query(`
        ALTER TABLE public.demo_master
          ADD CONSTRAINT demo_master_demo_ref_key UNIQUE (demo_ref)
      `)
      console.log('✅  UNIQUE constraint on demo_master.demo_ref added')
    } else {
      console.log('ℹ️   UNIQUE constraint on demo_master.demo_ref already exists')
    }

    // 3. Add converted_demo_ref to demo_backlog
    await client.query(`
      ALTER TABLE public.demo_backlog
        ADD COLUMN IF NOT EXISTS converted_demo_ref TEXT
    `)
    console.log('✅  demo_backlog.converted_demo_ref column added (or already exists)')

    await client.query('COMMIT')
    console.log('✅  Schema migration committed')

    // 4. Backfill existing demo_master rows that have no demo_ref
    //    Group by (geo, date_of_demo), sort by id ASC within each group → assigns 01, 02, …
    const nullCount = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM public.demo_master WHERE demo_ref IS NULL`,
    )
    const missing = parseInt(nullCount.rows[0]?.count ?? '0', 10)
    console.log(`ℹ️   Rows missing demo_ref: ${missing}`)

    if (missing > 0) {
      // Fetch rows that need backfill, ordered so earlier demos in each (geo, date) group get lower seq
      const rows = await pool.query<{ id: string; geo: string; date_of_demo: string | null }>(
        `SELECT id, UPPER(TRIM(COALESCE(geo,''))) AS geo,
                TO_CHAR(date_of_demo, 'YYMMDD') AS date_of_demo
         FROM public.demo_master
         WHERE demo_ref IS NULL
         ORDER BY COALESCE(date_of_demo, '9999-12-31'), id ASC`,
      )

      let updated = 0
      for (const row of rows.rows) {
        const geo     = row.geo || 'XX'
        const dateStr = row.date_of_demo || '000000'
        const id      = Number(row.id)

        // Use the DB atomically: find max seq for this (geo, date) prefix and increment
        const res = await pool.query<{ demo_ref: string }>(
          `UPDATE public.demo_master
           SET demo_ref = (
             SELECT $1 || '-' || LPAD((COALESCE(MAX(
               CASE WHEN demo_ref ~ $2
                    THEN CAST(SPLIT_PART(demo_ref, '-', 3) AS INTEGER)
               END
             ), 0) + 1)::text, 2, '0')
             FROM public.demo_master
             WHERE demo_ref LIKE $3
           )
           WHERE id = $4 AND demo_ref IS NULL
           RETURNING demo_ref`,
          [`${geo}-${dateStr}`, `^${geo}-${dateStr}-[0-9]+$`, `${geo}-${dateStr}-%`, id],
        )
        if (res.rowCount && res.rowCount > 0) {
          updated++
          console.log(`  ✓ #${id} → ${res.rows[0]?.demo_ref ?? '?'}`)
        }
      }
      console.log(`✅  Backfilled ${updated} demo_ref values`)
    }

    const final = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM public.demo_master WHERE demo_ref IS NOT NULL`,
    )
    console.log(`ℹ️   Rows with demo_ref: ${final.rows[0]?.count ?? 0}`)

  } catch (err) {
    await client.query('ROLLBACK')
    console.error('❌  Migration failed:', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

void run()
