import { useState, useEffect } from 'react'
import {
  RefreshCw, Mail, Hash, CheckCircle2, XCircle, AlertTriangle,
  Slack, Send, Info, Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../lib/shadcn/button'
import {
  useNotificationsConfig,
  useNotificationLog,
  useSendTestNotification,
} from '../hooks/backend/notifications'

// ─── Small helpers ────────────────────────────────────────────────────────────

function StatusDot({ ok, label, description }: { ok: boolean; label: string; description: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
      <div>
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>
      <span className={[
        'flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full',
        ok
          ? 'bg-green-50 text-green-700'
          : 'bg-red-50 text-red-600',
      ].join(' ')}>
        {ok
          ? <CheckCircle2 className="w-3 h-3" />
          : <XCircle      className="w-3 h-3" />}
        {ok ? 'Configured' : 'Missing'}
      </span>
    </div>
  )
}

function ToggleDot({ on, label, description }: { on: boolean; label: string; description: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
      <div>
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>
      <span className={[
        'flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full',
        on ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-500',
      ].join(' ')}>
        {on ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
        {on ? 'On' : 'Off'}
      </span>
    </div>
  )
}

function BoolDot({ ok, label, description, onLabel = 'Enabled', offLabel = 'Disabled' }: {
  ok: boolean; label: string; description: string; onLabel?: string; offLabel?: string
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
      <div>
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>
      <span className={[
        'flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full',
        ok ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500',
      ].join(' ')}>
        {ok ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
        {ok ? onLabel : offLabel}
      </span>
    </div>
  )
}

function formatTs(raw: string | null): string {
  if (!raw) return '—'
  try {
    return new Date(raw).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
  } catch { return raw }
}

function ChannelBadge({ channel }: { channel: string | null }) {
  if (channel === 'email') {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full w-fit">
        <Mail className="w-3 h-3" /> Email
      </span>
    )
  }
  if (channel === 'slack') {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full w-fit">
        <Hash className="w-3 h-3" /> Slack
      </span>
    )
  }
  return <span className="text-xs text-gray-400">{channel ?? '—'}</span>
}

function SuccessBadge({ success }: { success: boolean | null }) {
  if (success === null) return <span className="text-xs text-gray-400">—</span>
  return success
    ? <CheckCircle2 className="w-4 h-4 text-green-500" />
    : <XCircle      className="w-4 h-4 text-red-500" />
}

// ─── Gmail API card ───────────────────────────────────────────────────────────

function GmailApiCard() {
  const config  = useNotificationsConfig()
  const tester  = useSendTestNotification()
  const log     = useNotificationLog(50)

  const [lastResult, setLastResult] = useState<{ ok: boolean; dryRun: boolean } | null>(null)

  useEffect(() => { void config.fetch() }, [])

  async function handleTest() {
    await tester.send({ channel: 'email', message: 'Manual connectivity test from Notifications settings page.' })

    const r = tester.result
    if (r) {
      setLastResult({ ok: r.ok, dryRun: r.dryRun })
      if (r.ok) {
        toast.success(r.dryRun ? 'Dry run — payload logged (no email sent)' : 'Test email sent successfully')
      } else {
        toast.error(r.error ?? 'Failed to send test email')
      }
      void log.fetch()
    }
  }

  const cfg = config.data
  const allConfigured = cfg
    ? cfg.gmailClientConfigured && cfg.gmailRefreshTokenConfigured && cfg.emailFromConfigured
    : false

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
        <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
          <Mail className="w-[18px] h-[18px] text-blue-600" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-gray-900">Gmail API</h3>
            {allConfigured && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-2.5 h-2.5" /> Connected
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">Email via OAuth2 · Gmail API</p>
        </div>
        <Button variant="ghost" size="sm" className="ml-auto gap-1.5 text-gray-400 hover:text-gray-700 text-xs"
          onClick={() => void config.fetch()}>
          <RefreshCw className="w-3 h-3" /> Refresh
        </Button>
      </div>

      {/* Config status */}
      <div className="px-5 py-3">
        {config.loading && (
          <div className="flex items-center gap-2 text-xs text-gray-400 py-3">
            <span className="w-3.5 h-3.5 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
            Loading configuration…
          </div>
        )}
        {cfg && (
          <>
            <BoolDot
              ok={cfg.enabled}
              label="Notifications"
              description="NOTIFICATIONS_ENABLED"
              onLabel="Enabled"
              offLabel="Disabled"
            />
            <StatusDot
              ok={cfg.gmailClientConfigured}
              label="Client credentials"
              description="GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET"
            />
            <StatusDot
              ok={cfg.gmailRefreshTokenConfigured}
              label="Refresh token"
              description="GOOGLE_REFRESH_TOKEN — run npm run get-gmail-token to generate"
            />
            <StatusDot
              ok={cfg.emailFromConfigured}
              label="From address"
              description="EMAIL_FROM"
            />
            <ToggleDot
              on={cfg.dryRun}
              label="Dry Run"
              description="NOTIFICATION_DRY_RUN — no email will be sent"
            />
          </>
        )}
      </div>

      {/* Dry run banner */}
      {cfg?.dryRun && (
        <div className="mx-5 mb-3 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
          <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span className="text-xs font-semibold text-amber-700">DRY RUN — No email will be sent. Payload is logged only.</span>
        </div>
      )}

      {/* Test form */}
      <div className="px-5 pb-5 pt-2 border-t border-gray-100 bg-gray-50">
        <p className="text-xs font-semibold text-gray-600 mb-1">Send Test Email</p>
        <p className="text-[11px] text-gray-400 mb-3">Sends a connectivity test to the configured test recipient.</p>
        <Button
          size="sm"
          className="h-9 gap-1.5 bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-xs font-semibold"
          disabled={tester.loading}
          onClick={() => void handleTest()}
        >
          {tester.loading
            ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <Send className="w-3.5 h-3.5" />}
          {tester.loading ? 'Sending…' : 'Test Email'}
        </Button>

        {/* Result feedback */}
        {lastResult && (
          <div className={[
            'mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium border',
            lastResult.ok
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-700',
          ].join(' ')}>
            {lastResult.ok
              ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
              : <XCircle      className="w-3.5 h-3.5 flex-shrink-0" />}
            {lastResult.ok
              ? (lastResult.dryRun ? 'Dry run complete — email payload logged, no email sent.' : 'Test email sent successfully.')
              : (tester.error ?? 'Notification failed. Check the log below.')}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Slack card ───────────────────────────────────────────────────────────────

function SlackCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
        <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
          <Slack className="w-[18px] h-[18px] text-purple-600" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-gray-900">Slack</h3>
          <p className="text-xs text-gray-400 mt-0.5">Incoming Webhook integration</p>
        </div>
      </div>

      <div className="px-5 py-5">
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-lg px-3 py-3 mb-4">
          <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span className="text-xs text-gray-500">Waiting for Slack Incoming Webhook approval.</span>
        </div>
        <div className="flex items-center gap-2 py-2">
          <span className="text-sm font-medium text-gray-400">Webhook URL</span>
          <span className="flex items-center gap-1 text-xs font-semibold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
            <XCircle className="w-3 h-3" /> Not configured
          </span>
        </div>
      </div>

      <div className="px-5 pb-5 pt-2 border-t border-gray-100 bg-gray-50">
        <p className="text-xs font-semibold text-gray-600 mb-3">Send Test Message</p>
        <Button
          size="sm"
          className="h-9 gap-1.5 text-xs font-semibold"
          disabled
          variant="outline"
        >
          <Hash className="w-3.5 h-3.5" /> Test Slack
        </Button>
        <p className="text-[11px] text-gray-400 mt-2">Available once SLACK_WEBHOOK_URL is configured.</p>
      </div>
    </div>
  )
}

// ─── Notification History ─────────────────────────────────────────────────────

const LOG_COLS = ['Time', 'Channel', 'Event', 'Recipient', 'Success', 'Error']
const LOG_GRID = 'grid-cols-[160px_100px_160px_minmax(160px,1fr)_70px_minmax(120px,1fr)]'

function NotificationHistory() {
  const log = useNotificationLog(50)

  useEffect(() => { void log.fetch() }, [])

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Notification History</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {log.total > 0 ? `${log.total} total entries` : 'No entries yet'}
          </p>
        </div>
        <Button variant="ghost" size="sm" className="gap-1.5 text-gray-400 hover:text-gray-700 text-xs"
          onClick={() => void log.fetch()}>
          <RefreshCw className="w-3 h-3" /> Refresh
        </Button>
      </div>

      {/* Column headers */}
      <div className={`grid ${LOG_GRID} px-5 py-2.5 bg-gray-50 border-b border-gray-100`}>
        {LOG_COLS.map(col => (
          <div key={col} className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{col}</div>
        ))}
      </div>

      {/* Rows */}
      <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
        {log.loading ? (
          <div className="flex items-center justify-center py-10 text-gray-400 text-sm gap-2">
            <span className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
            Loading…
          </div>
        ) : log.data.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">
            No notifications logged yet. Send a test email to get started.
          </div>
        ) : log.data.map(row => (
          <div key={row.id} className={`grid ${LOG_GRID} items-center px-5 py-3 hover:bg-gray-50 transition-colors`}>
            <div className="text-xs text-gray-500 font-mono tabular-nums">{formatTs(row.created_at)}</div>
            <div><ChannelBadge channel={row.channel} /></div>
            <div className="text-xs text-gray-700 truncate pr-2">{row.event_type ?? '—'}</div>
            <div className="text-xs text-gray-500 truncate pr-2">{row.recipient ?? '—'}</div>
            <div className="flex justify-center"><SuccessBadge success={row.success} /></div>
            <div className="text-xs text-red-500 truncate" title={row.error_message ?? undefined}>
              {row.error_message ?? <span className="text-gray-300">—</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  return (
    <div className="flex-1 overflow-y-auto bg-[#F8FAFC]">
      <div className="p-6 space-y-5 max-w-5xl mx-auto">

        {/* Header */}
        <div>
          <h2 className="text-xl font-bold text-gray-900">Notifications</h2>
          <p className="text-sm text-gray-500 mt-0.5">Test and monitor notification channels</p>
        </div>

        {/* Provider cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <GmailApiCard />
          <SlackCard />
        </div>

        {/* History */}
        <NotificationHistory />

      </div>
    </div>
  )
}
