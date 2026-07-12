import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  useReactTable, getCoreRowModel, getPaginationRowModel,
  flexRender, type ColumnDef,
} from '@tanstack/react-table'
import {
  ChevronLeft, ChevronRight, Hash,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../lib/shadcn/button'
import { Input } from '../lib/shadcn/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../lib/shadcn/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../lib/shadcn/table'
import { type DemoRequest, type DemoStatus, type GeoCode } from './data/sampleData'
import {
  useGetCockpitDemos, useUpdateDemo, usePatchDemoStatus, type UpdateDemoParams,
} from '../hooks/backend/demos'
import GeoBadge from '../components/GeoBadge'
import StatusBadge from '../components/StatusBadge'
import DemoDetailDrawer from './ui/DemoDetailDrawer'
import { CancelDialog, RescheduleDialog, EditDialog } from './ui/CockpitDialogs'
import {
  type ColKey, getActionConfig, statusToColKey, COL_STATUS,
} from './ui/cockpitActions'

// ─── Types & constants ────────────────────────────────────────────────────────

type TimeFilter = 'all' | 'today' | 'tomorrow' | 'this-week' | 'next-week' | 'this-month' | 'last-month'
type StatusFilter = 'All' | 'NEED REVIEW' | 'APPROVED' | 'CANCELED'

const GEO_OPTIONS: { v: string; l: string }[] = [
  { v: 'All', l: 'All Geo' },
  { v: 'JP',  l: 'JP' },
  { v: 'UK',  l: 'UK' },
  { v: 'US',  l: 'US' },
  { v: 'DE',  l: 'DE' },
]

const TIME_OPTIONS: { v: TimeFilter; l: string }[] = [
  { v: 'all',        l: 'All Time' },
  { v: 'today',      l: 'Today' },
  { v: 'tomorrow',   l: 'Tomorrow' },
  { v: 'this-week',  l: 'This Week' },
  { v: 'next-week',  l: 'Next Week' },
  { v: 'this-month', l: 'This Month' },
  { v: 'last-month', l: 'Last Month' },
]

const STATUS_OPTIONS: { v: StatusFilter; l: string }[] = [
  { v: 'All',          l: 'All Status' },
  { v: 'NEED REVIEW',  l: 'NEED REVIEW' },
  { v: 'APPROVED',     l: 'APPROVED' },
  { v: 'CANCELED',     l: 'CANCELED' },
]

const KANBAN_COLS: {
  key: ColKey; label: string
  headerBg: string; headerText: string; accent: string; cardBg: string
}[] = [
  { key: 'needs',    label: 'NEEDS REVIEW', headerBg: '#FFFBEB', headerText: '#92400E', accent: '#F59E0B', cardBg: '#FFFDE7' },
  { key: 'approved', label: 'APPROVED',     headerBg: '#ECFDF5', headerText: '#065F46', accent: '#10B981', cardBg: '#F0FDF4' },
  { key: 'canceled', label: 'CANCELLED',    headerBg: '#FEF2F2', headerText: '#991B1B', accent: '#EF4444', cardBg: '#FFF5F5' },
] as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(s: string) {
  const d = new Date(s + 'T00:00:00')
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`
}

function fmtDateShort(s: string) {
  const d = new Date(s + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function isNR(d: DemoRequest) {
  return d.status === 'NEED REVIEW'
}

function applyTimeFilter(demos: DemoRequest[], tf: TimeFilter): DemoRequest[] {
  if (tf === 'all') return demos
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  const weekStart = (offset: number) => {
    const d = new Date(today)
    const day = d.getDay(); const diff = (day === 0 ? -6 : 1 - day)
    d.setDate(d.getDate() + diff + offset * 7); d.setHours(0, 0, 0, 0); return d
  }
  return demos.filter(d => {
    const dd = new Date(d.demo_date + 'T00:00:00')
    if (tf === 'today')      return dd.getTime() === today.getTime()
    if (tf === 'tomorrow')   return dd.getTime() === tomorrow.getTime()
    if (tf === 'this-week')  { const m = weekStart(0), s = new Date(m); s.setDate(m.getDate() + 6); s.setHours(23, 59, 59, 999); return dd >= m && dd <= s }
    if (tf === 'next-week')  { const m = weekStart(1), s = new Date(m); s.setDate(m.getDate() + 6); s.setHours(23, 59, 59, 999); return dd >= m && dd <= s }
    if (tf === 'this-month') return dd.getMonth() === today.getMonth() && dd.getFullYear() === today.getFullYear()
    if (tf === 'last-month') {
      const lm = today.getMonth() === 0 ? 11 : today.getMonth() - 1
      const ly = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear()
      return dd.getMonth() === lm && dd.getFullYear() === ly
    }
    return true
  })
}

function applyStatusFilter(demos: DemoRequest[], sf: StatusFilter): DemoRequest[] {
  if (sf === 'All')         return demos
  if (sf === 'NEED REVIEW') return demos.filter(d => isNR(d))
  if (sf === 'APPROVED')    return demos.filter(d => d.status === 'APPROVED')
  if (sf === 'CANCELED')    return demos.filter(d => d.status === 'CANCELED')
  return demos
}

// ─── Kanban Card ──────────────────────────────────────────────────────────────

function KanbanCard({
  demo, colKey, cardBg, accent, readinessOverrides,
  onClick, onApprove, onCancel, onReschedule, onEdit, onMarkReady,
}: {
  demo:               DemoRequest
  colKey:             ColKey
  cardBg:             string
  accent:             string
  readinessOverrides: Record<string, string>
  onClick:            () => void
  onApprove:          (id: string) => void
  onCancel:           (id: string) => void
  onReschedule:       (id: string) => void
  onEdit:             (id: string) => void
  onMarkReady:        (id: string) => void
}) {
  const effectiveReadiness = readinessOverrides[demo.id] ?? demo.readiness_date
  const hasReadiness = effectiveReadiness !== null
  const cfg = getActionConfig(colKey, hasReadiness)

  const stopProp = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation()
    fn()
  }

  return (
    <div
      id={`cockpit-card-${demo.id}`}
      draggable
      onDragStart={e => {
        e.dataTransfer.setData('text/plain', demo.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={onClick}
      className="rounded-lg shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 p-3 space-y-1.5"
      style={{
        backgroundColor: '#ffffff',
        borderTop:    `1px solid ${accent}33`,
        borderBottom: `1px solid ${accent}33`,
        borderLeft:   `3px solid ${accent}`,
        borderRight:  `3px solid ${accent}`,
      }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-gray-900 leading-tight break-words min-w-0">
          {demo.organization}
        </span>
        <GeoBadge geo={demo.geo as GeoCode} />
      </div>

      {/* Date + Ready + Type */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-gray-400">{fmtDateShort(demo.demo_date)}</span>
          {hasReadiness && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-green-100 text-green-700">
              READY
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400 truncate max-w-[90px] text-right">{demo.type}</span>
      </div>

      {/* Cancellation reason — only on cancelled cards */}
      {colKey === 'canceled' && (
        <p className="text-[11px] text-gray-500 leading-snug">
          <span className="font-semibold text-gray-600">Reason:</span>{' '}
          {demo.cancel_reason || 'Not specified'}
        </p>
      )}

      {/* Slack link */}
      {demo.slack_link && (
        <a
          href={demo.slack_link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-[11px] text-blue-500 hover:text-blue-700 hover:underline"
        >
          <Hash className="w-3 h-3" />
          Open in Slack
        </a>
      )}

      {/* Action buttons — driven by shared config */}
      <div className="flex flex-wrap gap-1 pt-1" onClick={e => e.stopPropagation()}>
        {cfg.showReschedule && (
          <button
            className="h-6 px-2 text-[10px] font-medium rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 transition-colors"
            onClick={stopProp(() => onReschedule(demo.id))}
          >
            Reschedule
          </button>
        )}
        {cfg.showApprove && (
          <button
            className="h-6 px-2 text-[10px] font-medium rounded border border-green-200 bg-green-50 hover:bg-green-100 text-green-700 transition-colors"
            onClick={stopProp(() => onApprove(demo.id))}
          >
            Approve
          </button>
        )}
        {cfg.showCancel && (
          <button
            className="h-6 px-2 text-[10px] font-medium rounded border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 transition-colors"
            onClick={stopProp(() => onCancel(demo.id))}
          >
            Cancel
          </button>
        )}
        {cfg.showEdit && (
          <button
            className="h-6 px-2 text-[10px] font-medium rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 transition-colors"
            onClick={stopProp(() => onEdit(demo.id))}
          >
            Edit
          </button>
        )}
        {cfg.showMarkReady && (
          <button
            className="h-6 px-2 text-[10px] font-medium rounded border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors"
            onClick={stopProp(() => onMarkReady(demo.id))}
          >
            Mark Ready
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Kanban Column ────────────────────────────────────────────────────────────

function KanbanColumn({
  label, colKey, demos, headerBg, headerText, accent, cardBg,
  readinessOverrides, onCardClick, onDropCard,
  onApprove, onCancel, onReschedule, onEdit, onMarkReady,
}: {
  label:              string
  colKey:             ColKey
  demos:              DemoRequest[]
  headerBg:           string
  headerText:         string
  accent:             string
  cardBg:             string
  readinessOverrides: Record<string, string>
  onCardClick:        (d: DemoRequest) => void
  onDropCard:         (id: string, targetCol: ColKey) => void
  onApprove:          (id: string) => void
  onCancel:           (id: string) => void
  onReschedule:       (id: string) => void
  onEdit:             (id: string) => void
  onMarkReady:        (id: string) => void
}) {
  const [isDragOver, setIsDragOver] = useState(false)

  return (
    <div
      className="flex flex-col flex-1 min-w-0 rounded-xl border border-border overflow-hidden shadow-sm transition-all"
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setIsDragOver(true) }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={e => {
        e.preventDefault()
        setIsDragOver(false)
        const id = e.dataTransfer.getData('text/plain')
        if (id) onDropCard(id, colKey)
      }}
      style={isDragOver ? { outline: `2px dashed ${accent}`, outlineOffset: '-2px' } : undefined}
    >
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ backgroundColor: headerBg, borderBottom: `2px solid ${accent}` }}
      >
        <span className="text-sm font-bold" style={{ color: headerText }}>{label}</span>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: `${accent}22`, color: accent }}
        >
          {demos.length}
        </span>
      </div>
      <div
        className="flex-1 overflow-y-auto bg-muted p-2.5 space-y-2"
        style={{ maxHeight: 480 }}
      >
        {demos.length === 0 ? (
          <p className="text-xs text-gray-400 text-center pt-6">
            {isDragOver ? 'Drop here' : 'No demos'}
          </p>
        ) : (
          demos.map(demo => (
            <KanbanCard
              key={demo.id}
              demo={demo}
              colKey={colKey}
              cardBg={cardBg}
              accent={accent}
              readinessOverrides={readinessOverrides}
              onClick={() => onCardClick(demo)}
              onApprove={onApprove}
              onCancel={onCancel}
              onReschedule={onReschedule}
              onEdit={onEdit}
              onMarkReady={onMarkReady}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ─── Table View ───────────────────────────────────────────────────────────────

function TableView({ data, onApprove, onCancel, onReschedule, onEdit }: {
  data:         DemoRequest[]
  onApprove:    (id: string) => void
  onCancel:     (id: string) => void
  onReschedule: (id: string) => void
  onEdit:       (id: string) => void
}) {
  const columns = useMemo<ColumnDef<DemoRequest>[]>(() => [
    {
      id: 'status', header: 'Status', size: 130,
      cell: ({ row: { original: d } }) => <StatusBadge status={d.status} />,
    },
    {
      id: 'schedule', header: 'Schedule', size: 130,
      cell: ({ row: { original: d } }) => (
        <div>
          <p className="text-xs font-semibold text-gray-800">{fmtDate(d.demo_date)}</p>
          <p className="text-[11px] text-gray-400">{d.start_time} – {d.end_time}</p>
        </div>
      ),
    },
    {
      id: 'org', header: 'Organisation', size: 180,
      cell: ({ row: { original: d } }) => (
        <span className="text-sm font-medium text-gray-900">{d.organization}</span>
      ),
    },
    {
      id: 'geo', header: 'Geo', size: 60,
      cell: ({ row: { original: d } }) => <GeoBadge geo={d.geo as GeoCode} />,
    },
    {
      id: 'type', header: 'Demo Type', size: 130,
      cell: ({ row: { original: d } }) => (
        <span className="text-xs px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-medium border border-purple-100">
          {d.type}
        </span>
      ),
    },
    {
      id: 'requested', header: 'Request Date', size: 105,
      cell: ({ row: { original: d } }) => (
        <span className="text-xs text-gray-500">{fmtDate(d.date_requested)}</span>
      ),
    },
    {
      id: 'actions', header: 'Actions', size: 220,
      cell: ({ row: { original: d } }) => {
        const canApprove = isNR(d)
        return (
          <div className="flex items-center gap-1 flex-wrap">
            <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]"
              onClick={() => onReschedule(d.id)}>Reschedule</Button>
            <Button variant="outline" size="sm" className="h-7 px-2 text-[11px] text-green-700 border-green-200 hover:bg-green-50"
              disabled={!canApprove} onClick={() => onApprove(d.id)}>Approve</Button>
            <Button variant="outline" size="sm" className="h-7 px-2 text-[11px] text-red-700 border-red-200 hover:bg-red-50"
              disabled={d.status === 'CANCELED'} onClick={() => onCancel(d.id)}>Cancel</Button>
            <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]"
              onClick={() => onEdit(d.id)}>Edit</Button>
          </div>
        )
      },
    },
  ], [onApprove, onCancel, onReschedule, onEdit])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 15 } },
  })

  const { pageIndex, pageSize } = table.getState().pagination
  const from = pageIndex * pageSize + 1
  const to = Math.min((pageIndex + 1) * pageSize, data.length)

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(hg => (
              <TableRow key={hg.id} className="bg-muted">
                {hg.headers.map(h => (
                  <TableHead key={h.id}
                    className="text-xs font-semibold text-gray-500 uppercase tracking-wide py-3"
                    style={{ width: h.getSize() }}>
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map(row => (
              <TableRow key={row.id} className="hover:bg-muted transition-colors">
                {row.getVisibleCells().map(cell => (
                  <TableCell key={cell.id} className="py-2.5 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {data.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-gray-400 text-sm">
                  No demos match the current filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border">
        <span className="text-xs text-gray-400">
          {data.length > 0 ? `${from}–${to} of ${data.length}` : '0 results'}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-7 px-2"
            onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>
          <span className="text-xs text-gray-600 font-medium">
            Page {pageIndex + 1} / {table.getPageCount() || 1}
          </span>
          <Button variant="outline" size="sm" className="h-7 px-2"
            onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CockpitPage() {
  const [demos, setDemos]   = useState<DemoRequest[]>([])
  const { data: dbDemos, loading: demosLoading, trigger: fetchDemos } = useGetCockpitDemos()
  const { trigger: persistUpdate }  = useUpdateDemo()
  const { trigger: patchStatus }    = usePatchDemoStatus()

  useEffect(() => { void fetchDemos() }, [])
  useEffect(() => {
    if (dbDemos) setDemos((dbDemos as DemoRequest[]).filter(d => d.status !== 'DELETED'))
  }, [dbDemos])

  const [readinessOverrides, setReadinessOverrides] = useState<Record<string, string>>({})
  const [geoFilter,    setGeoFilter]    = useState('All')
  const [timeFilter,   setTimeFilter]   = useState<TimeFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All')
  const [orgSearch,    setOrgSearch]    = useState('')
  const [cancelDlg,    setCancelDlg]    = useState({ open: false, id: '' })
  const [rescheduleDlg, setRescheduleDlg] = useState({ open: false, id: '' })
  const [editDlg,      setEditDlg]      = useState({ open: false, id: '' })
  const [drawerDemo,   setDrawerDemo]   = useState<DemoRequest | null>(null)

  const getDbId = (id: string): number | null =>
    demos.find(d => d.id === id)?.db_id ?? null

  const persist = useCallback((id: string, data: Record<string, unknown>) => {
    const db_id = getDbId(id)
    if (db_id === null) {
      console.warn('[CockpitPage] no db_id for', id, '— skipping DB write')
      return
    }
    void persistUpdate({ db_id, data } as UpdateDemoParams)
  }, [demos, persistUpdate])

  // ── Filtered set ──────────────────────────────────────────────────────────
  const filteredDemos = useMemo(() => {
    let r = demos
    if (geoFilter !== 'All') r = r.filter(d => d.geo === geoFilter)
    r = applyTimeFilter(r, timeFilter)
    r = applyStatusFilter(r, statusFilter)
    if (orgSearch.trim()) {
      const q = orgSearch.toLowerCase()
      r = r.filter(d => d.organization.toLowerCase().includes(q))
    }
    return r
  }, [demos, geoFilter, timeFilter, statusFilter, orgSearch])

  // ── Kanban buckets ────────────────────────────────────────────────────────
  const kanbanNR  = useMemo(() => filteredDemos.filter(isNR), [filteredDemos])
  const kanbanRev = useMemo(() => filteredDemos.filter(d => d.status === 'APPROVED'), [filteredDemos])
  const kanbanCan = useMemo(() => filteredDemos.filter(d => d.status === 'CANCELED'), [filteredDemos])

  // ── Action handlers ───────────────────────────────────────────────────────
  const handleApprove = useCallback((id: string) => {
    const demo = demos.find(d => d.id === id)
    if (!demo || demo.status === 'APPROVED') return
    setDemos(prev => prev.map(d => d.id === id ? { ...d, status: 'APPROVED' as DemoStatus } : d))
    if (drawerDemo?.id === id) setDrawerDemo(prev => prev ? { ...prev, status: 'APPROVED' } : null)
    toast.success('Demo approved')
    persist(id, { status: 'APPROVED' })
  }, [demos, drawerDemo, persist])

  const handleConfirmCancel = useCallback((reason: string) => {
    const id = cancelDlg.id
    setDemos(prev => prev.map(d => d.id === id
      ? { ...d, status: 'CANCELED' as DemoStatus, cancel_reason: reason } : d))
    if (drawerDemo?.id === id) setDrawerDemo(prev => prev
      ? { ...prev, status: 'CANCELED', cancel_reason: reason } : null)
    toast.success('Demo canceled')
    persist(id, { status: 'CANCELED', cancelation_reason: reason })
  }, [cancelDlg.id, drawerDemo, persist])

  const handleConfirmReschedule = useCallback((date: string, start: string, end: string) => {
    const id = rescheduleDlg.id
    setDemos(prev => prev.map(d => d.id === id
      ? { ...d, demo_date: date, start_time: start, end_time: end } : d))
    if (drawerDemo?.id === id) setDrawerDemo(prev => prev
      ? { ...prev, demo_date: date, start_time: start, end_time: end } : null)
    toast.success('Demo rescheduled')
    persist(id, {
      date_of_demo:    date,
      demo_start_time: date + ' ' + start + ':00',
      demo_end_time:   date + ' ' + end   + ':00',
    })
  }, [rescheduleDlg.id, drawerDemo, persist])

  const handleConfirmEdit = useCallback((updated: Partial<DemoRequest>) => {
    const id = editDlg.id
    setDemos(prev => prev.map(d => d.id === id ? { ...d, ...updated } : d))
    if (drawerDemo?.id === id) setDrawerDemo(prev => prev ? { ...prev, ...updated } : null)
    toast.success('Demo updated')
    const dbData: Record<string, unknown> = {}
    if (updated.organization   !== undefined) dbData.guests_organization = updated.organization
    if (updated.requester      !== undefined) dbData.requester           = updated.requester
    if (updated.host           !== undefined) dbData.host                = updated.host
    if (updated.type           !== undefined) dbData.type                = updated.type
    if (updated.total_guests   !== undefined) dbData.total_guests        = updated.total_guests
    if (updated.total_vehicles !== undefined) dbData.total_vehicles      = updated.total_vehicles
    if (updated.vehicle_type   !== undefined) dbData.vehicle_type        = updated.vehicle_type
    if (updated.description    !== undefined) dbData.description         = updated.description
    persist(id, dbData)
  }, [editDlg.id, drawerDemo, persist])

  const handleMarkReady = useCallback((id: string) => {
    const today = new Date().toISOString().slice(0, 10)
    setReadinessOverrides(prev => ({ ...prev, [id]: today }))
    if (drawerDemo?.id === id) setDrawerDemo(prev => prev ? { ...prev, readiness_date: today } : null)
    toast.success('Demo marked as ready')
    persist(id, { date_of_readiness: today })
  }, [drawerDemo, persist])

  // ── Drag-and-drop status change ───────────────────────────────────────────
  const handleDropCard = useCallback(async (id: string, targetCol: ColKey) => {
    const demo = demos.find(d => d.id === id)
    if (!demo) return
    const newStatus = COL_STATUS[targetCol]
    if (demo.status === newStatus) return // dropped on same column

    // Snapshot for rollback
    const prev = demos

    // Optimistic UI update
    setDemos(prev => prev.map(d =>
      d.id === id ? { ...d, status: newStatus as DemoStatus } : d,
    ))
    if (drawerDemo?.id === id) {
      setDrawerDemo(d => d ? { ...d, status: newStatus as DemoStatus } : null)
    }

    // Persist via PATCH
    const db_id = demo.db_id
    if (db_id !== null && db_id !== undefined) {
      try {
        await patchStatus(db_id, newStatus)
        toast.success(`Moved to ${newStatus}`)
      } catch {
        setDemos(prev)                    // rollback
        if (drawerDemo?.id === id) setDrawerDemo(demo)
        toast.error('Failed to update status — change reverted')
      }
    } else {
      console.warn('[CockpitPage] no db_id for', id, '— skipping PATCH')
      toast.success(`Moved to ${newStatus}`)
    }
  }, [demos, drawerDemo, patchStatus])

  const rescheduleDemo = demos.find(d => d.id === rescheduleDlg.id) ?? null
  const editDemo       = demos.find(d => d.id === editDlg.id) ?? null
  const filtersActive  = geoFilter !== 'All' || timeFilter !== 'all' || statusFilter !== 'All' || orgSearch.trim() !== ''

  // ── Loading state ─────────────────────────────────────────────────────────
  if (demosLoading && demos.length === 0) {
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
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-6 py-3">
      <div className="flex flex-wrap items-end gap-3">

        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">GEO</span>
          <Select value={geoFilter} onValueChange={setGeoFilter}>
            <SelectTrigger className="w-36 h-9 text-sm bg-card border-border">
              <SelectValue placeholder="All Geo" />
            </SelectTrigger>
            <SelectContent>
              {GEO_OPTIONS.map(g => <SelectItem key={g.v} value={g.v}>{g.l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">TIMEFRAME</span>
          <Select value={timeFilter} onValueChange={v => setTimeFilter(v as TimeFilter)}>
            <SelectTrigger className="w-40 h-9 text-sm bg-card border-border">
              <SelectValue placeholder="All Time" />
            </SelectTrigger>
            <SelectContent>
              {TIME_OPTIONS.map(t => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">STATUS</span>
          <Select value={statusFilter} onValueChange={v => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-40 h-9 text-sm bg-card border-border">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1 flex-1 min-w-[200px] max-w-xs">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">ORGANISATION</span>
          <Input
            className="h-9 text-sm bg-card border-border"
            placeholder="Search…"
            value={orgSearch}
            onChange={e => setOrgSearch(e.target.value)}
          />
        </div>

        {filtersActive && (
          <Button variant="ghost" size="sm" className="h-9 text-xs text-gray-400 hover:text-gray-700 self-end"
            onClick={() => { setGeoFilter('All'); setTimeFilter('all'); setStatusFilter('All'); setOrgSearch('') }}>
            Clear
          </Button>
        )}

        <span className="ml-auto text-xs text-gray-400 font-medium flex-shrink-0">
          {filteredDemos.length} demo{filteredDemos.length !== 1 ? 's' : ''}
        </span>
      </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-auto p-6 space-y-5">

      {/* ── Demo Pipeline Kanban ── */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          PIPELINE
        </h2>
        <div className="flex gap-4 items-start">
          {KANBAN_COLS.map(col => {
            const colDemos = col.key === 'needs'
              ? kanbanNR
              : col.key === 'approved'
              ? kanbanRev
              : kanbanCan
            return (
              <KanbanColumn
                key={col.key}
                colKey={col.key}
                label={col.label}
                demos={colDemos}
                headerBg={col.headerBg}
                headerText={col.headerText}
                accent={col.accent}
                cardBg={col.cardBg}
                readinessOverrides={readinessOverrides}
                onCardClick={d => setDrawerDemo(d)}
                onDropCard={handleDropCard}
                onApprove={handleApprove}
                onCancel={id => setCancelDlg({ open: true, id })}
                onReschedule={id => setRescheduleDlg({ open: true, id })}
                onEdit={id => setEditDlg({ open: true, id })}
                onMarkReady={handleMarkReady}
              />
            )
          })}
        </div>
      </div>

      {/* ── Demo Approval Table ── */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          APPROVAL TABLE
        </h2>
        <TableView
          data={filteredDemos}
          onApprove={handleApprove}
          onCancel={id => setCancelDlg({ open: true, id })}
          onReschedule={id => setRescheduleDlg({ open: true, id })}
          onEdit={id => setEditDlg({ open: true, id })}
        />
      </div>

      {/* ── Detail Drawer ── */}
      <DemoDetailDrawer
        demo={drawerDemo}
        open={drawerDemo !== null}
        onClose={() => setDrawerDemo(null)}
        readinessOverrides={readinessOverrides}
        onApprove={handleApprove}
        onCancel={id => setCancelDlg({ open: true, id })}
        onReschedule={id => setRescheduleDlg({ open: true, id })}
        onEdit={id => setEditDlg({ open: true, id })}
        onMarkReady={handleMarkReady}
      />

      {/* ── Dialogs ── */}
      <CancelDialog
        open={cancelDlg.open}
        onClose={() => setCancelDlg({ open: false, id: '' })}
        onConfirm={handleConfirmCancel}
      />
      <RescheduleDialog
        open={rescheduleDlg.open}
        demo={rescheduleDemo}
        onClose={() => setRescheduleDlg({ open: false, id: '' })}
        onConfirm={handleConfirmReschedule}
      />
      <EditDialog
        open={editDlg.open}
        demo={editDemo}
        onClose={() => setEditDlg({ open: false, id: '' })}
        onConfirm={handleConfirmEdit}
      />
      </div>
    </div>
  )
}
