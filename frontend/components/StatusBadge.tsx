import type { DemoStatus } from '../pages/data/sampleData'

type StatusCfg = { bg: string; text: string; dot: string; label: string }

const STATUS_CONFIG: Record<string, StatusCfg> = {
  'Reviewed':     { bg:'#DCFCE7', text:'#15803D', dot:'#22C55E', label:'Reviewed' },
  'Needs Review': { bg:'#FEF3C7', text:'#92400E', dot:'#F59E0B', label:'Needs Review' },
  'NEEDS REVIEW': { bg:'#FEF3C7', text:'#92400E', dot:'#F59E0B', label:'Needs Review' },
  'Canceled':     { bg:'#FEE2E2', text:'#B91C1C', dot:'#EF4444', label:'Canceled' },
  'DELETED':      { bg:'#F1F5F9', text:'#64748B', dot:'#94A3B8', label:'Deleted' },
}

interface StatusBadgeProps {
  status: DemoStatus | string
  showDot?: boolean
}

export default function StatusBadge({ status, showDot = true }: StatusBadgeProps) {
  const cfg: StatusCfg = STATUS_CONFIG[status] ?? {
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
