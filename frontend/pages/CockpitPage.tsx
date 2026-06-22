import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  useReactTable, getCoreRowModel, getPaginationRowModel,
  flexRender, type ColumnDef,
} from '@tanstack/react-table'
import {
  AlertTriangle, ChevronLeft, ChevronRight, Hash,
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
import { useGetDemos, useUpdateDemo } from '../hooks/backend/demos'
import GeoBadge from '../components/GeoBadge'
import StatusBadge from '../components/StatusBadge'
import DemoDetailDrawer from './ui/DemoDetailDrawer'
import { CancelDialog, RescheduleDialog, EditDialog } from './ui/CockpitDialogs'

// ─── Types & constants ────────────────────────────────────────────────────────

type TimeFilter = 'all' | 'today' | 'tomorrow' | 'this-week' | 'next-week' | 'this-month' | 'last-month'
type StatusFilter = 'All' | 'Needs Review' | 'Reviewed' | 'Canceled'

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
  { v: 'Needs Review', l: 'Needs Review' },
  { v: 'Reviewed',     l: 'Reviewed' },
  { v: 'Canceled',     l: 'Canceled' },
]

const KANBAN_COLS = [
  { key: 'needs',     label: 'Needs Review', headerBg: '#FFFBEB', headerText: '#92400E', accent: '#F59E0B' },
  { key: 'reviewed',  label: 'Reviewed',     headerBg: '#ECFDF5', headerText: '#065F46', accent: '#10B981' },
  { key: 'cancelled', label: 'Cancelled',    headerBg: '#FEF2F2', headerText: '#991B1B', accent: '#EF4444' },
] as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TODAY_DATE = new Date(); TODAY_DATE.setHours(0, 0, 0, 0)

