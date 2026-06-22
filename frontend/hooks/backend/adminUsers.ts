import { useState } from 'react'

interface AdminUser {
  id: number
  full_name: string
  email: string
  password: string
  geo: string
  role: string
}

const MOCK_ADMINS: AdminUser[] = [
  { id: 1, full_name: 'James Wright', email: 'james@wayve.ai', password: '', geo: 'UK', role: 'Admin' },
  { id: 2, full_name: 'Akira Sato',   email: 'akira@wayve.ai', password: '', geo: 'JP', role: 'Admin' },
  { id: 3, full_name: 'David Park',   email: 'david@wayve.ai', password: '', geo: 'US', role: 'Admin' },
  { id: 4, full_name: 'Maria Weber',  email: 'maria@wayve.ai', password: '', geo: 'DE', role: 'Admin' },
]

function delay(ms = 300): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
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

export function useGetAdminUsers() {
  const [data, setData] = useState<AdminUser[] | null>(null)
  const [loading, setLoading] = useState(false)

  const trigger = async () => {
    setLoading(true)
    await delay()
    setData(MOCK_ADMINS)
    setLoading(false)
  }

  return { data, loading, error: null, trigger }
}

export function useCreateAdminUser() { return useMockMutation() }
export function useUpdateAdminUser() { return useMockMutation() }
export function useDeleteAdminUser() { return useMockMutation() }
