import { useState, useMemo, useEffect } from 'react'
import { Search } from 'lucide-react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../lib/shadcn/select'
import { Input } from '../lib/shadcn/input'
import { type DemoRequest, type GeoCode } from './data/sampleData'
import { useGetDemos } from '../hooks/backend/demos'
import DemoDetailDrawer from './ui/DemoDetailDrawer'
import TrackerTables from './ui/TrackerTables'

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = [
  { v: 'ALL', l: 'All Months' }, { v: '01', l: 'January' }, { v: '02', l: 'February' },
  { v: '03', l: 'March' },       { v: '04', l: 'April' },   { v: '05', l: 'May' },
  { v: '06', l: 'June' },        { v: '07', l: 'July' },    { v: '08', l: 'August' },
  { v: '09', l: 'September' },   { v: '10', l: 'October' }, { v: '11', l: 'November' },
  { v: '12', l: 'December' },
]

const GEOS: string[] = ['ALL', 'UK', 'JP', 'US', 'DE', 'ST']

const TYPES: string[] = [
  'ALL', 'VIP', 'Media', 'External', 'OEM Support',
  'Performance Check', 'Friend & Family', 'Conference', 'Candidate',
]

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TrackerPage() {
  const [month,  setMonth]  = useState('ALL')
  const [geo,    setGeo]    = useState('ALL')
  const [type,   setType]   = useState('ALL')
  const [search, setSearch] = useState('')
  const [selectedDemo,       setSelectedDemo]       = useState<DemoRequest | null>(null)
  const [drawerOpen,         setDrawerOpen]         = useState(false)
  const [readinessOverrides, setReadinessOverrides] = useState<Record<string, string>>({})
  const [demos,              setDemos]              = useState<DemoRequest[]>([])

  const { data: dbDemos, loading, trigger: fetchDemos } = useGetDemos()
  useEffect(() => { void fetchDemos() }, [])
  useEffect(() => { if (dbDemos) setDemos(dbDemos as DemoRequest[]) }, [dbDemos])

  // ── Filtered set ──────────────────────────────────────────────────────────
  const filtered = useMemo(() =>
    demos.filter(d => {
      if (d.status === 'DELETED') return false
      if (month !== 'ALL') {
        const parts = d.demo_date.split('-')
        if (parts[1] !== month) return false
      }
      if (geo !== 'ALL' && d.geo !== (geo as GeoCode)) return false
      if (type !== 'ALL' && d.type !== type) return false
      if (search.trim() && !d.organization.toLowerCase().includes(search.toLowerCase())) return false
      return true
    }),
    [demos, month, geo, type, search],
  )

  // ── Handlers ──────────────────────────────────────────────────────────────
  const openDrawer = (demo: DemoRequest) => {
    setSelectedDemo(demo)
    setDrawerOpen(true)
  }

  const handleMarkReady = (id: string) => {
    const today = new Date()
    const d = today.getDate().toString().padStart(2, '0')
    const m = (today.getMonth() + 1).toString().padStart(2, '0')
    setReadinessOverrides(prev => ({ ...prev, [id]: `${today.getFullYear()}-${m}-${d}` }))
  }

  const filterSelect = 'h-8 text-sm bg-white border-gray-200'

  if (loading && demos.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-gray-400 text-sm gap-2">
        <span className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-[#2563EB] rounded-full inline-block" />
        Loading demos…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6 space-y-5">

      {/* ── Filter Bar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className={`w-36 ${filterSelect}`}>
            <SelectValue placeholder="Month" />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map(m => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={geo} onValueChange={setGeo}>
          <SelectTrigger className={`w-28 ${filterSelect}`}>
            <SelectValue placeholder="Geo" />
          </SelectTrigger>
          <SelectContent>
            {GEOS.map(g => <SelectItem key={g} value={g}>{g === 'ALL' ? 'All Geos' : g}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={type} onValueChange={setType}>
          <SelectTrigger className={`w-44 ${filterSelect}`}>
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            {TYPES.map(t => <SelectItem key={t} value={t}>{t === 'ALL' ? 'All Types' : t}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <Input
            placeholder="Search organization…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 text-sm pl-8 bg-white border-gray-200"
          />
        </div>

        <span className="text-xs text-gray-400 ml-auto">
          {filtered.length} demo{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Readiness · Completed · Cancelled tables ── */}
      <TrackerTables
        demos={filtered}
        readinessOverrides={readinessOverrides}
        onSelectDemo={openDrawer}
      />

      {/* ── Detail Drawer ── */}
      <DemoDetailDrawer
        demo={selectedDemo}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        readinessOverrides={readinessOverrides}
        onMarkReady={handleMarkReady}
      />
    </div>
  )
}
