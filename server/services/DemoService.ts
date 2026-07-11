import { DemoRepository } from '../repositories/DemoRepository.js'
import { DEMO_STATUS } from '../lib/demoStatus.js'
import type { DemoRow, NormalisedDemo, QueryOptions, CreateDemoInput } from '../types.js'

export class DemoService {
  // ─── Normalisation ──────────────────────────────────────────────────────────

  static normaliseStatus(raw: string | null): string {
    if (!raw) return DEMO_STATUS.NEED_REVIEW
    const s = raw.trim().toUpperCase()
    if (s.includes('TO DELETE') || s.includes('DELETE')) return DEMO_STATUS.DELETED
    // Canonical new values — pass through directly
    if (s === 'NEED REVIEW')  return DEMO_STATUS.NEED_REVIEW
    if (s === 'APPROVED')     return DEMO_STATUS.APPROVED
    if (s === 'CANCELED')     return DEMO_STATUS.CANCELED
    if (s === 'COMPLETED')    return DEMO_STATUS.COMPLETED
    // Legacy fallbacks (defensive — DB should already be migrated)
    if (s === 'REVIEWED')                       return DEMO_STATUS.APPROVED
    if (s === 'CANCELLED')                      return DEMO_STATUS.CANCELED
    if (s.includes('NEEDS') || s === 'NEEDS')   return DEMO_STATUS.NEED_REVIEW
    return raw.trim()
  }

  static normaliseType(raw: string | null): string {
    if (!raw) return ''
    const map: Record<string, string> = {
      'friends and family': 'Friend & Family',
      'friends & family':   'Friend & Family',
      'vip demo':           'VIP',
      'vip':                'VIP',
      'external guest':     'External',
      'external':           'External',
      'oem support':        'OEM Support',
      'performance check':  'Performance Check',
      'conference':         'Conference',
      'candidate':          'Candidate',
      'media':              'Media',
    }
    return map[raw.trim().toLowerCase()] ?? raw.trim()
  }

  /** Convert pg Date object or any date string to "YYYY-MM-DD". */
  static formatDate(raw: Date | string | null): string {
    if (!raw) return ''
    if (raw instanceof Date) {
      if (isNaN(raw.getTime())) return ''
      return raw.toISOString().substring(0, 10)
    }
    const s = String(raw).trim()
    // Already ISO "YYYY-MM-DD"
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10)
    // Legacy "DD/MM/YYYY" or "DD/MM/YYYY HH:MM:SS"
    const clean = s.split(' ')[0] ?? ''
    const parts = clean.split('/')
    if (parts.length === 3) {
      const [d, m, y] = parts
      return `${y}-${(m ?? '').padStart(2, '0')}-${(d ?? '').padStart(2, '0')}`
    }
    // Try JS Date parsing as last resort
    try {
      const d = new Date(s)
      if (!isNaN(d.getTime())) return d.toISOString().substring(0, 10)
    } catch { /* ignore */ }
    return ''
  }

  /** Extract "HH:MM" from a pg Date object or timestamp string. */
  static formatTime(raw: Date | string | null): string {
    if (!raw) return '00:00'
    if (raw instanceof Date) {
      if (isNaN(raw.getTime())) return '00:00'
      const h = String(raw.getHours()).padStart(2, '0')
      const m = String(raw.getMinutes()).padStart(2, '0')
      return `${h}:${m}`
    }
    const s = String(raw).trim()
    const timeStr = s.includes(' ') ? (s.split(' ')[1] ?? '') : s
    const parts = timeStr.split(':')
    return `${(parts[0] ?? '00').padStart(2, '0')}:${(parts[1] ?? '00').padStart(2, '0')}`
  }

  /** Parse number from typed integer, string, or null. */
  static parseNum(raw: number | string | null | undefined, fallback = 0): number {
    if (raw === null || raw === undefined) return fallback
    if (typeof raw === 'number') return isNaN(raw) ? fallback : raw
    const n = parseInt(String(raw).trim(), 10)
    return isNaN(n) ? fallback : n
  }

  static normaliseRow(row: DemoRow, displayIndex: number): NormalisedDemo {
    return {
      id:             `DR${String(displayIndex + 1).padStart(4, '0')}`,
      db_id:          row.id ? (Number(row.id) || null) : null,
      demo_ref:       row.demo_ref?.trim() ?? '',
      status:         DemoService.normaliseStatus(row.status),
      geo:            row.geo?.trim() ?? '',
      type:           DemoService.normaliseType(row.type),
      requester:      row.requester?.trim() ?? '',
      approver:       row.approver?.trim() ?? '',
      organization:   row.guests_organization?.trim() ?? '',
      host:           row.host?.trim() ?? '',
      date_requested: DemoService.formatDate(row.date_request_received),
      demo_date:      DemoService.formatDate(row.date_of_demo),
      start_time:     DemoService.formatTime(row.demo_start_time),
      end_time:       DemoService.formatTime(row.demo_end_time),
      vehicle_type:   row.vehicle_type?.trim() ?? '',
      total_guests:   DemoService.parseNum(row.total_guests),
      total_vehicles: DemoService.parseNum(row.total_vehicles),
      lead_days:      DemoService.parseNum(row.lead_time_days),
      readiness_date: row.date_of_readiness?.trim() || null,
      slack_link:     row.slack_link?.trim() || null,
      cancel_reason:  row.cancelation_reason?.trim() || null,
      channel:        row.channel?.trim() ?? '',
      description:    row.description?.trim() ?? '',
      start_location: row.start_location?.trim() ?? '',
      route_type:     row.route_type?.trim() ?? '',
      feature_type:   row.feature_type?.trim() ?? '',
      cross_geo:      row.cross_geo_demo !== null && row.cross_geo_demo !== undefined
                        ? String(row.cross_geo_demo)
                        : '',
      calendar_link:  row.calendar_event_link?.trim() || null,
      num_sessions:   DemoService.parseNum(row.number_of_sessions_event),
      duration:       row.length?.trim() ?? '',
    }
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  static async getDemos(opts: QueryOptions = {}): Promise<{ data: NormalisedDemo[]; total: number }> {
    const { data, total } = await DemoRepository.findAll(opts)
    const baseIndex = opts.offset ?? 0
    return {
      data: data.map((row, i) => DemoService.normaliseRow(row, baseIndex + i)),
      total,
    }
  }

  static async createDemo(input: CreateDemoInput): Promise<number | null> {
    return DemoRepository.create(input)
  }

  static async updateDemoById(id: number | string, data: Partial<CreateDemoInput>): Promise<number> {
    return DemoRepository.updateById(id, data)
  }

  static async updateDemo(
    where: { requester: string; date_request_received: string },
    data: Partial<CreateDemoInput>,
  ): Promise<number> {
    return DemoRepository.update(where, data)
  }

  static async deleteDemo(where: { requester: string; date_request_received: string }): Promise<number> {
    return DemoRepository.delete(where)
  }
}
