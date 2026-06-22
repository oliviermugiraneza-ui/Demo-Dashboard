import { type ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: string | number
  subLabel?: string
  accent?: string
  icon?: ReactNode
  trend?: { value: number; label?: string }
}

export default function StatCard({
  label,
  value,
  subLabel,
  accent = '#2563EB',
  icon,
  trend,
}: StatCardProps) {
  const trendPositive = (trend?.value ?? 0) >= 0

  return (
    <div
      className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 cursor-default
                 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
      style={{ borderTop: `3px solid ${accent}` }}
    >
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-[#64748B] leading-tight">{label}</p>
        {icon && (
          <span className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${accent}14`, color: accent }}>
            {icon}
          </span>
        )}
      </div>

      <p className="mt-2 text-3xl font-bold text-[#0F172A] tabular-nums leading-tight">
        {value}
      </p>

      <div className="mt-1.5 flex items-center gap-2 flex-wrap">
        {subLabel && (
          <p className="text-xs text-[#64748B]">{subLabel}</p>
        )}
        {trend && (
          <span
            className="inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: trendPositive ? '#DCFCE7' : '#FEE2E2',
              color: trendPositive ? '#15803D' : '#B91C1C',
            }}
          >
            {trendPositive ? '▲' : '▼'} {Math.abs(trend.value)}%
            {trend.label && <span className="font-normal opacity-75 ml-0.5">{trend.label}</span>}
          </span>
        )}
      </div>
    </div>
  )
}
