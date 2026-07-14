import os from 'os'
import { pool } from '../db.js'
import { DEMO_STATUS } from '../lib/demoStatus.js'
import { config } from '../config/index.js'

// ─── Constants ────────────────────────────────────────────────────────────────

const TEST_RECIPIENT = 'olivier.mugiraneza@wayve.ai'

function isValidEmail(v: string | null | undefined): v is string {
  return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

// Returns comma-joined recipient string: host email first (if valid and distinct), then TEST_RECIPIENT.
function recipientsFor(hostEmail: string | null | undefined): string {
  const host = hostEmail?.trim()
  if (isValidEmail(host) && host !== TEST_RECIPIENT) {
    return `${host},${TEST_RECIPIENT}`
  }
  return TEST_RECIPIENT
}

// ─── Types ────────────────────────────────────────────────────────────────────

/** Full demo_master row shape used for building notification emails. */
export interface DemoNotificationData {
  id:                  string | number
  demo_ref:            string | null
  status:              string | null
  geo:                 string | null
  type:                string | null
  guests_organization: string | null
  host:                string | null
  requester:           string | null
  approver:            string | null
  date_of_demo:        Date | string | null
  demo_start_time:     Date | string | null
  demo_end_time:       Date | string | null
  length:              string | null
  vehicle_type:        string | null
  route_type:          string | null
  feature_type:        string | null
  start_location:      string | null
  recce_required:      string | null
  total_guests:        string | number | null
  total_vehicles:      string | number | null
  cancelation_reason:  string | null
  calendar_event_link: string | null
  slack_link:          string | null
  date_of_readiness:   string | null
  description:         string | null
  lead_time_days:      string | number | null
}

export interface BacklogNotificationData {
  id:           string | number
  company:      string | null
  customer:     string | null
  demo_purpose: string | null
  notes:        string | null
  host:         string | null
  requestor:    string | null
  geo:          string | null
  demo_type:    string | null
  priority:     string | null
}

export interface NotificationConfigStatus {
  enabled:                    boolean
  dryRun:                     boolean
  provider:                   string
  gmailClientConfigured:      boolean
  gmailRefreshTokenConfigured: boolean
  emailFromConfigured:        boolean
  slackConfigured:            boolean
}

interface SendResult {
  success: boolean
  error?:  string
}

interface FireResult {
  success: boolean
  logged:  boolean
  dryRun:  boolean
  error?:  string
}

// ─── Provider interface ───────────────────────────────────────────────────────

interface EmailProvider {
  readonly name: string
  send(to: string, subject: string, htmlBody: string, dryRun: boolean): Promise<SendResult>
}

// ─── Gmail API provider ───────────────────────────────────────────────────────

class GmailApiProvider implements EmailProvider {
  readonly name = 'gmail_api'

  private async getAccessToken(): Promise<string> {
    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({
        client_id:     config.gmail.clientId,
        client_secret: config.gmail.clientSecret,
        refresh_token: config.gmail.refreshToken,
        grant_type:    'refresh_token',
      }),
      signal: AbortSignal.timeout(10_000),
    })

    const json = await resp.json() as {
      access_token?:      string
      error?:             string
      error_description?: string
    }

    if (!json.access_token) {
      const reason = json.error_description ?? json.error ?? `HTTP ${resp.status}`
      throw new Error(`OAuth token refresh failed: ${reason}`)
    }

    return json.access_token
  }

  private buildRaw(to: string, subject: string, htmlBody: string): string {
    const from = config.gmail.emailFrom

    // RFC 2047 encode subject if it contains non-ASCII (e.g. em-dash)
    const subjectEncoded = /[^\x00-\x7F]/.test(subject)
      ? `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`
      : subject

    // MIME spec: base64-encode body, wrap at 76 chars
    const bodyB64  = Buffer.from(htmlBody, 'utf8').toString('base64')
    const bodyWrap = bodyB64.match(/.{1,76}/g)?.join('\r\n') ?? bodyB64

    const message = [
      `From: Demo Dashboard <${from}>`,
      `To: ${to}`,
      `Subject: ${subjectEncoded}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      bodyWrap,
    ].join('\r\n')

    // base64url-encode the full RFC 2822 message for the Gmail API `raw` field
    return Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  }

  private async callGmailSend(accessToken: string, raw: string, attempt = 1): Promise<SendResult> {
    let resp: Response
    try {
      resp = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type':  'application/json',
        },
        body:   JSON.stringify({ raw }),
        signal: AbortSignal.timeout(15_000),
      })
    } catch (err) {
      // Network / timeout error — retry once
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, attempt * 1000))
        return this.callGmailSend(accessToken, raw, attempt + 1)
      }
      return { success: false, error: `Network error: ${String(err)}` }
    }

    if (resp.ok) return { success: true }

    // Retry on rate-limit and transient server errors
    if ((resp.status === 429 || resp.status >= 500) && attempt < 3) {
      await new Promise(r => setTimeout(r, attempt * 1500))
      return this.callGmailSend(accessToken, raw, attempt + 1)
    }

    // Extract the error message from the Gmail API response body
    let detail = `HTTP ${resp.status}`
    try {
      const body = await resp.json() as { error?: { message?: string } }
      if (body.error?.message) detail = body.error.message
    } catch { /* keep default detail */ }

    return { success: false, error: `Gmail API error: ${detail}` }
  }

  async send(to: string, subject: string, htmlBody: string, dryRun: boolean): Promise<SendResult> {
    if (dryRun) {
      console.log('[notifications] DRY RUN (gmail_api) to=%s subject=%s', to, subject)
      return { success: true }
    }

    const clientId     = config.gmail.clientId
    const clientSecret = config.gmail.clientSecret
    const refreshToken = config.gmail.refreshToken

    if (!clientId || !clientSecret || !refreshToken) {
      console.warn(
        '[notifications] gmail_api: one or more credentials missing ' +
        '(GOOGLE_CLIENT_ID=%s GOOGLE_CLIENT_SECRET=%s GOOGLE_REFRESH_TOKEN=%s) — skipping send',
        clientId ? 'set' : 'MISSING',
        clientSecret ? 'set' : 'MISSING',
        refreshToken ? 'set' : 'MISSING',
      )
      return { success: false, error: 'Gmail credentials not configured' }
    }

    try {
      const accessToken = await this.getAccessToken()
      const raw         = this.buildRaw(to, subject, htmlBody)
      return await this.callGmailSend(accessToken, raw)
    } catch (err) {
      return { success: false, error: String(err) }
    }
  }
}

// ─── Config helpers ───────────────────────────────────────────────────────────

function isEnabled(): boolean { return config.notifications.enabled }
function isDryRun(): boolean  { return config.notifications.dryRun  }
function getEmailProvider(): EmailProvider { return new GmailApiProvider() }

// ─── Log writer ───────────────────────────────────────────────────────────────

async function writeLog(entry: {
  demoId:       number | null
  eventType:    string
  channel:      string
  recipient:    string
  payload:      unknown
  success:      boolean
  errorMessage: string | null
}): Promise<boolean> {
  try {
    await pool.query(
      `INSERT INTO public.notification_log
         (demo_id, event_type, channel, recipient, payload, success, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        entry.demoId,
        entry.eventType,
        entry.channel,
        entry.recipient,
        JSON.stringify(entry.payload),
        entry.success,
        entry.errorMessage,
      ],
    )
    return true
  } catch (err) {
    console.error('[notifications] Failed to write notification_log:', String(err))
    return false
  }
}

