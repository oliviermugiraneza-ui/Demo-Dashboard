type Params = {
  id: string
  // Status changes
  action?: string    // 'Reviewed' | 'Canceled' | 'NEEDS REVIEW'
  dbStatus?: string  // 'approved' | 'rejected' | 'pending' | 'completed'
  // Reschedule
  date_of_demo?: string  // YYYY-MM-DD
  start_time?: string    // HH:MM
  end_time?: string      // HH:MM
  // Edit fields (frontend-facing names, mapped to DB columns below)
  organization?: string
  requester?: string
  host?: string
  demo_type?: string
  total_guests?: number
  total_vehicles?: number
  vehicle_type?: string
  description?: string
}

export default async function updateDemo(req: { params: Params; user: User }): Promise<{ success: boolean }> {
  const { id, ...fields } = req.params

  const setClauses: string[] = []
  const values: unknown[] = []
  let idx = 1

  // Status/action change
  if (fields.action !== undefined) {
    setClauses.push(`action = $${idx++}`)
    values.push(fields.action)
  }
  if (fields.dbStatus !== undefined) {
    setClauses.push(`status = $${idx++}`)
    values.push(fields.dbStatus)
  }

  // Reschedule: update date column + reconstruct timestamps
  if (fields.date_of_demo !== undefined) {
    setClauses.push(`date_of_demo = $${idx++}`)
    values.push(fields.date_of_demo)
  }
  if (fields.start_time !== undefined && fields.date_of_demo !== undefined) {
    const ts = `${fields.date_of_demo}T${fields.start_time}:00.000Z`
    setClauses.push(`demo_start_time = $${idx++}`)
    values.push(ts)
  }
  if (fields.end_time !== undefined && fields.date_of_demo !== undefined) {
    const ts = `${fields.date_of_demo}T${fields.end_time}:00.000Z`
    setClauses.push(`demo_end_time = $${idx++}`)
    values.push(ts)
  }

  // Edit fields
  if (fields.organization !== undefined) {
    setClauses.push(`guests_organization = $${idx++}`)
    values.push(fields.organization)
  }
  if (fields.requester !== undefined) {
    setClauses.push(`requester = $${idx++}`)
    values.push(fields.requester)
  }
  if (fields.host !== undefined) {
    setClauses.push(`host = $${idx++}`)
    values.push(fields.host)
  }
  if (fields.demo_type !== undefined) {
    setClauses.push(`demo_type = $${idx++}`)
    values.push(fields.demo_type)
  }
  if (fields.total_guests !== undefined) {
    setClauses.push(`total_guests = $${idx++}`)
    values.push(String(fields.total_guests))
  }
  if (fields.total_vehicles !== undefined) {
    setClauses.push(`total_vehicles = $${idx++}`)
    values.push(fields.total_vehicles)
  }
  if (fields.vehicle_type !== undefined) {
    setClauses.push(`vehicle_type = $${idx++}`)
    values.push(fields.vehicle_type)
  }
  if (fields.description !== undefined) {
    setClauses.push(`description = $${idx++}`)
    values.push(fields.description)
  }

  if (setClauses.length === 0) return { success: true }

  setClauses.push(`updated_at = NOW()`)
  values.push(id)

  await retoolDb.query(
    `UPDATE demo_raw_data SET ${setClauses.join(', ')} WHERE id = $${idx}`,
    values,
  )
  return { success: true }
}
