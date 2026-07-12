import { pool, timedQuery } from '../db.js'
import type { DemoRow, QueryOptions, CreateDemoInput } from '../types.js'

// Safe SQL expressions for ORDER BY — values come from this map, not user input
const SORT_SQL: Record<string, string> = {
  demo_date:      'date_of_demo',       // date type in demo_master — no cast needed
  date_requested: 'date_request_received',
  lead_days:      'lead_time_days',     // integer type in demo_master — no cast needed
}

export class DemoRepository {
  private static buildWhere(opts: QueryOptions): { clause: string; params: unknown[] } {
    const conditions: string[] = []
    const params: unknown[] = []

    if (opts.geo) {
      params.push(opts.geo)
      conditions.push(`UPPER(TRIM(geo)) = UPPER($${params.length})`)
    }
    if (opts.type) {
      params.push(`%${opts.type}%`)
      conditions.push(`LOWER(TRIM(type)) LIKE LOWER($${params.length})`)
    }
    if (opts.status) {
      params.push(`%${opts.status}%`)
      conditions.push(`LOWER(TRIM(status)) LIKE LOWER($${params.length})`)
    }
    if (opts.requester) {
      params.push(`%${opts.requester}%`)
      conditions.push(`LOWER(TRIM(requester)) LIKE LOWER($${params.length})`)
    }
    if (opts.approver) {
      params.push(`%${opts.approver}%`)
      conditions.push(`LOWER(TRIM(approver)) LIKE LOWER($${params.length})`)
    }
    if (opts.host) {
      params.push(`%${opts.host}%`)
      conditions.push(`LOWER(TRIM(host)) LIKE LOWER($${params.length})`)
    }
    if (opts.statusIn) {
      // Comma-separated list, e.g. "APPROVED,CANCELED,NEED REVIEW"
      const statuses = opts.statusIn.split(',').map(s => s.trim()).filter(Boolean)
      if (statuses.length > 0) {
        const placeholders = statuses.map((_, i) => `$${params.length + i + 1}`).join(', ')
        params.push(...statuses)
        conditions.push(`TRIM(status) IN (${placeholders})`)
      }
    }
    if (opts.month && /^(0[1-9]|1[0-2])$/.test(opts.month)) {
      params.push(Number(opts.month))
      conditions.push(`EXTRACT(MONTH FROM date_of_demo) = $${params.length}`)
    }
    if (opts.startDate && /^\d{4}-\d{2}-\d{2}$/.test(opts.startDate)) {
      params.push(opts.startDate)
      conditions.push(`date_of_demo >= $${params.length}`)
    }
    if (opts.endDate && /^\d{4}-\d{2}-\d{2}$/.test(opts.endDate)) {
      params.push(opts.endDate)
      conditions.push(`date_of_demo <= $${params.length}`)
    }
    if (opts.search) {
      const term = `%${opts.search}%`
      params.push(term)
      const n = params.length
      conditions.push(`(
        LOWER(COALESCE(demo_ref, ''))          LIKE LOWER($${n}) OR
        LOWER(COALESCE(requester, ''))         LIKE LOWER($${n}) OR
        LOWER(COALESCE(guests_organization,'')) LIKE LOWER($${n}) OR
        LOWER(COALESCE(host, ''))              LIKE LOWER($${n}) OR
        LOWER(COALESCE(geo, ''))               LIKE LOWER($${n}) OR
        LOWER(COALESCE(type, ''))              LIKE LOWER($${n})
      )`)
    }

    return {
      clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
      params,
    }
  }

