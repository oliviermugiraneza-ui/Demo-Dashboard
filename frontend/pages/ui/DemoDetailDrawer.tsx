import { type ReactNode } from 'react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '../../lib/shadcn/sheet'
import { Button } from '../../lib/shadcn/button'
import {
  AlertTriangle, ExternalLink, Calendar, Users, Car,
  FileText, Link2, CheckCircle2, Clock, User, MapPin,
} from 'lucide-react'
import { type DemoRequest, leadBand } from '../data/sampleData'
import GeoBadge from '../../components/GeoBadge'
import StatusBadge from '../../components/StatusBadge'

// ─── Props ────────────────────────────────────────────────────────────────────

interface DemoDetailDrawerProps {
  demo: DemoRequest | null
  open: boolean
  onClose: () => void
  readinessOverrides: Record<string, string>
  onMarkReady: (id: string) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDate().toString().padStart(2, '0')
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  return `${day}-${month}-${d.getFullYear()}`
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
  demo, open, onClose, readinessOverrides, onMarkReady,
}: DemoDetailDrawerProps) {
  if (!demo) return null

  const effectiveReadiness = readinessOverrides[demo.id] ?? demo.readiness_date
  const delayed = demo.lead_days < 3 && demo.status !== 'Canceled' && demo.status !== 'DELETED'
  const band = leadBand(demo.lead_days)
  const pct = Math.min(100, Math.round((demo.lead_days / 21) * 100))

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose() }}>
      <SheetContent
        side="right"
        className="w-[460px] sm:max-w-[460px] overflow-y-auto p-0 flex flex-col"
      >
        {/* ── Header ── */}
        <div className="px-6 pt-8 pb-4 border-b border-gray-100 bg-white">
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
          {/* Delay alert */}
          {delayed && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              DELAYED — only {demo.lead_days} {demo.lead_days === 1 ? 'day' : 'days'} lead time
            </div>
          )}

          {/* When */}
          <div>
            <SectionLabel icon={<Calendar className="w-3.5 h-3.5" />}>When</SectionLabel>
            <Row label="Date" value={fmtDate(demo.demo_date)} />
            <Row label="Start" value={demo.start_time} />
            <Row label="End" value={demo.end_time} />
          </div>

          {/* Who */}
          <div>
            <SectionLabel icon={<User className="w-3.5 h-3.5" />}>Who</SectionLabel>
            <Row label="Requester" value={demo.requester} />
            <Row label="Host" value={demo.host} />
            <Row label="Approver" value={demo.approver || '—'} />
          </div>

          {/* Where */}
          <div>
            <SectionLabel icon={<MapPin className="w-3.5 h-3.5" />}>Where</SectionLabel>
            <Row label="Region" value={demo.geo} />
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

          {/* Links */}
          {demo.slack_link && (
            <div>
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
            </div>
          )}

          {/* Lead Time bar */}
          <div>
            <SectionLabel icon={<Clock className="w-3.5 h-3.5" />}>Lead Time</SectionLabel>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl font-bold tabular-nums" style={{ color: band.color }}>
                {demo.lead_days}d
              </span>
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded"
                style={{ backgroundColor: `${band.color}1A`, color: band.color }}
              >
                {band.label}
              </span>
            </div>
            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: band.color }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>0d</span>
              <span className="text-center">7d</span>
              <span>21d+</span>
            </div>
          </div>

          {/* Readiness */}
          <div className="pb-2">
            {effectiveReadiness ? (
              <div className="inline-flex items-center gap-2 px-3 py-2.5 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm font-semibold w-full">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Ready — Marked {fmtDate(effectiveReadiness)}
              </div>
            ) : (
              <Button
                onClick={() => onMarkReady(demo.id)}
                className="w-full bg-[#0052FF] hover:bg-[#0040CC] text-white"
                size="sm"
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                Mark as Ready
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
