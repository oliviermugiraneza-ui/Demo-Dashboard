import { Pool } from 'pg'
import dotenv from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ENV_PATH = resolve(__dirname, '../.env')

function loadEnv() {
  dotenv.config({ path: ENV_PATH, override: true })
}

loadEnv()

function isLocalConnection(url: string): boolean {
  try {
    const { hostname } = new URL(url)
    return hostname === 'localhost' || hostname === '127.0.0.1'
  } catch {
    return false
  }
}

function createPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Create a .env file at the project root.')
  }
  const local = isLocalConnection(process.env.DATABASE_URL)
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: local ? false : { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 60_000,
    connectionTimeoutMillis: 10_000,
  })
}

export let pool = createPool()

pool.on('error', (err) => {
  console.error('[db] Unexpected pool error:', err.message)
})

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
    e.code === 'ENOTFOUND' ||
    e.code === 'ETIMEDOUT' ||
    e.code === 'ECONNRESET' ||
    Boolean(e.message?.toLowerCase().includes('connect econnrefused'))
  )
}

/**
 * Called when an auth error is detected.
 * Re-reads .env so a freshly updated DATABASE_URL is picked up automatically —
 * no server restart required after updating the token.
 */
export function refreshPool(): void {
  void pool.end().catch(() => {})
  loadEnv()
  pool = createPool()
  pool.on('error', (err) => {
    console.error('[db] Pool error (after refresh):', err.message)
  })
  console.log('[db] Pool refreshed — DATABASE_URL reloaded from .env')
}

// Thin timing wrapper — logs queries that take more than 400 ms.
// Use this in repositories on hot-path queries so slow Lakebase calls are visible.
export async function timedQuery<T extends object = Record<string, unknown>>(
  label: string,
  sql: string,
  params?: unknown[],
): Promise<import('pg').QueryResult<T>> {
  const t0 = Date.now()
  const result = await pool.query<T>(sql, params)
  const ms = Date.now() - t0
  if (ms > 400) console.warn('[db slow %dms] %s', ms, label)
  return result
}
