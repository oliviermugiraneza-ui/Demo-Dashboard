import { pool } from '../db.js'

export interface BacklogRow {
  id:                   string
  status:               string
  company:              string | null
  customer:             string | null
  requestor:            string | null
  host:                 string | null
  window_person:        string | null
  preferred_demo_date:  string | null
  preferred_time:       string | null
  demo_purpose:         string | null
  demo_route:           string | null
  vehicle:              string | null
  expected_performance: string | null
  priority:             string | null
  ticket_link:          string | null
  notes:                string | null
  geo:                  string | null
  demo_type:            string | null
  converted_demo_id:    string | null
  converted_at:         string | null
  created_at:           string
  updated_at:           string
  created_by:           string | null
  updated_by:           string | null
}

export type BacklogInput = Omit<BacklogRow, 'id' | 'created_at' | 'updated_at'>

export interface BacklogQueryOpts {
  search?:   string
  status?:   string
  priority?: string
  host?:     string
  geo?:      string
}

export class BacklogRepository {
  static async findAll(opts: BacklogQueryOpts = {}): Promise<BacklogRow[]> {
    const conditions: string[] = []
    const params: unknown[] = []

    if (opts.status && opts.status !== 'All') {
      params.push(opts.status)
      conditions.push(`LOWER(status) = LOWER($${params.length})`)
    }
    if (opts.priority && opts.priority !== 'All') {
      params.push(opts.priority)
      conditions.push(`LOWER(priority) = LOWER($${params.length})`)
    }
    if (opts.host && opts.host !== 'All') {
      params.push(`%${opts.host}%`)
      conditions.push(`LOWER(COALESCE(host,'')) LIKE LOWER($${params.length})`)
    }
    if (opts.geo && opts.geo !== 'All') {
      params.push(opts.geo)
      conditions.push(`LOWER(COALESCE(geo,'')) = LOWER($${params.length})`)
    }
    if (opts.search) {
      const term = `%${opts.search}%`
      params.push(term)
      const n = params.length
      conditions.push(`(
        LOWER(COALESCE(company,''))      LIKE LOWER($${n}) OR
        LOWER(COALESCE(customer,''))     LIKE LOWER($${n}) OR
        LOWER(COALESCE(host,''))         LIKE LOWER($${n}) OR
        LOWER(COALESCE(demo_purpose,'')) LIKE LOWER($${n}) OR
        LOWER(COALESCE(requestor,''))    LIKE LOWER($${n})
      )`)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const result = await pool.query<BacklogRow>(
      `SELECT * FROM public.demo_backlog ${where} ORDER BY updated_at DESC`,
      params,
    )
    return result.rows
  }

  static async findById(id: number): Promise<BacklogRow | null> {
    const result = await pool.query<BacklogRow>(
      'SELECT * FROM public.demo_backlog WHERE id = $1',
      [id],
    )
    return result.rows[0] ?? null
  }

  static async create(data: Partial<BacklogInput>): Promise<BacklogRow> {
    const cols = Object.keys(data)
    const vals = Object.values(data)
    if (cols.length === 0) {
      const result = await pool.query<BacklogRow>(
        `INSERT INTO public.demo_backlog (status) VALUES ('Proposed') RETURNING *`,
      )
      return result.rows[0]!
    }
    const placeholders = cols.map((_, i) => `$${i + 1}`)
    const result = await pool.query<BacklogRow>(
      `INSERT INTO public.demo_backlog (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      vals,
    )
    return result.rows[0]!
  }

  static async update(id: number, data: Partial<BacklogInput>): Promise<BacklogRow | null> {
    const cols = Object.keys(data)
    if (cols.length === 0) return null
    const sets = cols.map((c, i) => `${c} = $${i + 1}`)
    const vals = [...Object.values(data), id]
    const result = await pool.query<BacklogRow>(
      `UPDATE public.demo_backlog
       SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${cols.length + 1}
       RETURNING *`,
      vals,
    )
    return result.rows[0] ?? null
  }

  static async patchStatus(id: number, status: string): Promise<BacklogRow | null> {
    const result = await pool.query<BacklogRow>(
      `UPDATE public.demo_backlog SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id],
    )
    return result.rows[0] ?? null
  }

  static async markConverted(id: number, demoPk: number): Promise<BacklogRow | null> {
    const result = await pool.query<BacklogRow>(
      `UPDATE public.demo_backlog
       SET status = 'Converted', converted_demo_id = $1, converted_at = NOW(), updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [demoPk, id],
    )
    return result.rows[0] ?? null
  }

  static async delete(id: number): Promise<number> {
    const result = await pool.query(
      'DELETE FROM public.demo_backlog WHERE id = $1',
      [id],
    )
    return result.rowCount ?? 0
  }
}
