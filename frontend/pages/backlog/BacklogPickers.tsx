import { useState, useRef, useEffect, useMemo } from 'react'
import { Calendar, Clock, ChevronLeft, ChevronRight } from 'lucide-react'

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const DAY_ABBR = ['Mo','Tu','We','Th','Fr','Sa','Su']

// ─── Calendar date picker ─────────────────────────────────────────────────────

export function CalendarDropdown({ value, onChange }: {
  value: string; onChange: (v: string) => void
}) {
  const [open, setOpen]     = useState(false)
  const ref                 = useRef<HTMLDivElement>(null)
  const today               = useMemo(() => new Date(), [])
  const parsed              = value && /^\d{4}-\d{2}-\d{2}$/.test(value)
                                ? new Date(value + 'T00:00:00')
                                : null

  const [viewYear,  setViewYear]  = useState(() => parsed?.getFullYear()  ?? today.getFullYear())
  const [viewMonth, setViewMonth] = useState(() => parsed?.getMonth()     ?? today.getMonth())

  useEffect(() => {
    if (parsed) { setViewYear(parsed.getFullYear()); setViewMonth(parsed.getMonth()) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  useEffect(() => {
    if (!open) return
    const fn = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [open])

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const firstDow    = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const select = (day: number) => {
    const mm = String(viewMonth + 1).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    onChange(`${viewYear}-${mm}-${dd}`)
    setOpen(false)
  }

  const displayValue = parsed
    ? parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : value ? value : ''

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full h-9 px-3 text-sm text-left border border-gray-200 rounded-lg bg-white flex items-center justify-between gap-2 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-colors hover:border-gray-300"
      >
        <span className={displayValue ? 'text-gray-800' : 'text-gray-400'}>
          {displayValue || 'Select date…'}
        </span>
        <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 left-0 bg-white border border-gray-200 rounded-xl shadow-2xl p-3 w-64">
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={prevMonth}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <span className="text-sm font-bold text-gray-800">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button type="button" onClick={nextMonth}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {DAY_ABBR.map(d => (
              <div key={d} className="text-center text-[10px] font-bold text-gray-400 py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-0.5">
            {cells.map((day, i) => {
              if (!day) return <div key={`e-${i}`} />
              const isSelected = parsed &&
                parsed.getFullYear() === viewYear &&
                parsed.getMonth()    === viewMonth &&
                parsed.getDate()     === day
              const isToday =
                today.getFullYear() === viewYear &&
                today.getMonth()    === viewMonth &&
                today.getDate()     === day
              return (
                <button key={`d-${day}`} type="button" onClick={() => select(day)}
                  className={`w-8 h-8 mx-auto flex items-center justify-center rounded-full text-xs font-medium transition-colors ${
                    isSelected
                      ? 'bg-blue-600 text-white'
                      : isToday
                      ? 'border border-blue-500 text-blue-600 hover:bg-blue-50'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}>
                  {day}
                </button>
              )
            })}
          </div>

          {value && (
            <button type="button" onClick={() => { onChange(''); setOpen(false) }}
              className="mt-2 w-full text-center text-[11px] text-gray-400 hover:text-red-500 transition-colors pt-1 border-t border-gray-100">
              Clear date
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Time-slot picker ─────────────────────────────────────────────────────────

export function TimeDropdown({ value, onChange }: {
  value: string; onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref             = useRef<HTMLDivElement>(null)
  const listRef         = useRef<HTMLDivElement>(null)

  const slots = useMemo(() => {
    const result: string[] = []
    for (let h = 6; h <= 22; h++) {
      result.push(`${String(h).padStart(2, '0')}:00`)
      if (h < 22) result.push(`${String(h).padStart(2, '0')}:30`)
    }
    return result
  }, [])

  useEffect(() => {
    if (!open) return
    const fn = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [open])

  useEffect(() => {
    if (!open || !value) return
    const idx = slots.indexOf(value)
    if (idx === -1 || !listRef.current) return
    const btn = listRef.current.children[idx] as HTMLElement | undefined
    btn?.scrollIntoView({ block: 'nearest' })
  }, [open, value, slots])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full h-9 px-3 text-sm text-left border border-gray-200 rounded-lg bg-white flex items-center justify-between gap-2 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-colors hover:border-gray-300"
      >
        <span className={value ? 'text-gray-800' : 'text-gray-400'}>
          {value || 'Select time…'}
        </span>
        <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 left-0 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden w-36">
          <div ref={listRef} className="max-h-52 overflow-y-auto">
            {slots.map(slot => (
              <button key={slot} type="button"
                onClick={() => { onChange(slot); setOpen(false) }}
                className={`w-full px-4 py-2 text-sm text-left transition-colors ${
                  slot === value
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-gray-700 hover:bg-blue-50'
                }`}>
                {slot}
              </button>
            ))}
          </div>
          {value && (
            <button type="button" onClick={() => { onChange(''); setOpen(false) }}
              className="w-full py-1.5 text-center text-[11px] text-gray-400 hover:text-red-500 border-t border-gray-100 transition-colors">
              Clear time
            </button>
          )}
        </div>
      )}
    </div>
  )
}
