type Params = Record<string, never>

export default async function getDemoRequestStats(
  _req: { params: Params; user: User },
) {
  const result = await retoolDb.query<{
    pending: string; approved: string; rejected: string; completed: string; total: string
  }>(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'pending')   AS pending,
       COUNT(*) FILTER (WHERE status = 'approved')  AS approved,
       COUNT(*) FILTER (WHERE status = 'rejected')  AS rejected,
       COUNT(*) FILTER (WHERE status = 'completed') AS completed,
       COUNT(*) AS total
     FROM demo_raw_data`,
  )
  const row = result.data[0]
  return {
    pending:   parseInt(row?.['pending']   ?? '0', 10),
    approved:  parseInt(row?.['approved']  ?? '0', 10),
    rejected:  parseInt(row?.['rejected']  ?? '0', 10),
    completed: parseInt(row?.['completed'] ?? '0', 10),
    total:     parseInt(row?.['total']     ?? '0', 10),
  }
}
