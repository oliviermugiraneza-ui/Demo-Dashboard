import { useState, useCallback, useRef, useEffect } from 'react'
import { X, ChevronRight, ChevronLeft, Search, Check, AlertTriangle, Star, Loader2, ChevronDown } from 'lucide-react'

// ─── Static data ──────────────────────────────────────────────────────────────

const BEHAVIOUR_GROUPS = [
  {
    id: 'driving',
    label: 'Driving',
    color: '#3b82f6',
    items: [
      'Over-throttle required',
      'DILC required',
      'Unnecessary braking',
      'Sharp braking',
      'Sharp acceleration',
      'Too slow acceleration',
      'Early turning',
      'Late turning',
      'Drifting in lane',
      'Inappropriate positioning in lane',
    ],
  },
  {
    id: 'navigation',
    label: 'Navigation',
    color: '#8b5cf6',
    items: [
      'Wrong lane selection',
      'Difficulty following the route',
    ],
  },
  {
    id: 'traffic',
    label: 'Traffic',
    color: '#f59e0b',
    items: [
      'Inappropriate following distance',
      'Issues negotiating with oncoming vehicles',
      'Inappropriate berth around cyclists, static obstacles, or other vehicles on road',
    ],
  },
  {
    id: 'safety',
    label: 'Safety',
    color: '#ef4444',
    items: [
      'Improper handling of zebra crossing, pedestrians at junctions',
      'Failing to properly accommodate emergency vehicles',
      'Not reacting correctly to light signals',
      'Driving above speed limit',
    ],
  },
  {
    id: 'vehicle',
    label: 'Vehicle Control',
    color: '#10b981',
    items: [
      'Steering wheel oscillation',
      'Steering wheel twitching',
    ],
  },
] as const

const INTERVENTIONS = [
  'Early turn',
  'Exceeding speed limit',
  'Failed to accelerate',
  'Failed to follow lane position',
  'Failed to follow route map',
  'Failed to maintain speed',
  'Failed to overtake',
  'Failed to remain stopped',
  'Failed to slow dynamic/static',
  'Failed to slow for emergency services',
  'Give way',
  'Give way at roundabout',
  'Give way emerging from junction',
  'Give way for not priority vehicle',
  'Incorrectly initiated overtake',
  'Incorrect lane',
  'Indicator misuse',
  'Lane change unnecessary',
  'Navigation wrong lane',
  'Pedestrian crossing',
  'Pedestrian at junction',
  'Pothole avoidance',
  'Proceed at roundabout',
  'Red light violation',
  'Remain stopped filter light',
  'Right turn on red',
  'Road closed non-compliance',
  'Slow response emerging from junction',
  'Slow for leading vehicle',
  'Speed inappropriate',
  'Stop sign violation',
  'Unprotected left turn',
  'Unprotected right turn',
  'Lane position, width restriction fail',
]

const DRIVING_FEATURES_LIST = ['PUDO', 'Parking', 'Set/Over speed', 'MRM']
const DEMO_ISSUES_LIST = ['UI crash', 'Power cycle', 'Map/ Navigation', 'UDs (uncommanded)']
const GEO_OPTIONS = ['JP', 'UK', 'US', 'DE'] as const

type Category = 'demo' | 'recce' | 'brt'
type Geo = typeof GEO_OPTIONS[number]

// ─── Admin data shapes ────────────────────────────────────────────────────────

interface DemoMatch {
  id: number
  demo_ref: string
  geo: string | null
  date_of_demo: string | null
  demo_start_time: string | null
  type: string | null
  guests_organization: string | null
  start_location: string | null
  vehicle_type: string | null
  host: string | null
}

interface Operator  { id: string; full_name: string; email: string; geo: string }
interface RouteOpt  { id: number; route_name: string; console_link?: string; geo: string }
interface VehicleOpt{ id: number; vehicle_id: string; vehicle_type: string; geo: string }
interface ModelOpt  { id: number; model_name: string; platform: string; baseline_tag: boolean; geo: string }

// ─── Wizard state ─────────────────────────────────────────────────────────────

interface WizardState {
  category:             Category
  geo:                  Geo | ''
  refInput:             string
  demoId:               number | null
  demoRef:              string
  demoDate:             string
  demoTime:             string
  demoType:             string
  guestOrganization:    string
  route:                string
  host:                 string
  operatorName:         string
  operatorEmail:        string
  vehicleId:            string
  modelName:            string
  behaviours:           string[]
  drivingFeatures:      string[]
  demoIssues:           string[]
  powerCycle:           boolean
  powerCycleReason:     string
  numberOfUds:          number
  interventions:        Record<string, number>
  interventionSC:       Record<string, boolean>
  safetyCritical:       boolean
  safetyScore:          number
  comfortScore:         number
  decisivenessScore:    number
  aggressivenessScore:  number
  smoothnessScore:      number
}

const defaultState = (): WizardState => ({
  category:             'demo',
  geo:                  '',
  refInput:             '',
  demoId:               null,
  demoRef:              '',
  demoDate:             '',
  demoTime:             '',
  demoType:             '',
  guestOrganization:    '',
  route:                '',
  host:                 '',
  operatorName:         '',
  operatorEmail:        '',
  vehicleId:            '',
  modelName:            '',
  behaviours:           [],
  drivingFeatures:      [],
  demoIssues:           [],
  powerCycle:           false,
  powerCycleReason:     '',
  numberOfUds:          0,
  interventions:        {},
  interventionSC:       {},
  safetyCritical:       false,
  safetyScore:          5,
  comfortScore:         5,
  decisivenessScore:    5,
  aggressivenessScore:  5,
  smoothnessScore:      0,
})

interface NewReportWizardProps {
  onClose:  () => void
  onCreate: (data: Record<string, unknown>) => Promise<void>
}

