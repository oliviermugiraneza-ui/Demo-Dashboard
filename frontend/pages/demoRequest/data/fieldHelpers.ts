// ─── Shared row type returned by backend listing functions ────────────────────

export interface DemoRequestRow {
  id: string
  action: string
  status: string
  geo: string
  demo_type: string
  date_of_demo: string
  demo_start_time: string
  demo_end_time: string
  total_guests: string
  total_vehicles: number
  guests_organization: string | null
  host: string | null
  description: string | null
  lead_time_days: number
  requester: string
  approver: string | null
  created_at: string
  updated_at: string
  slack_link: string | null
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

export function fmtDate(ymd: string | null | undefined): string {
  if (!ymd) return '—'
  const d = new Date(ymd + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return '—'
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins   = Math.floor(diffMs / 60_000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs  < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return fmtDate(iso.slice(0, 10))
}

// ─── Status → display config ──────────────────────────────────────────────────

export interface StatusConfig {
  label: string
  bg: string
  text: string
  border: string
}

const STATUS_MAP: Record<string, StatusConfig> = {
  'NEED REVIEW': { label: 'NEED REVIEW', bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' },
  'APPROVED':    { label: 'APPROVED',     bg: '#ECFDF5', text: '#065F46', border: '#6EE7B7' },
  'CANCELED':    { label: 'CANCELED',     bg: '#FEF2F2', text: '#991B1B', border: '#FCA5A5' },
  'COMPLETED':   { label: 'COMPLETED',    bg: '#EFF6FF', text: '#1E40AF', border: '#BFDBFE' },
}

export function getStatusConfig(status: string): StatusConfig {
  return STATUS_MAP[status] ?? { label: status, bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' }
}
