import express, { type Response } from 'express'
import cors from 'cors'
import { pool, isAuthError, isConnError, refreshPool } from './db.js'
import { DemoService } from './services/DemoService.js'
import { DEMO_STATUS } from './lib/demoStatus.js'
import { DemoReferenceService } from './services/DemoReferenceService.js'
import { SatisfactionService } from './services/SatisfactionService.js'
import { BacklogService } from './services/BacklogService.js'
import { NotificationService, type DemoNotificationData } from './services/NotificationService.js'
import { GoogleCalendarService } from './services/GoogleCalendarService.js'
import { PostDemoService } from './services/PostDemoService.js'
import type { QueryOptions, CreateDemoInput } from './types.js'
import type { BacklogInput } from './repositories/BacklogRepository.js'
import type { PostDemoInput, PostDemoQueryOptions } from './repositories/PostDemoRepository.js'

const app = express()
const PORT = Number(process.env.API_PORT ?? 3001)

app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }))
app.use(express.json())

// ─── Request timing middleware ────────────────────────────────────────────────

app.use((req, res, next) => {
  const t0 = Date.now()
  res.on('finish', () => {
    const ms = Date.now() - t0
    const slow = ms > 800 ? ' ⚠ SLOW' : ''
    console.log('[api] %s %s → %dms %d%s', req.method, req.path, ms, res.statusCode, slow)
  })
  next()
})

// ─── Centralised DB error handler ────────────────────────────────────────────

function handleDbError(err: unknown, res: Response): void {
  console.error('[api] DB error:', String(err))

  if (isAuthError(err)) {
    // Reload .env so the next request picks up a new token if the user has updated it
    refreshPool()
    res.status(503).json({
      ok:    false,
      code:  'AUTH_EXPIRED',
      error: 'Database authentication failed — OAuth token may be expired.',
      hint:  'Update DATABASE_URL in .env with a fresh Databricks OAuth token. The server will retry automatically on the next request.',
    })
    return
  }

  if (isConnError(err)) {
    res.status(503).json({
      ok:    false,
      code:  'DB_UNREACHABLE',
      error: 'Cannot reach the database.',
      hint:  'Verify that DATABASE_URL is correct and the Lakebase endpoint is accessible.',
    })
    return
  }

  res.status(500).json({ ok: false, error: String(err) })
}

// ─── Health ───────────────────────────────────────────────────────────────────

app.get('/api/health', async (_req, res) => {
  try {
    const result = await pool.query<{ now: string }>('SELECT NOW() AS now')
    res.json({
      ok:    true,
      db:    'connected',
      ts:    new Date().toISOString(),
      db_ts: result.rows[0]?.now,
    })
  } catch (err) {
    handleDbError(err, res)
  }
})

// ─── Demos — GET /api/demos ───────────────────────────────────────────────────
// Query params: limit, offset, search, geo, type, status, requester, approver, host, sortBy, sortDir

app.get('/api/demos', async (req, res) => {
  try {
    const raw = req.query as Record<string, string | undefined>

    const opts: QueryOptions = {}
    if (raw.limit)     opts.limit     = Number(raw.limit)
    if (raw.offset)    opts.offset    = Number(raw.offset)
    if (raw.search)    opts.search    = raw.search
    if (raw.geo)       opts.geo       = raw.geo
    if (raw.type)      opts.type      = raw.type
    if (raw.status)    opts.status    = raw.status
    if (raw.statusIn)  opts.statusIn  = raw.statusIn
    if (raw.requester) opts.requester = raw.requester
    if (raw.approver)  opts.approver  = raw.approver
    if (raw.host)      opts.host      = raw.host
    if (raw.month)     opts.month     = raw.month
    if (raw.startDate) opts.startDate = raw.startDate
    if (raw.endDate)   opts.endDate   = raw.endDate
    if (raw.sortBy && ['demo_date', 'date_requested', 'lead_days'].includes(raw.sortBy)) {
      opts.sortBy = raw.sortBy as QueryOptions['sortBy']
    }
    if (raw.sortDir === 'DESC') opts.sortDir = 'DESC'

    const { data, total } = await DemoService.getDemos(opts)
    res.json({ ok: true, total, data })
  } catch (err) {
    handleDbError(err, res)
  }
})

// ─── Demos — POST /api/demos ──────────────────────────────────────────────────

app.post('/api/demos', async (req, res) => {
  try {
    const body = req.body as CreateDemoInput
    console.log('[demos] POST payload:', JSON.stringify(body))
    const newId = await DemoService.createDemo(body)
    console.log('[demos] created id=%d (demo_ref=null, status=NEED REVIEW)', newId)
    res.status(201).json({ ok: true, id: newId, demo_ref: null })

    // Fire demo_created notification — never blocks the request
    if (newId) {
      NotificationService.fetchDemoRow(newId)
        .then(demo => demo ? NotificationService.notifyDemoCreated(demo) : undefined)
        .catch(err => console.error('[notifications] demo_created non-fatal:', String(err)))
    }
  } catch (err) {
    const e = err as Error
    console.error('[demos] POST error — payload:', JSON.stringify(req.body))
    console.error('[demos] POST error:', e.message, e.stack)
    handleDbError(err, res)
  }
})

// ─── Demos — GET /api/demos/resolve-ref/:ref ──────────────────────────────────
// Resolve a Demo Reference (e.g. JP-260704-01) → demo_master.id

app.get('/api/demos/resolve-ref/:ref', async (req, res) => {
  const ref = String(req.params.ref ?? '').trim().toUpperCase()
  if (!/^(JP|UK|US|DE)-[0-9]{6}-[0-9]{2}$/.test(ref)) {
    res.status(400).json({ ok: false, error: 'Invalid demo reference format. Expected: GEO-YYMMDD-SEQ (e.g. JP-260704-01)' })
    return
  }
  const demoId = await DemoReferenceService.resolve(ref)
  if (!demoId) {
    res.status(404).json({ ok: false, error: `No demo found with reference ${ref}` })
    return
  }
  res.json({ ok: true, demo_id: demoId, demo_ref: ref })
})

// ─── Demos — GET /api/demos/search-ref?geo=JP&dateCode=260704 ─────────────────
// Smart partial/full lookup for wizard. Supports date-code shorthand.

app.get('/api/demos/search-ref', async (req, res) => {
  const { geo, dateCode } = req.query as { geo?: string; dateCode?: string }
  if (!geo || !dateCode) {
    res.status(400).json({ ok: false, error: 'geo and dateCode are required' })
    return
  }
  const g = String(geo).trim().toUpperCase()
  const d = String(dateCode).trim()
  if (!/^[A-Z]{2}$/.test(g)) {
    res.status(400).json({ ok: false, error: 'Invalid GEO' })
    return
  }
  if (!/^[0-9]{6}$/.test(d)) {
    res.status(400).json({ ok: false, error: 'dateCode must be 6 digits (YYMMDD)' })
    return
  }
  try {
    const pattern = `${g}-${d}-%`
    const result = await pool.query<{
      id: string; demo_ref: string; geo: string | null; date_of_demo: string | null
      demo_start_time: string | null; type: string | null; guests_organization: string | null
      start_location: string | null; vehicle_type: string | null; host: string | null
    }>(
      `SELECT id, demo_ref, geo,
              TO_CHAR(date_of_demo, 'YYYY-MM-DD') AS date_of_demo,
              TO_CHAR(demo_start_time, 'HH24:MI')  AS demo_start_time,
              type, guests_organization, start_location, vehicle_type, host
       FROM public.demo_master WHERE demo_ref LIKE $1 ORDER BY demo_ref`,
      [pattern],
    )
    const toDemoShape = (row: typeof result.rows[0]) => ({
      id: Number(row.id), demo_ref: row.demo_ref, geo: row.geo,
      date_of_demo: row.date_of_demo, demo_start_time: row.demo_start_time,
      type: row.type, guests_organization: row.guests_organization,
      start_location: row.start_location, vehicle_type: row.vehicle_type, host: row.host,
    })
    if (result.rowCount === 0) {
      res.status(404).json({ ok: false, error: `No demo found for ${g}-${d}` })
    } else if (result.rowCount === 1) {
      res.json({ ok: true, mode: 'single', demo: toDemoShape(result.rows[0]!) })
    } else {
      res.json({ ok: true, mode: 'multiple', matches: result.rows.map(toDemoShape) })
    }
  } catch (err) {
    handleDbError(err, res)
  }
})

