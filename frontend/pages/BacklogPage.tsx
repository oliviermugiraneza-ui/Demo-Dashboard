import { useState, useMemo, useEffect, useCallback } from 'react'
import { LayoutGrid, List, Plus, RefreshCw, Search } from 'lucide-react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../lib/shadcn/select'
import { toast } from 'sonner'
import {
  useGetBacklog, useCreateBacklog, useUpdateBacklog,
  usePatchBacklogStatus, useDeleteBacklog, useConvertBacklog,
} from '../hooks/backend/backlog'
import type { BacklogItem, BacklogStatus } from './backlog/types'
import { BACKLOG_STATUSES } from './backlog/types'
import { parseBacklogDate } from './backlog/BacklogKanban'
import BacklogKanban         from './backlog/BacklogKanban'
import BacklogTable          from './backlog/BacklogTable'
import BacklogCompletedTable from './backlog/BacklogCompletedTable'
import BacklogCancelledTable from './backlog/BacklogCancelledTable'
import BacklogDrawer         from './backlog/BacklogDrawer'
import BacklogFormModal      from './backlog/BacklogFormModal'

// ─── Constants ────────────────────────────────────────────────────────────────

const GEO_OPTIONS       = ['All', 'JP', 'UK', 'US', 'DE']
const PRIORITY_OPTIONS  = ['All', 'P0', 'P1', 'P2']
const STATUS_OPTIONS    = ['All', ...BACKLOG_STATUSES]

type Timeframe = 'all' | 'this_week' | 'next_week' | 'this_month' | 'next_month'
type ViewMode  = 'kanban' | 'table'

const TIMEFRAME_OPTIONS: { v: Timeframe; l: string }[] = [
  { v: 'all',        l: 'All Time' },
  { v: 'this_week',  l: 'This Week' },
  { v: 'next_week',  l: 'Next Week' },
  { v: 'this_month', l: 'This Month' },
  { v: 'next_month', l: 'Next Month' },
]

