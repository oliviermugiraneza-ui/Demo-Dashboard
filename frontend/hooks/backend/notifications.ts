import { useState, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NotificationsConfig {
  enabled:                    boolean
  dryRun:                     boolean
  provider:                   string
  gmailClientConfigured:      boolean
  gmailRefreshTokenConfigured: boolean
  emailFromConfigured:        boolean
  slackConfigured:            boolean
}

export interface NotificationLogRow {
  id:            string
  demo_id:       string | null
  event_type:    string | null
  channel:       string | null
  recipient:     string | null
  payload:       unknown
  success:       boolean | null
  error_message: string | null
  created_at:    string | null
}

export interface TestResult {
  ok:      boolean
  channel: string
  logged:  boolean
  sent:    boolean
  dryRun:  boolean
  error?:  string
}

// ─── useNotificationsConfig ───────────────────────────────────────────────────

export function useNotificationsConfig() {
  const [data,    setData]    = useState<NotificationsConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch('/api/notifications/config')
      const json = await res.json() as NotificationsConfig & { ok: boolean; error?: string }
      if (!json.ok) throw new Error(json.error ?? 'Failed to load config')
      setData(json)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  return { data, loading, error, fetch: fetch_ }
}

// ─── useNotificationLog ───────────────────────────────────────────────────────

export function useNotificationLog(limit = 50) {
  const [data,    setData]    = useState<NotificationLogRow[]>([])
  const [total,   setTotal]   = useState(0)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`/api/notifications/log?limit=${limit}`)
      const json = await res.json() as { ok: boolean; total: number; data: NotificationLogRow[]; error?: string }
      if (!json.ok) throw new Error(json.error ?? 'Failed to load log')
      setData(json.data ?? [])
      setTotal(json.total ?? 0)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [limit])

  return { data, total, loading, error, fetch: fetch_ }
}

// ─── useSendTestNotification ──────────────────────────────────────────────────

export function useSendTestNotification() {
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState<TestResult | null>(null)
  const [error,   setError]   = useState<string | null>(null)

  const send = useCallback(async (input: {
    channel:    string
    subject?:   string
    message?:   string
    eventType?: string
    demoId?:    number | string
  }) => {
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      const res  = await fetch('/api/notifications/test', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(input),
      })
      const json = await res.json() as TestResult & { error?: string }
      setResult(json)
      if (!json.ok && json.error) setError(json.error)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  return { loading, result, error, send }
}