// ─── Admin — GET /api/admin/operators?geo=JP ─────────────────────────────────
// Reads from dedicated operators table; also used by Ops Feedback wizard

app.get('/api/admin/operators', async (req, res) => {
  const { geo } = req.query as { geo?: string }
  try {
    const params: unknown[] = []
    const conditions: string[] = []
    if (geo) { params.push(geo.toUpperCase()); conditions.push(`UPPER(TRIM(geo)) = $${params.length}`) }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const result = await pool.query<{ id: string; full_name: string; email: string; geo: string }>(
      `SELECT id, full_name, email, geo FROM public.operators ${where} ORDER BY full_name`, params,
    )
    res.json({ ok: true, data: result.rows })
  } catch (err) { handleDbError(err, res) }
})

app.post('/api/admin/operators', async (req, res) => {
  try {
    const { full_name, email, geo } = req.body as Record<string, string>
    if (!full_name?.trim() || !email?.trim() || !geo?.trim()) {
      res.status(400).json({ ok: false, error: 'full_name, email and geo are required' }); return
    }
    const r = await pool.query<{ id: string }>(
      `INSERT INTO public.operators (full_name, email, geo, role) VALUES ($1,$2,$3,'Operator') RETURNING id`,
      [full_name.trim(), email.trim().toLowerCase(), geo.toUpperCase()],
    )
    res.status(201).json({ ok: true, id: Number(r.rows[0]!.id) })
  } catch (err) {
    if ((err as { code?: string }).code === '23505') { res.status(409).json({ ok: false, error: 'Email already exists' }); return }
    handleDbError(err, res)
  }
})

app.put('/api/admin/operators/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!id) { res.status(400).json({ ok: false, error: 'Invalid id' }); return }
    const { full_name, email, geo } = req.body as Record<string, string>
    const sets: string[] = []; const params: unknown[] = []
    if (full_name !== undefined) { params.push(full_name.trim()); sets.push(`full_name=$${params.length}`) }
    if (email     !== undefined) { params.push(email.trim().toLowerCase()); sets.push(`email=$${params.length}`) }
    if (geo       !== undefined) { params.push(geo.toUpperCase()); sets.push(`geo=$${params.length}`) }
    if (!sets.length) { res.status(400).json({ ok: false, error: 'Nothing to update' }); return }
    params.push(id)
    await pool.query(`UPDATE public.operators SET ${sets.join(',')},updated_at=NOW() WHERE id=$${params.length}`, params)
    res.json({ ok: true })
  } catch (err) { handleDbError(err, res) }
})

app.delete('/api/admin/operators/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!id) { res.status(400).json({ ok: false, error: 'Invalid id' }); return }
    await pool.query('DELETE FROM public.operators WHERE id=$1', [id])
    res.json({ ok: true })
  } catch (err) { handleDbError(err, res) }
})

// ─── Admin — Hosts CRUD /api/admin/hosts ─────────────────────────────────────

app.get('/api/admin/hosts', async (req, res) => {
  try {
    const { geo } = req.query as { geo?: string }
    const params: unknown[] = []; const conditions: string[] = []
    if (geo) { params.push(geo.toUpperCase()); conditions.push(`UPPER(TRIM(geo))=$${params.length}`) }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const r = await pool.query(`SELECT id,full_name,email,geo,role FROM public.hosts ${where} ORDER BY full_name`, params)
    res.json({ ok: true, data: r.rows })
  } catch (err) { handleDbError(err, res) }
})

app.post('/api/admin/hosts', async (req, res) => {
  try {
    const { full_name, email, geo } = req.body as Record<string, string>
    if (!full_name?.trim() || !email?.trim() || !geo?.trim()) {
      res.status(400).json({ ok: false, error: 'full_name, email and geo are required' }); return
    }
    const r = await pool.query<{ id: string }>(
      `INSERT INTO public.hosts (full_name,email,geo,role) VALUES ($1,$2,$3,'Host') RETURNING id`,
      [full_name.trim(), email.trim().toLowerCase(), geo.toUpperCase()],
    )
    res.status(201).json({ ok: true, id: Number(r.rows[0]!.id) })
  } catch (err) {
    if ((err as { code?: string }).code === '23505') { res.status(409).json({ ok: false, error: 'Email already exists' }); return }
    handleDbError(err, res)
  }
})

app.put('/api/admin/hosts/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!id) { res.status(400).json({ ok: false, error: 'Invalid id' }); return }
    const { full_name, email, geo } = req.body as Record<string, string>
    const sets: string[] = []; const params: unknown[] = []
    if (full_name !== undefined) { params.push(full_name.trim()); sets.push(`full_name=$${params.length}`) }
    if (email     !== undefined) { params.push(email.trim().toLowerCase()); sets.push(`email=$${params.length}`) }
    if (geo       !== undefined) { params.push(geo.toUpperCase()); sets.push(`geo=$${params.length}`) }
    if (!sets.length) { res.status(400).json({ ok: false, error: 'Nothing to update' }); return }
    params.push(id)
    await pool.query(`UPDATE public.hosts SET ${sets.join(',')},updated_at=NOW() WHERE id=$${params.length}`, params)
    res.json({ ok: true })
  } catch (err) { handleDbError(err, res) }
})

app.delete('/api/admin/hosts/:id', async (req, res) => {
  try {
    const id = Number(req.params.id); if (!id) { res.status(400).json({ ok: false, error: 'Invalid id' }); return }
    await pool.query('DELETE FROM public.hosts WHERE id=$1', [id])
    res.json({ ok: true })
  } catch (err) { handleDbError(err, res) }
})

// ─── Admin — Models CRUD /api/admin/models ────────────────────────────────────

app.get('/api/admin/models', async (req, res) => {
  try {
    const { geo } = req.query as { geo?: string }
    const params: unknown[] = []; const conditions: string[] = []
    if (geo) { params.push(geo.toUpperCase()); conditions.push(`UPPER(TRIM(geo))=$${params.length}`) }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const r = await pool.query(`SELECT id,model_name,platform,baseline_tag,geo FROM public.models ${where} ORDER BY model_name`, params)
    res.json({ ok: true, data: r.rows })
  } catch (err) { handleDbError(err, res) }
})

app.post('/api/admin/models', async (req, res) => {
  try {
    const { model_name, platform, baseline_tag, geo } = req.body as Record<string, string | boolean>
    if (!String(model_name ?? '').trim() || !String(geo ?? '').trim()) {
      res.status(400).json({ ok: false, error: 'model_name and geo are required' }); return
    }
    const r = await pool.query<{ id: string }>(
      `INSERT INTO public.models (model_name,platform,baseline_tag,geo) VALUES ($1,$2,$3,$4) RETURNING id`,
      [String(model_name).trim(), String(platform || 'dGPU'), baseline_tag === true || baseline_tag === 'true', String(geo).toUpperCase()],
    )
    res.status(201).json({ ok: true, id: Number(r.rows[0]!.id) })
  } catch (err) { handleDbError(err, res) }
})

app.put('/api/admin/models/:id', async (req, res) => {
  try {
    const id = Number(req.params.id); if (!id) { res.status(400).json({ ok: false, error: 'Invalid id' }); return }
    const { model_name, platform, baseline_tag, geo } = req.body as Record<string, string | boolean>
    const sets: string[] = []; const params: unknown[] = []
    if (model_name   !== undefined) { params.push(String(model_name).trim()); sets.push(`model_name=$${params.length}`) }
    if (platform     !== undefined) { params.push(String(platform)); sets.push(`platform=$${params.length}`) }
    if (baseline_tag !== undefined) { params.push(baseline_tag === true || baseline_tag === 'true'); sets.push(`baseline_tag=$${params.length}`) }
    if (geo          !== undefined) { params.push(String(geo).toUpperCase()); sets.push(`geo=$${params.length}`) }
    if (!sets.length) { res.status(400).json({ ok: false, error: 'Nothing to update' }); return }
    params.push(id)
    await pool.query(`UPDATE public.models SET ${sets.join(',')},updated_at=NOW() WHERE id=$${params.length}`, params)
    res.json({ ok: true })
  } catch (err) { handleDbError(err, res) }
})

