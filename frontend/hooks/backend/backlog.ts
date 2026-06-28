import { useState, useCallback } from 'react'
import type { BacklogItem } from '../../pages/backlog/types'

type HookResult<T> = {
  data: T | null
  loading: boolean
  error: string | null
  trigger: (...args: unknown[]) => Promise<void>
}

function useQuery<T>(fetcher: () => Promise<T>): HookResult<T> {
  const [data, setData]       = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const trigger = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await fetcher())
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { data, loading, error, trigger }
}

// ─── GET /api/backlog ─────────────────────────────────────────────────────────

export function useGetBacklog() {
  return useQuery<BacklogItem[]>(async () => {
    const res  = await fetch('/api/backlog')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json() as { ok: boolean; data: BacklogItem[]; error?: string }
    if (!json.ok) throw new Error(json.error ?? 'API error')
    return json.data
  })
}

// ─── POST /api/backlog ────────────────────────────────────────────────────────

export function useCreateBacklog() {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const trigger = async (data: Partial<BacklogItem>): Promise<BacklogItem | null> => {
    setLoading(true); setError(null)
    try {
      const res  = await fetch('/api/backlog', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      })
      const json = await res.json() as { ok: boolean; data: BacklogItem; error?: string }
      if (!json.ok) throw new Error(json.error ?? 'Create failed')
      return json.data
    } catch (e) {
      setError(String(e)); return null
    } finally {
      setLoading(false)
    }
  }

  return { loading, error, trigger }
}

// ─── PUT /api/backlog/:id ─────────────────────────────────────────────────────

export function useUpdateBacklog() {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const trigger = async (id: number, data: Partial<BacklogItem>): Promise<BacklogItem | null> => {
    setLoading(true); setError(null)
    try {
      const res  = await fetch(`/api/backlog/${id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      })
      const json = await res.json() as { ok: boolean; data: BacklogItem; error?: string }
      if (!json.ok) throw new Error(json.error ?? 'Update failed')
      return json.data
    } catch (e) {
      setError(String(e)); return null
    } finally {
      setLoading(false)
    }
  }

  return { loading, error, trigger }
}

// ─── PATCH /api/backlog/:id/status ───────────────────────────────────────────

export function usePatchBacklogStatus() {
  const trigger = async (id: number, status: string): Promise<BacklogItem> => {
    const res  = await fetch(`/api/backlog/${id}/status`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status }),
    })
    const json = await res.json() as { ok: boolean; data: BacklogItem; error?: string }
    if (!json.ok) throw new Error(json.error ?? 'Status patch failed')
    return json.data
  }
  return { trigger }
}

// ─── DELETE /api/backlog/:id ──────────────────────────────────────────────────

export function useDeleteBacklog() {
  const [loading, setLoading] = useState(false)

  const trigger = async (id: number): Promise<boolean> => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/backlog/${id}`, { method: 'DELETE' })
      const json = await res.json() as { ok: boolean; error?: string }
      return json.ok
    } catch {
      return false
    } finally {
      setLoading(false)
    }
  }

  return { loading, trigger }
}

// ─── POST /api/backlog/:id/convert ───────────────────────────────────────────

export function useConvertBacklog() {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const trigger = async (id: number): Promise<{ demoId: number; item: BacklogItem } | null> => {
    setLoading(true); setError(null)
    try {
      const res  = await fetch(`/api/backlog/${id}/convert`, { method: 'POST' })
      const json = await res.json() as { ok: boolean; demoId: number; data: BacklogItem; error?: string }
      if (!json.ok) throw new Error(json.error ?? 'Convert failed')
      return { demoId: json.demoId, item: json.data }
    } catch (e) {
      setError(String(e)); return null
    } finally {
      setLoading(false)
    }
  }

  return { loading, error, trigger }
}
