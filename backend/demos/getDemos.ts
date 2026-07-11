type DBRow = {
  id: string
  action: string | null
  status: string | null
  slack_channel: string | null
  geo: string | null
  demo_type: string | null
  date_of_demo: string | null
  demo_start_time: string | null
  demo_end_time: string | null
  lead_time_days: number | null
  date_of_readiness: boolean | null
  total_guests: string | null
  total_vehicles: number | null
  vehicle_type: string | null
  system_required: string | null
  start_location: string | null
  description: string | null
  requester: string | null
  approver: string | null
  host: string | null
  guests_organization: string | null
  slack_link: string | null
  cancelation_reason: boolean | null
  created_at: string | null
  updated_at: string | null
  calendar_event_link: string | null
}

export type DemoRow = {
  id: string
  status: string
  geo: string
  type: string
  requester: string
  approver: string
  organization: string
  host: string
  date_requested: string
  demo_date: string
  start_time: string
  end_time: string
  vehicle_type: string
  total_guests: number
  total_vehicles: number
  lead_days: number
  readiness_date: string | null
  slack_link: string | null
  cancel_reason: string | null
  channel: string
  description: string
  calendar_event_link: string | null
  start_location: string
}

function normalizeAction(action: string | null): string {
  if (!action) return 'Needs Review'
  const a = action.trim().toUpperCase()
  if (a === 'NEEDS REVIEW') return 'Needs Review'
  if (a === 'REVIEWED') return 'Reviewed'
  if (a === 'CANCELED' || a === 'CANCELLED') return 'Canceled'
  return action.trim()
}

function extractTime(ts: string | null): string {
  if (!ts) return '00:00'
  const d = new Date(ts)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

function parseGuests(val: string | null): number {
  if (!val) return 0
  const match = val.match(/\d+/)
  return match ? parseInt(match[0], 10) : 0
}

type Params = Record<string, never>

export default async function getDemos(_req: { params: Params; user: User }): Promise<DemoRow[]> {
  const result = await retoolDb.query<DBRow>(
    `SELECT * FROM demo_raw_data ORDER BY date_of_demo ASC NULLS LAST, created_at ASC`,
  )
  return result.data.map(row => ({
    id: row.id,
    status: normalizeAction(row.action),
    geo: row.geo ?? '',
    type: row.demo_type ?? '',
    requester: row.requester ?? '',
    approver: row.approver ?? '',
    organization: row.guests_organization ?? '',
    host: row.host ?? '',
    date_requested: row.created_at ? row.created_at.substring(0, 10) : '',
    demo_date: row.date_of_demo ?? '',
    start_time: extractTime(row.demo_start_time),
    end_time: extractTime(row.demo_end_time),
    vehicle_type: row.vehicle_type ?? '',
    total_guests: parseGuests(row.total_guests),
    total_vehicles: row.total_vehicles ?? 0,
    lead_days: row.lead_time_days ?? 0,
    readiness_date: null, // boolean column in DB — tracked client-side
    slack_link: row.slack_link || null,
    cancel_reason: null, // boolean column in DB — tracked client-side
    channel: row.slack_channel ?? '',
    description: row.description ?? '',
    calendar_event_link: row.calendar_event_link || null,
    start_location: row.start_location ?? '',
  }))
}
