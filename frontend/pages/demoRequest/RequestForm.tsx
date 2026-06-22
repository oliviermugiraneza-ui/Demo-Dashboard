import { useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Send, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../../lib/shadcn/button'
import { Input } from '../../lib/shadcn/input'
import { Label } from '../../lib/shadcn/label'
import { Textarea } from '../../lib/shadcn/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../lib/shadcn/select'
import { useSubmitDemoRequest } from '../../hooks/backend/demoRequests'
import { getTypeConfig, type FormFieldDef } from './data/demoTypeConfig'

// ─── Single dynamic field renderer ───────────────────────────────────────────

function FieldInput({
  field, value, onChange,
}: {
  field: FormFieldDef
  value: string
  onChange: (v: string) => void
}) {
  const base = 'h-9 text-sm'

  if (field.kind === 'select' && field.options) {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className={base}>
          <SelectValue placeholder={`Select ${field.label.toLowerCase()}…`} />
        </SelectTrigger>
        <SelectContent>
          {field.options.map(o => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (field.kind === 'textarea') {
    return (
      <Textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={field.placeholder}
        className="text-sm min-h-[80px] resize-none"
        rows={3}
      />
    )
  }

  const inputType = field.kind === 'date' ? 'date'
    : field.kind === 'time' ? 'time'
    : field.kind === 'number' ? 'number'
    : 'text'

  return (
    <Input
      type={inputType}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={field.placeholder}
      className={base}
      min={field.kind === 'number' ? '0' : undefined}
    />
  )
}

// ─── Main form page ───────────────────────────────────────────────────────────

export default function RequestForm() {
  const { type: slug } = useParams<{ type: string }>()
  const navigate = useNavigate()
  const cfg = useMemo(() => getTypeConfig(slug ?? ''), [slug])
  const { trigger: submit, loading } = useSubmitDemoRequest()

  // Flat state map: fieldKey → string value
  const [values, setValues] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {}
    cfg?.fields.forEach(f => { defaults[f.key] = '' })
    return defaults
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  if (!cfg) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[40vh] gap-3 text-gray-400">
        <AlertCircle className="w-8 h-8" />
        <p className="text-sm">Unknown demo type: <strong>{slug}</strong></p>
        <Button variant="outline" size="sm" onClick={() => navigate('..')}>Go Back</Button>
      </div>
    )
  }

  // cfg is guaranteed non-null here because we returned early above when it was undefined
  const safeCfg = cfg

  function set(key: string, val: string) {
    setValues(prev => ({ ...prev, [key]: val }))
    if (errors[key]) setErrors(prev => { const next = { ...prev }; delete next[key]; return next })
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    for (const f of safeCfg.fields) {
      if (f.required && !values[f.key]?.trim()) {
        errs[f.key] = `${f.label} is required`
      }
    }
    if (values['date_of_demo'] && values['demo_start_time'] && values['demo_end_time']) {
      if (values['demo_start_time'] >= values['demo_end_time']) {
        errs['demo_end_time'] = 'End time must be after start time'
      }
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    try {
      const params: Record<string, unknown> = { ...values, demo_type: safeCfg.label }
      if (values['total_vehicles']) params['total_vehicles'] = parseInt(values['total_vehicles'], 10) || 1
      if (values['number_of_sessions']) params['number_of_sessions'] = parseInt(values['number_of_sessions'], 10) || 1

      await submit(params)
      toast.success('Demo request submitted!', {
        description: `Your ${safeCfg.label} request has been sent for review.`,
      })
      navigate('..')
    } catch {
      toast.error('Submission failed', { description: 'Please try again.' })
    }
  }

  const FULL_WIDTH = new Set(['description', 'date_of_demo', 'demo_start_time', 'demo_end_time'])
  const rows: FormFieldDef[][] = []
  let i = 0
  const fields = safeCfg.fields
  while (i < fields.length) {
    const f = fields[i]!
    if (FULL_WIDTH.has(f.key) || f.kind === 'textarea') {
      rows.push([f]); i++
    } else if (i + 1 < fields.length && !FULL_WIDTH.has(fields[i + 1]!.key) && fields[i + 1]!.kind !== 'textarea') {
      rows.push([f, fields[i + 1]!]); i += 2
    } else {
      rows.push([f]); i++
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('..')}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2.5">
          <div>
            <h2 className="text-base font-bold text-gray-900">{safeCfg.label} Request</h2>
            <p className="text-xs text-gray-500">{safeCfg.description}</p>
          </div>
        </div>
      </div>

      {/* Form card */}
      <form onSubmit={handleSubmit} noValidate>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          {rows.map((row, ri) => (
            <div key={ri} className={`grid gap-4 ${row.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {row.map(f => (
                <div key={f.key}>
                  <Label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    {f.label}
                    {f.required && <span className="text-red-500 ml-0.5">*</span>}
                  </Label>
                  <FieldInput field={f} value={values[f.key] ?? ''} onChange={v => set(f.key, v)} />
                  {f.helpText && <p className="mt-1 text-[11px] text-gray-400">{f.helpText}</p>}
                  {errors[f.key] && (
                    <p className="mt-1 text-[11px] text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />{errors[f.key]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 mt-4">
          <Button type="button" variant="outline" onClick={() => navigate('..')}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}
            className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white gap-2">
            {loading
              ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
              : <Send className="w-4 h-4" />}
            Submit Request
          </Button>
        </div>
      </form>
    </div>
  )
}
