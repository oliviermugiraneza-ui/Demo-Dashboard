import type { BacklogStatus } from './types'

interface StatusConfig {
  label:      string
  bg:         string
  text:       string
  border:     string
  headerBg:   string
  headerText: string
  accent:     string
  cardBg:     string
}

export const STATUS_CONFIG: Record<BacklogStatus, StatusConfig> = {
  Proposed:  {
    label: 'Proposed',  bg: '#F5F3FF', text: '#6D28D9', border: '#DDD6FE',
    headerBg: '#EDE9FE', headerText: '#5B21B6', accent: '#8B5CF6', cardBg: '#FAFAFA',
  },
  Requested: {
    label: 'Requested', bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE',
    headerBg: '#DBEAFE', headerText: '#1E40AF', accent: '#3B82F6', cardBg: '#FAFAFA',
  },
  Arranging: {
    label: 'Arranging', bg: '#FFFBEB', text: '#92400E', border: '#FDE68A',
    headerBg: '#FEF3C7', headerText: '#78350F', accent: '#F59E0B', cardBg: '#FAFAFA',
  },
  Confirmed: {
    label: 'Confirmed', bg: '#F0FDFA', text: '#0F766E', border: '#99F6E4',
    headerBg: '#CCFBF1', headerText: '#0F766E', accent: '#14B8A6', cardBg: '#FAFAFA',
  },
  Completed: {
    label: 'Completed', bg: '#F0FDF4', text: '#166534', border: '#BBF7D0',
    headerBg: '#DCFCE7', headerText: '#15803D', accent: '#22C55E', cardBg: '#FAFAFA',
  },
  CANCELED: {
    label: 'CANCELED', bg: '#FEF2F2', text: '#991B1B', border: '#FECACA',
    headerBg: '#FEE2E2', headerText: '#991B1B', accent: '#EF4444', cardBg: '#FAFAFA',
  },
  Converted: {
    label: 'Converted', bg: '#F0FDF4', text: '#166534', border: '#BBF7D0',
    headerBg: '#DCFCE7', headerText: '#15803D', accent: '#22C55E', cardBg: '#FAFAFA',
  },
}

export const PRIORITY_CONFIG: Record<string, { bg: string; text: string; border: string }> = {
  P0: { bg: '#FEF2F2', text: '#DC2626', border: '#FCA5A5' },
  P1: { bg: '#FFFBEB', text: '#D97706', border: '#FCD34D' },
  P2: { bg: '#F8FAFC', text: '#64748B', border: '#CBD5E1' },
}

export function getStatusConfig(status: string): StatusConfig {
  return STATUS_CONFIG[status as BacklogStatus] ?? STATUS_CONFIG.Proposed
}

export function getPriorityConfig(priority: string | null) {
  if (!priority) return PRIORITY_CONFIG.P2
  return PRIORITY_CONFIG[priority.toUpperCase()] ?? PRIORITY_CONFIG.P2
}
