import { leadBand } from '../pages/data/sampleData'

interface DelayBadgeProps {
  days: number | null | undefined
  showDays?: boolean
}

export default function DelayBadge({ days, showDays = true }: DelayBadgeProps) {
  const band = leadBand(days)

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold tracking-wide"
      style={{ backgroundColor: `${band.color}18`, color: band.color, border: `1px solid ${band.color}40` }}
    >
      {band.label}
      {showDays && days != null && days > 0 && (
        <span className="opacity-75 font-normal">({days}d)</span>
      )}
    </span>
  )
}
