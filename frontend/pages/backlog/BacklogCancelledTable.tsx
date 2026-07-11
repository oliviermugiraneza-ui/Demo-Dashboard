import { useState } from 'react'
import { ChevronDown, ChevronRight, XCircle } from 'lucide-react'
import type { BacklogItem } from './types'
import { getPriorityConfig } from './statusConfig'

interface BacklogCancelledTableProps {
  items:        BacklogItem[]
  onSelectItem: (item: BacklogItem) => void
}

function fmtUpdated(iso: string): string {
  try {
    const d = new Date(iso)
    const diff = Date.now() - d.getTime()
    const days = Math.floor(diff / 86_400_000)
    if (days < 1)  return 'today'
    if (days < 7)  return `${days}d ago`
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
  } catch { return '—' }
}

export default function BacklogCancelledTable({ items, onSelectItem }: BacklogCancelledTableProps) {
  const [collapsed, setCollapsed] = useState(true)

  return (
    <div className="rounded-xl border border-gray-100 shadow-sm bg-white overflow-hidden">

      {/* ── Section header with collapse toggle ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100" style={{ background: '#fee2e2' }}>
        <div className="flex items-center gap-2">
          <XCircle className="w-4 h-4 text-red-400" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-red-700">
            Cancelled
          </span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 min-w-[20px] text-center">
            {items.length}
          </span>
        </div>

        <button
          onClick={() => setCollapsed(c => !c)}
          className="flex items-center gap-1 text-xs text-red-400 hover:text-red-700 transition-colors select-none"
        >
          {collapsed ? (
            <>
              <span>Show</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </>
          ) : (
            <>
              <span>Collapse</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>

      {/* ── Table ── */}
      {!collapsed && (
        items.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-xs text-gray-400">
            No cancelled items
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100" style={{ background: '#e6edf2' }}>
                  <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">Company</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">Customer</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">Priority</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">GEO</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">Pref. Date</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">Host</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">Updated</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const pCfg = getPriorityConfig(item.priority)
                  return (
                    <tr
                      key={item.id}
                      className={[
                        'cursor-pointer hover:bg-red-50/30 border-b border-gray-50 transition-colors',
                        idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/20',
                      ].join(' ')}
                      onClick={() => onSelectItem(item)}
                    >
                      <td className="px-4 py-2.5">
                        <span className="text-sm font-semibold text-gray-800">{item.company ?? '—'}</span>
                      </td>
                      <td className="px-4 py-2.5 max-w-[160px]">
                        <span className="text-xs text-gray-500 line-clamp-1">{item.customer ?? '—'}</span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {item.priority ? (
                          <span
                            className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-md border"
                            style={{ background: pCfg.bg, color: pCfg.text, borderColor: pCfg.border }}
                          >
                            {item.priority.toUpperCase()}
                          </span>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="text-xs text-gray-600 font-medium">{item.geo ?? '—'}</span>
                      </td>
                      <td className="px-4 py-2.5 max-w-[140px]">
                        <span className="text-xs text-gray-600 line-clamp-1">{item.preferred_demo_date ?? '—'}</span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="text-xs text-gray-600">{item.host ?? '—'}</span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="text-xs text-gray-400">{fmtUpdated(item.updated_at)}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}
