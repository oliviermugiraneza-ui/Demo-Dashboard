import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { BacklogItem, BacklogStatus } from './types'
import { KANBAN_STATUSES } from './types'
import { getStatusConfig } from './statusConfig'
import BacklogCard from './BacklogCard'

// ─── Date parser for preferred_demo_date (text field, many formats) ───────────

export function parseBacklogDate(text: string | null): Date | null {
  if (!text) return null
  const s = text.trim()

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s.slice(0, 10) + 'T00:00:00')
    return isNaN(d.getTime()) ? null : d
  }

  // D/M/YYYY or DD/MM/YYYY
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (slash) {
    const d = new Date(`${slash[3]}-${slash[2]!.padStart(2,'0')}-${slash[1]!.padStart(2,'0')}T00:00:00`)
    return isNaN(d.getTime()) ? null : d
  }

  // "D Month YYYY" or "Dth Month"
  const named = s.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*,?\s*(\d{4})/i)
  if (named) {
    const months: Record<string, string> = {
      jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
      jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12',
    }
    const m = months[named[2]!.toLowerCase().slice(0, 3)]
    if (m) {
      const d = new Date(`${named[3]}-${m}-${named[1]!.padStart(2,'0')}T00:00:00`)
      return isNaN(d.getTime()) ? null : d
    }
  }

  return null
}

function sortByDate(items: BacklogItem[]): BacklogItem[] {
  return [...items].sort((a, b) => {
    const da = parseBacklogDate(a.preferred_demo_date)
    const db = parseBacklogDate(b.preferred_demo_date)
    if (!da && !db) return 0
    if (!da) return 1
    if (!db) return -1
    return da.getTime() - db.getTime()
  })
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface BacklogKanbanProps {
  items:           BacklogItem[]
  onSelectItem:    (item: BacklogItem) => void
  onStatusChange:  (item: BacklogItem, newStatus: BacklogStatus) => Promise<void>
  onAddNew:        (defaultStatus: BacklogStatus) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BacklogKanban({
  items, onSelectItem, onStatusChange, onAddNew,
}: BacklogKanbanProps) {
  const [dragItem,   setDragItem]   = useState<BacklogItem | null>(null)
  const [dropTarget, setDropTarget] = useState<BacklogStatus | null>(null)

  // Group items by status (only KANBAN_STATUSES — Completed shown separately)
  const byStatus: Record<BacklogStatus, BacklogItem[]> = {
    Proposed:  [], Requested: [], Arranging: [],
    Confirmed: [], Completed: [], CANCELED: [], Converted: [],
  }
  for (const item of items) {
    const s = item.status as BacklogStatus
    if (byStatus[s] !== undefined) byStatus[s].push(item)
    else byStatus.Proposed.push(item)
  }

  const handleDragStart = (e: React.DragEvent, item: BacklogItem) => {
    setDragItem(item)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, status: BacklogStatus) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropTarget(status)
  }

  const handleDrop = async (e: React.DragEvent, status: BacklogStatus) => {
    e.preventDefault()
    setDropTarget(null)
    if (dragItem && dragItem.status !== status) {
      await onStatusChange(dragItem, status)
    }
    setDragItem(null)
  }

  const handleDragEnd = () => {
    setDragItem(null)
    setDropTarget(null)
  }

  return (
    <div className="grid gap-4 pb-4" style={{ gridTemplateColumns: `repeat(${KANBAN_STATUSES.length}, minmax(200px, 1fr))` }}>
      {KANBAN_STATUSES.map(status => {
        const cfg      = getStatusConfig(status)
        const colItems = sortByDate(byStatus[status])
        const isTarget = dropTarget === status

        return (
          <div
            key={status}
            className="flex flex-col min-w-0 rounded-xl"
            onDragOver={e => handleDragOver(e, status)}
            onDrop={e => handleDrop(e, status)}
            onDragLeave={() => { if (dropTarget === status) setDropTarget(null) }}
          >
            {/* Column header */}
            <div
              className="flex items-center justify-between px-3 py-2.5 rounded-t-xl mb-2"
              style={{ background: cfg.headerBg }}
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.accent }} />
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: cfg.headerText }}>
                  {status}
                </span>
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
                  style={{ background: cfg.accent + '25', color: cfg.accent }}
                >
                  {colItems.length}
                </span>
              </div>
              <button
                onClick={() => onAddNew(status)}
                className="p-1 rounded-md hover:bg-black/5 transition-colors"
                title={`Add ${status} item`}
              >
                <Plus className="w-3.5 h-3.5" style={{ color: cfg.accent }} />
              </button>
            </div>

            {/* Cards — max 5 visible, scroll for more */}
            <div
              className={[
                'min-h-[200px] overflow-y-auto flex flex-col gap-2.5 p-1 rounded-b-xl rounded-lg transition-all duration-150',
                isTarget ? 'ring-2 ring-blue-300 ring-offset-1 bg-blue-50/30' : '',
              ].join(' ')}
              style={{ maxHeight: 720 }}
            >
              {colItems.length === 0 ? (
                <div
                  className={[
                    'flex-1 flex items-center justify-center text-[11px] rounded-xl border-2 border-dashed min-h-[120px] transition-all',
                    isTarget ? 'border-blue-400 text-blue-400 bg-blue-50' : 'border-gray-100 text-gray-300',
                  ].join(' ')}
                >
                  {isTarget ? '← Drop here' : 'No items'}
                </div>
              ) : (
                colItems.map(item => (
                  <div key={item.id} onDragEnd={handleDragEnd}>
                    <BacklogCard
                      item={item}
                      onClick={onSelectItem}
                      onDragStart={handleDragStart}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
