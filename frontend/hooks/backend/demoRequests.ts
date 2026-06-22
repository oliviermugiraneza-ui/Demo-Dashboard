import { useState } from 'react'
import { demoRequests } from '../../pages/data/sampleData'
import type { DemoRequestRow } from '../../pages/demoRequest/data/fieldHelpers'

function delay(ms = 350): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

function toRow(d: (typeof demoRequests)[0]): DemoRequestRow {
  return {
    id: d.id,
    action: d.status,
    status: d.status,
    geo: d.geo,
    demo_type: d.type,
    date_of_demo: d.demo_date,
    demo_start_time: d.start_time,
    demo_end_time: d.end_time,
    total_guests: String(d.total_guests),
    total_vehicles: d.total_vehicles,
    guests_organization: d.organization,
    host: d.host,
    description: d.description,
    lead_time_days: d.lead_days,
    requester: d.requester,
    approver: d.approver,
    created_at: d.date_requested,
    updated_at: d.date_requested,
    slack_link: d.slack_link,
  }
}

function useMockQuery<T>(fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)

  const trigger = async (..._args: unknown[]) => {
    setLoading(true)
    const result = await fetcher()
    setData(result)
    setLoading(false)
  }

  return { data, loading, error: null, trigger }
}

function useMockMutation() {
  const [loading, setLoading] = useState(false)
  const trigger = async (_params: unknown) => {
    setLoading(true)
    await delay()
    setLoading(false)
  }
  return { loading, trigger, data: null, error: null }
}

export function useListDemoRequests() {
  return useMockQuery<DemoRequestRow[]>(async () => {
    await delay()
    return demoRequests.map(toRow)
  })
}

export function useListMyDemoRequests() {
  return useMockQuery<DemoRequestRow[]>(async () => {
    await delay()
    return demoRequests.filter(d => d.requester === 'Alice Chen').map(toRow)
  })
}

export function useGetDemoRequestStats() {
  return useMockQuery(async () => {
    await delay()
    const active = demoRequests.filter(d => d.status !== 'DELETED')
    return {
      total: active.length,
      pending: active.filter(d => d.status === 'Needs Review').length,
      approved: active.filter(d => d.status === 'Reviewed').length,
      canceled: active.filter(d => d.status === 'Canceled').length,
    }
  })
}

export function useReviewDemoRequest()  { return useMockMutation() }
export function useSubmitDemoRequest()  { return useMockMutation() }
export function useDeleteDemoRequest()  { return useMockMutation() }
export function useUpdateDemoRequest()  { return useMockMutation() }
export function useCreateDemoRequest()  { return useMockMutation() }
