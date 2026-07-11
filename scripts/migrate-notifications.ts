import { Pool } from 'pg'
import dotenv from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '../.env') })

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const SQL = `
CREATE TABLE IF NOT EXISTS public.notification_log (
  id             BIGSERIAL PRIMARY KEY,
  demo_id        BIGINT,
  event_type     TEXT,
  channel        TEXT,
  recipient      TEXT,
  payload        JSONB,
  success        BOOLEAN,
  error_message  TEXT,
  created_at     TIMESTAMP DEFAULT NOW()
);
`

async function run() {
  const client = await pool.connect()
  try {
    await client.query(SQL)
    console.log('[migrate] notification_log table created (or already exists).')
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(err => {
  console.error('[migrate] Failed:', err)
  process.exit(1)
})
