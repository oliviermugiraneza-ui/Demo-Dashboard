import { normalize, REQUESTER_FIELDS, ADMIN_EXTRA_FIELDS, AdminField } from './fields'

type Params = { id: string } & Partial<Record<AdminField, unknown>>

const ALL_ALLOWED = new Set<string>([...REQUESTER_FIELDS, ...ADMIN_EXTRA_FIELDS])

export default async function updateDemoRequest(
  req: { params: Params; user: User },
): Promise<{ success: boolean }> {
  const { id, ...fields } = req.params

  const setClauses: string[] = []
  const values: unknown[] = []
  let idx = 1

  for (const [key, val] of Object.entries(fields)) {
    if (!ALL_ALLOWED.has(key)) continue
    setClauses.push(`${key} = $${idx++}`)
    values.push(normalize(val))
  }

  if (setClauses.length === 0) return { success: true }

  setClauses.push(`updated_at = NOW()`)
  values.push(id)

  await retoolDb.query(
    `UPDATE demo_raw_data SET ${setClauses.join(', ')} WHERE id = $${idx}`,
    values,
  )
  return { success: true }
}
