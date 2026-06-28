import { useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Check, ChevronLeft, ChevronRight, Send, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Textarea } from '../../lib/shadcn/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../lib/shadcn/select'
import { useSubmitDemoRequest } from '../../hooks/backend/demoRequests'
import {
  getTypeConfig, DEMO_TYPE_CONFIGS,
  VEHICLE_TYPE_OPTIONS, PLATFORM_OPTIONS, FEATURE_TYPE_OPTIONS,
} from './data/demoTypeConfig'

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Details',   sub: 'Type & guests' },
  { id: 2, label: 'Resources', sub: 'Vehicles & host' },
  { id: 3, label: 'Location',  sub: 'Where & notes' },
  { id: 4, label: 'Review',    sub: 'Confirm & submit' },
] as const

const GEO_BUTTONS = ['UK', 'US', 'JP', 'DE'] as const

const COMMON_LOCATIONS: Record<string, string[]> = {
  UK: ["King's Cross, London", 'Shoreditch, London', 'Canary Wharf, London', 'Oxford Street, London'],
  US: ['Pier 39, San Francisco', 'Times Square, New York', 'Venice Beach, LA', 'Downtown Chicago'],
  JP: ['Shinjuku, Tokyo', 'Shibuya, Tokyo', 'Akihabara, Tokyo', 'Osaka Station'],
  DE: ['Alexanderplatz, Berlin', 'Marienplatz, Munich', 'Zeil, Frankfurt', 'Hamburg Harbour'],
}

interface Host { initials: string; name: string; email: string; color: string }

const MOCK_HOSTS: Host[] = [
  { initials: 'AR', name: 'Aisha Rahman', email: 'aisha.rahman@wayve.ai',  color: '#7C3AED' },
  { initials: 'DL', name: 'Derek Liu',    email: 'derek.liu@wayve.ai',     color: '#6366F1' },
  { initials: 'JK', name: 'James Kim',    email: 'james.kim@wayve.ai',     color: '#0891B2' },
  { initials: 'SW', name: 'Sarah Wong',   email: 'sarah.wong@wayve.ai',    color: '#059669' },
]

// ─── Form state ───────────────────────────────────────────────────────────────

interface WizardState {
  demo_type:           string
  geo:                 string
  date_of_demo:        string
  demo_start_time:     string
  demo_end_time:       string
  guests_organization: string
  total_guests:        string
  requester:           string
  vehicle_type:        string
  platform:            string
  total_vehicles:      number
  host_name:           string
  host_email:          string
  start_location:      string
  route_type:          string
  feature_type:        string
  description:         string
}