// ─── Core fire helper ─────────────────────────────────────────────────────────

async function fire(opts: {
  demoId:    number | null
  eventType: string
  to:        string
  subject:   string
  htmlBody:  string
  payload:   unknown
}): Promise<FireResult> {
  const dryRun   = isDryRun()
  const provider = getEmailProvider()
  const result   = await provider.send(opts.to, opts.subject, opts.htmlBody, dryRun)

  console.log(
    '[notifications] event=%s provider=%s dryRun=%s to=%s success=%s%s',
    opts.eventType,
    provider.name,
    dryRun,
    opts.to,
    result.success,
    result.error ? ` error=${result.error}` : '',
  )

  const logged = await writeLog({
    demoId:       opts.demoId,
    eventType:    opts.eventType,
    channel:      'email',
    recipient:    opts.to,
    payload:      opts.payload,
    success:      result.success,
    errorMessage: result.error ?? null,
  })

  return { success: result.success, logged, dryRun, error: result.error }
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmtDate(raw: Date | string | null | undefined): string {
  if (!raw) return '—'
  if (raw instanceof Date) return isNaN(raw.getTime()) ? '—' : raw.toISOString().substring(0, 10)
  const s = String(raw).trim()
  if (s.startsWith('T') || s.length === 0) return '—'
  return s.substring(0, 10)
}

function fmtTime(raw: Date | string | null | undefined): string {
  if (!raw) return '—'
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return '—'
    return `${String(raw.getHours()).padStart(2, '0')}:${String(raw.getMinutes()).padStart(2, '0')}`
  }
  const s = String(raw).trim()
  if (s.includes('T')) return s.split('T')[1]?.substring(0, 5) ?? '—'
  return s.substring(0, 5) || '—'
}

