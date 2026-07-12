import { useState } from 'react'
import type { DemoRequestRow } from '../../pages/demoRequest/data/fieldHelpers'
import type { DemoRequest } from '../../pages/data/sampleData'

function useMockQuery<T>(fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)

  const trigger = async (..._args: unknown[]) => {
    setLoading(true)
    try {
      const result = await fetcher()
      setData(result)
    } finally {
      setLoading(false)
    }
  }

  return { data, loading, error: null, trigger }
}

function useMockMutation() {
  const [loading, setLoading] = useState(false)
  const trigger = async (_params: unknown) => {
    setLoading(true)
    console.warn('[demoRequests] mutation called — write-back not implemented for this action')
    await new Promise<void>(r => setTimeout(r, 150))
    setLoading(false)
  }
  return { loading, trigger, data: null, error: null }
}

// Map NormalisedDemo (from /api/demos) → DemoRequestRow shape
function toRow(d: DemoRequest): DemoRequestRow {
  return {
    id:                 d.id,
    action:             d.status,
    status:             d.status,
    geo:                d.geo,
    demo_type:          d.type,
    date_of_demo:       d.demo_date,
    demo_start_time:    d.start_time,
    demo_end_time:      d.end_time,
    total_guests:       String(d.total_guests),
    total_vehicles:     d.total_vehicles,
    guests_organization: d.organization,
    host:               d.host,
    description:        d.description,
    lead_time_days:     d.lead_days,
    requester:          d.requester,
    approver:           d.approver,
    created_at:         d.date_requested,
    updated_at:         d.date_requested,
    slack_link:         d.slack_link,
  }
}

async function fetchAllDemos(): Promise<DemoRequest[]> {
  const res = await fetch('/api/demos?limit=1000')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json() as { ok: boolean; data: DemoRequest[]; error?: string }
  if (!json.ok) throw new Error(json.error ?? 'Unknown API error')
  console.log('[demoRequests] API → ', json.data.length, 'demos from public.demo_master')
  return json.data
}

export function useListDemoRequests() {
  return useMockQuery<DemoRequestRow[]>(async () => {
    const demos = await fetchAllDemos()
    return demos.filter(d => d.status !== 'DELETED').map(toRow)
  })
}

export function useListMyDemoRequests() {
  return useMockQuery<DemoRequestRow[]>(async () => {
    const demos = await fetchAllDemos()
    return demos.filter(d => d.status !== 'DELETED').map(toRow)
  })
}

export function useGetDemoRequestStats() {
  return useMockQuery(async () => {
    const demos = await fetchAllDemos()
    const active = demos.filter(d => d.status !== 'DELETED')
    return {
      total:    active.length,
      pending:  active.filter(d => d.status === 'NEED REVIEW').length,
      approved: active.filter(d => d.status === 'APPROVED').length,
      canceled: active.filter(d => d.status === 'CANCELED').length,
    }
  })
}

export function useReviewDemoRequest()  { return useMockMutation() }
export function useDeleteDemoRequest()  { return useMockMutation() }
export function useUpdateDemoRequest()  { return useMockMutation() }
export function useCreateDemoRequest()  { return useMockMutation() }

// ─── useSubmitDemoRequest ─────────────────────────────────────────────────────
// Persists a new demo request to public.demo_master via POST /api/demos.

export function useSubmitDemoRequest() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trigger = async (formData: Record<string, unknown>): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const date    = String(formData.date_of_demo    ?? '')
      const startT  = String(formData.demo_start_time ?? '00:00')
      const endT    = String(formData.demo_end_time   ?? '00:00')

      const raw: Record<string, unknown> = {
        status:               'NEED REVIEW',
        geo:                  formData.geo,
        type:                 formData.type,
        date_request_received: new Date().toISOString(),
        date_of_demo:         date || null,
        demo_start_time:      date ? `${date} ${startT}:00` : null,
        demo_end_time:        date ? `${date} ${endT}:00`   : null,
        total_guests:         formData.total_guests
                                ? (parseInt(String(formData.total_guests), 10) || null)
                                : null,
        total_vehicles:       formData.total_vehicles
                                ? (parseInt(String(formData.total_vehicles), 10) || 1)
                                : 1,
        vehicle_type:         formData.vehicle_type    || null,
        system_required:      formData.platform        || null,
        start_location:       formData.start_location  || null,
        route_type:           formData.route_type      || null,
        feature_type:         formData.feature_type    || null,
        description:          formData.description     || null,
        requester:            formData.requester       || null,
        guests_organization:  formData.guests_organization || null,
        host:                 formData.host            || null,
        approver:             'Oliver Mugiraneza',
        channel:              'Internal',
      }

      // Strip null/undefined/empty-string values
      const payload: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(raw)) {
        if (v !== null && v !== undefined && v !== '') payload[k] = v
      }

      const res = await fetch('/api/demos', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      const json = await res.json() as { ok: boolean; error?: string }
      if (!json.ok) throw new Error(json.error ?? 'Submission failed')
      console.log('[useSubmitDemoRequest] saved to public.demo_master:', payload)
    } catch (e) {
      const msg = String(e)
      setError(msg)
      throw new Error(msg)
    } finally {
      setLoading(false)
    }
  }

  return { loading, trigger, data: null, error }
}
