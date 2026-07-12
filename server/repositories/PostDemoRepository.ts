import { pool } from '../db.js'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PostDemoRow {
  id: string
  demo_id: string | null
  demo_ref: string | null
  category: string
  status: string | null
  submitted_at: string | null
  operator_email: string | null
  operator_name: string | null
  geo: string
  demo_date: string | null
  demo_time: string | null
  demo_type: string | null
  guest_organization: string | null
  route: string | null
  demo_route: string | null
  vehicle: string | null
  vehicle_id: string
  model_name: string
  model_behaviours: string[] | null
  problem_description: string | null
  positive_behaviour: string | null
  safety_score: number | null
  comfort_score: number | null
  decisiveness_score: number | null
  aggressiveness_score: number | null
  speed_following_score: number | null
  driving_features: string[] | null
  demo_issues: string[] | null
  number_of_uds: number | null
  power_cycle_required: boolean | null
  reason_for_power_cycle: string | null
  interventions: Record<string, number> | null
  safety_critical: boolean | null
  smoothness_score: number | null
  created_at: string
  updated_at: string
}

export interface PostDemoInput {
  demo_id?: number | null
  demo_ref?: string | null
  category: string
  status?: string
  submitted_at?: string | null
  operator_email?: string | null
  operator_name?: string | null
  geo: string
  demo_date?: string | null
  demo_time?: string | null
  demo_type?: string | null
  guest_organization?: string | null
  route?: string | null
  demo_route?: string | null
  vehicle?: string | null
  vehicle_id: string
  model_name: string
  model_behaviours?: string[] | null
  problem_description?: string | null
  positive_behaviour?: string | null
  safety_score?: number | null
  comfort_score?: number | null
  decisiveness_score?: number | null
  aggressiveness_score?: number | null
  speed_following_score?: number | null
  driving_features?: string[] | null
  demo_issues?: string[] | null
  number_of_uds?: number | null
  power_cycle_required?: boolean | null
  reason_for_power_cycle?: string | null
  interventions?: Record<string, number> | null
  interventions_sc?: Record<string, boolean> | null
  safety_critical?: boolean | null
  smoothness_score?: number | null
}

export interface PostDemoQueryOptions {
  limit?: number
  offset?: number
  category?: string
  geo?: string
  demoType?: string
  modelName?: string
  operatorName?: string
  route?: string
  startDate?: string
  endDate?: string
  safetyCritical?: boolean
  maxUds?: number
  month?: string
  minSafetyScore?: number
}

export interface AnalyticsSummary {
  total: number
  demo_count: number
  brt_count: number
  recce_count: number
  avg_safety: number | null
  avg_comfort: number | null
  avg_decisiveness: number | null
  avg_smoothness: number | null
  safety_critical_count: number
  total_uds: number
}

export interface ModelAnalytic {
  model_name: string
  run_count: number
  avg_safety: number | null
  avg_comfort: number | null
  avg_decisiveness: number | null
  avg_aggressiveness: number | null
  avg_speed_following: number | null
}

export interface InterventionAnalytic {
  intervention_type: string
  total_count: number
}

// ─── Filter builder ───────────────────────────────────────────────────────────