const EVENT_LABELS: Record<string, string> = {
  demo_created:              'New Demo Created',
  demo_approved:             'Demo Approved',
  demo_cancelled:            'Demo Cancelled',
  demo_rescheduled:          'Demo Rescheduled',
  demo_mark_ready:           'Demo Marked Ready',
  backlog_converted_to_demo: 'Backlog Converted to Demo',
  'Notification Test':       'Notification Test',
}

function eventLabel(eventType: string): string {
  return EVENT_LABELS[eventType] ?? eventType
}

// ─── Email template ───────────────────────────────────────────────────────────

type Row = [string, string | number | null | undefined]

function section(title: string, rows: Row[]): string {
  const valid = rows.filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '' && String(v) !== '—')
  if (valid.length === 0) return ''
  const tableRows = valid.map(([label, value]) => `
      <tr>
        <td style="padding:7px 0 7px 0;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.06em;width:150px;vertical-align:top;">${label}</td>
        <td style="padding:7px 0;font-size:13px;color:#111827;vertical-align:top;">${String(value)}</td>
      </tr>`).join('')
  return `
    <div style="margin-bottom:24px;">
      <div style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#6366f1;padding-bottom:6px;border-bottom:2px solid #e0e7ff;margin-bottom:6px;">${title}</div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">${tableRows}
      </table>
    </div>`
}

/**
 * Builds the full HTML email for any demo dashboard event.
 * Sections are only rendered if they contain at least one non-empty field.
 */
