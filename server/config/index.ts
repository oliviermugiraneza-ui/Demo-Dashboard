// ─── Configuration loader ─────────────────────────────────────────────────────
// Single entry point for all runtime configuration.
// Loads the correct .env file, selects the runtime profile, and exports a
// fully-typed, immutable config object used by every server module.
//
// Import order guarantee: this module runs dotenv.config() before any module
// that depends on process.env. Always import this BEFORE importing db.ts or
// any service that reads environment variables.

import dotenv from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { developmentProfile }   from './development.js'
import { buildProductionProfile } from './production.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT      = resolve(__dirname, '../..')

// Determine runtime environment
const NODE_ENV = process.env.NODE_ENV ?? 'development'
const isProd   = NODE_ENV === 'production'

// Load environment file — .env.{NODE_ENV} first, fall back to .env
// override: false means existing process.env values are NOT overwritten
// (Cloud Run env vars take priority over any .env file)
dotenv.config({ path: resolve(ROOT, `.env.${NODE_ENV}`), override: false })
dotenv.config({ path: resolve(ROOT, '.env'),             override: false })

// ─── Types ────────────────────────────────────────────────────────────────────

export type RuntimeEnv = 'development' | 'production'

export interface DatabaseConfig {
  url:                 string
  ssl:                 false | { rejectUnauthorized: boolean }
  max:                 number
  idleTimeoutMs:       number
  connectionTimeoutMs: number
}

export interface ServerConfig {
  port: number
  host: string
}

export interface CacheConfig {
  ttlMs: number
}

export interface CorsConfig {
  allowedOrigins: string[]
}

export interface LoggingConfig {
  slowRequestMs: number
  slowQueryMs:   number
  errorQueryMs:  number
}

export interface NotificationsConfig {
  enabled: boolean
  dryRun:  boolean
}

export interface GmailConfig {
  provider:     string
  clientId:     string
  clientSecret: string
  refreshToken: string
  emailFrom:    string
}

export interface CalendarConfig {
  id: string
}

export interface AppConfig {
  env:           RuntimeEnv
  database:      DatabaseConfig
  server:        ServerConfig
  cache:         CacheConfig
  cors:          CorsConfig
  logging:       LoggingConfig
  notifications: NotificationsConfig
  gmail:         GmailConfig
  calendar:      CalendarConfig
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isLocalConnection(url: string): boolean {
  try {
    const { hostname } = new URL(url)
    return hostname === 'localhost' || hostname === '127.0.0.1'
  } catch {
    return false
  }
}

// ─── Build config ─────────────────────────────────────────────────────────────

function buildConfig(): AppConfig {
  const dbUrl   = process.env.DATABASE_URL ?? ''
  const dbLocal = isLocalConnection(dbUrl)

  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  const profile = isProd
    ? buildProductionProfile(allowedOrigins)
    : developmentProfile

  return {
    env: NODE_ENV as RuntimeEnv,

    database: {
      url:                 dbUrl,
      ssl:                 dbLocal ? false : { rejectUnauthorized: false },
      max:                 5,
      idleTimeoutMs:       60_000,
      connectionTimeoutMs: 10_000,
    },

    server: {
      port: Number(process.env.PORT ?? process.env.API_PORT ?? 3001),
      host: '0.0.0.0',
    },

    notifications: {
      enabled: process.env.NOTIFICATIONS_ENABLED !== 'false',
      dryRun:  process.env.NOTIFICATION_DRY_RUN  === 'true',
    },

    gmail: {
      provider:     process.env.GOOGLE_EMAIL_PROVIDER ?? '',
      clientId:     process.env.GOOGLE_CLIENT_ID      ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET  ?? '',
      refreshToken: process.env.GOOGLE_REFRESH_TOKEN  ?? '',
      emailFrom:    process.env.EMAIL_FROM             ?? '',
    },

    calendar: {
      id: 'primary',
    },

    cors:    profile.cors,
    logging: profile.logging,
    cache:   profile.cache,
  }
}

export const config: AppConfig = buildConfig()

/** Which runtime profile file is active — useful for startup diagnostics. */
export const activeProfile  = isProd ? 'production.ts'    : 'development.ts'
/** Which .env file was attempted first (may fall back to .env if absent). */
export const activeEnvFile  = `.env.${NODE_ENV}`
