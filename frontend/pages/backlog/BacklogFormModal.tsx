import { useState } from 'react'
import type { BacklogItem, BacklogStatus } from './types'
import { BACKLOG_STATUSES } from './types'
import { X, Plus } from 'lucide-react'
import { DEMO_TYPES } from '../../lib/constants/demoTypes'
import { CalendarDropdown, TimeDropdown } from './BacklogPickers'

interface BacklogFormModalProps {
  open:           boolean
  defaultStatus?: BacklogStatus
  prefill?:       Partial<BacklogItem>
  onClose:        () => void
  onSubmit:       (data: Partial<BacklogItem>) => Promise<void>
}

const GEO_OPTIONS      = ['JP', 'UK', 'US', 'DE']
const TYPE_OPTIONS     = [...DEMO_TYPES]
const PRIORITY_OPTIONS = ['P0', 'P1', 'P2']

const EMPTY: Partial<BacklogItem> = {
  status: 'Proposed', company: '', customer: '', requestor: '',
  host: '', geo: '', demo_type: '', priority: 'P2',
  preferred_demo_date: '', preferred_time: '', demo_purpose: '',
  vehicle: '', notes: '',
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export default function BacklogFormModal({
  open, defaultStatus, prefill, onClose, onSubmit,
}: BacklogFormModalProps) {
  const [form, setForm] = useState<Partial<BacklogItem>>(() => ({
    ...EMPTY,
    status: defaultStatus ?? 'Proposed',
    ...prefill,
    id: undefined,
    created_at: undefined,
    updated_at: undefined,
    converted_at: undefined,
    converted_demo_id: undefined,
  }))
  const [saving, setSaving] = useState(false)

  if (!open) return null

  const set = (key: keyof BacklogItem) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value || null }))

  const setVal = (key: keyof BacklogItem, value: string) =>
    setForm(f => ({ ...f, [key]: value || null }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.company?.trim()) { alert('Company is required'); return }
    setSaving(true)
    try {
      await onSubmit(form)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const Label = ({ text, required }: { text: string; required?: boolean }) => (
    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
      {text}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  )

  const inputCls = 'w-full h-9 px-3 text-sm text-gray-800 bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-colors'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden mx-4">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              {prefill ? 'Duplicate Backlog Item' : 'New Backlog Item'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Only Company is required — fill in what you know</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Status + Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label text="Status" />
              <select className={inputCls} value={form.status ?? 'Proposed'} onChange={set('status')}>
                {BACKLOG_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <Label text="Priority" />
              <select className={inputCls} value={form.priority ?? 'P2'} onChange={set('priority')}>
                <option value="">—</option>
                {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Company + Customer */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label text="Company" required />
              <input className={inputCls} type="text" placeholder="e.g. Toyota" value={form.company ?? ''} onChange={set('company')} />
            </div>
            <div>
              <Label text="Customer / Contact" />
              <input className={inputCls} type="text" placeholder="Name or role" value={form.customer ?? ''} onChange={set('customer')} />
            </div>
          </div>

          {/* Requestor + Host */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label text="Requestor" />
              <input className={inputCls} type="text" placeholder="Who requested this" value={form.requestor ?? ''} onChange={set('requestor')} />
            </div>
            <div>
              <Label text="Host" />
              <input className={inputCls} type="text" placeholder="Demo host" value={form.host ?? ''} onChange={set('host')} />
            </div>
          </div>

          {/* GEO + Demo Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label text="GEO" />
              <select className={inputCls} value={form.geo ?? ''} onChange={set('geo')}>
                <option value="">— Select —</option>
                {GEO_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <Label text="Demo Type" />
              <select className={inputCls} value={form.demo_type ?? ''} onChange={set('demo_type')}>
                <option value="">— Select —</option>
                {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Preferred Date + Time — calendar & time-slot pickers */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label text="Preferred Date" />
              <CalendarDropdown
                value={form.preferred_demo_date ?? ''}
                onChange={v => setVal('preferred_demo_date', v)}
              />
            </div>
            <div>
              <Label text="Preferred Time" />
              <TimeDropdown
                value={form.preferred_time ?? ''}
                onChange={v => setVal('preferred_time', v)}
              />
            </div>
          </div>

          {/* Vehicle + Window person */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label text="Vehicle" />
              <input className={inputCls} type="text" placeholder="e.g. Mach-E" value={form.vehicle ?? ''} onChange={set('vehicle')} />
            </div>
            <div>
              <Label text="Window Person" />
              <input className={inputCls} type="text" placeholder="Key contact / window" value={form.window_person ?? ''} onChange={set('window_person')} />
            </div>
          </div>

          {/* Purpose */}
          <div>
            <Label text="Demo Purpose / Reason" />
            <textarea
              rows={3}
              className="w-full px-3 py-2 text-sm text-gray-800 bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-colors resize-none"
              placeholder="Why is this demo being proposed?"
              value={form.demo_purpose ?? ''}
              onChange={set('demo_purpose')}
            />
          </div>

          {/* Notes */}
          <div>
            <Label text="Notes" />
            <textarea
              rows={2}
              className="w-full px-3 py-2 text-sm text-gray-800 bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-colors resize-none"
              placeholder="Any other context or links"
              value={form.notes ?? ''}
              onChange={set('notes')}
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex-shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 text-sm font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-1.5 h-9 px-5 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            {saving ? 'Creating…' : (prefill ? 'Duplicate' : 'Create Item')}
          </button>
        </div>
      </div>
    </div>
  )
}