function buildFilters(opts: PostDemoQueryOptions): { conditions: string[]; params: unknown[] } {
  const conditions: string[] = []
  const params: unknown[] = []

  if (opts.category && opts.category !== 'ALL') {
    params.push(opts.category)
    conditions.push(`category = $${params.length}`)
  }
  if (opts.geo && opts.geo !== 'ALL') {
    params.push(opts.geo.toUpperCase())
    conditions.push(`UPPER(TRIM(geo)) = $${params.length}`)
  }
  if (opts.demoType) {
    params.push(opts.demoType)
    conditions.push(`LOWER(demo_type) = LOWER($${params.length})`)
  }
  if (opts.modelName) {
    params.push(opts.modelName)
    conditions.push(`model_name = $${params.length}`)
  }
  if (opts.operatorName) {
    params.push(`%${opts.operatorName}%`)
    conditions.push(`operator_name ILIKE $${params.length}`)
  }
  if (opts.route) {
    params.push(`%${opts.route}%`)
    conditions.push(`route ILIKE $${params.length}`)
  }
  if (opts.startDate) {
    params.push(opts.startDate)
    conditions.push(`demo_date >= $${params.length}`)
  }
  if (opts.endDate) {
    params.push(opts.endDate)
    conditions.push(`demo_date <= $${params.length}`)
  }
  if (opts.safetyCritical !== undefined) {
    params.push(opts.safetyCritical)
    conditions.push(`safety_critical = $${params.length}`)
  }
  if (opts.maxUds !== undefined) {
    params.push(opts.maxUds)
    conditions.push(`number_of_uds <= $${params.length}`)
  }
  if (opts.month && opts.month !== 'ALL') {
    params.push(opts.month)
    conditions.push(`TO_CHAR(demo_date, 'MM') = $${params.length}`)
  }
  if (opts.minSafetyScore !== undefined) {
    params.push(opts.minSafetyScore)
    conditions.push(`safety_score >= $${params.length}`)
  }

  return { conditions, params }
}

// ─── Repository ───────────────────────────────────────────────────────────────

export class PostDemoRepository {
  static async findAll(opts: PostDemoQueryOptions = {}): Promise<{ data: PostDemoRow[]; total: number }> {
    const { conditions, params } = buildFilters(opts)
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const countResult = await pool.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM public.post_demo ${where}`,
      params,
    )
    const total = parseInt(countResult.rows[0]?.total ?? '0', 10)

    const limit  = opts.limit  ?? 500
    const offset = opts.offset ?? 0
    const dataParams = [...params, limit, offset]

    const dataResult = await pool.query<PostDemoRow>(
      `SELECT * FROM public.post_demo ${where}
       ORDER BY demo_date DESC, created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      dataParams,
    )

