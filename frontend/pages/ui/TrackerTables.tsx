import { useState, useMemo, type ReactNode } from 'react'
import { type DrawerContext } from './cockpitActions'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { ChevronDown, ChevronRight, ChevronsUpDown, ChevronUp } from 'lucide-react'
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '../../lib/shadcn/collapsible'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../lib/shadcn/table'
import { type DemoRequest } from '../data/sampleData'
import GeoBadge from '../../components/GeoBadge'

// ─── Types ────────────────────────────────────────────────────────────────────

export type TrackerRow = DemoRequest & { effectiveReadiness: string | null }

interface TrackerTablesProps {
  demos: DemoRequest[]
  readinessOverrides: Record<string, string>
  onSelectDemo: (demo: DemoRequest, context: DrawerContext) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().slice(0, 10)

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDate().toString().padStart(2, '0')
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  return `${day}-${month}-${d.getFullYear()}`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SortIcon({ sorted }: { sorted: false | 'asc' | 'desc' }) {
  if (sorted === 'asc') return <ChevronUp className="w-3 h-3 text-blue-500" />
  if (sorted === 'desc') return <ChevronDown className="w-3 h-3 text-blue-500" />
  return <ChevronsUpDown className="w-3 h-3 text-gray-300" />
}

function CollapsibleSection({
  title, count, accentColor, defaultOpen = true, children,
}: {
  title: string; count: number; accentColor: string
  defaultOpen?: boolean; children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="bg-card rounded-xl border border-border shadow-sm overflow-hidden"
    >
      <CollapsibleTrigger className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: accentColor }} />
          <span className="text-sm font-semibold text-gray-800">{title}</span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
            {count}
          </span>
        </div>
        {open
          ? <ChevronDown className="w-4 h-4 text-gray-400" />
          : <ChevronRight className="w-4 h-4 text-gray-400" />}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t border-border">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function DataTable<T extends object>({
  data, columns, onRowClick,
}: {
  data: T[]
  columns: ColumnDef<T>[]
  onRowClick?: (row: T) => void
}) {
  const [sorting, setSorting] = useState<SortingState>([])
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  if (data.length === 0) {
    return (
      <div className="text-center text-sm text-gray-400 py-10">No records</div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader className="sticky top-0 bg-muted z-10">
          {table.getHeaderGroups().map(hg => (
            <TableRow key={hg.id} className="border-b border-border hover:bg-transparent">
              {hg.headers.map(header => (
                <TableHead
                  key={header.id}
                  onClick={header.column.getToggleSortingHandler()}
                  className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none whitespace-nowrap py-2.5"
                >
                  <div className="flex items-center gap-1">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getCanSort() && (
                      <SortIcon sorted={header.column.getIsSorted()} />
                    )}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map(row => (
            <TableRow
              key={row.id}
              onClick={() => onRowClick?.(row.original)}
              className="transition-colors cursor-pointer hover:bg-blue-50/40"
            >
              {row.getVisibleCells().map(cell => (
                <TableCell
                  key={cell.id}
                  className="text-sm text-gray-700 py-2.5 whitespace-nowrap"
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// ─── Column Definitions ───────────────────────────────────────────────────────

function makeReadinessColumns(): ColumnDef<TrackerRow>[] {
  return [
    { id: 'demo_date', accessorFn: r => r.demo_date, header: 'Demo Date',
      cell: i => fmtDate(i.getValue<string>()) },
    { id: 'type', accessorFn: r => r.type, header: 'Type' },
    { id: 'organization', accessorFn: r => r.organization, header: 'Organization',
      cell: i => <span className="font-medium">{i.getValue<string>()}</span> },
    { id: 'geo', accessorFn: r => r.geo, header: 'Geo',
      cell: i => <GeoBadge geo={i.getValue<string>()} /> },
    { id: 'host', accessorFn: r => r.host, header: 'Host' },
    { id: 'lead_days', accessorFn: r => r.lead_days, header: 'Lead Days',
      cell: i => <span className="tabular-nums text-xs">{i.getValue<number>()}d</span> },
    { id: 'requester', accessorFn: r => r.requester, header: 'Requester' },
    { id: 'effectiveReadiness', accessorFn: r => r.effectiveReadiness, header: 'Date of Readiness',
      cell: i => {
        const v = i.getValue<string | null>()
        return v
          ? <span className="text-green-600 font-medium">{fmtDate(v)}</span>
          : <span className="text-gray-300">—</span>
      } },
  ]
}

function makeCompletedColumns(): ColumnDef<TrackerRow>[] {
  return [
    { id: 'demo_date', accessorFn: r => r.demo_date, header: 'Date',
      cell: i => fmtDate(i.getValue<string>()) },
    { id: 'type', accessorFn: r => r.type, header: 'Type' },
    { id: 'organization', accessorFn: r => r.organization, header: 'Organization',
      cell: i => <span className="font-medium">{i.getValue<string>()}</span> },
    { id: 'total_guests', accessorFn: r => r.total_guests, header: 'Guests',
      cell: i => <span className="tabular-nums">{i.getValue<number>()}</span> },
    { id: 'geo', accessorFn: r => r.geo, header: 'Geo',
      cell: i => <GeoBadge geo={i.getValue<string>()} /> },
    { id: 'host', accessorFn: r => r.host, header: 'Host' },
    { id: 'requester', accessorFn: r => r.requester, header: 'Requester' },
    { id: 'effectiveReadiness', accessorFn: r => r.effectiveReadiness, header: 'Date of Readiness',
      cell: i => {
        const v = i.getValue<string | null>()
        return v
          ? <span className="text-green-600 font-medium">{fmtDate(v)}</span>
          : <span className="text-gray-300">—</span>
      } },
  ]
}

function makeCancelledColumns(): ColumnDef<TrackerRow>[] {
  return [
    { id: 'demo_date', accessorFn: r => r.demo_date, header: 'Date',
      cell: i => fmtDate(i.getValue<string>()) },
    { id: 'geo', accessorFn: r => r.geo, header: 'Geo',
      cell: i => <GeoBadge geo={i.getValue<string>()} /> },
    { id: 'type', accessorFn: r => r.type, header: 'Type' },
    { id: 'requester', accessorFn: r => r.requester, header: 'Requester' },
    { id: 'organization', accessorFn: r => r.organization, header: 'Organization',
      cell: i => <span className="font-medium">{i.getValue<string>()}</span> },
    { id: 'cancel_reason', accessorFn: r => r.cancel_reason, header: 'Cancel Reason',
      cell: i => i.getValue<string | null>() ?? <span className="text-gray-300">—</span> },
  ]
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function TrackerTables({
  demos, readinessOverrides, onSelectDemo,
}: TrackerTablesProps) {
  const toRow = (d: DemoRequest): TrackerRow => ({
    ...d,
    effectiveReadiness: readinessOverrides[d.id] ?? d.readiness_date,
  })

  // APPROVED DEMOS = Reviewed, future (>= today)
  const approvedRows = useMemo<TrackerRow[]>(
    () => demos
      .filter(d => d.status === 'Reviewed' && d.demo_date >= TODAY)
      .sort((a, b) => a.demo_date.localeCompare(b.demo_date))
      .map(toRow),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [demos, readinessOverrides],
  )

  // COMPLETED DEMOS = Reviewed, past (< today)
  const completedRows = useMemo<TrackerRow[]>(
    () => demos
      .filter(d => d.status === 'Reviewed' && d.demo_date < TODAY)
      .sort((a, b) => b.demo_date.localeCompare(a.demo_date))
      .map(toRow),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [demos, readinessOverrides],
  )

  const cancelledRows = useMemo<TrackerRow[]>(
    () => demos
      .filter(d => d.status === 'Canceled')
      .sort((a, b) => b.demo_date.localeCompare(a.demo_date))
      .map(toRow),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [demos, readinessOverrides],
  )

  const readinessCols  = useMemo(makeReadinessColumns, [])
  const completedCols  = useMemo(makeCompletedColumns, [])
  const cancelledCols  = useMemo(makeCancelledColumns, [])

  return (
    <div className="space-y-4">
      {/* APPROVED DEMOS — Reviewed & upcoming */}
      <CollapsibleSection
        title="APPROVED DEMOS"
        count={approvedRows.length}
        accentColor="#0052FF"
      >
        <DataTable<TrackerRow>
          data={approvedRows}
          columns={readinessCols}
          onRowClick={row => onSelectDemo(row, 'default')}
        />
      </CollapsibleSection>

      {/* COMPLETED DEMOS — Reviewed & past */}
      <CollapsibleSection
        title="COMPLETED DEMOS"
        count={completedRows.length}
        accentColor="#10B981"
        defaultOpen={false}
      >
        <DataTable<TrackerRow>
          data={completedRows}
          columns={completedCols}
          onRowClick={row => onSelectDemo(row, 'completed')}
        />
      </CollapsibleSection>

      {/* CANCELLED DEMOS */}
      <CollapsibleSection
        title="CANCELLED DEMOS"
        count={cancelledRows.length}
        accentColor="#EF4444"
        defaultOpen={false}
      >
        <DataTable<TrackerRow>
          data={cancelledRows}
          columns={cancelledCols}
          onRowClick={row => onSelectDemo(row, 'completed')}
        />
      </CollapsibleSection>
    </div>
  )
}