export function buildDemoEventEmailHtml(
  eventType: string,
  demo: DemoNotificationData,
  metadata?: {
    oldStatus?:    string
    backlog?:      BacklogNotificationData
    oldDate?:      string
    oldStartTime?: string
    oldEndTime?:   string
  },
): string {
  const label     = eventLabel(eventType)
  const timestamp = new Date().toISOString()
  const hostname  = os.hostname()
  const version   = process.env.npm_package_version ?? '1.0.0'
  const demoIdStr = String(demo.id)

  const statusBadge = (s: string | null) => {
    if (!s) return '—'
    const colours: Record<string, string> = {
      [DEMO_STATUS.APPROVED]:    'background:#d1fae5;color:#065f46',
      [DEMO_STATUS.CANCELED]:    'background:#fee2e2;color:#991b1b',
      [DEMO_STATUS.NEED_REVIEW]: 'background:#fef3c7;color:#92400e',
      [DEMO_STATUS.COMPLETED]:   'background:#dbeafe;color:#1e40af',
      [DEMO_STATUS.DELETED]:     'background:#f1f5f9;color:#64748b',
    }
    const style = colours[s] ?? 'background:#f3f4f6;color:#374151'
    return `<span style="${style};font-size:11px;font-weight:700;padding:3px 10px;border-radius:9999px;">${s}</span>`
  }

  const link = (url: string | null | undefined, label: string) =>
    url ? `<a href="${url}" style="color:#2563eb;text-decoration:underline;">${label}</a>` : null

  // ── Sections ─────────────────────────────────────────────────────────────

  const refDisplay = demo.demo_ref?.trim()
    ? `<span style="font-family:monospace;font-size:14px;font-weight:800;color:#1d4ed8;background:#dbeafe;padding:3px 10px;border-radius:6px;">${demo.demo_ref.trim()}</span>`
    : `#${demoIdStr}`

  const summaryRows: Row[] = [
    ['Event',           label],
    ['Demo Reference',  refDisplay],
    eventType === 'demo_cancelled'
      ? ['Cancellation reason', demo.cancelation_reason || 'Not specified']
      : null,
    ['Status',          demo.status ? statusBadge(demo.status) : null],
    ['Previous status', metadata?.oldStatus ? statusBadge(metadata.oldStatus) : null],
    ['GEO',             demo.geo],
    ['Type',            demo.type],
    ['Organisation',    demo.guests_organization],
  ].filter(Boolean) as Row[]

  const scheduleRows: Row[] = [
    ['Date',       fmtDate(demo.date_of_demo)],
    ['Start time', fmtTime(demo.demo_start_time)],
    ['End time',   fmtTime(demo.demo_end_time)],
    ['Duration',   demo.length],
  ]

  const peopleRows: Row[] = [
    ['Host',      demo.host],
    ['Requester', demo.requester],
    ['Approver',  demo.approver],
  ]

  const opsRows: Row[] = [
    ['Vehicle type',   demo.vehicle_type],
    ['Route type',     demo.route_type],
    ['Feature type',   demo.feature_type],
    ['Start location', demo.start_location],
    ['Recce required', demo.recce_required],
    ['Total guests',   demo.total_guests !== null && demo.total_guests !== undefined ? String(demo.total_guests) : null],
    ['Total vehicles', demo.total_vehicles !== null && demo.total_vehicles !== undefined ? String(demo.total_vehicles) : null],
  ]

  const calLink   = link(demo.calendar_event_link, 'Open Calendar Event')
  const slackLink = link(demo.slack_link,          'Open Slack Thread')
  const linksRows: Row[] = [
    ['Calendar', calLink],
    ['Slack',    slackLink],
  ]

  // Event-specific section
  const eventRows: Row[] = []
  if (eventType === 'demo_rescheduled') {
    const oldParts = [
      metadata?.oldDate      && `Date: ${metadata.oldDate}`,
      metadata?.oldStartTime && `Start: ${metadata.oldStartTime}`,
      metadata?.oldEndTime   && `End: ${metadata.oldEndTime}`,
    ].filter(Boolean)
    if (oldParts.length > 0) eventRows.push(['Previous schedule', oldParts.join(' · ')])
  }
  if (eventType === 'backlog_converted_to_demo' && metadata?.backlog) {
    const b = metadata.backlog
    eventRows.push(
      ['Backlog ID',        String(b.id)],
      ['Company',           b.company],
      ['Customer',          b.customer],
      ['Business context',  b.demo_purpose],
      ['Notes',             b.notes],
    )
  }
  if (eventType === 'demo_mark_ready') {
    eventRows.push(['Readiness date', demo.date_of_readiness || 'Today'])
  }

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Inter',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;">
<tr><td align="center" style="padding:32px 16px;">

<table width="600" cellpadding="0" cellspacing="0" border="0"
  style="background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06);">

  <!-- Header -->
  <tr>
    <td style="background:linear-gradient(135deg,#4F46E5 0%,#2563EB 100%);padding:28px 36px 24px;">
      <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-.3px;">Demo Dashboard</div>
      <div style="font-size:15px;font-weight:600;color:#e0e7ff;margin-top:4px;">${label}</div>
      <div style="margin-top:10px;display:inline-block;background:rgba(255,255,255,.15);
                  border-radius:6px;padding:3px 10px;font-size:11px;font-weight:600;
                  color:#c7d2fe;letter-spacing:.05em;text-transform:uppercase;">
        Local Docker Development
      </div>
    </td>
  </tr>

  <!-- Body -->
  <tr>
    <td style="padding:28px 36px 20px;">

      ${section('Summary',   summaryRows)}
      ${section('Schedule',  scheduleRows)}
      ${section('People',    peopleRows)}
      ${section('Operations', opsRows)}
      ${linksRows.some(([, v]) => v) ? section('Links', linksRows) : ''}
      ${eventRows.length > 0 ? section(
        eventType === 'backlog_converted_to_demo' ? 'Backlog Origin'    :
        eventType === 'demo_cancelled'            ? 'Cancellation'      :
        eventType === 'demo_rescheduled'          ? 'Previous Schedule' :
        'Detail',
        eventRows,
      ) : ''}

    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="padding:16px 36px;background:#f8fafc;border-top:1px solid #e2e8f0;border-radius:0 0 16px 16px;">
      <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6;">
        Sent by <strong>Demo Dashboard</strong> &middot; ${timestamp}<br>
        v${version} &middot; ${hostname}<br>
        <em>This is a development notification — do not reply to this email.</em>
      </p>
    </td>
  </tr>

</table>
</td></tr></table>
</body></html>`
}

// ─── Test-notification template (plain connectivity check) ────────────────────

function buildTestHtml(message: string): string {
  const timestamp = new Date().toISOString()
  const hostname  = os.hostname()
  const version   = process.env.npm_package_version ?? '1.0.0'
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:40px 20px;">
<table width="600" cellpadding="0" cellspacing="0" border="0"
  style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;">
  <tr>
    <td style="background:linear-gradient(135deg,#4F46E5,#2563EB);padding:28px 36px;border-radius:16px 16px 0 0;">
      <div style="font-size:20px;font-weight:700;color:#fff;">Demo Dashboard</div>
      <div style="font-size:13px;color:#c7d2fe;margin-top:4px;">Notification Test</div>
    </td>
  </tr>
  <tr>
    <td style="padding:28px 36px;">
      <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6;">
        This email confirms that the Demo Dashboard notification service is correctly connected to Gmail API.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0"
        style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <tr style="background:#f9fafb;">
          <td style="padding:10px 16px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #e5e7eb;">Provider</td>
          <td style="padding:10px 16px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #e5e7eb;">Status</td>
        </tr>
        <tr>
          <td style="padding:14px 16px;font-size:13px;color:#374151;">Gmail API (OAuth2)</td>
          <td style="padding:14px 16px;">
            <span style="background:#d1fae5;color:#065f46;font-size:11px;font-weight:700;padding:4px 10px;border-radius:9999px;">CONNECTED</span>
          </td>
        </tr>
      </table>
      ${message ? `<p style="margin:20px 0 0;font-size:13px;color:#6b7280;padding:14px 16px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">${message}</p>` : ''}
    </td>
  </tr>
  <tr>
    <td style="padding:16px 36px;border-top:1px solid #f3f4f6;background:#f9fafb;border-radius:0 0 16px 16px;">
      <p style="margin:0;font-size:11px;color:#9ca3af;">Generated automatically by Demo Dashboard</p>
      <p style="margin:4px 0 0;font-size:11px;color:#d1d5db;">${timestamp} &middot; v${version} &middot; ${hostname}</p>
    </td>
  </tr>
</table>
</td></tr></table>
</body></html>`
}

