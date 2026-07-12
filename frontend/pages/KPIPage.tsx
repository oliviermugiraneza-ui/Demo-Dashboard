import { useState, useMemo, useEffect, type ReactNode } from 'react'
import { Activity } from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../lib/shadcn/select'
import { type DemoRequest, type GeoCode } from './data/sampleData'
import { useGetDemos, useGetSatisfaction, type SatisfactionRow } from '../hooks/backend/demos'
import {
  aggregateDemosByMonth, aggregateByGeo,
  aggregateByType, aggregateGeoTrend,
} from './data/chartHelpers'
import StatCard from '../components/StatCard'
import SatisfactionGauge from './ui/SatisfactionGauge'
import FeedbackTable, { type FeedbackRow } from './ui/FeedbackTable'

// ─── Constants ────────────────────────────────────────────────────────────────

const GEO_COLORS: Record<GeoCode, string> = {
  UK: '#3B82F6', JP: '#EF4444', US: '#22C55E', DE: '#F59E0B', ST: '#6B7280',
}
const GEO_BG: Record<GeoCode, string> = {
  UK: '#EFF6FF', JP: '#FEF2F2', US: '#F0FDF4', DE: '#FFFBEB', ST: '#F1F5F9',
}

const TYPE_COLORS: Record<string, string> = {
  'VIP':               '#7C3AED',
  'Media':             '#EC4899',
  'External':          '#3B82F6',
  'OEM Support':       '#6366F1',
  'Performance Check': '#64748B',
  'Friend & Family':   '#22C55E',
  'Conference':        '#0EA5E9',
  'Candidate':         '#F59E0B',
}

const READINESS_COLORS: Record<'EXCELLENT' | 'GOOD' | 'SHORT' | 'CRITICAL', string> = {
  EXCELLENT: '#10B981', GOOD: '#0052FF', SHORT: '#F59E0B', CRITICAL: '#EF4444',
}

// Display labels only — internal keys/colors/bucketing logic stay unchanged
const READINESS_LABELS: Record<'EXCELLENT' | 'GOOD' | 'SHORT' | 'CRITICAL', string> = {
  EXCELLENT: 'Above 7Days', GOOD: '5-7 Days', SHORT: '3-5 Days', CRITICAL: 'Less than 2 days',
}

const MONTHS = [
  { v: 'ALL', l: 'All Months' }, { v: '01', l: 'January' }, { v: '02', l: 'February' },
  { v: '03', l: 'March' },       { v: '04', l: 'April' },   { v: '05', l: 'May' },
  { v: '06', l: 'June' },        { v: '07', l: 'July' },    { v: '08', l: 'August' },
  { v: '09', l: 'September' },   { v: '10', l: 'October' }, { v: '11', l: 'November' },
  { v: '12', l: 'December' },
]

const GEOS: string[] = ['ALL', 'UK', 'JP', 'US', 'DE']

// ─── Small shared card wrapper ────────────────────────────────────────────────

function ChartCard({
  title, badge, children,
}: { title: string; badge?: ReactNode; children: ReactNode }) {
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {badge}
      </div>
      {children}
    </div>
  )
}

// ─── Custom donut legend ──────────────────────────────────────────────────────

