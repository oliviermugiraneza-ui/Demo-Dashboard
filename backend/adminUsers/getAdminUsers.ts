export default async function (_req: { params: Record<string, never>; user: User }) {
  const result = await retoolDb.query<{
    id: number
    full_name: string
    email: string
    password: string
    geo: string
    role: string
    created_at: string
    updated_at: string
  }>('SELECT * FROM admin_users ORDER BY id')
  return result.data
}
