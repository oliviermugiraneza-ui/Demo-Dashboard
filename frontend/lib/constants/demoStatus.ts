/** Single source of truth for demo status values used in the frontend. */
export const DEMO_STATUS = {
  NEED_REVIEW: 'NEED REVIEW',
  APPROVED:    'APPROVED',
  CANCELED:    'CANCELED',
  COMPLETED:   'COMPLETED',
} as const

export type DemoStatusValue = typeof DEMO_STATUS[keyof typeof DEMO_STATUS]

/** Visual config for each status: background, text, dot colours and display label. */
export const STATUS_CONFIG: Record<string, {
  bg: string; text: string; dot: string; label: string
}> = {
  [DEMO_STATUS.NEED_REVIEW]: { bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B', label: 'Need Review' },
  [DEMO_STATUS.APPROVED]:    { bg: '#DCFCE7', text: '#15803D', dot: '#22C55E', label: 'Approved'    },
  [DEMO_STATUS.CANCELED]:    { bg: '#FEE2E2', text: '#B91C1C', dot: '#EF4444', label: 'Canceled'    },
  [DEMO_STATUS.COMPLETED]:   { bg: '#DBEAFE', text: '#1E40AF', dot: '#3B82F6', label: 'Completed'   },
  'DELETED':                 { bg: '#F1F5F9', text: '#64748B', dot: '#94A3B8', label: 'Deleted'     },
}

/** Accent colour for KPI card top borders. */
export const KPI_BORDER_COLOR: Record<string, string> = {
  proposed:        '#8B5CF6',
  pendingApproval: '#F59E0B',
  approved:        '#10B981',
  totalGuests:     '#3B82F6',
  cancelled:       '#EF4444',
}
