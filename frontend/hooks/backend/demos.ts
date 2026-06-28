import { useState } from 'react'
import type { DemoRequest } from '../../pages/data/sampleData'

type HookResult<T> = {
  data: T | null
  loading: boolean
  error: string | null
  trigger: (...args: unknown[]) => Promise<void>
}

function useMockQuery<T>(fetcher: () => Promise<T>): HookResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trigger = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetcher()
      setData(result)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  return { data, loading, error, trigger }
}

// ─── useGetDemos ──────────────────────────────────────────────────────────────
// Fetches from the Express API (/api/demos → public.demo_master).
// Throws on failure — no mock fallback.

export function useGetDemos() {
  return useMockQuery<DemoRequest[]>(async () => {
    const res = await fetch('/api/demos')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json() as { ok: boolean; data: DemoRequest[]; error?: string }
    if (!json.ok) throw new Error(json.error ?? 'Unknown API error')
    console.log('[useGetDemos] API →', json.data.length, 'demos from public.demo_master')
    return json.data
  })
}

// ─── useGetDemosWithParams ────────────────────────────────────────────────────
// Accepts server-side filter/sort/paginate params.

export interface DemoQueryParams {
  limit?:     number
  offset?:    number
  search?:    string
  geo?:       string
  type?:      string
  status?:    string
  requester?: string
  approver?:  string
  host?:      string
  sortBy?:    'demo_date' | 'date_requested' | 'lead_days'
  sortDir?:   'ASC' | 'DESC'
}

export function useGetDemosWithParams(params: DemoQueryParams = {}) {
  return useMockQuery<{ data: DemoRequest[]; total: number }>(async () => {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') qs.set(k, String(v))
    })
    const res = await fetch(`/api/demos?${qs.toString()}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json() as { ok: boolean; data: DemoRequest[]; total: number; error?: string }
    if (!json.ok) throw new Error(json.error ?? 'Unknown API error')
    console.log('[useGetDemosWithParams] API →', json.data.length, '/', json.total, 'demos from public.demo_master')
    return { data: json.data, total: json.total }
  })
}

// ─── useGetSatisfaction ───────────────────────────────────────────────────────
// Fetches from /api/satisfaction -> public.satisfaction table.

export type SatisfactionRow = Record<string, unknown>

export interface SatisfactionQueryParams {
  limit?:     number
  offset?:    number
  geo?:       string
  type?:      string
  startDate?: string
  endDate?:   string
}

export function useGetSatisfaction(params: SatisfactionQueryParams = {}) {
  return useMockQuery<{ data: SatisfactionRow[]; total: number; columns: string[] }>(async () => {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') qs.set(k, String(v))
    })
    const res = await fetch(`/api/satisfaction?${qs.toString()}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json() as {
      ok: boolean
      data: SatisfactionRow[]
      total: number
      columns: string[]
      error?: string
    }
    if (!json.ok) throw new Error(json.error ?? 'Unknown API error')
    console.log('[useGetSatisfaction] API →', json.data.length, 'rows from public.satisfaction')
    return { data: json.data ?? [], total: json.total ?? 0, columns: json.columns ?? [] }
  })
}

// ─── useUpdateDemo ────────────────────────────────────────────────────────────
// Persists field updates to public.demo_master via PUT /api/demos.
// Expects { db_id: number, data: Record<string, unknown> }.

export interface UpdateDemoParams {
  db_id: number
  data: Record<string, unknown>
}

export function useUpdateDemo() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trigger = async (params: UpdateDemoParams) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/demos', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id: params.db_id, data: params.data }),
      })
      const json = await res.json() as { ok: boolean; affected?: number; error?: string }
      if (!json.ok) throw new Error(json.error ?? 'Update failed')
      console.log('[useUpdateDemo] updated db_id', params.db_id, '→ rows affected:', json.affected)
    } catch (e) {
      const msg = String(e)
      setError(msg)
      console.error('[useUpdateDemo] error:', msg)
    } finally {
      setLoading(false)
    }
  }

  return { loading, trigger, data: null, error }
}

// ─── usePatchDemoStatus ───────────────────────────────────────────────────────
// Lightweight PATCH /api/demos/:id/status — only touches the status column.
// Throws on failure so callers can handle rollback.

export function usePatchDemoStatus() {
  const trigger = async (db_id: number, status: string): Promise<void> => {
    const res = await fetch(`/api/demos/${db_id}/status`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status }),
    })
    const json = await res.json() as { ok: boolean; error?: string }
    if (!json.ok) throw new Error(json.error ?? 'Status update failed')
    console.log('[usePatchDemoStatus] db_id', db_id, '→ status:', status)
  }
  return { trigger }
}
