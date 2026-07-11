import { useState, useEffect } from 'react'

export interface RetoolUser {
  id: number
  email: string
  fullName: string
  firstName: string
  lastName: string
  profilePhotoUrl: string | null
  groups: Array<{ name: string }>
}

export function useCurrentUser(): { user: RetoolUser | null; loading: boolean } {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<RetoolUser | null>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      setUser({
        id: 1,
        email: 'demo@wayve.ai',
        fullName: 'Demo User',
        firstName: 'Demo',
        lastName: 'User',
        profilePhotoUrl: null,
        groups: [{ name: 'Admin' }],
      })
      setLoading(false)
    }, 200)
    return () => clearTimeout(t)
  }, [])

  return { user, loading }
}
