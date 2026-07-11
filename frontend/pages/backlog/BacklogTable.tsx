import { useState } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import type { BacklogItem } from './types'
import { getStatusConfig, getPriorityConfig } from './statusConfig'

interface BacklogTableProps {
  items:        BacklogItem[]
  onSelectItem: (item: BacklogItem) => void
}

type SortKey = 'company' | 'status' | 'priority' | 'preferred_demo_date' | 'host' | 'updated_at'
type SortDir = 'asc' | 'desc'

function StatusChip({ status }: { status: string }) {
  const cfg = getStatusConfig(status)
  return (
    <span
      className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border"
      style={{ background: cfg.bg, color: cfg.text, borderColor: cfg.border }}
    >
      {status}
    </span>
  )
}

function PriorityChip({ priority }: { priority: string | null }) {
  if (!priority) return <span className="text-gray-300 text-xs">—</span>
  const cfg = getPriorityConfig(priority)
  return (
    <span
      className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-md border"
      style={{ background: cfg.bg, color: cfg.text, borderColor: cfg.border }}
    >
      {priority.toUpperCase()}
    </span>
  )
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown className="w-3 h-3 text-gray-300" />
  return sortDir === 'asc'
    ? <ChevronUp   className="w-3 h-3 text-blue-500" />
    : <ChevronDown className="w-3 h-3 text-blue-500" />
}

function fmtUpdated(iso: string): string {
  try {
    const d = new Date(iso)
    const diff = Date.now() - d.getTime()
    const mins  = Math.floor(diff / 60_000)
    const hours = Math.floor(diff / 3_600_000)
    const days  = Math.floor(diff / 86_400_000)
    if (mins < 1)    return 'just now'
    if (mins < 60)   return `${mins}m ago`
    if (hours < 24)  return `${hours}h ago`
    if (days < 7)    return `${days}d ago`
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
  } catch { return '—' }
}

export default function BacklogTable({ items, onSelectItem }: BacklogTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('updated_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const sorted = [...items].sort((a, b) => {
    const av = (a[sortKey] ?? '') as string
    const bv = (b[sortKey] ?? '') as string
    const cmp = av.localeCompare(bv, undefined, { numeric: true })
    return sortDir === 'asc' ? cmp : -cmp
  })

  const TH = ({ label, col }: { label: string; col: SortKey }) => (
    <th
      className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400 cursor-pointer hover:text-gray-600 whitespace-nowrap select-none"
      onClick={() => handleSort(col)}
    >
      <div className="flex items-center gap-1">
        {label}
        <SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
      </div>
    </th>
  )

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <p className="text-sm font-medium">No backlog items match the current filters</p>
        <p className="text-xs mt-1">Try adjusting your filters or add a new item</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
      <table className="w-full">
        <thead className="bg-gray-50/80 border-b border-gray-100">
          <tr>
            <TH label="Status"         col="status"             />
            <TH label="Company"        col="company"            />
            <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400 whitespace-nowrap">Customer</th>
            <TH label="Priority"       col="priority"           />
            <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400 whitespace-nowrap">GEO</th>
            <TH label="Preferred Date" col="preferred_demo_date"/>
            <TH label="Host"           col="host"               />
            <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400 whitespace-nowrap">Purpose</th>
            <TH label="Updated"        col="updated_at"         />
          </tr>
        </thead>
        <tbody>
          {sorted.map((item, idx) => (
            <tr
              key={item.id}
              className={[
                'cursor-pointer transition-colors hover:bg-blue-50/40 border-b border-gray-50',
                idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30',
              ].join(' ')}
              onClick={() => onSelectItem(item)}
            >
              <td className="px-4 py-3 whitespace-nowrap">
                <StatusChip status={item.status} />
              </td>
              <td className="px-4 py-3">
                <span className="text-sm font-semibold text-gray-900">{item.company ?? '—'}</span>
              </td>
              <td className="px-4 py-3 max-w-[180px]">
                <span className="text-xs text-gray-500 line-clamp-1">{item.customer ?? '—'}</span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <PriorityChip priority={item.priority} />
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className="text-xs text-gray-600 font-medium">{item.geo ?? '—'}</span>
              </td>
              <td className="px-4 py-3 max-w-[140px]">
                <span className="text-xs text-gray-600 line-clamp-1">{item.preferred_demo_date ?? '—'}</span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className="text-xs text-gray-600">{item.host ?? '—'}</span>
              </td>
              <td className="px-4 py-3 max-w-[200px]">
                {item.demo_purpose ? (
                  <span className="text-xs text-gray-500 line-clamp-1">{item.demo_purpose}</span>
                ) : (
                  <span className="text-gray-300 text-xs">—</span>
                )}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className="text-xs text-gray-400">{fmtUpdated(item.updated_at)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
