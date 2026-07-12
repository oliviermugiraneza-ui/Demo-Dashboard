// Shared action configuration used by KanbanCard, DemoDetailDrawer, and TrackerTables.
// Single source of truth — update here to change buttons everywhere.

export type ColKey = 'needs' | 'approved' | 'canceled'

// Controls which actions appear. 'completed' = all false (read-only).
export type DrawerContext = 'default' | 'completed'

export interface ActionConfig {
  showReschedule: boolean
  showApprove:    boolean
  showCancel:     boolean
  showEdit:       boolean
  showMarkReady:  boolean
}

export const COL_STATUS: Record<ColKey, string> = {
  needs:    'NEED REVIEW',
  approved: 'APPROVED',
  canceled: 'CANCELED',
}

export function statusToLabel(dbStatus: string): string {
  if (dbStatus === 'APPROVED')    return 'APPROVED'
  if (dbStatus === 'CANCELED')    return 'CANCELED'
  if (dbStatus === 'NEED REVIEW') return 'NEED REVIEW'
  if (dbStatus === 'COMPLETED')   return 'COMPLETED'
  return dbStatus
}

export function statusToColKey(status: string): ColKey {
  if (status === 'APPROVED') return 'approved'
  if (status === 'CANCELED') return 'canceled'
  return 'needs'
}

export function getActionConfig(
  colKey:      ColKey,
  hasReadiness: boolean,
  context:     DrawerContext = 'default',
): ActionConfig {
  if (context === 'completed') {
    return { showReschedule: false, showApprove: false, showCancel: false, showEdit: false, showMarkReady: false }
  }
  return {
    showReschedule: true,
    showApprove:    colKey === 'needs',
    showCancel:     colKey === 'needs' || colKey === 'approved',
    showEdit:       true,
    showMarkReady:  colKey === 'approved' && !hasReadiness,
  }
}
