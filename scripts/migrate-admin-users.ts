/**
 * Creates public.admin_users table.
 * Run once with: npm run migrate-admin-users
 * Safe to rerun — uses IF NOT EXISTS.
 */
import { Pool } from 'pg'
import dotenv from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '../.env') })

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false })

const SQL = `
CREATE TABLE IF NOT EXISTS public.admin_users (
  id         BIGSERIAL PRIMARY KEY,
  full_name  TEXT NOT NULL,
  email      TEXT UNIQUE NOT NULL,
  password   TEXT,
  geo        TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'Admin',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_users_geo   ON public.admin_users(geo);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON public.admin_users(email);
`

async function run() {
  console.log('Connecting to:', process.env.DATABASE_URL?.replace(/:([^:@]+)@/, ':***@'))
  try {
    await pool.query(SQL)
    console.log('✅  public.admin_users created (or already exists)')

    const count = await pool.query('SELECT COUNT(*) FROM public.admin_users')
    console.log(`    Existing rows: ${count.rows[0]!.count}`)
  } catch (err) {
    console.error('❌  Migration failed:', err)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

void run()
