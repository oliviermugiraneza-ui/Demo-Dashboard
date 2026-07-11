/**
 * Generates a Gmail OAuth2 refresh token for the Demo Dashboard notification service.
 *
 * Usage:  npm run get-gmail-token
 *
 * The script will:
 *   1. Print the authorization URL
 *   2. Start a local server on port 3456 to capture the redirect automatically
 *   3. Exchange the auth code for tokens
 *   4. Print GOOGLE_REFRESH_TOKEN for pasting into .env
 */

import http from 'node:http'
import dotenv from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '../.env') })

// ─── Credentials ──────────────────────────────────────────────────────────────
// These are Desktop app (installed app) credentials.
// The client_secret is not sensitive for this app type — it is embedded by design.

const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID
  ?? 'your-google-client-id'
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
  ?? 'your-google-client-secret'
const REDIRECT_PORT = 3456
const REDIRECT_URI  = `http://localhost:${REDIRECT_PORT}`
const SCOPE = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar.events',
].join(' ')

async function main() {
  // ─── Build authorization URL ────────────────────────────────────────────────

  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    response_type: 'code',
    scope:         SCOPE,
    access_type:   'offline',
    prompt:        'consent',   // forces refresh_token to always be returned
  })

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`

  console.log()
  console.log('  ┌─────────────────────────────────────────────────────────────┐')
  console.log('  │         Gmail + Google Calendar OAuth Token Generator       │')
  console.log('  └─────────────────────────────────────────────────────────────┘')
  console.log()
  console.log('  Step 1 — Open this URL in your browser:')
  console.log()
  console.log('  ' + authUrl)
  console.log()
  console.log('  Step 2 — Sign in with olivier.mugiraneza@wayve.ai and grant access.')
  console.log()
  console.log('  Step 3 — The browser will redirect to localhost. This page will')
  console.log('           capture the code automatically.')
  console.log()
  console.log(`  Listening on http://localhost:${REDIRECT_PORT} …`)
  console.log()

  // ─── Capture auth code via local redirect server ────────────────────────────

  const code = await new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url   = new URL(req.url ?? '/', `http://localhost:${REDIRECT_PORT}`)
      const code  = url.searchParams.get('code')
      const error = url.searchParams.get('error')

      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Authorized</title></head>
<body style="font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f0fdf4;">
  <div style="text-align:center;">
    <div style="font-size:48px;">&#x2705;</div>
    <h2 style="color:#16a34a;margin:16px 0 8px;">Authorization successful</h2>
    <p style="color:#6b7280;">You can close this tab and return to the terminal.</p>
  </div>
</body></html>`)
        server.close()
        resolve(code)
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Error</title></head>
<body style="font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#fef2f2;">
  <div style="text-align:center;">
    <div style="font-size:48px;">&#x274C;</div>
    <h2 style="color:#dc2626;margin:16px 0 8px;">Authorization failed</h2>
    <p style="color:#6b7280;">${error ?? 'Unknown error'}</p>
  </div>
</body></html>`)
        server.close()
        reject(new Error(`OAuth error: ${error ?? 'unknown'}`))
      }
    })

    server.listen(REDIRECT_PORT)

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`  ✗  Port ${REDIRECT_PORT} is already in use.`)
        console.error(`     Stop whatever is running on that port and try again.\n`)
      } else {
        console.error(`  ✗  Server error: ${err.message}\n`)
      }
      reject(err)
    })
  })

  console.log('  ✓  Authorization code received.')
  console.log('  Exchanging for tokens …')
  console.log()

  // ─── Exchange code for tokens ───────────────────────────────────────────────

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      code,
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri:  REDIRECT_URI,
      grant_type:    'authorization_code',
    }),
  })

  const tokens = await tokenRes.json() as {
    access_token?:      string
    refresh_token?:     string
    expires_in?:        number
    scope?:             string
    token_type?:        string
    error?:             string
    error_description?: string
  }

  if (tokens.error) {
    console.error(`  ✗  Token exchange failed: ${tokens.error}`)
    if (tokens.error_description) console.error(`     ${tokens.error_description}`)
    console.error()
    process.exit(1)
  }

  if (!tokens.refresh_token) {
    console.error('  ✗  No refresh_token in response.')
    console.error()
    console.error('     This usually means the account already authorized this app')
    console.error('     without the "prompt=consent" parameter.')
    console.error()
    console.error('     Fix: revoke access at https://myaccount.google.com/permissions')
    console.error('     then run this script again.')
    console.error()
    process.exit(1)
  }

  // ─── Print result ───────────────────────────────────────────────────────────

  console.log('  ┌─────────────────────────────────────────────────────────────┐')
  console.log('  │  ✓  Success! Add these variables to your .env file:         │')
  console.log('  └─────────────────────────────────────────────────────────────┘')
  console.log()
  console.log(`  GOOGLE_EMAIL_PROVIDER=gmail_api`)
  console.log(`  GOOGLE_CLIENT_ID=${CLIENT_ID}`)
  console.log(`  GOOGLE_CLIENT_SECRET=${CLIENT_SECRET}`)
  console.log(`  GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`)
  console.log(`  EMAIL_FROM=olivier.mugiraneza@wayve.ai`)
  console.log()
  console.log(`  Scope granted: ${tokens.scope ?? SCOPE}`)
  console.log()
}

main().catch((err) => {
  console.error('\n  ✗ ', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
