// ─── Database singleton ───────────────────────────────────────────────────────
// Exports a single pg Pool shared across all requests.
// Never recreate the pool per request — it defeats connection pooling.
//
// config/index.ts MUST be imported before this module (it loads dotenv).
// server/index.ts ensures correct import ordering.

import { Pool }    from 'pg'
import dotenv      from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath }    from 'url'
import { config }  from './config/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ENV_PATH  = resolve(__dirname, '../.env')

// Re-reads .env for the refreshPool() token-rotation path only.
// Regular startup uses config (which already loaded the env file).
function reloadLocalEnv(): void {
  dotenv.config({ path: ENV_PATH, override: true })
}

function createPool(): Pool {
  if (!config.database.url) {
    throw new Error('DATABASE_URL is not set. Add it to .env or Cloud Run environment.')
  }
  return new Pool({
    connectionString:        config.database.url,
    ssl:                     config.database.ssl,
    max:                     config.database.max,
    idleTimeoutMillis:       config.database.idleTimeoutMs,
    connectionTimeoutMillis: config.database.connectionTimeoutMs,
  })
}

export let pool = createPool()

pool.on('error', (err) => {
  console.error('[db] Unexpected pool error:', err.message)
})

// ─── Auth / connection error helpers ─────────────────────────────────────────

export function isAuthError(err: unknown): boolean {
  const e = err as { code?: string; message?: string }
  return (
    e.code === '28P01' ||
    e.code === '28000' ||
    Boolean(e.message?.toLowerCase().includes('password authentication failed')) ||
    Boolean(e.message?.toLowerCase().includes('authentication failed for')) ||
    Boolean(e.message?.toLowerCase().includes('oauth'))
  )
}

export function isConnError(err: unknown): boolean {
  const e = err as { code?: string; message?: string }
  return (
    e.code === 'ECONNREFUSED' ||
    e.code === 'ENOTFOUND'   ||
    e.code === 'ETIMEDOUT'   ||
    e.code === 'ECONNRESET'  ||
    Boolean(e.message?.toLowerCase().includes('connect econnrefused'))
  )
}

// ─── Token rotation (local dev only) ─────────────────────────────────────────
// Called when a Lakebase OAuth token expires. Re-reads .env so the new
// DATABASE_URL is picked up without a server restart.
// On Cloud Run, rotate tokens via Cloud Run environment variable updates instead.

export function refreshPool(): void {
  void pool.end().catch(() => {})
  // In development: re-read .env so a new Lakebase token in the file is picked up
  // without restarting the server. On Cloud Run, env vars are already live in
  // process.env — no .env file exists there, so this call would be a no-op anyway,
  // but skip it explicitly to avoid confusion.
  if (config.env === 'development') reloadLocalEnv()
  const newUrl = process.env.DATABASE_URL ?? config.database.url
  pool = new Pool({
    connectionString:        newUrl,
    ssl:                     config.database.ssl,
    max:                     config.database.max,
    idleTimeoutMillis:       config.database.idleTimeoutMs,
    connectionTimeoutMillis: config.database.connectionTimeoutMs,
  })
  pool.on('error', (err) => {
    if (config.env === 'production') {
      process.stdout.write(JSON.stringify({ level: 'error', msg: 'db_pool_error', error: err.message, ts: new Date().toISOString() }) + '\n')
    } else {
      console.error('[db] Pool error (after refresh):', err.message)
    }
  })
  if (config.env === 'production') {
    process.stdout.write(JSON.stringify({ level: 'info', msg: 'db_pool_refreshed', ts: new Date().toISOString() }) + '\n')
  } else {
    console.log('[db] Pool refreshed — DATABASE_URL reloaded from .env')
  }
}

// ─── Timed query wrapper ──────────────────────────────────────────────────────
// Logs every query with its duration and row count.
// Thresholds from config: warn > slowQueryMs (300ms), error > errorQueryMs (1000ms).

export async function timedQuery<T extends object = Record<string, unknown>>(
  label:    string,
  sql:      string,
  params?:  unknown[],
  meta?:    { endpoint?: string },
): Promise<import('pg').QueryResult<T>> {
  const t0     = Date.now()
  const result = await pool.query<T>(sql, params)
  const ms     = Date.now() - t0
  const rows   = result.rowCount ?? 0
  const ep     = meta?.endpoint ? ` [${meta.endpoint}]` : ''
  const slow   = config.logging.slowQueryMs
  const err    = config.logging.errorQueryMs

  if (ms >= err) {
    console.error(`[db] ⛔ ${ms}ms${ep} "${label}" → ${rows} rows`)
  } else if (ms >= slow) {
    console.warn(`[db] ⚠  ${ms}ms${ep} "${label}" → ${rows} rows`)
  } else if (config.env === 'development') {
    console.log(`[db]    ${ms}ms${ep} "${label}" → ${rows} rows`)
  }

  return result
}
