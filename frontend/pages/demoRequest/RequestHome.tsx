import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, ClipboardList } from 'lucide-react'
import { DEMO_TYPE_CONFIGS } from './data/demoTypeConfig'
import { useGetDemos } from '../../hooks/backend/demos'
import { type DemoRequest, type GeoCode } from '../data/sampleData'
import GeoBadge from '../../components/GeoBadge'
import StatusBadge from '../../components/StatusBadge'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${d} ${months[parseInt(m ?? '1', 10) - 1]} ${y}`
}

// ─── Demo type card ───────────────────────────────────────────────────────────

function TypeCard({ cfg, onClick }: {
  cfg: typeof DEMO_TYPE_CONFIGS[number]
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="group text-left rounded-2xl border transition-all duration-200
                 hover:shadow-lg hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
      style={{ background: cfg.bgColor, borderColor: cfg.accentColor + '33', padding: '20px 18px 16px' }}
    >
      {/* Accent dot */}
      <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-3 text-base"
        style={{ background: cfg.accentColor + '1A' }}>
        <span style={{ color: cfg.accentColor }}>✦</span>
      </div>
      <p className="text-sm font-bold text-gray-900 leading-snug mb-1">{cfg.label}</p>
      <p className="text-[11px] text-gray-500 leading-snug mb-4 line-clamp-2">{cfg.description}</p>
      <div className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: cfg.accentColor }}>
        Request
        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </button>
  )
}

// ─── My Requests table ────────────────────────────────────────────────────────

function RequestsTable({ demos, loading }: { demos: DemoRequest[]; loading: boolean }) {
  if (loading && demos.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-sm text-gray-400">
        <span className="w-4 h-4 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
        Loading…
      </div>
    )
  }

  if (demos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-400">
        <ClipboardList size={32} className="opacity-25" />
        <p className="text-sm font-medium">No requests found</p>
        <p className="text-xs">Demos approved by Oliver Mugiraneza appear here</p>
      </div>
    )
  }

  return (
    <div className="overflow-y-auto" style={{ maxHeight: 400 }}>
      <table className="w-full text-sm border-collapse">
        <thead className="sticky top-0 z-10">
          <tr className="bg-gray-50 border-b border-gray-100">
            {['Demo Date', 'Organisation', 'Type', 'Geo', 'Status'].map(h => (
              <th key={h} className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-4 py-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {demos.map((d, i) => (
            <tr key={d.id}
              className={[
                'border-b border-gray-50 last:border-0 transition-colors hover:bg-blue-50/30',
                i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30',
              ].join(' ')}
            >
              <td className="px-4 py-3 text-[12px] font-semibold text-gray-800 whitespace-nowrap">
                {fmtDate(d.demo_date)}
              </td>
              <td className="px-4 py-3 text-[12px] text-gray-600 max-w-[160px] truncate">
                {d.organization || '—'}
              </td>
              <td className="px-4 py-3">
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-medium border border-purple-100 whitespace-nowrap">
                  {d.type}
                </span>
              </td>
              <td className="px-4 py-3">
                <GeoBadge geo={d.geo as GeoCode} />
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={d.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RequestHome() {
  const navigate = useNavigate()
  const [demos, setDemos] = useState<DemoRequest[]>([])
  const { data: dbDemos, loading, trigger: fetchDemos } = useGetDemos()

  useEffect(() => { void fetchDemos() }, [])
  useEffect(() => { if (dbDemos) setDemos(dbDemos as DemoRequest[]) }, [dbDemos])

  const visibleDemos = useMemo(
    () =>
      demos
        .filter(d => d.status !== 'DELETED' && d.approver?.toLowerCase().includes('mugiraneza'))
        .sort((a, b) => b.demo_date.localeCompare(a.demo_date)),
    [demos],
  )

  return (
    <div className="min-h-full flex flex-col">

      {/* ── Top section — Request a New Demo (full width) ── */}
      <div className="border-b border-gray-100 bg-white px-8 pt-8 pb-7">
        <div className="max-w-5xl mx-auto">
          {/* Section heading */}
          <div className="flex items-center gap-2 mb-5">
            <div className="w-1.5 h-5 rounded-full bg-[#2563EB]" />
            <h2 className="text-[13px] font-bold text-gray-900 uppercase tracking-[0.12em]">
              Request a New Demo
            </h2>
          </div>

          {/* Type cards — 4 per row, 2 rows */}
          <div className="grid grid-cols-4 gap-3">
            {DEMO_TYPE_CONFIGS.map(cfg => (
              <TypeCard
                key={cfg.slug}
                cfg={cfg}
                onClick={() => navigate(cfg.slug)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom section — My Requests ── */}
      <div className="flex-1 px-8 py-7">
        <div className="max-w-5xl mx-auto">
          {/* Section heading */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-5 rounded-full bg-indigo-500" />
              <h2 className="text-[13px] font-bold text-gray-900 uppercase tracking-[0.12em]">
                My Requests
              </h2>
            </div>
            <span
              className="inline-flex items-center justify-center text-[10px] font-bold text-white
                         rounded-full px-2 py-0.5 leading-none"
              style={{ background: '#4F46E5', minWidth: 20 }}
            >
              {visibleDemos.length}
            </span>
            <p className="text-xs text-gray-400 ml-1">Demos approved by Oliver Mugiraneza</p>
          </div>

          {/* Table card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <RequestsTable demos={visibleDemos} loading={loading} />
          </div>
        </div>
      </div>
    </div>
  )
}
