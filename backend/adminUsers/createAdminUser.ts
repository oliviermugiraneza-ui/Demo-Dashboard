type Params = {
  full_name: string
  email: string
  password: string
  geo: string
  role: string
}

export default async function (req: { params: Params; user: User }) {
  const { full_name, email, password, geo, role } = req.params
  const result = await retoolDb.query<{
    id: number; full_name: string; email: string; password: string; geo: string; role: string; created_at: string; updated_at: string
  }>(
    `INSERT INTO admin_users (full_name, email, password, geo, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [full_name, email, password, geo, role]
  )
  return result.data[0]
}