const EMPTY: WizardState = {
  demo_type: '', geo: '',
  date_of_demo: '', demo_start_time: '', demo_end_time: '',
  guests_organization: '', total_guests: '1', requester: '',
  vehicle_type: '', platform: '', total_vehicles: 1,
  host_name: '', host_email: '',
  start_location: '', route_type: '', feature_type: '', description: '',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtReviewDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepBar({ current }: { current: number }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex items-center px-4 py-3.5 overflow-x-auto gap-0">
      {STEPS.map((step, idx) => {
        const done   = current > step.id
        const active = current === step.id
        return (
          <div key={step.id} className="flex items-center flex-1 min-w-0">
            {/* Step box */}
            <div className={[
              'flex items-center gap-2.5 px-3 py-2 rounded-xl border-2 transition-all flex-1',
              done   ? 'border-green-400 bg-green-50/70'     : '',
              active ? 'border-[#3B5BDB] bg-[#EEF2FF]'      : '',
              !done && !active ? 'border-gray-200 bg-white' : '',
            ].join(' ')}>
              {/* Circle */}
              <div className={[
                'w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold flex-shrink-0 transition-all',
                done   ? 'bg-green-500 text-white'           : '',
                active ? 'bg-[#3B5BDB] text-white'           : '',
                !done && !active ? 'bg-gray-100 text-gray-400' : '',
              ].join(' ')}>
                {done ? <Check className="w-4 h-4 stroke-[3]" /> : step.id}
              </div>
              {/* Labels */}
              <div className="min-w-0">
                <p className={[
                  'text-[12px] font-bold leading-none truncate',
                  done ? 'text-green-700' : active ? 'text-[#3B5BDB]' : 'text-gray-400',
                ].join(' ')}>
                  {step.label}
                </p>
                <p className={[
                  'text-[10px] mt-0.5 leading-none truncate',
                  done ? 'text-green-500' : active ? 'text-[#3B5BDB]/70' : 'text-gray-400',
                ].join(' ')}>
                  {step.sub}
                </p>
              </div>
            </div>
            {/* Connector */}
            {idx < STEPS.length - 1 && (
              <div className={[
                'flex-shrink-0 h-0.5 mx-1.5 transition-colors',
                done ? 'bg-green-300' : 'bg-gray-200',
              ].join(' ')} style={{ width: 20 }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Section title ────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-gray-400 mb-6">
      {children}
    </p>
  )
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({ label, required, error, children }: {
  label: string; required?: boolean; error?: string; children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-[13px] font-semibold text-gray-900 mb-2">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />{error}
        </p>
      )}
    </div>
  )
}

// ─── Styled input ─────────────────────────────────────────────────────────────

function StyledInput({ value, onChange, type = 'text', placeholder, hasError }: {
  value: string; onChange: (v: string) => void
  type?: string; placeholder?: string; hasError?: boolean
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={[
        'w-full px-4 py-3 text-sm rounded-xl border-2 bg-white transition-colors',
        'focus:outline-none focus:border-[#3B5BDB]',
        hasError ? 'border-red-400' : 'border-gray-200 hover:border-gray-300',
      ].join(' ')}
    />
  )
}

// ─── GEO toggle pills ─────────────────────────────────────────────────────────

function GeoToggle({ value, onChange, error }: {
  value: string; onChange: (v: string) => void; error?: string
}) {
  return (
    <div>
      <label className="block text-[13px] font-semibold text-gray-900 mb-2">
        Geographic Region (GEO) <span className="text-red-500">*</span>
      </label>
      <div className="grid grid-cols-4 gap-3">
        {GEO_BUTTONS.map(geo => (
          <button
            key={geo}
            type="button"
            onClick={() => onChange(geo)}
            className={[
              'py-3 rounded-xl border-2 text-sm font-bold transition-all',
              value === geo
                ? 'border-green-500 bg-green-50 text-green-700'
                : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700',
            ].join(' ')}
          >
            {geo}
          </button>
        ))}
      </div>
      {error && (
        <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />{error}
        </p>
      )}
    </div>
  )
}

// ─── Number stepper ──────────────────────────────────────────────────────────

function Stepper({ value, onChange }: {
  value: number; onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-4">
      <button type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700 text-lg font-bold transition-colors select-none">
        −
      </button>
      <span className="text-xl font-bold text-gray-900 w-6 text-center tabular-nums">{value}</span>
      <button type="button"
        onClick={() => onChange(value + 1)}
        className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700 text-lg font-bold transition-colors select-none">
        +
      </button>
    </div>
  )
}

// ─── Host cards ───────────────────────────────────────────────────────────────

function HostList({ selected, onSelect }: {
  selected: string; onSelect: (h: Host) => void
}) {
  return (
    <div className="space-y-2.5">
      {MOCK_HOSTS.map(h => (
        <button
          key={h.email}
          type="button"
          onClick={() => onSelect(h)}
          className={[
            'w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 text-left transition-all',
            selected === h.name
              ? 'border-[#3B5BDB] bg-blue-50/40'
              : 'border-gray-200 bg-white hover:border-gray-300',
          ].join(' ')}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            style={{ backgroundColor: h.color }}
          >
            {h.initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 leading-none">{h.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{h.email}</p>
          </div>
        </button>
      ))}
      <p className="text-xs text-gray-400 pt-1">Select an available host for this time slot</p>
    </div>
  )
}

// ─── Location chips ───────────────────────────────────────────────────────────

function LocationChips({ geo, selected, onSelect }: {
  geo: string; selected: string; onSelect: (loc: string) => void
}) {
  const locs = COMMON_LOCATIONS[geo] ?? []
  if (!locs.length) return null
  return (
    <div>
      <p className="text-xs text-gray-400 mb-2">Common locations for {geo}</p>
      <div className="flex flex-wrap gap-2">
        {locs.map(loc => (
          <button
            key={loc}
            type="button"
            onClick={() => onSelect(loc)}
            className={[
              'px-3 py-1.5 rounded-full border text-xs font-medium transition-all',
              selected === loc
                ? 'border-[#3B5BDB] text-[#3B5BDB] bg-blue-50'
                : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-white',
            ].join(' ')}
          >
            {loc}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Review card ──────────────────────────────────────────────────────────────

function ReviewCard({ icon, title, primary, secondary, badge }: {
  icon: string; title: string; primary: string; secondary?: string; badge?: string
}) {
  return (
    <div className="flex items-start gap-3 bg-white border border-gray-150 rounded-2xl p-4"
      style={{ borderColor: '#E5E7EB' }}>
      <span className="text-2xl flex-shrink-0 mt-0.5 leading-none">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-gray-400 mb-1">{title}</p>
        <p className="text-[15px] font-bold text-gray-900 leading-snug">{primary || '—'}</p>
        {badge && (
          <span className="inline-block mt-1.5 px-2.5 py-0.5 rounded-full border border-gray-300 text-[11px] font-semibold text-gray-600">
            {badge}
          </span>
        )}
        {secondary && !badge && (
          <p className="text-xs text-gray-500 mt-0.5">{secondary}</p>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RequestForm() {
  const { type: slug }                    = useParams<{ type: string }>()
  const navigate                          = useNavigate()
  const cfg                               = useMemo(() => getTypeConfig(slug ?? ''), [slug])
  const { trigger: submit, loading }      = useSubmitDemoRequest()

  const [step,   setStep]   = useState(1)
  const [state,  setState]  = useState<WizardState>(() => ({
    ...EMPTY,
    demo_type: cfg?.label ?? '',
  }))
  const [errors, setErrors] = useState<Partial<Record<keyof WizardState, string>>>({})

  if (!cfg) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-gray-400">
        <AlertCircle className="w-8 h-8" />
        <p className="text-sm">Unknown demo type: <strong>{slug}</strong></p>
        <button onClick={() => navigate('..')} className="text-sm text-blue-600 underline">Go Back</button>
      </div>
    )
  }

  const set = <K extends keyof WizardState>(key: K, val: WizardState[K]) => {
    setState(prev => ({ ...prev, [key]: val }))
    if (errors[key]) setErrors(prev => { const n = { ...prev }; delete n[key]; return n })
  }

  // ── Validation ─────────────────────────────────────────────────────────────
  function validateStep(s: number): boolean {
    const e: Partial<Record<keyof WizardState, string>> = {}
    if (s === 1) {
      if (!state.demo_type)       e.demo_type       = 'Demo type is required'
      if (!state.geo)             e.geo             = 'Please select a region'
      if (!state.date_of_demo)    e.date_of_demo    = 'Demo date is required'
      if (!state.demo_start_time) e.demo_start_time = 'Start time is required'
      if (!state.demo_end_time)   e.demo_end_time   = 'End time is required'
      if (state.demo_start_time && state.demo_end_time && state.demo_start_time >= state.demo_end_time)
        e.demo_end_time = 'End time must be after start time'
    }
    if (s === 2) {
      if (!state.vehicle_type) e.vehicle_type = 'Vehicle type is required'
      if (!state.host_name)    e.host_name    = 'Please select a host'
    }
    if (s === 3) {
      if (!state.start_location) e.start_location = 'Start location is required'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function next() { if (validateStep(step)) setStep(s => Math.min(s + 1, 4)) }
  function back() { setErrors({}); setStep(s => Math.max(s - 1, 1)) }

  async function handleSubmit() {
    try {
      await submit({
        type:                state.demo_type,
        geo:                 state.geo,
        date_of_demo:        state.date_of_demo,
        demo_start_time:     state.demo_start_time,
        demo_end_time:       state.demo_end_time,
        requester:           state.requester,
        guests_organization: state.guests_organization,
        total_guests:        state.total_guests,
        vehicle_type:        state.vehicle_type,
        platform:            state.platform,
        total_vehicles:      String(state.total_vehicles),
        host:                state.host_name,
        start_location:      state.start_location,
        route_type:          state.route_type,
        feature_type:        state.feature_type,
        description:         state.description,
      })
      toast.success('Demo request submitted!', {
        description: `Your ${state.demo_type} request has been sent for review.`,
      })
      navigate('..')
    } catch {
      toast.error('Submission failed', { description: 'Please try again.' })
    }
  }

  const geoLead = state.geo ? `${state.geo} Demo Lead` : 'your Demo Lead'
  const vehiclePlatformStr = [state.platform, `x${state.total_vehicles}`].filter(Boolean).join(' · ')

  return (
    <div className="min-h-full bg-gray-50 overflow-y-auto">
      <div className="w-full max-w-[760px] mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">
        {/* Stepper — same width as card */}
        <StepBar current={step} />

          {/* ══ Step 1: Details ══════════════════════════════════════════════ */}
          {step === 1 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-7">
              <SectionTitle>Request Details</SectionTitle>
              <div className="space-y-6">

                {/* Demo Type + Number of Guests */}
                <div className="grid grid-cols-2 gap-5">
                  <Field label="Demo Type" required error={errors.demo_type}>
                    <Select value={state.demo_type} onValueChange={v => set('demo_type', v)}>
                      <SelectTrigger className={[
                        'h-12 text-sm rounded-xl border-2 px-4',
                        errors.demo_type ? 'border-red-400' : 'border-gray-200',
                      ].join(' ')}>
                        <SelectValue placeholder="Select demo type…" />
                      </SelectTrigger>
                      <SelectContent>
                        {DEMO_TYPE_CONFIGS.map(c => (
                          <SelectItem key={c.slug} value={c.label}>{c.label} Demo</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Number of Guests" error={errors.total_guests}>
                    <StyledInput type="number" value={state.total_guests}
                      onChange={v => set('total_guests', v)}
                      placeholder="e.g. 4" />
                  </Field>
                </div>

                {/* Guest / Organisation */}
                <Field label="Guest / Organisation" error={errors.guests_organization}>
                  <StyledInput value={state.guests_organization}
                    onChange={v => set('guests_organization', v)}
                    placeholder="e.g. Acme Corp" />
                </Field>

                {/* Requester */}
                <Field label="Your Name" required error={errors.requester}>
                  <StyledInput value={state.requester}
                    onChange={v => set('requester', v)}
                    placeholder="e.g. Oliver Mugiraneza"
                    hasError={!!errors.requester} />
                </Field>

                {/* GEO toggle */}
                <GeoToggle value={state.geo} onChange={v => set('geo', v)} error={errors.geo} />

                {/* Date */}
                <Field label="Date of Demo" required error={errors.date_of_demo}>
                  <StyledInput type="date" value={state.date_of_demo}
                    onChange={v => set('date_of_demo', v)} hasError={!!errors.date_of_demo} />
                </Field>

                {/* Start + End time */}
                <div className="grid grid-cols-2 gap-5">
                  <Field label="Start Time" required error={errors.demo_start_time}>
                    <StyledInput type="time" value={state.demo_start_time}
                      onChange={v => set('demo_start_time', v)} hasError={!!errors.demo_start_time} />
                  </Field>
                  <Field label="End Time" required error={errors.demo_end_time}>
                    <StyledInput type="time" value={state.demo_end_time}
                      onChange={v => set('demo_end_time', v)} hasError={!!errors.demo_end_time} />
                  </Field>
                </div>
              </div>
            </div>
          )}

          {/* ══ Step 2: Resources ════════════════════════════════════════════ */}
          {step === 2 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-7">
              <SectionTitle>Vehicles & Host</SectionTitle>
              <div className="space-y-6">

                {/* Vehicle + Platform */}
                <div className="grid grid-cols-2 gap-5">
                  <Field label="Vehicle Type" required error={errors.vehicle_type}>
                    <Select value={state.vehicle_type} onValueChange={v => set('vehicle_type', v)}>
                      <SelectTrigger className={[
                        'h-12 text-sm rounded-xl border-2 px-4',
                        errors.vehicle_type ? 'border-red-400' : 'border-gray-200',
                      ].join(' ')}>
                        <SelectValue placeholder="Select vehicle…" />
                      </SelectTrigger>
                      <SelectContent>
                        {VEHICLE_TYPE_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Platform" required>
                    <Select value={state.platform} onValueChange={v => set('platform', v)}>
                      <SelectTrigger className="h-12 text-sm rounded-xl border-2 border-gray-200 px-4">
                        <SelectValue placeholder="Select platform…" />
                      </SelectTrigger>
                      <SelectContent>
                        {PLATFORM_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                {/* Vehicle Count */}
                <Field label="Vehicle Count" required>
                  <Stepper value={state.total_vehicles}
                    onChange={v => set('total_vehicles', v)} />
                </Field>

                {/* Host Preference */}
                <Field label="Host Preference" error={errors.host_name}>
                  <div className="mt-1">
                    <HostList
                      selected={state.host_name}
                      onSelect={h => { set('host_name', h.name); set('host_email', h.email) }}
                    />
                    {errors.host_name && (
                      <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />{errors.host_name}
                      </p>
                    )}
                  </div>
                </Field>
              </div>
            </div>
          )}

          {/* ══ Step 3: Location ════════════════════════════════════════════ */}
          {step === 3 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-7">
              <SectionTitle>Location & Requirements</SectionTitle>
              <div className="space-y-6">

                {/* Start location */}
                <Field label="Start Location" required error={errors.start_location}>
                  <StyledInput value={state.start_location}
                    onChange={v => set('start_location', v)}
                    placeholder="e.g. King's Cross, London"
                    hasError={!!errors.start_location} />
                </Field>

                {/* Common locations chips */}
                {state.geo && (
                  <LocationChips
                    geo={state.geo}
                    selected={state.start_location}
                    onSelect={loc => set('start_location', loc)}
                  />
                )}

                {/* Special Requirements */}
                <Field label="Special Requirements">
                  <Textarea
                    value={state.description}
                    onChange={e => set('description', e.target.value)}
                    placeholder="Make sure you start at the lobby of the Hotel…"
                    className="text-sm min-h-[120px] resize-none rounded-xl border-2 border-gray-200 focus:border-[#3B5BDB] focus:ring-0 px-4 py-3"
                    rows={5}
                  />
                  <p className="mt-1.5 text-xs text-gray-400">
                    Safety briefings, photography rules, accessibility needs, language requirements, etc.
                  </p>
                </Field>
              </div>
            </div>
          )}

          {/* ══ Step 4: Review ══════════════════════════════════════════════ */}
          {step === 4 && (
            <div className="space-y-4">
              {/* Header */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-7 pt-7 pb-5">
                <SectionTitle>Review & Submit</SectionTitle>

                {/* Summary cards */}
                <div className="grid grid-cols-2 gap-3">
                  <ReviewCard
                    icon="🗂️"
                    title="Demo Type"
                    primary={`${state.demo_type} Demo`}
                  />
                  <ReviewCard
                    icon="📍"
                    title="GEO"
                    primary={state.geo}
                    secondary={state.start_location || undefined}
                  />
                  <ReviewCard
                    icon="📅"
                    title="Date"
                    primary={fmtReviewDate(state.date_of_demo)}
                    secondary={
                      state.demo_start_time && state.demo_end_time
                        ? `${state.demo_start_time} – ${state.demo_end_time}`
                        : undefined
                    }
                  />
                  <ReviewCard
                    icon="👥"
                    title="Guests"
                    primary={`${state.total_guests || '—'} guest${Number(state.total_guests) !== 1 ? 's' : ''}`}
                    secondary={state.guests_organization || state.requester || undefined}
                  />
                  <ReviewCard
                    icon="🚗"
                    title="Vehicle"
                    primary={state.vehicle_type}
                    secondary={vehiclePlatformStr || undefined}
                  />
                  <ReviewCard
                    icon="🎯"
                    title="Host"
                    primary={state.host_name || 'TBD'}
                    secondary={state.host_email || undefined}
                  />
                </div>
              </div>

              {/* Conflict check */}
              <div className="flex items-center gap-2.5 px-5 py-3.5 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm font-medium">
                <Check className="w-4 h-4 flex-shrink-0 stroke-[2.5]" />
                No scheduling conflicts detected. Ready to submit.
              </div>

              {/* Stakeholder notes */}
              {state.description && (
                <div className="bg-white border border-gray-200 rounded-xl px-5 py-4">
                  <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-gray-400 mb-2">
                    Stakeholder Notes
                  </p>
                  <p className="text-sm text-gray-700">{state.description}</p>
                </div>
              )}

              {/* Info notice */}
              <div className="px-5 py-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
                Submitting this request will notify the{' '}
                <strong className="font-bold">{geoLead}</strong> for review and approval.
              </div>
            </div>
          )}

        {/* ── Footer — same width as card, inside the centered container ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 flex items-center justify-between">
          {/* Progress dots */}
          <div className="flex items-center gap-1.5">
            {STEPS.map(s => (
              <div key={s.id} className={[
                'rounded-full transition-all duration-300',
                s.id === step ? 'w-7 h-2.5 bg-[#3B5BDB]' :
                s.id < step   ? 'w-2.5 h-2.5 bg-[#3B5BDB]' :
                                'w-2.5 h-2.5 bg-gray-200',
              ].join(' ')} />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-3">
            {step > 1 && (
              <button type="button" onClick={back}
                className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold text-gray-700
                           border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            )}
            {step < 4 ? (
              <button type="button" onClick={next}
                className="flex items-center gap-1.5 px-6 py-2.5 text-sm font-bold text-white
                           bg-[#3B5BDB] hover:bg-[#2F4AC4] rounded-xl transition-colors shadow-sm">
                Continue
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button type="button" onClick={handleSubmit} disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white
                           bg-[#2B7A4B] hover:bg-[#236040] rounded-xl transition-colors shadow-sm disabled:opacity-60">
                {loading
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><Send className="w-4 h-4" /> Submit Request <Check className="w-4 h-4" /></>}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
