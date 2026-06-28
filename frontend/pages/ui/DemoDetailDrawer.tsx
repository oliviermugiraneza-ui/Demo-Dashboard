import { type ReactNode } from 'react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '../../lib/shadcn/sheet'
import {
  ExternalLink, Calendar, Users, Car,
  FileText, Link2, CheckCircle2, User, MapPin,
  RotateCcw, ThumbsUp, XCircle, Pencil,
} from 'lucide-react'
import { type DemoRequest } from '../data/sampleData'
import GeoBadge from '../../components/GeoBadge'
import StatusBadge from '../../components/StatusBadge'
import {
  type DrawerContext, getActionConfig, statusToColKey,
} from './cockpitActions'

// ─── Props — all action handlers are optional ─────────────────────────────────
// When context = 'completed' or handlers are omitted, the action footer is hidden.

interface DemoDetailDrawerProps {
  demo:               DemoRequest | null
  open:               boolean
  onClose:            () => void
  readinessOverrides: Record<string, string>
  context?:           DrawerContext
  onApprove?:         (id: string) => void
  onCancel?:          (id: string) => void
  onReschedule?:      (id: string) => void
  onEdit?:            (id: string) => void
  onMarkReady?:       (id: string) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()}`
}

function SectionLabel({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
      {icon}
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="grid grid-cols-[90px_1fr] gap-x-3 text-sm py-0.5">
      <span className="text-gray-400 shrink-0">{label}</span>
      <span className="text-gray-800 font-medium break-words">{value ?? '—'}</span>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DemoDetailDrawer({
  demo, open, onClose, readinessOverrides,
  context = 'default',
  onApprove, onCancel, onReschedule, onEdit, onMarkReady,
}: DemoDetailDrawerProps) {
  if (!demo) return null

  const effectiveReadiness = readinessOverrides[demo.id] ?? demo.readiness_date
  const hasReadiness = effectiveReadiness !== null

  const colKey = statusToColKey(demo.status)
  const cfg    = getActionConfig(colKey, hasReadiness, context)

  // Show the action footer only when at least one action is available
  const hasAnyAction = cfg.showReschedule || cfg.showApprove || cfg.showCancel || cfg.showEdit || cfg.showMarkReady

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose() }}>
      <SheetContent
        side="right"
        className="w-[460px] sm:max-w-[460px] overflow-y-auto p-0 flex flex-col"
      >
        {/* ── Header ── */}
        <div className="px-6 pt-8 pb-4 border-b border-border bg-white">
          <SheetHeader>
            <SheetTitle className="text-base font-bold text-gray-900 leading-tight pr-8">
              {demo.organization}
            </SheetTitle>
          </SheetHeader>
          <div className="flex items-center gap-2 flex-wrap mt-2.5">
            <StatusBadge status={demo.status} />
            <span className="inline-flex items-center text-xs px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-medium border border-purple-100">
              {demo.type}
            </span>
            <GeoBadge geo={demo.geo} size="md" />
          </div>
        </div>

        {/* ── Body ── */}
        <div className="px-6 py-4 space-y-5 flex-1">

          {/* When */}
          <div>
            <SectionLabel icon={<Calendar className="w-3.5 h-3.5" />}>When</SectionLabel>
            <Row label="Date"  value={fmtDate(demo.demo_date)} />
            <Row label="Start" value={demo.start_time} />
            <Row label="End"   value={demo.end_time} />
          </div>

          {/* Who */}
          <div>
            <SectionLabel icon={<User className="w-3.5 h-3.5" />}>Who</SectionLabel>
            <Row label="Requester" value={demo.requester} />
            <Row label="Host"      value={demo.host} />
            <Row label="Approver"  value={demo.approver || '—'} />
          </div>

          {/* Where */}
          <div>
            <SectionLabel icon={<MapPin className="w-3.5 h-3.5" />}>Where</SectionLabel>
            <Row label="Region"  value={demo.geo} />
            <Row label="Vehicle" value={demo.vehicle_type} />
            <Row label="Channel" value={demo.channel} />
          </div>

          {/* What */}
          <div>
            <SectionLabel icon={<FileText className="w-3.5 h-3.5" />}>What</SectionLabel>
            <div className="grid grid-cols-2 gap-x-3 text-sm mb-1.5">
              <div className="flex items-center gap-1.5 text-gray-600">
                <Users className="w-3.5 h-3.5 text-gray-400" />
                {demo.total_guests} guests
              </div>
              <div className="flex items-center gap-1.5 text-gray-600">
                <Car className="w-3.5 h-3.5 text-gray-400" />
                {demo.total_vehicles} vehicle{demo.total_vehicles !== 1 ? 's' : ''}
              </div>
            </div>
            <p className="text-sm text-gray-500 italic leading-snug">{demo.description}</p>
          </div>

          {/* Cancellation reason */}
          {colKey === 'cancelled' && (
            <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-200">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-red-400 mb-0.5">
                Cancellation Reason
              </p>
              <p className="text-sm text-red-700 font-medium">
                {demo.cancel_reason || 'Not specified'}
              </p>
            </div>
          )}

          {/* Links + Actions — no gap between them */}
          <div>
            {demo.slack_link && (
              <>
                <SectionLabel icon={<Link2 className="w-3.5 h-3.5" />}>Links</SectionLabel>
                <a
                  href={demo.slack_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open in Slack
                </a>
              </>
            )}

            {/* Actions — directly below links, no gap */}
            {hasAnyAction && (
              <div className={demo.slack_link ? 'mt-3' : ''}>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
                  Actions
                </p>
                <div className="flex flex-wrap gap-2">
                  {cfg.showReschedule && onReschedule && (
                    <button
                      onClick={() => { onReschedule(demo.id); onClose() }}
                      className="flex items-center gap-1.5 h-9 px-3 text-sm font-medium rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reschedule
                    </button>
                  )}
                  {cfg.showApprove && onApprove && (
                    <button
                      onClick={() => { onApprove(demo.id); onClose() }}
                      className="flex items-center gap-1.5 h-9 px-3 text-sm font-medium rounded-lg border border-green-200 bg-green-50 hover:bg-green-100 text-green-700 transition-colors"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                      Approve
                    </button>
                  )}
                  {cfg.showCancel && onCancel && (
                    <button
                      onClick={() => { onCancel(demo.id); onClose() }}
                      className="flex items-center gap-1.5 h-9 px-3 text-sm font-medium rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Cancel
                    </button>
                  )}
                  {cfg.showEdit && onEdit && (
                    <button
                      onClick={() => { onEdit(demo.id); onClose() }}
                      className="flex items-center gap-1.5 h-9 px-3 text-sm font-medium rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </button>
                  )}
                  {cfg.showMarkReady && onMarkReady && (
                    <button
                      onClick={() => onMarkReady(demo.id)}
                      className="flex items-center gap-1.5 h-9 px-3 text-sm font-medium rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Mark Ready
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Readiness display */}
          {colKey === 'reviewed' && hasReadiness && (
            <div className="inline-flex items-center gap-2 px-3 py-2.5 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm font-semibold w-full">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Ready — Marked {fmtDate(effectiveReadiness!)}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
