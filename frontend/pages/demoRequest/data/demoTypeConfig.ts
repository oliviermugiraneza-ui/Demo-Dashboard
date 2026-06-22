// ─── Field Definition ─────────────────────────────────────────────────────────

export type FieldKind = 'text' | 'select' | 'date' | 'time' | 'number' | 'textarea' | 'checkbox'

export interface SelectOption { value: string; label: string }

export interface FormFieldDef {
  key: string
  label: string
  kind: FieldKind
  required?: boolean
  placeholder?: string
  helpText?: string
  options?: SelectOption[]
}

// ─── Shared option lists ──────────────────────────────────────────────────────

export const GEO_OPTIONS: SelectOption[] = [
  { value: 'UK', label: '🇬🇧 UK' },
  { value: 'US', label: '🇺🇸 US' },
  { value: 'DE', label: '🇩🇪 DE' },
  { value: 'JP', label: '🇯🇵 JP' },
  { value: 'ST', label: '⚙️ ST' },
]

export const VEHICLE_TYPE_OPTIONS: SelectOption[] = [
  { value: 'SUV',      label: 'SUV' },
  { value: 'Sedan',    label: 'Sedan' },
  { value: 'Van',      label: 'Van' },
  { value: 'Hatchback',label: 'Hatchback' },
  { value: 'Truck',    label: 'Truck' },
  { value: 'Other',    label: 'Other' },
]

export const ROUTE_TYPE_OPTIONS: SelectOption[] = [
  { value: 'City',       label: 'City' },
  { value: 'Highway',    label: 'Highway' },
  { value: 'Mixed',      label: 'Mixed' },
  { value: 'Off-road',   label: 'Off-road' },
  { value: 'Track',      label: 'Track' },
]

export const FEATURE_TYPE_OPTIONS: SelectOption[] = [
  { value: 'Autonomy',   label: 'Autonomy' },
  { value: 'ADAS',       label: 'ADAS' },
  { value: 'Perception', label: 'Perception' },
  { value: 'Planning',   label: 'Planning' },
  { value: 'Full Stack', label: 'Full Stack' },
]

export const LENGTH_OPTIONS: SelectOption[] = [
  { value: '<30mins',   label: '< 30 min' },
  { value: '30-60mins', label: '30 – 60 min' },
  { value: '60-90mins', label: '60 – 90 min' },
  { value: '90+mins',   label: '90+ min' },
]

// ─── Common fields shared by most types ──────────────────────────────────────

const GEO_FIELD: FormFieldDef = {
  key: 'geo', label: 'Location (Geo)', kind: 'select',
  required: true, options: GEO_OPTIONS,
}
const ORG_FIELD: FormFieldDef = {
  key: 'guests_organization', label: 'Guest Organisation', kind: 'text',
  required: true, placeholder: 'e.g. Acme Corp',
}
const HOST_FIELD: FormFieldDef = {
  key: 'host', label: 'Host Name', kind: 'text',
  required: true, placeholder: 'Wayve employee hosting the demo',
}
const DATE_FIELD: FormFieldDef = {
  key: 'date_of_demo', label: 'Demo Date', kind: 'date', required: true,
}
const START_TIME_FIELD: FormFieldDef = {
  key: 'demo_start_time', label: 'Start Time', kind: 'time', required: true,
}
const END_TIME_FIELD: FormFieldDef = {
  key: 'demo_end_time', label: 'End Time', kind: 'time', required: true,
}
const GUESTS_FIELD: FormFieldDef = {
  key: 'total_guests', label: 'Total Guests', kind: 'text',
  required: true, placeholder: 'e.g. 4',
}
const VEHICLES_FIELD: FormFieldDef = {
  key: 'total_vehicles', label: 'Total Vehicles', kind: 'number',
  required: true,
}
const VEHICLE_TYPE_FIELD: FormFieldDef = {
  key: 'vehicle_type', label: 'Vehicle Type', kind: 'select',
  options: VEHICLE_TYPE_OPTIONS,
}
const LOCATION_FIELD: FormFieldDef = {
  key: 'start_location', label: 'Start Location', kind: 'text',
  placeholder: 'e.g. London HQ',
}
const ROUTE_FIELD: FormFieldDef = {
  key: 'route_type', label: 'Route Type', kind: 'select',
  options: ROUTE_TYPE_OPTIONS,
}
const FEATURE_FIELD: FormFieldDef = {
  key: 'feature_type', label: 'Feature Type', kind: 'select',
  options: FEATURE_TYPE_OPTIONS,
}
const DESCRIPTION_FIELD: FormFieldDef = {
  key: 'description', label: 'Description / Notes', kind: 'textarea',
  placeholder: 'Purpose of the demo, special requirements…',
}
const LENGTH_FIELD: FormFieldDef = {
  key: 'length', label: 'Estimated Duration', kind: 'select',
  options: LENGTH_OPTIONS,
}

// ─── Demo Type Config ─────────────────────────────────────────────────────────

export interface DemoTypeConfig {
  slug: string
  label: string
  description: string
  accentColor: string
  bgColor: string
  fields: FormFieldDef[]
}