// ─── NotificationService ──────────────────────────────────────────────────────

export class NotificationService {

  // ── Config ──────────────────────────────────────────────────────────────────

  static getConfigStatus(): NotificationConfigStatus {
    return {
      enabled:                    isEnabled(),
      dryRun:                     isDryRun(),
      provider:                   'gmail_api',
      gmailClientConfigured:       Boolean(config.gmail.clientId) && Boolean(config.gmail.clientSecret),
      gmailRefreshTokenConfigured: Boolean(config.gmail.refreshToken),
      emailFromConfigured:         Boolean(config.gmail.emailFrom),
      slackConfigured:             false,
    }
  }

  // ── DB helper ────────────────────────────────────────────────────────────────

  static async fetchDemoRow(id: number): Promise<DemoNotificationData | null> {
    try {
      const result = await pool.query<DemoNotificationData>(
        `SELECT id, demo_ref, status, geo, type, guests_organization, host, requester, approver,
                date_of_demo, demo_start_time, demo_end_time, length,
                vehicle_type, route_type, feature_type, start_location, recce_required,
                total_guests, total_vehicles, cancelation_reason, calendar_event_link,
                slack_link, date_of_readiness, description, lead_time_days
         FROM public.demo_master WHERE id = $1`,
        [id],
      )
      return result.rows[0] ?? null
    } catch (err) {
      console.error('[notifications] fetchDemoRow failed:', String(err))
      return null
    }
  }

  // ── Subject builder ──────────────────────────────────────────────────────────

