import { pool } from '../db.js'

export type SatisfactionRow = Record<string, unknown>

export interface SatisfactionQueryOptions {
  limit?:     number
  offset?:    number
  geo?:       string
  type?:      string
  startDate?: string
  endDate?:   string
}

export class SatisfactionRepository {
  /** Returns column names for the satisfaction table, or [] if it doesn't exist. */
  private static async introspect(): Promise<string[]> {
    const res = await pool.query<{ column_name: string }>(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'satisfaction'
      ORDER BY ordinal_position
    `)
    return res.rows.map(r => r.column_name)
  }

  static async findAll(
    opts: SatisfactionQueryOptions = {},
  ): Promise<{ data: SatisfactionRow[]; total: number; columns: string[] }> {
    const columns = await SatisfactionRepository.introspect()
    if (columns.length === 0) {
      console.warn('[SatisfactionRepository] Table "satisfaction" not found or has no columns.')
      return { data: [], total: 0, columns: [] }
    }

    const conditions: string[] = []
    const params: unknown[] = []

    if (opts.geo && columns.includes('geo')) {
      params.push(opts.geo)
      conditions.push(`UPPER(TRIM(geo)) = UPPER($${params.length})`)
    }
    if (opts.type) {
      const typeCol = columns.find(c => c === 'demo_type' || c === 'type')
      if (typeCol) {
        params.push(`%${opts.type}%`)
        conditions.push(`LOWER(TRIM(${typeCol})) LIKE LOWER($${params.length})`)
      }
    }
    if (opts.startDate) {
      const dateCol = columns.find(c => c.includes('date') || c.includes('timestamp'))
      if (dateCol) {
        params.push(opts.startDate)
        conditions.push(`${dateCol}::date >= $${params.length}::date`)
      }
    }
    if (opts.endDate) {
      const dateCol = columns.find(c => c.includes('date') || c.includes('timestamp'))
      if (dateCol) {
        params.push(opts.endDate)
        conditions.push(`${dateCol}::date <= $${params.length}::date`)
      }
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const limit  = Math.min(Math.max(Number(opts.limit ?? 500), 1), 1000)
    const offset = Math.max(Number(opts.offset ?? 0), 0)

    const [dataRes, countRes] = await Promise.all([
      pool.query<SatisfactionRow>(
        `SELECT * FROM public.satisfaction ${where} ORDER BY ctid DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      ),
      pool.query<{ total: string }>(
        `SELECT COUNT(*) AS total FROM public.satisfaction ${where}`,
        params,
      ),
    ])

    return {
      data:    dataRes.rows,
      total:   parseInt(countRes.rows[0]?.total ?? '0', 10),
      columns,
    }
  }

  static async create(data: SatisfactionRow): Promise<void> {
    const cols = Object.keys(data)
    if (cols.length === 0) return
    const placeholders = cols.map((_, i) => `$${i + 1}`)
    await pool.query(
      `INSERT INTO public.satisfaction (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`,
      cols.map(c => data[c]),
    )
  }

  static async update(id: unknown, data: SatisfactionRow): Promise<number> {
    const cols = Object.keys(data)
    if (cols.length === 0) return 0
    const sets = cols.map((c, i) => `${c} = $${i + 1}`)
    const vals = [...cols.map(c => data[c]), id]
    const result = await pool.query(
      `UPDATE public.satisfaction SET ${sets.join(', ')} WHERE id = $${cols.length + 1}`,
      vals,
    )
    return result.rowCount ?? 0
  }

  static async delete(id: unknown): Promise<number> {
    const result = await pool.query(
      `DELETE FROM public.satisfaction WHERE id = $1`,
      [id],
    )
    return result.rowCount ?? 0
  }
}
