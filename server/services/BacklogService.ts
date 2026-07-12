import { BacklogRepository, type BacklogRow, type BacklogInput, type BacklogQueryOpts } from '../repositories/BacklogRepository.js'
import { DEMO_STATUS } from '../lib/demoStatus.js'
import { pool } from '../db.js'

const ALLOWED_STATUSES = new Set([
  'Proposed', 'Requested', 'Arranging', 'Confirmed', 'Completed', 'CANCELED', 'Converted',
])

export class BacklogService {
  static async getAll(opts: BacklogQueryOpts = {}): Promise<BacklogRow[]> {
    return BacklogRepository.findAll(opts)
  }

  static async getById(id: number): Promise<BacklogRow | null> {
    return BacklogRepository.findById(id)
  }

  static async create(data: Partial<BacklogInput>): Promise<BacklogRow> {
    if (!data.status) data.status = 'Proposed'
    return BacklogRepository.create(data)
  }

  static async update(id: number, data: Partial<BacklogInput>): Promise<BacklogRow | null> {
    return BacklogRepository.update(id, data)
  }

  static async patchStatus(id: number, status: string): Promise<{ ok: boolean; row?: BacklogRow; error?: string }> {
    if (!ALLOWED_STATUSES.has(status)) {
      return { ok: false, error: `status must be one of: ${[...ALLOWED_STATUSES].join(', ')}` }
    }
    const row = await BacklogRepository.patchStatus(id, status)
    if (!row) return { ok: false, error: 'Record not found' }
    return { ok: true, row }
  }

  static async delete(id: number): Promise<number> {
    return BacklogRepository.delete(id)
  }

  /** Convert backlog item → new demo_master row. Returns { demoId, backlog }. demo_ref is generated later on APPROVED. */
  static async convertToDemoRequest(id: number): Promise<{ demoId: number; backlog: BacklogRow } | null> {
    const item = await BacklogRepository.findById(id)
    if (!item) return null

    const today = new Date().toISOString().split('T')[0]!

    const result = await pool.query<{ id: string }>(
      `INSERT INTO public.demo_master (
         status, guests_organization, requester, host, vehicle_type,
         date_of_demo, description, geo, type, date_request_received
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8, $9, $10
       ) RETURNING id`,
      [
        DEMO_STATUS.NEED_REVIEW,
        item.company      ?? '',
        item.requestor    ?? '',
        item.host         ?? '',
        item.vehicle      ?? '',
        // preferred_demo_date is often free text — only pass it if it's a valid ISO date
        safeDate(item.preferred_demo_date),
        item.demo_purpose ?? '',
        item.geo          ?? '',
        item.demo_type    ?? '',
        today,
      ],
    )

    const demoId = Number(result.rows[0]?.id)
    if (!demoId || isNaN(demoId)) throw new Error('INSERT into demo_master did not return a valid id')

    console.log('[BacklogService] convert #%d → demo_master id=%d (demo_ref=null, NEED REVIEW)', id, demoId)

    const backlog = await BacklogRepository.markConverted(id, demoId, null)
    if (!backlog) throw new Error(`Failed to mark backlog item ${id} as converted`)

    return { demoId, backlog }
  }
}

/** Return raw as a YYYY-MM-DD string if it is a valid date, otherwise null. */
function safeDate(raw: string | null | undefined): string | null {
  if (!raw) return null
  const d = new Date(raw)
  if (isNaN(d.getTime())) return null
  return d.toISOString().split('T')[0]!
}
