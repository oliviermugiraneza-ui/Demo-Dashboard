import { useState, useMemo, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../lib/shadcn/select'
import { Button } from '../lib/shadcn/button'
import { type DemoRequest, type GeoCode } from './data/sampleData'
import { useGetCalendarDemos } from '../hooks/backend/demos'
import DemoDetailDrawer from './ui/DemoDetailDrawer'
import GeoBadge from '../components/GeoBadge'
import StatusBadge from '../components/StatusBadge'

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const MONTH_ABBR = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec',
]
const GEO_FLAGS: Record<string, string> = {
  UK: '🇬🇧', JP: '🇯🇵', US: '🇺🇸', DE: '🇩🇪',
}

const GEO_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  UK: { border: '#3B82F6', bg: 'rgba(59,130,246,0.08)',  text: '#1e3a8a' },
  US: { border: '#10B981', bg: 'rgba(16,185,129,0.08)',  text: '#065f46' },
  JP: { border: '#EF4444', bg: 'rgba(239,68,68,0.08)',   text: '#991b1b' },
  DE: { border: '#F59E0B', bg: 'rgba(245,158,11,0.08)',  text: '#92400e' },
}
const GEO_FALLBACK = { border: '#94A3B8', bg: 'rgba(148,163,184,0.08)', text: '#64748b' }
const DAY_ABBR = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const HOUR_H   = 64   // px per hour in week view

const _today  = new Date()
const TODAY_Y = _today.getFullYear()
const TODAY_M = _today.getMonth()
const TODAY_D = _today.getDate()
const TODAY_STR = toISO(TODAY_Y, TODAY_M, TODAY_D)

type CalView  = 'month' | 'week'
type Timeframe = 'ALL' | 'TOMORROW' | 'THIS_WEEK' | 'NEXT_WEEK'

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function toISO(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
}

function getMondayOf(d: Date): Date {
  const date = new Date(d)
  date.setHours(0, 0, 0, 0)
  const day = date.getDay()
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1))
  return date
}

function getWeekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function formatWeekRange(monday: Date): string {
  const sun = new Date(monday); sun.setDate(monday.getDate() + 6)
  const mStr = monday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const sStr = sun.toLocaleDateString('en-GB',   { day: 'numeric', month: 'short', year: 'numeric' })
  return `${mStr} – ${sStr}`
}

function parseMinutes(t: string): number {
  const [h = '0', m = '0'] = t.split(':')
  return parseInt(h, 10) * 60 + parseInt(m, 10)
}

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

// ─── GEO colour helper ────────────────────────────────────────────────────────

function geoColor(geo: string) { return GEO_COLORS[geo] ?? GEO_FALLBACK }


// ─── Event overlap layout ─────────────────────────────────────────────────────

interface EventLayout { col: number; maxCols: number }

function layoutEvents(events: DemoRequest[]): Map<string, EventLayout> {
  const sorted = [...events].sort((a, b) => a.start_time.localeCompare(b.start_time))
  const colEndMin: number[] = []
  const colOf = new Map<string, number>()

  for (const evt of sorted) {
    const startMin = parseMinutes(evt.start_time)
    let col = colEndMin.findIndex(end => end <= startMin)
    if (col === -1) col = colEndMin.length
    colEndMin[col] = Math.max(parseMinutes(evt.end_time), startMin + 15)
    colOf.set(evt.id, col)
  }

  const result = new Map<string, EventLayout>()
  for (const evt of sorted) {
    const myCol   = colOf.get(evt.id)!
    const myStart = parseMinutes(evt.start_time)
    const myEnd   = parseMinutes(evt.end_time)
    let maxCol = myCol
    for (const other of sorted) {
      if (other.id === evt.id) continue
      const os = parseMinutes(other.start_time)
      const oe = parseMinutes(other.end_time)
      if (os < myEnd && oe > myStart) maxCol = Math.max(maxCol, colOf.get(other.id)!)
    }
    result.set(evt.id, { col: myCol, maxCols: maxCol + 1 })
  }
  return result
}

