import { pool } from '../db.js'
import type { DemoNotificationData } from './NotificationService.js'

const CALENDAR_ID = 'primary'
const TOKEN_URL   = 'https://oauth2.googleapis.com/token'
const EVENTS_BASE = `https://www.googleapis.com/calendar/v3/calendars/${CALENDAR_ID}/events`

// Timezone by GEO — used so calendar events show correct local time for attendees
const GEO_TZ: Record<string, string> = {
  UK: 'Europe/London',
  US: 'America/New_York',
  JP: 'Asia/Tokyo',
  DE: 'Europe/Berlin',
  AU: 'Australia/Sydney',
  SG: 'Asia/Singapore',
  CN: 'Asia/Shanghai',
}

// ─── Shared token refresh (same creds as Gmail) ───────────────────────────────

async function getAccessToken(): Promise<string> {
  const resp = await fetch(TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID     ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN ?? '',
      grant_type:    'refresh_token',
    }),
    signal: AbortSignal.timeout(10_000),
  })
  const json = await resp.json() as { access_token?: string; error?: string; error_description?: string }
  if (!json.access_token) {
    throw new Error(`OAuth token refresh failed: ${json.error_description ?? json.error ?? `HTTP ${resp.status}`}`)
  }
  return json.access_token
}

// ─── Date / time helpers ──────────────────────────────────────────────────────

function calDate(raw: Date | string | null | undefined): string {
  if (!raw) return ''
  // PostgreSQL `date` comes back as a Date at midnight UTC — toISOString gives YYYY-MM-DD
  if (raw instanceof Date) return isNaN(raw.getTime()) ? '' : raw.toISOString().substring(0, 10)
  return String(raw).trim().substring(0, 10)
}

function calTime(raw: Date | string | null | undefined): string {
  if (!raw) return ''
  // PostgreSQL `timestamp without time zone` comes back as a Date; getHours() = local server time
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return ''
    return `${String(raw.getHours()).padStart(2, '0')}:${String(raw.getMinutes()).padStart(2, '0')}`
  }
  const s = String(raw).trim()
  if (s.includes('T')) return s.split('T')[1]?.substring(0, 5) ?? ''
  const timePart = s.includes(' ') ? (s.split(' ')[1] ?? '') : s
  return timePart.substring(0, 5) || ''
}

// ─── Description builder ──────────────────────────────────────────────────────

function buildDescription(demo: DemoNotificationData): string {
  const val = (v: string | number | null | undefined) => (v !== null && v !== undefined && String(v).trim()) ? String(v).trim() : null

  const lines: string[] = ['📋 DEMO DASHBOARD — EVENT DETAILS', '']

  const addField = (label: string, v: string | number | null | undefined) => {
    const s = val(v)
    if (s) lines.push(`${label}: ${s}`)
  }

  lines.push('── SUMMARY ──')
  addField('Demo Reference', demo.demo_ref)
  addField('Organisation',   demo.guests_organization)
  addField('Type',         demo.type)
  addField('GEO',          demo.geo)
  addField('Status',       demo.status)
  lines.push('')

  lines.push('── SCHEDULE ──')
  addField('Date',     calDate(demo.date_of_demo))
  addField('Start',    calTime(demo.demo_start_time))
  addField('End',      calTime(demo.demo_end_time))
  addField('Duration', demo.length)
  lines.push('')

  lines.push('── PEOPLE ──')
  addField('Host',       demo.host)
  addField('Host Email', demo.requester)
  addField('Approver',   demo.approver)
  lines.push('')

  lines.push('── OPERATIONS ──')
  addField('Vehicle',         demo.vehicle_type)
  addField('Route type',      demo.route_type)
  addField('Feature type',    demo.feature_type)
  addField('Start location',  demo.start_location)
  addField('Recce required',  demo.recce_required)
  addField('Total guests',    demo.total_guests)
  addField('Total vehicles',  demo.total_vehicles)

  if (demo.description) {
    lines.push('', '── NOTES ──', demo.description)
  }
  if (demo.cancelation_reason) {
    lines.push('', '── CANCELLATION ──', `Reason: ${demo.cancelation_reason}`)
  }

  lines.push('', '─────────────────────────────', 'Managed by Demo Dashboard (automated)')

  // Collapse runs of blank lines to a single blank
  const out: string[] = []
  for (const l of lines) {
    if (l === '' && out[out.length - 1] === '') continue
    out.push(l)
  }
  return out.join('\n')
}

// ─── Event body builder ───────────────────────────────────────────────────────

function buildEventBody(demo: DemoNotificationData): Record<string, unknown> {
  const dateStr   = calDate(demo.date_of_demo)
  const startHHMM = calTime(demo.demo_start_time)
  const endHHMM   = calTime(demo.demo_end_time)
  const tz        = GEO_TZ[demo.geo ?? ''] ?? 'UTC'
  const ref     = demo.demo_ref?.trim()
  const org     = demo.guests_organization?.trim() || demo.geo || ''
  const summary = ref
    ? `${ref} | ${demo.type ?? 'Demo'} Demo | ${org}`
    : `[Demo] ${demo.type ?? 'Demo'} — ${org}`
  const description = buildDescription(demo)

  const attendees: { email: string; displayName?: string; responseStatus: string }[] = []
  if (demo.requester && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(demo.requester.trim())) {
    attendees.push({
      email:          demo.requester.trim(),
      displayName:    demo.host ?? undefined,
      responseStatus: 'needsAction',
    })
  }

  let start: Record<string, string>
  let end: Record<string, string>

  if (dateStr && startHHMM && endHHMM) {
    start = { dateTime: `${dateStr}T${startHHMM}:00`, timeZone: tz }
    end   = { dateTime: `${dateStr}T${endHHMM}:00`,   timeZone: tz }
  } else if (dateStr) {
    const nextDay = new Date(`${dateStr}T00:00:00Z`)
    nextDay.setUTCDate(nextDay.getUTCDate() + 1)
    start = { date: dateStr }
    end   = { date: nextDay.toISOString().substring(0, 10) }
  } else {
    const today    = new Date().toISOString().substring(0, 10)
    const tomorrow = new Date(`${today}T00:00:00Z`)
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
    start = { date: today }
    end   = { date: tomorrow.toISOString().substring(0, 10) }
  }

  return { summary, description, location: demo.start_location ?? undefined, start, end, attendees, reminders: { useDefault: true } }
}

