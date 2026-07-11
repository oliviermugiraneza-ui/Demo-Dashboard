export interface BacklogItem {
  id:                   number
  status:               string
  company:              string | null
  customer:             string | null
  requestor:            string | null
  host:                 string | null
  window_person:        string | null
  preferred_demo_date:  string | null
  preferred_time:       string | null
  demo_purpose:         string | null
  demo_route:           string | null
  vehicle:              string | null
  expected_performance: string | null
  priority:             string | null
  ticket_link:          string | null
  notes:                string | null
  geo:                  string | null
  demo_type:            string | null
  converted_demo_id:    number | null
  converted_at:         string | null
  created_at:           string
  updated_at:           string
  created_by:           string | null
  updated_by:           string | null
}

export type BacklogStatus =
  | 'Proposed'
  | 'Requested'
  | 'Arranging'
  | 'Confirmed'
  | 'Completed'
  | 'Cancelled'
  | 'Converted'

/** All selectable statuses (used in forms/filters) */
export const BACKLOG_STATUSES: BacklogStatus[] = [
  'Proposed', 'Requested', 'Arranging', 'Confirmed', 'Completed', 'Cancelled',
]

/** Statuses shown as kanban columns (Completed and Cancelled shown separately as tables) */
export const KANBAN_STATUSES: BacklogStatus[] = [
  'Proposed', 'Requested', 'Arranging', 'Confirmed',
]
