type Params = Record<string, never>

export default async function listMyDemoRequests(
  req: { params: Params; user: User },
) {
  const result = await retoolDb.query(
    `SELECT
       id, action, status, geo, demo_type,
       date_of_demo, demo_start_time, demo_end_time,
       total_guests, total_vehicles, guests_organization,
       host, description, lead_time_days, requester,
       approver, created_at, updated_at, start_location, slack_link
     FROM demo_raw_data
     WHERE requester = $1
     ORDER BY created_at DESC`,
    [req.user.fullName],
  )
  return result.data
}
