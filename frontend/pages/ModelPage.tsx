import { useState, useEffect, useRef, Fragment } from 'react'
import {
  useGetModelList, useGetModelAnalytics, useGetModelComparison,
  type ModelAnalyticsData, type ComparisonRow,
} from '../hooks/backend/modelAnalytics'
import type { PostDemoRecord } from '../hooks/backend/postDemo'

// ─── Constants ────────────────────────────────────────────────────────────────

const RATING_ORDER = ['Excellent', 'Good', 'Average', 'Poor', 'Unsatisfactory']

const RATING_COLOURS: Record<string, string> = {
  'Excellent':      'bg-emerald-500',
  'Good':           'bg-blue-500',
  'Average':        'bg-amber-400',
  'Poor':           'bg-orange-500',
  'Unsatisfactory': 'bg-red-500',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt1(v: number | null | undefined): string {
  if (v == null) return '—'
  return v.toFixed(1)
}

function fmtInt(v: number | null | undefined): string {
  if (v == null) return '—'
  return String(v)
}

function parseIntervention(raw: number | { count: number; safetyCritical: boolean }): { count: number; sc: boolean } {
  if (typeof raw === 'number') return { count: raw, sc: false }
  return { count: raw.count, sc: raw.safetyCritical }
}

// ─── Searchable combobox ──────────────────────────────────────────────────────

function ModelCombobox({
  value, onChange, models, placeholder,
}: {
  value: string | null
  onChange: (m: string) => void
  models: string[]
  placeholder?: string
}) {
  const [query, setQuery]     = useState(value ?? '')
  const [open, setOpen]       = useState(false)
  const ref                   = useRef<HTMLDivElement>(null)

  // Sync display text when value changes externally
  useEffect(() => { setQuery(value ?? '') }, [value])

  // Close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const filtered = models.filter(m => m.toLowerCase().includes(query.toLowerCase()))

  return (
    <div ref={ref} className="relative w-full">
      <input
        type="text"
        value={query}
        placeholder={placeholder ?? 'Search model…'}
        className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm bg-white
                   focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 max-h-56 overflow-y-auto bg-white
                       border border-gray-200 rounded-lg shadow-lg">
          {filtered.map(m => (
            <li
              key={m}
              className={[
                'px-3 py-2 text-sm cursor-pointer transition-colors',
                m === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50',
              ].join(' ')}
              onMouseDown={e => {
                e.preventDefault()  // prevent input blur before click registers
                onChange(m)
                setQuery(m)
                setOpen(false)
              }}
            >
              {m}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, suffix = '', danger = false, muted = false }: {
  label: string; value: string | number; suffix?: string; danger?: boolean; muted?: boolean
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-col gap-1 shadow-sm">
      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
      <span className={[
        'text-2xl font-bold leading-none',
        danger && Number(value) > 0 ? 'text-red-600' : muted ? 'text-gray-400' : 'text-gray-900',
      ].join(' ')}>
        {value}{suffix}
      </span>
    </div>
  )
}

// ─── Feedback detail drawer ───────────────────────────────────────────────────

function ScoreBar({ label, score, max = 10 }: { label: string; score: number | null; max?: number }) {
  if (score == null) return null
  const pct = Math.round((score / max) * 100)
  const colour = score / max >= 0.7 ? 'bg-emerald-500' : score / max >= 0.4 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 w-28 flex-shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-2 rounded-full transition-all ${colour}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-8 text-right">{score}/{max}</span>
    </div>
  )
}

function FeedbackDrawer({ record, onClose }: { record: PostDemoRecord; onClose: () => void }) {
  const interventionEntries = record.interventions
    ? Object.entries(record.interventions)
        .map(([k, raw]) => {
          const { count, sc } = parseIntervention(raw as number | { count: number; safetyCritical: boolean })
          return { k, count, sc }
        })
        .filter(({ count }) => count > 0)
    : []

  const scCount = (() => {
    if (typeof record.safety_critical === 'boolean') return record.safety_critical ? 1 : 0
    return interventionEntries.filter(e => e.sc).length
  })()

  return (
    <div className="fixed inset-0 z-50 flex" aria-modal="true">
      {/* Overlay */}
      <div className="flex-1 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <aside className="w-[420px] max-w-full h-full bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="text-xs text-gray-400 font-medium">
              {record.demo_ref ?? 'No Ref'} · {record.geo}
            </p>
            <h2 className="text-base font-bold text-gray-900 mt-0.5">{record.model_name}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400
                       hover:text-gray-700 hover:bg-gray-100 transition-colors text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Meta */}
          <section>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Demo Info</p>
            <div className="grid grid-cols-2 gap-y-1 text-sm">
              {[
                ['Date',   record.demo_date ?? '—'],
                ['Type',   record.demo_type ?? '—'],
                ['Route',  record.demo_route ?? record.route ?? '—'],
                ['Operator', record.operator_name ?? '—'],
                ['Org',    record.guest_organization ?? '—'],
                ['Vehicle', record.vehicle_id],
              ].map(([l, v]) => (
                <div key={l} className="flex flex-col">
                  <span className="text-[10px] text-gray-400">{l}</span>
                  <span className="font-medium text-gray-800">{v}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Safety & Smoothness */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Safety & Smoothness</p>
              {scCount > 0
                ? <span className="flex items-center gap-1 px-2 py-0.5 bg-red-50 rounded-full text-xs font-semibold text-red-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    {scCount} SC
                  </span>
                : <span className="px-2 py-0.5 bg-green-50 rounded-full text-xs font-semibold text-green-600">No SC</span>
              }
            </div>
            <div className="space-y-2">
              <ScoreBar label="Safety"        score={record.safety_score} />
              <ScoreBar label="Comfort"       score={record.comfort_score} />
              <ScoreBar label="Decisiveness"  score={record.decisiveness_score} />
              <ScoreBar label="Aggressiveness" score={record.aggressiveness_score} />
              <ScoreBar label="Smoothness"    score={record.smoothness_score} max={5} />
            </div>
          </section>

          {/* Interventions */}
          {interventionEntries.length > 0 && (
            <section>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Interventions</p>
              <div className="space-y-1.5">
                {interventionEntries.map(({ k, count, sc }) => (
                  <div key={k} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-sm text-gray-700 flex items-center gap-2">
                      {k.replace(/_/g, ' ')}
                      {sc && (
                        <span className="inline-flex items-center gap-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                          <span className="px-1 py-0.5 rounded bg-red-100 text-red-600 text-[8px] font-bold">SC</span>
                        </span>
                      )}
                    </span>
                    <span className="text-xs font-semibold text-gray-500">×{count}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Behaviours */}
          {record.model_behaviours && record.model_behaviours.length > 0 && (
            <section>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Model Behaviours</p>
              <div className="flex flex-wrap gap-1.5">
                {record.model_behaviours.map(b => (
                  <span key={b} className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">{b}</span>
                ))}
              </div>
            </section>
          )}

          {/* Feedback text */}
          {(record.positive_behaviour || record.problem_description) && (
            <section className="space-y-3">
              {record.positive_behaviour && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Positive Behaviour</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{record.positive_behaviour}</p>
                </div>
              )}
              {record.problem_description && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Problem Description</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{record.problem_description}</p>
                </div>
              )}
            </section>
          )}

          {/* Other metrics */}
          {(record.number_of_uds != null || record.power_cycle_required != null) && (
            <section>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Other</p>
              <div className="grid grid-cols-2 gap-y-1 text-sm">
                {record.number_of_uds != null && (
                  <>
                    <span className="text-gray-400 text-xs">UDS Count</span>
                    <span className="font-medium text-gray-800">{record.number_of_uds}</span>
                  </>
                )}
                {record.power_cycle_required != null && (
                  <>
                    <span className="text-gray-400 text-xs">Power Cycle</span>
                    <span className="font-medium text-gray-800">{record.power_cycle_required ? 'Yes' : 'No'}</span>
                  </>
                )}
                {record.reason_for_power_cycle && (
                  <>
                    <span className="text-gray-400 text-xs">Reason</span>
                    <span className="font-medium text-gray-800 text-xs">{record.reason_for_power_cycle}</span>
                  </>
                )}
              </div>
            </section>
          )}
        </div>
      </aside>
    </div>
  )
}

// ─── Model Search tab ─────────────────────────────────────────────────────────

function ModelSearchTab({ models }: { models: string[] }) {
  const [selectedModel,   setSelectedModel]   = useState<string | null>(null)
  const [drawerRecord,    setDrawerRecord]     = useState<PostDemoRecord | null>(null)

  const analyticsHook = useGetModelAnalytics(selectedModel ?? '')
  const analytics: ModelAnalyticsData | null = analyticsHook.data
  const loading = analyticsHook.loading

  useEffect(() => {
    if (selectedModel) {
      void analyticsHook.trigger()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModel])

  const totalRatedRuns = analytics?.ratingDistribution.reduce((s, r) => s + r.count, 0) ?? 0

  return (
    <div className="space-y-5">
      {/* Combobox */}
      <div className="flex items-center gap-3">
        <div className="w-72">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Select Model</span>
          <ModelCombobox
            value={selectedModel}
            onChange={m => { if (m !== selectedModel) setSelectedModel(m) }}
            models={models}
          />
        </div>
        {selectedModel && !loading && analytics && (
          <div className="mt-5 text-xs text-gray-400">{analytics.runCount} run{analytics.runCount !== 1 ? 's' : ''}</div>
        )}
        {loading && (
          <div className="mt-5 flex items-center gap-2 text-xs text-gray-400">
            <span className="animate-spin w-3.5 h-3.5 border-2 border-gray-200 border-t-blue-500 rounded-full" />
            Loading…
          </div>
        )}
      </div>

      {/* Empty state */}
      {!selectedModel && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-300">
          <div className="text-5xl mb-3">◈</div>
          <p className="text-sm font-medium text-gray-400">Select a model to view its analytics</p>
          <p className="text-xs text-gray-300 mt-1">{models.length} model{models.length !== 1 ? 's' : ''} available</p>
        </div>
      )}

      {/* Analytics */}
      {selectedModel && analytics && !loading && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-5 gap-3">
            <KpiCard label="Total Runs"          value={analytics.runCount} />
            <KpiCard label="Avg Smoothness"      value={fmt1(analytics.avgSmoothness)} suffix="/5"  muted={analytics.avgSmoothness == null} />
            <KpiCard label="DILC use"            value={analytics.dilcUse != null ? analytics.dilcUse : '—'} muted={analytics.dilcUse == null} />
            <KpiCard label="Safety Critical"     value={analytics.scRunCount} danger />
            <KpiCard label="Total Interventions" value={analytics.totalInterventions} />
          </div>

          {/* Rating Distribution + Intervention chips */}
          <div className="grid grid-cols-2 gap-5">
            {/* Rating Distribution */}
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-4">Rating Distribution</p>
              {totalRatedRuns === 0 ? (
                <p className="text-xs text-gray-400 italic">No rated runs</p>
              ) : (
                <div className="space-y-3">
                  {RATING_ORDER.map(bucket => {
                    const item = analytics.ratingDistribution.find(r => r.bucket === bucket)
                    const count = item?.count ?? 0
                    const pct   = totalRatedRuns > 0 ? Math.round((count / totalRatedRuns) * 100) : 0
                    return (
                      <div key={bucket} className="flex items-center gap-3">
                        <span className="text-xs font-medium w-32 flex-shrink-0 text-gray-900">
                          {bucket}
                        </span>
                        <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className={`h-2 rounded-full transition-all ${RATING_COLOURS[bucket] ?? 'bg-gray-300'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 w-8 text-right flex-shrink-0">{count}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Intervention Chips */}
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-4">Interventions</p>
              {analytics.interventionBreakdown.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No interventions recorded</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {analytics.interventionBreakdown.map(inv => (
                    <span
                      key={inv.name}
                      className={[
                        'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border',
                        inv.any_sc
                          ? 'border-red-200 bg-red-50 text-red-700'
                          : 'border-gray-200 bg-gray-50 text-gray-700',
                      ].join(' ')}
                    >
                      {inv.any_sc && (
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                      )}
                      <span>{inv.name.replace(/_/g, ' ')}</span>
                      <span className={[
                        'px-1 py-0.5 rounded text-[10px] font-bold',
                        inv.any_sc ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-600',
                      ].join(' ')}>
                        {inv.total_count}
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Score summary */}
          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-4">Average Scores</p>
            <div className="grid grid-cols-5 divide-x divide-gray-100">
              {[
                { label: 'Safety',        value: analytics.avgSafety,         max: 10 },
                { label: 'Comfort',       value: analytics.avgComfort,         max: 10 },
                { label: 'Decisiveness',  value: analytics.avgDecisiveness,    max: 10 },
                { label: 'Aggressiveness', value: analytics.avgAggressiveness, max: 10 },
                { label: 'Smoothness',    value: analytics.avgSmoothness,      max: 5 },
              ].map(({ label, value, max }) => (
                <div key={label} className="flex flex-col items-center gap-1 px-3 first:pl-0 last:pr-0">
                  <span className="text-[10px] text-gray-400 text-center">{label}</span>
                  <span className="text-xl font-bold text-gray-800">
                    {value != null ? value.toFixed(1) : '—'}
                  </span>
                  <span className="text-[10px] text-gray-400">/{max}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Feedback reports table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                Feedback Reports ({analytics.feedbackReports.length})
              </p>
            </div>
            {analytics.feedbackReports.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-gray-400 italic">No feedback reports found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Date', 'Geo', 'Type', 'Operator', 'Safety', 'Comfort', 'Decisiveness', 'Smooth', 'SC', ''].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.feedbackReports.map(r => {
                      const scFlag = r.safety_critical === true || (
                        r.interventions
                          ? Object.values(r.interventions).some(v => typeof v !== 'number' && (v as { safetyCritical?: boolean }).safetyCritical)
                          : false
                      )
                      return (
                        <tr
                          key={r.id}
                          className="border-b border-gray-50 hover:bg-blue-50/40 cursor-pointer transition-colors"
                          onClick={() => setDrawerRecord(r)}
                        >
                          <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{r.demo_date ? r.demo_date.slice(0, 10) : '—'}</td>
                          <td className="px-3 py-2.5 text-gray-700">{r.geo}</td>
                          <td className="px-3 py-2.5 text-gray-500 text-xs">{r.demo_type ?? '—'}</td>
                          <td className="px-3 py-2.5 text-gray-700 max-w-[140px] truncate">{r.operator_name ?? '—'}</td>
                          <td className="px-3 py-2.5 font-medium text-gray-800">{r.safety_score ?? '—'}</td>
                          <td className="px-3 py-2.5 font-medium text-gray-800">{r.comfort_score ?? '—'}</td>
                          <td className="px-3 py-2.5 font-medium text-gray-800">{r.decisiveness_score ?? '—'}</td>
                          <td className="px-3 py-2.5 font-medium text-gray-800">{r.smoothness_score ?? '—'}</td>
                          <td className="px-3 py-2.5">
                            {scFlag
                              ? <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-[10px] font-bold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />SC
                                </span>
                              : <span className="text-gray-300 text-xs">—</span>
                            }
                          </td>
                          <td className="px-3 py-2.5 text-gray-400 text-xs">View →</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Feedback drawer */}
      {drawerRecord && (
        <FeedbackDrawer record={drawerRecord} onClose={() => setDrawerRecord(null)} />
      )}
    </div>
  )
}

// ─── Comparison table row ─────────────────────────────────────────────────────

function ComparisonTableRow({ row }: { row: ComparisonRow }) {
  const aNum = typeof row.modelAValue === 'number' ? row.modelAValue : null
  const bNum = typeof row.modelBValue === 'number' ? row.modelBValue : null
  const winner: 'A' | 'B' | null = (() => {
    if (row.direction === 'neutral' || aNum == null || bNum == null || aNum === bNum) return null
    if (row.direction === 'higher') return aNum > bNum ? 'A' : 'B'
    return aNum < bNum ? 'A' : 'B'
  })()

  const renderCell = (side: 'A' | 'B') => {
    const val = side === 'A' ? row.modelAValue : row.modelBValue
    const sc  = side === 'A' ? (row.scA ?? false) : (row.scB ?? false)
    const isW = winner === side
    const isL = winner !== null && winner !== side
    const display = val == null ? '—'
      : typeof val === 'number'
        ? Number.isInteger(val) ? String(val) : val.toFixed(1)
        : val
    return (
      <td className={[
        'px-5 py-2.5 text-center',
        isW ? 'font-bold text-emerald-700 bg-emerald-100/60' :
        isL ? 'font-semibold text-red-600 bg-red-100/50' :
              'font-medium text-gray-700',
      ].join(' ')}>
        <span className="inline-flex items-center gap-1.5 justify-center">
          {isW && <span className="text-emerald-500 text-xs">▲</span>}
          {isL && <span className="text-red-400 text-xs">▼</span>}
          {sc && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />}
          <span>{display}</span>
          {sc && <span className="px-1 py-0.5 rounded bg-red-100 text-red-600 text-[9px] font-bold">SC</span>}
        </span>
      </td>
    )
  }

  return (
    <tr className="border-b border-gray-200">
      <td className="px-5 py-2.5 text-sm font-medium text-gray-900 w-64">
        <span className="inline-flex items-center gap-2">
          <span>{row.parameter.replace(/_/g, ' ')}</span>
          {row.common && (
            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[9px] font-semibold uppercase tracking-wide border border-blue-100">
              Both
            </span>
          )}
        </span>
      </td>
      {renderCell('A')}
      {renderCell('B')}
    </tr>
  )
}

// ─── Comparison tab ───────────────────────────────────────────────────────────

function ComparisonTab({ models }: { models: string[] }) {
  const [modelA, setModelA] = useState<string | null>(null)
  const [modelB, setModelB] = useState<string | null>(null)

  const compareHook = useGetModelComparison(modelA ?? '', modelB ?? '')
  const compare = compareHook.data
  const loading = compareHook.loading

  useEffect(() => {
    if (modelA && modelB) void compareHook.trigger()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelA, modelB])

  return (
    <div className="space-y-5">
      {/* Model selectors */}
      <div className="grid grid-cols-2 gap-4">
        {([
          { label: 'First Model',  value: modelA, onChange: setModelA },
          { label: 'Second Model', value: modelB, onChange: setModelB },
        ] as const).map(({ label, value, onChange }) => (
          <div key={label}>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">{label}</span>
            <ModelCombobox value={value} onChange={onChange as (m: string) => void} models={models} placeholder={`Select ${label}…`} />
          </div>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-10 gap-2 text-sm text-gray-400">
          <span className="animate-spin w-4 h-4 border-2 border-gray-200 border-t-blue-500 rounded-full" />
          Comparing models…
        </div>
      )}

      {/* Empty state */}
      {!loading && (!modelA || !modelB) && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-300">
          <div className="text-5xl mb-3">⊕</div>
          <p className="text-sm font-medium text-gray-400">Select two models to compare</p>
        </div>
      )}

      {/* Comparison table */}
      {!loading && compare && (
        <>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-700 w-64">Parameter</th>
                  <th className="px-5 py-3 text-center text-sm font-bold text-[#2563EB]">
                    {compare.modelA.modelName}
                  </th>
                  <th className="px-5 py-3 text-center text-sm font-bold text-purple-600">
                    {compare.modelB.modelName}
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Top rows — always visible, no group header */}
                {compare.comparison.topRows.map(row => (
                  <ComparisonTableRow key={row.parameter} row={row} />
                ))}

                {/* Grouped sections */}
                {compare.comparison.groups.map(group => (
                  <Fragment key={group.title}>
                    {/* Group header row */}
                    <tr className="border-t-2 border-b border-gray-300 bg-gray-50">
                      <td colSpan={3} className="px-5 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                        {group.title}
                      </td>
                    </tr>
                    {/* Group rows */}
                    {group.rows.length === 0 ? (
                      <tr className="border-b border-gray-200">
                        <td colSpan={3} className="px-5 py-3 text-xs text-gray-400 italic">No data available</td>
                      </tr>
                    ) : (
                      group.rows.map(row => (
                        <ComparisonTableRow key={`${group.title}-${row.parameter}`} row={row} />
                      ))
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-gray-400 justify-end">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-emerald-100 border border-emerald-300 rounded" />
              Better value
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-red-100 border border-red-300 rounded" />
              Worse value
            </span>
            <span className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[9px] font-semibold border border-blue-100">Both</span>
              Found in both models
            </span>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Segmented switcher ───────────────────────────────────────────────────────

type ModelView = 'search' | 'compare'

const MODEL_VIEW_OPTIONS: Array<{ value: ModelView; label: string }> = [
  { value: 'search',  label: 'Model Search' },
  { value: 'compare', label: 'Comparison' },
]

function ModelSegmentedSwitch({
  value,
  options,
  onChange,
}: {
  value: ModelView
  options: typeof MODEL_VIEW_OPTIONS
  onChange: (v: ModelView) => void
}) {
  return (
    <div
      className="inline-flex items-center bg-[#F1F5F9] rounded-full p-1"
      style={{ height: 40 }}
      role="tablist"
    >
      {options.map(opt => (
        <button
          key={opt.value}
          role="tab"
          aria-selected={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={[
            'h-8 px-5 rounded-full text-sm transition-all duration-200 whitespace-nowrap select-none',
            value === opt.value
              ? 'bg-[#158CEA] text-white font-semibold shadow-sm'
              : 'text-gray-500 font-medium hover:text-gray-700',
          ].join(' ')}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ModelPage() {
  const [activeView, setActiveView] = useState<ModelView>('search')

  const listHook = useGetModelList()
  const models   = listHook.data ?? []

  useEffect(() => { void listHook.trigger() }, [])

  return (
    <div className="h-full flex flex-col bg-[#F8FAFC] overflow-hidden">
      {/* ── Top bar with segmented switcher ── */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-6 py-3 relative flex items-center justify-center">
        <ModelSegmentedSwitch
          value={activeView}
          options={MODEL_VIEW_OPTIONS}
          onChange={setActiveView}
        />

        {/* Model count — right-anchored, does not shift the centered switcher */}
        <div className="absolute right-6 top-1/2 -translate-y-1/2">
          {listHook.loading ? (
            <span className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="animate-spin w-3 h-3 border-2 border-gray-200 border-t-blue-500 rounded-full" />
              Loading…
            </span>
          ) : models.length > 0 ? (
            <span className="text-xs text-gray-400">
              {models.length} model{models.length !== 1 ? 's' : ''}
            </span>
          ) : null}
        </div>
      </div>

      {/* ── View content — both always mounted to preserve state ── */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className={activeView !== 'search'  ? 'hidden' : ''}><ModelSearchTab  models={models} /></div>
        <div className={activeView !== 'compare' ? 'hidden' : ''}><ComparisonTab   models={models} /></div>
      </div>
    </div>
  )
}
