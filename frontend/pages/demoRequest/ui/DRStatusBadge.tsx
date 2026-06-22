import { getStatusConfig } from '../data/fieldHelpers'

interface Props { status: string; size?: 'sm' | 'md' }

export default function DRStatusBadge({ status, size = 'sm' }: Props) {
  const cfg = getStatusConfig(status)
  const px = size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[11px]'
  return (
    <span
      className={`inline-flex items-center rounded font-semibold ${px}`}
      style={{ backgroundColor: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}
    >
      {cfg.label}
    </span>
  )
}
