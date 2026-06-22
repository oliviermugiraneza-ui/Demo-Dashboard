import type { GeoCode } from '../pages/data/sampleData'

const GEO_CONFIG: Record<GeoCode, { bg: string; text: string; label: string }> = {
  UK: { bg: '#DBEAFE', text: '#1D4ED8', label: 'UK' },
  US: { bg: '#DCFCE7', text: '#15803D', label: 'US' },
  JP: { bg: '#FEE2E2', text: '#B91C1C', label: 'JP' },
  DE: { bg: '#FEF3C7', text: '#B45309', label: 'DE' },
  ST: { bg: '#E0E7EF', text: '#4B5563', label: 'ST' },
}

interface GeoBadgeProps {
  geo: GeoCode | string
  size?: 'sm' | 'md'
}

export default function GeoBadge({ geo, size = 'sm' }: GeoBadgeProps) {
  const cfg = GEO_CONFIG[geo as GeoCode] ?? { bg:'#F1F5F9', text:'#64748B', label: geo }
  const padding = size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-xs'

  return (
    <span
      className={`inline-flex items-center rounded font-semibold tracking-wider ${padding}`}
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
    >
      {cfg.label}
    </span>
  )
}