// ─── GoogleCalendarService ────────────────────────────────────────────────────

export class GoogleCalendarService {

  static credentialsConfigured(): boolean {
    return Boolean(
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REFRESH_TOKEN,
    )
  }

  static async createEvent(demo: DemoNotificationData): Promise<{ eventId: string; htmlLink: string } | null> {
    if (!GoogleCalendarService.credentialsConfigured()) {
      console.log('[calendar] credentials not configured — skipping create')
      return null
    }
    try {
      const token = await getAccessToken()
      const resp  = await fetch(`${EVENTS_BASE}?sendUpdates=all`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify(buildEventBody(demo)),
        signal:  AbortSignal.timeout(15_000),
      })
      if (!resp.ok) {
        const text = await resp.text().catch(() => '')
        console.error(`[calendar] createEvent HTTP ${resp.status}:`, text)
        return null
      }
      const json = await resp.json() as { id: string; htmlLink: string }
      console.log('[calendar] created event id=%s link=%s', json.id, json.htmlLink)
      return { eventId: json.id, htmlLink: json.htmlLink }
    } catch (err) {
      console.error('[calendar] createEvent error:', String(err))
      return null
    }
  }

  static async updateEvent(eventId: string, demo: DemoNotificationData): Promise<boolean> {
    if (!GoogleCalendarService.credentialsConfigured()) return false
    try {
      const token = await getAccessToken()
      const resp  = await fetch(`${EVENTS_BASE}/${encodeURIComponent(eventId)}?sendUpdates=all`, {
        method:  'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify(buildEventBody(demo)),
        signal:  AbortSignal.timeout(15_000),
      })
      if (!resp.ok) {
        const text = await resp.text().catch(() => '')
        console.error(`[calendar] updateEvent HTTP ${resp.status}:`, text)
        return false
      }
      console.log('[calendar] updated event id=%s', eventId)
      return true
    } catch (err) {
      console.error('[calendar] updateEvent error:', String(err))
      return false
    }
  }

  static async cancelEvent(eventId: string): Promise<boolean> {
    if (!GoogleCalendarService.credentialsConfigured()) return false
    try {
      const token = await getAccessToken()
      const resp  = await fetch(`${EVENTS_BASE}/${encodeURIComponent(eventId)}?sendUpdates=all`, {
        method:  'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: 'cancelled' }),
        signal:  AbortSignal.timeout(15_000),
      })
      if (!resp.ok) {
        const text = await resp.text().catch(() => '')
        console.error(`[calendar] cancelEvent HTTP ${resp.status}:`, text)
        return false
      }
      console.log('[calendar] cancelled event id=%s', eventId)
      return true
    } catch (err) {
      console.error('[calendar] cancelEvent error:', String(err))
      return false
    }
  }

  // Permanently delete the event from Google Calendar (not just mark cancelled)
  static async deleteEvent(eventId: string): Promise<boolean> {
    if (!GoogleCalendarService.credentialsConfigured()) return false
    try {
      const token = await getAccessToken()
      const resp  = await fetch(`${EVENTS_BASE}/${encodeURIComponent(eventId)}?sendUpdates=all`, {
        method:  'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        signal:  AbortSignal.timeout(15_000),
      })
      // Google returns 204 on success, 410 if the event was already deleted — both are fine
      if (!resp.ok && resp.status !== 410) {
        const text = await resp.text().catch(() => '')
        console.error(`[calendar] deleteEvent HTTP ${resp.status}:`, text)
        return false
      }
      console.log('[calendar] deleted event id=%s', eventId)
      return true
    } catch (err) {
      console.error('[calendar] deleteEvent error:', String(err))
      return false
    }
  }

  // Fetch the stored Google Calendar event ID for a demo
  static async getEventId(demoId: number): Promise<string | null> {
    try {
      const result = await pool.query<{ calendar_event_id: string | null }>(
        'SELECT calendar_event_id FROM public.demo_master WHERE id = $1',
        [demoId],
      )
      return result.rows[0]?.calendar_event_id ?? null
    } catch (err) {
      console.error('[calendar] getEventId error:', String(err))
      return null
    }
  }

  // Persist the event ID and calendar link back onto the demo row
  static async saveEventId(demoId: number, eventId: string, htmlLink: string): Promise<void> {
    try {
      await pool.query(
        'UPDATE public.demo_master SET calendar_event_id = $1, calendar_event_link = $2 WHERE id = $3',
        [eventId, htmlLink, demoId],
      )
    } catch (err) {
      console.error('[calendar] saveEventId error:', String(err))
    }
  }

  // Clear the stored event ID/link once the event has been deleted
  static async clearEventId(demoId: number): Promise<void> {
    try {
      await pool.query(
        'UPDATE public.demo_master SET calendar_event_id = NULL, calendar_event_link = NULL WHERE id = $1',
        [demoId],
      )
    } catch (err) {
      console.error('[calendar] clearEventId error:', String(err))
    }
  }
}