function getTimeframeBounds(tf: Timeframe): { from: Date; to: Date } | null {
  if (tf === 'all') return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const day   = today.getDay()
  const monOff = day === 0 ? -6 : 1 - day

  if (tf === 'this_week') {
    const from = new Date(today); from.setDate(today.getDate() + monOff)
    const to   = new Date(from);  to.setDate(from.getDate() + 6); to.setHours(23, 59, 59, 999)
    return { from, to }
  }
  if (tf === 'next_week') {
    const from = new Date(today); from.setDate(today.getDate() + monOff + 7)
    const to   = new Date(from);  to.setDate(from.getDate() + 6); to.setHours(23, 59, 59, 999)
    return { from, to }
  }
  if (tf === 'this_month') {
    const from = new Date(today.getFullYear(), today.getMonth(), 1)
    const to   = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999)
    return { from, to }
  }
  if (tf === 'next_month') {
    const from = new Date(today.getFullYear(), today.getMonth() + 1, 1)
    const to   = new Date(today.getFullYear(), today.getMonth() + 2, 0, 23, 59, 59, 999)
    return { from, to }
  }
  return null
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BacklogPage() {
  const [viewMode,       setViewMode]       = useState<ViewMode>('kanban')
  const [search,         setSearch]         = useState('')
  const [statusFilter,   setStatusFilter]   = useState('All')
  const [geoFilter,      setGeoFilter]      = useState('All')
  const [priorityFilter, setPriorityFilter] = useState('All')
  const [timeframe,      setTimeframe]      = useState<Timeframe>('all')

  const [selectedItem,   setSelectedItem]   = useState<BacklogItem | null>(null)
  const [drawerOpen,     setDrawerOpen]     = useState(false)
  const [modalOpen,      setModalOpen]      = useState(false)
  const [modalDefault,   setModalDefault]   = useState<BacklogStatus>('Proposed')
  const [modalPrefill,   setModalPrefill]   = useState<Partial<BacklogItem> | undefined>()
  const [items,          setItems]          = useState<BacklogItem[]>([])

  const { data, loading, trigger: fetchItems } = useGetBacklog()
  const { trigger: createItem }  = useCreateBacklog()
  const { trigger: updateItem }  = useUpdateBacklog()
  const { trigger: patchStatus } = usePatchBacklogStatus()
  const { trigger: deleteItem }  = useDeleteBacklog()
  const { trigger: convertItem } = useConvertBacklog()

  useEffect(() => { void fetchItems() }, [fetchItems])
  useEffect(() => { if (data) setItems(data) }, [data])

  // ── Timeframe-aware filter ────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q      = search.trim().toLowerCase()
    const bounds = getTimeframeBounds(timeframe)

    return items.filter(item => {
      // Hide Converted in 'All' view; show only when explicitly filtered
      if (item.status === 'Converted' && statusFilter === 'All') return false

      if (statusFilter  !== 'All' && item.status   !== statusFilter)  return false
      if (geoFilter     !== 'All' && item.geo       !== geoFilter)    return false
      if (priorityFilter !== 'All' &&
          (item.priority?.toUpperCase() ?? '') !== priorityFilter)    return false

      if (q && ![item.company, item.customer, item.host, item.requestor, item.demo_purpose]
        .some(v => v?.toLowerCase().includes(q))) return false

      // Timeframe filter — only applies to items with a parseable date
      if (bounds) {
        const d = parseBacklogDate(item.preferred_demo_date)
        if (!d) return false
        if (d < bounds.from || d > bounds.to) return false
      }

      return true
    })
  }, [items, search, statusFilter, geoFilter, priorityFilter, timeframe])

  // Separate active (non-completed, non-cancelled), completed, and cancelled
  const activeItems    = useMemo(() => filtered.filter(i => i.status !== 'Completed' && i.status !== 'CANCELED'), [filtered])
  const completedItems = useMemo(() => items.filter(i => i.status === 'Completed'), [items])
  const cancelledItems = useMemo(() => items.filter(i => i.status === 'CANCELED'), [items])

  // Counts for status filter labels
  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const item of items) {
      if (item.status !== 'Converted') c[item.status] = (c[item.status] ?? 0) + 1
    }
    return c
  }, [items])

  // ── Handlers ─────────────────────────────────────────────────────────────

  const openDrawer = (item: BacklogItem) => { setSelectedItem(item); setDrawerOpen(true) }

  const openModal = (defaultStatus: BacklogStatus = 'Proposed', prefill?: Partial<BacklogItem>) => {
    setModalDefault(defaultStatus)
    setModalPrefill(prefill)
    setModalOpen(true)
  }

  const handleCreate = async (data: Partial<BacklogItem>) => {
    const created = await createItem(data)
    if (created) {
      setItems(prev => [created, ...prev])
      toast.success(`Created: ${created.company ?? '—'}`)
    } else {
      toast.error('Failed to create backlog item')
    }
  }

  const handleSave = useCallback(async (id: number, data: Partial<BacklogItem>) => {
    const updated = await updateItem(id, data)
    if (updated) {
      setItems(prev => prev.map(i => i.id === id ? updated : i))
      setSelectedItem(s => s?.id === id ? updated : s)
      toast.success('Changes saved')
    } else {
      toast.error('Save failed')
    }
  }, [updateItem])

  const handleStatusChange = async (item: BacklogItem, newStatus: BacklogStatus) => {
    const prev = items
    setItems(old => old.map(i => i.id === item.id ? { ...i, status: newStatus } : i))
    setSelectedItem(s => s?.id === item.id ? { ...s, status: newStatus } : s)
    try {
      await patchStatus(item.id, newStatus)
    } catch {
      setItems(prev)
      setSelectedItem(item)
      toast.error('Status update failed')
    }
  }

  const handleDelete = useCallback(async (id: number) => {
    await deleteItem(id)
    setItems(prev => prev.filter(i => i.id !== id))
    toast.success('Item deleted')
  }, [deleteItem])

  const handleDuplicate = (item: BacklogItem) => {
    const { id: _id, created_at: _c, updated_at: _u, converted_at: _ca, converted_demo_id: _cd, ...rest } = item
    openModal(item.status as BacklogStatus, { ...rest, status: item.status as BacklogStatus })
  }

  const handleConvert = useCallback(async (id: number) => {
    try {
      const result = await convertItem(id)
      setItems(prev => prev.map(i => i.id === id ? result.item : i))
      setSelectedItem(s => s?.id === id ? result.item : s)
      const label = result.demo_ref ?? `#${result.demoId}`
      toast.success(`Converted → Demo Request ${label}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Conversion failed'
      toast.error(msg)
    }
  }, [convertItem])

  const handleRefresh = async () => { await fetchItems(); toast.success('Backlog refreshed') }

  const filtersActive = statusFilter !== 'All' || geoFilter !== 'All' || priorityFilter !== 'All'
    || search !== '' || timeframe !== 'all'

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-gray-400 text-sm gap-2">
        <span className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full inline-block" />
        Loading backlog…
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-[#F8FAFC] overflow-hidden">

      {/* ── Sticky filter / controls bar ── */}
      <div className="flex-shrink-0 sticky top-0 z-10 bg-white border-b border-gray-100 px-6 py-3">
        <div className="flex flex-wrap items-end gap-3">

          {/* Status */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">STATUS</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-34 h-8 text-sm bg-white border-gray-200">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(s => (
                  <SelectItem key={s} value={s}>
                    {s === 'All' ? 'All Status' : s}
                    {s !== 'All' && counts[s] != null ? ` (${counts[s]})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* GEO */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">GEO</span>
            <Select value={geoFilter} onValueChange={setGeoFilter}>
              <SelectTrigger className="w-24 h-8 text-sm bg-white border-gray-200">
                <SelectValue placeholder="All Geo" />
              </SelectTrigger>
              <SelectContent>
                {GEO_OPTIONS.map(g => <SelectItem key={g} value={g}>{g === 'All' ? 'All Geo' : g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">PRIORITY</span>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-28 h-8 text-sm bg-white border-gray-200">
                <SelectValue placeholder="All Priority" />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map(p => <SelectItem key={p} value={p}>{p === 'All' ? 'All Priority' : p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Timeframe */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">TIMEFRAME</span>
            <Select value={timeframe} onValueChange={v => setTimeframe(v as Timeframe)}>
              <SelectTrigger className="w-32 h-8 text-sm bg-white border-gray-200">
                <SelectValue placeholder="All Time" />
              </SelectTrigger>
              <SelectContent>
                {TIMEFRAME_OPTIONS.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Search — after Timeframe */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">SEARCH</span>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Company, host, purpose…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 pr-3 h-8 w-52 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 transition-colors"
              />
            </div>
          </div>

          {filtersActive && (
            <button
              onClick={() => { setSearch(''); setStatusFilter('All'); setGeoFilter('All'); setPriorityFilter('All'); setTimeframe('all') }}
              className="text-xs text-gray-400 hover:text-gray-700 underline underline-offset-2 pb-1"
            >
              Clear
            </button>
          )}

          {/* Right side: count + view toggle + refresh + new */}
          <div className="ml-auto flex items-end gap-2 pb-0">
            <span className="text-xs text-gray-400 whitespace-nowrap pb-1">
              {activeItems.length} item{activeItems.length !== 1 ? 's' : ''}
            </span>

            {/* View toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('kanban')}
                className={[
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all',
                  viewMode === 'kanban' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700',
                ].join(' ')}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Board
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={[
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all',
                  viewMode === 'table' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700',
                ].join(' ')}
              >
                <List className="w-3.5 h-3.5" />
                Table
              </button>
            </div>

            <button
              onClick={handleRefresh}
              className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-gray-500"
              title="Refresh"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => openModal()}
              className="flex items-center gap-1.5 h-8 px-3.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors rounded-lg"
            >
              <Plus className="w-4 h-4" />
              New Backlog Item
            </button>
          </div>
        </div>
      </div>

      {/* ── Main workspace ── */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {viewMode === 'kanban' ? (
          <BacklogKanban
            items={activeItems}
            onSelectItem={openDrawer}
            onStatusChange={handleStatusChange}
            onAddNew={status => openModal(status)}
          />
        ) : (
          <BacklogTable
            items={activeItems}
            onSelectItem={openDrawer}
          />
        )}

        {/* Completed section — always visible below main workspace */}
        <BacklogCompletedTable
          items={completedItems}
          onSelectItem={openDrawer}
        />

        {/* Cancelled section — collapsible table below completed */}
        <BacklogCancelledTable
          items={cancelledItems}
          onSelectItem={openDrawer}
        />
      </div>

      {/* ── Detail Drawer ── */}
      <BacklogDrawer
        item={selectedItem}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSave={handleSave}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        onConvert={handleConvert}
      />

      {/* ── Create/Duplicate Modal ── */}
      {modalOpen && (
        <BacklogFormModal
          open={modalOpen}
          defaultStatus={modalDefault}
          prefill={modalPrefill}
          onClose={() => { setModalOpen(false); setModalPrefill(undefined) }}
          onSubmit={handleCreate}
        />
      )}
    </div>
  )
}
