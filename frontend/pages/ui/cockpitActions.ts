// Shared action configuration used by KanbanCard, DemoDetailDrawer, and TrackerTables.
// Single source of truth — update here to change buttons everywhere.

export type ColKey = 'needs' | 'reviewed' | 'cancelled'

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
  needs:     'Needs Review',
  reviewed:  'Reviewed',
  cancelled: 'Canceled',
}

// Maps DB status values to user-facing labels.
// DB stores "Reviewed"; UI displays "Approved".
export function statusToLabel(dbStatus: string): string {
  if (dbStatus === 'Reviewed')                           return 'Approved'
  if (dbStatus === 'Canceled' || dbStatus === 'Cancelled') return 'Cancelled'
  if (dbStatus === 'Needs Review' || dbStatus === 'NEEDS REVIEW') return 'Needs Review'
  return dbStatus
}

export function statusToColKey(status: string): ColKey {
  if (status === 'Reviewed')                           return 'reviewed'
  if (status === 'Canceled' || status === 'Cancelled') return 'cancelled'
  return 'needs'
}

export function getActionConfig(
  colKey:      ColKey,
  hasReadiness: boolean,
  context:     DrawerContext = 'default',
): ActionConfig {
  // Completed demos are read-only
  if (context === 'completed') {
    return { showReschedule: false, showApprove: false, showCancel: false, showEdit: false, showMarkReady: false }
  }
  return {
    showReschedule: true,
    // Approve only makes sense for Needs Review — not for already-approved demos
    showApprove:    colKey === 'needs',
    showCancel:     colKey === 'needs' || colKey === 'reviewed',
    showEdit:       true,
    showMarkReady:  colKey === 'reviewed' && !hasReadiness,
  }
}
