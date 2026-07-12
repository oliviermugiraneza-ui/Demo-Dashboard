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

// ─── Module-level response cache ──────────────────────────────────────────────
// Shared across all hooks and all page mounts. A single fetch serves every page
// that mounts within the TTL window — eliminates the "5 pages, 5 fetches" pattern.

const CACHE_TTL = 30_000 // 30 seconds

interface CacheEntry<T> { data: T; ts: number }
const _cache = new Map<string, CacheEntry<unknown>>()

function getCached<T>(key: string): T | null {
  const entry = _cache.get(key) as CacheEntry<T> | undefined
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL) { _cache.delete(key); return null }
  return entry.data
}

function setCache<T>(key: string, data: T): void {
  _cache.set(key, { data, ts: Date.now() })
}

/** Call after any mutation (create / update / status change) to force next fetch from DB. */
export function invalidateDemosCache(): void {
  _cache.clear()
  console.log('[demos cache] invalidated')
}

// ─── useGetDemos ──────────────────────────────────────────────────────────────
// Fetches from the Express API (/api/demos → public.demo_master).
// Shared cache: all pages calling this within 30 s get the same data instantly.

export function useGetDemos() {
  return useMockQuery<DemoRequest[]>(async () => {
    const key = '/api/demos'
    const cached = getCached<DemoRequest[]>(key)
    if (cached) {
      console.log('[useGetDemos] cache hit →', cached.length, 'demos')
      return cached
    }
    const res = await fetch('/api/demos')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json() as { ok: boolean; data: DemoRequest[]; error?: string }
    if (!json.ok) throw new Error(json.error ?? 'Unknown API error')
    console.log('[useGetDemos] API →', json.data.length, 'demos from public.demo_master')
    setCache(key, json.data)
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
  statusIn?:  string
  requester?: string
  approver?:  string
  host?:      string
  month?:     string
  startDate?: string
  endDate?:   string
  sortBy?:    'demo_date' | 'date_requested' | 'lead_days'
  sortDir?:   'ASC' | 'DESC'
}

function buildQs(params: DemoQueryParams): string {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== null) qs.set(k, String(v))
  })
  return qs.toString()
}

export function useGetDemosWithParams(params: DemoQueryParams = {}) {
  return useMockQuery<{ data: DemoRequest[]; total: number }>(async () => {
    const qs  = buildQs(params)
    const key = `/api/demos?${qs}`
    const cached = getCached<{ data: DemoRequest[]; total: number }>(key)
    if (cached) {
      console.log('[useGetDemosWithParams] cache hit →', cached.data.length, '/', cached.total)
      return cached
    }
    const res = await fetch(`/api/demos?${qs}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json() as { ok: boolean; data: DemoRequest[]; total: number; error?: string }
    if (!json.ok) throw new Error(json.error ?? 'Unknown API error')
    console.log('[useGetDemosWithParams] API →', json.data.length, '/', json.total, 'demos')
    const result = { data: json.data, total: json.total }
    setCache(key, result)
    return result
  })
}

// ─── Page-specific hooks (use dedicated endpoints) ────────────────────────────
// Each hook hits an endpoint that pre-filters by status server-side, reducing
// payload and query time. Each has its own cache key.

export function useGetCockpitDemos() {
  return useMockQuery<DemoRequest[]>(async () => {
    const key = '/api/demos/cockpit'
    const cached = getCached<DemoRequest[]>(key)
    if (cached) {
      console.log('[useGetCockpitDemos] cache hit →', cached.length, 'demos')
      return cached
    }
    const res = await fetch('/api/demos/cockpit')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json() as { ok: boolean; data: DemoRequest[]; error?: string }
    if (!json.ok) throw new Error(json.error ?? 'Unknown API error')
    console.log('[useGetCockpitDemos] API →', json.data.length, 'demos')
    setCache(key, json.data)
    return json.data
  })
}

export function useGetCalendarDemos(params: Pick<DemoQueryParams, 'geo' | 'month' | 'startDate' | 'endDate'> = {}) {
  return useMockQuery<DemoRequest[]>(async () => {
    const qs  = buildQs(params)
    const key = `/api/demos/calendar${qs ? '?' + qs : ''}`
    const cached = getCached<DemoRequest[]>(key)
    if (cached) {
      console.log('[useGetCalendarDemos] cache hit →', cached.length, 'demos')
      return cached
    }
    const res = await fetch(`/api/demos/calendar${qs ? '?' + qs : ''}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json() as { ok: boolean; data: DemoRequest[]; error?: string }
    if (!json.ok) throw new Error(json.error ?? 'Unknown API error')
    console.log('[useGetCalendarDemos] API →', json.data.length, 'demos')
    setCache(key, json.data)
    return json.data
  })
}

export function useGetTrackerDemos(params: Pick<DemoQueryParams, 'geo' | 'type' | 'month' | 'startDate' | 'endDate'> = {}) {
  return useMockQuery<DemoRequest[]>(async () => {
    const qs  = buildQs(params)
    const key = `/api/demos/tracker${qs ? '?' + qs : ''}`
    const cached = getCached<DemoRequest[]>(key)
    if (cached) {
      console.log('[useGetTrackerDemos] cache hit →', cached.length, 'demos')
      return cached
    }
    const res = await fetch(`/api/demos/tracker${qs ? '?' + qs : ''}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json() as { ok: boolean; data: DemoRequest[]; error?: string }
    if (!json.ok) throw new Error(json.error ?? 'Unknown API error')
    console.log('[useGetTrackerDemos] API →', json.data.length, 'demos')
    setCache(key, json.data)
    return json.data
  })
}

// ─── useGetSatisfaction ───────────────────────────────────────────────────────

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
      invalidateDemosCache()
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

export function usePatchDemoStatus() {
  const trigger = async (db_id: number, status: string): Promise<void> => {
    const res = await fetch(`/api/demos/${db_id}/status`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status }),
    })
    const json = await res.json() as { ok: boolean; error?: string }
    if (!json.ok) throw new Error(json.error ?? 'Status update failed')
    invalidateDemosCache()
    console.log('[usePatchDemoStatus] db_id', db_id, '→ status:', status)
  }
  return { trigger }
}
