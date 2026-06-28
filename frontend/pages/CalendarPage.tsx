import { useState, useMemo, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../lib/shadcn/select'
import { Button } from '../lib/shadcn/button'
import { type DemoRequest, type GeoCode, type DemoStatus } from './data/sampleData'
import { useGetDemos } from '../hooks/backend/demos'
import DemoDetailDrawer from './ui/DemoDetailDrawer'
import GeoBadge from '../components/GeoBadge'
import StatusBadge from '../components/StatusBadge'

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const GEO_FLAGS: Record<string, string> = {
  UK: '🇬🇧', JP: '🇯🇵', US: '🇺🇸', DE: '🇩🇪', ST: '⚙️',
}

const TYPE_SHORT: Record<string, string> = {
  'VIP':               'VIP',
  'Media':             'MED',
  'External':          'EXT',
  'OEM Support':       'OEM',
  'Performance Check': 'PFM',
  'Friend & Family':   'F&F',
  'Conference':        'CON',
  'Candidate':         'CND',
}

function statusChipColor(status: DemoStatus): string {
  if (status === 'Reviewed') return '#10B981'
  if (status === 'Canceled') return '#EF4444'
  return '#F59E0B'
}

function chipText(demo: DemoRequest): string {
  const short = TYPE_SHORT[demo.type] ?? demo.type.slice(0, 3)
  const org = demo.organization.length > 11
    ? demo.organization.slice(0, 11) + '…'
    : demo.organization
  return `${demo.geo} | ${org} | ${short}`
}

// Module-level today snapshot
const _today = new Date()
const TODAY_Y = _today.getFullYear()
const TODAY_M = _today.getMonth()
const TODAY_D = _today.getDate()
const TODAY_STR = `${TODAY_Y}-${String(TODAY_M + 1).padStart(2, '0')}-${String(TODAY_D).padStart(2, '0')}`

type Timeframe = 'ALL' | 'TOMORROW' | 'THIS_WEEK' | 'NEXT_WEEK'

function getTimeframeBounds(tf: Timeframe): { from: string; to: string } | null {
  if (tf === 'ALL') return null
  const base = new Date(); base.setHours(0, 0, 0, 0)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)

  if (tf === 'TOMORROW') {
    const t = new Date(base); t.setDate(base.getDate() + 1)
    return { from: fmt(t), to: fmt(t) }
  }
  const day = base.getDay()
  const toMon = day === 0 ? -6 : 1 - day
  if (tf === 'THIS_WEEK') {
    const mon = new Date(base); mon.setDate(base.getDate() + toMon)
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
    return { from: fmt(mon), to: fmt(sun) }
  }
  if (tf === 'NEXT_WEEK') {
    const mon = new Date(base); mon.setDate(base.getDate() + toMon + 7)
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
    return { from: fmt(mon), to: fmt(sun) }
  }
  return null
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const [viewYear,   setViewYear]   = useState(TODAY_Y)
  const [viewMonth,  setViewMonth]  = useState(TODAY_M)   // 0-indexed
  const [selectedDay, setSelectedDay] = useState<number | null>(TODAY_D)
  const [geoFilter,    setGeoFilter]    = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [timeframe,    setTimeframe]    = useState<Timeframe>('ALL')
  const [drawerDemo, setDrawerDemo] = useState<DemoRequest | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [readinessOverrides, setReadinessOverrides] = useState<Record<string, string>>({})
  const [demos, setDemos] = useState<DemoRequest[]>([])

  const { data: dbDemos, loading, trigger: fetchDemos } = useGetDemos()
  useEffect(() => { void fetchDemos() }, [])
  useEffect(() => { if (dbDemos) setDemos(dbDemos as DemoRequest[]) }, [dbDemos])

  const viewMonthStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`

  // ── Filtered demos for current view ────────────────────────────────────────
  const filteredDemos = useMemo(() => {
    const tfBounds = getTimeframeBounds(timeframe)
    return demos.filter(d => {
      if (d.status === 'DELETED') return false
      // If timeframe is active, filter by date range (ignores month navigation)
      if (tfBounds) {
        if (d.demo_date < tfBounds.from || d.demo_date > tfBounds.to) return false
      } else {
        if (!d.demo_date.startsWith(viewMonthStr)) return false
      }
      if (geoFilter !== 'ALL' && d.geo !== geoFilter) return false
      if (statusFilter === 'Reviewed'    && d.status !== 'Reviewed') return false
      if (statusFilter === 'Needs Review' && d.status !== 'Needs Review' && d.status !== 'NEEDS REVIEW') return false
      if (statusFilter === 'Canceled'    && d.status !== 'Canceled') return false
      return true
    })
  }, [demos, viewMonthStr, geoFilter, statusFilter, timeframe])

  // Map demos by day number in current month
  const demosByDay = useMemo(() => {
    const map = new Map<number, DemoRequest[]>()
    for (const d of filteredDemos) {
      const dayPart = d.demo_date.split('-')[2]
      const day = dayPart ? parseInt(dayPart, 10) : 0
      if (day === 0) continue
      if (!map.has(day)) map.set(day, [])
      map.get(day)!.push(d)
    }
    return map
  }, [filteredDemos])

  // ── Calendar grid ───────────────────────────────────────────────────────────
  const firstOfMonth = new Date(viewYear, viewMonth, 1)
  const daysInMonth  = new Date(viewYear, viewMonth + 1, 0).getDate()
  const startOffset  = (firstOfMonth.getDay() + 6) % 7 // Mon = 0

  const cells: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  // ── Agenda: selected day + pending (Needs Review this month) ───────────────
  const selectedDayDemos = useMemo(() => {
    if (selectedDay === null) return []
    return (demosByDay.get(selectedDay) ?? [])
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
  }, [selectedDay, demosByDay])

  const pendingDemos = useMemo(() =>
    filteredDemos
      .filter(d => d.status === 'Needs Review' || d.status === 'NEEDS REVIEW')
      .sort((a, b) => a.demo_date.localeCompare(b.demo_date)),
  [filteredDemos])

  // ── Navigation ──────────────────────────────────────────────────────────────
  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
    setSelectedDay(null)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
    setSelectedDay(null)
  }
  function goToday() {
    setViewYear(TODAY_Y); setViewMonth(TODAY_M); setSelectedDay(TODAY_D)
  }

  if (loading && demos.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-gray-400 text-sm gap-2">
        <span className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-[#2563EB] rounded-full inline-block" />
        Loading demos…
      </div>
    )
  }

  function openDemo(demo: DemoRequest) {
    setDrawerDemo(demo); setDrawerOpen(true)
  }
  function handleMarkReady(id: string) {
    setReadinessOverrides(prev => ({
      ...prev, [id]: new Date().toISOString().split('T')[0] ?? '',
    }))
  }

  const isTodayCell = (day: number) =>
    `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` === TODAY_STR

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col bg-[#F8FAFC] overflow-hidden">

      {/* ── Sticky filter bar ── */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-5 py-3">
      <div className="flex items-end gap-2.5 flex-wrap">

        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">STATUS</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 bg-card text-sm h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="Reviewed">Approved</SelectItem>
              <SelectItem value="Needs Review">Needs Review</SelectItem>
              <SelectItem value="Canceled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">MONTH</span>
          <Select value={String(viewMonth)} onValueChange={v => {
            setViewMonth(parseInt(v, 10)); setSelectedDay(null); setTimeframe('ALL')
          }}>
            <SelectTrigger className="w-36 bg-card text-sm h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_NAMES.map((m, i) => (
                <SelectItem key={i} value={String(i)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">TIMEFRAME</span>
          <Select value={timeframe} onValueChange={v => setTimeframe(v as Timeframe)}>
            <SelectTrigger className="w-36 bg-card text-sm h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Time</SelectItem>
              <SelectItem value="TOMORROW">Tomorrow</SelectItem>
              <SelectItem value="THIS_WEEK">This Week</SelectItem>
              <SelectItem value="NEXT_WEEK">Next Week</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Geo toggles */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">GEO</span>
          <div className="flex items-center gap-1.5 h-9">
            <button
              onClick={() => setGeoFilter('ALL')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors ${
                geoFilter === 'ALL'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-card text-gray-600 border-border hover:border-gray-400'
              }`}
            >
              All
            </button>
            {(['UK', 'JP', 'US', 'DE', 'ST'] as const).map(geo => (
              <button
                key={geo}
                onClick={() => setGeoFilter(geoFilter === geo ? 'ALL' : geo)}
                className={`px-2 py-1 text-base rounded-lg border transition-all ${
                  geoFilter === geo
                    ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50'
                    : 'bg-card border-border hover:border-gray-400'
                }`}
                title={geo}
              >
                {GEO_FLAGS[geo]}
              </button>
            ))}
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={goToday} className="ml-auto h-9 self-end">
          Today
        </Button>
      </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-auto p-5 space-y-4">

      {/* Main layout */}
      <div className="flex gap-4" style={{ minHeight: 560 }}>

        {/* Calendar grid (70%) */}
        <div
          className="flex flex-col bg-card rounded-xl border border-border shadow-sm overflow-hidden"
          style={{ flex: '0 0 70%', minWidth: 0 }}
        >
          {/* Month nav header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <button
              onClick={prevMonth}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <span className="flex-1 text-center text-sm font-bold text-gray-800">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button
              onClick={nextMonth}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 bg-muted border-b border-border">
            {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
              <div key={d} className="text-center text-[11px] font-semibold text-gray-400 py-2">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="flex-1">
            {weeks.map((week, wi) => (
              <div
                key={wi}
                className="grid grid-cols-7 border-b border-gray-50 last:border-b-0"
              >
                {week.map((day, di) => {
                  if (!day) {
                    return (
                      <div
                        key={di}
                        className="min-h-[84px] bg-muted/40 border-r border-gray-50 last:border-r-0"
                      />
                    )
                  }
                  const demos = demosByDay.get(day) ?? []
                  const todayCell = isTodayCell(day)
                  const selected  = selectedDay === day

                  return (
                    <div
                      key={di}
                      onClick={() => setSelectedDay(day)}
                      className={[
                        'min-h-[84px] p-1.5 cursor-pointer transition-colors border-r border-gray-50 last:border-r-0',
                        'hover:bg-blue-50/40',
                        selected ? 'ring-2 ring-blue-400 ring-inset' : '',
                      ].join(' ')}
                    >
                      {/* Day number */}
                      <div className="mb-1">
                        <span className={[
                          'inline-flex w-5 h-5 items-center justify-center text-[11px] font-medium rounded-full',
                          todayCell ? 'bg-blue-600 text-white font-bold' : 'text-gray-600',
                        ].join(' ')}>
                          {day}
                        </span>
                      </div>

                      {/* Event chips */}
                      <div className="space-y-0.5">
                        {demos.slice(0, 3).map((demo, ci) => (
                          <div
                            key={ci}
                            className="text-[9px] leading-tight px-1 py-0.5 rounded-[3px] bg-muted truncate"
                            style={{ borderLeft: `3px solid ${statusChipColor(demo.status)}` }}
                          >
                            <span className="text-gray-600 font-medium">{chipText(demo)}</span>
                          </div>
                        ))}
                        {demos.length > 3 && (
                          <p className="text-[9px] text-gray-400 pl-1">+{demos.length - 3} more</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-5 px-4 py-2.5 border-t border-border bg-muted/50">
            {[
              { label: 'Approved',     color: '#10B981' },
              { label: 'Needs Review', color: '#F59E0B' },
              { label: 'Cancelled',    color: '#EF4444' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.color }} />
                {item.label}
              </div>
            ))}
            <span className="ml-auto text-xs text-gray-400">{filteredDemos.length} demos this month</span>
          </div>
        </div>

        {/* Agenda pane (30%) */}
        <div
          className="flex flex-col bg-card rounded-xl border border-border shadow-sm overflow-hidden"
          style={{ flex: '0 0 calc(30% - 16px)', minWidth: 220 }}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold text-gray-800">
              {selectedDay !== null
                ? `${MONTH_NAMES[viewMonth]} ${selectedDay}`
                : 'Select a day'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {selectedDayDemos.length} event{selectedDayDemos.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Event list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {selectedDay !== null && selectedDayDemos.length === 0 && (
              <p className="text-xs text-gray-400 text-center pt-6">No events this day</p>
            )}

            {selectedDayDemos.map(demo => {
              const effectiveReadiness = readinessOverrides[demo.id] ?? demo.readiness_date
              return (
                <div
                  key={demo.id}
                  onClick={() => openDemo(demo)}
                  className="cursor-pointer p-3 rounded-lg border border-border
                             hover:border-blue-200 hover:bg-blue-50/20 transition-all space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <span className="text-[10px] font-semibold uppercase tracking-wide
                                     px-1.5 py-0.5 rounded bg-purple-50 text-purple-600">
                      {demo.type}
                    </span>
                    {effectiveReadiness && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded
                                       bg-green-100 text-green-700">
                        READY
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Clock className="w-3 h-3 flex-shrink-0" />
                    {demo.start_time} – {demo.end_time}
                  </div>
                  <p className="text-sm font-semibold text-gray-800 leading-tight">
                    {demo.organization}
                  </p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <GeoBadge geo={demo.geo as GeoCode} />
                    <StatusBadge status={demo.status} />
                  </div>
                </div>
              )
            })}

            {/* Pending (Needs Review this month) */}
            {pendingDemos.length > 0 && (
              <div className="mt-3 pt-3 border-t border-amber-100">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-2">
                  Pending Review ({pendingDemos.length})
                </p>
                {pendingDemos.map(demo => (
                  <div
                    key={demo.id}
                    onClick={() => openDemo(demo)}
                    className="cursor-pointer p-2.5 rounded-lg border border-amber-100 bg-amber-50/40
                               hover:bg-amber-50 transition-all mb-1.5 space-y-1"
                  >
                    <p className="text-xs font-semibold text-gray-700 leading-tight">
                      {demo.organization}
                    </p>
                    <div className="flex items-center gap-1 text-[10px] text-gray-400">
                      <Clock className="w-2.5 h-2.5" />
                      {demo.demo_date} · {demo.start_time}
                    </div>
                    <GeoBadge geo={demo.geo as GeoCode} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail drawer */}
      <DemoDetailDrawer
        demo={drawerDemo}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        readinessOverrides={readinessOverrides}
        onMarkReady={handleMarkReady}
      />
      </div>
    </div>
  )
}
