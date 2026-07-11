import { useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdminUser {
  id: number
  full_name: string
  email: string
  password: string
  geo: string
  role: string
}

// ─── useGetAdminUsers ─────────────────────────────────────────────────────────

export function useGetAdminUsers() {
  const [data, setData]       = useState<AdminUser[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const trigger = async (params?: { geo?: string }) => {
    setLoading(true)
    setError(null)
    try {
      const qs  = params?.geo ? `?geo=${encodeURIComponent(params.geo)}` : ''
      const res = await fetch(`/api/admin-users${qs}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json() as { ok: boolean; data: AdminUser[]; error?: string }
      if (!json.ok) throw new Error(json.error ?? 'Unknown error')
      setData(json.data.map(u => ({ ...u, id: Number(u.id) })))
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  return { data, loading, error, trigger }
}

// ─── useGetHosts ─────────────────────────────────────────────────────────────

export function useGetHosts() {
  const [data, setData]       = useState<AdminUser[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const trigger = async (params?: { geo?: string }) => {
    setLoading(true)
    setError(null)
    try {
      const qs  = params?.geo ? `?geo=${encodeURIComponent(params.geo)}` : ''
      const res = await fetch(`/api/admin/hosts${qs}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json() as { ok: boolean; data: AdminUser[]; error?: string }
      if (!json.ok) throw new Error(json.error ?? 'Unknown error')
      setData(json.data.map(u => ({ ...u, id: Number(u.id), password: '' })))
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  return { data, loading, error, trigger }
}

// ─── useCreateAdminUser ───────────────────────────────────────────────────────

export function useCreateAdminUser() {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const trigger = async (params: unknown): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin-users', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(params),
      })
      const json = await res.json() as { ok: boolean; error?: string }
      if (!json.ok) throw new Error(json.error ?? 'Create failed')
    } catch (e) {
      setError(String(e))
      throw e
    } finally {
      setLoading(false)
    }
  }

  return { loading, error, trigger, data: null }
}

// ─── useUpdateAdminUser ───────────────────────────────────────────────────────

export function useUpdateAdminUser() {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const trigger = async (params: unknown): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const p   = params as { id: number; [k: string]: unknown }
      const res = await fetch(`/api/admin-users/${p.id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(p),
      })
      const json = await res.json() as { ok: boolean; error?: string }
      if (!json.ok) throw new Error(json.error ?? 'Update failed')
    } catch (e) {
      setError(String(e))
      throw e
    } finally {
      setLoading(false)
    }
  }

  return { loading, error, trigger, data: null }
}

// ─── useDeleteAdminUser ───────────────────────────────────────────────────────

export function useDeleteAdminUser() {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const trigger = async (params: unknown): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const { id } = params as { id: number }
      const res    = await fetch(`/api/admin-users/${id}`, { method: 'DELETE' })
      const json   = await res.json() as { ok: boolean; error?: string }
      if (!json.ok) throw new Error(json.error ?? 'Delete failed')
    } catch (e) {
      setError(String(e))
      throw e
    } finally {
      setLoading(false)
    }
  }

  return { loading, error, trigger, data: null }
}
