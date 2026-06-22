import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../lib/shadcn/select'
import { Button } from '../../lib/shadcn/button'
import { DEMO_TYPE_CONFIGS } from './data/demoTypeConfig'
import { useGetDemos } from '../../hooks/backend/demos'
import { type DemoRequest, type DemoStatus, type GeoCode } from '../data/sampleData'
import GeoBadge from '../../components/GeoBadge'
import StatusBadge from '../../components/StatusBadge'

// ─── Calendar constants ───────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const _today = new Date()
const TODAY_Y = _today.getFullYear()
const TODAY_M = _today.getMonth()
const TODAY_D = _today.getDate()
const TODAY_STR = `${TODAY_Y}-${String(TODAY_M + 1).padStart(2, '0')}-${String(TODAY_D).padStart(2, '0')}`

const GEO_OPTIONS = ['ALL', 'UK', 'JP', 'US', 'DE'] as const
const TYPE_OPTIONS = [
  'ALL', 'VIP', 'Media', 'External', 'OEM Support',
  'Performance Check', 'Friend & Family', 'Conference', 'Candidate',
]

function statusChipColor(status: DemoStatus): string {
  if (status === 'Reviewed') return '#10B981'
  if (status === 'Canceled') return '#EF4444'
  return '#F59E0B'
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RequestHome() {
  const navigate = useNavigate()

  // ── Calendar state ──────────────────────────────────────────────────────────
  const [viewYear,    setViewYear]    = useState(TODAY_Y)
  const [viewMonth,   setViewMonth]   = useState(TODAY_M)
  const [selectedDay, setSelectedDay] = useState<number | null>(TODAY_D)
  const [geoFilter,   setGeoFilter]   = useState('ALL')
  const [typeFilter,  setTypeFilter]  = useState('ALL')
  const [demos,       setDemos]       = useState<DemoRequest[]>([])

  const { data: dbDemos, loading, trigger: fetchDemos } = useGetDemos()
  useEffect(() => { void fetchDemos() }, [])
  useEffect(() => { if (dbDemos) setDemos(dbDemos as DemoRequest[]) }, [dbDemos])

  const viewMonthStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`

  // ── Filtered + grouped by day ───────────────────────────────────────────────
  const filteredDemos = useMemo(() =>
    demos.filter(d => {
      if (d.status === 'DELETED') return false
      if (!d.demo_date.startsWith(viewMonthStr)) return false
      if (geoFilter !== 'ALL' && d.geo !== geoFilter) return false
      if (typeFilter !== 'ALL' && d.type !== typeFilter) return false
      return true
    }),
  [demos, viewMonthStr, geoFilter, typeFilter])

  const demosByDay = useMemo(() => {
    const map = new Map<number, DemoRequest[]>()
    for (const d of filteredDemos) {
      const day = parseInt(d.demo_date.split('-')[2] ?? '0', 10)
      if (!day) continue
      if (!map.has(day)) map.set(day, [])
      map.get(day)!.push(d)
    }
    return map
  }, [filteredDemos])

  const selectedDayDemos = useMemo(() =>
    selectedDay !== null
      ? (demosByDay.get(selectedDay) ?? []).sort((a, b) => a.start_time.localeCompare(b.start_time))
      : [],
  [selectedDay, demosByDay])

  // ── Calendar grid ───────────────────────────────────────────────────────────
  const firstOfMonth = new Date(viewYear, viewMonth, 1)
  const daysInMonth  = new Date(viewYear, viewMonth + 1, 0).getDate()
  const startOffset  = (firstOfMonth.getDay() + 6) % 7

  const cells: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  const isTodayCell = (day: number) =>
    `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` === TODAY_STR

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

  return (
    <div className="flex" style={{ minHeight: 'calc(100vh - 60px)' }}>

      {/* ── Left 35% — Request a New Demo ── */}
      <div
        className="border-r border-gray-100 p-5 bg-[#F8FAFC] overflow-y-auto flex flex-col gap-4"
        style={{ width: '35%', flexShrink: 0 }}
      >
        {/* Header */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <Plus className="w-4 h-4 text-white" />
          </div>
          <h2 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider">
            Request a New Demo
          </h2>
        </div>

        {/* Type cards — 2 columns */}
        <div className="grid grid-cols-2 gap-2.5">
          {DEMO_TYPE_CONFIGS.map(cfg => (
            <button
              key={cfg.slug}
              onClick={() => navigate(cfg.slug)}
              className="group text-left p-3.5 rounded-xl border transition-all duration-150
                         hover:shadow-md hover:-translate-y-0.5
                         focus:outline-none focus:ring-2 focus:ring-blue-400"
              style={{ background: cfg.bgColor, borderColor: cfg.accentColor + '55' }}
            >
              <p className="text-sm font-semibold text-[#0F172A] leading-tight mb-1">
                {cfg.label}
              </p>
              <p className="text-[11px] text-[#64748B] leading-snug line-clamp-2 mb-2.5">
                {cfg.description}
              </p>
              <div
                className="flex items-center gap-1 text-[11px] font-semibold"
                style={{ color: cfg.accentColor }}
              >
                Submit
                <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Right 65% — Monthly Calendar ── */}
      <div className="flex-1 p-5 bg-white flex flex-col gap-4 min-w-0">

        {/* Filters row */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Select value={geoFilter} onValueChange={setGeoFilter}>
            <SelectTrigger className="w-32 h-8 text-xs bg-white border-gray-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GEO_OPTIONS.map(g => (
                <SelectItem key={g} value={g} className="text-xs">
                  {g === 'ALL' ? 'All Geo' : g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-44 h-8 text-xs bg-white border-gray-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map(t => (
                <SelectItem key={t} value={t} className="text-xs">
                  {t === 'ALL' ? 'All Types' : t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline" size="sm"
            className="h-8 text-xs ml-auto"
            onClick={() => {
              setViewYear(TODAY_Y); setViewMonth(TODAY_M); setSelectedDay(TODAY_D)
            }}
          >
            Today
          </Button>
        </div>

        {/* Calendar card */}
        <div className="flex-1 flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

          {/* Month nav */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
            <button onClick={prevMonth} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronLeft className="w-4 h-4 text-gray-500" />
            </button>
            <span className="flex-1 text-center text-sm font-bold text-[#0F172A]">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button onClick={nextMonth} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronRight className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-100">
            {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
              <div key={d} className="text-center text-[11px] font-semibold text-[#94A3B8] py-2">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="flex-1">
            {loading && demos.length === 0 ? (
              <div className="flex items-center justify-center py-20 gap-2 text-sm text-gray-400">
                <span className="w-4 h-4 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
                Loading…
              </div>
            ) : (
              weeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 border-b border-gray-50 last:border-0">
                  {week.map((day, di) => {
                    if (!day) {
                      return (
                        <div
                          key={di}
                          className="min-h-[80px] bg-gray-50/40 border-r border-gray-50 last:border-0"
                        />
                      )
                    }
                    const dayDemos = demosByDay.get(day) ?? []
                    const todayCell = isTodayCell(day)
                    const selected  = selectedDay === day

                    return (
                      <div
                        key={di}
                        onClick={() => setSelectedDay(day)}
                        className={[
                          'min-h-[80px] p-1.5 cursor-pointer transition-colors border-r border-gray-50 last:border-0',
                          'hover:bg-blue-50/30',
                          selected ? 'ring-2 ring-blue-400 ring-inset bg-blue-50/20' : '',
                        ].join(' ')}
                      >
                        <div className="mb-1">
                          <span className={[
                            'inline-flex w-5 h-5 items-center justify-center text-[11px] rounded-full',
                            todayCell ? 'bg-blue-600 text-white font-bold' : 'text-[#64748B] font-medium',
                          ].join(' ')}>
                            {day}
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          {dayDemos.slice(0, 3).map((demo, ci) => (
                            <div
                              key={ci}
                              className="text-[9px] leading-tight px-1 py-0.5 rounded-[3px] bg-gray-50 truncate"
                              style={{ borderLeft: `3px solid ${statusChipColor(demo.status)}` }}
                            >
                              <span className="text-gray-600 font-medium">
                                {demo.geo} | {demo.organization.slice(0, 10)}{demo.organization.length > 10 ? '...' : ''}
                              </span>
                            </div>
                          ))}
                          {dayDemos.length > 3 && (
                            <p className="text-[9px] text-gray-400 pl-1">+{dayDemos.length - 3} more</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))
            )}
          </div>

          {/* Selected day agenda strip */}
          {selectedDay !== null && (
            <div className="border-t border-gray-100 bg-gray-50/50">
              <div className="px-4 py-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-[#0F172A]">
                  {MONTH_NAMES[viewMonth]} {selectedDay}
                </p>
                <span className="text-[11px] text-[#94A3B8]">
                  {selectedDayDemos.length} event{selectedDayDemos.length !== 1 ? 's' : ''}
                </span>
              </div>
              {selectedDayDemos.length === 0 ? (
                <p className="px-4 pb-3 text-xs text-[#94A3B8]">No demos scheduled</p>
              ) : (
                <div className="px-4 pb-3 flex flex-wrap gap-2">
                  {selectedDayDemos.map(demo => (
                    <div
                      key={demo.id}
                      className="flex items-center gap-2 px-2.5 py-1.5 bg-white rounded-lg border border-gray-100 shadow-sm"
                    >
                      <GeoBadge geo={demo.geo as GeoCode} />
                      <span className="text-xs font-medium text-[#0F172A] max-w-[120px] truncate">
                        {demo.organization}
                      </span>
                      <StatusBadge status={demo.status} />
                      <span className="text-[11px] text-[#94A3B8]">{demo.start_time}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center gap-5 px-4 py-2 border-t border-gray-100 bg-white">
            {[
              { label: 'Approved',     color: '#10B981' },
              { label: 'Needs Review', color: '#F59E0B' },
              { label: 'Cancelled',    color: '#EF4444' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-1.5 text-xs text-[#64748B]">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                {item.label}
              </div>
            ))}
            <span className="ml-auto text-xs text-[#94A3B8]">
              {filteredDemos.length} demo{filteredDemos.length !== 1 ? 's' : ''} this month
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
