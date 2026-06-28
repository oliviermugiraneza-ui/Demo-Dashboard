/**
 * Creates the public.demo_backlog table in PostgreSQL.
 * Run once with: npm run migrate-backlog
 */
import { Pool } from 'pg'
import dotenv from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '../.env') })

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
})

const SQL = `
CREATE TABLE IF NOT EXISTS public.demo_backlog (
  id                    BIGSERIAL PRIMARY KEY,
  status                TEXT NOT NULL DEFAULT 'Proposed',
  company               TEXT,
  customer              TEXT,
  requestor             TEXT,
  host                  TEXT,
  window_person         TEXT,
  preferred_demo_date   TEXT,
  preferred_time        TEXT,
  schedule_status       TEXT,
  demo_purpose          TEXT,
  demo_route            TEXT,
  vehicle               TEXT,
  expected_performance  TEXT,
  priority              TEXT,
  next_action           TEXT,
  ops_impact_hrs        TEXT,
  ticket_link           TEXT,
  notes                 TEXT,
  geo                   TEXT,
  demo_type             TEXT,
  estimated_guests      INTEGER,
  ops_notes             TEXT,
  converted_demo_id     BIGINT,
  converted_at          TIMESTAMP,
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW(),
  created_by            TEXT,
  updated_by            TEXT
);

CREATE INDEX IF NOT EXISTS idx_demo_backlog_status     ON public.demo_backlog (status);
CREATE INDEX IF NOT EXISTS idx_demo_backlog_updated_at ON public.demo_backlog (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_demo_backlog_host       ON public.demo_backlog (host);
`

async function run() {
  console.log('Connecting to:', process.env.DATABASE_URL?.replace(/:([^:@]+)@/, ':***@'))
  try {
    await pool.query(SQL)
    console.log('✅  public.demo_backlog table created (or already exists)')
    console.log('✅  Indexes created')
  } catch (err) {
    console.error('❌  Migration failed:', err)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

void run()
