import { pool } from '../db.js'

// ─── Constants ────────────────────────────────────────────────────────────────

export const VALID_GEOS = ['JP', 'UK', 'US', 'DE'] as const
export type ValidGeo = typeof VALID_GEOS[number]

const REF_REGEX = /^(JP|UK|US|DE)-[0-9]{6}-[0-9]{2}$/

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toYYMMDD(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '000000'
  const raw = dateStr instanceof Date ? dateStr.toISOString() : String(dateStr)
  const s = raw.trim().substring(0, 10)  // "YYYY-MM-DD"
  const [y, m, d] = s.split('-')
  if (!y || !m || !d || y === '0000') return '000000'
  return `${y.slice(-2)}${m}${d}`
}

// ─── Public API ───────────────────────────────────────────────────────────────

export class DemoReferenceService {

  // ── Validation ──────────────────────────────────────────────────────────────

  static isValidGeo(geo: string | null | undefined): geo is ValidGeo {
    return VALID_GEOS.includes(String(geo ?? '').trim().toUpperCase() as ValidGeo)
  }

  static isValidRef(ref: string | null | undefined): boolean {
    return REF_REGEX.test(String(ref ?? ''))
  }

  static normaliseGeo(geo: string | null | undefined): ValidGeo | null {
    const g = String(geo ?? '').trim().toUpperCase()
    return VALID_GEOS.includes(g as ValidGeo) ? (g as ValidGeo) : null
  }

  // ── Resolution: demo_ref → demo_master.id ───────────────────────────────────

  static async resolve(demoRef: string): Promise<number | null> {
    if (!DemoReferenceService.isValidRef(demoRef)) return null
    try {
      const res = await pool.query<{ id: string }>(
        `SELECT id FROM public.demo_master WHERE demo_ref = $1 LIMIT 1`,
        [demoRef],
      )
      const id = res.rows[0]?.id
      return id ? Number(id) : null
    } catch {
      return null
    }
  }

  // ── Generation: assign demo_ref to a demo row by its DB id ─────────────────
  //
  // Atomically finds the next sequence for (geo, YYMMDD) and writes it.
  // Returns null if GEO is invalid or the row already has a valid ref.
  // Throws with a user-friendly message if GEO is not in VALID_GEOS.

  static async generate(demoId: number, geo: string | null | undefined, dateStr: string | Date | null | undefined): Promise<string | null> {
    const g = DemoReferenceService.normaliseGeo(geo)
    if (!g) {
      throw new Error(
        `Cannot generate Demo Reference: GEO "${String(geo ?? '')}" is not valid. ` +
        `Allowed values: ${VALID_GEOS.join(', ')}.`,
      )
    }

    const yymmdd  = toYYMMDD(dateStr)
    if (yymmdd === '000000') {
      throw new Error(
        'Cannot generate Demo Reference: demo date is missing or invalid. ' +
        'Please set a valid date before converting.',
      )
    }

    const prefix  = `${g}-${yymmdd}`
    const pattern = `${prefix}-%`
    const rxTest  = `^${prefix}-[0-9]+$`

    try {
      const res = await pool.query<{ demo_ref: string }>(
        `UPDATE public.demo_master
         SET demo_ref = (
           SELECT $1 || '-' || LPAD(
             (COALESCE(MAX(
               CASE WHEN demo_ref ~ $2
                    THEN CAST(SPLIT_PART(demo_ref, '-', 3) AS INTEGER)
               END
             ), 0) + 1)::text,
             2, '0'
           )
           FROM public.demo_master
           WHERE demo_ref LIKE $3
         )
         WHERE id = $4 AND demo_ref IS NULL
         RETURNING demo_ref`,
        [prefix, rxTest, pattern, demoId],
      )

      if (!res.rowCount || res.rowCount === 0) {
        // Row already had a demo_ref — fetch and return it
        const existing = await pool.query<{ demo_ref: string | null }>(
          `SELECT demo_ref FROM public.demo_master WHERE id = $1`,
          [demoId],
        )
        return existing.rows[0]?.demo_ref ?? null
      }

      return res.rows[0]?.demo_ref ?? null
    } catch (err) {
      // Re-throw user-friendly errors as-is; wrap raw DB errors
      if (err instanceof Error && err.message.startsWith('Cannot generate')) throw err
      console.error('[DemoReferenceService] generate error:', String(err))
      return null
    }
  }

  // ── Regeneration: forcibly replace existing demo_ref on date/GEO change ────
  //
  // NULLs the current ref first (releasing the unique slot), then generates
  // a fresh one based on the new geo + date.

  static async regenerate(demoId: number, geo: string | null | undefined, dateStr: string | Date | null | undefined): Promise<string | null> {
    const g = DemoReferenceService.normaliseGeo(geo)
    if (!g) {
      console.warn('[DemoReferenceService] regenerate skipped — invalid GEO:', geo)
      return null
    }

    const yymmdd = toYYMMDD(dateStr)
    if (yymmdd === '000000') {
      console.warn('[DemoReferenceService] regenerate skipped — missing date for id=%d', demoId)
      return null
    }

    // Clear the existing ref so the unique slot is free
    await pool.query(`UPDATE public.demo_master SET demo_ref = NULL WHERE id = $1`, [demoId])

    return DemoReferenceService.generate(demoId, g, dateStr)
  }

  // ── Backfill: assign demo_ref to every row missing one or with an invalid one

  static async backfill(): Promise<{ updated: number; skipped: number; errors: string[] }> {
    const errors: string[] = []
    let updated = 0
    let skipped = 0

    // Fetch rows with NULL or invalid refs, ordered for deterministic sequencing
    const rows = await pool.query<{
      id: string
      geo: string | null
      date_of_demo: string | null
      demo_ref: string | null
    }>(
      `SELECT id,
              UPPER(TRIM(COALESCE(geo, '')))       AS geo,
              TO_CHAR(date_of_demo, 'YYYY-MM-DD')  AS date_of_demo,
              demo_ref
       FROM public.demo_master
       WHERE demo_ref IS NULL
          OR demo_ref !~ '^(JP|UK|US|DE)-[0-9]{6}-[0-9]{2}$'
       ORDER BY COALESCE(date_of_demo, '9999-12-31'), id ASC`,
    )

    for (const row of rows.rows) {
      const id = Number(row.id)

      // Validate GEO
      const g = DemoReferenceService.normaliseGeo(row.geo)
      if (!g) {
        const msg = `id=${row.id}: GEO="${row.geo ?? ''}" is not valid — skipped`
        errors.push(msg)
        skipped++
        continue
      }

      // Validate date
      const yymmdd = toYYMMDD(row.date_of_demo)
      if (yymmdd === '000000') {
        const msg = `id=${row.id}: date_of_demo is missing or invalid — skipped`
        errors.push(msg)
        skipped++
        continue
      }

      // Clear invalid/null ref, then generate
      if (row.demo_ref !== null) {
        await pool.query(`UPDATE public.demo_master SET demo_ref = NULL WHERE id = $1`, [id])
      }

      try {
        const ref = await DemoReferenceService.generate(id, g, row.date_of_demo)
        if (ref) {
          updated++
          console.log(`  ✓ #${id} (was "${row.demo_ref ?? 'NULL'}") → ${ref}`)
        } else {
          errors.push(`id=${row.id}: generate returned null`)
          skipped++
        }
      } catch (err) {
        errors.push(`id=${row.id}: ${String(err)}`)
        skipped++
      }
    }

    return { updated, skipped, errors }
  }
}
