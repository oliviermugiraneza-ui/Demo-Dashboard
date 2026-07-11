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
  { value: 'Nissan AR',  label: 'Nissan AR' },
  { value: 'Nissan LE',  label: 'Nissan LE' },
  { value: 'MachE',      label: 'MachE' },
  { value: 'Jeep',       label: 'Jeep' },
  { value: 'Mercedes',   label: 'Mercedes' },
]

export const PLATFORM_OPTIONS: SelectOption[] = [
  { value: 'Nvidia',    label: 'Nvidia' },
  { value: 'Qualcomm',  label: 'Qualcomm' },
]

export const ROUTE_TYPE_OPTIONS: SelectOption[] = [
  { value: 'City',       label: 'City' },
  { value: 'Highway',    label: 'Highway' },
  { value: 'Mixed',      label: 'Mixed' },
  { value: 'Off-road',   label: 'Off-road' },
  { value: 'Track',      label: 'Track' },
]

export const FEATURE_TYPE_OPTIONS: SelectOption[] = [
  { value: 'PUDO',           label: 'PUDO' },
  { value: 'Set/Over speed', label: 'Set/Over speed' },
  { value: 'Parking',        label: 'Parking' },
  { value: 'MRM',            label: 'MRM' },
]

// ─── Demo Type Config (used for home-page cards and routing) ──────────────────

export interface DemoTypeConfig {
  slug: string
  label: string
  description: string
  accentColor: string
  bgColor: string
  fields: FormFieldDef[]  // kept for legacy compatibility; wizard uses its own step structure
}

export const DEMO_TYPE_CONFIGS: DemoTypeConfig[] = [
  {
    slug: 'vip', label: 'VIP',
    description: 'High-profile executive or investor drive',
    accentColor: '#7C3AED', bgColor: '#F5F3FF',
    fields: [],
  },
  {
    slug: 'media', label: 'Media',
    description: 'Press, media outlet, or broadcast demo',
    accentColor: '#EC4899', bgColor: '#FDF2F8',
    fields: [],
  },
  {
    slug: 'external', label: 'External',
    description: 'Partner, customer, or external stakeholder demo',
    accentColor: '#2563EB', bgColor: '#EFF6FF',
    fields: [],
  },
  {
    slug: 'oem-support', label: 'OEM Support',
    description: 'OEM partner technical support or integration demo',
    accentColor: '#6366F1', bgColor: '#EEF2FF',
    fields: [],
  },
  {
    slug: 'performance-check', label: 'Performance Check',
    description: 'Vehicle or system performance validation run',
    accentColor: '#64748B', bgColor: '#F8FAFC',
    fields: [],
  },
  {
    slug: 'friend-family', label: 'Friend & Family',
    description: 'Informal demo for Wayve employee guests',
    accentColor: '#059669', bgColor: '#ECFDF5',
    fields: [],
  },
  {
    slug: 'conference', label: 'Conference',
    description: 'Multi-session showcase at a conference or event',
    accentColor: '#0891B2', bgColor: '#ECFEFF',
    fields: [],
  },
  {
    slug: 'candidate', label: 'Candidate',
    description: 'Ride-along for a prospective hire',
    accentColor: '#D97706', bgColor: '#FFFBEB',
    fields: [],
  },
]

export function getTypeConfig(slug: string): DemoTypeConfig | undefined {
  return DEMO_TYPE_CONFIGS.find(t => t.slug === slug)
}

export function getTypeConfigByLabel(label: string): DemoTypeConfig | undefined {
  return DEMO_TYPE_CONFIGS.find(t => t.label === label)
}
