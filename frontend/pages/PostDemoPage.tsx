import { useState, useEffect, useMemo, type ReactNode } from 'react'
import { useHeaderBadge } from '../context/HeaderBadgeContext'
import NewReportWizard from './ui/NewReportWizard'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis, LineChart, Line,
} from 'recharts'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../lib/shadcn/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../lib/shadcn/table'
import StatCard from '../components/StatCard'
import {
  type PostDemoRecord,
  type PostDemoSummary,
  type ModelAnalytic,
  type InterventionAnalytic,
  useCreatePostDemo,
  useUpdatePostDemo,
} from '../hooks/backend/postDemo'
import { DEMO_TYPES } from '../lib/constants/demoTypes'

// ─── Constants ────────────────────────────────────────────────────────────────

const CHART_COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#0EA5E9', '#EC4899']

const GEOS = ['ALL', 'JP', 'UK', 'US', 'DE']

const MONTHS = [
  { v: 'ALL', l: 'All Months' }, { v: '01', l: 'Jan' }, { v: '02', l: 'Feb' },
  { v: '03', l: 'Mar' }, { v: '04', l: 'Apr' }, { v: '05', l: 'May' },
  { v: '06', l: 'Jun' }, { v: '07', l: 'Jul' }, { v: '08', l: 'Aug' },
  { v: '09', l: 'Sep' }, { v: '10', l: 'Oct' }, { v: '11', l: 'Nov' }, { v: '12', l: 'Dec' },
]

const CURRENT_MONTH = String(new Date().getMonth() + 1).padStart(2, '0')

const DEMO_TYPE_OPTIONS = ['ALL', ...DEMO_TYPES]

