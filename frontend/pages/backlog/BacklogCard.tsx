import { Calendar, User, MapPin, Building2 } from 'lucide-react'
import type { BacklogItem } from './types'
import { getStatusConfig, getPriorityConfig } from './statusConfig'

interface BacklogCardProps {
  item:      BacklogItem
  onClick:   (item: BacklogItem) => void
  onDragStart: (e: React.DragEvent, item: BacklogItem) => void
}

export default function BacklogCard({ item, onClick, onDragStart }: BacklogCardProps) {
  const priorityCfg = getPriorityConfig(item.priority)

  const displayDate = item.preferred_demo_date
    ? item.preferred_demo_date.length > 20
      ? item.preferred_demo_date.slice(0, 20) + '…'
      : item.preferred_demo_date
    : null

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, item)}
      onClick={() => onClick(item)}
      className="group bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md
                 hover:border-gray-200 transition-all duration-150 cursor-pointer select-none overflow-hidden"
      style={{ borderLeft: `3px solid ${getStatusConfig(item.status).accent}` }}
    >
      {/* Priority + GEO strip */}
      <div className="px-3 pt-3 flex items-center gap-1.5 flex-wrap">
        {item.priority && (
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-md border"
            style={{ background: priorityCfg.bg, color: priorityCfg.text, borderColor: priorityCfg.border }}
          >
            {item.priority.toUpperCase()}
          </span>
        )}
        {item.geo && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-gray-500 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded-md">
            <MapPin className="w-2.5 h-2.5" />
            {item.geo}
          </span>
        )}
        {item.demo_type && (
          <span className="text-[10px] font-medium text-purple-600 bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded-md">
            {item.demo_type}
          </span>
        )}
      </div>

      {/* Company */}
      <div className="px-3 pt-2">
        <div className="flex items-start gap-1.5">
          <Building2 className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm font-semibold text-gray-900 leading-tight line-clamp-1">
            {item.company ?? '—'}
          </p>
        </div>
        {item.customer && (
          <p className="text-[11px] text-gray-500 mt-0.5 leading-tight line-clamp-2 pl-5">
            {item.customer}
          </p>
        )}
      </div>

      {/* Divider */}
      <div className="mx-3 mt-2.5 border-t border-gray-50" />

      {/* Meta rows */}
      <div className="px-3 py-2.5 space-y-1.5">
        {displayDate && (
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
            <Calendar className="w-3 h-3 text-gray-400 flex-shrink-0" />
            <span className="truncate">{displayDate}</span>
            {item.preferred_time && (
              <span className="text-gray-400 flex-shrink-0">· {item.preferred_time.slice(0, 11)}</span>
            )}
          </div>
        )}

        {item.host && (
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
            <User className="w-3 h-3 text-gray-400 flex-shrink-0" />
            <span className="truncate">{item.host}</span>
          </div>
        )}

      </div>
    </div>
  )
}
