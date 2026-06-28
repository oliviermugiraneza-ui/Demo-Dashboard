/**
 * One-time import of backlog CSV → public.demo_backlog
 * Run with: npm run import-backlog
 *
 * CSV format (rows 1-2 are title/sub-headers, row 3 is the real header):
 *   No, Status, Company?, Customer?, Requestor?, Host?, Window person?,
 *   Demo ride date, Time(JST), schedule arrangement..., Demo purpose/Reason,
 *   Demo Route?, Car?, Expected Performance?, Priority?, Next Action?,
 *   Ops Impact (hrs), operation ticket link, Demo Plan, Note
 */
import { Pool } from 'pg'
import dotenv from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '../.env') })

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false })

// ─── CSV parser (handles quoted fields with commas) ───────────────────────────

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

function clean(val: string): string | null {
  const v = val.trim()
  return v === '' || v === '-' || v === '?' || v === 'TBD' ? null : v
}

function normaliseStatus(raw: string): string {
  const s = raw.trim().toLowerCase()
  if (s.includes('complet'))  return 'Completed'
  if (s.includes('arrang'))   return 'Arranging'
  if (s.includes('confirm'))  return 'Confirmed'
  if (s.includes('request'))  return 'Requested'
  if (s.includes('propos'))   return 'Proposed'
  if (s.includes('cancel'))   return 'Cancelled'
  return 'Proposed'
}

async function run() {
  // Find the CSV file — look in project root and common locations
  const candidates = [
    resolve(__dirname, '../backlog- potential demos .csv'),
    resolve(__dirname, '../backlog-potential-demos.csv'),
    resolve(__dirname, '../backlog.csv'),
  ]

  let csvPath: string | null = null
  for (const c of candidates) {
    if (fs.existsSync(c)) { csvPath = c; break }
  }

  if (!csvPath) {
    console.error('❌  CSV file not found. Expected: "backlog- potential demos .csv" in project root.')
    console.error('    Searched:', candidates.join('\n             '))
    process.exit(1)
  }

  console.log('📂  Reading CSV:', csvPath)
  const raw = fs.readFileSync(csvPath, 'utf-8')
  const allLines = raw.split('\n').map(l => l.replace(/\r$/, ''))

  // Find the real header row (contains "No" as first non-empty cell and "Status")
  let headerIdx = -1
  for (let i = 0; i < allLines.length; i++) {
    const cols = parseCsvLine(allLines[i]!)
    if ((cols[0] === 'No' || cols[0] === 'no') && cols[1]?.toLowerCase() === 'status') {
      headerIdx = i
      break
    }
  }

  if (headerIdx === -1) {
    console.error('❌  Could not find header row (expected row with "No,Status,...")')
    process.exit(1)
  }

  console.log(`📋  Header found at row ${headerIdx + 1}`)

  // Skip the header and its description row (next row after header is a description)
  const dataLines = allLines.slice(headerIdx + 2)

  let imported = 0
  let skipped  = 0

  for (const line of dataLines) {
    if (!line.trim()) continue
    const cols = parseCsvLine(line)

    // Skip if no row number or no company (empty/placeholder rows)
    const rowNo   = cols[0]?.trim()
    const status  = cols[1]?.trim() ?? ''
    const company = cols[2]?.trim()

    if (!rowNo || !company || company === '') {
      skipped++
      continue
    }

    // Map to DB columns
    const row = {
      status:               normaliseStatus(status),
      company:              clean(company),
      customer:             clean(cols[3]  ?? ''),
      requestor:            clean(cols[4]  ?? ''),
      host:                 clean(cols[5]  ?? ''),
      window_person:        clean(cols[6]  ?? ''),
      preferred_demo_date:  clean(cols[7]  ?? ''),
      preferred_time:       clean(cols[8]  ?? ''),
      schedule_status:      clean(cols[9]  ?? ''),
      demo_purpose:         clean(cols[10] ?? ''),
      demo_route:           clean(cols[11] ?? ''),
      vehicle:              clean(cols[12] ?? ''),
      expected_performance: clean(cols[13] ?? ''),
      priority:             clean(cols[14] ?? ''),
      next_action:          clean(cols[15] ?? ''),
      ops_impact_hrs:       clean(cols[16] ?? ''),
      ticket_link:          clean(cols[17] ?? ''),
      notes:                [clean(cols[18] ?? ''), clean(cols[19] ?? '')].filter(Boolean).join(' | ') || null,
    }

    const colNames = Object.keys(row)
    const vals     = Object.values(row)
    const placeholders = colNames.map((_, i) => `$${i + 1}`)

    await pool.query(
      `INSERT INTO public.demo_backlog (${colNames.join(', ')}) VALUES (${placeholders.join(', ')})`,
      vals,
    )
    imported++
  }

  console.log(`\n✅  Imported ${imported} rows into public.demo_backlog`)
  if (skipped > 0) console.log(`⏭   Skipped ${skipped} empty/placeholder rows`)
  await pool.end()
}

void run().catch(err => {
  console.error('❌  Import failed:', err)
  process.exit(1)
})
