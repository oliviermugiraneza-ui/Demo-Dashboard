import { useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PostDemoRecord {
  id: number
  demo_id: number | null
  demo_ref: string | null
  category: 'demo' | 'recce' | 'brt'
  status: string | null
  submitted_at: string | null
  operator_email: string | null
  operator_name: string | null
  geo: string
  demo_date: string | null
  demo_time: string | null
  demo_type: string | null
  guest_organization: string | null
  route: string | null
  demo_route: string | null
  vehicle: string | null
  vehicle_id: string
  model_name: string
  model_behaviours: string[] | null
  problem_description: string | null
  positive_behaviour: string | null
  safety_score: number | null
  comfort_score: number | null
  decisiveness_score: number | null
  aggressiveness_score: number | null
  speed_following_score: number | null
  driving_features: string[] | null
  demo_issues: string[] | null
  number_of_uds: number | null
  power_cycle_required: boolean | null
  reason_for_power_cycle: string | null
  interventions: Record<string, number> | null
  safety_critical: boolean | null
  smoothness_score: number | null
  created_at: string
  updated_at: string
}

export interface PostDemoSummary {
  total: number
  demo_count: number
  brt_count: number
  recce_count: number
  avg_safety: number | null
  avg_comfort: number | null
  avg_decisiveness: number | null
  avg_smoothness: number | null
  safety_critical_count: number
  total_uds: number
}

export interface ModelAnalytic {
  model_name: string
  run_count: number
  avg_safety: number | null
  avg_comfort: number | null
  avg_decisiveness: number | null
  avg_aggressiveness: number | null
  avg_speed_following: number | null
}

export interface InterventionAnalytic {
  intervention_type: string
  total_count: number
}

export interface PostDemoQueryParams {
  limit?: number
  offset?: number
  category?: string
  geo?: string
  demoType?: string
  modelName?: string
  operatorName?: string
  route?: string
  startDate?: string
  endDate?: string
  safetyCritical?: string
  maxUds?: number
  month?: string
}

// ─── Hook factory ─────────────────────────────────────────────────────────────

type HookResult<T> = {
  data: T | null
  loading: boolean
  error: string | null
  trigger: (...args: unknown[]) => Promise<void>
}

function useMockQuery<T>(fetcher: () => Promise<T>): HookResult<T> {
  const [data, setData]       = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

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

function buildQs(params: PostDemoQueryParams): string {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== null) qs.set(k, String(v))
  })
  return qs.toString()
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useGetPostDemos(params: PostDemoQueryParams = {}) {
  return useMockQuery<{ data: PostDemoRecord[]; total: number }>(async () => {
    const qs = buildQs(params)
    const res = await fetch(`/api/post-demo${qs ? '?' + qs : ''}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json() as { ok: boolean; data: PostDemoRecord[]; total: number; error?: string }
    if (!json.ok) throw new Error(json.error ?? 'Unknown API error')
    const data = json.data.map(r => ({
      ...r,
      id:      Number(r.id),
      demo_id: r.demo_id != null ? Number(r.demo_id) : null,
    }))
    return { data, total: json.total }
  })
}

export function useGetPostDemoSummary(params: PostDemoQueryParams = {}) {
  return useMockQuery<PostDemoSummary>(async () => {
    const qs = buildQs(params)
    const res = await fetch(`/api/post-demo/analytics/summary${qs ? '?' + qs : ''}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json() as { ok: boolean; data: PostDemoSummary; error?: string }
    if (!json.ok) throw new Error(json.error ?? 'Unknown API error')
    return json.data
  })
}

export function useGetModelAnalytics(params: PostDemoQueryParams = {}) {
  return useMockQuery<ModelAnalytic[]>(async () => {
    const qs = buildQs(params)
    const res = await fetch(`/api/post-demo/analytics/models${qs ? '?' + qs : ''}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json() as { ok: boolean; data: ModelAnalytic[]; error?: string }
    if (!json.ok) throw new Error(json.error ?? 'Unknown API error')
    return json.data
  })
}

export function useGetInterventionAnalytics(params: PostDemoQueryParams = {}) {
  return useMockQuery<InterventionAnalytic[]>(async () => {
    const qs = buildQs(params)
    const res = await fetch(`/api/post-demo/analytics/interventions${qs ? '?' + qs : ''}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json() as { ok: boolean; data: InterventionAnalytic[]; error?: string }
    if (!json.ok) throw new Error(json.error ?? 'Unknown API error')
    return json.data
  })
}

export function useCreatePostDemo() {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const trigger = async (data: Record<string, unknown>): Promise<number | null> => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/post-demo', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      })
      const json = await res.json() as { ok: boolean; id?: number; error?: string }
      if (!json.ok) throw new Error(json.error ?? 'Create failed')
      return json.id ?? null
    } catch (e) {
      setError(String(e))
      return null
    } finally {
      setLoading(false)
    }
  }

  return { loading, error, trigger }
}

export function useUpdatePostDemo() {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const trigger = async (id: number, data: Record<string, unknown>): Promise<boolean> => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/post-demo/${id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      })
      const json = await res.json() as { ok: boolean; error?: string }
      if (!json.ok) throw new Error(json.error ?? 'Update failed')
      return true
    } catch (e) {
      setError(String(e))
      return false
    } finally {
      setLoading(false)
    }
  }

  return { loading, error, trigger }
}

export function useDeletePostDemo() {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const trigger = async (id: number): Promise<boolean> => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/post-demo/${id}`, { method: 'DELETE' })
      const json = await res.json() as { ok: boolean; error?: string }
      if (!json.ok) throw new Error(json.error ?? 'Delete failed')
      return true
    } catch (e) {
      setError(String(e))
      return false
    } finally {
      setLoading(false)
    }
  }

  return { loading, error, trigger }
}