app.delete('/api/admin/models/:id', async (req, res) => {
  try {
    const id = Number(req.params.id); if (!id) { res.status(400).json({ ok: false, error: 'Invalid id' }); return }
    await pool.query('DELETE FROM public.models WHERE id=$1', [id])
    res.json({ ok: true })
  } catch (err) { handleDbError(err, res) }
})

// ─── Admin — Routes CRUD /api/admin/routes ────────────────────────────────────

app.get('/api/admin/routes', async (req, res) => {
  try {
    const { geo } = req.query as { geo?: string }
    const params: unknown[] = []; const conditions: string[] = []
    if (geo) { params.push(geo.toUpperCase()); conditions.push(`UPPER(TRIM(geo))=$${params.length}`) }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const r = await pool.query(`SELECT id,route_name,console_link,geo FROM public.routes ${where} ORDER BY route_name`, params)
    res.json({ ok: true, data: r.rows })
  } catch (err) { handleDbError(err, res) }
})

app.post('/api/admin/routes', async (req, res) => {
  try {
    const { route_name, console_link, geo } = req.body as Record<string, string>
    if (!route_name?.trim() || !geo?.trim()) {
      res.status(400).json({ ok: false, error: 'route_name and geo are required' }); return
    }
    const r = await pool.query<{ id: string }>(
      `INSERT INTO public.routes (route_name,console_link,geo) VALUES ($1,$2,$3) RETURNING id`,
      [route_name.trim(), console_link?.trim() || null, geo.toUpperCase()],
    )
    res.status(201).json({ ok: true, id: Number(r.rows[0]!.id) })
  } catch (err) { handleDbError(err, res) }
})

app.put('/api/admin/routes/:id', async (req, res) => {
  try {
    const id = Number(req.params.id); if (!id) { res.status(400).json({ ok: false, error: 'Invalid id' }); return }
    const { route_name, console_link, geo } = req.body as Record<string, string>
    const sets: string[] = []; const params: unknown[] = []
    if (route_name    !== undefined) { params.push(route_name.trim()); sets.push(`route_name=$${params.length}`) }
    if (console_link  !== undefined) { params.push(console_link?.trim() || null); sets.push(`console_link=$${params.length}`) }
    if (geo           !== undefined) { params.push(geo.toUpperCase()); sets.push(`geo=$${params.length}`) }
    if (!sets.length) { res.status(400).json({ ok: false, error: 'Nothing to update' }); return }
    params.push(id)
    await pool.query(`UPDATE public.routes SET ${sets.join(',')},updated_at=NOW() WHERE id=$${params.length}`, params)
    res.json({ ok: true })
  } catch (err) { handleDbError(err, res) }
})

app.delete('/api/admin/routes/:id', async (req, res) => {
  try {
    const id = Number(req.params.id); if (!id) { res.status(400).json({ ok: false, error: 'Invalid id' }); return }
    await pool.query('DELETE FROM public.routes WHERE id=$1', [id])
    res.json({ ok: true })
  } catch (err) { handleDbError(err, res) }
})

// ─── Admin — Vehicles CRUD /api/admin/vehicles ────────────────────────────────

app.get('/api/admin/vehicles', async (req, res) => {
  try {
    const { geo } = req.query as { geo?: string }
    const params: unknown[] = []; const conditions: string[] = []
    if (geo) { params.push(geo.toUpperCase()); conditions.push(`UPPER(TRIM(geo))=$${params.length}`) }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const r = await pool.query(`SELECT id,vehicle_id,vehicle_type,geo FROM public.vehicles ${where} ORDER BY vehicle_id`, params)
    res.json({ ok: true, data: r.rows })
  } catch (err) { handleDbError(err, res) }
})

app.post('/api/admin/vehicles', async (req, res) => {
  try {
    const { vehicle_id, vehicle_type, geo } = req.body as Record<string, string>
    if (!vehicle_id?.trim() || !geo?.trim()) {
      res.status(400).json({ ok: false, error: 'vehicle_id and geo are required' }); return
    }
    const r = await pool.query<{ id: string }>(
      `INSERT INTO public.vehicles (vehicle_id,vehicle_type,geo) VALUES ($1,$2,$3) RETURNING id`,
      [vehicle_id.trim().toUpperCase(), vehicle_type || 'Nvidia', geo.toUpperCase()],
    )
    res.status(201).json({ ok: true, id: Number(r.rows[0]!.id) })
  } catch (err) {
    if ((err as { code?: string }).code === '23505') { res.status(409).json({ ok: false, error: 'Vehicle ID already exists' }); return }
    handleDbError(err, res)
  }
})

app.put('/api/admin/vehicles/:id', async (req, res) => {
  try {
    const id = Number(req.params.id); if (!id) { res.status(400).json({ ok: false, error: 'Invalid id' }); return }
    const { vehicle_id, vehicle_type, geo } = req.body as Record<string, string>
    const sets: string[] = []; const params: unknown[] = []
    if (vehicle_id   !== undefined) { params.push(vehicle_id.trim().toUpperCase()); sets.push(`vehicle_id=$${params.length}`) }
    if (vehicle_type !== undefined) { params.push(vehicle_type); sets.push(`vehicle_type=$${params.length}`) }
    if (geo          !== undefined) { params.push(geo.toUpperCase()); sets.push(`geo=$${params.length}`) }
    if (!sets.length) { res.status(400).json({ ok: false, error: 'Nothing to update' }); return }
    params.push(id)
    await pool.query(`UPDATE public.vehicles SET ${sets.join(',')},updated_at=NOW() WHERE id=$${params.length}`, params)
    res.json({ ok: true })
  } catch (err) { handleDbError(err, res) }
})

app.delete('/api/admin/vehicles/:id', async (req, res) => {
  try {
    const id = Number(req.params.id); if (!id) { res.status(400).json({ ok: false, error: 'Invalid id' }); return }
    await pool.query('DELETE FROM public.vehicles WHERE id=$1', [id])
    res.json({ ok: true })
  } catch (err) { handleDbError(err, res) }
})

// ─── Admin — Users CRUD /api/admin/users (Assistant + Admin + Super Admin) ────

const ADMIN_USER_ROLES = new Set(['Assistant', 'Admin', 'Super Admin'])

app.get('/api/admin/users', async (req, res) => {
  try {
    const { geo } = req.query as { geo?: string }
    const params: unknown[] = []; const conditions: string[] = [`role IN ('Assistant','Admin','Super Admin')`]
    if (geo) { params.push(geo.toUpperCase()); conditions.push(`UPPER(TRIM(geo))=$${params.length}`) }
    const where = `WHERE ${conditions.join(' AND ')}`
    const r = await pool.query(`SELECT id,full_name,email,password,geo,role FROM public.admin_users ${where} ORDER BY full_name`, params)
    res.json({ ok: true, data: r.rows })
  } catch (err) { handleDbError(err, res) }
})

