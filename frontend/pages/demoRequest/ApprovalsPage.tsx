import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Clock, Users, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../../lib/shadcn/button'
import { Textarea } from '../../lib/shadcn/textarea'
import { Label } from '../../lib/shadcn/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../lib/shadcn/dialog'
import { useListDemoRequests, useReviewDemoRequest, useGetDemoRequestStats } from '../../hooks/backend/demoRequests'
import { fmtDate, fmtTime, fmtRelative, type DemoRequestRow } from './data/fieldHelpers'
import DRStatusBadge from './ui/DRStatusBadge'

// ─── Stat chip ────────────────────────────────────────────────────────────────

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2 px-3.5 py-2 rounded-lg border bg-white shadow-sm">
      <span className="text-xl font-bold tabular-nums" style={{ color }}>{value}</span>
      <span className="text-xs text-gray-500 font-medium">{label}</span>
    </div>
  )
}

// ─── Reject dialog ────────────────────────────────────────────────────────────

function RejectDialog({
  open, org, onClose, onConfirm,
}: { open: boolean; org: string; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState('')
  useEffect(() => { if (!open) setReason('') }, [open])

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Reject — {org}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-1">
          <p className="text-sm text-muted-foreground">
            Optionally explain the rejection reason. This will be visible in the request description.
          </p>
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">Reason (optional)</Label>
            <Textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Vehicle unavailable on requested date…"
              rows={3}
              className="text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Back</Button>
          <Button size="sm" variant="destructive" onClick={() => { onConfirm(reason); onClose() }}>
            Confirm Rejection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ApprovalsPage() {
  const { data: listData, loading, trigger: fetchList } = useListDemoRequests()
  const { data: statsData, trigger: fetchStats } = useGetDemoRequestStats()
  const { trigger: review, loading: reviewing } = useReviewDemoRequest()

  const [rejectTarget, setRejectTarget] = useState<DemoRequestRow | null>(null)

  const rows = ((listData as { data?: unknown[] } | null)?.data ?? []) as DemoRequestRow[]
  const pending = rows.filter(r => r.status === 'pending')

  const stats = statsData as { pending: number; approved: number; rejected: number; completed: number } | null

  useEffect(() => {
    void fetchList({ status: 'pending', pageSize: 50 })
    void fetchStats()
  }, [])

  async function handleApprove(row: DemoRequestRow) {
    try {
      await review({ id: row.id, decision: 'approve' })
      toast.success('Request approved', { description: row.guests_organization ?? row.demo_type })
      void fetchList({ status: 'pending', pageSize: 50 })
      void fetchStats()
    } catch {
      toast.error('Failed to approve — try again.')
    }
  }

  async function handleReject(row: DemoRequestRow, reason: string) {
    try {
      await review({ id: row.id, decision: 'reject', reason })
      toast.success('Request rejected')
      void fetchList({ status: 'pending', pageSize: 50 })
      void fetchStats()
    } catch {
      toast.error('Failed to reject — try again.')
    }
  }

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      {/* Stats row */}
      <div className="flex items-center gap-3 flex-wrap">
        <StatChip label="Pending"   value={stats?.pending   ?? 0} color="#D97706" />
        <StatChip label="APPROVED"  value={stats?.approved  ?? 0} color="#059669" />
        <StatChip label="Rejected"  value={stats?.rejected  ?? 0} color="#DC2626" />
        <StatChip label="COMPLETED" value={stats?.completed ?? 0} color="#2563EB" />
        <Button variant="ghost" size="sm" className="ml-auto gap-1.5 text-gray-400 hover:text-gray-700"
          onClick={() => { void fetchList({ status: 'pending', pageSize: 50 }); void fetchStats() }}>
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {/* Pending list */}
      <section>
        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-500" />
          Pending Requests
          {pending.length > 0 && (
            <span className="bg-amber-100 text-amber-700 text-[11px] font-bold px-2 py-0.5 rounded-full">
              {pending.length}
            </span>
          )}
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400 text-sm gap-2">
            <span className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-amber-500 rounded-full" />
            Loading pending requests…
          </div>
        ) : pending.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
            <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-500">All caught up — no pending requests!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pending.map(req => (
              <div key={req.id}
                className="bg-white rounded-xl border border-amber-100 shadow-sm px-4 py-3
                           flex flex-col sm:flex-row sm:items-center gap-3">
                {/* Type + org */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <DRStatusBadge status={req.status} />
                    <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                      {req.demo_type}
                    </span>
                    <span className="text-xs text-gray-400">{req.geo}</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {req.guests_organization || '(no organisation)'}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5 flex-wrap">
                    <span>{fmtDate(req.date_of_demo)} · {fmtTime(req.demo_start_time)} – {fmtTime(req.demo_end_time)}</span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" /> {req.total_guests} guests
                    </span>
                    <span>by <strong className="text-gray-600">{req.requester}</strong></span>
                    <span>{fmtRelative(req.created_at)}</span>
                  </div>
                  {req.description && (
                    <p className="text-xs text-gray-500 italic mt-1 line-clamp-1">{req.description}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    disabled={reviewing}
                    className="h-8 px-3 gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => handleApprove(req)}
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Approve
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={reviewing}
                    className="h-8 px-3 gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => setRejectTarget(req)}
                  >
                    <XCircle className="w-3.5 h-3.5" /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Reject dialog */}
      <RejectDialog
        open={rejectTarget !== null}
        org={rejectTarget?.guests_organization ?? rejectTarget?.demo_type ?? ''}
        onClose={() => setRejectTarget(null)}
        onConfirm={reason => { if (rejectTarget) void handleReject(rejectTarget, reason) }}
      />
    </div>
  )
}
