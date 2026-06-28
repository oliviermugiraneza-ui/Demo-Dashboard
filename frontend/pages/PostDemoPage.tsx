import { useState, useMemo, useEffect, type ReactNode } from 'react'
import {
  ResponsiveContainer, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, LabelList,
} from 'recharts'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../lib/shadcn/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../lib/shadcn/table'

import { useGetSatisfaction, type SatisfactionRow } from '../hooks/backend/demos'
import StatCard from '../components/StatCard'
import GeoBadge from '../components/GeoBadge'

// ─── Constants ────────────────────────────────────────────────────────────────

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
]

const MONTHS = [
  { v:'ALL',l:'All Months' },{ v:'01',l:'January' },{ v:'02',l:'February' },
  { v:'03',l:'March' },{ v:'04',l:'April' },{ v:'05',l:'May' },
  { v:'06',l:'June' },{ v:'07',l:'July' },{ v:'08',l:'August' },
  { v:'09',l:'September' },{ v:'10',l:'October' },{ v:'11',l:'November' },{ v:'12',l:'December' },
]

const GEOS = ['ALL','UK','JP','US','DE']

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title, accent }: { title: string; accent?: string }) {
  const accentColor = accent ?? '#0052FF'
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-1 h-5 rounded-full" style={{ backgroundColor: accentColor }} />
      <h3 className="text-sm font-bold text-gray-700">{title}</h3>
    </div>
  )
}

// ─── Chart card wrapper ───────────────────────────────────────────────────────

