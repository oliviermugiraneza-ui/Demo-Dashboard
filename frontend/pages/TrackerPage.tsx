import { useState, useMemo, useEffect } from 'react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../lib/shadcn/select'
import { type DemoRequest, type GeoCode } from './data/sampleData'
import { useGetTrackerDemos } from '../hooks/backend/demos'
import DemoDetailDrawer from './ui/DemoDetailDrawer'
import TrackerTables from './ui/TrackerTables'
import { type DrawerContext } from './ui/cockpitActions'
import { DEMO_TYPES } from '../lib/constants/demoTypes'

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = [
  { v: 'ALL', l: 'All Months' }, { v: '01', l: 'Jan' }, { v: '02', l: 'Feb' },
  { v: '03', l: 'Mar' },         { v: '04', l: 'Apr' }, { v: '05', l: 'May' },
  { v: '06', l: 'Jun' },         { v: '07', l: 'Jul' }, { v: '08', l: 'Aug' },
  { v: '09', l: 'Sep' },         { v: '10', l: 'Oct' }, { v: '11', l: 'Nov' },
  { v: '12', l: 'Dec' },
]

const GEOS: string[] = ['ALL', 'UK', 'JP', 'US', 'DE']

const TYPES: string[] = ['ALL', ...DEMO_TYPES]

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TrackerPage() {
  const [month,     setMonth]     = useState('ALL')
  const [geo,       setGeo]       = useState('ALL')
  const [type,      setType]      = useState('ALL')
  const [dateFrom,  setDateFrom]  = useState('')
  const [dateTo,    setDateTo]    = useState('')

  const [selectedDemo,       setSelectedDemo]       = useState<DemoRequest | null>(null)
  const [drawerContext,      setDrawerContext]       = useState<DrawerContext>('default')
  const [drawerOpen,         setDrawerOpen]         = useState(false)
  const [readinessOverrides, setReadinessOverrides] = useState<Record<string, string>>({})
  const [demos,              setDemos]              = useState<DemoRequest[]>([])

  const { data: dbDemos, loading, trigger: fetchDemos } = useGetTrackerDemos()
  useEffect(() => { void fetchDemos() }, [])
  useEffect(() => { if (dbDemos) setDemos(dbDemos as DemoRequest[]) }, [dbDemos])

  // ── Filtered set ──────────────────────────────────────────────────────────
  // Server already excludes DELETED and NEED REVIEW — filter by month/geo/type/date only.
  const filtered = useMemo(() =>
    demos.filter(d => {
      if (month !== 'ALL') {
        const parts = d.demo_date.split('-')
        if (parts[1] !== month) return false
      }
      if (geo !== 'ALL' && d.geo !== (geo as GeoCode)) return false
      if (type !== 'ALL' && d.type !== type) return false
      if (dateFrom && d.demo_date < dateFrom) return false
      if (dateTo   && d.demo_date > dateTo)   return false
      return true
    }),
    [demos, month, geo, type, dateFrom, dateTo],
  )

  // ── Handlers ──────────────────────────────────────────────────────────────
  const openDrawer = (demo: DemoRequest, ctx: DrawerContext) => {
    setSelectedDemo(demo)
    setDrawerContext(ctx)
    setDrawerOpen(true)
  }

  const handleMarkReady = (id: string) => {
    const today = new Date()
    const d = today.getDate().toString().padStart(2, '0')
    const m = (today.getMonth() + 1).toString().padStart(2, '0')
    setReadinessOverrides(prev => ({ ...prev, [id]: `${today.getFullYear()}-${m}-${d}` }))
  }

  const filtersActive = month !== 'ALL' || geo !== 'ALL' || type !== 'ALL' || dateFrom !== '' || dateTo !== ''

  if (loading && demos.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-gray-400 text-sm gap-2">
        <span className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-[#2563EB] rounded-full inline-block" />
        Loading demos…
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-[#F8FAFC] overflow-hidden">

      {/* ── Sticky filter bar ── */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-6 py-3 flex flex-wrap items-end gap-3">

        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">MONTH</span>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-32 h-8 text-sm bg-card border-border">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map(m => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">GEO</span>
          <Select value={geo} onValueChange={setGeo}>
            <SelectTrigger className="w-24 h-8 text-sm bg-card border-border">
              <SelectValue placeholder="Geo" />
            </SelectTrigger>
            <SelectContent>
              {GEOS.map(g => <SelectItem key={g} value={g}>{g === 'ALL' ? 'All Geos' : g}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">TYPE</span>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-40 h-8 text-sm bg-card border-border">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              {TYPES.map(t => <SelectItem key={t} value={t}>{t === 'ALL' ? 'All Types' : t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Date range */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">DATE RANGE</span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 whitespace-nowrap">From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="h-8 px-2 text-sm rounded-md border border-gray-200 bg-white focus:outline-none focus:border-blue-400 text-gray-700"
            />
            <span className="text-xs text-gray-400 whitespace-nowrap">To</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="h-8 px-2 text-sm rounded-md border border-gray-200 bg-white focus:outline-none focus:border-blue-400 text-gray-700"
            />
          </div>
        </div>

        {filtersActive && (
          <button
            onClick={() => { setMonth('ALL'); setGeo('ALL'); setType('ALL'); setDateFrom(''); setDateTo('') }}
            className="text-xs text-gray-400 hover:text-gray-700 underline underline-offset-2 pb-1"
          >
            Clear
          </button>
        )}

        <span className="text-xs text-gray-400 ml-auto whitespace-nowrap pb-1">
          {filtered.length} demo{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Tables ── */}
      <div className="flex-1 overflow-auto p-6 space-y-5">
        <TrackerTables
          demos={filtered}
          readinessOverrides={readinessOverrides}
          onSelectDemo={openDrawer}
        />
      </div>

      {/* ── Detail Drawer — read-only for completed/cancelled ── */}
      <DemoDetailDrawer
        demo={selectedDemo}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        readinessOverrides={readinessOverrides}
        context={drawerContext}
        onMarkReady={drawerContext === 'default' ? handleMarkReady : undefined}
      />
    </div>
  )
}