// ─── Week event block ─────────────────────────────────────────────────────────

function WeekEventBlock({
  demo, top, height, colIdx, totalCols, onClick,
}: {
  demo: DemoRequest
  top: number; height: number; colIdx: number; totalCols: number
  onClick: () => void
}) {
  const [hover, setHover] = useState(false)
  const geoC   = geoColor(demo.geo)
  const border = geoC.border
  const bg     = geoC.bg
  const tc     = geoC.text
  const colW   = `${100 / totalCols}%`
  const colL   = `${(colIdx / totalCols) * 100}%`

  return (
    <div
      className="absolute z-10 pr-0.5 pl-0.5 group"
      style={{ top: `${top}px`, height: `${height}px`, left: colL, width: colW }}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        className="h-full rounded-md overflow-hidden cursor-pointer transition-all duration-100"
        style={{
          backgroundColor: bg,
          borderLeft: `3px solid ${border}`,
          boxShadow: hover ? `0 2px 8px rgba(0,0,0,0.12)` : 'none',
          transform: hover ? 'scale(1.01)' : 'scale(1)',
        }}
      >
        <div className="p-1 h-full flex flex-col justify-start overflow-hidden">
          {height >= 24 && (
            <p className="text-[9px] font-bold leading-tight truncate" style={{ color: tc }}>
              {demo.demo_ref || demo.organization}
            </p>
          )}
          {height >= 40 && (
            <p className="text-[9px] leading-tight truncate opacity-75" style={{ color: tc }}>
              {demo.type}
            </p>
          )}
          {height >= 54 && (
            <p className="text-[9px] leading-tight opacity-60" style={{ color: tc }}>
              {demo.start_time}–{demo.end_time}
            </p>
          )}
          {height < 24 && (
            <p className="text-[8px] font-semibold leading-none truncate" style={{ color: tc }}>
              {demo.start_time} {demo.organization}
            </p>
          )}
        </div>
      </div>

      {/* Tooltip — appears below the event block */}
      {hover && (
        <div
          className="absolute left-0 z-50 mt-1 min-w-max max-w-[200px] bg-gray-900 text-white rounded-lg shadow-xl pointer-events-none"
          style={{ top: `${height + 2}px`, fontSize: '11px', padding: '8px 10px', lineHeight: 1.5 }}
        >
          <p className="font-semibold">{demo.organization}</p>
          <p className="text-gray-300">{demo.type} · {demo.geo}</p>
          <p className="text-gray-400">{demo.start_time}–{demo.end_time}</p>
          {demo.demo_ref && (
            <p className="text-gray-500 font-mono text-[9px]">{demo.demo_ref}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Week view ────────────────────────────────────────────────────────────────

function WeekView({
  weekDemos, weekDays, selectedDate, nowDate,
  onDayClick, onEventClick,
}: {
  weekDemos: DemoRequest[]
  weekDays:  Date[]
  selectedDate: string | null
  nowDate: Date
  onDayClick:  (iso: string) => void
  onEventClick:(demo: DemoRequest, iso: string) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Scroll to 08:00 on mount
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 8 * HOUR_H
  }, [])

  const demosByDay = useMemo(() => {
    const map = new Map<string, DemoRequest[]>()
    for (const d of weekDemos) {
      if (!map.has(d.demo_date)) map.set(d.demo_date, [])
      map.get(d.demo_date)!.push(d)
    }
    return map
  }, [weekDemos])

  const nowISODate = nowDate.toISOString().slice(0, 10)
  const nowTop     = (nowDate.getHours() + nowDate.getMinutes() / 60) * HOUR_H

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Fixed day-header row ── */}
      <div className="flex-shrink-0 flex border-b border-gray-100 bg-white">
        {/* Gutter spacer */}
        <div className="w-14 flex-shrink-0 border-r border-gray-100" />

        {weekDays.map((day, i) => {
          const iso   = day.toISOString().slice(0, 10)
          const isNow = iso === nowISODate
          const isSel = iso === selectedDate
          const count = (demosByDay.get(iso) ?? []).length
          return (
            <button key={i} type="button"
              onClick={() => onDayClick(iso)}
              className={`flex-1 flex flex-col items-center py-2.5 transition-colors border-r border-gray-100 last:border-r-0
                ${isNow ? 'bg-blue-50/60' : ''} ${isSel && !isNow ? 'bg-gray-50' : ''} hover:bg-gray-50`}
            >
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${isNow ? 'text-blue-600' : 'text-gray-400'}`}>
                {DAY_ABBR[i]}
              </span>
              <span className={`mt-0.5 w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold transition-colors
                ${isNow ? 'bg-blue-600 text-white' : isSel ? 'bg-gray-200 text-gray-800' : 'text-gray-700'}`}>
                {day.getDate()}
              </span>
              {count > 0 && (
                <span className={`mt-0.5 text-[9px] font-medium ${isNow ? 'text-blue-500' : 'text-gray-400'}`}>
                  {count} event{count !== 1 ? 's' : ''}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Scrollable time grid ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="flex" style={{ height: `${24 * HOUR_H}px` }}>

          {/* Time gutter */}
          <div className="w-14 flex-shrink-0 relative border-r border-gray-100 bg-white">
            {Array.from({ length: 24 }, (_, h) => (
              <div
                key={h}
                className="absolute w-full flex items-start justify-end pr-2"
                style={{ top: `${h * HOUR_H}px`, height: `${HOUR_H}px` }}
              >
                {h > 0 && (
                  <span className="text-[10px] text-gray-400 leading-none" style={{ marginTop: '-6px' }}>
                    {String(h).padStart(2,'0')}:00
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Day columns */}
          <div className="flex-1 flex">
            {weekDays.map((day, dayIdx) => {
              const iso      = day.toISOString().slice(0, 10)
              const isNow    = iso === nowISODate
              const dayEvts  = demosByDay.get(iso) ?? []
              const layouts  = layoutEvents(dayEvts)

              return (
                <div
                  key={dayIdx}
                  className="flex-1 relative border-r border-gray-100 last:border-r-0"
                  style={{ backgroundColor: isNow ? 'rgba(239,246,255,0.5)' : undefined }}
                >
                  {/* Hour lines */}
                  {Array.from({ length: 24 }, (_, h) => (
                    <div
                      key={h}
                      className="absolute inset-x-0 border-t border-gray-100"
                      style={{ top: `${h * HOUR_H}px` }}
                    />
                  ))}
                  {/* Half-hour lines */}
                  {Array.from({ length: 24 }, (_, h) => (
                    <div
                      key={h}
                      className="absolute inset-x-0 border-t border-gray-50"
                      style={{ top: `${h * HOUR_H + HOUR_H / 2}px` }}
                    />
                  ))}

                  {/* Current-time indicator */}
                  {isNow && (
                    <div
                      className="absolute inset-x-0 z-20 flex items-center pointer-events-none"
                      style={{ top: `${nowTop}px` }}
                    >
                      <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 -ml-1" />
                      <div className="flex-1 border-t-2 border-blue-400" />
                    </div>
                  )}

                  {/* Events */}
                  {dayEvts.map(demo => {
                    const layout   = layouts.get(demo.id)!
                    const startMin = parseMinutes(demo.start_time)
                    const endMin   = Math.max(parseMinutes(demo.end_time), startMin + 15)
                    const top      = (startMin / 60) * HOUR_H
                    const height   = Math.max(((endMin - startMin) / 60) * HOUR_H, 18)

                    return (
                      <WeekEventBlock
                        key={demo.id}
                        demo={demo}
                        top={top}
                        height={height}
                        colIdx={layout.col}
                        totalCols={layout.maxCols}
                        onClick={() => onEventClick(demo, iso)}
                      />
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const [calView,      setCalView]      = useState<CalView>('month')
  const [viewYear,     setViewYear]     = useState(TODAY_Y)
  const [viewMonth,    setViewMonth]    = useState(TODAY_M)
  const [weekStart,    setWeekStart]    = useState(() => getMondayOf(new Date()))
  const [selectedDate, setSelectedDate] = useState<string | null>(TODAY_STR)
  const [geoFilter,    setGeoFilter]    = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [timeframe,    setTimeframe]    = useState<Timeframe>('ALL')
  const [drawerDemo,   setDrawerDemo]   = useState<DemoRequest | null>(null)
  const [drawerOpen,   setDrawerOpen]   = useState(false)
  const [readinessOverrides, setReadinessOverrides] = useState<Record<string, string>>({})
  const [demos, setDemos] = useState<DemoRequest[]>([])
  const [nowDate, setNowDate] = useState(() => new Date())

  const { data: dbDemos, loading, trigger: fetchDemos } = useGetCalendarDemos()
  useEffect(() => { void fetchDemos() }, [])
  useEffect(() => { if (dbDemos) setDemos(dbDemos as DemoRequest[]) }, [dbDemos])

  // Update current-time every minute
  useEffect(() => {
    const id = setInterval(() => setNowDate(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  // Week-follows-month: when month changes in week view, keep the same day-of-month position
  useEffect(() => {
    if (calView !== 'week') return
    const daysInNewMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const clampedDay = Math.min(weekStart.getDate(), daysInNewMonth)
    setWeekStart(getMondayOf(new Date(viewYear, viewMonth, clampedDay)))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMonth, viewYear])

  const viewMonthStr = `${viewYear}-${String(viewMonth + 1).padStart(2,'0')}`

  // ── Month-view filtered demos ─────────────────────────────────────────────

  const filteredDemos = useMemo(() => {
    const tfBounds = getTimeframeBounds(timeframe)
    return demos.filter(d => {
      if (d.status === 'DELETED') return false
      if (tfBounds) {
        if (d.demo_date < tfBounds.from || d.demo_date > tfBounds.to) return false
      } else {
        if (!d.demo_date.startsWith(viewMonthStr)) return false
      }
      if (geoFilter !== 'ALL' && d.geo !== geoFilter) return false
      if (statusFilter === 'APPROVED'    && d.status !== 'APPROVED')    return false
      if (statusFilter === 'NEED REVIEW' && d.status !== 'NEED REVIEW') return false
      if (statusFilter === 'CANCELED'    && d.status !== 'CANCELED')    return false
      return true
    })
  }, [demos, viewMonthStr, geoFilter, statusFilter, timeframe])

  const demosByDay = useMemo(() => {
    const map = new Map<number, DemoRequest[]>()
    for (const d of filteredDemos) {
      const day = parseInt(d.demo_date.split('-')[2] ?? '0', 10)
      if (!day) continue
      if (!map.has(day)) map.set(day, [])
      map.get(day)!.push(d)
    }
    if (geoFilter !== 'ALL') {
      for (const ds of map.values()) ds.sort((a, b) => a.start_time.localeCompare(b.start_time))
    }
    return map
  }, [filteredDemos, geoFilter])

  // ── Week-view filtered demos ──────────────────────────────────────────────

  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart])

  const weekDemos = useMemo(() => {
    const from = weekDays[0]!.toISOString().slice(0, 10)
    const to   = weekDays[6]!.toISOString().slice(0, 10)
    return demos.filter(d => {
      if (d.status === 'DELETED') return false
      if (d.demo_date < from || d.demo_date > to) return false
      if (geoFilter !== 'ALL' && d.geo !== geoFilter) return false
      if (statusFilter === 'APPROVED'    && d.status !== 'APPROVED')    return false
      if (statusFilter === 'NEED REVIEW' && d.status !== 'NEED REVIEW') return false
      if (statusFilter === 'CANCELED'    && d.status !== 'CANCELED')    return false
      return true
    })
  }, [demos, weekDays, geoFilter, statusFilter])

  // ── Agenda panel ──────────────────────────────────────────────────────────

  const selectedDayDemos = useMemo(() => {
    if (!selectedDate) return []
    return demos.filter(d => {
      if (d.status === 'DELETED') return false
      if (d.demo_date !== selectedDate) return false
      if (geoFilter !== 'ALL' && d.geo !== geoFilter) return false
      if (statusFilter === 'APPROVED'    && d.status !== 'APPROVED')    return false
      if (statusFilter === 'NEED REVIEW' && d.status !== 'NEED REVIEW') return false
      if (statusFilter === 'CANCELED'    && d.status !== 'CANCELED')    return false
      return true
    }).sort((a, b) => a.start_time.localeCompare(b.start_time))
  }, [selectedDate, demos, geoFilter, statusFilter])

  const pendingDemos = useMemo(() => {
    const pool = calView === 'week' ? weekDemos : filteredDemos
    return pool
      .filter(d => d.status === 'NEED REVIEW')
      .sort((a, b) => a.demo_date.localeCompare(b.demo_date))
  }, [calView, weekDemos, filteredDemos])

  // ── Calendar grid build ────────────────────────────────────────────────────

  const firstOfMonth = new Date(viewYear, viewMonth, 1)
  const daysInMonth  = new Date(viewYear, viewMonth + 1, 0).getDate()
  const startOffset  = (firstOfMonth.getDay() + 6) % 7
  const cells: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  // ── Navigation ────────────────────────────────────────────────────────────

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
    setSelectedDate(null)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
    setSelectedDate(null)
  }
  function prevWeek() {
    setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7); return d })
    setSelectedDate(null)
  }
  function nextWeek() {
    setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7); return d })
    setSelectedDate(null)
  }
  function goToday() {
    setViewYear(TODAY_Y); setViewMonth(TODAY_M)
    setWeekStart(getMondayOf(new Date()))
    setSelectedDate(TODAY_STR)
    setTimeframe('ALL')
  }

  function openDemo(demo: DemoRequest) { setDrawerDemo(demo); setDrawerOpen(true) }
  function handleMarkReady(id: string) {
    setReadinessOverrides(prev => ({ ...prev, [id]: new Date().toISOString().split('T')[0] ?? '' }))
  }

  const isTodayCell = (day: number) => toISO(viewYear, viewMonth, day) === TODAY_STR

  const agendaTitle = selectedDate
    ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : 'Select a day'

  if (loading && demos.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-gray-400 text-sm gap-2">
        <span className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-[#2563EB] rounded-full inline-block" />
        Loading demos…
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col bg-[#F8FAFC] overflow-hidden">

      {/* ── Filter bar ── */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-5 py-3">
        <div className="flex items-end gap-2.5 flex-wrap">

          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">STATUS</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36 bg-card text-sm h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="APPROVED">APPROVED</SelectItem>
                <SelectItem value="NEED REVIEW">NEED REVIEW</SelectItem>
                <SelectItem value="CANCELED">CANCELED</SelectItem>
                <SelectItem value="COMPLETED">COMPLETED</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">MONTH</span>
            <Select value={String(viewMonth)} onValueChange={v => {
              setViewMonth(parseInt(v, 10)); setSelectedDate(null); setTimeframe('ALL')
            }}>
              <SelectTrigger className="w-36 bg-card text-sm h-9">
                {MONTH_ABBR[viewMonth] ?? 'Month'}
              </SelectTrigger>
              <SelectContent>
                {MONTH_ABBR.map((m, i) => (
                  <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">TIMEFRAME</span>
            <Select value={timeframe} onValueChange={v => setTimeframe(v as Timeframe)}>
              <SelectTrigger className="w-36 bg-card text-sm h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Time</SelectItem>
                <SelectItem value="TOMORROW">Tomorrow</SelectItem>
                <SelectItem value="THIS_WEEK">This Week</SelectItem>
                <SelectItem value="NEXT_WEEK">Next Week</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* GEO toggles — ST (settings) removed */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">GEO</span>
            <div className="flex items-center gap-1.5 h-9">
              <button onClick={() => setGeoFilter('ALL')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors ${
                  geoFilter === 'ALL' ? 'bg-blue-600 text-white border-blue-600' : 'bg-card text-gray-600 border-border hover:border-gray-400'
                }`}>All</button>
              {(['UK','JP','US','DE'] as const).map(geo => (
                <button key={geo} onClick={() => setGeoFilter(geoFilter === geo ? 'ALL' : geo)}
                  className={`px-2 py-1 text-base rounded-lg border transition-all ${
                    geoFilter === geo ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50' : 'bg-card border-border hover:border-gray-400'
                  }`} title={geo}>
                  {GEO_FLAGS[geo]}
                </button>
              ))}
            </div>
          </div>

          {/* View toggle */}
          <div className="flex flex-col gap-1 ml-auto">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">VIEW</span>
            <div className="flex h-9 rounded-lg border border-gray-200 overflow-hidden bg-white">
              {(['month','week'] as CalView[]).map(v => (
                <button key={v} onClick={() => setCalView(v)}
                  className={`px-3.5 text-xs font-semibold transition-colors capitalize ${
                    calView === v ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'
                  }`}>{v}</button>
              ))}
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={goToday} className="h-9 self-end">Today</Button>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 overflow-hidden flex flex-col p-5 gap-4 min-h-0">
        <div className="flex gap-4 flex-1 min-h-0">

          {/* ── Calendar area (70%) ── */}
          <div
            className="flex flex-col bg-card rounded-xl border border-border shadow-sm overflow-hidden"
            style={{ flex: '0 0 70%', minWidth: 0 }}
          >
            {/* Navigation header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border flex-shrink-0">
              <button onClick={calView === 'week' ? prevWeek : prevMonth}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              <span className="flex-1 text-center text-sm font-bold text-gray-800">
                {calView === 'week'
                  ? formatWeekRange(weekStart)
                  : `${MONTH_NAMES[viewMonth]} ${viewYear}`}
              </span>
              <button onClick={calView === 'week' ? nextWeek : nextMonth}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            {/* ── MONTH VIEW ── */}
            {calView === 'month' && (
              <>
                {/* Weekday headers */}
                <div className="grid grid-cols-7 bg-muted border-b border-border flex-shrink-0">
                  {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
                    <div key={d} className="text-center text-[11px] font-semibold text-gray-400 py-2">{d}</div>
                  ))}
                </div>

                {/* Day cells */}
                <div className="flex-1 overflow-auto">
                  {weeks.map((week, wi) => (
                    <div key={wi} className="grid grid-cols-7 border-b border-gray-50 last:border-b-0">
                      {week.map((day, di) => {
                        if (!day) {
                          return <div key={di} className="min-h-[84px] bg-muted/40 border-r border-gray-50 last:border-r-0" />
                        }
                        const dayDemos = demosByDay.get(day) ?? []
                        const isToday  = isTodayCell(day)
                        const isSel    = selectedDate === toISO(viewYear, viewMonth, day)
                        return (
                          <div key={di}
                            onClick={() => setSelectedDate(toISO(viewYear, viewMonth, day))}
                            className={[
                              'min-h-[84px] p-1.5 cursor-pointer transition-colors border-r border-gray-50 last:border-r-0 hover:bg-blue-50/40',
                              isSel ? 'ring-2 ring-blue-400 ring-inset' : '',
                            ].join(' ')}
                          >
                            <div className="mb-1">
                              <span className={[
                                'inline-flex w-5 h-5 items-center justify-center text-[11px] font-medium rounded-full',
                                isToday ? 'bg-blue-600 text-white font-bold' : 'text-gray-600',
                              ].join(' ')}>{day}</span>
                            </div>
                            <div className="space-y-0.5">
                              {dayDemos.slice(0, 3).map((demo, ci) => (
                                <div key={ci}
                                  className="text-[9px] leading-tight px-1 py-0.5 rounded-[3px] bg-muted"
                                  style={{ borderLeft: `3px solid ${geoColor(demo.geo).border}` }}
                                >
                                  <p className="text-gray-700 font-semibold truncate">{demo.demo_ref || '—'}</p>
                                  <p className="text-gray-500 truncate">{demo.type}</p>
                                  <p className="text-gray-400">{demo.start_time}</p>
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
                  ))}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-5 px-4 py-2.5 border-t border-border bg-muted/50 flex-shrink-0">
                  {[
                    { label: 'UK', color: '#3B82F6' },
                    { label: 'US', color: '#10B981' },
                    { label: 'JP', color: '#EF4444' },
                    { label: 'DE', color: '#F59E0B' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-1.5 text-xs text-gray-500">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      {item.label}
                    </div>
                  ))}
                  <span className="ml-auto text-xs text-gray-400">{filteredDemos.length} demos this month</span>
                </div>
              </>
            )}

            {/* ── WEEK VIEW ── */}
            {calView === 'week' && (
              <div className="flex-1 min-h-0 overflow-hidden">
                <WeekView
                  weekDemos={weekDemos}
                  weekDays={weekDays}
                  selectedDate={selectedDate}
                  nowDate={nowDate}
                  onDayClick={iso => setSelectedDate(iso)}
                  onEventClick={(demo, iso) => {
                    setSelectedDate(iso)
                    openDemo(demo)
                  }}
                />
              </div>
            )}
          </div>

          {/* ── Agenda pane (30%) — unchanged ── */}
          <div
            className="flex flex-col bg-card rounded-xl border border-border shadow-sm overflow-hidden"
            style={{ flex: '0 0 calc(30% - 16px)', minWidth: 220 }}
          >
            <div className="px-4 py-3 border-b border-border flex-shrink-0">
              <p className="text-sm font-semibold text-gray-800">{agendaTitle}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {selectedDayDemos.length} event{selectedDayDemos.length !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {selectedDate !== null && selectedDayDemos.length === 0 && (
                <p className="text-xs text-gray-400 text-center pt-6">No events this day</p>
              )}

              {selectedDayDemos.map(demo => {
                const effectiveReadiness = readinessOverrides[demo.id] ?? demo.readiness_date
                return (
                  <div key={demo.id} onClick={() => openDemo(demo)}
                    className="cursor-pointer p-3 rounded-lg border border-border
                               hover:border-blue-200 hover:bg-blue-50/20 transition-all space-y-1.5">
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <span className="text-[10px] font-semibold uppercase tracking-wide
                                       px-1.5 py-0.5 rounded bg-purple-50 text-purple-600">
                        {demo.type}
                      </span>
                      {effectiveReadiness && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                          READY
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="w-3 h-3 flex-shrink-0" />
                      {demo.start_time} – {demo.end_time}
                    </div>
                    <p className="text-sm font-semibold text-gray-800 leading-tight">{demo.organization}</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <GeoBadge geo={demo.geo as GeoCode} />
                      <StatusBadge status={demo.status} />
                    </div>
                  </div>
                )
              })}

              {/* Pending review section */}
              {pendingDemos.length > 0 && (
                <div className="mt-3 pt-3 border-t border-amber-100">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-2">
                    Pending Review ({pendingDemos.length})
                  </p>
                  {pendingDemos.map(demo => (
                    <div key={demo.id} onClick={() => openDemo(demo)}
                      className="cursor-pointer p-2.5 rounded-lg border border-amber-100 bg-amber-50/40
                                 hover:bg-amber-50 transition-all mb-1.5 space-y-1">
                      <p className="text-xs font-semibold text-gray-700 leading-tight">{demo.organization}</p>
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
  )
}