function fmtDate(s: string) {
  const d = new Date(s + 'T00:00:00')
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`
}

function fmtDateShort(s: string) {
  const d = new Date(s + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function isNR(d: DemoRequest) {
  return d.status === 'Needs Review' || d.status === 'NEEDS REVIEW'
}

function isDelayed(d: DemoRequest) {
  return d.lead_days < 3 && d.status !== 'Canceled' && d.status !== 'DELETED'
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
  if (sf === 'All')          return demos
  if (sf === 'Needs Review') return demos.filter(d => isNR(d))
  if (sf === 'Reviewed')     return demos.filter(d => d.status === 'Reviewed')
  if (sf === 'Canceled')     return demos.filter(d => d.status === 'Canceled')
  return demos
}

// ─── Kanban Card ──────────────────────────────────────────────────────────────

function KanbanCard({
  demo,
  readinessOverrides,
  onClick,
}: {
  demo: DemoRequest
  readinessOverrides: Record<string, string>
  onClick: () => void
}) {
  const delayed = isDelayed(demo)
  const effectiveReadiness = readinessOverrides[demo.id] ?? demo.readiness_date
  const hasReadiness = effectiveReadiness !== null

  return (
    <div
      id={`cockpit-card-${demo.id}`}
      onClick={onClick}
      className="bg-white rounded-lg border border-gray-100 shadow-sm cursor-pointer
                 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 p-3 space-y-1.5"
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-gray-900 leading-tight break-words min-w-0">
          {demo.organization}
        </span>
        <GeoBadge geo={demo.geo as GeoCode} />
      </div>

      {/* Delayed chip */}
      {delayed && (
        <div>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-700 border border-red-200">
            <AlertTriangle className="w-2.5 h-2.5" /> DELAYED
          </span>
        </div>
      )}

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
    </div>
  )
}

// ─── Kanban Column ────────────────────────────────────────────────────────────

function KanbanColumn({
  label, demos, headerBg, headerText, accent, readinessOverrides, onCardClick,
}: {
  label: string
  demos: DemoRequest[]
  headerBg: string
  headerText: string
  accent: string
  readinessOverrides: Record<string, string>
  onCardClick: (d: DemoRequest) => void
}) {
  return (
    <div className="flex flex-col flex-1 min-w-0 rounded-xl border border-gray-200 overflow-hidden shadow-sm">
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
      <div className="flex-1 overflow-y-auto bg-gray-50 p-2.5 space-y-2" style={{ maxHeight: 420 }}>
        {demos.length === 0 ? (
          <p className="text-xs text-gray-400 text-center pt-6">No demos</p>
        ) : (
          demos.map(demo => (
            <KanbanCard
              key={demo.id}
              demo={demo}
              readinessOverrides={readinessOverrides}
              onClick={() => onCardClick(demo)}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ─── Table View ───────────────────────────────────────────────────────────────

function TableView({ data, onApprove, onCancel, onReschedule, onEdit }: {
  data: DemoRequest[]
  onApprove: (id: string) => void
  onCancel: (id: string) => void
  onReschedule: (id: string) => void
  onEdit: (id: string) => void
}) {
  const columns = useMemo<ColumnDef<DemoRequest>[]>(() => [
    {
      id: 'status', header: 'Status', size: 130,
      cell: ({ row: { original: d } }) => (
        <div className="flex flex-col gap-1">
          <StatusBadge status={d.status} />
          {isDelayed(d) && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 w-fit">
              <AlertTriangle className="w-2.5 h-2.5" /> DELAYED
            </span>
          )}
        </div>
      ),
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
              disabled={d.status === 'Canceled'} onClick={() => onCancel(d.id)}>Cancel</Button>
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
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(hg => (
              <TableRow key={hg.id} className="bg-gray-50">
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
              <TableRow key={row.id}
                style={{ borderLeft: isDelayed(row.original) ? '4px solid #FBBF24' : '4px solid transparent' }}
                className="hover:bg-gray-50 transition-colors">
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
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
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
  const [demos, setDemos] = useState<DemoRequest[]>([])
  const { data: dbDemos, loading: demosLoading, trigger: fetchDemos } = useGetDemos()
  const { trigger: persistUpdate } = useUpdateDemo()

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

  const actionRequiredCount = demos.filter(isNR).length

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
  const kanbanRev = useMemo(() => filteredDemos.filter(d => d.status === 'Reviewed'), [filteredDemos])
  const kanbanCan = useMemo(() => filteredDemos.filter(d => d.status === 'Canceled'), [filteredDemos])

  // ── Action handlers ───────────────────────────────────────────────────────
  const handleApprove = useCallback((id: string) => {
    setDemos(prev => prev.map(d => isNR(d) && d.id === id
      ? { ...d, status: 'Reviewed' as DemoStatus } : d))
    toast.success('Demo approved')
    void persistUpdate({ id, action: 'Reviewed', dbStatus: 'approved' })
  }, [persistUpdate])

  const handleConfirmCancel = useCallback((reason: string) => {
    setDemos(prev => prev.map(d => d.id === cancelDlg.id
      ? { ...d, status: 'Canceled' as DemoStatus, cancel_reason: reason } : d))
    toast.success('Demo canceled')
    void persistUpdate({ id: cancelDlg.id, action: 'Canceled', dbStatus: 'rejected' })
  }, [cancelDlg.id, persistUpdate])

  const handleConfirmReschedule = useCallback((date: string, start: string, end: string) => {
    setDemos(prev => prev.map(d => d.id === rescheduleDlg.id
      ? { ...d, demo_date: date, start_time: start, end_time: end } : d))
    toast.success('Demo rescheduled')
    void persistUpdate({ id: rescheduleDlg.id, date_of_demo: date, start_time: start, end_time: end })
  }, [rescheduleDlg.id, persistUpdate])

  const handleConfirmEdit = useCallback((updated: Partial<DemoRequest>) => {
    setDemos(prev => prev.map(d => d.id === editDlg.id ? { ...d, ...updated } : d))
    toast.success('Demo updated')
    void persistUpdate({
      id: editDlg.id,
      ...(updated.organization  !== undefined && { organization:  updated.organization }),
      ...(updated.requester     !== undefined && { requester:     updated.requester }),
      ...(updated.host          !== undefined && { host:          updated.host }),
      ...(updated.type          !== undefined && { demo_type:     updated.type }),
      ...(updated.total_guests  !== undefined && { total_guests:  updated.total_guests }),
      ...(updated.total_vehicles !== undefined && { total_vehicles: updated.total_vehicles }),
      ...(updated.vehicle_type  !== undefined && { vehicle_type:  updated.vehicle_type }),
      ...(updated.description   !== undefined && { description:   updated.description }),
    })
  }, [editDlg.id, persistUpdate])

  const handleMarkReady = useCallback((id: string) => {
    const today = new Date().toISOString().slice(0, 10)
    setReadinessOverrides(prev => ({ ...prev, [id]: today }))
    toast.success('Demo marked as ready')
  }, [])

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
    <div className="p-6 space-y-5">

      {/* ── Action Required badge ── */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 rounded-lg border border-red-200 w-fit">
        <span className="relative flex">
          <span className="w-2 h-2 rounded-full bg-red-500 block" />
          <span className="w-2 h-2 rounded-full bg-red-500 absolute inset-0 animate-ping opacity-60" />
        </span>
        <span className="text-sm font-semibold text-red-700">Action Required</span>
        <span className="bg-red-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full leading-none">
          {actionRequiredCount}
        </span>
      </div>

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={geoFilter} onValueChange={setGeoFilter}>
          <SelectTrigger className="w-36 h-9 text-sm bg-white border-gray-200">
            <SelectValue placeholder="All Geo" />
          </SelectTrigger>
          <SelectContent>
            {GEO_OPTIONS.map(g => <SelectItem key={g.v} value={g.v}>{g.l}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={timeFilter} onValueChange={v => setTimeFilter(v as TimeFilter)}>
          <SelectTrigger className="w-40 h-9 text-sm bg-white border-gray-200">
            <SelectValue placeholder="All Time" />
          </SelectTrigger>
          <SelectContent>
            {TIME_OPTIONS.map(t => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-40 h-9 text-sm bg-white border-gray-200">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Input
            className="h-9 text-sm bg-white border-gray-200"
            placeholder="Search organisation…"
            value={orgSearch}
            onChange={e => setOrgSearch(e.target.value)}
          />
        </div>

        {filtersActive && (
          <Button variant="ghost" size="sm" className="h-9 text-xs text-gray-400 hover:text-gray-700"
            onClick={() => { setGeoFilter('All'); setTimeFilter('all'); setStatusFilter('All'); setOrgSearch('') }}>
            Clear filters
          </Button>
        )}

        <span className="ml-auto text-xs text-gray-400 font-medium flex-shrink-0">
          {filteredDemos.length} demo{filteredDemos.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Demo Pipeline Kanban ── */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Demo Pipeline
        </h2>
        <div className="flex gap-4 items-start">
          {KANBAN_COLS.map(col => {
            const colDemos = col.key === 'needs'
              ? kanbanNR
              : col.key === 'reviewed'
              ? kanbanRev
              : kanbanCan
            return (
              <KanbanColumn
                key={col.key}
                label={col.label}
                demos={colDemos}
                headerBg={col.headerBg}
                headerText={col.headerText}
                accent={col.accent}
                readinessOverrides={readinessOverrides}
                onCardClick={d => setDrawerDemo(d)}
              />
            )
          })}
        </div>
      </div>

      {/* ── Demo Approval Table ── */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Demo Approval
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
  )
}