function ChartCard({ title, children, accent }: {
  title: string
  children: ReactNode
  accent?: string
}) {
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-4">
      <SectionHeader title={title} {...(accent !== undefined ? { accent } : {})} />
      {children}
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function NoData({ height = 200 }: { height?: number }) {
  return (
    <div
      className="flex items-center justify-center text-xs text-gray-400 italic"
      style={{ height }}
    >
      No operational data available
    </div>
  )
}

// ─── Custom donut label ───────────────────────────────────────────────────────

function renderDonutLabel({ name, percent }: { name?: string; percent?: number }) {
  const pct = percent ?? 0
  if (pct < 0.05) return null
  return `${name ?? ''} ${(pct * 100).toFixed(0)}%`
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getOperator(row: SatisfactionRow): string {
  return String(
    row.demo_operator_jp ?? row.demo_operator_de ??
    row.demo_operator_uk ?? row.demo_operator_us ?? 'Unknown'
  )
}

function parseSatScore(raw: unknown): number {
  const n = parseInt(String(raw ?? '0'), 10)
  return isNaN(n) ? 0 : n
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PostDemoPage() {
  const [monthFilter, setMonthFilter] = useState('ALL')
  const [geoFilter,   setGeoFilter]   = useState('ALL')
  const [allRows,     setAllRows]     = useState<SatisfactionRow[]>([])

  const { data: satData, loading, trigger: fetchSat } = useGetSatisfaction({ limit: 1000 })

  useEffect(() => { void fetchSat() }, [])
  useEffect(() => { if (satData) setAllRows(satData.data) }, [satData])

  // ── Filter ──────────────────────────────────────────────────────────────────
  const filtered = useMemo<SatisfactionRow[]>(() => {
    return allRows.filter(row => {
      const dateStr = String(row.date_of_demo ?? '')
      // date_of_demo stored as "DD/MM/YYYY"
      const parts = dateStr.split('/')
      const mm = parts.length === 3 ? (parts[1] ?? '').padStart(2, '0') : ''
      const geoMatch   = geoFilter   === 'ALL' || String(row.geo ?? '') === geoFilter
      const monthMatch = monthFilter === 'ALL' || mm === monthFilter
      return geoMatch && monthMatch
    })
  }, [allRows, monthFilter, geoFilter])

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const n = filtered.length
    const scores = filtered.map(r => parseSatScore(r.overall_satisfaction)).filter(s => s > 0)
    const avgSat = scores.length > 0
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
      : 0
    const withIssues = filtered.filter(
      r => r.technical_operational_issues && r.technical_operational_issues !== 'No issues encountered'
    ).length
    const withDescription = filtered.filter(r => r.issue_description).length

    const opMap = new Map<string, number>()
    for (const row of filtered) {
      const op = getOperator(row)
      if (op !== 'Unknown') opMap.set(op, (opMap.get(op) ?? 0) + 1)
    }
    let topOp = '—'; let topCnt = 0
    for (const [op, c] of opMap.entries()) { if (c > topCnt) { topOp = op; topCnt = c } }

    return { n, avgSat, withIssues, withDescription, topOp }
  }, [filtered])

  // ── Geo donut ───────────────────────────────────────────────────────────────
  const geoDonut = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of filtered) {
      const g = String(r.geo ?? 'Unknown')
      if (g) m.set(g, (m.get(g) ?? 0) + 1)
    }
    return Array.from(m.entries()).map(([name, value]) => ({ name, value }))
  }, [filtered])

  // ── Top issues from technical_operational_issues ────────────────────────────
  const issueTypeData = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of filtered) {
      const issues = String(r.technical_operational_issues ?? '')
      if (issues && issues !== 'No issues encountered') {
        m.set(issues, (m.get(issues) ?? 0) + 1)
      }
    }
    return Array.from(m.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
  }, [filtered])

  const maxIssueCount = issueTypeData[0]?.count ?? 1

  // ── Satisfaction trend by date ─────────────────────────────────────────────
  const satTrend = useMemo(() => {
    const m = new Map<string, { total: number; count: number }>()
    for (const r of filtered) {
      const dateStr = String(r.date_of_demo ?? '')
      const parts = dateStr.split('/')
      const label = parts.length === 3 ? `${parts[2] ?? ''}-${parts[1] ?? ''}-${parts[0] ?? ''}` : dateStr
      if (!label) continue
      const score = parseSatScore(r.overall_satisfaction)
      if (score === 0) continue
      const existing = m.get(label) ?? { total: 0, count: 0 }
      m.set(label, { total: existing.total + score, count: existing.count + 1 })
    }
    return Array.from(m.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { total, count }]) => ({ date, avg: Math.round((total / count) * 10) / 10 }))
  }, [filtered])

  // ── Operators per run ───────────────────────────────────────────────────────
  const operatorData = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of filtered) {
      const op = getOperator(r)
      if (op !== 'Unknown') m.set(op, (m.get(op) ?? 0) + 1)
    }
    return Array.from(m.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [filtered])

  // ── Issue description breakdown ─────────────────────────────────────────────
  const issueBreakdown = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of filtered) {
      const desc = String(r.issue_description ?? '').trim()
      if (desc) m.set(desc, (m.get(desc) ?? 0) + 1)
    }
    return Array.from(m.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
  }, [filtered])

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading && allRows.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] gap-2 text-sm text-gray-400">
        <span className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
        Loading satisfaction data…
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-[#F8FAFC] overflow-hidden">

      {/* ── Sticky filter bar ── */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-5 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">MONTH</span>
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="w-36 bg-white text-sm h-8 border-gray-200"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map(m => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">GEO</span>
            <Select value={geoFilter} onValueChange={setGeoFilter}>
              <SelectTrigger className="w-28 bg-white text-sm h-8 border-gray-200"><SelectValue /></SelectTrigger>
              <SelectContent>
                {GEOS.map(g => <SelectItem key={g} value={g}>{g === 'ALL' ? 'All Geo' : g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <span className="ml-auto text-xs text-gray-400">{filtered.length} responses</span>
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-auto p-5 space-y-5">

      {/* KPI row */}
      <div className="grid grid-cols-6 gap-3">
        <StatCard label="Total Responses"   value={kpis.n}              accent="#2563EB" />
        <StatCard label="With Issues"        value={kpis.withIssues}    accent="#F59E0B" />
        <StatCard label="Avg Satisfaction"   value={kpis.avgSat || '—'} accent="#8B5CF6" />
        <StatCard label="Issue Descriptions" value={kpis.withDescription} accent="#EF4444" />
        <StatCard label="No Issue Rate"      value={kpis.n > 0 ? `${Math.round(((kpis.n - kpis.withIssues) / kpis.n) * 100)}%` : '—'} accent="#10B981" />
        <StatCard label="Top Operator"       value={kpis.topOp}         accent="#10B981" />
      </div>

      {/* Row 1: Geo donut | Satisfaction Trend | Top Issues */}
      <div className="grid grid-cols-3 gap-4">
        <ChartCard title="Geo Distribution">
          {geoDonut.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={geoDonut} cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                     dataKey="value" label={renderDonutLabel} labelLine={false}>
                  {geoDonut.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length] ?? 'hsl(var(--chart-1))'} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : <NoData height={220} />}
        </ChartCard>

        <ChartCard title="Avg Satisfaction Trend">
          {satTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={satTrend} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={40} />
                <YAxis tick={{ fontSize: 10 }} domain={[0, 5]} />
                <Tooltip />
                <Area type="monotone" dataKey="avg" stroke="#8B5CF6" fill="#8B5CF620" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <NoData height={220} />}
        </ChartCard>

        <ChartCard title="Issue Type Breakdown">
          {issueTypeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={issueTypeData} layout="vertical"
                        margin={{ top: 4, right: 20, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="type" width={130} tick={{ fontSize: 9 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#EF4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <NoData height={220} />}
        </ChartCard>
      </div>

      {/* Row 2: Issue count table | Operator runs | Issue descriptions */}
      <div className="grid grid-cols-3 gap-4">
        {/* Issue Count Table */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-red-50 border-b border-red-100">
            <span className="text-sm font-bold text-red-700">Issue Type Count</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-red-50/50 hover:bg-red-50/50">
                <TableHead className="text-xs w-10">#</TableHead>
                <TableHead className="text-xs">Issue</TableHead>
                <TableHead className="text-xs w-16">Count</TableHead>
                <TableHead className="text-xs">Share</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {issueTypeData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-xs italic text-gray-400 py-6">
                    No issues recorded
                  </TableCell>
                </TableRow>
              ) : issueTypeData.map((item, i) => (
                <TableRow key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-muted/50'}>
                  <TableCell className="text-xs font-bold text-gray-400 py-2">{i + 1}</TableCell>
                  <TableCell className="text-xs text-gray-700 py-2 max-w-[140px] truncate">{item.type}</TableCell>
                  <TableCell className="text-xs font-bold text-red-600 py-2">{item.count}</TableCell>
                  <TableCell className="py-2">
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden w-full">
                      <div
                        className="h-full rounded-full bg-red-400"
                        style={{ width: `${(item.count / maxIssueCount) * 100}%` }}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Operators Per Run */}
        <ChartCard title="Operators Per Run" accent="#F59E0B">
          {operatorData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={operatorData} layout="vertical"
                        margin={{ top: 4, right: 50, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#F59E0B" radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="count" position="right" style={{ fontSize: 11, fill: '#374151' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <NoData height={240} />}
        </ChartCard>

        {/* Issue Description Breakdown */}
        <ChartCard title="Issue Descriptions" accent="#EF4444">
          {issueBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={issueBreakdown} layout="vertical"
                        margin={{ top: 4, right: 30, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#EF4444" radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="count" position="right" style={{ fontSize: 11, fill: '#374151' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <NoData height={240} />}
        </ChartCard>
      </div>

      {/* Satisfaction Responses Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-800">Satisfaction Responses</span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
              {filtered.length} records
            </span>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10">
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                {['Date', 'Geo', 'Operator', 'Overall', 'Communication', 'Professionalism', 'Route Fit', 'Issues', 'Comments'].map(h => (
                  <TableHead key={h} className="text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap py-2.5">
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-xs italic text-gray-400 py-8">
                    No satisfaction responses match the current filters.
                  </TableCell>
                </TableRow>
              ) : filtered.map((row, idx) => (
                <TableRow
                  key={String(row.id ?? idx)}
                  className={idx % 2 === 0 ? 'bg-white hover:bg-blue-50/20' : 'bg-gray-50/50 hover:bg-blue-50/20'}
                >
                  <TableCell className="py-2 pr-4 font-mono text-xs text-gray-700">
                    {String(row.date_of_demo ?? '—')}
                  </TableCell>
                  <TableCell className="py-2 pr-4">
                    <GeoBadge geo={String(row.geo ?? '') as 'UK' | 'JP' | 'US' | 'DE' | 'ST'} />
                  </TableCell>
                  <TableCell className="py-2 pr-4 text-xs text-gray-700">
                    {getOperator(row)}
                  </TableCell>
                  <TableCell className="py-2 pr-4 text-xs font-semibold text-purple-700">
                    {String(row.overall_satisfaction ?? '—')}
                  </TableCell>
                  <TableCell className="py-2 pr-4 text-xs text-gray-600">
                    {String(row.communication_rating ?? '—')}
                  </TableCell>
                  <TableCell className="py-2 pr-4 text-xs text-gray-600">
                    {String(row.operator_professionalism_rating ?? '—')}
                  </TableCell>
                  <TableCell className="py-2 pr-4 text-xs text-gray-600">
                    {String(row.route_fit_rating ?? '—')}
                  </TableCell>
                  <TableCell className="py-2 pr-4 text-xs text-amber-700 max-w-[160px] truncate">
                    {String(row.technical_operational_issues ?? '—')}
                  </TableCell>
                  <TableCell className="py-2 pr-4 text-xs text-gray-500 max-w-[180px] truncate">
                    {String(row.comments_suggestions ?? '—')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Row: Satisfaction Ratings Distribution */}
      <div className="grid grid-cols-2 gap-4">
        <ChartCard title="Overall Satisfaction Distribution" accent="#8B5CF6">
          {filtered.length > 0 ? (() => {
            const dist = [1,2,3,4,5].map(score => ({
              score: String(score),
              count: filtered.filter(r => parseSatScore(r.overall_satisfaction) === score).length,
            }))
            return (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dist} margin={{ top: 4, right: 20, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="score" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8B5CF6" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="count" position="top" style={{ fontSize: 11, fill: '#374151' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )
          })() : <NoData height={200} />}
        </ChartCard>

        <ChartCard title="Communication Rating Distribution" accent="#3B82F6">
          {filtered.length > 0 ? (() => {
            const dist = [1,2,3,4,5].map(score => ({
              score: String(score),
              count: filtered.filter(r => parseSatScore(r.communication_rating) === score).length,
            }))
            return (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dist} margin={{ top: 4, right: 20, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="score" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="count" position="top" style={{ fontSize: 11, fill: '#374151' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )
          })() : <NoData height={200} />}
        </ChartCard>
      </div>

      </div>
    </div>
  )
}