app.post('/api/admin/users', async (req, res) => {
  try {
    const { full_name, email, password, geo, role } = req.body as Record<string, string>
    if (!full_name?.trim() || !email?.trim() || !geo?.trim()) {
      res.status(400).json({ ok: false, error: 'full_name, email and geo are required' }); return
    }
    const resolvedRole = role && ADMIN_USER_ROLES.has(role) ? role : 'Admin'
    const r = await pool.query<{ id: string }>(
      `INSERT INTO public.admin_users (full_name,email,password,geo,role) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [full_name.trim(), email.trim().toLowerCase(), password?.trim() || null, geo.toUpperCase(), resolvedRole],
    )
    res.status(201).json({ ok: true, id: Number(r.rows[0]!.id) })
  } catch (err) {
    if ((err as { code?: string }).code === '23505') { res.status(409).json({ ok: false, error: 'Email already exists' }); return }
    handleDbError(err, res)
  }
})

app.put('/api/admin/users/:id', async (req, res) => {
  try {
    const id = Number(req.params.id); if (!id) { res.status(400).json({ ok: false, error: 'Invalid id' }); return }
    const { full_name, email, password, geo, role } = req.body as Record<string, string>
    const sets: string[] = []; const params: unknown[] = []
    if (full_name !== undefined) { params.push(full_name.trim()); sets.push(`full_name=$${params.length}`) }
    if (email     !== undefined) { params.push(email.trim().toLowerCase()); sets.push(`email=$${params.length}`) }
    if (password  !== undefined) { params.push(password?.trim() || null); sets.push(`password=$${params.length}`) }
    if (geo       !== undefined) { params.push(geo.toUpperCase()); sets.push(`geo=$${params.length}`) }
    if (role !== undefined) {
      if (!ADMIN_USER_ROLES.has(role)) {
        res.status(400).json({ ok: false, error: `Invalid role. Allowed: Assistant, Admin, Super Admin` }); return
      }
      params.push(role); sets.push(`role=$${params.length}`)
    }
    if (!sets.length) { res.status(400).json({ ok: false, error: 'Nothing to update' }); return }
    params.push(id)
    await pool.query(`UPDATE public.admin_users SET ${sets.join(',')},updated_at=NOW() WHERE id=$${params.length}`, params)
    res.json({ ok: true })
  } catch (err) { handleDbError(err, res) }
})

app.delete('/api/admin/users/:id', async (req, res) => {
  try {
    const id = Number(req.params.id); if (!id) { res.status(400).json({ ok: false, error: 'Invalid id' }); return }
    await pool.query('DELETE FROM public.admin_users WHERE id=$1', [id])
    res.json({ ok: true })
  } catch (err) { handleDbError(err, res) }
})

// ─── Demos — GET /api/demos/lookup-ref/:ref ───────────────────────────────────
// Full demo_master row for wizard auto-population

app.get('/api/demos/lookup-ref/:ref', async (req, res) => {
  const ref = String(req.params.ref ?? '').trim().toUpperCase()
  if (!/^(JP|UK|US|DE)-[0-9]{6}-[0-9]{2}$/.test(ref)) {
    res.status(400).json({ ok: false, error: 'Invalid demo reference format. Expected: GEO-YYMMDD-SEQ (e.g. JP-260704-01)' })
    return
  }
  try {
    const result = await pool.query<{
      id: string; demo_ref: string; geo: string | null; date_of_demo: string | null
      demo_start_time: string | null; type: string | null; guests_organization: string | null
      start_location: string | null; vehicle_type: string | null; host: string | null
    }>(
      `SELECT id, demo_ref, geo,
              TO_CHAR(date_of_demo, 'YYYY-MM-DD') AS date_of_demo,
              TO_CHAR(demo_start_time, 'HH24:MI')  AS demo_start_time,
              type, guests_organization, start_location, vehicle_type, host
       FROM public.demo_master WHERE demo_ref = $1`,
      [ref],
    )
    if (!result.rowCount || result.rowCount === 0) {
      res.status(404).json({ ok: false, error: `No demo found with reference ${ref}` })
      return
    }
    const row = result.rows[0]!
    res.json({
      ok: true,
      demo: {
        id:                 Number(row.id),
        demo_ref:           row.demo_ref,
        geo:                row.geo,
        date_of_demo:       row.date_of_demo,
        demo_start_time:    row.demo_start_time,
        type:               row.type,
        guests_organization: row.guests_organization,
        start_location:     row.start_location,
        vehicle_type:       row.vehicle_type,
        host:               row.host,
      },
    })
  } catch (err) {
    handleDbError(err, res)
  }
})

// ─── Demos — PUT /api/demos ───────────────────────────────────────────────────
// Body: { id: number, data: { ...fields } }   ← preferred (uses PK)
// Body: { where: { requester, date_request_received }, data: { ...fields } }  ← legacy

app.put('/api/demos', async (req, res) => {
  try {
    const body = req.body as {
      id?:    number | string
      where?: { requester?: string; date_request_received?: string }
      data?:  Partial<CreateDemoInput>
    }

    if (body.id !== undefined && body.id !== null) {
      const rid          = Number(body.id)
      const isReschedule = Boolean(body.data?.date_of_demo)

      // Capture old schedule before overwriting so the email can show what changed
      let rowBefore: DemoNotificationData | null = null
      if (isReschedule) {
        rowBefore = await NotificationService.fetchDemoRow(rid).catch(() => null)
      }

      const affected = await DemoService.updateDemoById(body.id, body.data ?? {})
      res.json({ ok: true, affected })

      // demo_mark_ready — fires when readiness date is first set
      if (body.data?.date_of_readiness) {
        NotificationService.fetchDemoRow(rid)
          .then(demo => demo ? NotificationService.notifyDemoMarkReady(demo) : undefined)
          .catch(err => console.error('[notifications] demo_mark_ready non-fatal:', String(err)))
      }

      // demo_rescheduled — fires whenever date_of_demo is updated
      if (isReschedule) {
        const oldDate      = rowBefore ? String(rowBefore.date_of_demo    ?? '').substring(0, 10) : undefined
        const oldStartTime = rowBefore ? String(rowBefore.demo_start_time ?? '').substring(0, 5)  : undefined
        const oldEndTime   = rowBefore ? String(rowBefore.demo_end_time   ?? '').substring(0, 5)  : undefined
        NotificationService.fetchDemoRow(rid)
          .then(demo => demo
            ? NotificationService.notifyDemoRescheduled(demo, oldDate, oldStartTime, oldEndTime)
            : undefined)
          .catch(err => console.error('[notifications] demo_rescheduled non-fatal:', String(err)))
      }

      // Update Google Calendar event to reflect the latest demo details
      ;(async () => {
        try {
          const eventId = await GoogleCalendarService.getEventId(rid)
          if (!eventId) return
          const demo = await NotificationService.fetchDemoRow(rid)
          if (demo) await GoogleCalendarService.updateEvent(eventId, demo)
        } catch (err) {
          console.error('[calendar] demo_update non-fatal:', String(err))
        }
      })()

      return
    }

    if (!body.where?.requester || !body.where?.date_request_received) {
      res.status(400).json({
        ok:    false,
        error: 'body must contain id (preferred) or body.where with requester + date_request_received',
      })
      return
    }
    const affected = await DemoService.updateDemo(
      { requester: body.where.requester, date_request_received: body.where.date_request_received },
      body.data ?? {},
    )
    res.json({ ok: true, affected })
  } catch (err) {
    handleDbError(err, res)
  }
})

// ─── Auto-completion background job ──────────────────────────────────────────
// Marks APPROVED demos as COMPLETED once their end time + 3 h has elapsed.

async function runAutoCompletion(): Promise<void> {
  try {
    const result = await pool.query(
      `UPDATE public.demo_master
       SET status = $1
       WHERE status = $2
         AND date_of_demo IS NOT NULL
         AND demo_end_time IS NOT NULL
         AND (date_of_demo::date + demo_end_time::time + INTERVAL '3 hours') < NOW()`,
      [DEMO_STATUS.COMPLETED, DEMO_STATUS.APPROVED],
    )
    if ((result.rowCount ?? 0) > 0) {
      console.log(`[auto-complete] Marked ${result.rowCount} demo(s) as COMPLETED`)
    }
  } catch (err) {
    console.error('[auto-complete] Error:', String(err))
  }
}

// Run once at startup, then every 5 minutes
void runAutoCompletion()
setInterval(() => { void runAutoCompletion() }, 5 * 60 * 1_000)

// ─── Demos — PATCH /api/demos/:id/status ─────────────────────────────────────
// Body: { "status": "NEED REVIEW" | "APPROVED" | "CANCELED" | "COMPLETED" }

const ALLOWED_STATUSES: Set<string> = new Set([
  DEMO_STATUS.NEED_REVIEW,
  DEMO_STATUS.APPROVED,
  DEMO_STATUS.CANCELED,
  DEMO_STATUS.COMPLETED,
])

app.patch('/api/demos/:id/status', async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (isNaN(id) || id <= 0) {
      res.status(400).json({ ok: false, error: 'id must be a positive number' })
      return
    }
    const { status } = req.body as { status?: string }
    if (!status || !ALLOWED_STATUSES.has(status)) {
      res.status(400).json({
        ok:    false,
        error: `status must be one of: ${[...ALLOWED_STATUSES].join(', ')}`,
      })
      return
    }

    // Fetch full row before update so we have old status + all context for the email
    const beforeResult = await pool.query<DemoNotificationData>(
      `SELECT id, demo_ref, status, geo, type, guests_organization, host, requester, approver,
              date_of_demo, demo_start_time, demo_end_time, length,
              vehicle_type, route_type, feature_type, start_location, recce_required,
              total_guests, total_vehicles, cancelation_reason, calendar_event_link,
              slack_link, date_of_readiness, description, lead_time_days
       FROM public.demo_master WHERE id = $1`,
      [id],
    )
    const before    = beforeResult.rows[0]
    const oldStatus = before ? DemoService.normaliseStatus(before.status) : undefined

    const affected = await DemoService.updateDemoById(id, { status })

    // Generate demo_ref on first approval — synchronous so response + notifications both carry it
    let approvedRef: string | null = before?.demo_ref ?? null
    if (status === DEMO_STATUS.APPROVED && before && !before.demo_ref) {
      try {
        approvedRef = await DemoReferenceService.generate(id, before.geo, before.date_of_demo)
        console.log('[demos] APPROVED id=%d → demo_ref=%s', id, approvedRef ?? 'null')
      } catch (err) {
        console.error('[demo_ref] generate on approval error:', String(err))
      }
    }

    res.json({ ok: true, affected, demo_ref: approvedRef })

    // Route to the correct event notification and calendar update — never blocks the request
    if (before) {
      const demoAfter: DemoNotificationData = { ...before, id, status, demo_ref: approvedRef }

      if (status === DEMO_STATUS.APPROVED) {
        NotificationService.notifyDemoApproved(demoAfter, oldStatus)
          .catch(err => console.error('[notifications] demo_approved non-fatal:', String(err)))
        // Create the Google Calendar invite on first approval (covers both the New Demo
        // Request flow and the Backlog→Demo conversion flow, since both reach "Reviewed"
        // via this endpoint). The invite goes to the Host Email (demo.requester). If an
        // event already exists, just refresh it instead of creating a duplicate.
        ;(async () => {
          try {
            const existingEventId = await GoogleCalendarService.getEventId(id)
            if (existingEventId) {
              await GoogleCalendarService.updateEvent(existingEventId, demoAfter)
            } else {
              const event = await GoogleCalendarService.createEvent(demoAfter)
              if (event) await GoogleCalendarService.saveEventId(id, event.eventId, event.htmlLink)
            }
          } catch (err) {
            console.error('[calendar] demo_approved non-fatal:', String(err))
          }
        })()
      } else if (status === DEMO_STATUS.CANCELED) {
        NotificationService.notifyDemoCancelled(demoAfter, oldStatus)
          .catch(err => console.error('[notifications] demo_cancelled non-fatal:', String(err)))
        // Delete the Google Calendar event outright (not just mark it cancelled)
        ;(async () => {
          try {
            const eventId = await GoogleCalendarService.getEventId(id)
            if (eventId) {
              await GoogleCalendarService.deleteEvent(eventId)
              await GoogleCalendarService.clearEventId(id)
            }
          } catch (err) {
            console.error('[calendar] demo_cancelled non-fatal:', String(err))
          }
        })()
      }
    }
  } catch (err) {
    handleDbError(err, res)
  }
})

// ─── Demos — DELETE /api/demos ────────────────────────────────────────────────
// Query params: requester, date_request_received

app.delete('/api/demos', async (req, res) => {
  try {
    const { requester, date_request_received } = req.query as Record<string, string>
    if (!requester || !date_request_received) {
      res.status(400).json({
        ok:    false,
        error: 'requester and date_request_received query params are required',
      })
      return
    }
    const affected = await DemoService.deleteDemo({ requester, date_request_received })
    res.json({ ok: true, affected })
  } catch (err) {
    handleDbError(err, res)
  }
})

// ─── Satisfaction — GET /api/satisfaction ─────────────────────────────────────
// Query params: limit, offset, geo, type, startDate, endDate

app.get('/api/satisfaction', async (req, res) => {
  try {
    const raw = req.query as Record<string, string | undefined>
    const result = await SatisfactionService.getSatisfactionData({
      limit:     raw.limit     ? Number(raw.limit)  : undefined,
      offset:    raw.offset    ? Number(raw.offset) : undefined,
      geo:       raw.geo,
      type:      raw.type,
      startDate: raw.startDate,
      endDate:   raw.endDate,
    })
    res.json({ ok: true, ...result })
  } catch (err) {
    handleDbError(err, res)
  }
})

// ─── Satisfaction — POST /api/satisfaction ────────────────────────────────────

app.post('/api/satisfaction', async (req, res) => {
  try {
    await SatisfactionService.createEntry(req.body as Record<string, unknown>)
    res.status(201).json({ ok: true })
  } catch (err) {
    handleDbError(err, res)
  }
})

// ─── Satisfaction — PUT /api/satisfaction/:id ─────────────────────────────────

app.put('/api/satisfaction/:id', async (req, res) => {
  try {
    const affected = await SatisfactionService.updateEntry(
      req.params.id,
      req.body as Record<string, unknown>,
    )
    res.json({ ok: true, affected })
  } catch (err) {
    handleDbError(err, res)
  }
})

// ─── Satisfaction — DELETE /api/satisfaction/:id ──────────────────────────────

app.delete('/api/satisfaction/:id', async (req, res) => {
  try {
    const affected = await SatisfactionService.deleteEntry(req.params.id)
    res.json({ ok: true, affected })
  } catch (err) {
    handleDbError(err, res)
  }
})

// ─── Backlog — GET /api/backlog ───────────────────────────────────────────────

app.get('/api/backlog', async (req, res) => {
  try {
    const raw = req.query as Record<string, string | undefined>
    const data = await BacklogService.getAll({
      search:   raw.search,
      status:   raw.status,
      priority: raw.priority,
      host:     raw.host,
      geo:      raw.geo,
    })
    res.json({ ok: true, total: data.length, data })
  } catch (err) {
    handleDbError(err, res)
  }
})

// ─── Backlog — POST /api/backlog ──────────────────────────────────────────────

app.post('/api/backlog', async (req, res) => {
  try {
    const row = await BacklogService.create(req.body as Partial<BacklogInput>)
    res.status(201).json({ ok: true, data: row })
  } catch (err) {
    handleDbError(err, res)
  }
})

// ─── Backlog — PUT /api/backlog/:id ───────────────────────────────────────────

app.put('/api/backlog/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (isNaN(id) || id <= 0) { res.status(400).json({ ok: false, error: 'id must be a positive number' }); return }
    const row = await BacklogService.update(id, req.body as Partial<BacklogInput>)
    if (!row) { res.status(404).json({ ok: false, error: 'Not found' }); return }
    res.json({ ok: true, data: row })
  } catch (err) {
    handleDbError(err, res)
  }
})

// ─── Backlog — PATCH /api/backlog/:id/status ──────────────────────────────────

app.patch('/api/backlog/:id/status', async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (isNaN(id) || id <= 0) { res.status(400).json({ ok: false, error: 'id must be a positive number' }); return }
    const { status } = req.body as { status?: string }
    if (!status) { res.status(400).json({ ok: false, error: 'status is required' }); return }
    const result = await BacklogService.patchStatus(id, status)
    if (!result.ok) { res.status(400).json({ ok: false, error: result.error }); return }
    res.json({ ok: true, data: result.row })
  } catch (err) {
    handleDbError(err, res)
  }
})

// ─── Backlog — POST /api/backlog/:id/convert ──────────────────────────────────

app.post('/api/backlog/:id/convert', async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (isNaN(id) || id <= 0) { res.status(400).json({ ok: false, error: 'id must be a positive number' }); return }

    // Pre-validate: GEO and demo date must be present and valid before conversion
    const preview = await pool.query<{ geo: string | null; preferred_demo_date: string | null }>(
      `SELECT geo, preferred_demo_date FROM public.demo_backlog WHERE id = $1`, [id],
    )
    if (!preview.rowCount || preview.rowCount === 0) {
      res.status(404).json({ ok: false, error: 'Backlog item not found' }); return
    }
    const previewRow = preview.rows[0]!
    if (!DemoReferenceService.isValidGeo(previewRow.geo)) {
      res.status(400).json({
        ok:    false,
        error: `Cannot convert: GEO "${previewRow.geo ?? ''}" is missing or invalid. Please set GEO to one of: JP, UK, US, DE before converting.`,
        code:  'INVALID_GEO',
      }); return
    }
    const result = await BacklogService.convertToDemoRequest(id)
    if (!result) { res.status(404).json({ ok: false, error: 'Backlog item not found' }); return }
    res.json({ ok: true, demoId: result.demoId, demo_ref: null, data: result.backlog })

    // Fire backlog_converted_to_demo notification — never blocks the request
    const { demoId, backlog } = result
    const backlogData = {
      id:           backlog.id,
      company:      backlog.company,
      customer:     backlog.customer,
      demo_purpose: backlog.demo_purpose,
      notes:        backlog.notes,
      host:         backlog.host,
      requestor:    backlog.requestor,
      geo:          backlog.geo,
      demo_type:    backlog.demo_type,
      priority:     backlog.priority,
    }
    NotificationService.fetchDemoRow(demoId)
      .then(demo => NotificationService.notifyBacklogConverted(backlogData, demoId, demo))
      .catch(err  => console.error('[notifications] backlog_converted non-fatal:', String(err)))
  } catch (err) {
    handleDbError(err, res)
  }
})

// ─── Backlog — DELETE /api/backlog/:id ────────────────────────────────────────

app.delete('/api/backlog/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (isNaN(id) || id <= 0) { res.status(400).json({ ok: false, error: 'id must be a positive number' }); return }
    const affected = await BacklogService.delete(id)
    res.json({ ok: true, affected })
  } catch (err) {
    handleDbError(err, res)
  }
})

// ─── Admin Users — CRUD /api/admin-users ─────────────────────────────────────

app.get('/api/admin-users', async (req, res) => {
  try {
    const { geo } = req.query as { geo?: string }
    const where  = geo ? `WHERE UPPER(TRIM(geo)) = $1` : ''
    const params = geo ? [geo.toUpperCase()] : []
    const result = await pool.query<{
      id: string; full_name: string; email: string
      password: string | null; geo: string; role: string
    }>(
      `SELECT id, full_name, email, password, geo, role
       FROM public.admin_users ${where}
       ORDER BY full_name`,
      params,
    )
    res.json({ ok: true, data: result.rows })
  } catch (err) { handleDbError(err, res) }
})

app.post('/api/admin-users', async (req, res) => {
  try {
    const { full_name, email, password, geo, role } = req.body as Record<string, string>
    if (!full_name?.trim() || !email?.trim() || !geo?.trim()) {
      res.status(400).json({ ok: false, error: 'full_name, email and geo are required' })
      return
    }
    const result = await pool.query<{ id: string }>(
      `INSERT INTO public.admin_users (full_name, email, password, geo, role)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [full_name.trim(), email.trim().toLowerCase(), password?.trim() || null,
       geo.toUpperCase(), role || 'Admin'],
    )
    res.status(201).json({ ok: true, id: Number(result.rows[0]!.id) })
  } catch (err) {
    const e = err as { code?: string }
    if (e.code === '23505') {
      res.status(409).json({ ok: false, error: 'Email already registered' })
      return
    }
    handleDbError(err, res)
  }
})

