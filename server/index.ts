import express, { type Response } from 'express'
import cors from 'cors'
import { pool, isAuthError, isConnError, refreshPool } from './db.js'
import { DemoService } from './services/DemoService.js'
import { SatisfactionService } from './services/SatisfactionService.js'
import { BacklogService } from './services/BacklogService.js'
import type { QueryOptions, CreateDemoInput } from './types.js'
import type { BacklogInput } from './repositories/BacklogRepository.js'

const app = express()
const PORT = Number(process.env.API_PORT ?? 3001)

app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }))
app.use(express.json())

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
    if (raw.requester) opts.requester = raw.requester
    if (raw.approver)  opts.approver  = raw.approver
    if (raw.host)      opts.host      = raw.host
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
    await DemoService.createDemo(req.body as CreateDemoInput)
    res.status(201).json({ ok: true })
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
      const affected = await DemoService.updateDemoById(body.id, body.data ?? {})
      res.json({ ok: true, affected })
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

// ─── Demos — PATCH /api/demos/:id/status ─────────────────────────────────────
// Body: { "status": "Needs Review" | "Reviewed" | "Canceled" }

const ALLOWED_STATUSES = new Set(['Needs Review', 'Reviewed', 'Canceled'])

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
    const affected = await DemoService.updateDemoById(id, { status })
    res.json({ ok: true, affected })
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
    const result = await BacklogService.convertToDemoRequest(id)
    if (!result) { res.status(404).json({ ok: false, error: 'Backlog item not found' }); return }
    res.json({ ok: true, demoId: result.demoId, data: result.backlog })
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

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n  API server       ->  http://localhost:${PORT}`)
  console.log(`  Health           ->  http://localhost:${PORT}/api/health`)
  console.log(`  Demos            ->  http://localhost:${PORT}/api/demos`)
  console.log(`  Satisfaction     ->  http://localhost:${PORT}/api/satisfaction`)
  console.log(`  Schema (demos)   ->  http://localhost:${PORT}/api/schema`)
  console.log(`  Schema (satisf.) ->  http://localhost:${PORT}/api/schema?table=satisfaction\n`)
})