const CATEGORY_OPTIONS = [
  { v: 'ALL',   l: 'All Categories' },
  { v: 'demo',  l: 'Demo' },
  { v: 'recce', l: 'Recce' },
  { v: 'brt',   l: 'BRT' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sn   = (n: string | null | undefined) => n ? n.split('-').slice(0, 2).join('-') : '?'
const fmt1 = (v: number | null | undefined) => v != null ? v.toFixed(1) : '—'
const fmti = (v: number | null | undefined) => v != null ? String(v) : '—'

// ─── ScoreBar ─────────────────────────────────────────────────────────────────

function ScoreBar({ value, color = '#2563EB', max = 10 }: { value: number | null; color?: string; max?: number }) {
  const pct = value != null ? (value / max) * 100 : 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-bold w-5 text-right" style={{ color }}>{value ?? '—'}</span>
    </div>
  )
}

// ─── DetailDrawer helpers ─────────────────────────────────────────────────────

function DR({ label, value }: { label: string; value: ReactNode }) {
  if (value == null || value === '') return null
  return (
    <div className="py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block">{label}</span>
      <span className="text-xs text-gray-800">{value}</span>
    </div>
  )
}

function DS({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-3">
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-blue-600 mb-1.5 pb-1 border-b border-blue-100">{title}</h4>
      {children}
    </div>
  )
}

// ─── DetailDrawer ─────────────────────────────────────────────────────────────

function DetailDrawer({ record: r, onClose }: { record: PostDemoRecord; onClose: () => void }) {
  const catLabel = r.category === 'brt' ? 'BRT' : r.category === 'recce' ? 'Recce' : 'Demo'
  const catColor = r.category === 'brt' ? 'text-emerald-600' : r.category === 'recce' ? 'text-purple-600' : 'text-blue-600'

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[420px] bg-white z-50 shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50 flex-shrink-0">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Ops Feedback Detail</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              <span className={`font-medium ${catColor}`}>{catLabel}</span>
              {' · '}{r.geo}{' · '}{String(r.demo_date ?? '').substring(0, 10)}
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-200 text-gray-500 text-lg">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <DS title="Run Context">
            <DR label="Category"      value={catLabel} />
            <DR label="Demo Ref"      value={r.demo_ref} />
            <DR label="GEO"           value={r.geo} />
            <DR label="Date"          value={String(r.demo_date ?? '').substring(0, 10)} />
            <DR label="Time"          value={r.demo_time} />
            <DR label="Type"          value={r.demo_type} />
            <DR label="Organisation"  value={r.guest_organization} />
          </DS>

          <DS title="Operator">
            <DR label="Name"  value={r.operator_name} />
            <DR label="Email" value={r.operator_email} />
          </DS>

          <DS title="Operational Info">
            <DR label="GEO"        value={r.geo} />
            <DR label="Demo Date"  value={String(r.demo_date ?? '').substring(0, 10)} />
            <DR label="Route"      value={r.route ?? r.demo_route} />
            <DR label="Vehicle ID" value={r.vehicle_id} />
          </DS>

          <DS title="Model Evaluation">
            <DR label="Model" value={r.model_name} />
            {(r.model_behaviours ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1 my-1.5">
                {(r.model_behaviours ?? []).map((b: string) => (
                  <span key={b} className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">{b}</span>
                ))}
              </div>
            )}
            <div className="space-y-1 my-1.5">
              <div><span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block mb-0.5">Safety</span><ScoreBar value={r.safety_score} color="#EF4444" /></div>
              <div><span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block mb-0.5">Comfort</span><ScoreBar value={r.comfort_score} color="#10B981" /></div>
              <div><span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block mb-0.5">Decisiveness</span><ScoreBar value={r.decisiveness_score} color="#2563EB" /></div>
              <div><span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block mb-0.5">Aggressiveness</span><ScoreBar value={r.aggressiveness_score} color="#F59E0B" /></div>
            </div>
            <DR label="Positive Behaviour"  value={r.positive_behaviour} />
            <DR label="Problem Description" value={r.problem_description} />
          </DS>

          <DS title="Issues & UDs">
            {(r.demo_issues ?? []).length > 0
              ? <ul className="mb-1">{(r.demo_issues ?? []).map((x: string, i: number) => <li key={i} className="text-xs text-amber-700">• {x}</li>)}</ul>
              : <p className="text-xs text-gray-400 italic mb-1">No issues</p>}
            <DR label="Number of UDs"          value={r.number_of_uds != null ? String(r.number_of_uds) : null} />
            <DR label="Power Cycle"            value={r.power_cycle_required ? 'Yes' : null} />
            <DR label="Reason for Power Cycle" value={r.reason_for_power_cycle} />
          </DS>

          {(r.driving_features ?? []).length > 0 && (
            <DS title="Driving Features">
              <div className="flex flex-wrap gap-1">
                {(r.driving_features ?? []).map((f: string) => (
                  <span key={f} className="text-[10px] px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded">{f}</span>
                ))}
              </div>
            </DS>
          )}

          {r.interventions && Object.keys(r.interventions).length > 0 && (
            <DS title="Interventions">
              {Object.entries(r.interventions)
                .map(([k, raw]) => {
                  const parsed = typeof raw === 'number'
                    ? { count: raw, safetyCritical: false }
                    : raw
                  return { k, count: parsed.count, sc: parsed.safetyCritical }
                })
                .filter(({ count }) => count > 0)
                .map(({ k, count, sc }) => (
                  <div key={k} className="py-1 border-b border-gray-50 last:border-0 flex justify-between items-center bg-amber-50/40">
                    <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-gray-400">
                      {k.replace(/_/g, ' ')}
                      {sc && (
                        <span className="inline-flex items-center gap-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                          <span className="px-1 py-0.5 rounded bg-red-100 text-red-600 text-[8px] font-bold">SC</span>
                        </span>
                      )}
                    </span>
                    <span className="text-xs font-bold text-amber-700">Count: {count}</span>
                  </div>
                ))}
            </DS>
          )}

          <DS title="Safety & Smoothness">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs text-gray-500">Safety Critical:</span>
              {(() => {
                const scCount = r.interventions
                  ? Object.values(r.interventions).reduce((n, raw) => {
                      const parsed = typeof raw === 'number' ? { count: raw, safetyCritical: false } : raw
                      return n + (parsed.safetyCritical ? parsed.count : 0)
                    }, 0)
                  : 0
                return (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
                    scCount > 0
                      ? 'text-red-600 bg-red-50 border-red-200'
                      : 'text-green-700 bg-green-50 border-green-200'
                  }`}>{scCount}</span>
                )
              })()}
            </div>
            <div className="mb-1.5">
              <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block mb-0.5">Smoothness</span>
              <ScoreBar value={r.smoothness_score} color="#10B981" max={5} />
            </div>
          </DS>

          <DS title="Linked Demo">
            {r.demo_id != null
              ? <p className="text-xs text-blue-600 font-medium">Linked to Demo #{r.demo_id}{r.demo_ref ? ` (${r.demo_ref})` : ''}</p>
              : <p className="text-xs text-gray-400 italic">Unlinked post-demo report</p>}
          </DS>
        </div>
      </div>
    </>
  )
}

// ─── CategoryBadge ────────────────────────────────────────────────────────────

function CategoryBadge({ cat }: { cat: string }) {
  const styles: Record<string, string> = {
    demo:  'bg-blue-50 text-blue-700',
    recce: 'bg-purple-50 text-purple-700',
    brt:   'bg-emerald-50 text-emerald-700',
  }
  const labels: Record<string, string> = { demo: 'Demo', recce: 'Recce', brt: 'BRT' }
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${styles[cat] ?? 'bg-gray-50 text-gray-500'}`}>
      {labels[cat] ?? cat}
    </span>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PostDemoPage() {
  const { setBadge } = useHeaderBadge()

  // Filter state — order: GEO, Month, Demo Type, Category, From, To, Safety Critical, Operator, Route
  const [geoFilter, setGeoFilter]           = useState('ALL')
  const [monthFilter, setMonthFilter]       = useState(CURRENT_MONTH)
  const [demoTypeFilter, setDemoTypeFilter] = useState('ALL')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [startDate, setStartDate]           = useState('')
  const [endDate, setEndDate]               = useState('')
  const [scFilter, setScFilter]             = useState('ALL')
  const [operatorFilter, setOperatorFilter] = useState('')
  const [routeFilter, setRouteFilter]       = useState('')

  // Data state
  const [records, setRecords]             = useState<PostDemoRecord[]>([])
  const [summary, setSummary]             = useState<PostDemoSummary | null>(null)
  const [modelData, setModelData]         = useState<ModelAnalytic[]>([])
  const [interventions, setInterventions] = useState<InterventionAnalytic[]>([])
  const [loading, setLoading]             = useState(true)
  const [refetchKey, setRefetchKey]       = useState(0)

  // UI state
  const [selected, setSelected]     = useState<PostDemoRecord | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [opSearch, setOpSearch]     = useState('')

  const { trigger: createFn } = useCreatePostDemo()
  const { trigger: updateFn } = useUpdatePostDemo()

  // Inject + Ops Feedback button into AppShell header
  useEffect(() => {
    setBadge(
      <button
        onClick={() => setWizardOpen(true)}
        className="flex items-center gap-1.5 text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] transition-colors rounded-full px-4 py-2"
      >
        + Ops Feedback
      </button>
    )
    return () => setBadge(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setBadge])

  useEffect(() => {
    const qs = new URLSearchParams()
    if (geoFilter !== 'ALL')       qs.set('geo', geoFilter)
    if (monthFilter !== 'ALL')     qs.set('month', monthFilter)
    if (demoTypeFilter !== 'ALL')  qs.set('demoType', demoTypeFilter)
    if (categoryFilter !== 'ALL')  qs.set('category', categoryFilter)
    if (startDate)                 qs.set('startDate', startDate)
    if (endDate)                   qs.set('endDate', endDate)
    if (scFilter !== 'ALL')        qs.set('safetyCritical', scFilter)
    if (operatorFilter.trim())     qs.set('operatorName', operatorFilter.trim())
    if (routeFilter.trim())        qs.set('route', routeFilter.trim())
    const q = qs.toString()
    setLoading(true)
    Promise.all([
      fetch('/api/post-demo' + (q ? '?' + q : '')).then(r => r.json() as Promise<{ ok: boolean; data: PostDemoRecord[]; total: number }>),
      fetch('/api/post-demo/analytics/summary' + (q ? '?' + q : '')).then(r => r.json() as Promise<{ ok: boolean; data: PostDemoSummary }>),
      fetch('/api/post-demo/analytics/models' + (q ? '?' + q : '')).then(r => r.json() as Promise<{ ok: boolean; data: ModelAnalytic[] }>),
      fetch('/api/post-demo/analytics/interventions' + (q ? '?' + q : '')).then(r => r.json() as Promise<{ ok: boolean; data: InterventionAnalytic[] }>),
    ]).then(([recs, summ, models, intv]) => {
      setRecords(((recs.data ?? []) as PostDemoRecord[]).map(r => ({ ...r, id: Number(r.id), demo_id: r.demo_id != null ? Number(r.demo_id) : null })))
      setSummary(summ.data ?? null)
      setModelData(models.data ?? [])
      setInterventions(intv.data ?? [])
    }).catch(console.error).finally(() => setLoading(false))
  }, [geoFilter, monthFilter, demoTypeFilter, categoryFilter, startDate, endDate, scFilter, operatorFilter, routeFilter, refetchKey])

  const demoRecs  = useMemo(() => records.filter(r => r.category === 'demo'),  [records])
  const recceRecs = useMemo(() => records.filter(r => r.category === 'recce'), [records])
  const brtRecs   = useMemo(() => records.filter(r => r.category === 'brt'),   [records])

  const allModels = useMemo(() => {
    const s = new Set<string>()
    records.forEach(r => { if (r.model_name) s.add(r.model_name) })
    return ['ALL', ...Array.from(s).sort()]
  }, [records])

  const geoDonut = useMemo(() => {
    const m = new Map<string, number>()
    records.forEach(r => m.set(r.geo ?? 'Unknown', (m.get(r.geo ?? 'Unknown') ?? 0) + 1))
    return Array.from(m.entries()).map(([name, value]) => ({ name, value }))
  }, [records])

  const categoryDonut = useMemo(() => {
    const m = new Map<string, number>()
    records.forEach(r => m.set(r.category ?? 'unknown', (m.get(r.category ?? 'unknown') ?? 0) + 1))
    return Array.from(m.entries()).map(([name, value]) => ({ name, value }))
  }, [records])

  const udsTrend = useMemo(() => {
    const m = new Map<string, number>()
    records.filter(r => r.demo_date).forEach(r => {
      const d = String(r.demo_date).substring(0, 10)
      m.set(d, (m.get(d) ?? 0) + (r.number_of_uds ?? 0))
    })
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, uds]) => ({ date: date.substring(5), uds }))
  }, [records])

  const scatterData = useMemo(() =>
    records.filter(r => r.safety_score != null && r.comfort_score != null).map(r => ({
      x: r.comfort_score!,
      y: r.safety_score!,
      name: sn(r.model_name),
    }))
  , [records])

  const topModels = useMemo(() => [...modelData].slice(0, 10), [modelData])

  const refetch = () => setRefetchKey(k => k + 1)

  async function handleCreate(data: Record<string, unknown>) { await createFn(data); refetch() }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function handleUpdate(id: number, data: Record<string, unknown>) { await updateFn(id, data); refetch() }

  const noData = (h = 220) => (
    <div className="flex items-center justify-center text-xs text-gray-400 italic" style={{ height: h }}>No data</div>
  )

  // Unique operator names for the autocomplete hint
  const uniqueOperators = useMemo(() => {
    const s = new Set<string>()
    records.forEach(r => { if (r.operator_name) s.add(r.operator_name) })
    return Array.from(s).sort()
  }, [records])

  const filteredOps = opSearch
    ? uniqueOperators.filter(o => o.toLowerCase().includes(opSearch.toLowerCase()))
    : []

  return (
    <div className="h-full flex flex-col bg-[#F8FAFC] overflow-hidden">

      {/* ── Filter bar ── */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-5 py-3">
        <div className="flex items-end gap-3 flex-wrap">

          {/* 1. GEO */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">GEO</span>
            <Select value={geoFilter} onValueChange={setGeoFilter}>
              <SelectTrigger className="w-24 bg-white text-sm h-8 border-gray-200"><SelectValue /></SelectTrigger>
              <SelectContent>{GEOS.map(g => <SelectItem key={g} value={g}>{g === 'ALL' ? 'All GEOs' : g}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* 2. Month */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Month</span>
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="w-28 bg-white text-sm h-8 border-gray-200"><SelectValue /></SelectTrigger>
              <SelectContent>{MONTHS.map(m => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* 3. Demo Type */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Demo Type</span>
            <Select value={demoTypeFilter} onValueChange={setDemoTypeFilter}>
              <SelectTrigger className="w-44 bg-white text-sm h-8 border-gray-200"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DEMO_TYPE_OPTIONS.map(d => (
                  <SelectItem key={d} value={d}>{d === 'ALL' ? 'All Demo Types' : d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 4. Category */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Category</span>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-36 bg-white text-sm h-8 border-gray-200"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map(c => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* 5. From */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">From</span>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1 text-xs h-8 focus:outline-none focus:ring-2 focus:ring-blue-300 w-32" />
          </div>

          {/* 6. To */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">To</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1 text-xs h-8 focus:outline-none focus:ring-2 focus:ring-blue-300 w-32" />
          </div>

          {/* 7. Safety Critical */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Safety Critical</span>
            <Select value={scFilter} onValueChange={setScFilter}>
              <SelectTrigger className="w-28 bg-white text-sm h-8 border-gray-200"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="true">Yes</SelectItem>
                <SelectItem value="false">No</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 8. Operator */}
          <div className="flex flex-col gap-1 relative">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Operator</span>
            <input
              value={opSearch}
              onChange={e => { setOpSearch(e.target.value); setOperatorFilter(e.target.value) }}
              placeholder="Filter by name…"
              className="border border-gray-200 rounded-lg px-2 py-1 text-xs h-8 focus:outline-none focus:ring-2 focus:ring-blue-300 w-36"
            />
            {filteredOps.length > 0 && opSearch && (
              <div className="absolute top-full mt-1 left-0 z-20 bg-white border border-gray-200 rounded-lg shadow-md w-48 max-h-40 overflow-y-auto">
                {filteredOps.map(op => (
                  <button key={op} type="button"
                    onClick={() => { setOpSearch(op); setOperatorFilter(op) }}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 text-gray-700">
                    {op}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 9. Route */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Route</span>
            <input
              value={routeFilter}
              onChange={e => setRouteFilter(e.target.value)}
              placeholder="Filter by route…"
              className="border border-gray-200 rounded-lg px-2 py-1 text-xs h-8 focus:outline-none focus:ring-2 focus:ring-blue-300 w-36"
            />
          </div>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-3 pb-0.5">
            {loading && <span className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />}
            <span className="text-xs text-gray-400">{records.length} records</span>
          </div>
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-auto p-5 space-y-5">

        {/* KPI cards */}
        <div className="grid grid-cols-9 gap-2">
          <StatCard label="Total Reports"    value={summary?.total                 ?? '—'} accent="#2563EB" />
          <StatCard label="Demo Runs"        value={summary?.demo_count            ?? '—'} accent="#0EA5E9" />
          <StatCard label="BRT Runs"         value={summary?.brt_count             ?? '—'} accent="#10B981" />
          <StatCard label="Recce Runs"       value={summary?.recce_count           ?? '—'} accent="#8B5CF6" />
          <StatCard label="Avg Safety"       value={summary?.avg_safety        != null ? fmt1(summary.avg_safety)        : '—'} accent="#EF4444" />
          <StatCard label="Avg Comfort"      value={summary?.avg_comfort       != null ? fmt1(summary.avg_comfort)       : '—'} accent="#10B981" />
          <StatCard label="Avg Decisiveness" value={summary?.avg_decisiveness  != null ? fmt1(summary.avg_decisiveness)  : '—'} accent="#2563EB" />
          <StatCard label="Safety Critical"  value={summary?.safety_critical_count ?? '—'} accent="#EF4444" />
          <StatCard label="Total UDs"        value={summary?.total_uds             ?? '—'} accent="#F59E0B" />
        </div>

        {/* Charts grid */}
        <div className="grid grid-cols-2 gap-4">

          {/* Model Performance bar chart */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-sm font-bold text-gray-700 mb-3">Model Performance</p>
            {topModels.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topModels.map(d => ({ ...d, name: sn(d.model_name) }))} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 9 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="avg_safety"       name="Safety"       fill="#EF4444" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="avg_comfort"      name="Comfort"      fill="#10B981" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="avg_decisiveness" name="Decisiveness" fill="#2563EB" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : noData(220)}
          </div>

          {/* Safety vs Comfort scatter */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-sm font-bold text-gray-700 mb-3">Safety vs Comfort</p>
            {scatterData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <ScatterChart margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" dataKey="x" name="Comfort" domain={[0, 10]} tick={{ fontSize: 9 }} label={{ value: 'Comfort', position: 'insideBottom', offset: -2, fontSize: 9 }} />
                  <YAxis type="number" dataKey="y" name="Safety"  domain={[0, 10]} tick={{ fontSize: 9 }} label={{ value: 'Safety', angle: -90, position: 'insideLeft', fontSize: 9 }} />
                  <ZAxis range={[40, 40]} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0]?.payload as { x: number; y: number; name: string } | undefined
                      if (!d) return null
                      return (
                        <div className="bg-white border border-gray-200 rounded-lg p-2 text-xs shadow">
                          <p className="font-bold text-gray-800">{d.name}</p>
                          <p className="text-gray-500">Comfort: {d.x} · Safety: {d.y}</p>
                        </div>
                      )
                    }}
                  />
                  <Scatter data={scatterData} fill="#2563EB" fillOpacity={0.7} />
                </ScatterChart>
              </ResponsiveContainer>
            ) : noData(220)}
          </div>

          {/* Intervention Frequency */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-sm font-bold text-gray-700 mb-3">Intervention Frequency</p>
            {interventions.filter(i => i.total_count > 0).length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={interventions.filter(i => i.total_count > 0).slice(0, 10)}
                  layout="vertical"
                  margin={{ top: 4, right: 30, bottom: 4, left: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="intervention_type" width={130} tick={{ fontSize: 9 }} />
                  <Tooltip />
                  <Bar dataKey="total_count" name="Count" fill="#EF4444" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : noData(220)}
          </div>

          {/* GEO Distribution donut */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-sm font-bold text-gray-700 mb-3">GEO Distribution</p>
            {geoDonut.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={geoDonut} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }: { name?: string; percent?: number }) =>
                      (percent ?? 0) > 0.05 ? `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%` : ''
                    }
                    labelLine={false}>
                    {geoDonut.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]!} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : noData(220)}
          </div>

          {/* Category Distribution donut */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-sm font-bold text-gray-700 mb-3">Category Distribution</p>
            {categoryDonut.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={categoryDonut} cx="50%" cy="50%" innerRadius={40} outerRadius={75}
                    dataKey="value"
                    label={({ name, percent }: { name?: string; percent?: number }) =>
                      (percent ?? 0) > 0.07 ? `${String(name ?? '').toUpperCase()} ${((percent ?? 0) * 100).toFixed(0)}%` : ''
                    }
                    labelLine={false}>
                    {categoryDonut.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]!} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : noData(220)}
          </div>

          {/* UDs Trend */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-sm font-bold text-gray-700 mb-3">UDs Trend</p>
            {udsTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={udsTrend} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 9 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="uds" name="UDs" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3, fill: '#F59E0B' }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : noData(220)}
          </div>
        </div>

        {/* Records table — all categories combined */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-800">Ops Feedback Records</span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">{records.length}</span>
            <div className="ml-2 flex gap-1.5">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">{demoRecs.length} Demo</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 font-medium">{recceRecs.length} Recce</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 font-medium">{brtRecs.length} BRT</span>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="bg-gray-50 hover:bg-gray-50">
                  {['Cat', 'Date', 'GEO', 'Demo Ref', 'Operator', 'Vehicle', 'Model', 'Safety', 'Comfort', 'Decisive', 'Smooth', 'UDs', 'SC'].map(h => (
                    <TableHead key={h} className="text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap py-2.5">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.length === 0
                  ? <TableRow><TableCell colSpan={13} className="text-center text-xs italic text-gray-400 py-8">No records — submit via Ops Feedback</TableCell></TableRow>
                  : records.map((r, i) => (
                    <TableRow key={r.id}
                      onClick={() => { setSelected(r); setDrawerOpen(true) }}
                      className={`cursor-pointer ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-blue-50/30 ${r.safety_critical ? 'border-l-2 border-l-red-400' : ''}`}
                    >
                      <TableCell className="py-2"><CategoryBadge cat={r.category} /></TableCell>
                      <TableCell className="py-2 text-xs font-mono text-gray-700 whitespace-nowrap">{String(r.demo_date ?? '').substring(0, 10)}</TableCell>
                      <TableCell className="py-2"><span className="text-xs font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">{r.geo}</span></TableCell>
                      <TableCell className="py-2 text-xs font-mono text-gray-600">{r.demo_ref ?? '—'}</TableCell>
                      <TableCell className="py-2 text-xs text-gray-700 max-w-[80px] truncate">{r.operator_name ?? '—'}</TableCell>
                      <TableCell className="py-2 text-xs text-gray-600">{r.vehicle_id ?? r.vehicle ?? '—'}</TableCell>
                      <TableCell className="py-2 text-xs text-gray-800 max-w-[80px] truncate"><span title={r.model_name ?? ''}>{sn(r.model_name)}</span></TableCell>
                      <TableCell className="py-2 text-xs font-bold text-red-600">{fmti(r.safety_score)}</TableCell>
                      <TableCell className="py-2 text-xs font-bold text-emerald-600">{fmti(r.comfort_score)}</TableCell>
                      <TableCell className="py-2 text-xs font-bold text-blue-600">{fmti(r.decisiveness_score)}</TableCell>
                      <TableCell className="py-2 text-xs font-bold text-purple-600">{fmti(r.smoothness_score)}</TableCell>
                      <TableCell className="py-2 text-xs font-bold text-amber-600">{r.number_of_uds ?? 0}</TableCell>
                      <TableCell className="py-2">{r.safety_critical && <span className="text-red-500 text-base leading-none">●</span>}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Model analytics table */}
        {allModels.length > 1 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-800">Model Analytics</span>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 hover:bg-gray-50">
                    {['Model', 'Runs', 'Avg Safety', 'Avg Comfort', 'Avg Decisive', 'Avg Aggress', 'Nbr Intervens'].map(h => (
                      <TableHead key={h} className="text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap py-2.5">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topModels.map((m, i) => (
                    <TableRow key={m.model_name} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <TableCell className="py-2 text-xs font-mono font-medium text-gray-800 max-w-[120px] truncate"><span title={m.model_name}>{sn(m.model_name)}</span></TableCell>
                      <TableCell className="py-2 text-xs font-bold text-gray-700">{m.run_count}</TableCell>
                      <TableCell className="py-2 text-xs font-bold text-red-600">{fmt1(m.avg_safety)}</TableCell>
                      <TableCell className="py-2 text-xs font-bold text-emerald-600">{fmt1(m.avg_comfort)}</TableCell>
                      <TableCell className="py-2 text-xs font-bold text-blue-600">{fmt1(m.avg_decisiveness)}</TableCell>
                      <TableCell className="py-2 text-xs font-bold text-amber-600">{fmt1(m.avg_aggressiveness)}</TableCell>
                      <TableCell className="py-2 text-xs font-bold text-purple-600">{m.total_interventions ?? 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

      </div>

      {drawerOpen && selected && <DetailDrawer record={selected} onClose={() => setDrawerOpen(false)} />}

      {wizardOpen && (
        <NewReportWizard
          onClose={() => setWizardOpen(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  )
}