  static async findAll(opts: QueryOptions = {}): Promise<{ data: DemoRow[]; total: number }> {
    const { clause, params } = DemoRepository.buildWhere(opts)

    // sortBy is validated against SORT_SQL keys — not user-controlled SQL
    const sortExpr = SORT_SQL[opts.sortBy ?? 'demo_date'] ?? SORT_SQL['demo_date']
    const dir = opts.sortDir === 'DESC' ? 'DESC' : 'ASC'
    const limit = Math.min(Math.max(Number(opts.limit ?? 500), 1), 1000)
    const offset = Math.max(Number(opts.offset ?? 0), 0)

    const dataParams = [...params, limit, offset]
    const dataSql = `
      SELECT
        dm.id, dm.demo_ref, dm.status, dm.channel, dm.geo, dm.type,
        dm.date_request_received, dm.date_of_demo,
        dm.demo_start_time, dm.demo_end_time, dm.length,
        dm.total_guests, dm.total_vehicles, dm.vehicle_type,
        dm.start_location, dm.calendar_event_link, dm.slack_link,
        dm.cross_geo_demo, dm.number_of_sessions_event,
        dm.description, dm.requester, dm.approver, dm.guests_organization,
        dm.route_type, dm.feature_type, dm.host,
        dm.lead_time_days, dm.cancelation_reason, dm.date_of_readiness,
        COALESCE(pf.feedback_count, 0)::int AS ops_feedback_count,
        COALESCE(pf.feedback_ids, '')       AS ops_feedback_ids
      FROM public.demo_master dm
      LEFT JOIN (
        SELECT demo_ref, COUNT(*)::int AS feedback_count,
               STRING_AGG(id::text, ',') AS feedback_ids
        FROM public.post_demo
        WHERE demo_ref IS NOT NULL AND demo_ref != ''
        GROUP BY demo_ref
      ) pf ON pf.demo_ref = dm.demo_ref
      ${clause}
      ORDER BY ${sortExpr} ${dir} NULLS LAST
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `
    const countSql = `SELECT COUNT(*) AS total FROM public.demo_master ${clause}`

    const [dataRes, countRes] = await Promise.all([
      timedQuery<DemoRow>('DemoRepository.findAll', dataSql, dataParams),
      pool.query<{ total: string }>(countSql, params),
    ])

    return {
      data:  dataRes.rows,
      total: parseInt(countRes.rows[0]?.total ?? '0', 10),
    }
  }

  static async create(data: CreateDemoInput): Promise<number | null> {
    const cols = Object.keys(data) as (keyof CreateDemoInput)[]
    if (cols.length === 0) return null
    const placeholders = cols.map((_, i) => `$${i + 1}`)
    const result = await pool.query<{ id: string }>(
      `INSERT INTO public.demo_master (${cols.join(', ')})
       VALUES (${placeholders.join(', ')})
       RETURNING id`,
      cols.map(c => data[c]),
    )
    return result.rows[0]?.id ? Number(result.rows[0].id) : null
  }

  /**
   * Update a single row by its primary key id.
   * Returns the number of rows affected.
   */
  static async updateById(
    id: number | string,
    data: Partial<CreateDemoInput>,
  ): Promise<number> {
    const cols = Object.keys(data) as (keyof CreateDemoInput)[]
    if (cols.length === 0) return 0
    const sets = cols.map((c, i) => `${c} = $${i + 1}`)
    const vals: unknown[] = cols.map(c => data[c])
    vals.push(id)
    const result = await pool.query(
      `UPDATE public.demo_master
       SET ${sets.join(', ')}
       WHERE id = $${cols.length + 1}`,
      vals,
    )
    return result.rowCount ?? 0
  }

  /**
   * Update rows matching requester + date_request_received.
   * Returns the number of rows affected.
   * Note: demo_master has no primary key; this combo is the most unique identifier.
   */
  static async update(
    where: { requester: string; date_request_received: string },
    data: Partial<CreateDemoInput>,
  ): Promise<number> {
    const cols = Object.keys(data) as (keyof CreateDemoInput)[]
    if (cols.length === 0) return 0
    const sets = cols.map((c, i) => `${c} = $${i + 1}`)
    const vals: unknown[] = cols.map(c => data[c])
    vals.push(where.requester, where.date_request_received)
    const result = await pool.query(
      `UPDATE public.demo_master
       SET ${sets.join(', ')}
       WHERE requester = $${cols.length + 1}
         AND date_request_received = $${cols.length + 2}`,
      vals,
    )
    return result.rowCount ?? 0
  }

  /**
   * Delete rows matching requester + date_request_received.
   * Returns the number of rows deleted.
   */
  static async delete(where: { requester: string; date_request_received: string }): Promise<number> {
    const result = await pool.query(
      `DELETE FROM public.demo_master
       WHERE requester = $1 AND date_request_received = $2`,
      [where.requester, where.date_request_received],
    )
    return result.rowCount ?? 0
  }
}