    return { data: dataResult.rows, total }
  }

  static async findById(id: number): Promise<PostDemoRow | null> {
    const result = await pool.query<PostDemoRow>(
      'SELECT * FROM public.post_demo WHERE id = $1',
      [id],
    )
    return result.rows[0] ?? null
  }

  static async create(data: PostDemoInput): Promise<number> {
    const cols = Object.keys(data)
    const vals = Object.values(data)
    if (cols.length === 0) {
      throw new Error('No data provided for insert')
    }
    const placeholders = cols.map((_, i) => `$${i + 1}`)
    const result = await pool.query<{ id: string }>(
      `INSERT INTO public.post_demo (${cols.join(', ')})
       VALUES (${placeholders.join(', ')})
       RETURNING id`,
      vals,
    )
    return Number(result.rows[0]!.id)
  }

  static async updateById(id: number, data: Partial<PostDemoInput>): Promise<number> {
    const cols = Object.keys(data)
    if (cols.length === 0) return 0
    const sets = cols.map((c, i) => `${c} = $${i + 1}`)
    const vals = [...Object.values(data), id]
    const result = await pool.query(
      `UPDATE public.post_demo
       SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${cols.length + 1}`,
      vals,
    )
    return result.rowCount ?? 0
  }

  static async deleteById(id: number): Promise<number> {
    const result = await pool.query(
      'DELETE FROM public.post_demo WHERE id = $1',
      [id],
    )
    return result.rowCount ?? 0
  }

  static async getAnalyticsSummary(opts: PostDemoQueryOptions = {}): Promise<AnalyticsSummary> {
    const { conditions, params } = buildFilters(opts)
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const result = await pool.query<{
      total: string
      demo_count: string
      brt_count: string
      recce_count: string
      avg_safety: string | null
      avg_comfort: string | null
      avg_decisiveness: string | null
      avg_smoothness: string | null
      safety_critical_count: string
      total_uds: string
    }>(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE category = 'demo')  as demo_count,
        COUNT(*) FILTER (WHERE category = 'brt')   as brt_count,
        COUNT(*) FILTER (WHERE category = 'recce') as recce_count,
        ROUND(AVG(safety_score)::numeric, 1)      as avg_safety,
        ROUND(AVG(comfort_score)::numeric, 1)     as avg_comfort,
        ROUND(AVG(decisiveness_score)::numeric, 1) as avg_decisiveness,
        ROUND(AVG(smoothness_score)::numeric, 1)  as avg_smoothness,
        COUNT(*) FILTER (WHERE safety_critical = true) as safety_critical_count,
        COALESCE(SUM(number_of_uds), 0)           as total_uds
      FROM public.post_demo ${where}`,
      params,
    )

    const row = result.rows[0]!
    return {
      total:                 parseInt(row.total, 10),
      demo_count:            parseInt(row.demo_count, 10),
      brt_count:             parseInt(row.brt_count, 10),
      recce_count:           parseInt(row.recce_count, 10),
      avg_safety:            row.avg_safety      != null ? parseFloat(row.avg_safety)      : null,
      avg_comfort:           row.avg_comfort     != null ? parseFloat(row.avg_comfort)     : null,
      avg_decisiveness:      row.avg_decisiveness != null ? parseFloat(row.avg_decisiveness) : null,
      avg_smoothness:        row.avg_smoothness   != null ? parseFloat(row.avg_smoothness)  : null,
      safety_critical_count: parseInt(row.safety_critical_count, 10),
      total_uds:             parseInt(row.total_uds, 10),
    }
  }

  static async getModelAnalytics(opts: PostDemoQueryOptions = {}): Promise<ModelAnalytic[]> {
    const { conditions, params } = buildFilters(opts)
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const result = await pool.query<{
      model_name: string
      run_count: string
      avg_safety: string | null
      avg_comfort: string | null
      avg_decisiveness: string | null
      avg_aggressiveness: string | null
      avg_speed_following: string | null
      total_interventions: string | null
    }>(
      `SELECT
        model_name,
        COUNT(*)                                        as run_count,
        ROUND(AVG(safety_score)::numeric, 1)           as avg_safety,
        ROUND(AVG(comfort_score)::numeric, 1)          as avg_comfort,
        ROUND(AVG(decisiveness_score)::numeric, 1)     as avg_decisiveness,
        ROUND(AVG(aggressiveness_score)::numeric, 1)   as avg_aggressiveness,
        ROUND(AVG(speed_following_score)::numeric, 1)  as avg_speed_following,
        SUM(
          (SELECT COALESCE(SUM(
            CASE WHEN jsonb_typeof(v) = 'number' THEN (v #>> '{}')::int
                 ELSE (v ->> 'count')::int
            END
          ), 0)
          FROM jsonb_each(COALESCE(interventions, '{}'::jsonb)) j(k, v)
          WHERE jsonb_typeof(v) IN ('number', 'object'))
        )                                              as total_interventions
      FROM public.post_demo ${where}
      GROUP BY model_name
      ORDER BY avg_safety DESC NULLS LAST`,
      params,
    )

    return result.rows.map(row => ({
      model_name:          row.model_name,
      run_count:           parseInt(row.run_count, 10),
      avg_safety:          row.avg_safety         != null ? parseFloat(row.avg_safety)         : null,
      avg_comfort:         row.avg_comfort        != null ? parseFloat(row.avg_comfort)        : null,
      avg_decisiveness:    row.avg_decisiveness   != null ? parseFloat(row.avg_decisiveness)   : null,
      avg_aggressiveness:  row.avg_aggressiveness != null ? parseFloat(row.avg_aggressiveness) : null,
      avg_speed_following: row.avg_speed_following != null ? parseFloat(row.avg_speed_following) : null,
      total_interventions: row.total_interventions != null ? parseInt(row.total_interventions, 10) : 0,
    }))
  }

  static async getInterventionAnalytics(opts: PostDemoQueryOptions = {}): Promise<InterventionAnalytic[]> {
    const { conditions, params } = buildFilters(opts)
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const result = await pool.query<{ intervention_type: string; total_count: string }>(
      `SELECT key as intervention_type, SUM(value::int) as total_count
       FROM public.post_demo,
            jsonb_each_text(COALESCE(interventions, '{}'::jsonb)) AS kv(key, value)
       ${where}
       GROUP BY key
       ORDER BY total_count DESC`,
      params,
    )

    return result.rows.map(row => ({
      intervention_type: row.intervention_type,
      total_count:       parseInt(row.total_count, 10),
    }))
  }
}
