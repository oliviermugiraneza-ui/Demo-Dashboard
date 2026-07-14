import { useState } from 'react'
import type { PostDemoRecord } from './postDemo'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ModelAnalyticsData {
  modelName:            string
  platform:             string | null
  runCount:             number
  avgSafety:            number | null
  avgComfort:           number | null
  avgDecisiveness:      number | null
  avgAggressiveness:    number | null
  avgSmoothness:        number | null
  avgBehaviourRating:   number | null
  scRunCount:           number
  dilcUse:              number | null
  totalInterventions:   number
  behaviourCounts:      Record<string, number>
  ratingDistribution:   Array<{ bucket: string; count: number }>
  interventionBreakdown: Array<{ name: string; total_count: number; any_sc: boolean }>
  feedbackReports:      PostDemoRecord[]
}

export type ComparisonDir = 'higher' | 'lower' | 'neutral'

export interface ComparisonRow {
  parameter:   string
  modelAValue: string | number | null
  modelBValue: string | number | null
  common?:     boolean
  scA?:        boolean
  scB?:        boolean
  direction:   ComparisonDir
}

export interface ComparisonGroup {
  title: string
  rows:  ComparisonRow[]
}

export interface ModelComparisonResult {
  topRows: ComparisonRow[]
  groups:  ComparisonGroup[]
}

export interface ModelComparisonData {
  modelA:     ModelAnalyticsData
  modelB:     ModelAnalyticsData
  comparison: ModelComparisonResult
}

// ─── Hook factory ─────────────────────────────────────────────────────────────

type HookResult<T> = {
  data: T | null
  loading: boolean
  error: string | null
  trigger: (...args: unknown[]) => Promise<void>
}

function useMockQuery<T>(fetcher: () => Promise<T>): HookResult<T> {
  const [data,    setData]    = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const trigger = async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await fetcher())
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  return { data, loading, error, trigger }
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useGetModelList() {
  return useMockQuery<string[]>(async () => {
    const res  = await fetch('/api/model-analytics/list')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json() as { ok: boolean; data: string[]; error?: string }
    if (!json.ok) throw new Error(json.error ?? 'Unknown error')
    return json.data
  })
}

export function useGetModelAnalytics(modelName: string) {
  return useMockQuery<ModelAnalyticsData>(async () => {
    const res  = await fetch(`/api/model-analytics/${encodeURIComponent(modelName)}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json() as { ok: boolean; data: ModelAnalyticsData; error?: string }
    if (!json.ok) throw new Error(json.error ?? 'Unknown error')
    return {
      ...json.data,
      feedbackReports: json.data.feedbackReports.map(r => ({
        ...r,
        id:      Number(r.id),
        demo_id: r.demo_id != null ? Number(r.demo_id) : null,
      })),
    }
  })
}

export function useGetModelComparison(modelA: string, modelB: string) {
  return useMockQuery<ModelComparisonData>(async () => {
    const qs   = new URLSearchParams({ modelA, modelB })
    const res  = await fetch(`/api/model-analytics/compare?${qs}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json() as { ok: boolean; data: ModelComparisonData; error?: string }
    if (!json.ok) throw new Error(json.error ?? 'Unknown error')
    return json.data
  })
}
