type Params = {
  search?: string
  status?: string
  geo?: string
  demoType?: string
  page?: number
  pageSize?: number
}

export default async function listDemoRequests(
  req: { params: Params; user: User },
) {
  const { search, status, geo, demoType, page = 1, pageSize = 25 } = req.params
  const offset = (page - 1) * pageSize

  const conditions: string[] = []
  const values: unknown[] = []
  let idx = 1

  if (search?.trim()) {
    conditions.push(
      `(guests_organization ILIKE $${idx} OR requester ILIKE $${idx} OR description ILIKE $${idx})`,
    )
    values.push(`%${search.trim()}%`)
    idx++
  }
  if (status) {
    conditions.push(`status = $${idx++}`)
    values.push(status)
  }
  if (geo) {
    conditions.push(`geo = $${idx++}`)
    values.push(geo)
  }
  if (demoType) {
    conditions.push(`demo_type = $${idx++}`)
    values.push(demoType)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const [dataResult, countResult] = await Promise.all([
    retoolDb.query(
      `SELECT
         id, action, status, geo, demo_type,
         date_of_demo, demo_start_time, demo_end_time,
         total_guests, total_vehicles, guests_organization,
         host, description, lead_time_days, requester,
         approver, created_at, updated_at, slack_link
       FROM demo_raw_data
       ${where}
       ORDER BY created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, pageSize, offset],
    ),
    retoolDb.query(
      `SELECT COUNT(*) AS total FROM demo_raw_data ${where}`,
      values,
    ),
  ])

  return {
    data: dataResult.data,
    total: parseInt((countResult.data[0] as Record<string, string>)?.['total'] ?? '0', 10),
    page,
    pageSize,
  }
}
