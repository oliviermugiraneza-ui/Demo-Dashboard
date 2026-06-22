import { useState, useMemo, type ReactNode } from 'react'
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

import { postDemoSessions, type PostDemoSession, type GeoCode, type DemoType } from './data/sampleData'
import StatCard from '../components/StatCard'
import PostDemoSessions from './ui/PostDemoSessions'

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

const GEOS  = ['ALL','UK','JP','US','DE']
const TYPES = ['ALL','VIP','Media','External','OEM Support','Performance Check','Friend & Family','Conference','Candidate']

const INT_LABELS: Record<string, string> = {
  comfort_stop:'Comfort Stop', disengagement:'Disengagement', takeover:'Takeover',
  collision_avoidance:'Collision Avoid', blue_light:'Blue Light',
  power_cycle:'Power Cycle', ui_crash:'UI Crash', gps_loss:'GPS Loss',
}

// ─── Behavior categorization ──────────────────────────────────────────────────

function categorizeBehavior(b: string): string {
  const bl = b.toLowerCase()
  if (bl.includes('rain') || bl.includes('snow') || bl.includes('fog') ||
      bl.includes('wind') || bl.includes('winter') || bl.includes('heat') || bl.includes('ice'))
    return 'Adverse Weather'
  if (bl.includes('highway') || bl.includes('bridge') || bl.includes('merge') || bl.includes('performance'))
    return 'Highway'
  if (bl.includes('pedestrian'))
    return 'Pedestrian'
  if (bl.includes('urban') || bl.includes('city') || bl.includes('district') ||
      bl.includes('roundabout') || bl.includes('junction') || bl.includes('heritage'))
    return 'Urban Nav'
  if (bl.includes('smooth') || bl.includes('cruise') || bl.includes('premium') ||
      bl.includes('park') || bl.includes('family'))
    return 'Smooth Drive'
  return 'Other'
}

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
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <SectionHeader title={title} {...(accent !== undefined ? { accent } : {})} />
      {children}
    </div>
  )
}

// ─── Custom donut label ───────────────────────────────────────────────────────

