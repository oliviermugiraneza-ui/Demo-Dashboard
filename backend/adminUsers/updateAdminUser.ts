type Params = {
  id: number
  full_name: string
  email: string
  password: string
  geo: string
  role: string
}

export default async function (req: { params: Params; user: User }) {
  const { id, full_name, email, password, geo, role } = req.params
  const result = await retoolDb.query<{
    id: number; full_name: string; email: string; password: string; geo: string; role: string; created_at: string; updated_at: string
  }>(
    `UPDATE admin_users
     SET full_name = $1, email = $2, password = $3, geo = $4, role = $5, updated_at = now()
     WHERE id = $6
     RETURNING *`,
    [full_name, email, password, geo, role, id]
  )
  return result.data[0]
}
