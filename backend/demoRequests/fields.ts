/** Columns the requester may populate on submission */
export const REQUESTER_FIELDS = [
  'geo', 'demo_type', 'date_of_demo', 'demo_start_time', 'demo_end_time',
  'total_guests', 'total_vehicles', 'vehicle_type', 'start_location',
  'description', 'guests_organization', 'host', 'slack_channel', 'slack_link',
  'route_type', 'feature_type', 'system_required', 'recce_required',
  'local_demo', 'cross_geo_demo', 'number_of_sessions', 'length',
] as const

/** Columns an admin may additionally patch */
export const ADMIN_EXTRA_FIELDS = [
  'action', 'status', 'approver', 'requester', 'date_month', 'lead_time_days',
] as const

export type RequesterField = typeof REQUESTER_FIELDS[number]
export type AdminField     = typeof ADMIN_EXTRA_FIELDS[number] | RequesterField

/** Collapse empty strings to null so the DB stores real nulls */
export function normalize(v: unknown): string | number | boolean | null {
  if (v === undefined || v === null || v === '') return null
  if (typeof v === 'number' || typeof v === 'boolean') return v
  if (typeof v === 'string') return v.trim() === '' ? null : v.trim()
  return null
}

/** 3-letter month label from YYYY-MM-DD */
export function dateMonthLabel(ymd: string): string {
  const labels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const m = parseInt(ymd.split('-')[1] ?? '0', 10) - 1
  return labels[m] ?? ''
}

/** Days between today (UTC midnight) and a future YYYY-MM-DD date */
export function calcLeadDays(ymd: string): number {
  const demo = new Date(ymd + 'T00:00:00Z')
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  return Math.floor((demo.getTime() - today.getTime()) / 86_400_000)
}
