import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, MapPin } from 'lucide-react'
import { useGetHomeData } from '../hooks/backend/home'
import { KPI_BORDER_COLOR } from '../lib/constants/demoStatus'
import { type GeoCode } from './data/sampleData'
import GeoBadge from '../components/GeoBadge'
import StatusBadge from '../components/StatusBadge'

// ─── Constants ────────────────────────────────────────────────────────────────

const GEO_FLAGS: Record<string, string> = {
  UK: '🇬🇧', US: '🇺🇸', JP: '🇯🇵', DE: '🇩🇪',
}

const GEO_LABELS: Record<string, string> = {
  UK: 'UK', US: 'US', JP: 'Japan', DE: 'Germany',
}

const GEO_ORDER = ['UK', 'US', 'JP', 'DE'] as const

type GeoFilter    = 'ALL' | 'UK' | 'US' | 'JP' | 'DE'
type TimeframeKey = 'this_week' | 'next_week' | 'this_month'

const TIMEFRAME_OPTIONS: { v: TimeframeKey; l: string }[] = [
  { v: 'this_week',  l: 'This Week'  },
  { v: 'next_week',  l: 'Next Week'  },
  { v: 'this_month', l: 'This Month' },
]

// ─── KPI card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label:       string
  value:       number
  borderColor: string
}