// ─── ComboSelect ──────────────────────────────────────────────────────────────

interface SelectOpt { value: string; label: string; sub?: string }

function ComboSelect({
  value, onChange, options, placeholder = 'Select…',
  loading = false, loadingText = 'Loading…',
  emptyText = 'No options found',
  manualPlaceholder = 'Enter manually…',
}: {
  value: string; onChange: (v: string) => void
  options: SelectOpt[]
  placeholder?: string; loading?: boolean; loadingText?: string
  emptyText?: string; manualPlaceholder?: string
}) {
  const [open, setOpen]     = useState(false)
  const [query, setQuery]   = useState('')
  const [manual, setManual] = useState(false)
  const containerRef        = useRef<HTMLDivElement>(null)
  const searchRef           = useRef<HTMLInputElement>(null)

  // Auto-enter manual mode if no options after loading completes
  const showManual = manual || (!loading && options.length === 0)

  useEffect(() => {
    if (!open) return
    const fn = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [open])

  useEffect(() => {
    if (open) searchRef.current?.focus()
  }, [open])

  const filtered = query
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  const selected = options.find(o => o.value === value)

  const pick = (v: string) => { onChange(v); setOpen(false); setQuery('') }

  if (showManual) {
    return (
      <div className="space-y-1">
        <input
          value={value} onChange={e => onChange(e.target.value)}
          placeholder={manualPlaceholder}
          className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#c4e1ec] bg-white"
        />
        {options.length > 0 && (
          <button type="button" onClick={() => setManual(false)}
            className="text-[11px] text-[#4a8eab] hover:underline ml-1">
            ← Choose from list
          </button>
        )}
        {options.length === 0 && !loading && (
          <p className="text-[11px] text-gray-400 ml-1">{emptyText}</p>
        )}
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => !loading && setOpen(o => !o)}
        disabled={loading}
        className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl bg-white text-left flex items-center justify-between gap-2 focus:outline-none focus:ring-2 focus:ring-[#c4e1ec] hover:border-gray-300 transition-colors disabled:opacity-60 disabled:cursor-wait"
      >
        <span className={selected || (value && !selected) ? 'text-gray-900' : 'text-gray-400'}>
          {loading ? (
            <span className="flex items-center gap-2 text-gray-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />{loadingText}
            </span>
          ) : selected ? selected.label
            : value    ? value
            :            placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-40 w-full mt-1 bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input ref={searchRef} value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Search…"
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-100 rounded-lg bg-gray-50 focus:outline-none focus:ring-1 focus:ring-gray-200"
              />
            </div>
          </div>

          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-4 py-4 text-sm text-gray-400 text-center">{emptyText}</p>
            ) : filtered.map(opt => (
              <button key={opt.value} type="button" onClick={() => pick(opt.value)}
                className={`w-full px-4 py-2.5 text-left flex items-center justify-between border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors ${
                  opt.value === value ? 'bg-[#e1eff6] text-[#1e5f7a]' : 'text-gray-700'
                }`}>
                <span className="text-sm font-medium">{opt.label}</span>
                {opt.sub && <span className="text-xs text-gray-400 ml-2 flex-shrink-0">{opt.sub}</span>}
              </button>
            ))}
          </div>

          <div className="p-2 border-t border-gray-100">
            <button type="button" onClick={() => { setManual(true); setOpen(false); setQuery('') }}
              className="w-full text-left px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 rounded-lg transition-colors">
              ✏ Enter manually
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Premium Rating Slider ────────────────────────────────────────────────────

const RATING_LABELS: Record<string, { low: string; high: string }> = {
  Safety:         { low: 'Felt very unsafe',   high: 'Felt very safe' },
  Comfort:        { low: 'Very uncomfortable', high: 'Very comfortable' },
  Decisiveness:   { low: 'Indecisive',         high: 'Decisive' },
  Aggressiveness: { low: 'Not aggressive',     high: 'Extremely aggressive' },
}

function PremiumRatingSlider({
  label, value, onChange,
}: {
  label: string; value: number; onChange: (v: number) => void
}) {
  const pct      = Math.round(((value - 1) / 9) * 100)
  const color    = value <= 4 ? '#ef4444' : value <= 7 ? '#f59e0b' : '#10b981'
  const textCls  = value <= 4 ? 'text-red-500' : value <= 7 ? 'text-amber-500' : 'text-emerald-500'
  const { low, high } = RATING_LABELS[label] ?? { low: '', high: '' }

  return (
    <div className="space-y-3 py-1">
      {/* Title + score */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-800">{label}</span>
        <div className="flex items-baseline gap-0.5">
          <span className={`text-3xl font-black tabular-nums leading-none ${textCls}`}>{value}</span>
          <span className="text-xs font-normal text-gray-400 ml-0.5">/ 10</span>
        </div>
      </div>

      {/* Track + range input */}
      <div className="relative h-6 flex items-center">
        {/* Background track */}
        <div className="absolute inset-x-0 h-2 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full transition-[width] duration-75"
            style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.65 }}
          />
        </div>
        {/* Thumb marker */}
        <div
          className="absolute w-5 h-5 rounded-full bg-white shadow-md border-2 pointer-events-none transition-[left] duration-75 -translate-x-1/2"
          style={{
            left: `clamp(10px, calc(${pct}% ), calc(100% - 10px))`,
            borderColor: color,
            top: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />
        {/* Invisible range input on top */}
        <input
          type="range" min={1} max={10} step={1} value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
        />
      </div>

      {/* Labels */}
      <div className="flex justify-between">
        <span className="text-[10px] text-gray-400 max-w-[45%] leading-snug">{low}</span>
        <span className="text-[10px] text-gray-400 max-w-[45%] text-right leading-snug">{high}</span>
      </div>
    </div>
  )
}

// ─── Small atoms ─────────────────────────────────────────────────────────────

function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all select-none ${
        selected ? 'bg-[#e1eff6] text-[#1e5f7a] border-[#4a8eab] font-semibold' : 'bg-white text-gray-600 border-gray-200 hover:border-[#7ab1c5]'
      }`}>
      {label}
    </button>
  )
}

function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center rounded-xl border border-gray-200 overflow-hidden bg-white w-fit">
      <button type="button" onClick={() => onChange(Math.max(0, value - 1))}
        className="w-11 h-11 flex items-center justify-center text-xl text-gray-500 hover:bg-gray-50 transition-colors">−</button>
      <span className="w-12 text-center text-lg font-semibold text-gray-900 tabular-nums">{value}</span>
      <button type="button" onClick={() => onChange(value + 1)}
        className="w-11 h-11 flex items-center justify-center text-xl text-gray-500 hover:bg-gray-50 transition-colors">+</button>
    </div>
  )
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0)
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(n => (
        <button key={n} type="button" onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)} onMouseLeave={() => setHovered(0)}
          className="p-0.5 transition-transform hover:scale-110">
          <Star className={`w-5 h-5 transition-colors ${n <= (hovered || value) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`} />
        </button>
      ))}
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-800 truncate">{value || <span className="text-gray-300 italic font-normal">—</span>}</p>
    </div>
  )
}

function BehaviourGroup({
  group, selected, onToggle,
}: { group: typeof BEHAVIOUR_GROUPS[number]; selected: string[]; onToggle: (item: string) => void }) {
  const [open, setOpen] = useState(false)
  const count = group.items.filter(i => selected.includes(i)).length
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-gray-400" />
          <span className="text-sm font-medium text-gray-800">{group.label}</span>
          {count > 0 && (
            <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-[#4a8eab] text-white">{count}</span>
          )}
        </div>
        <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="border-t border-gray-100 bg-gray-50/50 p-3 space-y-1.5">
          {group.items.map(item => {
            const sel = selected.includes(item)
            return (
              <button key={item} type="button" onClick={() => onToggle(item)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left text-sm transition-all ${
                  sel ? 'bg-[#e1eff6] text-[#1e5f7a] font-medium border border-[#4a8eab]' : 'bg-white text-gray-700 hover:bg-[#f0f8ff] border border-gray-200'
                }`}>
                <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border ${
                  sel ? 'border-[#4a8eab] bg-[#4a8eab]' : 'border-gray-300'
                }`}>
                  {sel && <Check className="w-3 h-3 text-white" />}
                </div>
                {item}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function InterventionList({ interventions, onChange, interventionSC, onSCChange }: {
  interventions: Record<string, number>
  onChange: (k: string, v: number) => void
  interventionSC: Record<string, boolean>
  onSCChange: (k: string, sc: boolean) => void
}) {
  const [query, setQuery] = useState('')
  const filtered = INTERVENTIONS.filter(i => !query || i.toLowerCase().includes(query.toLowerCase()))
  const active   = INTERVENTIONS.filter(i => (interventions[i] ?? 0) > 0)
  return (
    <div className="space-y-2.5">
      {active.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-3 bg-gray-50 rounded-xl border border-gray-200">
          {active.map(k => (
            <div key={k} className={`flex items-center gap-1 rounded-lg px-2 py-1 border ${interventionSC[k] ? 'bg-red-50 border-red-300' : 'bg-white border-gray-200'}`}>
              <span className="text-xs text-gray-700 max-w-[130px] truncate">{k}</span>
              <span className="text-xs font-bold text-gray-900 w-4 text-center">{interventions[k]}</span>
              {interventionSC[k] && <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />}
              <button type="button" onClick={() => onChange(k, 0)} className="text-gray-400 hover:text-red-500 ml-0.5">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search intervention…"
          className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white" />
      </div>
      <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
        {filtered.map(item => {
          const count = interventions[item] ?? 0
          const sc    = interventionSC[item] ?? false
          return (
            <div key={item} className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
              count > 0 ? (sc ? 'bg-red-50 border border-red-200' : 'bg-gray-50 border border-gray-200') : 'bg-white border border-gray-100 hover:bg-gray-50'
            }`}>
              <div className="flex items-center gap-2 flex-1 min-w-0 pr-2">
                <span className="text-sm text-gray-700 truncate">{item}</span>
                {count > 0 && (
                  <button
                    type="button"
                    title="Mark as Safety Critical"
                    onClick={() => onSCChange(item, !sc)}
                    className={`flex-shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                      sc
                        ? 'bg-red-500 border-red-500 text-white'
                        : 'bg-white border-gray-300 text-gray-400 hover:border-red-400 hover:text-red-500'
                    }`}
                  >
                    <AlertTriangle className="w-3 h-3" />
                    SC
                  </button>
                )}
              </div>
              <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden bg-white flex-shrink-0">
                <button type="button" onClick={() => onChange(item, Math.max(0, count - 1))}
                  className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-50">−</button>
                <span className={`w-7 text-center text-sm font-bold tabular-nums ${count > 0 ? 'text-gray-900' : 'text-gray-300'}`}>{count}</span>
                <button type="button" onClick={() => onChange(item, Math.min(99, count + 1))}
                  className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-50">+</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Preview helpers ──────────────────────────────────────────────────────────

function PreviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '' || value === 0) return null
  return (
    <div className="flex justify-between items-start py-2 border-b border-gray-50 last:border-0 gap-4">
      <span className="text-xs text-gray-400 font-medium shrink-0 w-36">{label}</span>
      <span className="text-xs text-gray-800 font-semibold text-right flex-1">{value}</span>
    </div>
  )
}

function PreviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-3">{title}</p>
      {children}
    </div>
  )
}

