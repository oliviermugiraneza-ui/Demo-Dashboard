import { normalize, dateMonthLabel, calcLeadDays } from './fields'

type Params = {
  geo: string
  demo_type: string
  date_of_demo: string   // YYYY-MM-DD
  demo_start_time: string // HH:MM
  demo_end_time: string   // HH:MM
  total_guests?: string
  total_vehicles?: number
  vehicle_type?: string
  start_location?: string
  description?: string
  guests_organization?: string
  host?: string
  slack_channel?: string
  slack_link?: string
  route_type?: string
  feature_type?: string
  system_required?: string
  recce_required?: string
  local_demo?: string
  cross_geo_demo?: string
  number_of_sessions?: number
  length?: string
}

export default async function submitDemoRequest(
  req: { params: Params; user: User },
): Promise<{ id: string }> {
  const { params: p, user } = req

  const startTs = `${p.date_of_demo}T${p.demo_start_time}:00.000Z`
  const endTs   = `${p.date_of_demo}T${p.demo_end_time}:00.000Z`
  const lead    = calcLeadDays(p.date_of_demo)
  const month   = dateMonthLabel(p.date_of_demo)

  const result = await retoolDb.query<{ id: string }>(
    `INSERT INTO demo_raw_data (
       id, action, status,
       geo, demo_type,
       date_of_demo, demo_start_time, demo_end_time,
       lead_time_days, date_month,
       total_guests, total_vehicles, vehicle_type,
       start_location, description, guests_organization,
       host, slack_channel, slack_link,
       route_type, feature_type, system_required, recce_required,
       local_demo, cross_geo_demo, number_of_sessions, length,
       requester, created_at, updated_at
     ) VALUES (
       gen_random_uuid()::text, 'NEEDS REVIEW', 'pending',
       $1, $2,
       $3, $4, $5,
       $6, $7,
       $8, $9, $10,
       $11, $12, $13,
       $14, $15, $16,
       $17, $18, $19, $20,
       $21, $22, $23, $24,
       $25, NOW(), NOW()
     ) RETURNING id`,
    [
      p.geo, p.demo_type,
      p.date_of_demo, startTs, endTs,
      lead, month,
      normalize(p.total_guests) ?? '1',
      normalize(p.total_vehicles) ?? 1,
      normalize(p.vehicle_type),
      normalize(p.start_location),
      normalize(p.description),
      normalize(p.guests_organization),
      normalize(p.host),
      normalize(p.slack_channel),
      normalize(p.slack_link),
      normalize(p.route_type),
      normalize(p.feature_type),
      normalize(p.system_required),
      normalize(p.recce_required),
      normalize(p.local_demo),
      normalize(p.cross_geo_demo),
      normalize(p.number_of_sessions),
      normalize(p.length),
      user.fullName,
    ],
  )

  const row = result.data[0]
  if (!row) throw new Error('Insert did not return id')
  return { id: row.id }
}