function DonutLegend({ items }: { items: { label: string; count: number; color: string }[] }) {
  return (
    <div className="flex flex-col gap-2 min-w-[100px]">
      {items.map(it => (
        <div key={it.label} className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: it.color }} />
          <span className="text-xs text-muted-foreground flex-1">{it.label}</span>
          <span className="text-xs font-bold text-foreground tabular-nums">{it.count}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Geo At A Glance mini-cards ───────────────────────────────────────────────

function GeoGlance({ geoData }: { geoData: { geo: GeoCode; count: number; pct: number }[] }) {
  const maxCount = Math.max(...geoData.map(g => g.count), 1)
  const GEO_LABEL: Record<GeoCode, string> = {
    UK: 'United Kingdom', JP: 'Japan', US: 'United States', DE: 'Germany', ST: 'Stuttgart',
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      {geoData.map(g => (
        <div
          key={g.geo}
          className="rounded-lg p-2.5 border"
          style={{ background: GEO_BG[g.geo], borderColor: `${GEO_COLORS[g.geo]}33` }}
        >
          <p className="text-[10px] font-medium text-muted-foreground mb-0.5 truncate">{GEO_LABEL[g.geo]}</p>
          <p className="text-xl font-bold tabular-nums leading-tight" style={{ color: GEO_COLORS[g.geo] }}>
            {g.count}
          </p>
          <p className="text-[9px] text-muted-foreground mb-1">{g.pct}% of total</p>
          <div className="h-1 rounded-full bg-white/60 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.round((g.count / maxCount) * 100)}%`,
                background: GEO_COLORS[g.geo],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Map satisfaction API row → FeedbackRow ───────────────────────────────────

function satToFeedbackRow(row: SatisfactionRow): FeedbackRow {
  const geo = String(row.geo ?? '')
  const operator = [
    row.demo_operator_jp, row.demo_operator_de,
    row.demo_operator_uk, row.demo_operator_us,
  ].find(op => op != null) ?? 'Unknown'
  const issues = String(row.technical_operational_issues ?? '')
  const hasIssue = issues && issues !== 'No issues encountered'
  return {
    id:                 String(row.id ?? ''),
    date:               String(row.date_of_demo ?? ''),
    geo,
    operator:           String(operator),
    satisfaction_score: parseInt(String(row.overall_satisfaction ?? '0'), 10) || 0,
    reported_issues:    hasIssue ? [issues] : [],
    comments:           String(row.comments_suggestions ?? ''),
    feedback_host:      String(row.email_address ?? ''),
  }
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function KPIPage() {
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL')
  const [selectedGeo,   setSelectedGeo]   = useState<string>('ALL')
  const [selectedType,  setSelectedType]  = useState<string>('ALL')
  const [dateFrom,      setDateFrom]      = useState<string>('')
  const [dateTo,        setDateTo]        = useState<string>('')
  const [demos,         setDemos]         = useState<DemoRequest[]>([])
  const [satRows,       setSatRows]       = useState<SatisfactionRow[]>([])

  const { data: dbDemos, loading, trigger: fetchDemos } = useGetDemos()
  const { data: satData, trigger: fetchSat } = useGetSatisfaction({ limit: 1000 })

  useEffect(() => { void fetchDemos() }, [])
  useEffect(() => { void fetchSat() }, [])
  useEffect(() => { if (dbDemos) setDemos(dbDemos as DemoRequest[]) }, [dbDemos])
  useEffect(() => { if (satData) setSatRows(satData.data) }, [satData])

  // Dynamic type options from data
  const typeOptions = useMemo<string[]>(() => {
    const types = Array.from(new Set(demos.map(d => d.type).filter(Boolean)))
    return ['ALL', ...types.sort()]
  }, [demos])

  // ── Filtered datasets ────────────────────────────────────────────────────

  const filteredDemos = useMemo(() => {
    return demos.filter(d => {
      if (d.status === 'DELETED') return false
      const m = String(new Date(d.demo_date + 'T00:00:00').getMonth() + 1).padStart(2, '0')
      if (selectedMonth !== 'ALL' && m !== selectedMonth) return false
      if (selectedGeo   !== 'ALL' && d.geo  !== selectedGeo) return false
      if (selectedType  !== 'ALL' && d.type !== selectedType) return false
      if (dateFrom && d.demo_date < dateFrom) return false
      if (dateTo   && d.demo_date > dateTo)   return false
      return true
    })
  }, [demos, selectedMonth, selectedGeo, selectedType, dateFrom, dateTo])

  // Satisfaction rows filtered by month + geo
  const filteredSat = useMemo(() => {
    return satRows.filter(row => {
      const dateStr = String(row.date_of_demo ?? '')
      // date_of_demo is stored as "DD/MM/YYYY" in satisfaction table
      const parts = dateStr.split('/')
      const m = parts.length === 3 ? (parts[1] ?? '').padStart(2, '0') : ''
      const geoMatch = selectedGeo === 'ALL' || String(row.geo ?? '') === selectedGeo
      const monthMatch = selectedMonth === 'ALL' || m === selectedMonth
      return geoMatch && monthMatch
    })
  }, [satRows, selectedMonth, selectedGeo])

  const feedbackRows: FeedbackRow[] = useMemo(
    () => filteredSat.map(satToFeedbackRow),
    [filteredSat],
  )

  // ── KPI computations ─────────────────────────────────────────────────────

  const today = new Date().toISOString().split('T')[0] ?? ''
  const totalDemos       = filteredDemos.length
  const totalSessions    = filteredDemos.reduce((sum, d) => sum + (d.num_sessions ?? 1), 0)
  const totalGuests      = filteredDemos.reduce((s, d) => s + d.total_guests, 0)
  const approvedUpcoming = filteredDemos.filter(
    d => d.status === 'APPROVED' && d.demo_date >= today,
  ).length
  const cancelledCount   = filteredDemos.filter(d => d.status === 'CANCELED').length
  const completionRate   = totalDemos > 0
    ? Math.round((filteredDemos.filter(d => d.status === 'APPROVED').length / totalDemos) * 100)
    : 0

  const avgSatisfaction = useMemo(() => {
    const scores = filteredSat
      .map(r => parseInt(String(r.overall_satisfaction ?? '0'), 10))
      .filter(n => n > 0)
    return scores.length > 0
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
      : 0
  }, [filteredSat])

  // ── Chart data ────────────────────────────────────────────────────────────

  const monthlyTrend  = useMemo(() => aggregateDemosByMonth(filteredDemos), [filteredDemos])
  const geoData       = useMemo(() => aggregateByGeo(filteredDemos),        [filteredDemos])
  const typeData      = useMemo(() => aggregateByType(filteredDemos),        [filteredDemos])
  const geoTrend      = useMemo(() => aggregateGeoTrend(filteredDemos),      [filteredDemos])

  const pipelineData  = useMemo(() => {
    const geos: GeoCode[] = ['UK', 'JP', 'US', 'DE']
    return geos.map(geo => {
      const ds = filteredDemos.filter(d => d.geo === geo)
      return {
        geo,
        APPROVED:      ds.filter(d => d.status === 'APPROVED').length,
        "NEED REVIEW": ds.filter(d => d.status === 'NEED REVIEW').length,
        CANCELED:     ds.filter(d => d.status === 'CANCELED').length,
      }
    })
  }, [filteredDemos])

  const readinessData = useMemo(() => {
    const geos: GeoCode[] = ['UK', 'JP', 'US', 'DE']
    return geos.map(geo => {
      const ds = filteredDemos.filter(
        d => d.geo === geo && d.status !== 'CANCELED' && d.status !== 'DELETED',
      )
      return {
        geo,
        EXCELLENT: ds.filter(d => d.lead_days > 7).length,
        GOOD:      ds.filter(d => d.lead_days > 4 && d.lead_days <= 7).length,
        SHORT:     ds.filter(d => d.lead_days > 2 && d.lead_days <= 4).length,
        CRITICAL:  ds.filter(d => d.lead_days <= 2).length,
      }
    })
  }, [filteredDemos])

  const readinessRate = useMemo(() => {
    const eligible = filteredDemos.filter(
      d => d.status !== 'CANCELED' && d.status !== 'DELETED',
    )
    if (!eligible.length) return 0
    return Math.round(
      (eligible.filter(d => d.readiness_date !== null).length / eligible.length) * 100,
    )
  }, [filteredDemos])

  // ── Donut legend helpers ──────────────────────────────────────────────────

  const geoLegend = geoData.map(g => ({
    label: g.geo, count: g.count, color: GEO_COLORS[g.geo],
  }))

  const typeLegend = typeData.map(t => ({
    label: t.type, count: t.count, color: TYPE_COLORS[t.type] ?? '#94A3B8',
  }))

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading && demos.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] gap-2 text-sm text-gray-400">
        <span className="w-4 h-4 border-2 border-border border-t-blue-500 rounded-full animate-spin" />
        Loading KPI data…
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-[#F8FAFC] overflow-hidden">

      {/* ── Sticky filter bar ── */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-6 py-3">
      <div className="flex flex-wrap items-end gap-3">

        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">MONTH</span>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="h-8 w-36 text-xs bg-card border-border">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map(m => (
                <SelectItem key={m.v} value={m.v} className="text-xs">{m.l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">GEO</span>
          <Select value={selectedGeo} onValueChange={setSelectedGeo}>
            <SelectTrigger className="h-8 w-28 text-xs bg-card border-border">
              <SelectValue placeholder="Geo" />
            </SelectTrigger>
            <SelectContent>
              {GEOS.map(g => (
                <SelectItem key={g} value={g} className="text-xs">{g === 'ALL' ? 'All Geos' : g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">TYPE</span>
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="h-8 w-44 text-xs bg-card border-border">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              {typeOptions.map(t => (
                <SelectItem key={t} value={t} className="text-xs">{t === 'ALL' ? 'All Types' : t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date range */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">DATE RANGE</span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground whitespace-nowrap">From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="h-8 px-2 text-xs rounded-md border border-border bg-card focus:outline-none focus:border-blue-400 text-foreground"
            />
            <span className="text-xs text-muted-foreground whitespace-nowrap">To</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="h-8 px-2 text-xs rounded-md border border-border bg-card focus:outline-none focus:border-blue-400 text-foreground"
            />
          </div>
        </div>

        {(selectedMonth !== 'ALL' || selectedGeo !== 'ALL' || selectedType !== 'ALL' || dateFrom !== '' || dateTo !== '') && (
          <button
            onClick={() => { setSelectedMonth('ALL'); setSelectedGeo('ALL'); setSelectedType('ALL'); setDateFrom(''); setDateTo('') }}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 self-end pb-1"
          >
            Clear
          </button>
        )}
      </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-auto p-6 space-y-6">

      {/* ── Section 1: KPI Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-7 gap-4">
        <StatCard label="TOTAL DEMOS"       value={totalDemos}                                        accent="#2563EB" />
        <StatCard label="TOTAL SESSIONS"    value={totalSessions}                                     accent="#0EA5E9" />
        <StatCard label="TOTAL GUESTS"      value={totalGuests}                                       accent="#7C3AED" />
        <StatCard label="APPROVED"          value={approvedUpcoming}                                  accent="#10B981" />
        <StatCard label="CANCELLED"         value={cancelledCount}                                    accent="#EF4444" />
        <StatCard label="COMPLETION RATE"   value={`${completionRate}%`}                              accent="#0EA5E9" />
        <StatCard label="AVG SATISFACTION"  value={avgSatisfaction > 0 ? avgSatisfaction.toFixed(1) : '—'} accent="#F59E0B" />
      </div>

      {/* ── Section 2: 3-col grid ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Monthly Demo Trend */}
        <ChartCard
          title="MONTHLY DEMO TREND"
          badge={
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#2563EB]">
              {totalDemos} demos
            </span>
          }
        >
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={monthlyTrend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#2563EB" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="#2563EB"
                strokeWidth={2}
                fill="url(#gradTotal)"
                dot={{ fill: '#2563EB', r: 3 }}
                name="Total"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Geo Distribution donut */}
        <ChartCard title="GEO DISTRIBUTION">
          <div className="flex items-center justify-center gap-4">
            <PieChart width={150} height={150}>
              <Pie
                data={geoData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={68}
                dataKey="count"
                nameKey="geo"
                strokeWidth={2}
                stroke="#fff"
              >
                {geoData.map((g, i) => (
                  <Cell key={i} fill={GEO_COLORS[g.geo]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            </PieChart>
            <DonutLegend items={geoLegend} />
          </div>
        </ChartCard>

        {/* Demo Type Mix donut */}
        <ChartCard title="DEMO TYPE MIX">
          <div className="flex items-center justify-center gap-4">
            <PieChart width={150} height={150}>
              <Pie
                data={typeData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={68}
                dataKey="count"
                nameKey="type"
                strokeWidth={2}
                stroke="#fff"
              >
                {typeData.map((t, i) => (
                  <Cell key={i} fill={TYPE_COLORS[t.type] ?? '#94A3B8'} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            </PieChart>
            <DonutLegend items={typeLegend} />
          </div>
        </ChartCard>
      </div>

      {/* ── Section 3: 2-col grid ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Pipeline Status */}
        <ChartCard title="PIPELINE STATUS">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              layout="vertical"
              data={pipelineData}
              margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#94A3B8' }} allowDecimals={false} />
              <YAxis type="category" dataKey="geo" tick={{ fontSize: 11, fill: '#94A3B8' }} width={28} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="APPROVED"      stackId="a" fill="#10B981" radius={[0, 0, 0, 0]} />
              <Bar dataKey="NEED REVIEW"  stackId="a" fill="#F59E0B" />
              <Bar dataKey="CANCELED"     stackId="a" fill="#EF4444" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
            <Activity size={13} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Completion rate:</span>
            <span
              className="text-xs font-bold px-2 py-0.5 rounded"
              style={{
                background: completionRate >= 70 ? '#DCFCE7' : completionRate >= 40 ? '#FEF3C7' : '#FEE2E2',
                color:      completionRate >= 70 ? '#166534' : completionRate >= 40 ? '#92400E' : '#991B1B',
              }}
            >
              {completionRate}%
            </span>
          </div>
        </ChartCard>

        {/* Geo Trend multi-line area */}
        <ChartCard title="GEO TREND (BY MONTH)">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={geoTrend} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <defs>
                {(['UK', 'JP', 'US', 'DE'] as GeoCode[]).map(geo => (
                  <linearGradient key={geo} id={`geoGrad${geo}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="10%"  stopColor={GEO_COLORS[geo]} stopOpacity={0.18} />
                    <stop offset="90%" stopColor={GEO_COLORS[geo]} stopOpacity={0.02} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              {(['UK', 'JP', 'US', 'DE'] as GeoCode[]).map(geo => (
                <Area
                  key={geo}
                  type="monotone"
                  dataKey={geo}
                  stroke={GEO_COLORS[geo]}
                  strokeWidth={2}
                  fill={`url(#geoGrad${geo})`}
                  dot={false}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── Section 4: 3-col grid ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Geo At A Glance */}
        <ChartCard title="GEO AT A GLANCE">
          <GeoGlance geoData={geoData} />
        </ChartCard>

        {/* Satisfaction Gauge */}
        <ChartCard title="DEMO OPS SATISFACTION">
          <div className="flex flex-col items-center justify-center pt-2">
            <SatisfactionGauge score={avgSatisfaction} feedbackCount={feedbackRows.length} />
          </div>
        </ChartCard>

        {/* Readiness Status */}
        <ChartCard title="REQUEST STATUS">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={readinessData} margin={{ top: 0, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="geo" tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="EXCELLENT" name={READINESS_LABELS['EXCELLENT']} stackId="r" fill={READINESS_COLORS['EXCELLENT']} />
              <Bar dataKey="GOOD"      name={READINESS_LABELS['GOOD']}      stackId="r" fill={READINESS_COLORS['GOOD']} />
              <Bar dataKey="SHORT"     name={READINESS_LABELS['SHORT']}     stackId="r" fill={READINESS_COLORS['SHORT']} />
              <Bar dataKey="CRITICAL"  name={READINESS_LABELS['CRITICAL']}  stackId="r" fill={READINESS_COLORS['CRITICAL']} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
            <Activity size={13} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Readiness rate:</span>
            <span
              className="text-xs font-bold px-2 py-0.5 rounded"
              style={{
                background: readinessRate >= 70 ? '#DCFCE7' : readinessRate >= 40 ? '#FEF3C7' : '#FEE2E2',
                color:      readinessRate >= 70 ? '#166534' : readinessRate >= 40 ? '#92400E' : '#991B1B',
              }}
            >
              {readinessRate}%
            </span>
          </div>
        </ChartCard>
      </div>

      {/* ── Section 5: Feedback Table ────────────────────────────────────────── */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">DEMO FEEDBACK DETAILS</h3>
          <span className="text-xs text-muted-foreground">
            {feedbackRows.length} record{feedbackRows.length !== 1 ? 's' : ''}
          </span>
        </div>
        <FeedbackTable data={feedbackRows} />
      </div>

      </div>
    </div>
  )
}
