/** Single source of truth for demo status values used on the server. */
export const DEMO_STATUS = {
  NEED_REVIEW: 'NEED REVIEW',
  APPROVED:    'APPROVED',
  CANCELED:    'CANCELED',
  COMPLETED:   'COMPLETED',
  DELETED:     'DELETED',
} as const

export type DemoStatusValue = typeof DEMO_STATUS[keyof typeof DEMO_STATUS]
