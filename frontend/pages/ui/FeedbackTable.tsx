import { Star } from 'lucide-react'
import { type OperationFeedback } from '../data/sampleData'
import GeoBadge from '../../components/GeoBadge'

interface Props {
  data: OperationFeedback[]
}

const SAT_PALETTE: Record<number, { bg: string; color: string }> = {
  1: { bg: '#FEE2E2', color: '#991B1B' },
  2: { bg: '#FEF3C7', color: '#92400E' },
  3: { bg: '#FEF9C3', color: '#854D0E' },
  4: { bg: '#DCFCE7', color: '#166534' },
  5: { bg: '#D1FAE5', color: '#065F46' },
}

function SatBadge({ score }: { score: number }) {
  const p = SAT_PALETTE[score] ?? { bg: '#F3F4F6', color: '#374151' }
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold"
      style={{ background: p.bg, color: p.color }}
    >
      <Star size={11} className="fill-current" />
      {score}
    </span>
  )
}

const HEADERS = ['Date', 'Geo', 'Operator', 'Sat', 'Reported Issues', 'Comment', 'Host']

export default function FeedbackTable({ data }: Props) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-[#64748B] py-6 text-center">
        No feedback records match the current filters.
      </p>
    )
  }

  return (
    <div className="overflow-auto" style={{ maxHeight: 300 }}>
      <table className="min-w-full text-sm border-collapse">
        <thead className="sticky top-0 bg-white z-10 shadow-[0_1px_0_#E2E8F0]">
          <tr>
            {HEADERS.map(h => (
              <th
                key={h}
                className="py-2.5 px-3 text-left text-xs font-semibold text-[#64748B] whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((f, idx) => (
            <tr
              key={f.id}
              className={`border-b border-gray-100 hover:bg-[#F8FAFC] transition-colors ${
                idx % 2 === 1 ? 'bg-[#F8FAFC]/50' : ''
              }`}
            >
              <td className="py-2 px-3 text-[#0F172A] whitespace-nowrap font-mono text-xs">
                {f.date}
              </td>
              <td className="py-2 px-3">
                <GeoBadge geo={f.geo} />
              </td>
              <td className="py-2 px-3 text-[#0F172A] whitespace-nowrap text-xs">
                {f.operator}
              </td>
              <td className="py-2 px-3">
                <SatBadge score={f.satisfaction_score} />
              </td>
              <td className="py-2 px-3 text-[#64748B] text-xs max-w-[180px]">
                {f.reported_issues.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {f.reported_issues.map(issue => (
                      <span
                        key={issue}
                        className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-[10px] font-medium"
                      >
                        {issue}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-gray-300">—</span>
                )}
              </td>
              <td className="py-2 px-3 text-[#64748B] text-xs max-w-xs">
                <span className="line-clamp-2">{f.comments}</span>
              </td>
              <td className="py-2 px-3 text-[#0F172A] whitespace-nowrap text-xs">
                {f.feedback_host}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
