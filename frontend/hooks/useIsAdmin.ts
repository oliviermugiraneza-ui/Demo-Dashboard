import { useCurrentUser } from './useCurrentUser'

/**
 * Returns true when the authenticated user is a member of the "Admin" group
 * in Retool. Create a group named "Admin" (case-insensitive) and add the
 * relevant users to grant admin access.
 */
export function useIsAdmin(): { isAdmin: boolean; loading: boolean } {
  const { user, loading } = useCurrentUser()
  const isAdmin = user?.groups.some(g => g.name.toLowerCase() === 'admin') ?? false
  return { isAdmin, loading }
}
