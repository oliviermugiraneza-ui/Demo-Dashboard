// ─── Shared server-side TypeScript types ─────────────────────────────────────

/** Raw column shape from demo_master (typed columns — pg returns Date for timestamps, number for integers) */
export interface DemoRow {
  id:                        string | null  // bigint → pg returns as string
  status:                    string | null
  channel:                   string | null
  geo:                       string | null
  type:                      string | null
  date_request_received:     Date | string | null
  date_of_demo:              Date | string | null
  demo_start_time:           Date | string | null
  demo_end_time:             Date | string | null
  length:                    string | null
  total_guests:              number | string | null
  total_vehicles:            number | string | null
  vehicle_type:              string | null
  start_location:            string | null
  calendar_event_link:       string | null
  slack_link:                string | null
  cross_geo_demo:            boolean | string | null
  number_of_sessions_event:  number | string | null
  description:               string | null
  requester:                 string | null
  approver:                  string | null
  guests_organization:       string | null
  route_type:                string | null
  feature_type:              string | null
  host:                      string | null
  lead_time_days:            number | string | null
  cancelation_reason:        string | null
  date_of_readiness:         string | null
}

/** Normalised shape sent to the client */
export interface NormalisedDemo {
  id:             string
  db_id:          number | null
  status:         string
  geo:            string
  type:           string
  requester:      string
  approver:       string
  organization:   string
  host:           string
  date_requested: string
  demo_date:      string
  start_time:     string
  end_time:       string
  vehicle_type:   string
  total_guests:   number
  total_vehicles: number
  lead_days:      number
  readiness_date: string | null
  slack_link:     string | null
  cancel_reason:  string | null
  channel:        string
  description:    string
  start_location: string
  route_type:     string
  feature_type:   string
  cross_geo:      string
  calendar_link:  string | null
  num_sessions:   number
  duration:       string
}

/** Query options for DemoRepository.findAll */
export interface QueryOptions {
  limit?:     number
  offset?:    number
  search?:    string
  geo?:       string
  type?:      string
  status?:    string
  requester?: string
  approver?:  string
  host?:      string
  sortBy?:    'demo_date' | 'date_requested' | 'lead_days'
  sortDir?:   'ASC' | 'DESC'
}

/** Input shape for INSERT/UPDATE on demo_master_raw */
export interface CreateDemoInput {
  status?:                  string
  channel?:                 string
  geo?:                     string
  type?:                    string
  date_request_received?:   string
  date_of_demo?:            string
  demo_start_time?:         string
  demo_end_time?:           string
  length?:                  string
  total_guests?:            string
  total_vehicles?:          string
  vehicle_type?:            string
  start_location?:          string
  slack_link?:              string
  description?:             string
  requester?:               string
  approver?:                string
  guests_organization?:     string
  route_type?:              string
  feature_type?:            string
  host?:                    string
  lead_time_days?:          string
  cancelation_reason?:      string
  date_of_readiness?:       string
}

export interface ApiResponse<T> {
  ok:     boolean
  data?:  T
  total?: number
  error?: string
  hint?:  string
  code?:  string
}
