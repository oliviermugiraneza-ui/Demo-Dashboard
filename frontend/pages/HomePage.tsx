import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp, Clock, CheckCircle2, AlertTriangle, Calendar, MapPin,
} from 'lucide-react'
import { useGetDemos } from '../hooks/backend/demos'
import { type DemoRequest, type GeoCode } from './data/sampleData'
import GeoBadge from '../components/GeoBadge'
import StatusBadge from '../components/StatusBadge'

// ─── Constants ────────────────────────────────────────────────────────────────

const TODAY_STR = new Date().toISOString().split('T')[0]

const GEO_FLAGS: Record<string, string> = {
  UK: '🇬🇧', US: '🇺🇸', JP: '🇯🇵', DE: '🇩🇪',
}

const GEO_LABELS: Record<string, string> = {
  UK: 'UK', US: 'US', JP: 'Japan', DE: 'Germany',
}

const GEO_ORDER = ['UK', 'US', 'JP', 'DE'] as const

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: number
  subLabel: string
  iconBg: string
  icon: React.ReactNode
}

function StatCard({ label, value, subLabel, iconBg, icon }: StatCardProps) {
  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm p-6 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 truncate">
          {label}
        </p>
        <p className="text-4xl font-bold text-gray-900 tabular-nums leading-none mb-2">{value}</p>
        <p className="text-sm text-gray-400">{subLabel}</p>
      </div>
      <div
        className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center"
        style={{ backgroundColor: iconBg }}
      >
        {icon}
      </div>
    </div>
  )
}

// ─── Greeting helper ──────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function fmtDemoDate(dateStr: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [demos, setDemos] = useState<DemoRequest[]>([])
  const { data: dbDemos, loading, trigger: fetchDemos } = useGetDemos()

  useEffect(() => { void fetchDemos() }, [])
  useEffect(() => { if (dbDemos) setDemos(dbDemos as DemoRequest[]) }, [dbDemos])

  // Exclude deleted records
  const active = useMemo(
    () => demos.filter(d => d.status !== 'DELETED'),
    [demos],
  )

  // ── KPI counts ──────────────────────────────────────────────────────────────
  const totalRequests = active.length

  const pendingApproval = useMemo(
    () => active.filter(d => d.status === 'Needs Review' || d.status === 'NEEDS REVIEW').length,
    [active],
  )

  const upcomingCount = useMemo(
    () => active.filter(d => d.status === 'Reviewed' && d.demo_date >= TODAY_STR).length,
    [active],
  )

  const criticalCount = useMemo(
    () => active.filter(
      d => d.status !== 'Canceled' && d.demo_date && d.demo_date >= TODAY_STR && d.lead_days < 3,
    ).length,
    [active],
  )

  // ── Upcoming approved demos list (next 5) ───────────────────────────────────
  const upcomingList = useMemo(
    () => active
      .filter(d => d.status === 'Reviewed' && d.demo_date >= TODAY_STR)
      .sort((a, b) => a.demo_date.localeCompare(b.demo_date))
      .slice(0, 5),
    [active],
  )

  // ── GEO counts ──────────────────────────────────────────────────────────────
  const geoCounts = useMemo(() => {
    const counts: Record<string, number> = { UK: 0, US: 0, JP: 0, DE: 0 }
    active.forEach(d => {
      const g = (d.geo ?? '').toUpperCase()
      if (g in counts) counts[g]++
    })
    return counts
  }, [active])

  // ── Recent activity (latest 10 by date_requested desc) ──────────────────────
  const recentActivity = useMemo(
    () => [...active]
      .sort((a, b) => b.date_requested.localeCompare(a.date_requested))
      .slice(0, 10),
    [active],
  )

  const greeting = getGreeting()

  return (
    <div className="h-full overflow-auto bg-[#F8FAFC] p-6 space-y-5">

      {/* ── Hero row ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900 tracking-tight flex items-center gap-2">
            {greeting}
            <span>👋</span>
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Here's what's happening across Wayve Demo Operations.
          </p>
        </div>
        <Link
          to="/demo-request/request"
          className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                     text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)' }}
        >
          Book a Demo
          <span aria-hidden>→</span>
        </Link>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Total Requests"
          value={totalRequests}
          subLabel="All time"
          iconBg="#3B82F6"
          icon={<TrendingUp size={22} className="text-white" />}
        />
        <StatCard
          label="Pending Approval"
          value={pendingApproval}
          subLabel="Awaiting review"
          iconBg="#F59E0B"
          icon={<Clock size={22} className="text-white" />}
        />
        <StatCard
          label="Upcoming Demos"
          value={upcomingCount}
          subLabel="Approved & scheduled"
          iconBg="#10B981"
          icon={<CheckCircle2 size={22} className="text-white" />}
        />
        <StatCard
          label="Critical Priority"
          value={criticalCount}
          subLabel="Immediate action needed"
          iconBg="#EF4444"
          icon={<AlertTriangle size={22} className="text-white" />}
        />
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
            <Link
              to="/calendar"
              className="text-sm font-medium text-[#3B82F6] hover:underline"
            >
              View Calendar →
            </Link>
          </div>

          {loading && demos.length === 0 ? (
            <div className="flex items-center justify-center py-10 gap-2 text-sm text-gray-400">
              <span className="w-4 h-4 border-2 border-border border-t-[#3B82F6] rounded-full animate-spin" />
              Loading…
            </div>
          ) : upcomingList.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">
              No upcoming approved demos
            </p>
          ) : (
            <div className="space-y-2">
              {upcomingList.map(d => (
                <div
                  key={d.id}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl
                             border border-border hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <GeoBadge geo={d.geo as GeoCode} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {d.organization}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{d.type}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                    <span className="text-xs text-gray-500 font-medium">
                      {new Date(d.demo_date + 'T00:00:00').toLocaleDateString('en-GB', {
                        day: '2-digit', month: 'short',
                      })}
                    </span>
                    <StatusBadge status={d.status} showDot />
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
                  {geoCounts[geo]}
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
                {['Requester', 'Organization', 'Type', 'Geo', 'Date', 'Status'].map(col => (
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
                recentActivity.map(d => (
                  <tr
                    key={d.id}
                    className="border-b border-gray-50 last:border-0 hover:bg-background transition-colors"
                  >
                    <td className="px-6 py-3.5 text-sm text-[#374151]">
                      {d.requester || '—'}
                    </td>
                    <td className="px-6 py-3.5 text-sm font-medium text-foreground">
                      {d.organization || '—'}
                    </td>
                    <td className="px-6 py-3.5 text-sm text-muted-foreground">
                      {d.type || '—'}
                    </td>
                    <td className="px-6 py-3.5">
                      <GeoBadge geo={d.geo as GeoCode} />
                    </td>
                    <td className="px-6 py-3.5 text-sm text-muted-foreground whitespace-nowrap">
                      {fmtDemoDate(d.demo_date)}
                    </td>
                    <td className="px-6 py-3.5">
                      <StatusBadge status={d.status} showDot />
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
