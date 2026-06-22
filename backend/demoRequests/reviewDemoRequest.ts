type Params = {
  id: string
  decision: 'approve' | 'reject'
  reason?: string
}

export default async function reviewDemoRequest(
  req: { params: Params; user: User },
): Promise<{ success: boolean }> {
  const { id, decision, reason } = req.params
  const reviewer = req.user.fullName

  if (decision === 'approve') {
    await retoolDb.query(
      `UPDATE demo_raw_data
         SET action = 'Reviewed', status = 'approved',
             approver = $1, updated_at = NOW()
       WHERE id = $2`,
      [reviewer, id],
    )
  } else {
    // Store rejection reason in description since cancelation_reason column is boolean
    if (reason?.trim()) {
      await retoolDb.query(
        `UPDATE demo_raw_data
           SET action = 'Canceled', status = 'rejected',
               approver = $1,
               description = CONCAT('[Rejected] ', $2::text),
               updated_at = NOW()
         WHERE id = $3`,
        [reviewer, reason.trim(), id],
      )
    } else {
      await retoolDb.query(
        `UPDATE demo_raw_data
           SET action = 'Canceled', status = 'rejected',
               approver = $1, updated_at = NOW()
         WHERE id = $2`,
        [reviewer, id],
      )
    }
  }

  return { success: true }
}