app.put('/api/admin-users/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (isNaN(id) || id <= 0) { res.status(400).json({ ok: false, error: 'Invalid id' }); return }
    const { full_name, email, password, geo, role } = req.body as Record<string, string>
    const sets: string[] = []
    const params: unknown[] = []
    if (full_name !== undefined) { params.push(full_name.trim()); sets.push(`full_name = $${params.length}`) }
    if (email     !== undefined) { params.push(email.trim().toLowerCase()); sets.push(`email = $${params.length}`) }
    if (password  !== undefined) { params.push(password?.trim() || null); sets.push(`password = $${params.length}`) }
    if (geo       !== undefined) { params.push(geo.toUpperCase()); sets.push(`geo = $${params.length}`) }
    if (role      !== undefined) { params.push(role); sets.push(`role = $${params.length}`) }
    if (sets.length === 0) { res.status(400).json({ ok: false, error: 'No fields to update' }); return }
    params.push(id)
    await pool.query(
      `UPDATE public.admin_users SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`,
      params,
    )
    res.json({ ok: true })
  } catch (err) { handleDbError(err, res) }
})

app.delete('/api/admin-users/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (isNaN(id) || id <= 0) { res.status(400).json({ ok: false, error: 'Invalid id' }); return }
    await pool.query('DELETE FROM public.admin_users WHERE id = $1', [id])
    res.json({ ok: true })
  } catch (err) { handleDbError(err, res) }
})