function ScorePip({ label, value }: { label: string; value: number }) {
  const bg = value <= 4 ? '#ef4444' : value <= 7 ? '#f59e0b' : '#10b981'
  return (
    <div className="text-center">
      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold mx-auto mb-1"
           style={{ backgroundColor: bg }}>{value}</div>
      <p className="text-[9px] text-gray-400 uppercase tracking-wide leading-tight">{label}</p>
    </div>
  )
}

// ─── Disabled placeholder ─────────────────────────────────────────────────────

function GeoFirst({ field }: { field: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-xl border border-dashed border-gray-200">
      <span className="text-sm text-gray-400 italic">Select a GEO to load {field}</span>
    </div>
  )
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

export default function NewReportWizard({ onClose, onCreate }: NewReportWizardProps) {
  const [step, setStep]     = useState(1)
  const [state, setState]   = useState<WizardState>(defaultState)
  const [saving, setSaving] = useState(false)
  const bodyRef             = useRef<HTMLDivElement>(null)

  // Demo ref lookup state
  const [refLoading, setRefLoading]   = useState(false)
  const [refError, setRefError]       = useState<string | null>(null)
  const [refResolved, setRefResolved] = useState(false)
  const [refMatches, setRefMatches]   = useState<DemoMatch[]>([])

  // GEO-driven admin data
  const [operators,      setOperators]      = useState<Operator[]>([])
  const [opsLoading,     setOpsLoading]     = useState(false)
  const [routes,         setRoutes]         = useState<RouteOpt[]>([])
  const [routesLoading,  setRoutesLoading]  = useState(false)
  const [vehicles,       setVehicles]       = useState<VehicleOpt[]>([])
  const [vehiclesLoading,setVehiclesLoading]= useState(false)
  const [models,         setModels]         = useState<ModelOpt[]>([])
  const [modelsLoading,  setModelsLoading]  = useState(false)

  const set = useCallback(<K extends keyof WizardState>(key: K, val: WizardState[K]) =>
    setState(prev => ({ ...prev, [key]: val })), [])

  const scrollTop = () => bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' })

  // ── Fetch all admin data when GEO changes ──────────────────────────────────

  useEffect(() => {
    if (!state.geo) {
      setOperators([]); setRoutes([]); setVehicles([]); setModels([])
      return
    }
    const geo = state.geo

    setOpsLoading(true)
    fetch(`/api/admin/operators?geo=${geo}`)
      .then(r => r.json() as Promise<{ ok: boolean; data: Operator[] }>)
      .then(j => setOperators(j.ok ? j.data : []))
      .catch(() => setOperators([]))
      .finally(() => setOpsLoading(false))

    setRoutesLoading(true)
    fetch(`/api/admin/routes?geo=${geo}`)
      .then(r => r.json() as Promise<{ ok: boolean; data: RouteOpt[] }>)
      .then(j => setRoutes(j.ok ? j.data : []))
      .catch(() => setRoutes([]))
      .finally(() => setRoutesLoading(false))

    setVehiclesLoading(true)
    fetch(`/api/admin/vehicles?geo=${geo}`)
      .then(r => r.json() as Promise<{ ok: boolean; data: VehicleOpt[] }>)
      .then(j => setVehicles(j.ok ? j.data : []))
      .catch(() => setVehicles([]))
      .finally(() => setVehiclesLoading(false))

    setModelsLoading(true)
    fetch(`/api/admin/models?geo=${geo}`)
      .then(r => r.json() as Promise<{ ok: boolean; data: ModelOpt[] }>)
      .then(j => setModels(j.ok ? j.data : []))
      .catch(() => setModels([]))
      .finally(() => setModelsLoading(false))
  }, [state.geo])

  // ── Demo ref lookup ────────────────────────────────────────────────────────

  const applyMatch = useCallback((d: DemoMatch) => {
    setState(prev => ({
      ...prev,
      demoId:            d.id,
      demoRef:           d.demo_ref,
      refInput:          d.demo_ref,
      demoDate:          d.date_of_demo ?? '',
      demoTime:          d.demo_start_time ?? '',
      demoType:          d.type ?? '',
      guestOrganization: d.guests_organization ?? '',
      route:             d.start_location ?? '',
      host:              d.host ?? '',
      geo:               (d.geo?.toUpperCase() ?? prev.geo) as Geo | '',
    }))
    setRefResolved(true)
    setRefMatches([])
    setRefError(null)
  }, [])

  const lookupRef = useCallback(async () => {
    const raw = state.refInput.trim().toUpperCase()
    if (!raw || !state.geo) return
    setRefLoading(true); setRefError(null); setRefResolved(false); setRefMatches([])
    try {
      if (/^(JP|UK|US|DE)-\d{6}-\d{2}$/.test(raw)) {
        const res  = await fetch(`/api/demos/lookup-ref/${encodeURIComponent(raw)}`)
        const json = await res.json() as { ok: boolean; demo?: DemoMatch; error?: string }
        if (!json.ok || !json.demo) { setRefError(json.error ?? 'Demo not found'); return }
        applyMatch(json.demo); return
      }
      if (/^\d{6}$/.test(raw)) {
        const res  = await fetch(`/api/demos/search-ref?geo=${state.geo}&dateCode=${raw}`)
        const json = await res.json() as {
          ok: boolean; mode?: 'single' | 'multiple'
          demo?: DemoMatch; matches?: DemoMatch[]; error?: string
        }
        if (!json.ok) { setRefError(json.error ?? 'Not found'); return }
        if (json.mode === 'single' && json.demo)     { applyMatch(json.demo); return }
        if (json.mode === 'multiple' && json.matches) { setRefMatches(json.matches); return }
      }
      setRefError('Enter a 6-digit date code (e.g. 260704) or full ref (e.g. JP-260704-01)')
    } catch {
      setRefError('Network error — could not reach server')
    } finally { setRefLoading(false) }
  }, [state.refInput, state.geo, applyMatch])

  const clearRef = () => {
    setRefResolved(false); setRefMatches([]); setRefError(null)
    setState(prev => ({
      ...prev, demoId: null, demoRef: '', demoDate: '', demoTime: '',
      demoType: '', guestOrganization: '', route: '', host: '',
    }))
  }

  // ── Validation ──────────────────────────────────────────────────────────────

  const step1Valid = (() => {
    if (!state.geo)                 return false
    if (!state.operatorName.trim()) return false
    if (!state.route.trim())        return false
    if (!state.vehicleId.trim())    return false
    if (state.category !== 'brt' && !refResolved) return false
    return true
  })()

  const step2Valid = !!state.modelName.trim()
    && (!state.powerCycle || !!state.powerCycleReason.trim())

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setSaving(true)
    try {
      const activeInterventions: Record<string, number> = {}
      Object.entries(state.interventions).forEach(([k, v]) => { if (v > 0) activeInterventions[k] = v })

      const activeSC: Record<string, boolean> = {}
      Object.entries(state.interventionSC).forEach(([k, v]) => {
        if (v && (activeInterventions[k] ?? 0) > 0) activeSC[k] = true
      })

      await onCreate({
        category:              state.category,
        demo_id:               state.demoId,
        demo_ref:              state.demoRef || null,
        geo:                   state.geo,
        demo_date:             state.demoDate || null,
        demo_time:             state.demoTime || null,
        demo_type:             state.demoType || null,
        guest_organization:    state.category === 'brt' ? null : (state.guestOrganization || null),
        route:                 state.route || null,
        vehicle:               state.vehicleId || null,
        vehicle_id:            state.vehicleId,
        operator_name:         state.operatorName || null,
        operator_email:        state.operatorEmail || null,
        model_name:            state.modelName,
        model_behaviours:      state.behaviours,
        safety_score:          state.safetyScore,
        comfort_score:         state.comfortScore,
        decisiveness_score:    state.decisivenessScore,
        aggressiveness_score:  state.aggressivenessScore,
        driving_features:      state.drivingFeatures,
        demo_issues:           state.demoIssues,
        reason_for_power_cycle:   state.powerCycle ? (state.powerCycleReason || null) : null,
        power_cycle_required:  state.powerCycle,
        number_of_uds:         state.numberOfUds,
        interventions:         activeInterventions,
        interventions_sc:      Object.keys(activeSC).length > 0 ? activeSC : null,
        safety_critical:       state.safetyCritical,
        smoothness_score:      state.smoothnessScore || null,
      })
      onClose()
    } finally { setSaving(false) }
  }

  const STEPS = [
    { id: 1, label: 'Context',     sub: 'Run details' },
    { id: 2, label: 'Performance', sub: 'Model data' },
    { id: 3, label: 'Review',      sub: 'Confirm' },
  ]

  const totalInterventions = Object.values(state.interventions).reduce((a, b) => a + b, 0)

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full h-full sm:h-auto sm:max-h-[96vh] sm:w-[560px] sm:rounded-2xl flex flex-col shadow-2xl overflow-hidden">

        {/* ── Header ── */}
        <div className="flex-shrink-0 px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">Ops Feedback</h2>
              <p className="text-xs text-gray-400 mt-0.5">{STEPS[step - 1]!.label} — {STEPS[step - 1]!.sub}</p>
            </div>
            <button type="button" onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          {/* Progress */}
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2 flex-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${
                  step > s.id  ? 'bg-[#4a8eab] text-white' :
                  step === s.id? 'bg-[#4a8eab] text-white ring-4 ring-[#e1eff6]' :
                                 'bg-gray-100 text-gray-400'
                }`}>
                  {step > s.id ? <Check className="w-3.5 h-3.5" /> : s.id}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${step === s.id ? 'text-[#1e5f7a]' : 'text-gray-400'}`}>{s.label}</span>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 rounded-full ml-1 transition-colors ${step > s.id ? 'bg-[#4a8eab]' : 'bg-gray-100'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Body ── */}
        <div ref={bodyRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {/* ═════ STEP 1 ═════ */}
          {step === 1 && (
            <>
              {/* Category */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Category</p>
                <div className="grid grid-cols-3 gap-2">
                  {(['demo', 'recce', 'brt'] as Category[]).map(cat => (
                    <button key={cat} type="button"
                      onClick={() => {
                        setState(prev => ({
                          ...prev, category: cat,
                          demoId: null, demoRef: '', refInput: '', demoDate: '',
                          demoTime: '', demoType: '', guestOrganization: '', route: '', host: '',
                        }))
                        setRefResolved(false); setRefMatches([]); setRefError(null)
                      }}
                      className={`py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                        state.category === cat
                          ? 'border-[#4a8eab] bg-[#e1eff6] text-[#1e5f7a]'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-[#7ab1c5]'
                      }`}>
                      {cat === 'demo' ? 'Demo' : cat === 'recce' ? 'Recce' : 'BRT'}
                    </button>
                  ))}
                </div>
              </div>

              {/* GEO */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                  GEO <span className="text-red-400">*</span>
                </p>
                <div className="flex gap-2">
                  {GEO_OPTIONS.map(g => (
                    <button key={g} type="button"
                      onClick={() => {
                        // Clear everything GEO-dependent when GEO changes
                        setState(prev => ({
                          ...prev, geo: g,
                          demoId: null, demoRef: '', demoDate: '', demoTime: '',
                          demoType: '', guestOrganization: '', route: '', host: '',
                          operatorName: '', operatorEmail: '', vehicleId: '', modelName: '',
                        }))
                        setRefResolved(false); setRefMatches([]); setRefError(null)
                      }}
                      className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-all ${
                        state.geo === g
                          ? 'border-[#4a8eab] bg-[#e1eff6] text-[#1e5f7a]'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-[#7ab1c5]'
                      }`}>{g}</button>
                  ))}
                </div>
              </div>

              {/* Demo Reference (Demo / Recce) */}
              {state.category !== 'brt' && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                    Demo Reference <span className="text-red-400">*</span>
                  </p>
                  {!state.geo && (
                    <p className="text-xs text-gray-400 italic py-2">Select a GEO first</p>
                  )}
                  {state.geo && !refResolved && (
                    <>
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-gray-400 pointer-events-none">
                            {state.geo}-
                          </span>
                          <input
                            value={state.refInput.startsWith(state.geo + '-')
                              ? state.refInput.slice(state.geo.length + 1)
                              : state.refInput}
                            onChange={e => {
                              const v = e.target.value.toUpperCase()
                              set('refInput', v.match(/^\d{6}$/) ? v : (state.geo + '-' + v))
                              setRefError(null); setRefMatches([])
                            }}
                            onKeyDown={e => { if (e.key === 'Enter') void lookupRef() }}
                            placeholder="260704 or 260704-01"
                            className={`w-full pl-10 pr-3 py-3 text-sm font-mono border rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white transition-colors ${
                              refError ? 'border-red-300' : 'border-gray-200'
                            }`}
                          />
                        </div>
                        <button type="button" onClick={() => void lookupRef()}
                          disabled={!state.refInput.trim() || refLoading}
                          className="px-4 py-3 rounded-xl bg-[#4a8eab] text-white text-sm font-semibold hover:bg-[#3a7a97] disabled:opacity-40 flex items-center gap-1.5 transition-colors">
                          {refLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                          Find
                        </button>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1.5 ml-1">
                        Type date code (e.g. <span className="font-mono">260704</span>) or full ref (e.g. <span className="font-mono">JP-260704-01</span>)
                      </p>
                      {refError && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">
                          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                          {refError}
                        </div>
                      )}
                      {refMatches.length > 0 && (
                        <div className="mt-2 border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                          <p className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-100">
                            {refMatches.length} demos found — select one
                          </p>
                          {refMatches.map(m => (
                            <button key={m.id} type="button" onClick={() => applyMatch(m)}
                              className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-50 text-left border-b border-gray-50 last:border-0 transition-colors">
                              <span className="text-sm font-mono font-semibold text-gray-900">{m.demo_ref}</span>
                              <div className="text-right">
                                <p className="text-xs text-gray-600">{m.guests_organization || '—'}</p>
                                <p className="text-[11px] text-gray-400">{m.demo_start_time || '—'}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  {refResolved && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-[#4a8eab] flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                          <span className="text-sm font-mono font-semibold text-gray-900">{state.demoRef}</span>
                        </div>
                        <button type="button" onClick={clearRef}
                          className="text-xs text-gray-400 hover:text-red-500 underline">Change</button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <InfoCard label="GEO"          value={state.geo} />
                        <InfoCard label="Date"         value={state.demoDate} />
                        <InfoCard label="Time"         value={state.demoTime} />
                        <InfoCard label="Type"         value={state.demoType} />
                        <InfoCard label="Organisation" value={state.guestOrganization} />
                        <InfoCard label="Route"        value={state.route} />
                        {state.host && <InfoCard label="Host" value={state.host} />}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* BRT demo ref (optional) */}
              {state.category === 'brt' && state.geo && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                    Demo Reference <span className="text-gray-300">(optional)</span>
                  </p>
                  <input
                    value={state.demoRef}
                    onChange={e => setState(prev => ({ ...prev, demoRef: e.target.value.toUpperCase() }))}
                    placeholder="JP-260704-01 (optional)"
                    className="w-full px-4 py-3 text-sm font-mono border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
                  />
                </div>
              )}

              {/* Operator */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                  Operator <span className="text-red-400">*</span>
                </p>
                {!state.geo ? <GeoFirst field="operators" /> : (
                  <ComboSelect
                    key={`op-${state.geo}`}
                    value={state.operatorName}
                    onChange={v => {
                      const op = operators.find(o => o.full_name === v)
                      setState(prev => ({ ...prev, operatorName: v, operatorEmail: op?.email ?? '' }))
                    }}
                    options={operators.map(op => ({ value: op.full_name, label: op.full_name, sub: op.email }))}
                    placeholder="Select operator…"
                    loading={opsLoading}
                    loadingText="Loading operators…"
                    emptyText={`No operators found for ${state.geo}`}
                    manualPlaceholder="Operator name"
                  />
                )}
              </div>

              {/* Route */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                  Route <span className="text-red-400">*</span>
                  {refResolved && state.route && (
                    <span className="ml-2 text-[10px] font-normal text-[#4a8eab] normal-case tracking-normal">auto-filled — editable</span>
                  )}
                </label>
                {!state.geo ? <GeoFirst field="routes" /> : (
                  <ComboSelect
                    key={`rt-${state.geo}`}
                    value={state.route}
                    onChange={v => set('route', v)}
                    options={routes.map(r => ({ value: r.route_name, label: r.route_name }))}
                    placeholder="Select route…"
                    loading={routesLoading}
                    loadingText="Loading routes…"
                    emptyText={`No routes found for ${state.geo}`}
                    manualPlaceholder="e.g. Otemachi30min, Kings Road"
                  />
                )}
              </div>

              {/* Vehicle ID */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                  Vehicle ID <span className="text-red-400">*</span>
                </label>
                {!state.geo ? <GeoFirst field="vehicles" /> : (
                  <ComboSelect
                    key={`veh-${state.geo}`}
                    value={state.vehicleId}
                    onChange={v => set('vehicleId', v)}
                    options={vehicles.map(v => ({ value: v.vehicle_id, label: v.vehicle_id, sub: v.vehicle_type }))}
                    placeholder="Select vehicle…"
                    loading={vehiclesLoading}
                    loadingText="Loading vehicles…"
                    emptyText={`No vehicles found for ${state.geo}`}
                    manualPlaceholder="e.g. KU-W01"
                  />
                )}
              </div>
            </>
          )}

          {/* ═════ STEP 2 ═════ */}
          {step === 2 && (
            <>
              {/* Model Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                  Model Name <span className="text-red-400">*</span>
                </label>
                {!state.geo ? (
                  <input value={state.modelName} onChange={e => set('modelName', e.target.value)}
                    placeholder="e.g. jade-dancing-firefly"
                    className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white" />
                ) : (
                  <ComboSelect
                    key={`mdl-${state.geo}`}
                    value={state.modelName}
                    onChange={v => set('modelName', v)}
                    options={models.map(m => ({ value: m.model_name, label: m.model_name, sub: m.platform }))}
                    placeholder="Select model…"
                    loading={modelsLoading}
                    loadingText="Loading models…"
                    emptyText={`No models found for ${state.geo}`}
                    manualPlaceholder="e.g. jade-dancing-firefly"
                  />
                )}
              </div>

              {/* Behaviours */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                  Model Behaviours
                  {state.behaviours.length > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 rounded-full bg-[#4a8eab] text-white text-[10px] font-bold">
                      {state.behaviours.length}
                    </span>
                  )}
                </p>
                <div className="space-y-2">
                  {BEHAVIOUR_GROUPS.map(g => (
                    <BehaviourGroup key={g.id} group={g} selected={state.behaviours}
                      onToggle={item => {
                        const next = state.behaviours.includes(item)
                          ? state.behaviours.filter(b => b !== item)
                          : [...state.behaviours, item]
                        set('behaviours', next)
                      }} />
                  ))}
                </div>
              </div>

              {/* ── Model Ratings — premium card ── */}
              <div className="rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Model Ratings</p>
                    {state.category === 'brt'
                      ? <span className="text-[10px] font-semibold text-red-500 uppercase tracking-wide">Required</span>
                      : <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Optional</span>
                    }
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">Drag each slider to rate 1–10</p>
                </div>

                <div className="bg-white divide-y divide-gray-100">
                  {(
                    [
                      { key: 'safetyScore',        label: 'Safety' },
                      { key: 'comfortScore',        label: 'Comfort' },
                      { key: 'decisivenessScore',   label: 'Decisiveness' },
                      { key: 'aggressivenessScore', label: 'Aggressiveness' },
                    ] as const
                  ).map(({ key, label }) => (
                    <div key={key} className="px-5 py-4">
                      <PremiumRatingSlider
                        label={label}
                        value={state[key]}
                        onChange={v => set(key, v)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Driving Features */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Driving Features</p>
                <div className="flex flex-wrap gap-2">
                  {DRIVING_FEATURES_LIST.map(f => (
                    <Chip key={f} label={f} selected={state.drivingFeatures.includes(f)}
                      onClick={() => {
                        const next = state.drivingFeatures.includes(f)
                          ? state.drivingFeatures.filter(x => x !== f)
                          : [...state.drivingFeatures, f]
                        set('drivingFeatures', next)
                      }} />
                  ))}
                </div>
              </div>

              {/* Demo Issues */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Demo Issues</p>
                <div className="flex flex-wrap gap-2">
                  {DEMO_ISSUES_LIST.map(issue => (
                    <Chip key={issue} label={issue} selected={state.demoIssues.includes(issue)}
                      onClick={() => {
                        const next = state.demoIssues.includes(issue)
                          ? state.demoIssues.filter(x => x !== issue)
                          : [...state.demoIssues, issue]
                        set('demoIssues', next)
                      }} />
                  ))}
                </div>
              </div>

              {/* Power Cycle + UDs */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Power Cycle Required</p>
                  <div className="flex gap-2">
                    {([false, true] as const).map(v => (
                      <button key={String(v)} type="button"
                        onClick={() => setState(prev => ({ ...prev, powerCycle: v, powerCycleReason: v ? prev.powerCycleReason : '' }))}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border-2 transition-all ${
                          state.powerCycle === v
                            ? 'border-[#4a8eab] bg-[#e1eff6] text-[#1e5f7a]'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-[#7ab1c5]'
                        }`}>{v ? 'Yes' : 'No'}</button>
                    ))}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">UDs</p>
                  <Stepper value={state.numberOfUds} onChange={v => set('numberOfUds', v)} />
                </div>
              </div>

              {state.powerCycle && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                    Reason for Power Cycle <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={state.powerCycleReason}
                    onChange={e => set('powerCycleReason', e.target.value)}
                    placeholder="e.g. GPS issue, RCM reset, failed model download, vehicle fault"
                    className={`w-full px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#c4e1ec] bg-white transition-colors ${
                      !state.powerCycleReason.trim() ? 'border-red-200 bg-red-50/30' : 'border-[#c4e1ec]'
                    }`}
                  />
                  {!state.powerCycleReason.trim() && (
                    <p className="text-xs text-red-500 mt-1 ml-1">Required when power cycle occurred</p>
                  )}
                </div>
              )}

              {/* Interventions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Interventions</p>
                  {totalInterventions > 0 && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                      {totalInterventions} total
                    </span>
                  )}
                </div>
                <InterventionList
                  interventions={state.interventions}
                  onChange={(k, v) => setState(p => ({
                    ...p,
                    interventions: v === 0
                      ? Object.fromEntries(Object.entries(p.interventions).filter(([ek]) => ek !== k))
                      : { ...p.interventions, [k]: v },
                    interventionSC: v === 0
                      ? Object.fromEntries(Object.entries(p.interventionSC).filter(([ek]) => ek !== k))
                      : p.interventionSC,
                  }))}
                  interventionSC={state.interventionSC}
                  onSCChange={(k, sc) => setState(p => ({
                    ...p,
                    interventionSC: sc
                      ? { ...p.interventionSC, [k]: true }
                      : Object.fromEntries(Object.entries(p.interventionSC).filter(([ek]) => ek !== k)),
                  }))}
                />
              </div>

              {/* Safety Critical */}
              <div
                className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  state.safetyCritical ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
                onClick={() => set('safetyCritical', !state.safetyCritical)}
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  state.safetyCritical ? 'border-red-500 bg-red-500' : 'border-gray-300'
                }`}>
                  {state.safetyCritical && <Check className="w-3 h-3 text-white" />}
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-semibold ${state.safetyCritical ? 'text-red-700' : 'text-gray-700'}`}>Safety Critical Event</p>
                  <p className="text-xs text-gray-400">Flag if a safety-critical incident occurred</p>
                </div>
                {state.safetyCritical && <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />}
              </div>

              {/* Smoothness */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Overall Smoothness</p>
                <StarRating value={state.smoothnessScore} onChange={v => set('smoothnessScore', v)} />
                {state.smoothnessScore > 0 && (
                  <p className="text-xs text-gray-400 mt-1.5 ml-1">
                    {['', 'Very rough', 'Rough', 'Average', 'Smooth', 'Excellent'][state.smoothnessScore]}
                  </p>
                )}
              </div>
            </>
          )}

          {/* ═════ STEP 3 — REVIEW ═════ */}
          {step === 3 && (
            <>
              <p className="text-xs text-gray-400 text-center">Review before submitting.</p>

              <PreviewSection title="Run Context">
                <PreviewRow label="Category"     value={state.category === 'demo' ? 'Demo' : state.category === 'recce' ? 'Recce' : 'BRT'} />
                <PreviewRow label="Operator"     value={state.operatorName} />
                <PreviewRow label="Demo Ref"     value={state.demoRef || null} />
                <PreviewRow label="GEO"          value={state.geo} />
                <PreviewRow label="Date"         value={state.demoDate} />
                <PreviewRow label="Time"         value={state.demoTime} />
                <PreviewRow label="Type"         value={state.demoType} />
                <PreviewRow label="Organisation" value={state.guestOrganization} />
                <PreviewRow label="Route"        value={state.route} />
                <PreviewRow label="Vehicle ID"   value={state.vehicleId} />
              </PreviewSection>

              <PreviewSection title="Model Performance">
                <PreviewRow label="Model Name" value={state.modelName} />
                <div className="flex justify-around py-3">
                  <ScorePip label="Safety"   value={state.safetyScore} />
                  <ScorePip label="Comfort"  value={state.comfortScore} />
                  <ScorePip label="Decisive" value={state.decisivenessScore} />
                  <ScorePip label="Aggress"  value={state.aggressivenessScore} />
                </div>
                {state.behaviours.length > 0 && (
                  <div className="flex flex-wrap gap-1 py-1">
                    {state.behaviours.map(b => (
                      <span key={b} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded font-medium">{b}</span>
                    ))}
                  </div>
                )}
              </PreviewSection>

              <PreviewSection title="Run Data">
                <PreviewRow label="UDs"                  value={state.numberOfUds > 0 ? String(state.numberOfUds) : null} />
                <PreviewRow label="Power Cycle Required" value={state.powerCycle ? 'Yes' : null} />
                {state.powerCycle && (
                  <PreviewRow label="Reason for Power Cycle" value={state.powerCycleReason || null} />
                )}
                <PreviewRow label="Smoothness"           value={state.smoothnessScore > 0 ? `${state.smoothnessScore}/5 ★` : null} />
                <PreviewRow label="Safety Critical"      value={state.safetyCritical ? '⚠ YES' : null} />
                {state.drivingFeatures.length > 0 && (
                  <div className="flex flex-wrap gap-1 py-1">
                    {state.drivingFeatures.map(f => (
                      <span key={f} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded font-medium">{f}</span>
                    ))}
                  </div>
                )}
                {state.demoIssues.length > 0 && (
                  <div className="flex flex-wrap gap-1 py-1">
                    {state.demoIssues.map(i => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded font-medium">{i}</span>
                    ))}
                  </div>
                )}
                {totalInterventions > 0 && (
                  <div className="mt-1.5 space-y-1">
                    {Object.entries(state.interventions).filter(([, v]) => v > 0).map(([k, v]) => (
                      <div key={k} className="flex justify-between items-center text-xs">
                        <span className="text-gray-600 flex items-center gap-1">
                          {k}
                          {state.interventionSC[k] && (
                            <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-red-100 text-red-600 text-[9px] font-bold">
                              <AlertTriangle className="w-2.5 h-2.5" />SC
                            </span>
                          )}
                        </span>
                        <span className="font-bold text-gray-900">{v}</span>
                      </div>
                    ))}
                  </div>
                )}
              </PreviewSection>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex-shrink-0 px-5 pb-5 pt-3 border-t border-gray-100 flex gap-3">
          {step > 1 && (
            <button type="button" onClick={() => { setStep(s => s - 1); scrollTop() }}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <ChevronLeft className="w-4 h-4" />Back
            </button>
          )}
          <div className="flex-1" />
          {step < 3 && (
            <button type="button"
              onClick={() => { setStep(s => s + 1); scrollTop() }}
              disabled={step === 1 ? !step1Valid : !step2Valid}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#4a8eab] text-white text-sm font-semibold hover:bg-[#3a7a97] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              Continue<ChevronRight className="w-4 h-4" />
            </button>
          )}
          {step === 3 && (
            <button type="button" onClick={() => void handleSubmit()} disabled={saving}
              className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-[#4a8eab] text-white text-sm font-bold hover:bg-[#3a7a97] disabled:opacity-50 transition-colors">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? 'Submitting…' : 'Submit'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
