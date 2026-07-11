import { useState, type ReactNode } from 'react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '../../lib/shadcn/sheet'
import {
  Calendar, User, Building2, MapPin, Car, FileText,
  Link2, ExternalLink, Pencil, Trash2, Copy, ArrowRightCircle,
  Save, X, CheckCircle2,
} from 'lucide-react'
import type { BacklogItem, BacklogStatus } from './types'
import { BACKLOG_STATUSES } from './types'
import { getStatusConfig, getPriorityConfig } from './statusConfig'
import { DEMO_TYPES } from '../../lib/constants/demoTypes'
import { CalendarDropdown, TimeDropdown } from './BacklogPickers'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionLabel({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">
      {icon}{children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-x-3 text-sm py-1">
      <span className="text-gray-400 shrink-0 pt-0.5">{label}</span>
      <div className="text-gray-800 font-medium break-words">{children}</div>
    </div>
  )
}

function EditField({
  label, value, onChange, type = 'text', options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: 'text' | 'select' | 'textarea'
  options?: { value: string; label: string }[]
}) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-x-3 text-sm py-1 items-start">
      <span className="text-gray-400 shrink-0 pt-1.5">{label}</span>
      {type === 'textarea' ? (
        <textarea
          rows={3}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 resize-none focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
        />
      ) : type === 'select' ? (
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
        >
          <option value="">—</option>
          {options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
        />
      )}
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface BacklogDrawerProps {
  item:        BacklogItem | null
  open:        boolean
  onClose:     () => void
  onSave:      (id: number, data: Partial<BacklogItem>) => Promise<void>
  onDelete:    (id: number) => Promise<void>
  onDuplicate: (item: BacklogItem) => void
  onConvert:   (id: number) => Promise<void>
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BacklogDrawer({
  item, open, onClose, onSave, onDelete, onDuplicate, onConvert,
}: BacklogDrawerProps) {
  const [editMode,    setEditMode]    = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [deleting,    setDeleting]    = useState(false)
  const [converting,  setConverting]  = useState(false)
  const [draft,       setDraft]       = useState<Partial<BacklogItem>>({})

  if (!item) return null

  const cfg         = getStatusConfig(item.status)
  const isConverted = item.status === 'Converted'

  function merged(key: keyof BacklogItem): string {
    const v = draft[key] ?? item![key]
    return v != null ? String(v) : ''
  }

  function set(key: keyof BacklogItem) {
    return (v: string) => setDraft(d => ({ ...d, [key]: v || null }))
  }

  const priorityCfg = getPriorityConfig(merged('priority') || null)

  const handleEdit = () => { setDraft({}); setEditMode(true) }
  const handleCancel = () => { setDraft({}); setEditMode(false) }

  const handleSave = async () => {
    if (Object.keys(draft).length === 0) { setEditMode(false); return }
    setSaving(true)
    await onSave(item.id, draft)
    setSaving(false)
    setDraft({})
    setEditMode(false)
  }

  const handleDelete = async () => {
    if (!confirm(`Delete backlog item for "${item.company}"? This cannot be undone.`)) return
    setDeleting(true)
    await onDelete(item.id)
    setDeleting(false)
    onClose()
  }

  const handleConvert = async () => {
    if (!confirm(`Convert "${item.company}" to a Demo Request?`)) return
    setConverting(true)
    await onConvert(item.id)
    setConverting(false)
    onClose()
  }

  const statusOptions   = BACKLOG_STATUSES.map(s => ({ value: s, label: s }))
  const priorityOptions = [
    { value: 'P0', label: 'P0 — Critical' },
    { value: 'P1', label: 'P1 — High' },
    { value: 'P2', label: 'P2 — Normal' },
  ]
  const geoOptions  = ['JP', 'UK', 'US', 'DE'].map(g => ({ value: g, label: g }))
  const typeOptions = [...DEMO_TYPES].map(t => ({ value: t, label: t }))

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) { handleCancel(); onClose() } }}>
      <SheetContent
        side="right"
        className="w-[480px] sm:max-w-[480px] overflow-y-auto p-0 flex flex-col"
      >
        {/* ── Header ── */}
        <div className="px-6 pt-8 pb-4 border-b border-border bg-white flex-shrink-0">
          <SheetHeader>
            <SheetTitle className="text-base font-bold text-gray-900 leading-tight pr-8">
              {item.company ?? '—'}
            </SheetTitle>
          </SheetHeader>
          <div className="flex items-center gap-2 flex-wrap mt-2.5">
            <span
              className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full border"
              style={{ background: cfg.bg, color: cfg.text, borderColor: cfg.border }}
            >
              {item.status}
            </span>
            {item.priority && (
              <span
                className="inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-md border"
                style={{ background: priorityCfg.bg, color: priorityCfg.text, borderColor: priorityCfg.border }}
              >
                {item.priority.toUpperCase()}
              </span>
            )}
            {item.geo && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-md">
                <MapPin className="w-3 h-3" />
                {item.geo}
              </span>
            )}
            {isConverted && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3" />
                Converted
              </span>
            )}
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-6">

            {/* ── 1. Overview ── */}
            <div>
              <SectionLabel icon={<Building2 className="w-3.5 h-3.5" />}>Overview</SectionLabel>
              {editMode ? (
                <>
                  <EditField label="Company"   value={merged('company')}   onChange={set('company')} />
                  <EditField label="Customer"  value={merged('customer')}  onChange={set('customer')} />
                  <EditField label="Status"    value={merged('status')}    onChange={set('status')}    type="select" options={statusOptions} />
                  <EditField label="Priority"  value={merged('priority')}  onChange={set('priority')}  type="select" options={priorityOptions} />
                  <EditField label="GEO"       value={merged('geo')}       onChange={set('geo')}        type="select" options={geoOptions} />
                  <EditField label="Demo Type" value={merged('demo_type')} onChange={set('demo_type')}  type="select" options={typeOptions} />
                </>
              ) : (
                <>
                  <Field label="Company"  >{item.company   ?? '—'}</Field>
                  <Field label="Customer" >{item.customer  ?? '—'}</Field>
                  <Field label="GEO"      >{item.geo       ?? '—'}</Field>
                  <Field label="Demo Type">{item.demo_type ?? '—'}</Field>
                </>
              )}
            </div>

            {/* ── 2. People ── */}
            <div>
              <SectionLabel icon={<User className="w-3.5 h-3.5" />}>People</SectionLabel>
              {editMode ? (
                <>
                  <EditField label="Requestor" value={merged('requestor')}    onChange={set('requestor')} />
                  <EditField label="Host"       value={merged('host')}         onChange={set('host')} />
                  <EditField label="Window"     value={merged('window_person')} onChange={set('window_person')} />
                </>
              ) : (
                <>
                  <Field label="Requestor">{item.requestor    ?? '—'}</Field>
                  <Field label="Host"     >{item.host          ?? '—'}</Field>
                  <Field label="Window"   >{item.window_person ?? '—'}</Field>
                </>
              )}
            </div>

            {/* ── 3. Planning ── */}
            <div>
              <SectionLabel icon={<Calendar className="w-3.5 h-3.5" />}>Planning</SectionLabel>
              {editMode ? (
                <>
                  <div className="grid grid-cols-[100px_1fr] gap-x-3 text-sm py-1 items-center">
                    <span className="text-gray-400 shrink-0">Pref. Date</span>
                    <CalendarDropdown value={merged('preferred_demo_date')} onChange={set('preferred_demo_date')} />
                  </div>
                  <div className="grid grid-cols-[100px_1fr] gap-x-3 text-sm py-1 items-center">
                    <span className="text-gray-400 shrink-0">Pref. Time</span>
                    <TimeDropdown value={merged('preferred_time')} onChange={set('preferred_time')} />
                  </div>
                  <EditField label="Purpose"    value={merged('demo_purpose')}         onChange={set('demo_purpose')} type="textarea" />
                </>
              ) : (
                <>
                  <Field label="Pref. Date">{item.preferred_demo_date ?? '—'}</Field>
                  <Field label="Pref. Time">{item.preferred_time ?? '—'}</Field>
                  {item.demo_purpose && (
                    <Field label="Purpose">
                      <span className="text-gray-600 text-xs leading-snug">{item.demo_purpose}</span>
                    </Field>
                  )}
                </>
              )}
            </div>

            {/* ── 4. Operations ── */}
            <div>
              <SectionLabel icon={<Car className="w-3.5 h-3.5" />}>Operations</SectionLabel>
              {editMode ? (
                <>
                  <EditField label="Vehicle" value={merged('vehicle')}             onChange={set('vehicle')} />
                  <EditField label="Route"   value={merged('demo_route')}           onChange={set('demo_route')} />
                  <EditField label="Perf."   value={merged('expected_performance')} onChange={set('expected_performance')} />
                </>
              ) : (
                <>
                  <Field label="Vehicle">{item.vehicle              ?? '—'}</Field>
                  <Field label="Route"  >{item.demo_route           ?? '—'}</Field>
                  <Field label="Perf."  >{item.expected_performance ?? '—'}</Field>
                </>
              )}
            </div>

            {/* ── 5. Notes + Links ── */}
            <div>
              <SectionLabel icon={<FileText className="w-3.5 h-3.5" />}>Notes</SectionLabel>
              {editMode ? (
                <EditField label="Notes" value={merged('notes')} onChange={set('notes')} type="textarea" />
              ) : (
                item.notes
                  ? <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">{item.notes}</p>
                  : <p className="text-xs text-gray-300 italic">No notes</p>
              )}

              {item.ticket_link && (
                <div className="mt-3">
                  <SectionLabel icon={<Link2 className="w-3.5 h-3.5" />}>Links</SectionLabel>
                  <a
                    href={item.ticket_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Open ticket / Slack
                  </a>
                </div>
              )}
            </div>

            {/* ── Converted info ── */}
            {isConverted && item.converted_demo_id && (
              <div className="px-3 py-3 rounded-xl bg-green-50 border border-green-200">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="text-xs font-bold text-green-700 uppercase tracking-wider">Converted to Demo Request</span>
                </div>
                <p className="text-xs text-green-600">Demo ID: #{item.converted_demo_id}</p>
                {item.converted_at && (
                  <p className="text-xs text-green-500 mt-0.5">
                    {new Date(item.converted_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Footer actions ── */}
        <div className="flex-shrink-0 border-t border-gray-100 bg-white px-6 py-4">
          {editMode ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 h-9 px-4 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              <button
                onClick={handleCancel}
                className="flex items-center gap-1.5 h-9 px-3 text-sm font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              {!isConverted && (
                <button
                  onClick={handleEdit}
                  className="flex items-center gap-1.5 h-9 px-3 text-sm font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </button>
              )}
              <button
                onClick={() => onDuplicate(item)}
                className="flex items-center gap-1.5 h-9 px-3 text-sm font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                Duplicate
              </button>
              {!isConverted && (
                <button
                  onClick={handleConvert}
                  disabled={converting}
                  className="flex items-center gap-1.5 h-9 px-3 text-sm font-semibold rounded-lg border border-green-200 bg-green-50 hover:bg-green-100 text-green-700 transition-colors disabled:opacity-50"
                >
                  <ArrowRightCircle className="w-3.5 h-3.5" />
                  {converting ? 'Converting…' : 'Convert to Demo Request'}
                </button>
              )}
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 h-9 px-3 text-sm font-medium rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 transition-colors disabled:opacity-50 ml-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {deleting ? '…' : 'Delete'}
              </button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
