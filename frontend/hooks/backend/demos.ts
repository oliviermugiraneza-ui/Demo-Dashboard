import { useState } from 'react'
import { demoRequests } from '../../pages/data/sampleData'
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

function delay(ms = 400): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

// ─── useGetDemos ──────────────────────────────────────────────────────────────

export function useGetDemos() {
  return useMockQuery<DemoRequest[]>(async () => {
    await delay()
    return demoRequests
  })
}

// ─── useUpdateDemo ────────────────────────────────────────────────────────────

export function useUpdateDemo() {
  const [loading, setLoading] = useState(false)

  const trigger = async (_params: unknown) => {
    setLoading(true)
    await delay(300)
    setLoading(false)
  }

  return { loading, trigger, data: null, error: null }
}