  private static subject(eventType: string, demo: DemoNotificationData): string {
    const label = eventLabel(eventType)
    const ref   = demo.demo_ref?.trim()
    if (ref) return `[Demo Dashboard] ${ref} ${label}`
    const identifier = demo.guests_organization?.trim() || demo.type?.trim() || String(demo.id)
    return `[Demo Dashboard] ${label} — ${identifier}`
  }

  // ── Guard: skip if notifications disabled ────────────────────────────────────

  private static disabled(): boolean {
    if (!isEnabled()) {
      console.log('[notifications] NOTIFICATIONS_ENABLED=false — skipping.')
      return true
    }
    return false
  }

  // ── 1. Demo Created ──────────────────────────────────────────────────────────

  static async notifyDemoCreated(demo: DemoNotificationData): Promise<FireResult> {
    if (NotificationService.disabled()) return { success: true, logged: false, dryRun: isDryRun() }
    const subject = NotificationService.subject('demo_created', demo)
    const html    = buildDemoEventEmailHtml('demo_created', demo)
    // Send to both the host email (stored in requester field) and TEST_RECIPIENT
    const to = recipientsFor(demo.requester)
    return fire({
      demoId:    Number(demo.id),
      eventType: 'demo_created',
      to,
      subject,
      htmlBody:  html,
      payload:   { demoId: demo.id, status: demo.status, organization: demo.guests_organization, recipients: to, subject },
    })
  }

  // ── 2. Demo Rescheduled ──────────────────────────────────────────────────────

  static async notifyDemoRescheduled(
    demo:          DemoNotificationData,
    oldDate?:      string,
    oldStartTime?: string,
    oldEndTime?:   string,
  ): Promise<FireResult> {
    if (NotificationService.disabled()) return { success: true, logged: false, dryRun: isDryRun() }
    const subject = NotificationService.subject('demo_rescheduled', demo)
    const html    = buildDemoEventEmailHtml('demo_rescheduled', demo, { oldDate, oldStartTime, oldEndTime })
    return fire({
      demoId:    Number(demo.id),
      eventType: 'demo_rescheduled',
      to:        TEST_RECIPIENT,
      subject,
      htmlBody:  html,
      payload:   { demoId: demo.id, oldDate, newDate: String(demo.date_of_demo ?? ''), subject },
    })
  }

  // ── 3. Demo Approved ─────────────────────────────────────────────────────────

  static async notifyDemoApproved(demo: DemoNotificationData, oldStatus?: string): Promise<FireResult> {
    if (NotificationService.disabled()) return { success: true, logged: false, dryRun: isDryRun() }
    const subject = NotificationService.subject('demo_approved', demo)
    const html    = buildDemoEventEmailHtml('demo_approved', demo, { oldStatus })
    return fire({
      demoId:    Number(demo.id),
      eventType: 'demo_approved',
      to:        TEST_RECIPIENT,
      subject,
      htmlBody:  html,
      payload:   { demoId: demo.id, oldStatus, newStatus: demo.status, subject },
    })
  }

  // ── 5. Demo Cancelled ────────────────────────────────────────────────────────

  static async notifyDemoCancelled(demo: DemoNotificationData, oldStatus?: string): Promise<FireResult> {
    if (NotificationService.disabled()) return { success: true, logged: false, dryRun: isDryRun() }
    const subject = NotificationService.subject('demo_cancelled', demo)
    const html    = buildDemoEventEmailHtml('demo_cancelled', demo, { oldStatus })
    return fire({
      demoId:    Number(demo.id),
      eventType: 'demo_cancelled',
      to:        TEST_RECIPIENT,
      subject,
      htmlBody:  html,
      payload:   { demoId: demo.id, oldStatus, cancelReason: demo.cancelation_reason, subject },
    })
  }

  // ── 6. Demo Mark Ready ───────────────────────────────────────────────────────

  static async notifyDemoMarkReady(demo: DemoNotificationData): Promise<FireResult> {
    if (NotificationService.disabled()) return { success: true, logged: false, dryRun: isDryRun() }
    const subject = NotificationService.subject('demo_mark_ready', demo)
    const html    = buildDemoEventEmailHtml('demo_mark_ready', demo)
    return fire({
      demoId:    Number(demo.id),
      eventType: 'demo_mark_ready',
      to:        TEST_RECIPIENT,
      subject,
      htmlBody:  html,
      payload:   { demoId: demo.id, readinessDate: demo.date_of_readiness, subject },
    })
  }

