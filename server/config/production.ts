// Production runtime profile — applied when NODE_ENV=production (Cloud Run)
// Required environment variables for production:
//   DATABASE_URL      — Lakebase connection string (with OAuth token)
//   ALLOWED_ORIGINS   — comma-separated Firebase Hosting domains
//   PORT              — injected automatically by Cloud Run (default 8080)
//   NOTIFICATIONS_ENABLED, NOTIFICATION_DRY_RUN
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
//   EMAIL_FROM

import type { ProfileConfig } from './development.js'

export function buildProductionProfile(allowedOrigins: string[]): ProfileConfig {
  return {
    cors: {
      // Populated from ALLOWED_ORIGINS env var in config/index.ts
      // e.g. "https://demo-dashboard.web.app,https://demo.wayve.ai"
      allowedOrigins,
    },
    logging: {
      slowRequestMs: 800,
      slowQueryMs:   300,
      errorQueryMs:  1_000,
    },
    cache: {
      ttlMs: 10 * 60 * 1_000, // 10 minutes
    },
  }
}
