/**
 * Normalise admin_users: move Host rows → hosts table, Operator rows → operators table.
 * Keeps Admin / Super Admin rows in admin_users.
 * Safe to rerun: skips rows whose email already exists in the target table.
 */

import { Pool } from 'pg'
import * as dotenv from 'dotenv'

dotenv.config()

const connectionString =
  process.env.DATABASE_URL ??
  `postgresql://${process.env.DB_USER ?? 'admin'}:${process.env.DB_PASSWORD ?? 'demo123'}@${process.env.DB_HOST ?? 'localhost'}:${process.env.DB_PORT ?? 5432}/${process.env.DB_NAME ?? 'demo_dashboard'}`

const pool = new Pool({ connectionString })

interface AdminRow {
  id:         number
  full_name:  string
  email:      string
  geo:        string
  role:       string
  created_at: Date
  updated_at: Date
}

async function run() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // ── Step 0: purge dummy seeded rows from hosts / operators ──────────────
    // Hosts and operators tables were seeded with placeholder data.
    // Clear them entirely before populating with real admin_users rows so
    // we don't end up with a mix of fake + real records.
    const { rowCount: hostsPurged } = await client.query(
      `DELETE FROM hosts WHERE email NOT IN (
         SELECT email FROM admin_users WHERE role = 'Host'
       )`
    )
    const { rowCount: opsPurged } = await client.query(
      `DELETE FROM operators WHERE email NOT IN (
         SELECT email FROM admin_users WHERE role = 'Operator'
       )`
    )

    // ── Step 1: fetch all admin_users ────────────────────────────────────────
    const { rows: allUsers } = await client.query<AdminRow>(
      `SELECT id, full_name, email, geo, role, created_at, updated_at
       FROM admin_users
       ORDER BY role, full_name`
    )

    let adminsKept      = 0
    let hostsMoved      = 0
    let operatorsMoved  = 0
    let hostsSkipped    = 0
    let opsSkipped      = 0
    const errors: string[] = []

    for (const row of allUsers) {
      const { id, full_name, email, geo, role, created_at, updated_at } = row

      if (role === 'Admin' || role === 'Super Admin') {
        adminsKept++
        continue
      }

      if (role === 'Host') {
        // Check for existing email in hosts
        const { rows: existing } = await client.query(
          `SELECT 1 FROM hosts WHERE email = $1`, [email]
        )
        if (existing.length > 0) {
          hostsSkipped++
          console.log(`  [SKIP]  Host already in hosts table: ${email}`)
          // Still remove from admin_users so it doesn't linger
          await client.query(`DELETE FROM admin_users WHERE id = $1`, [id])
          continue
        }

        try {
          await client.query(
            `INSERT INTO hosts (full_name, email, geo, role, created_at, updated_at)
             VALUES ($1, $2, $3, 'Host', $4, $5)`,
            [full_name, email, geo, created_at, updated_at]
          )
          await client.query(`DELETE FROM admin_users WHERE id = $1`, [id])
          hostsMoved++
          console.log(`  [HOST]  Moved: ${full_name} <${email}> (${geo})`)
        } catch (err) {
          errors.push(`Host ${email}: ${String(err)}`)
          console.error(`  [ERR]   Host ${email}:`, err)
        }
        continue
      }

      if (role === 'Operator') {
        const { rows: existing } = await client.query(
          `SELECT 1 FROM operators WHERE email = $1`, [email]
        )
        if (existing.length > 0) {
          opsSkipped++
          console.log(`  [SKIP]  Operator already in operators table: ${email}`)
          await client.query(`DELETE FROM admin_users WHERE id = $1`, [id])
          continue
        }

        try {
          await client.query(
            `INSERT INTO operators (full_name, email, geo, role, created_at, updated_at)
             VALUES ($1, $2, $3, 'Operator', $4, $5)`,
            [full_name, email, geo, created_at, updated_at]
          )
          await client.query(`DELETE FROM admin_users WHERE id = $1`, [id])
          operatorsMoved++
          console.log(`  [OPR]   Moved: ${full_name} <${email}> (${geo})`)
        } catch (err) {
          errors.push(`Operator ${email}: ${String(err)}`)
          console.error(`  [ERR]   Operator ${email}:`, err)
        }
        continue
      }

      // Unknown role — leave in place
      console.log(`  [KEEP]  Unknown role '${role}' for ${email} — leaving in admin_users`)
      adminsKept++
    }

    await client.query('COMMIT')

    // ── Summary ──────────────────────────────────────────────────────────────
    console.log('\n─────────────────────────────────────────')
    console.log('  Normalisation complete')
    console.log('─────────────────────────────────────────')
    console.log(`  Dummy hosts purged      : ${hostsPurged ?? 0}`)
    console.log(`  Dummy operators purged  : ${opsPurged ?? 0}`)
    console.log(`  Admins kept             : ${adminsKept}`)
    console.log(`  Hosts moved             : ${hostsMoved}`)
    console.log(`  Operators moved         : ${operatorsMoved}`)
    console.log(`  Hosts skipped (dup)     : ${hostsSkipped}`)
    console.log(`  Operators skipped (dup) : ${opsSkipped}`)
    console.log(`  Errors                  : ${errors.length}`)
    if (errors.length) errors.forEach(e => console.error('  ', e))
    console.log('─────────────────────────────────────────\n')

    // ── Verification queries ──────────────────────────────────────────────────
    const { rows: roleCheck } = await client.query<{ role: string; count: string }>(
      `SELECT role, COUNT(*)::text AS count FROM admin_users GROUP BY role ORDER BY role`
    )
    console.log('  admin_users by role:')
    roleCheck.forEach(r => console.log(`    ${r.role}: ${r.count}`))

    const { rows: [hc] } = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM hosts`)
    const { rows: [oc] } = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM operators`)
    console.log(`\n  hosts count     : ${hc?.count ?? 0}`)
    console.log(`  operators count : ${oc?.count ?? 0}\n`)

  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Migration failed — rolled back:', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

void run()