// ─── Notifications — GET /api/notifications/config ───────────────────────────

app.get('/api/notifications/config', (_req, res) => {
  res.json({ ok: true, ...NotificationService.getConfigStatus() })
})

// ─── Notifications — GET /api/notifications/log ───────────────────────────────
// Query params: limit (default 50), offset (default 0)

app.get('/api/notifications/log', async (req, res) => {
  try {
    const limit  = Math.min(Math.max(Number(req.query.limit  ?? 50),  1), 200)
    const offset = Math.max(Number(req.query.offset ?? 0), 0)

    const result = await pool.query<{
      id:            string
      demo_id:       string | null
      event_type:    string | null
      channel:       string | null
      recipient:     string | null
      payload:       unknown
      success:       boolean | null
      error_message: string | null
      created_at:    string | null
    }>(
      `SELECT id, demo_id, event_type, channel, recipient, payload, success, error_message, created_at
       FROM public.notification_log
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    )

    const countResult = await pool.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM public.notification_log`,
    )

    res.json({ ok: true, total: parseInt(countResult.rows[0]?.total ?? '0', 10), data: result.rows })
  } catch (err) {
    // notification_log may not exist yet — return empty gracefully
    const e = err as { code?: string }
    if (e.code === '42P01') {
      res.json({ ok: true, total: 0, data: [] })
      return
    }
    handleDbError(err, res)
  }
})

// ─── Notifications — POST /api/notifications/test ─────────────────────────────
// Body: { channel, recipient, subject, message }

// Accepts two forms:
//   event-style:       { channel, eventType, demoId }
//   connectivity test: { channel, recipient?, subject?, message? }

app.post('/api/notifications/test', async (req, res) => {
  try {
    const body = req.body as {
      channel?:   string
      eventType?: string
      demoId?:    number | string
      recipient?: string
      subject?:   string
      message?:   string
    }

    if (!body.channel) {
      res.status(400).json({ ok: false, error: 'channel is required' })
      return
    }

    // event-style: eventType + demoId must both be present
    if (body.eventType !== undefined && body.demoId === undefined) {
      res.status(400).json({ ok: false, error: 'demoId is required when eventType is provided' })
      return
    }

    const result = await NotificationService.sendTestNotification({
      channel:   body.channel,
      eventType: body.eventType,
      demoId:    body.demoId,
      recipient: body.recipient,
      subject:   body.subject,
      message:   body.message,
    })

    res.json({
      ok:        result.success,
      channel:   body.channel,
      eventType: body.eventType ?? null,
      demoId:    body.demoId   ?? null,
      logged:    result.logged,
      sent:      result.success,
      dryRun:    result.dryRun,
      ...(result.error ? { error: result.error } : {}),
    })
  } catch (err) {
    handleDbError(err, res)
  }
})

// ─── Schema introspection — GET /api/schema ───────────────────────────────────
// Query param: table (default: demo_master_raw)