function KpiCard({ label, value, borderColor }: KpiCardProps) {
  return (
    <div
      className="bg-card rounded-2xl border border-border shadow-sm p-6 flex flex-col gap-2"
      style={{ borderTop: `3px solid ${borderColor}` }}
    >
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest truncate">
        {label}
      </p>
      <p className="text-4xl font-bold text-gray-900 tabular-nums leading-none">{value}</p>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [geoFilter,  setGeoFilter]  = useState<GeoFilter>('ALL')
  const [timeframe,  setTimeframe]  = useState<TimeframeKey>('this_week')
  const { data, loading, fetch_ } = useGetHomeData()

  useEffect(() => { void fetch_(geoFilter, timeframe) }, [geoFilter, timeframe, fetch_])

  const kpis          = data?.kpis
  const geoCounts     = data?.geoCounts     ?? { UK: 0, US: 0, JP: 0, DE: 0 }
  const upcoming      = data?.upcoming      ?? []
  const recentActivity = data?.recentActivity ?? []

  const greeting = getGreeting()

  return (
    <div className="h-full overflow-auto bg-[#F8FAFC] p-6 space-y-5">

      {/* ── Hero row with GEO + Timeframe filters ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-gray-900 tracking-tight flex items-center gap-2">
            {greeting}
            <span>👋</span>
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Here's what's happening across Wayve Demo Operations.
          </p>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          {/* Timeframe filter */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {TIMEFRAME_OPTIONS.map(({ v, l }) => (
              <button
                key={v}
                onClick={() => setTimeframe(v)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  timeframe === v
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          {/* GEO filter */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setGeoFilter('ALL')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                geoFilter === 'ALL'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-card text-gray-600 border-border hover:border-gray-400'
              }`}
            >
              All
            </button>
            {(['JP', 'UK', 'US', 'DE'] as GeoFilter[]).map(geo => (
              <button
                key={geo}
                onClick={() => setGeoFilter(geoFilter === geo ? 'ALL' : geo)}
                title={geo}
                className={`px-2.5 py-1.5 text-sm rounded-lg border transition-all ${
                  geoFilter === geo
                    ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50'
                    : 'bg-card border-border hover:border-gray-400'
                }`}
              >
                {GEO_FLAGS[geo]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── KPI cards (5) ── */}
      <div className="grid grid-cols-5 gap-4">
        <KpiCard label="Proposed"        value={kpis?.proposed        ?? 0} borderColor={KPI_BORDER_COLOR.proposed} />
        <KpiCard label="NEED REVIEW" value={kpis?.pendingApproval ?? 0} borderColor={KPI_BORDER_COLOR.pendingApproval} />
        <KpiCard label="APPROVED"         value={kpis?.approved        ?? 0} borderColor={KPI_BORDER_COLOR.approved} />
        <KpiCard label="Total Guests"    value={kpis?.totalGuests     ?? 0} borderColor={KPI_BORDER_COLOR.totalGuests} />
        <KpiCard label="CANCELED"       value={kpis?.cancelled       ?? 0} borderColor={KPI_BORDER_COLOR.cancelled} />
      </div>

      {/* ── Two-panel row ── */}
      <div className="grid grid-cols-3 gap-4">

        {/* Upcoming Demos panel */}
        <div className="col-span-2 bg-card rounded-2xl border border-border shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar size={17} className="text-[#3B82F6]" />
              <h2 className="text-base font-semibold text-foreground">UPCOMING DEMOS</h2>
            </div>
            <Link to="/calendar" className="text-sm font-medium text-[#3B82F6] hover:underline">
              View Calendar →
            </Link>
          </div>

          {loading && upcoming.length === 0 ? (
            <div className="flex items-center justify-center py-10 gap-2 text-sm text-gray-400">
              <span className="w-4 h-4 border-2 border-border border-t-[#3B82F6] rounded-full animate-spin" />
              Loading…
            </div>
          ) : upcoming.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">
              No upcoming approved demos
            </p>
          ) : (
            <div className="space-y-2">
              {upcoming.map((d, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl
                             border border-border hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {d.geo && <GeoBadge geo={d.geo as GeoCode} />}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground font-mono truncate">
                        {d.demo_ref ?? '—'}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{d.type ?? '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                    {d.start_time && (
                      <span className="text-xs text-gray-400">{d.start_time}</span>
                    )}
                    <span className="text-xs text-gray-500 font-medium whitespace-nowrap">
                      {fmtDate(d.demo_date)}
                    </span>
                    <StatusBadge status={d.status as import('./data/sampleData').DemoStatus} showDot />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* GEO Breakdown panel */}
        <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <MapPin size={17} className="text-[#3B82F6]" />
            <h2 className="text-base font-semibold text-foreground">GEO BREAKDOWN</h2>
          </div>
          <div className="space-y-0.5">
            {GEO_ORDER.map((geo, i) => (
              <div
                key={geo}
                className={`flex items-center justify-between py-3 ${
                  i < GEO_ORDER.length - 1 ? 'border-b border-border' : ''
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-xl leading-none">{GEO_FLAGS[geo]}</span>
                  <span className="text-sm font-medium text-[#374151]">
                    {GEO_LABELS[geo]}
                  </span>
                </div>
                <span className="text-sm font-semibold text-muted-foreground tabular-nums">
                  {geoCounts[geo] ?? 0}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Recent Activity ── */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">RECENT ACTIVITY</h2>
          <Link to="/tracker" className="text-sm font-medium text-[#3B82F6] hover:underline">
            View all →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted">
                {['Demo Reference ID', 'Host', 'Type', 'GEO', 'Date', 'Status'].map(col => (
                  <th
                    key={col}
                    className="px-6 py-3 text-left text-[11px] font-semibold text-muted-foreground/60
                               uppercase tracking-widest whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentActivity.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-sm text-gray-400 text-center">
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-border border-t-[#3B82F6] rounded-full animate-spin" />
                        Loading…
                      </span>
                    ) : 'No recent activity'}
                  </td>
                </tr>
              ) : (
                recentActivity.map((d, i) => (
                  <tr
                    key={i}
                    className="border-b border-gray-50 last:border-0 hover:bg-background transition-colors"
                  >
                    <td className="px-6 py-3.5 text-sm font-mono font-medium text-foreground whitespace-nowrap">
                      {d.demo_ref ?? '—'}
                    </td>
                    <td className="px-6 py-3.5 text-sm text-[#374151]">
                      {d.host ?? '—'}
                    </td>
                    <td className="px-6 py-3.5 text-sm text-muted-foreground">
                      {d.type ?? '—'}
                    </td>
                    <td className="px-6 py-3.5">
                      {d.geo
                        ? <GeoBadge geo={d.geo as GeoCode} />
                        : <span className="text-sm text-gray-400">—</span>
                      }
                    </td>
                    <td className="px-6 py-3.5 text-sm text-muted-foreground whitespace-nowrap">
                      {fmtDate(d.demo_date)}
                    </td>
                    <td className="px-6 py-3.5">
                      {d.status
                        ? <StatusBadge status={d.status as import('./data/sampleData').DemoStatus} showDot />
                        : <span className="text-sm text-gray-400">—</span>
                      }
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
