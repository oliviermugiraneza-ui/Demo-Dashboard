import { pool } from '../db.js'
import {
  PostDemoRepository,
  type PostDemoRow,
  type PostDemoInput,
  type PostDemoQueryOptions,
  type AnalyticsSummary,
  type ModelAnalytic,
  type InterventionAnalytic,
} from '../repositories/PostDemoRepository.js'

export class PostDemoService {
  static async getAll(opts: PostDemoQueryOptions = {}): Promise<{ data: PostDemoRow[]; total: number }> {
    return PostDemoRepository.findAll(opts)
  }

  static async getById(id: number): Promise<PostDemoRow | null> {
    return PostDemoRepository.findById(id)
  }

  static async create(data: PostDemoInput): Promise<number> {
    return PostDemoRepository.create(data)
  }

  static async update(id: number, data: Partial<PostDemoInput>): Promise<number> {
    return PostDemoRepository.updateById(id, data)
  }

  static async delete(id: number): Promise<number> {
    return PostDemoRepository.deleteById(id)
  }

  static async getAnalyticsSummary(opts: PostDemoQueryOptions = {}): Promise<AnalyticsSummary> {
    return PostDemoRepository.getAnalyticsSummary(opts)
  }

  static async getModelAnalytics(opts: PostDemoQueryOptions = {}): Promise<ModelAnalytic[]> {
    return PostDemoRepository.getModelAnalytics(opts)
  }

  static async getInterventionAnalytics(opts: PostDemoQueryOptions = {}): Promise<InterventionAnalytic[]> {
    return PostDemoRepository.getInterventionAnalytics(opts)
  }

  static async suggestDemoLink(geo: string, date: string): Promise<number | null> {
    try {
      const result = await pool.query<{ id: string }>(
        `SELECT id FROM public.demo_master
         WHERE UPPER(TRIM(geo)) = UPPER($1) AND date_of_demo::text LIKE $2 || '%'
         LIMIT 1`,
        [geo, date],
      )
      return result.rows[0] ? Number(result.rows[0].id) : null
    } catch {
      return null
    }
  }
}
