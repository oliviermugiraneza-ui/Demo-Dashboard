import { STATUS_CONFIG } from '../lib/constants/demoStatus'

interface StatusBadgeProps {
  status: string
  showDot?: boolean
}

export default function StatusBadge({ status, showDot = true }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status] ?? {
    bg:'#F1F5F9', text:'#64748B', dot:'#94A3B8', label: status
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
    >
      {showDot && (
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.dot }} />
      )}
      {cfg.label}
    </span>
  )
}