  // ── 7. Backlog Converted to Demo ─────────────────────────────────────────────

  static async notifyBacklogConverted(
    backlog: BacklogNotificationData,
    demoId:  number,
    demo?:   DemoNotificationData | null,
  ): Promise<FireResult> {
    if (NotificationService.disabled()) return { success: true, logged: false, dryRun: isDryRun() }
    const demoData = demo ?? {
      id:                  demoId,
      demo_ref:            null,
      status:              DEMO_STATUS.NEED_REVIEW,
      geo:                 backlog.geo,
      type:                backlog.demo_type,
      guests_organization: backlog.company,
      host:                backlog.host,
      requester:           backlog.requestor,
      approver:            null,
      date_of_demo:        null,
      demo_start_time:     null,
      demo_end_time:       null,
      length:              null,
      vehicle_type:        null,
      route_type:          null,
      feature_type:        null,
      start_location:      null,
      recce_required:      null,
      total_guests:        null,
      total_vehicles:      null,
      cancelation_reason:  null,
      calendar_event_link: null,
      slack_link:          null,
      date_of_readiness:   null,
      description:         backlog.demo_purpose,
      lead_time_days:      null,
    }
    const subject = NotificationService.subject('backlog_converted_to_demo', demoData)
    const html    = buildDemoEventEmailHtml('backlog_converted_to_demo', demoData, { backlog })
    return fire({
      demoId:    demoId,
      eventType: 'backlog_converted_to_demo',
      to:        TEST_RECIPIENT,
      subject,
      htmlBody:  html,
      payload:   { backlogId: backlog.id, demoId, company: backlog.company, subject },
    })
  }

  // ── Test notification (connectivity check or event replay) ───────────────────

  static async sendTestNotification(input: {
    channel:    string
    recipient?: string
    subject?:   string
    message?:   string
    eventType?: string
    demoId?:    number | string
  }): Promise<FireResult> {
    const dryRun = isDryRun()

    if (input.channel !== 'email') {
      return { success: false, logged: false, dryRun, error: `Channel "${input.channel}" not yet supported.` }
    }

    // ── Event-style test: fetch real demo and build real event email ──
    if (input.eventType && input.demoId) {
      const id   = Number(input.demoId)
      const demo = await NotificationService.fetchDemoRow(id)
      if (!demo) {
        return { success: false, logged: false, dryRun, error: `Demo ${id} not found.` }
      }

      switch (input.eventType) {
        case 'demo_created':           return NotificationService.notifyDemoCreated(demo)
        case 'demo_approved':          return NotificationService.notifyDemoApproved(demo)
        case 'demo_cancelled':         return NotificationService.notifyDemoCancelled(demo)
        case 'demo_mark_ready':        return NotificationService.notifyDemoMarkReady(demo)
        case 'backlog_converted_to_demo': {
          const backlogStub: BacklogNotificationData = {
            id:           0,
            company:      demo.guests_organization,
            customer:     null,
            demo_purpose: demo.description,
            notes:        null,
            host:         demo.host,
            requestor:    demo.requester,
            geo:          demo.geo,
            demo_type:    demo.type,
            priority:     null,
          }
          return NotificationService.notifyBacklogConverted(backlogStub, id, demo)
        }
        default:
          return { success: false, logged: false, dryRun, error: `Unknown eventType "${input.eventType}".` }
      }
    }

    // ── Plain connectivity test ──
    const to       = TEST_RECIPIENT
    const subject  = input.subject  ?? 'Demo Dashboard Notification Test'
    const htmlBody = buildTestHtml(input.message ?? '')

    const provider = getEmailProvider()
    const result   = await provider.send(to, subject, htmlBody, dryRun)

    console.log(
      '[notifications] test email provider=%s dryRun=%s to=%s success=%s%s',
      provider.name,
      dryRun,
      to,
      result.success,
      result.error ? ` error=${result.error}` : '',
    )

    const logged = await writeLog({
      demoId:       null,
      eventType:    'Notification Test',
      channel:      'email',
      recipient:    to,
      payload:      { subject, message: input.message, dryRun },
      success:      result.success,
      errorMessage: result.error ?? null,
    })

    return { success: result.success, logged, dryRun, error: result.error }
  }
}