app.get('/api/schema', async (req, res) => {
  try {
    const table = String(req.query.table ?? 'demo_master_raw')
    const result = await pool.query<{ column_name: string; data_type: string }>(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position`,
      [table],
    )
    res.json({ ok: true, table, columns: result.rows })
  } catch (err) {
    handleDbError(err, res)
  }
})

// ─── Post Demo — analytics (MUST come before /:id to avoid shadowing) ─────────

app.get('/api/post-demo/analytics/summary', async (req, res) => {
  try {
    const raw = req.query as Record<string, string | undefined>
    const opts: PostDemoQueryOptions = {}
    if (raw.category)       opts.category       = raw.category
    if (raw.geo)            opts.geo            = raw.geo
    if (raw.demoType)       opts.demoType       = raw.demoType
    if (raw.modelName)      opts.modelName      = raw.modelName
    if (raw.operatorName)   opts.operatorName   = raw.operatorName
    if (raw.route)          opts.route          = raw.route
    if (raw.startDate)      opts.startDate      = raw.startDate
    if (raw.endDate)        opts.endDate        = raw.endDate
    if (raw.month)          opts.month          = raw.month
    if (raw.safetyCritical === 'true')  opts.safetyCritical = true
    if (raw.safetyCritical === 'false') opts.safetyCritical = false
    if (raw.maxUds)         opts.maxUds         = Number(raw.maxUds)
    const data = await PostDemoService.getAnalyticsSummary(opts)
    res.json({ ok: true, data })
  } catch (err) {
    handleDbError(err, res)
  }
})

app.get('/api/post-demo/analytics/models', async (req, res) => {
  try {
    const raw = req.query as Record<string, string | undefined>
    const opts: PostDemoQueryOptions = {}
    if (raw.category)       opts.category       = raw.category
    if (raw.geo)            opts.geo            = raw.geo
    if (raw.demoType)       opts.demoType       = raw.demoType
    if (raw.modelName)      opts.modelName      = raw.modelName
    if (raw.operatorName)   opts.operatorName   = raw.operatorName
    if (raw.route)          opts.route          = raw.route
    if (raw.startDate)      opts.startDate      = raw.startDate
    if (raw.endDate)        opts.endDate        = raw.endDate
    if (raw.month)          opts.month          = raw.month
    if (raw.safetyCritical === 'true')  opts.safetyCritical = true
    if (raw.safetyCritical === 'false') opts.safetyCritical = false
    const data = await PostDemoService.getModelAnalytics(opts)
    res.json({ ok: true, data })
  } catch (err) {
    handleDbError(err, res)
  }
})

app.get('/api/post-demo/analytics/interventions', async (req, res) => {
  try {
    const raw = req.query as Record<string, string | undefined>
    const opts: PostDemoQueryOptions = {}
    if (raw.category)       opts.category       = raw.category
    if (raw.geo)            opts.geo            = raw.geo
    if (raw.startDate)      opts.startDate      = raw.startDate
    if (raw.endDate)        opts.endDate        = raw.endDate
    if (raw.month)          opts.month          = raw.month
    const data = await PostDemoService.getInterventionAnalytics(opts)
    res.json({ ok: true, data })
  } catch (err) {
    handleDbError(err, res)
  }
})

// ─── Post Demo — CRUD ──────────────────────────────────────────────────────────

app.get('/api/post-demo', async (req, res) => {
  try {
    const raw = req.query as Record<string, string | undefined>
    const opts: PostDemoQueryOptions = {}
    if (raw.category)       opts.category       = raw.category
    if (raw.geo)            opts.geo            = raw.geo
    if (raw.demoType)       opts.demoType       = raw.demoType
    if (raw.modelName)      opts.modelName      = raw.modelName
    if (raw.operatorName)   opts.operatorName   = raw.operatorName
    if (raw.route)          opts.route          = raw.route
    if (raw.startDate)      opts.startDate      = raw.startDate
    if (raw.endDate)        opts.endDate        = raw.endDate
    if (raw.month)          opts.month          = raw.month
    if (raw.safetyCritical === 'true')  opts.safetyCritical = true
    if (raw.safetyCritical === 'false') opts.safetyCritical = false
    if (raw.maxUds)         opts.maxUds         = Number(raw.maxUds)
    if (raw.limit)          opts.limit          = Number(raw.limit)
    if (raw.offset)         opts.offset         = Number(raw.offset)
    const { data, total } = await PostDemoService.getAll(opts)
    res.json({ ok: true, total, data })
  } catch (err) {
    handleDbError(err, res)
  }
})

app.get('/api/post-demo/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (isNaN(id) || id <= 0) { res.status(400).json({ ok: false, error: 'id must be a positive number' }); return }
    const row = await PostDemoService.getById(id)
    if (!row) { res.status(404).json({ ok: false, error: 'Not found' }); return }
    res.json({ ok: true, data: row })
  } catch (err) {
    handleDbError(err, res)
  }
})

app.post('/api/post-demo', async (req, res) => {
  try {
    const newId = await PostDemoService.create(req.body as PostDemoInput)
    res.status(201).json({ ok: true, id: newId })
  } catch (err) {
    handleDbError(err, res)
  }
})

app.put('/api/post-demo/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (isNaN(id) || id <= 0) { res.status(400).json({ ok: false, error: 'id must be a positive number' }); return }
    const affected = await PostDemoService.update(id, req.body as Partial<PostDemoInput>)
    res.json({ ok: true, affected })
  } catch (err) {
    handleDbError(err, res)
  }
})

app.delete('/api/post-demo/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (isNaN(id) || id <= 0) { res.status(400).json({ ok: false, error: 'id must be a positive number' }); return }
    const affected = await PostDemoService.delete(id)
    res.json({ ok: true, affected })
  } catch (err) {
    handleDbError(err, res)
  }
})

// ─── Home — GET /api/home?geo=&timeframe= ────────────────────────────────────
// Aggregate data for the Home page dashboard.
// ?geo=JP|UK|US|DE (omit / 'ALL' = all geos)
// ?timeframe=this_week|next_week|this_month (default: this_week)

function getTimeframeBounds(timeframe: string): { dateFrom: string; dateTo: string } {
  const now   = new Date()
  const dow   = now.getDay()                               // 0=Sun…6=Sat
  const mon   = new Date(now)
  mon.setDate(now.getDate() - ((dow + 6) % 7))            // Monday of current week
  const toISO = (d: Date) => d.toISOString().slice(0, 10)

  if (timeframe === 'next_week') {
    const nextMon = new Date(mon); nextMon.setDate(mon.getDate() + 7)
    const nextSun = new Date(nextMon); nextSun.setDate(nextMon.getDate() + 6)
    return { dateFrom: toISO(nextMon), dateTo: toISO(nextSun) }
  }
  if (timeframe === 'this_month') {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDay  = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return { dateFrom: toISO(firstDay), dateTo: toISO(lastDay) }
  }
  // Default: this_week (Mon–Sun)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  return { dateFrom: toISO(mon), dateTo: toISO(sun) }
}

app.get('/api/home', async (req, res) => {
  const rawGeo      = req.query.geo as string | undefined
  const rawTimeframe = req.query.timeframe as string | undefined
  const geo         = rawGeo && rawGeo.toUpperCase() !== 'ALL' ? rawGeo.toUpperCase() : null
  const timeframe   = rawTimeframe ?? 'this_week'
  const { dateFrom, dateTo } = getTimeframeBounds(timeframe)

  try {
    // Build param lists for queries that use different placeholders
    // geo-only queries:  gP = [] | [geo]
    // date-range queries with geo:  dRP = [dateFrom, dateTo] | [dateFrom, dateTo, geo]
    const gP   = geo ? [geo] : []
    const dGeo = geo ? `AND UPPER(TRIM(COALESCE(geo,''))) = $1` : ''

    // For KPI + date-range queries the placeholders shift when geo is present
    const drP     = geo ? [dateFrom, dateTo, geo] : [dateFrom, dateTo]
    const drGeo   = geo ? `AND UPPER(TRIM(COALESCE(geo,''))) = $3` : ''
    const drBGeo  = geo ? `AND UPPER(TRIM(COALESCE(geo,''))) = $3` : ''

    const TODAY = new Date().toISOString().slice(0, 10)

    const [
      proposedRes, pendingRes, approvedRes, cancelledRes,
      guestsRes, geoBreakRes, upcomingRes, recentRes,
    ] = await Promise.all([
      // KPI: Proposed — backlog items within timeframe
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM public.demo_backlog
         WHERE LOWER(status) NOT IN ('completed','cancelled','converted')
           AND preferred_demo_date BETWEEN $1 AND $2
           ${drBGeo}`,
        drP,
      ),
      // KPI: Pending Approval — NEED REVIEW demos within timeframe
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM public.demo_master
         WHERE status = '${DEMO_STATUS.NEED_REVIEW}'
           AND date_of_demo BETWEEN $1 AND $2
           ${drGeo}`,
        drP,
      ),
      // KPI: Approved — APPROVED demos within timeframe
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM public.demo_master
         WHERE status = '${DEMO_STATUS.APPROVED}'
           AND date_of_demo BETWEEN $1 AND $2
           ${drGeo}`,
        drP,
      ),
      // KPI: Cancelled — CANCELED demos within timeframe
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM public.demo_master
         WHERE status = '${DEMO_STATUS.CANCELED}'
           AND date_of_demo BETWEEN $1 AND $2
           ${drGeo}`,
        drP,
      ),
      // KPI: Total Guests — active (NEED REVIEW + APPROVED) within timeframe
      pool.query<{ total: string }>(
        `SELECT COALESCE(SUM(COALESCE(total_guests, 0)), 0)::text AS total
         FROM public.demo_master
         WHERE status IN ('${DEMO_STATUS.NEED_REVIEW}','${DEMO_STATUS.APPROVED}')
           AND date_of_demo BETWEEN $1 AND $2
           ${drGeo}`,
        drP,
      ),
      // GEO breakdown — all non-deleted demos (not timeframe-filtered)
      pool.query<{ geo: string; count: string }>(
        `SELECT UPPER(TRIM(COALESCE(geo,''))) AS geo, COUNT(*)::text AS count
         FROM public.demo_master
         WHERE status != '${DEMO_STATUS.DELETED}'
           ${dGeo}
         GROUP BY UPPER(TRIM(COALESCE(geo,'')))`,
        gP,
      ),
      // Upcoming — next 5 APPROVED demos on or after today
      pool.query<{
        demo_ref:     string | null
        type:         string | null
        geo:          string | null
        demo_date:    string | null
        start_time:   string | null
        host:         string | null
        organization: string | null
        status:       string
      }>(
        `SELECT demo_ref, type, geo,
                TO_CHAR(date_of_demo, 'YYYY-MM-DD') AS demo_date,
                TO_CHAR(demo_start_time, 'HH24:MI') AS start_time,
                host, guests_organization AS organization, status
         FROM public.demo_master
         WHERE status = '${DEMO_STATUS.APPROVED}'
           AND date_of_demo >= $1
           ${geo ? 'AND UPPER(TRIM(COALESCE(geo,\'\'))) = $2' : ''}
         ORDER BY date_of_demo ASC, demo_start_time ASC NULLS LAST
         LIMIT 5`,
        geo ? [TODAY, geo] : [TODAY],
      ),
      // Recent Activity — last 10 non-deleted demos (not timeframe-filtered)
      pool.query<{
        demo_ref:  string | null
        host:      string | null
        type:      string | null
        geo:       string | null
        demo_date: string | null
        status:    string | null
      }>(
        `SELECT demo_ref, host, type, geo,
                TO_CHAR(date_of_demo, 'YYYY-MM-DD') AS demo_date,
                status
         FROM public.demo_master
         WHERE status != '${DEMO_STATUS.DELETED}'
           ${dGeo}
         ORDER BY date_request_received DESC NULLS LAST, id DESC
         LIMIT 10`,
        gP,
      ),
    ])

    const geoCounts: Record<string, number> = { UK: 0, US: 0, JP: 0, DE: 0 }
    for (const row of geoBreakRes.rows) {
      if (row.geo in geoCounts) geoCounts[row.geo] = parseInt(row.count, 10)
    }

    res.json({
      ok: true,
      kpis: {
        proposed:        parseInt(proposedRes.rows[0]?.count ?? '0', 10),
        pendingApproval: parseInt(pendingRes.rows[0]?.count  ?? '0', 10),
        approved:        parseInt(approvedRes.rows[0]?.count ?? '0', 10),
        cancelled:       parseInt(cancelledRes.rows[0]?.count ?? '0', 10),
        totalGuests:     parseInt(guestsRes.rows[0]?.total   ?? '0', 10),
      },
      geoCounts,
      upcoming:       upcomingRes.rows,
      recentActivity: recentRes.rows,
    })
  } catch (err) {
    handleDbError(err, res)
  }
})

// ─── Page-specific demo endpoints ────────────────────────────────────────────
// Each endpoint applies a server-side status filter so each page only fetches
// the rows it can actually display, reducing payload and query cost on Lakebase.
//
// All share the same DemoService/DemoRepository pipeline (same normalisation,
// same LEFT JOIN with post_demo for ops_feedback_count).

// GET /api/demos/cockpit
// Kanban board: NEED REVIEW + APPROVED + CANCELED only.
// Excludes COMPLETED and DELETED — the Kanban never renders those.
app.get('/api/demos/cockpit', async (req, res) => {
  try {
    const raw = req.query as Record<string, string | undefined>
    const opts: QueryOptions = {
      statusIn: `${DEMO_STATUS.NEED_REVIEW},${DEMO_STATUS.APPROVED},${DEMO_STATUS.CANCELED}`,
      limit:    Number(raw.limit ?? 500),
    }
    if (raw.geo)       opts.geo       = raw.geo
    if (raw.startDate) opts.startDate = raw.startDate
    if (raw.endDate)   opts.endDate   = raw.endDate
    const { data, total } = await DemoService.getDemos(opts)
    res.json({ ok: true, total, data })
  } catch (err) { handleDbError(err, res) }
})

// GET /api/demos/calendar
// Calendar view: all non-deleted statuses, sorted by date.
// Supports geo and optional month filter.
app.get('/api/demos/calendar', async (req, res) => {
  try {
    const raw = req.query as Record<string, string | undefined>
    const opts: QueryOptions = {
      limit: Number(raw.limit ?? 500),
      sortBy: 'demo_date',
      sortDir: 'ASC',
    }
    if (raw.geo)       opts.geo       = raw.geo
    if (raw.month)     opts.month     = raw.month
    if (raw.startDate) opts.startDate = raw.startDate
    if (raw.endDate)   opts.endDate   = raw.endDate
    // Exclude deleted only — calendar shows all other statuses
    // (NEED REVIEW shows as pending, APPROVED as confirmed events)
    // We exclude via a status NOT LIKE filter by using the existing search path,
    // or simply leave it to client filtering since DELETED rows are rare.
    const { data, total } = await DemoService.getDemos(opts)
    const visible = data.filter(d => d.status !== 'DELETED')
    res.json({ ok: true, total: visible.length, data: visible })
  } catch (err) { handleDbError(err, res) }
})

// GET /api/demos/tracker
// Tracker page: APPROVED + COMPLETED + CANCELED.
// Includes ops_feedback LEFT JOIN (already in DemoRepository.findAll).
// Supports geo, month, type, startDate, endDate filters.
app.get('/api/demos/tracker', async (req, res) => {
  try {
    const raw = req.query as Record<string, string | undefined>
    const opts: QueryOptions = {
      statusIn: `${DEMO_STATUS.APPROVED},${DEMO_STATUS.COMPLETED},${DEMO_STATUS.CANCELED}`,
      limit:    Number(raw.limit ?? 500),
      sortBy:   'demo_date',
      sortDir:  'DESC',
    }
    if (raw.geo)       opts.geo       = raw.geo
    if (raw.type)      opts.type      = raw.type
    if (raw.month)     opts.month     = raw.month
    if (raw.startDate) opts.startDate = raw.startDate
    if (raw.endDate)   opts.endDate   = raw.endDate
    const { data, total } = await DemoService.getDemos(opts)
    res.json({ ok: true, total, data })
  } catch (err) { handleDbError(err, res) }
})

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n  API server           ->  http://localhost:${PORT}`)
  console.log(`  Health               ->  http://localhost:${PORT}/api/health`)
  console.log(`  Demos                ->  http://localhost:${PORT}/api/demos`)
  console.log(`  Satisfaction         ->  http://localhost:${PORT}/api/satisfaction`)
  console.log(`  Notifications config ->  http://localhost:${PORT}/api/notifications/config`)
  console.log(`  Notifications log    ->  http://localhost:${PORT}/api/notifications/log`)
  console.log(`  Schema (demos)       ->  http://localhost:${PORT}/api/schema`)
  console.log(`  Schema (satisf.)     ->  http://localhost:${PORT}/api/schema?table=satisfaction\n`)
})

