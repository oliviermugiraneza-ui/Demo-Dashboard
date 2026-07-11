type Params = { id: string }

export default async function deleteDemoRequest(
  req: { params: Params; user: User },
): Promise<{ success: boolean }> {
  await retoolDb.query(
    `DELETE FROM demo_raw_data WHERE id = $1`,
    [req.params.id],
  )
  return { success: true }
}
