import { useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../../lib/shadcn/collapsible'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../lib/shadcn/table'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { type PostDemoSession, type GeoCode } from '../data/sampleData'
import GeoBadge from '../../components/GeoBadge'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const INT_LABELS: Record<string, string> = {
  comfort_stop: 'Comfort Stop',
  disengagement: 'Disengagement',
  takeover: 'Takeover',
  collision_avoidance: 'Collision Avoid',
  blue_light: 'Blue Light',
  power_cycle: 'Power Cycle',
  ui_crash: 'UI Crash',
  gps_loss: 'GPS Loss',
}

function interventionSummary(inv: PostDemoSession['interventions']): string {
  const parts: string[] = []
  for (const [k, v] of Object.entries(inv)) {
    const n = v as number | undefined
    if (n && n > 0) parts.push(`${INT_LABELS[k] ?? k} (${n})`)
  }
  return parts.join(', ') || '—'
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface PostDemoSessionsProps {
  sessions: PostDemoSession[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PostDemoSessions({ sessions }: PostDemoSessionsProps) {
  const [open, setOpen] = useState(true)
  const [sorting, setSorting] = useState<SortingState>([{ id: 'demo_datetime', desc: true }])

  const data = useMemo(() => sessions.slice(0, 200), [sessions])

  const columns = useMemo<ColumnDef<PostDemoSession>[]>(() => [
    {
      id: 'demo_datetime',
      accessorFn: row => row.demo_datetime,
      header: 'Date',
      cell: ({ row }) => (
        <span className="font-mono text-xs text-gray-700">
          {row.original.demo_datetime.split('T')[0] ?? ''}
        </span>
      ),
    },
    {
      accessorKey: 'geo',
      header: 'Geo',
      cell: ({ row }) => <GeoBadge geo={row.original.geo as GeoCode} />,
    },
    {
      accessorKey: 'vehicle_id',
      header: 'Vehicle',
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.vehicle_id}</span>
      ),
    },
    {
      accessorKey: 'model',
      header: 'Model',
      cell: ({ row }) => (
        <span className="text-xs font-medium text-gray-700">{row.original.model}</span>
      ),
    },
    {
      id: 'issues',
      header: 'Issues',
      cell: ({ row }) => {
        const issues = row.original.active_issues_list
        if (issues.length === 0) {
          return <span className="text-xs italic text-gray-400">No issues</span>
        }
        return (
          <span className="text-xs font-bold text-red-600 leading-tight">
            {issues.join('; ')}
          </span>
        )
      },
    },
    {
      accessorKey: 'uds_count',
      header: 'UDs',
      cell: ({ row }) => {
        const v = row.original.uds_count
        return (
          <span className={`text-xs font-semibold ${v > 0 ? 'text-red-600' : 'text-gray-500'}`}>
            {v}
          </span>
        )
      },
    },
    {
      id: 'interventions',
      header: 'Interventions',
      cell: ({ row }) => (
        <span className="text-xs text-gray-600 max-w-[180px] truncate block">
          {interventionSummary(row.original.interventions)}
        </span>
      ),
    },
    {
      accessorKey: 'total_interventions',
      header: 'Int. Count',
      cell: ({ row }) => (
        <span className="text-xs font-semibold text-gray-700">
          {row.original.total_interventions}
        </span>
      ),
    },
    {
      accessorKey: 'operator',
      header: 'Operator',
      cell: ({ row }) => (
        <span className="text-xs text-gray-700">{row.original.operator}</span>
      ),
    },
  ], [])

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <CollapsibleTrigger asChild>
          <button
            className="flex items-center justify-between w-full px-5 py-3.5 border-b
                       border-gray-100 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-800">All Demo Sessions</span>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                {data.length} sessions
              </span>
            </div>
            {open
              ? <ChevronUp className="w-4 h-4 text-gray-400" />
              : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10">
                {table.getHeaderGroups().map(hg => (
                  <TableRow key={hg.id} className="bg-gray-50 hover:bg-gray-50">
                    {hg.headers.map(h => (
                      <TableHead
                        key={h.id}
                        className="text-xs font-semibold text-gray-500 uppercase tracking-wider
                                   whitespace-nowrap cursor-pointer select-none py-2.5"
                        onClick={h.column.getToggleSortingHandler()}
                      >
                        <span className="flex items-center gap-1">
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {h.column.getIsSorted() === 'asc' && <span className="text-blue-500 text-xs">↑</span>}
                          {h.column.getIsSorted() === 'desc' && <span className="text-blue-500 text-xs">↓</span>}
                          {h.column.getCanSort() && !h.column.getIsSorted() && (
                            <span className="text-gray-300 text-xs">↕</span>
                          )}
                        </span>
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row, idx) => (
                  <TableRow
                    key={row.id}
                    className={idx % 2 === 0 ? 'bg-white hover:bg-blue-50/20' : 'bg-gray-50/50 hover:bg-blue-50/20'}
                  >
                    {row.getVisibleCells().map(cell => (
                      <TableCell key={cell.id} className="py-2 pr-4">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