function renderDonutLabel({ name, percent }: { name?: string; percent?: number }) {
  const pct = percent ?? 0
  if (pct < 0.05) return null
  return `${name ?? ''} ${(pct * 100).toFixed(0)}%`
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PostDemoPage() {
  const [monthFilter, setMonthFilter] = useState('ALL')
  const [geoFilter,   setGeoFilter]   = useState('ALL')
  const [typeFilter,  setTypeFilter]  = useState('ALL')

  // ── Filtered sessions ───────────────────────────────────────────────────────
  const filtered = useMemo<PostDemoSession[]>(() =>
    postDemoSessions.filter(s => {
      const mm = (s.demo_datetime.split('T')[0] ?? '').split('-')[1] ?? ''
      if (monthFilter !== 'ALL' && mm !== monthFilter) return false
      if (geoFilter   !== 'ALL' && s.geo       !== (geoFilter as GeoCode)) return false
      if (typeFilter  !== 'ALL' && s.demo_type !== (typeFilter as DemoType)) return false
      return true
    }),
  [monthFilter, geoFilter, typeFilter])

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const n = filtered.length
    const totalInt = filtered.reduce((a, s) => a + s.total_interventions, 0)
    const totalIssues = filtered.reduce((a, s) => a + s.active_issues_list.length, 0)
    const totalUDs = filtered.reduce((a, s) => a + s.uds_count, 0)
    const opMap = new Map<string, number>()
    for (const s of filtered) opMap.set(s.operator, (opMap.get(s.operator) ?? 0) + 1)
    let topOp = '—'; let topCnt = 0
    for (const [op, c] of opMap.entries()) { if (c > topCnt) { topOp = op; topCnt = c } }
    return {
      n, totalInt,
      avgInt: n ? Math.round((totalInt / n) * 10) / 10 : 0,
      totalIssues, totalUDs, topOp,
    }
  }, [filtered])

  // ── Geo donut ───────────────────────────────────────────────────────────────
  const geoDonut = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of filtered) m.set(s.geo, (m.get(s.geo) ?? 0) + 1)
    return Array.from(m.entries()).map(([name, value]) => ({ name, value }))
  }, [filtered])

  // ── Type mix donut ──────────────────────────────────────────────────────────
  const typeDonut = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of filtered) m.set(s.demo_type, (m.get(s.demo_type) ?? 0) + 1)
    return Array.from(m.entries()).map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [filtered])

  // ── Behavior trends ─────────────────────────────────────────────────────────
  const behaviorTrends = useMemo(() => {
    const catCount = new Map<string, number>()
    for (const s of filtered) {
      const cat = categorizeBehavior(s.model_behavior)
      catCount.set(cat, (catCount.get(cat) ?? 0) + 1)
    }
    const top5 = Array.from(catCount.entries())
      .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c]) => c)

    const dateMap = new Map<string, Record<string, number>>()
    for (const s of filtered) {
      const mmdd = (s.demo_datetime.split('T')[0] ?? '').slice(5)
      if (!dateMap.has(mmdd)) {
        const obj: Record<string, number> = {}
        for (const c of top5) obj[c] = 0
        dateMap.set(mmdd, obj)
      }
      const cat = categorizeBehavior(s.model_behavior)
      if (top5.includes(cat)) {
        const obj = dateMap.get(mmdd)!
        obj[cat] = (obj[cat] ?? 0) + 1
      }
    }
    const data = Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, cats]) => ({ date, ...cats }))
    return { data, categories: top5 }
  }, [filtered])

  // ── Top interventions (horizontal bar) ──────────────────────────────────────
  const interventionData = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of filtered) {
      for (const [k, v] of Object.entries(s.interventions)) {
        const n = v as number | undefined
        if (n && n > 0) m.set(k, (m.get(k) ?? 0) + n)
      }
    }
    return Array.from(m.entries())
      .map(([type, count]) => ({ type: INT_LABELS[type] ?? type, count }))
      .sort((a, b) => b.count - a.count).slice(0, 8)
  }, [filtered])

  const maxIntCount = interventionData[0]?.count ?? 1

  // ── Driving feature performance ─────────────────────────────────────────────
  const featureData = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of filtered) m.set(s.driving_feature, (m.get(s.driving_feature) ?? 0) + 1)
    return Array.from(m.entries())
      .map(([feature, count]) => ({ feature, count }))
      .sort((a, b) => b.count - a.count)
  }, [filtered])

  // ── Vehicle utilization ─────────────────────────────────────────────────────
  const vehicleData = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of filtered) m.set(s.vehicle_id, (m.get(s.vehicle_id) ?? 0) + 1)
    return Array.from(m.entries())
      .map(([vehicle_id, count]) => ({ vehicle_id, count }))
      .sort((a, b) => b.count - a.count)
  }, [filtered])
  const maxVehicle = vehicleData[0]?.count ?? 1

  // ── Model utilization (model + aux_model combined) ──────────────────────────
  const modelData = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of filtered) {
      m.set(s.model,     (m.get(s.model)     ?? 0) + 1)
      m.set(s.aux_model, (m.get(s.aux_model) ?? 0) + 1)
    }
    return Array.from(m.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [filtered])

  // ── Operators per run ───────────────────────────────────────────────────────
  const operatorData = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of filtered) m.set(s.operator, (m.get(s.operator) ?? 0) + 1)
    return Array.from(m.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [filtered])

  // ── Issue breakdown ─────────────────────────────────────────────────────────
  const issueBreakdown = useMemo(() => {
    let uiCrash = 0, powerCycle = 0, blueLight = 0, uds = 0, gps = 0
    for (const s of filtered) {
      const iv = s.interventions
      uiCrash    += iv.ui_crash    ?? 0
      powerCycle += iv.power_cycle ?? 0
      blueLight  += iv.blue_light  ?? 0
      uds        += s.uds_count
      gps        += iv.gps_loss    ?? 0
    }
    return [
      { name: 'UI Crash',    count: uiCrash },
      { name: 'Power Cycle', count: powerCycle },
      { name: 'Blue Light',  count: blueLight },
      { name: 'UDs',         count: uds },
      { name: 'GPS Loss',    count: gps },
    ]
  }, [filtered])

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-5 space-y-5" style={{ background: '#F8FAFC', minHeight: '100%' }}>

      {/* Filter row */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="w-36 bg-white text-sm h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MONTHS.map(m => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={geoFilter} onValueChange={setGeoFilter}>
          <SelectTrigger className="w-28 bg-white text-sm h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {GEOS.map(g => <SelectItem key={g} value={g}>{g === 'ALL' ? 'All Geo' : g}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40 bg-white text-sm h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TYPES.map(t => <SelectItem key={t} value={t}>{t === 'ALL' ? 'All Types' : t}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-gray-400">{filtered.length} sessions</span>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-6 gap-3">
        <StatCard label="Total Sessions"    value={kpis.n}          accent="#2563EB" />
        <StatCard label="Total Interventions" value={kpis.totalInt} accent="#F59E0B" />
        <StatCard label="Avg Int / Demo"    value={kpis.avgInt}      accent="#8B5CF6" />
        <StatCard label="Total Issues"      value={kpis.totalIssues} accent="#EF4444" />
        <StatCard label="Total UDs"         value={kpis.totalUDs}    accent="#EF4444" />
        <StatCard label="Top Operator"      value={kpis.topOp}       accent="#10B981" />
      </div>

      {/* Row 1: Geo donut | Type donut | Behavior trends */}
      <div className="grid grid-cols-3 gap-4">
        <ChartCard title="Geo Distribution">
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
        </ChartCard>

        <ChartCard title="Demo Type Mix">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={typeDonut} cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                   dataKey="value" label={renderDonutLabel} labelLine={false}>
                {typeDonut.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length] ?? 'hsl(var(--chart-1))'} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Model Behavior Trends">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={behaviorTrends.data} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {behaviorTrends.categories.map((cat, i) => (
                <Area
                  key={cat} type="monotone" dataKey={cat}
                  stroke={CHART_COLORS[i % CHART_COLORS.length] ?? 'hsl(var(--chart-1))'}
                  fill={CHART_COLORS[i % CHART_COLORS.length] ?? 'hsl(var(--chart-1))'}
                  fillOpacity={0.35} strokeWidth={1.5}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Row 2: Interventions | Feature Performance | Vehicle Utilization */}
      <div className="grid grid-cols-3 gap-4">
        <ChartCard title="Top Interventions" accent="#EF4444">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={interventionData} layout="vertical"
                      margin={{ top: 4, right: 20, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="type" width={110} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#EF4444" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Driving Feature Performance">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={featureData} margin={{ top: 4, right: 8, bottom: 40, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="feature" tick={{ fontSize: 9 }} interval={0}
                     angle={-35} textAnchor="end" />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {featureData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length] ?? 'hsl(var(--chart-1))'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Vehicle Utilization">
          <div className="space-y-2.5 mt-1">
            {vehicleData.map(v => (
              <div key={v.vehicle_id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-xs font-semibold text-gray-700">{v.vehicle_id}</span>
                  <span className="text-xs text-gray-500">{v.count} sessions</span>
                </div>
                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(v.count / maxVehicle) * 100}%`,
                      backgroundColor: 'hsl(var(--chart-1))',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Sessions Table */}
      <PostDemoSessions sessions={filtered} />

      {/* Row 4: Intervention Count Table | Model Utilization */}
      <div className="grid grid-cols-2 gap-4">
        {/* Left: Intervention Count Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-red-50 border-b border-red-100">
            <span className="text-sm font-bold text-red-700">Intervention Top Count</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-red-50/50 hover:bg-red-50/50">
                <TableHead className="text-xs w-10">#</TableHead>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs w-16">Count</TableHead>
                <TableHead className="text-xs">Share</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {interventionData.map((item, i) => (
                <TableRow key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <TableCell className="text-xs font-bold text-gray-400 py-2">{i + 1}</TableCell>
                  <TableCell className="text-xs text-gray-700 py-2">{item.type}</TableCell>
                  <TableCell className="text-xs font-bold text-red-600 py-2">{item.count}</TableCell>
                  <TableCell className="py-2">
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden w-full">
                      <div
                        className="h-full rounded-full bg-red-400"
                        style={{ width: `${(item.count / maxIntCount) * 100}%` }}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Right: Model Utilization horizontal bar */}
        <ChartCard title="Model Utilization" accent="#10B981">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={modelData} layout="vertical"
                      margin={{ top: 4, right: 40, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#10B981" radius={[0, 4, 4, 0]}>
                <LabelList dataKey="count" position="right" style={{ fontSize: 11, fill: '#374151' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Row 5: Operators Per Runs | Issue Breakdown */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '60% 1fr' }}>
        {/* Left: Operators Per Runs */}
        <ChartCard title="Operators Per Runs" accent="#F59E0B">
          <ResponsiveContainer width="100%" height={220}>
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
        </ChartCard>

        {/* Right: Issue Breakdown */}
        <ChartCard title="Issue Breakdown" accent="#F59E0B">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={issueBreakdown} layout="vertical"
                      margin={{ top: 4, right: 30, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#F59E0B" radius={[0, 4, 4, 0]}>
                <LabelList dataKey="count" position="right" style={{ fontSize: 11, fill: '#374151' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

    </div>
  )
}