export const DEMO_TYPE_CONFIGS: DemoTypeConfig[] = [
  {
    slug: 'vip', label: 'VIP',
    description: 'High-profile executive or investor drive',
    accentColor: '#7C3AED', bgColor: '#F5F3FF',
    fields: [
      GEO_FIELD, ORG_FIELD, HOST_FIELD,
      DATE_FIELD, START_TIME_FIELD, END_TIME_FIELD, LENGTH_FIELD,
      GUESTS_FIELD, VEHICLES_FIELD, VEHICLE_TYPE_FIELD,
      ROUTE_FIELD, FEATURE_FIELD,
      { key: 'system_required', label: 'System Required', kind: 'select',
        options: [{ value: 't', label: 'Yes' }, { value: 'f', label: 'No' }] },
      { key: 'recce_required', label: 'Recce Required', kind: 'select',
        options: [{ value: 't', label: 'Yes' }, { value: 'f', label: 'No' }] },
      LOCATION_FIELD, DESCRIPTION_FIELD,
    ],
  },
  {
    slug: 'media', label: 'Media',
    description: 'Press, media outlet, or broadcast demo',
    accentColor: '#EC4899', bgColor: '#FDF2F8',
    fields: [
      GEO_FIELD, ORG_FIELD, HOST_FIELD,
      DATE_FIELD, START_TIME_FIELD, END_TIME_FIELD, LENGTH_FIELD,
      GUESTS_FIELD, VEHICLES_FIELD, VEHICLE_TYPE_FIELD,
      ROUTE_FIELD, FEATURE_FIELD,
      { key: 'recording_permitted', label: 'Recording Permitted', kind: 'select',
        options: [{ value: 't', label: 'Yes' }, { value: 'f', label: 'No' }] },
      LOCATION_FIELD, DESCRIPTION_FIELD,
    ],
  },
  {
    slug: 'external', label: 'External',
    description: 'Partner, customer, or external stakeholder demo',
    accentColor: '#2563EB', bgColor: '#EFF6FF',
    fields: [
      GEO_FIELD, ORG_FIELD, HOST_FIELD,
      DATE_FIELD, START_TIME_FIELD, END_TIME_FIELD, LENGTH_FIELD,
      GUESTS_FIELD, VEHICLES_FIELD, VEHICLE_TYPE_FIELD,
      ROUTE_FIELD, FEATURE_FIELD,
      { key: 'system_required', label: 'System Required', kind: 'select',
        options: [{ value: 't', label: 'Yes' }, { value: 'f', label: 'No' }] },
      LOCATION_FIELD, DESCRIPTION_FIELD,
    ],
  },
  {
    slug: 'oem-support', label: 'OEM Support',
    description: 'OEM partner technical support or integration demo',
    accentColor: '#6366F1', bgColor: '#EEF2FF',
    fields: [
      GEO_FIELD,
      { ...ORG_FIELD, label: 'OEM / Partner Organisation' },
      HOST_FIELD,
      DATE_FIELD, START_TIME_FIELD, END_TIME_FIELD, LENGTH_FIELD,
      GUESTS_FIELD, VEHICLES_FIELD, VEHICLE_TYPE_FIELD,
      ROUTE_FIELD, FEATURE_FIELD,
      LOCATION_FIELD, DESCRIPTION_FIELD,
    ],
  },
  {
    slug: 'performance-check', label: 'Performance Check',
    description: 'Vehicle or system performance validation run',
    accentColor: '#64748B', bgColor: '#F8FAFC',
    fields: [
      GEO_FIELD, HOST_FIELD,
      DATE_FIELD, START_TIME_FIELD, END_TIME_FIELD, LENGTH_FIELD,
      VEHICLES_FIELD, VEHICLE_TYPE_FIELD, ROUTE_FIELD, FEATURE_FIELD,
      { key: 'system_required', label: 'System Required', kind: 'select',
        options: [{ value: 't', label: 'Yes' }, { value: 'f', label: 'No' }] },
      { key: 'recce_required', label: 'Recce Required', kind: 'select',
        options: [{ value: 't', label: 'Yes' }, { value: 'f', label: 'No' }] },
      LOCATION_FIELD, DESCRIPTION_FIELD,
    ],
  },
  {
    slug: 'friend-family', label: 'Friend & Family',
    description: 'Informal demo for Wayve employee guests',
    accentColor: '#059669', bgColor: '#ECFDF5',
    fields: [
      GEO_FIELD, HOST_FIELD,
      DATE_FIELD, START_TIME_FIELD, END_TIME_FIELD, LENGTH_FIELD,
      GUESTS_FIELD, VEHICLES_FIELD, VEHICLE_TYPE_FIELD,
      LOCATION_FIELD, DESCRIPTION_FIELD,
    ],
  },
  {
    slug: 'conference', label: 'Conference',
    description: 'Multi-session showcase at a conference or event',
    accentColor: '#0891B2', bgColor: '#ECFEFF',
    fields: [
      GEO_FIELD, ORG_FIELD, HOST_FIELD,
      DATE_FIELD, START_TIME_FIELD, END_TIME_FIELD, LENGTH_FIELD,
      GUESTS_FIELD, VEHICLES_FIELD, VEHICLE_TYPE_FIELD,
      { key: 'number_of_sessions', label: 'Number of Sessions', kind: 'number',
        helpText: 'How many runs / sessions during the event?' },
      ROUTE_FIELD, LOCATION_FIELD, DESCRIPTION_FIELD,
    ],
  },
  {
    slug: 'candidate', label: 'Candidate',
    description: 'Ride-along for a prospective hire',
    accentColor: '#D97706', bgColor: '#FFFBEB',
    fields: [
      GEO_FIELD,
      { ...ORG_FIELD, label: 'Candidate / Organisation', required: false },
      HOST_FIELD,
      DATE_FIELD, START_TIME_FIELD, END_TIME_FIELD, LENGTH_FIELD,
      GUESTS_FIELD, VEHICLE_TYPE_FIELD,
      LOCATION_FIELD,
      { ...DESCRIPTION_FIELD, required: true },
    ],
  },
]

export function getTypeConfig(slug: string): DemoTypeConfig | undefined {
  return DEMO_TYPE_CONFIGS.find(t => t.slug === slug)
}

export function getTypeConfigByLabel(label: string): DemoTypeConfig | undefined {
  return DEMO_TYPE_CONFIGS.find(t => t.label === label)
}
