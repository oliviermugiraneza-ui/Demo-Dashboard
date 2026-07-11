import { useState, useEffect, useMemo } from 'react'
import { Search, Trash2, RefreshCw, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../../lib/shadcn/button'
import { Input } from '../../lib/shadcn/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../lib/shadcn/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../lib/shadcn/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../lib/shadcn/table'
import {
  useListDemoRequests, useDeleteDemoRequest, useGetDemoRequestStats,
} from '../../hooks/backend/demoRequests'
import { fmtDate, fmtTime, fmtRelative, type DemoRequestRow } from './data/fieldHelpers'
import DRStatusBadge from './ui/DRStatusBadge'
import { GEO_OPTIONS } from './data/demoTypeConfig'

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'pending',   label: 'Needs Review' },
  { value: 'approved',  label: 'Approved' },
  { value: 'rejected',  label: 'Rejected' },
  { value: 'completed', label: 'Completed' },
]

const PAGE_SIZE = 15

export default function AdminPage() {
  const [search, setSearch]       = useState('')
  const [status, setStatus]       = useState('')
  const [geo, setGeo]             = useState('')
  const [page, setPage]           = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<DemoRequestRow | null>(null)

  const { data: listData, loading, trigger: fetchList } = useListDemoRequests()
  const { data: statsData, trigger: fetchStats }        = useGetDemoRequestStats()
  const { trigger: doDelete, loading: deleting }        = useDeleteDemoRequest()

  const rows = ((listData as { data?: unknown[] } | null)?.data ?? []) as DemoRequestRow[]
  const total: number = (listData as { total?: number } | null)?.total ?? 0
  const stats = statsData as { pending: number; approved: number; rejected: number; completed: number; total: number } | null

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1

  function load(p = page) {
    void fetchList({
      search: search.trim() || undefined,
      status: status || undefined,
      geo: geo || undefined,
      page: p,
      pageSize: PAGE_SIZE,
    })
    void fetchStats()
  }

  useEffect(() => { load(1) }, [])

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load(1) }, 350)
    return () => clearTimeout(t)
  }, [search, status, geo])

  async function handleDelete(row: DemoRequestRow) {
    try {
      await doDelete({ id: row.id })
      toast.success('Request deleted')
      setDeleteTarget(null)
      load(1)
    } catch {
      toast.error('Delete failed — try again.')
    }
  }

  // Stat summary bar
  const statBar = useMemo(() => [
    { label: 'Total',     value: stats?.total     ?? 0, color: '#64748B' },
    { label: 'Pending',   value: stats?.pending   ?? 0, color: '#D97706' },
    { label: 'Approved',  value: stats?.approved  ?? 0, color: '#059669' },
    { label: 'Rejected',  value: stats?.rejected  ?? 0, color: '#DC2626' },
    { label: 'Completed', value: stats?.completed ?? 0, color: '#2563EB' },
  ], [stats])

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto">
      {/* Stats */}
      <div className="flex items-center gap-3 flex-wrap">
        {statBar.map(s => (
          <div key={s.label} className="flex items-center gap-1.5 text-xs font-semibold">
            <span className="text-base font-bold tabular-nums" style={{ color: s.color }}>{s.value}</span>
            <span className="text-gray-400">{s.label}</span>
          </div>
        ))}
        <Button variant="ghost" size="sm" className="ml-auto gap-1.5 text-gray-400 hover:text-gray-700 h-7 px-2"
          onClick={() => load(page)}>
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <Input
            className="pl-8 h-8 text-sm"
            placeholder="Search organisation, requester…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={status || '_all'} onValueChange={v => { setStatus(v === '_all' ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(o => <SelectItem key={o.value || '_all'} value={o.value || '_all'}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={geo || '_all'} onValueChange={v => { setGeo(v === '_all' ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="All Geos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All Geos</SelectItem>
            {GEO_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                {['Status', 'Type', 'Organisation', 'Geo', 'Demo Date', 'Time', 'Guests', 'Requester', 'Submitted', ''].map(h => (
                  <TableHead key={h} className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide py-2.5 px-3 whitespace-nowrap">
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12">
                    <div className="flex items-center justify-center gap-2 text-gray-400 text-sm">
                      <span className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full" />
                      Loading…
                    </div>
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-gray-400 text-sm">
                    No requests match the current filters.
                  </TableCell>
                </TableRow>
              ) : rows.map(req => (
                <TableRow key={req.id} className="hover:bg-gray-50">
                  <TableCell className="py-2 px-3"><DRStatusBadge status={req.status} /></TableCell>
                  <TableCell className="py-2 px-3 text-xs font-medium text-purple-700 whitespace-nowrap">
                    {req.demo_type}
                  </TableCell>
                  <TableCell className="py-2 px-3 text-sm font-medium text-gray-900 max-w-[160px] truncate">
                    {req.guests_organization || '—'}
                  </TableCell>
                  <TableCell className="py-2 px-3 text-xs text-gray-500">{req.geo}</TableCell>
                  <TableCell className="py-2 px-3 text-xs text-gray-700 whitespace-nowrap">
                    {fmtDate(req.date_of_demo)}
                  </TableCell>
                  <TableCell className="py-2 px-3 text-xs text-gray-500 whitespace-nowrap">
                    {fmtTime(req.demo_start_time)} – {fmtTime(req.demo_end_time)}
                  </TableCell>
                  <TableCell className="py-2 px-3 text-xs text-gray-500">{req.total_guests}</TableCell>
                  <TableCell className="py-2 px-3 text-xs text-gray-700 whitespace-nowrap">{req.requester}</TableCell>
                  <TableCell className="py-2 px-3 text-[11px] text-gray-400 whitespace-nowrap">
                    {fmtRelative(req.created_at)}
                  </TableCell>
                  <TableCell className="py-2 px-3">
                    <div className="flex items-center gap-1">
                      {req.slack_link && (
                        <a href={req.slack_link} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-300 hover:text-blue-500">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                        </a>
                      )}
                      <Button variant="ghost" size="sm"
                        className="h-7 w-7 p-0 text-gray-300 hover:text-red-500"
                        onClick={() => setDeleteTarget(req)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <span className="text-xs text-gray-400">
            {total > 0 ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total}` : '0 results'}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-7 px-2"
              onClick={() => { setPage(p => p - 1); load(page - 1) }}
              disabled={page <= 1}>
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <span className="text-xs text-gray-600">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" className="h-7 px-2"
              onClick={() => { setPage(p => p + 1); load(page + 1) }}
              disabled={page >= totalPages}>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Delete confirm dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={v => !v && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Request</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-1">
            Permanently delete the <strong>{deleteTarget?.demo_type}</strong> request
            for <strong>{deleteTarget?.guests_organization || 'this organisation'}</strong>? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" size="sm" disabled={deleting}
              onClick={() => deleteTarget && void handleDelete(deleteTarget)}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
